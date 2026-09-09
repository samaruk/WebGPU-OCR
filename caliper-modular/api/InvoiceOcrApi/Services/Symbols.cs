using InvoiceOcrApi.Models;

namespace InvoiceOcrApi.Services;

/// <summary>
/// Character-level results. Tesseract reports a box per character (hOCR with
/// hocr_char_boxes); PaddleOCR and EasyOCR report a box per region only, so
/// for them the characters' boxes are interpolated along the region box by
/// character count — a letter takes one slot, a space half a slot and no
/// symbol — and flagged Estimated. The estimate is what the browser did
/// itself when it cut a region into columns; doing it once here keeps every
/// engine's answer in the same shape.
/// </summary>
public static class Symbols
{
    /// <summary>Appends the characters of one word / region with interpolated boxes.</summary>
    public static void Estimate(List<OcrSymbol> into, string text, Box box, double confidence, int word)
    {
        if (string.IsNullOrEmpty(text)) return;
        double total = 0;
        foreach (char c in text) total += char.IsWhiteSpace(c) ? 0.5 : 1;
        if (total <= 0) return;
        double width = box.X1 - box.X0 + 1, cursor = 0;
        foreach (char c in text)
        {
            double slot = char.IsWhiteSpace(c) ? 0.5 : 1;
            if (!char.IsWhiteSpace(c))
            {
                int x0 = box.X0 + (int)Math.Floor(width * cursor / total);
                int x1 = box.X0 + (int)Math.Ceiling(width * (cursor + slot) / total) - 1;
                x1 = Math.Max(x0, Math.Min(x1, box.X1));
                into.Add(new OcrSymbol(into.Count, c.ToString(), confidence, new Box(x0, box.Y0, x1, box.Y1), word, true));
            }
            cursor += slot;
        }
    }

    /// <summary>The characters of a whole list of words / regions, in order.</summary>
    public static IReadOnlyList<OcrSymbol> EstimateAll(IReadOnlyList<OcrLine> words)
    {
        var list = new List<OcrSymbol>();
        foreach (var w in words) Estimate(list, w.Text, w.Bbox, w.Confidence, w.Index);
        return list;
    }
}
