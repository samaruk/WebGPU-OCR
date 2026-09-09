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

    /// <summary>Reads the image file; every word becomes one region.</summary>
    public async Task<EngineResult> RunAsync(string imagePath, int width, int height, CancellationToken ct)
    {
        if (Status != "ok" || _exe is null) return Skipped();
        var watch = Stopwatch.StartNew();
        await _gate.WaitAsync(ct);
        try
        {
            var args = new[] { imagePath, "stdout", "--psm", _psm.ToString(CultureInfo.InvariantCulture), "-l", _language, "tsv" };
            var (stdout, stderr, code) = await Task.Run(() => Run(_exe, args, TimeSpan.FromSeconds(180)), ct);
            if (code != 0)
                return new EngineResult(EngineName, Label, "error", "tesseract exited with code " + code + ": " + Tail(stderr), watch.ElapsedMilliseconds, null);
            var lines = ParseTsv(stdout, width, height);
            return new EngineResult(EngineName, Label, "ok", null, watch.ElapsedMilliseconds, lines);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Tesseract run failed");
            return new EngineResult(EngineName, Label, "error", ex.Message, watch.ElapsedMilliseconds, null);
        }
        finally { _gate.Release(); }
    }

    /// <summary>TSV: level page block par line word left top width height conf text; level 5 = word.</summary>
    private static IReadOnlyList<OcrLine> ParseTsv(string tsv, int width, int height)
    {
        var words = new List<OcrLine>();
        foreach (string raw in tsv.Split('\n'))
        {
            string line = raw.TrimEnd('\r');
            string[] f = line.Split('\t');
            if (f.Length < 12 || f[0] != "5") continue;
            string text = f[11].Trim();
            if (text.Length == 0) continue;
            if (!double.TryParse(f[10], NumberStyles.Float, CultureInfo.InvariantCulture, out double conf) || conf < 0) continue;
            int left = int.Parse(f[6], CultureInfo.InvariantCulture), top = int.Parse(f[7], CultureInfo.InvariantCulture);
            int w = int.Parse(f[8], CultureInfo.InvariantCulture), h = int.Parse(f[9], CultureInfo.InvariantCulture);
            int x0 = Math.Clamp(left, 0, width - 1), y0 = Math.Clamp(top, 0, height - 1);
            int x1 = Math.Clamp(left + w - 1, 0, width - 1), y1 = Math.Clamp(top + h - 1, 0, height - 1);
            var poly = new[] { new[] { x0, y0 }, new[] { x1, y0 }, new[] { x1, y1 }, new[] { x0, y1 } };
            words.Add(new OcrLine(words.Count, text, Math.Round(conf / 100.0, 4), poly, new Box(x0, y0, x1, y1)));
        }
        return words;
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
