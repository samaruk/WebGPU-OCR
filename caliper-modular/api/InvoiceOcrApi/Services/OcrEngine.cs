using OpenCvSharp;
using Sdcb.PaddleInference;
using Sdcb.PaddleOCR;
using Sdcb.PaddleOCR.Models;
using Sdcb.PaddleOCR.Models.Local;

namespace InvoiceOcrApi.Services;

/// <summary>
/// The PaddleOCR engine (Sdcb.PaddleOCR, PP-OCR v5 English models bundled with the app).
/// A PaddleOcrAll instance is not thread-safe, so requests go through
/// QueuedPaddleOcrAll: a bounded queue served by a fixed number of engine
/// instances (Ocr:Consumers in appsettings, default 1). The models load on
/// first use; Program.cs warms the engine up in the background at start.
/// </summary>
public sealed class OcrEngine : IDisposable
{
    private readonly QueuedPaddleOcrAll _queue;
    private readonly int _recognizeBatch;
    private readonly ILogger<OcrEngine> _log;

    public OcrEngine(IConfiguration configuration, ILogger<OcrEngine> log)
    {
        _log = log;
        int consumers = Math.Max(1, configuration.GetValue("Ocr:Consumers", 1));
        int maxSide = Math.Max(960, configuration.GetValue("Ocr:MaxSide", 2560));
        // MKL-DNN math threads: Paddle Inference defaults to ONE, and the detector on a
        // 2560 px page then takes tens of seconds; four threads leave room for the
        // other engines that run at the same time (Ocr:Threads, 0 = the library default)
        int threads = Math.Max(0, configuration.GetValue("Ocr:Threads", 4));
        _recognizeBatch = Math.Max(0, configuration.GetValue("Ocr:RecognizeBatchSize", 16));

        _queue = new QueuedPaddleOcrAll(() =>
        {
            // PP-OCRv5 mobile (bundled). The v5 "Chinese" pair is the
            // multilingual one — Latin letters and digits included — and the
            // only v5 pair the local package carries (its English rec model
            // is not embedded). Ocr:Model may name any LocalFullModels member.
            FullOcrModel model = ResolveModel(configuration.GetValue("Ocr:Model", "ChineseV5"));
            var all = new PaddleOcrAll(model, PaddleDevice.Mkldnn(cacheCapacity: 10, cpuMathThreadCount: threads))
            {
                AllowRotateDetection = false,     // upright pages: axis-aligned crops (the rotated-crop path flips
                                                  // near-horizontal boxes upside down with this OpenCV's angle convention)
                Enable180Classification = false   // invoices are never upside down
            };
            all.Detector.MaxSize = maxSide;       // do not shrink a 1500–2600 px page before detection
            _log.LogInformation("PaddleOCR engine ready ({Model}, MKL-DNN {Threads} threads, max side {MaxSide}px, recognition batch {Batch})", model.GetType().Name, threads == 0 ? "default" : threads.ToString(), maxSide, _recognizeBatch);
            return all;
        }, consumers, boundedCapacity: 64);
    }

    private static FullOcrModel ResolveModel(string name)
    {
        var prop = typeof(LocalFullModels).GetProperty(name, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
        if (prop?.GetValue(null) is FullOcrModel m) return m;
        throw new InvalidOperationException($"Ocr:Model '{name}' is not a LocalFullModels member (try ChineseV5).");
    }

    /// <summary>Loads the models by running a tiny blank image through the queue.</summary>
    public void WarmUp()
    {
        using var blank = new Mat(64, 256, MatType.CV_8UC3, Scalar.White);
        _queue.Run(blank, recognizeBatchSize: 0, configure: null, cancellationToken: CancellationToken.None).GetAwaiter().GetResult();
    }

    /// <summary>Runs detection + recognition on a BGR image.</summary>
    public Task<PaddleOcrResult> RunAsync(Mat image, CancellationToken ct) =>
        _queue.Run(image, recognizeBatchSize: _recognizeBatch, configure: null, cancellationToken: ct);   // the region crops are recognised in batches, not one by one

    public void Dispose() => _queue.Dispose();
}
