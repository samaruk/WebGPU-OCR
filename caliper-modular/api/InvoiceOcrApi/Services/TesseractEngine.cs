using System.Diagnostics;
using System.Globalization;
using InvoiceOcrApi.Models;

namespace InvoiceOcrApi.Services;

/// <summary>
/// Tesseract 5 as a second engine, driven through the installed
/// <c>tesseract.exe</c> (Ocr:Tesseract:Exe, else the PATH and the usual
/// install folders). The page is read in TSV mode so every WORD comes back
/// with its own box and confidence; words, not lines, are what the layout
/// step and the browser need, because a table row read as one line would
/// have to be cut into cells by character count.
///   Ocr:Tesseract:Enabled   true
///   Ocr:Tesseract:Exe       path of tesseract(.exe); empty = find it
///   Ocr:Tesseract:Language  eng (any installed tessdata language, "eng+ben" for two)
///   Ocr:Tesseract:Psm       6 = one uniform block (rows in order); 11 = sparse text
/// </summary>
public sealed class TesseractEngine
{
    public const string EngineName = "tesseract5";

    private readonly ILogger<TesseractEngine> _log;
    private readonly SemaphoreSlim _gate = new(2, 2);
    private readonly string? _exe;
    private readonly string _language;
    private readonly int _psm;

    public bool Enabled { get; }
    public string Status { get; }          // ok | unavailable | disabled
    public string? Error { get; }
    public string Label { get; }           // "Tesseract 5.5.0"

    public TesseractEngine(IConfiguration configuration, ILogger<TesseractEngine> log)
    {
        _log = log;
        Enabled = configuration.GetValue("Ocr:Tesseract:Enabled", true);
        _language = configuration.GetValue("Ocr:Tesseract:Language", "eng") ?? "eng";
        _psm = configuration.GetValue("Ocr:Tesseract:Psm", 6);
        Label = "Tesseract 5";

        if (!Enabled) { Status = "disabled"; Error = "Ocr:Tesseract:Enabled is false"; return; }

        _exe = Locate(configuration.GetValue("Ocr:Tesseract:Exe", string.Empty));
        if (_exe is null)
        {
            Status = "unavailable";
            Error = "tesseract executable not found: install Tesseract 5 (https://github.com/UB-Mannheim/tesseract/wiki on Windows) or set Ocr:Tesseract:Exe";
            _log.LogWarning("Tesseract engine unavailable: {Error}", Error);
            return;
        }
        try
        {
            string version = Run(_exe, new[] { "--version" }, TimeSpan.FromSeconds(20)).stdout.Split('\n')[0].Trim();
            // "tesseract v5.5.0.20241111" → "Tesseract 5.5.0"
            var m = System.Text.RegularExpressions.Regex.Match(version, @"(\d+\.\d+(\.\d+)?)");
            Label = m.Success ? "Tesseract " + m.Groups[1].Value : "Tesseract";
            Status = "ok";
            _log.LogInformation("{Label} ready ({Exe}, language {Lang}, psm {Psm})", Label, _exe, _language, _psm);
        }
        catch (Exception ex)
        {
            Status = "unavailable"; Error = "tesseract failed to start: " + ex.Message;
            _log.LogWarning("Tesseract engine unavailable: {Error}", Error);
        }
    }

    private static string? Locate(string? configured)
    {
        if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured)) return configured;
        var candidates = new List<string>();
        string exeName = OperatingSystem.IsWindows() ? "tesseract.exe" : "tesseract";
        foreach (string dir in (Environment.GetEnvironmentVariable("PATH") ?? string.Empty).Split(Path.PathSeparator))
            if (dir.Length > 0) candidates.Add(Path.Combine(dir, exeName));
        candidates.Add(@"C:\Program Files\Tesseract-OCR\tesseract.exe");
        candidates.Add(@"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe");
        candidates.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Tesseract-OCR", "tesseract.exe"));
        candidates.Add("/usr/bin/tesseract");
        candidates.Add("/usr/local/bin/tesseract");
        candidates.Add("/opt/homebrew/bin/tesseract");
        return candidates.FirstOrDefault(File.Exists);
    }

    public EngineResult Skipped() => new(EngineName, Label, Status, Error, 0, null);

    /// <summary>
    /// Reads the image file in hOCR mode with character boxes: every word
    /// comes back with its box and confidence (x_wconf) and every character
    /// inside it with its own box and confidence (ocrx_cinfo: x_bboxes, x_conf).
    /// </summary>
    public async Task<EngineResult> RunAsync(string imagePath, int width, int height, CancellationToken ct)
    {
        if (Status != "ok" || _exe is null) return Skipped();
        var watch = Stopwatch.StartNew();
        await _gate.WaitAsync(ct);
        try
        {
            var args = new[] { imagePath, "stdout", "--psm", _psm.ToString(CultureInfo.InvariantCulture), "-l", _language, "-c", "hocr_char_boxes=1", "hocr" };
            var (stdout, stderr, code) = await Task.Run(() => Run(_exe, args, TimeSpan.FromSeconds(180)), ct);
            if (code != 0)
                return new EngineResult(EngineName, Label, "error", "tesseract exited with code " + code + ": " + Tail(stderr), watch.ElapsedMilliseconds, null);
            var (words, chars) = ParseHocr(stdout, width, height);
            return new EngineResult(EngineName, Label, "ok", null, watch.ElapsedMilliseconds, chars) { Words = words };
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Tesseract run failed");
            return new EngineResult(EngineName, Label, "error", ex.Message, watch.ElapsedMilliseconds, null);
        }
        finally { _gate.Release(); }
    }

    private static readonly System.Text.RegularExpressions.Regex BoxRe = new(@"\b(?:bbox|x_bboxes) (\d+) (\d+) (\d+) (\d+)", System.Text.RegularExpressions.RegexOptions.Compiled);
    private static readonly System.Text.RegularExpressions.Regex ConfRe = new(@"\bx_w?conf ([\d.]+)", System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>
    /// hOCR is XHTML: every <c>ocrx_word</c> span (title "bbox x0 y0 x1 y1;
    /// x_wconf N") holds one <c>ocrx_cinfo</c> span per character (title
    /// "x_bboxes x0 y0 x1 y1; x_conf F"). Words keep the layout step working;
    /// the characters are the reported symbols. A word without character spans
    /// (a build without hocr_char_boxes) gets interpolated ones. hOCR boxes are
    /// exclusive at the far edge; ours are inclusive.
    /// </summary>
    private static (IReadOnlyList<OcrLine> words, IReadOnlyList<OcrSymbol> chars) ParseHocr(string hocr, int width, int height)
    {
        var words = new List<OcrLine>();
        var chars = new List<OcrSymbol>();
        Box? boxOf(string? title)
        {
            var m = title is null ? null : BoxRe.Match(title);
            if (m is null || !m.Success) return null;
            int x0 = Math.Clamp(int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture), 0, width - 1), y0 = Math.Clamp(int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture), 0, height - 1);
            int x1 = Math.Clamp(int.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture) - 1, x0, width - 1), y1 = Math.Clamp(int.Parse(m.Groups[4].Value, CultureInfo.InvariantCulture) - 1, y0, height - 1);
            return new Box(x0, y0, x1, y1);
        }
        double confOf(string? title)
        {
            var m = title is null ? null : ConfRe.Match(title);
            return m is { Success: true } && double.TryParse(m.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out double c) ? Math.Round(Math.Clamp(c, 0, 100) / 100.0, 4) : 0;
        }
        var settings = new System.Xml.XmlReaderSettings { DtdProcessing = System.Xml.DtdProcessing.Ignore, XmlResolver = null };
        using var sr = new StringReader(hocr);
        using var xr = System.Xml.XmlReader.Create(sr, settings);
        var doc = System.Xml.Linq.XDocument.Load(xr);
        static string? cls(System.Xml.Linq.XElement e) => (string?)e.Attribute("class");
        foreach (var w in doc.Descendants().Where(e => e.Name.LocalName == "span" && cls(e) == "ocrx_word"))
        {
            var box = boxOf((string?)w.Attribute("title"));
            if (box is null) continue;
            double wconf = confOf((string?)w.Attribute("title"));
            var wordChars = new List<OcrSymbol>();
            var sb = new System.Text.StringBuilder();
            foreach (var c in w.Descendants().Where(e => e.Name.LocalName == "span" && cls(e) == "ocrx_cinfo"))
            {
                string ch = c.Value.Trim();
                var cb = boxOf((string?)c.Attribute("title"));
                if (ch.Length == 0 || cb is null) continue;
                wordChars.Add(new OcrSymbol(0, ch, confOf((string?)c.Attribute("title")), cb, words.Count, false));
                sb.Append(ch);
            }
            string text = wordChars.Count > 0 ? sb.ToString() : w.Value.Trim();
            if (text.Length == 0) continue;
            var poly = new[] { new[] { box.X0, box.Y0 }, new[] { box.X1, box.Y0 }, new[] { box.X1, box.Y1 }, new[] { box.X0, box.Y1 } };
            words.Add(new OcrLine(words.Count, text, wconf, poly, box));
            if (wordChars.Count > 0) foreach (var c in wordChars) chars.Add(c with { Index = chars.Count });
            else Symbols.Estimate(chars, text, box, wconf, words.Count - 1);
        }
        return (words, chars);
    }

    private static (string stdout, string stderr, int code) Run(string exe, string[] args, TimeSpan timeout)
    {
        var psi = new ProcessStartInfo(exe) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true, StandardOutputEncoding = System.Text.Encoding.UTF8 };
        foreach (string a in args) psi.ArgumentList.Add(a);
        using var proc = Process.Start(psi) ?? throw new InvalidOperationException("could not start " + exe);
        var outTask = proc.StandardOutput.ReadToEndAsync();
        var errTask = proc.StandardError.ReadToEndAsync();
        if (!proc.WaitForExit((int)timeout.TotalMilliseconds))
        {
            try { proc.Kill(entireProcessTree: true); } catch { /* already gone */ }
            throw new TimeoutException("tesseract did not finish within " + timeout.TotalSeconds + " s");
        }
        proc.WaitForExit();
        return (outTask.Result, errTask.Result, proc.ExitCode);
    }

    private static string Tail(string s) => s.Length <= 300 ? s.Trim() : s[^300..].Trim();
}
