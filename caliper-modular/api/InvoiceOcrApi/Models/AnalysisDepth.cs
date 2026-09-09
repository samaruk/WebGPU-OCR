namespace InvoiceOcrApi.Models;

/// <summary>
/// How far the analysis goes.
///   Brief — raw OCR: every text region with its polygon, box, text and confidence.
///   Deep  — layout: rows, the item table (columns, cells, footer cut), header / footer rows, key fields.
///   Both  — brief and deep in one response (the default).
/// </summary>
public enum AnalysisDepth
{
    Brief,
    Deep,
    Both
}
