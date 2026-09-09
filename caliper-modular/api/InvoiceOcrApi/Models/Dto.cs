using System.Text.Json.Serialization;

namespace InvoiceOcrApi.Models;

/// <summary>Axis-aligned box in image pixels, inclusive corners.</summary>
public sealed record Box(int X0, int Y0, int X1, int Y1)
{
    [JsonIgnore] public int Width => X1 - X0 + 1;
    [JsonIgnore] public int Height => Y1 - Y0 + 1;
    [JsonIgnore] public double CenterX => (X0 + X1) / 2.0;
    [JsonIgnore] public double CenterY => (Y0 + Y1) / 2.0;

    public static Box Union(Box a, Box b) =>
        new(Math.Min(a.X0, b.X0), Math.Min(a.Y0, b.Y0), Math.Max(a.X1, b.X1), Math.Max(a.Y1, b.Y1));
}

/// <summary>One OCR text region in reading order: polygon (4 corners), box, text, confidence 0–1.</summary>
public sealed record OcrLine(int Index, string Text, double Confidence, int[][] Polygon, Box Bbox);

/// <summary>Depth "brief": the raw regions plus their concatenation.</summary>
public sealed record BriefResult(IReadOnlyList<OcrLine> Lines, string FullText);

/// <summary>Text of one table cell: the regions under the column joined left to right.</summary>
public sealed record CellText(int Col, string Text, double Confidence, Box? Bbox);

/// <summary>A physical text row. Kind is header, table or footer. Cells only for table rows.</summary>
public sealed record LayoutRow(int Index, string Kind, Box Bbox, string Text, IReadOnlyList<int> Lines, IReadOnlyList<CellText>? Cells);

/// <summary>A column of the item table, x range in the column-de-skewed frame.</summary>
public sealed record ColumnSpan(int Index, int X0, int X1);

/// <summary>
/// The item table: which rows, the columns, the cell texts and confidences
/// (PaddleOCR's). When other engines ran, EngineCells / EngineConfidence hold
/// their reading of the same cells (words placed by centre into the same rows
/// and columns) and Consensus the vote: a text at least two engines agree on,
/// else PaddleOCR's, else the most confident other reading; ConsensusSource
/// names who supplied each cell ("vote:paddle+easyocr", "paddle", "tesseract5", "").
/// </summary>
public sealed record TableResult(
    int FirstRow, int LastRow, int RowCount, int ColumnCount, Box Bbox, string? FooterCut,
    IReadOnlyList<ColumnSpan> Columns, string[][] Cells, double[][] Confidence)
{
    public IReadOnlyDictionary<string, string[][]>? EngineCells { get; init; }
    public IReadOnlyDictionary<string, double[][]>? EngineConfidence { get; init; }
    public string[][]? Consensus { get; init; }
    public string[][]? ConsensusSource { get; init; }
}

/// <summary>
/// One engine's reading of the page. Name: paddle | tesseract5 | easyocr.
/// Status: ok | unavailable | loading | error | disabled. Lines: the regions
/// (Tesseract and EasyOCR: one per word / fragment, each with its own box);
/// null for PaddleOCR, whose regions are brief.lines.
/// </summary>
public sealed record EngineResult(string Name, string Label, string Status, string? Error, long Ms, IReadOnlyList<OcrLine>? Lines);

/// <summary>A key field read from a row: the row's text after the label and the numbers in it.</summary>
public sealed record Field(string Key, int Row, string Text, IReadOnlyList<string> Numbers);

/// <summary>Depth "deep": the page as header / item table / footer.</summary>
public sealed record DeepResult(
    double RowTiltDeg, double ColumnTiltDeg,
    IReadOnlyList<LayoutRow> Rows, TableResult? Table,
    IReadOnlyList<int> HeaderRows, IReadOnlyList<int> FooterRows,
    IReadOnlyList<Field> Fields);

public sealed record ImageInfo(int Width, int Height);

public sealed record TimingInfo(long DecodeMs, long OcrMs, long LayoutMs, long TotalMs)
{
    /// <summary>Milliseconds per engine (the engines run in parallel; OcrMs is the slowest).</summary>
    public IReadOnlyDictionary<string, long>? Engines { get; init; }
}

/// <summary>The response of POST /api/invoice/analyze.</summary>
public sealed record InvoiceAnalysis(
    string Depth, string Engine, ImageInfo Image, TimingInfo Timing,
    BriefResult? Brief, DeepResult? Deep, IReadOnlyList<EngineResult> Engines);
