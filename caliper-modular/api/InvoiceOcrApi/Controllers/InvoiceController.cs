using InvoiceOcrApi.Models;
using InvoiceOcrApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceOcrApi.Controllers;

[ApiController]
[Route("api/invoice")]
public sealed class InvoiceController : ControllerBase
{
    private readonly InvoicePipeline _pipeline;
    private readonly ILogger<InvoiceController> _log;

    public InvoiceController(InvoicePipeline pipeline, ILogger<InvoiceController> log)
    {
        _pipeline = pipeline;
        _log = log;
    }

    /// <summary>POST an invoice image. <c>?depth=brief|deep|both</c> (default both).</summary>
    [HttpPost("analyze")]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<IActionResult> Analyze(
        [FromForm] IFormFile? file,
        [FromQuery] string depth = "both",
        CancellationToken ct = default)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No image uploaded." });

        if (!Enum.TryParse<AnalysisDepth>(depth, ignoreCase: true, out var parsed))
            return BadRequest(new { error = $"Invalid depth '{depth}'. Use brief, deep or both." });

        try
        {
            await using var stream = file.OpenReadStream();
            var result = await _pipeline.ProcessAsync(stream, parsed, ct);
            return Ok(result);
        }
        catch (InvalidDataException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Invoice analysis failed");
            return StatusCode(500, new { error = "Analysis failed.", detail = ex.Message });
        }
    }

    /// <summary>Liveness / readiness: 200 once PaddleOCR has loaded its models; the other engines' status alongside.</summary>
    [HttpGet("health")]
    public IActionResult Health([FromServices] OcrEngine engine, [FromServices] TesseractEngine tesseract, [FromServices] EasyOcrEngine easyOcr)
    {
        engine.WarmUp();
        return Ok(new
        {
            status = "ok",
            engine = _pipeline.EngineLabel,
            engines = new
            {
                paddle = new { status = "ok", label = "PaddleOCR PP-OCRv5 mobile" },
                tesseract5 = new { status = tesseract.Status, label = tesseract.Label, error = tesseract.Error },
                easyocr = new { status = easyOcr.Status, label = easyOcr.Label, error = easyOcr.Error }
            }
        });
    }
}
