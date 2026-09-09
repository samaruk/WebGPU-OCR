using System.Text.Json.Serialization;
using InvoiceOcrApi.Services;
using Microsoft.AspNetCore.Http.Features;

/* ======================================================================
   InvoiceOcrApi  ·  invoice analysis with three OCR engines
     POST /api/invoice/analyze?depth=brief|deep|both   multipart field "file"
     GET  /api/invoice/health
   PaddleOCR (in process) reads the page and gives the layout; Tesseract 5
   (tesseract.exe) and EasyOCR (Python worker) read it at the same time and
   their words are placed into the same table cells and voted. CORS is open
   so the CALIPER browser app (any origin) can call it; the engines are
   singletons warmed up in the background at start.
   ====================================================================== */

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = 50L * 1024 * 1024);
builder.Services.AddSingleton<OcrEngine>();
builder.Services.AddSingleton<TesseractEngine>();
builder.Services.AddSingleton<EasyOcrEngine>();
builder.Services.AddSingleton<InvoicePipeline>();

var app = builder.Build();

app.UseCors();
app.MapControllers();
app.MapGet("/", (TesseractEngine tess, EasyOcrEngine easy) => Results.Ok(new
{
    service = "InvoiceOcrApi",
    analyze = "POST /api/invoice/analyze?depth=brief|deep|both  (multipart form field: file)",
    health = "GET /api/invoice/health",
    engines = new { paddle = "ok", tesseract5 = tess.Status, easyocr = easy.Status }
}));

// load the models now rather than on the first request
_ = Task.Run(() =>
{
    try { app.Services.GetRequiredService<OcrEngine>().WarmUp(); }
    catch (Exception ex) { app.Logger.LogError(ex, "OCR engine warm-up failed"); }
});
app.Services.GetRequiredService<EasyOcrEngine>().Start();
app.Services.GetRequiredService<TesseractEngine>();

app.Run();
