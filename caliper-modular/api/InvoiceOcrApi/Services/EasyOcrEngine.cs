using System.Diagnostics;
using System.Text.Json;
using InvoiceOcrApi.Models;

namespace InvoiceOcrApi.Services;

/// <summary>
/// EasyOCR as a third engine. EasyOCR is a Python library (PyTorch), so it
/// runs in a sidecar: <c>easyocr_worker.py</c> is started once, loads its
/// models once, and then answers one JSON line per request over
/// stdin/stdout ({"path": image} → {"ok", "ms", "items": [{box, text, conf}]}).
/// Requests are serialised (one reader, one job at a time). When the module
/// is not installed the worker says so on its first line and the engine
/// reports "unavailable" with the install hint; the rest of the API is not
/// affected.
///   Ocr:EasyOcr:Enabled    true
///   Ocr:EasyOcr:Python     python  (interpreter with easyocr installed: pip install easyocr)
///   Ocr:EasyOcr:Languages  en      (comma separated, e.g. en,bn)
///   Ocr:EasyOcr:Gpu        false
///   Ocr:EasyOcr:Script     path of easyocr_worker.py; empty = next to the app
/// </summary>
public sealed class EasyOcrEngine : IDisposable
{
    public const string EngineName = "easyocr";

    private readonly ILogger<EasyOcrEngine> _log;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly object _lock = new();
    private readonly string _python, _languages, _script;
    private readonly bool _gpu;

    private Process? _proc;
    private TaskCompletionSource<bool>? _ready;
    private DateTime _lastStart = DateTime.MinValue;
    private readonly List<string> _stderr = new();

    public bool Enabled { get; }
    public string Label { get; private set; } = "EasyOCR";
    public string Status { get; private set; }     // disabled | loading | ok | unavailable | error
    public string? Error { get; private set; }

    public EasyOcrEngine(IConfiguration configuration, IHostEnvironment env, ILogger<EasyOcrEngine> log)
    {
        _log = log;
        Enabled = configuration.GetValue("Ocr:EasyOcr:Enabled", true);
        _python = configuration.GetValue("Ocr:EasyOcr:Python", "python") ?? "python";
        _languages = configuration.GetValue("Ocr:EasyOcr:Languages", "en") ?? "en";
        _gpu = configuration.GetValue("Ocr:EasyOcr:Gpu", false);
        string configured = configuration.GetValue("Ocr:EasyOcr:Script", string.Empty) ?? string.Empty;
        _script = configured.Length > 0 ? configured
                : File.Exists(Path.Combine(AppContext.BaseDirectory, "easyocr_worker.py")) ? Path.Combine(AppContext.BaseDirectory, "easyocr_worker.py")
                : Path.Combine(env.ContentRootPath, "easyocr_worker.py");
        Status = Enabled ? "loading" : "disabled";
        if (!Enabled) Error = "Ocr:EasyOcr:Enabled is false";
    }

    /// <summary>Starts the worker (idempotent); the models load in the background.</summary>
    public void Start()
    {
        if (!Enabled) return;
        lock (_lock)
        {
            if (_proc is { HasExited: false }) return;
            if (!File.Exists(_script)) { Status = "unavailable"; Error = "easyocr_worker.py not found at " + _script; return; }
            _lastStart = DateTime.UtcNow;
            var psi = new ProcessStartInfo(_python)
            {
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
                UseShellExecute = false, CreateNoWindow = true,
                StandardOutputEncoding = new System.Text.UTF8Encoding(false), StandardInputEncoding = new System.Text.UTF8Encoding(false)
            };
            psi.ArgumentList.Add(_script);
            psi.ArgumentList.Add("--langs"); psi.ArgumentList.Add(_languages);
            psi.ArgumentList.Add("--gpu"); psi.ArgumentList.Add(_gpu ? "1" : "0");
            psi.Environment["PYTHONIOENCODING"] = "utf-8";
            psi.Environment["PYTHONUNBUFFERED"] = "1";
            var ready = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            _ready = ready;
            _stderr.Clear();
            Status = "loading"; Error = null;
            try
            {
                _proc = Process.Start(psi) ?? throw new InvalidOperationException("could not start " + _python);
            }
            catch (Exception ex)
            {
                Status = "unavailable"; Error = "python not found (" + _python + "): " + ex.Message + " — set Ocr:EasyOcr:Python to an interpreter with easyocr installed";
                _log.LogWarning("EasyOCR unavailable: {Error}", Error);
                ready.TrySetResult(false);
                return;
            }
            var proc = _proc;
            _ = Task.Run(async () =>
            {
                try
                {
                    string? line;
                    while ((line = await proc.StandardError.ReadLineAsync()) is not null)
                        lock (_stderr) { _stderr.Add(line); if (_stderr.Count > 40) _stderr.RemoveAt(0); }
                }
                catch { /* process gone */ }
            });
            _ = Task.Run(async () =>
            {
                try
                {
                    string? first = await proc.StandardOutput.ReadLineAsync();
                    if (first is null) { Fail("the worker exited before it was ready: " + StderrTail()); ready.TrySetResult(false); return; }
                    using var doc = JsonDocument.Parse(first);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("ready", out var r) && r.GetBoolean())
                    {
                        string version = root.TryGetProperty("version", out var v) ? v.GetString() ?? "" : "";
                        Label = version.Length > 0 ? "EasyOCR " + version : "EasyOCR";
                        Status = "ok"; Error = null;
                        _log.LogInformation("{Label} ready (languages {Langs}, gpu {Gpu}, {Ms} ms to load)", Label, _languages, _gpu,
                            root.TryGetProperty("ms", out var ms) ? ms.GetInt64() : 0);
                        ready.TrySetResult(true);
                    }
                    else
                    {
                        Fail(root.TryGetProperty("error", out var e) ? e.GetString() : "worker not ready");
                        ready.TrySetResult(false);
                    }
                }
                catch (Exception ex) { Fail("unreadable worker start line: " + ex.Message + " " + StderrTail()); ready.TrySetResult(false); }
            });
        }
    }

    private void Fail(string? error)
    {
        Status = "unavailable"; Error = error;
        _log.LogWarning("EasyOCR unavailable: {Error}", error);
    }

    private string StderrTail() { lock (_stderr) return string.Join(" | ", _stderr.TakeLast(5)); }

    public EngineResult Skipped() => new(EngineName, Label, Status, Error, 0, null);

    public async Task<EngineResult> RunAsync(string imagePath, int width, int height, CancellationToken ct)
    {
        if (!Enabled) return Skipped();
        var watch = Stopwatch.StartNew();
        // a dead worker is started again, at most once every 30 s
        if (_proc is null || _proc.HasExited)
        {
            if (Status == "unavailable" && (DateTime.UtcNow - _lastStart) < TimeSpan.FromSeconds(30)) return Skipped();
            Start();
        }
        var ready = _ready;
        if (ready is null) return Skipped();
        // the first request of a cold start waits a little for the models; a
        // long first load (the models download) reports "loading" instead
        var done = await Task.WhenAny(ready.Task, Task.Delay(TimeSpan.FromSeconds(45), ct));
        if (done != ready.Task)
            return new EngineResult(EngineName, Label, "loading", "EasyOCR is still loading its models (the first start downloads them); the engine joins in on a later request", watch.ElapsedMilliseconds, null);
        if (!ready.Task.Result || Status != "ok") return Skipped();

        await _gate.WaitAsync(ct);
        try
        {
            var proc = _proc!;
            await proc.StandardInput.WriteLineAsync(JsonSerializer.Serialize(new { path = imagePath }));
            await proc.StandardInput.FlushAsync();
            var readTask = proc.StandardOutput.ReadLineAsync();
            var finished = await Task.WhenAny(readTask, Task.Delay(TimeSpan.FromSeconds(300), ct));
            if (finished != readTask)
            {
                try { proc.Kill(entireProcessTree: true); } catch { }
                Status = "error"; Error = "EasyOCR did not answer within 300 s; the worker was restarted";
                return new EngineResult(EngineName, Label, "error", Error, watch.ElapsedMilliseconds, null);
            }
            string? reply = await readTask;
            if (reply is null)
            {
                Status = "error"; Error = "the EasyOCR worker exited: " + StderrTail();
                return new EngineResult(EngineName, Label, "error", Error, watch.ElapsedMilliseconds, null);
            }
            using var doc = JsonDocument.Parse(reply);
            var root = doc.RootElement;
            if (!(root.TryGetProperty("ok", out var ok) && ok.GetBoolean()))
                return new EngineResult(EngineName, Label, "error", root.TryGetProperty("error", out var e) ? e.GetString() : "EasyOCR failed", watch.ElapsedMilliseconds, null);
            // one region per fragment; EasyOCR reports no character boxes, so
            // the characters are interpolated along each fragment (Estimated)
            var lines = new List<OcrLine>();
            var chars = new List<OcrSymbol>();
            foreach (var item in root.GetProperty("items").EnumerateArray())
            {
                string text = (item.GetProperty("text").GetString() ?? string.Empty).Trim();
                if (text.Length == 0) continue;
                double conf = item.TryGetProperty("conf", out var c) ? c.GetDouble() : 0;
                var poly = item.GetProperty("box").EnumerateArray()
                    .Select(p => new[] { Math.Clamp((int)Math.Round(p[0].GetDouble()), 0, width - 1), Math.Clamp((int)Math.Round(p[1].GetDouble()), 0, height - 1) })
                    .ToArray();
                if (poly.Length < 2) continue;
                var box = new Box(poly.Min(p => p[0]), poly.Min(p => p[1]), poly.Max(p => p[0]), poly.Max(p => p[1]));
                double confidence = Math.Round(Math.Clamp(conf, 0, 1), 4);
                lines.Add(new OcrLine(lines.Count, text, confidence, poly, box));
                Symbols.Estimate(chars, text, box, confidence, lines.Count - 1);
            }
            return new EngineResult(EngineName, Label, "ok", null, watch.ElapsedMilliseconds, chars) { Words = lines };
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "EasyOCR run failed");
            return new EngineResult(EngineName, Label, "error", ex.Message, watch.ElapsedMilliseconds, null);
        }
        finally { _gate.Release(); }
    }

    public void Dispose()
    {
        try { if (_proc is { HasExited: false }) _proc.Kill(entireProcessTree: true); } catch { }
        _proc?.Dispose();
    }
}
