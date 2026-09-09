using System.Diagnostics;
using InvoiceOcrApi.Models;
using OpenCvSharp;
using Sdcb.PaddleOCR;

namespace InvoiceOcrApi.Services;

/// <summary>
/// Upload → image → three engines in parallel (PaddleOCR in process,
/// Tesseract 5 through tesseract.exe, EasyOCR through its Python worker) →
/// (brief) PaddleOCR's raw lines, (deep) the layout from PaddleOCR's regions
/// with every engine's words placed into the same cells and a per-cell vote,
/// and the other engines' regions under "engines". Coordinates are in the
/// pixels of the uploaded image, so a caller that uploads its rectified
/// working image can overlay the result directly. An engine that is missing
/// or fails reports its status and the rest of the answer is unaffected.
/// </summary>
public sealed class InvoicePipeline
{
    private readonly OcrEngine _engine;
    private readonly TesseractEngine _tesseract;
    private readonly EasyOcrEngine _easyOcr;
    private readonly ILogger<InvoicePipeline> _log;

    public InvoicePipeline(OcrEngine engine, TesseractEngine tesseract, EasyOcrEngine easyOcr, ILogger<InvoicePipeline> log)
    {
        _engine = engine;
        _tesseract = tesseract;
        _easyOcr = easyOcr;
        _log = log;
    }

    public string EngineLabel =>
        "PaddleOCR PP-OCRv5 mobile (Sdcb.PaddleOCR)"
        + (_tesseract.Status == "ok" ? " + " + _tesseract.Label : string.Empty)
        + (_easyOcr.Status is "ok" or "loading" ? " + " + _easyOcr.Label : string.Empty);

    public async Task<InvoiceAnalysis> ProcessAsync(Stream stream, AnalysisDepth depth, CancellationToken ct)
    {
        var total = Stopwatch.StartNew();

        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, ct);
        byte[] bytes = buffer.ToArray();
        if (bytes.Length == 0) throw new InvalidDataException("The upload is empty.");

        using Mat image = Cv2.ImDecode(bytes, ImreadModes.Color);
        if (image.Empty()) throw new InvalidDataException("The upload is not a decodable image (PNG, JPEG, WEBP, BMP).");
        long decodeMs = total.ElapsedMilliseconds;

        // the file engines read a PNG of the same pixels; all three run at once
        var ocrWatch = Stopwatch.StartNew();
        string? tmp = null;
        PaddleOcrResult ocr;
        EngineResult tess, easy;
        try
        {
            if (_tesseract.Status == "ok" || _easyOcr.Enabled)
            {
                tmp = Path.Combine(Path.GetTempPath(), "invoiceocr_" + Guid.NewGuid().ToString("N") + ".png");
                Cv2.ImWrite(tmp, image);
            }
            Task<PaddleOcrResult> paddleTask = _engine.RunAsync(image, ct);
            Task<EngineResult> tessTask = tmp is null ? Task.FromResult(_tesseract.Skipped()) : _tesseract.RunAsync(tmp, image.Width, image.Height, ct);
            Task<EngineResult> easyTask = tmp is null ? Task.FromResult(_easyOcr.Skipped()) : _easyOcr.RunAsync(tmp, image.Width, image.Height, ct);
            await Task.WhenAll(paddleTask, tessTask, easyTask);
            ocr = paddleTask.Result; tess = tessTask.Result; easy = easyTask.Result;
        }
        finally
        {
            if (tmp is not null) { try { File.Delete(tmp); } catch { /* temp file */ } }
        }
        long ocrMs = ocrWatch.ElapsedMilliseconds;

        IReadOnlyList<OcrLine> lines = ToLines(ocr, image.Width, image.Height);
        var paddle = new EngineResult("paddle", "PaddleOCR PP-OCRv5 mobile", "ok", null, ocrMs, null);
        var engines = new List<EngineResult> { paddle, tess, easy };
        var extra = new Dictionary<string, IReadOnlyList<OcrLine>>();
        foreach (var e in new[] { easy, tess }) if (e.Status == "ok" && e.Lines is not null) extra[e.Name] = e.Lines;

        BriefResult? brief = depth is AnalysisDepth.Brief or AnalysisDepth.Both
            ? new BriefResult(lines, string.Join("\n", lines.Select(l => l.Text)))
            : null;

        var layoutWatch = Stopwatch.StartNew();
        DeepResult? deep = depth is AnalysisDepth.Deep or AnalysisDepth.Both
            ? LayoutAnalyzer.Analyze(lines, image.Width, image.Height, extra)
            : null;
        long layoutMs = layoutWatch.ElapsedMilliseconds;

        _log.LogInformation("Analysed {W}x{H} image: {Regions} paddle regions, tesseract {Tess} ({TessN}), easyocr {Easy} ({EasyN}), ocr {Ocr} ms, layout {Layout} ms",
            image.Width, image.Height, lines.Count, tess.Status, tess.Lines?.Count ?? 0, easy.Status, easy.Lines?.Count ?? 0, ocrMs, layoutMs);

        return new InvoiceAnalysis(
            depth.ToString().ToLowerInvariant(),
            EngineLabel,
            new ImageInfo(image.Width, image.Height),
            new TimingInfo(decodeMs, ocrMs, layoutMs, total.ElapsedMilliseconds) { Engines = engines.ToDictionary(e => e.Name, e => e.Ms) },
            brief, deep, engines);
    }

    /// <summary>Regions → lines in reading order (top to bottom, then left to right), boxes clamped to the image.</summary>
    private static IReadOnlyList<OcrLine> ToLines(PaddleOcrResult ocr, int width, int height)
    {
        var raw = new List<(int[][] poly, Box box, string text, double score)>();
        foreach (PaddleOcrResultRegion region in ocr.Regions)
        {
            string text = (region.Text ?? string.Empty).Trim();
            if (text.Length == 0) continue;

            Point2f[] pts = region.Rect.Points();
            int[][] poly = pts.Select(p => new[]
            {
                Math.Clamp((int)Math.Round(p.X), 0, width - 1),
                Math.Clamp((int)Math.Round(p.Y), 0, height - 1)
            }).ToArray();
            var box = new Box(poly.Min(p => p[0]), poly.Min(p => p[1]), poly.Max(p => p[0]), poly.Max(p => p[1]));
            raw.Add((poly, box, text, region.Score));
        }

        // reading order: sort by centre y, then x — ties within half a line height are the same row
        double medianHeight = raw.Count > 0 ? raw.Select(r => (double)r.box.Height).OrderBy(h => h).ElementAt(raw.Count / 2) : 10;
        raw.Sort((a, b) =>
        {
            double dy = a.box.CenterY - b.box.CenterY;
            if (Math.Abs(dy) > 0.5 * medianHeight) return dy < 0 ? -1 : 1;
            return a.box.X0.CompareTo(b.box.X0);
        });

        return raw.Select((r, i) => new OcrLine(i, r.text, Math.Round(r.score, 4), r.poly, r.box)).ToList();
    }
}
