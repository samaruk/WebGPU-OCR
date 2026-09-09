using System.Text.RegularExpressions;
using InvoiceOcrApi.Models;

namespace InvoiceOcrApi.Services;

/// <summary>
/// Layout from OCR regions alone: every invoice is header, item table and
/// footer. The steps mirror the browser pipeline at region level:
///   1. rows      — regions clustered on their de-skewed centre y (the row
///                  slope is a width-weighted median of the wide regions'
///                  own tilt, so a tilted photo does not split rows);
///   2. band      — the longest run of rows with three or more regions
///                  (one thin row allowed between), i.e. the item table;
///   3. columns   — a coverage profile of the band's region boxes, x
///                  de-skewed along the columns (their slope is the one with
///                  the most clear bins, searched ±3° around the row slope);
///                  gutters are runs almost no row covers;
///   4. cells     — every band region goes to the column under its centre;
///   5. footer    — from the fourth item row on, a row that names a total
///                  (Sub Total, Grand Total, …) or has no first-column entry
///                  while filling far fewer columns than an item row ends the
///                  table — unless a run of item rows follows at once, which
///                  makes it a sub-total inside the table;
///   6. fields    — invoice number, dates, totals, amount in words by regex
///                  over each row's text.
/// </summary>
public static class LayoutAnalyzer
{
    private static readonly Regex TotalsRe = new(
        @"\b(sub\s*total|grand\s*total|net\s*total|total\s*(amount|payable|value|trade\s*price|discount|vat|sales)?\s*:|" +
        @"total\s+payable|net\s+(sales|payable)\s+amount|amount\s+in\s+(tk|taka|words?|figures?)|in\s+words?\s*:|free\s+product)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex NumberRe = new(@"-?\d[\d,]*\.\d{1,2}|-?\d[\d,]*", RegexOptions.Compiled);

    private static readonly (string key, Regex re)[] FieldRes =
    {
        ("invoiceNo",     new Regex(@"\b(invoice|bill|memo)\s*(no|number|#)\.?\s*[:.\-]?\s*(?<v>[A-Z0-9][A-Z0-9\-/]{2,})", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("invoiceDate",   new Regex(@"\b(invoice\s*date|bill\s*dt|date)\.?\s*[:.]?\s*(?<v>\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}(\s+\d{1,2}:\d{2}(\s*[ap]m)?)?)", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("orderNo",       new Regex(@"\border\s*(no|number)\.?\s*[:.]?\s*(?<v>[A-Z0-9][A-Z0-9\-/]{2,})", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("customer",      new Regex(@"\b(client|customer)\s*(name)?\s*[:.]?\s*(?<v>.{3,})", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("subTotal",      new Regex(@"\bsub\s*total\s*[:.]?\s*(?<v>.*)$", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("grandTotal",    new Regex(@"\bgrand\s*total\s*[:.]?\s*(?<v>.*)$", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("totalPayable",  new Regex(@"\b(total\s*payable(\s*amount)?|net\s*payable|net\s*(sales\s*)?amount|amount\s*payable)\s*[:.]?\s*(?<v>.*)$", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("totalVat",      new Regex(@"\btotal\s*vat\s*[:.]?\s*(?<v>.*)$", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("totalDiscount", new Regex(@"\btotal\s*discount\s*[:.]?\s*(?<v>.*)$", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
        ("amountInWords", new Regex(@"\b(amount\s+in\s+(tk|taka|words?)|in\s+words?)\s*[:.]?\s*(?<v>.{3,})", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
    };

    private sealed class Row
    {
        public List<OcrLine> Lines = new();
        public double Cy;                 // de-skewed centre y
        public Box Bbox = null!;
        public string Kind = "other";
        public string Text = string.Empty;
        public bool Tabular => Lines.Count >= 3;
    }

    public static DeepResult Analyze(IReadOnlyList<OcrLine> lines, int width, int height) =>
        Analyze(lines, width, height, new Dictionary<string, IReadOnlyList<OcrLine>>());

    /// <param name="extra">Other engines' regions by engine name; each is placed into the table's cells and voted.</param>
    public static DeepResult Analyze(IReadOnlyList<OcrLine> lines, int width, int height, IReadOnlyDictionary<string, IReadOnlyList<OcrLine>> extra)
    {
        if (lines.Count == 0)
            return new DeepResult(0, 0, Array.Empty<LayoutRow>(), null, Array.Empty<int>(), Array.Empty<int>(), Array.Empty<Field>());

        double medianHeight = Median(lines.Select(l => (double)l.Bbox.Height));

        /* 1 · rows in a de-skewed frame */
        double rowSlope = EstimateRowSlope(lines, medianHeight);
        var rows = ClusterRows(lines, rowSlope, medianHeight);

        /* 2 · the item table band: longest run of tabular rows */
        (int first, int last) = FindBand(rows);
        string? footerCut = null;
        double columnSlope = rowSlope;
        List<ColumnSpan> columns = new();
        List<(int x0, int x1)> gutters = new();

        if (first >= 0)
        {
            /* 2b · foreign rows: a key-value block (Invoice No / Order Date …)
               glued to the table has a third of the regions of an item row;
               the table is the block between such rows holding the most
               tabular rows. Non-tabular rows (wrapped names) never break it. */
            (first, last) = LargestBlock(rows, first, last);

            /* 3 · columns of the band */
            (columnSlope, gutters) = FindColumns(rows, first, last, rowSlope, medianHeight);
            columns = SpansFromGutters(rows, first, last, columnSlope, gutters);

            /* 5 · footer cut, then the columns again on the trimmed band */
            int cut = FooterCut(rows, first, last, columnSlope, columns, out footerCut);
            if (cut < last)
            {
                last = cut;
                (columnSlope, gutters) = FindColumns(rows, first, last, rowSlope, medianHeight);
                columns = SpansFromGutters(rows, first, last, columnSlope, gutters);
            }
            for (int k = 0; k < rows.Count; k++) rows[k].Kind = k < first ? "header" : k > last ? "footer" : "table";
        }
        else
        {
            foreach (var r in rows) r.Kind = "header";
        }

        /* 4 · cells and the row list */
        var layoutRows = new List<LayoutRow>();
        var cellTexts = new List<string[]>();
        var cellConf = new List<double[]>();
        for (int k = 0; k < rows.Count; k++)
        {
            Row r = rows[k];
            IReadOnlyList<CellText>? cells = null;
            if (r.Kind == "table" && columns.Count > 0)
            {
                var perCol = CellsOf(r, columns, columnSlope);
                cells = perCol;
                cellTexts.Add(perCol.Select(c => c.Text).ToArray());
                cellConf.Add(perCol.Select(c => c.Confidence).ToArray());
            }
            layoutRows.Add(new LayoutRow(k, r.Kind, r.Bbox, r.Text, r.Lines.Select(l => l.Index).ToList(), cells));
        }

        TableResult? table = null;
        if (first >= 0 && columns.Count > 0)
        {
            Box bb = rows[first].Bbox;
            for (int k = first + 1; k <= last; k++) bb = Box.Union(bb, rows[k].Bbox);
            table = new TableResult(first, last, last - first + 1, columns.Count, bb, footerCut,
                                    columns, cellTexts.ToArray(), cellConf.ToArray());

            /* 4b · the other engines' words into the same cells, then the vote */
            if (extra.Count > 0)
            {
                var engineCells = new Dictionary<string, string[][]>();
                var engineConf = new Dictionary<string, double[][]>();
                foreach (var (name, words) in extra)
                {
                    var (cells, conf) = EngineCells(rows, first, last, columns, columnSlope, rowSlope, medianHeight, words);
                    engineCells[name] = cells; engineConf[name] = conf;
                }
                var (consensus, source) = Consensus(table.Cells, table.Confidence, engineCells, engineConf);
                table = table with { EngineCells = engineCells, EngineConfidence = engineConf, Consensus = consensus, ConsensusSource = source };
            }
        }

        /* 6 · key fields */
        var fields = ReadFields(rows);

        return new DeepResult(
            Math.Round(Math.Atan(rowSlope) * 180 / Math.PI, 3),
            Math.Round(Math.Atan(columnSlope) * 180 / Math.PI, 3),
            layoutRows, table,
            rows.Select((r, i) => (r, i)).Where(t => t.r.Kind == "header").Select(t => t.i).ToList(),
            rows.Select((r, i) => (r, i)).Where(t => t.r.Kind == "footer").Select(t => t.i).ToList(),
            fields);
    }

    /* ---- 1 · rows --------------------------------------------------------- */

    /// <summary>Width-weighted median of the top-edge slope of wide regions (dy/dx).</summary>
    private static double EstimateRowSlope(IReadOnlyList<OcrLine> lines, double medianHeight)
    {
        var samples = new List<(double slope, double weight)>();
        foreach (var l in lines)
        {
            if (l.Bbox.Width < 4 * medianHeight) continue;
            // the two top-most polygon corners give the region's own tilt
            var top = l.Polygon.OrderBy(p => p[1]).Take(2).OrderBy(p => p[0]).ToArray();
            double dx = top[1][0] - top[0][0];
            if (dx < 2 * medianHeight) continue;
            double slope = (top[1][1] - top[0][1]) / dx;
            if (Math.Abs(slope) > 0.15) continue;    // more than 8.5°: a rotated region, not the page
            samples.Add((slope, l.Bbox.Width));
        }
        if (samples.Count == 0) return 0;
        samples.Sort((a, b) => a.slope.CompareTo(b.slope));
        double half = samples.Sum(s => s.weight) / 2, acc = 0;
        foreach (var s in samples) { acc += s.weight; if (acc >= half) return s.slope; }
        return samples[^1].slope;
    }

    private static List<Row> ClusterRows(IReadOnlyList<OcrLine> lines, double slope, double medianHeight)
    {
        var sorted = lines.Select(l => (line: l, cy: l.Bbox.CenterY - slope * l.Bbox.CenterX)).OrderBy(t => t.cy).ToList();
        var rows = new List<Row>();
        foreach (var (line, cy) in sorted)
        {
            Row? home = rows.Count > 0 && Math.Abs(cy - rows[^1].Cy) <= 0.5 * medianHeight ? rows[^1] : null;
            if (home is null) { home = new Row { Cy = cy }; rows.Add(home); }
            home.Lines.Add(line);
            home.Cy = home.Lines.Average(l => l.Bbox.CenterY - slope * l.Bbox.CenterX);
        }
        foreach (var r in rows)
        {
            r.Lines.Sort((a, b) => a.Bbox.X0.CompareTo(b.Bbox.X0));
            r.Bbox = r.Lines.Skip(1).Aggregate(r.Lines[0].Bbox, (acc, l) => Box.Union(acc, l.Bbox));
            r.Text = string.Join(" ", r.Lines.Select(l => l.Text));
        }
        return rows;
    }

    /* ---- 2 · band --------------------------------------------------------- */

    private static (int first, int last) FindBand(List<Row> rows)
    {
        int bestFirst = -1, bestLast = -1, bestCount = 0;
        for (int i = 0; i < rows.Count; i++)
        {
            if (!rows[i].Tabular) continue;
            int j = i, last = i, count = 0;
            while (j < rows.Count)
            {
                if (rows[j].Tabular) { last = j; count++; j++; continue; }
                int k = j; while (k < rows.Count && !rows[k].Tabular) k++;
                if (k < rows.Count && k - j <= 1) j = k; else break;       // one thin row (a wrapped name) may sit between
            }
            if (count > bestCount) { bestCount = count; bestFirst = i; bestLast = last; }
            i = last;
        }
        return bestCount >= 2 ? (bestFirst, bestLast) : (-1, -1);
    }

    private static (int first, int last) LargestBlock(List<Row> rows, int first, int last)
    {
        var counts = new List<double>();
        for (int k = first; k <= last; k++) if (rows[k].Tabular) counts.Add(rows[k].Lines.Count);
        double itemPieces = Median(counts);
        bool Foreign(int k) => rows[k].Tabular && rows[k].Lines.Count < 0.5 * itemPieces;

        int bestFirst = first, bestLast = last, bestCount = -1;
        int curFirst = -1, curCount = 0;
        for (int k = first; k <= last + 1; k++)
        {
            bool end = k > last || Foreign(k);
            if (end)
            {
                if (curFirst >= 0 && curCount > bestCount) { bestCount = curCount; bestFirst = curFirst; bestLast = k - 1; }
                curFirst = -1; curCount = 0;
                continue;
            }
            if (curFirst < 0) curFirst = k;
            if (rows[k].Tabular) curCount++;
        }
        while (bestFirst < bestLast && !rows[bestFirst].Tabular) bestFirst++;
        while (bestLast > bestFirst && !rows[bestLast].Tabular) bestLast--;
        return bestCount > 0 ? (bestFirst, bestLast) : (first, last);
    }

    /* ---- 3 · columns ------------------------------------------------------ */

    private static (double slope, List<(int x0, int x1)> gutters) FindColumns(List<Row> rows, int first, int last, double rowSlope, double medianHeight)
    {
        var band = rows.Skip(first).Take(last - first + 1).Where(r => r.Tabular).ToList();
        double best = rowSlope; int bestScore = -1;
        for (int k = -50; k <= 50; k++)
        {
            double s = rowSlope + k * 0.001;
            int score = ClearBins(band, s);
            if (score > bestScore || (score == bestScore && Math.Abs(s - rowSlope) < Math.Abs(best - rowSlope))) { bestScore = score; best = s; }
        }
        return (best, Gutters(band, best, medianHeight));
    }

    private static (int x0, int[] coverage) Profile(List<Row> band, double slope)
    {
        int lo = int.MaxValue, hi = int.MinValue;
        var ext = new List<List<(int a, int b)>>();
        foreach (var r in band)
        {
            var e = new List<(int, int)>();
            foreach (var l in r.Lines)
            {
                double cy = l.Bbox.CenterY;
                int a = (int)Math.Floor(l.Bbox.X0 + slope * cy), b = (int)Math.Ceiling(l.Bbox.X1 + slope * cy);
                e.Add((a, b)); lo = Math.Min(lo, a); hi = Math.Max(hi, b);
            }
            ext.Add(e);
        }
        if (lo > hi) return (0, Array.Empty<int>());
        var cov = new int[hi - lo + 1];
        var mask = new bool[cov.Length];
        foreach (var e in ext)
        {
            Array.Clear(mask);
            foreach (var (a, b) in e) for (int x = a; x <= b; x++) mask[x - lo] = true;
            for (int x = 0; x < cov.Length; x++) if (mask[x]) cov[x]++;
        }
        return (lo, cov);
    }

    private static int ClearBins(List<Row> band, double slope)
    {
        var (_, cov) = Profile(band, slope);
        double clearMax = 0.1 * band.Count;
        // only the stretch the rows share counts, so spreading the rows apart cannot score
        int n = 0; for (int x = 0; x < cov.Length; x++) if (cov[x] <= clearMax) n++;
        return n;
    }

    private static List<(int x0, int x1)> Gutters(List<Row> band, double slope, double medianHeight)
    {
        var (x0, cov) = Profile(band, slope);
        var gutters = new List<(int, int)>();
        if (cov.Length == 0) return gutters;
        double clearMax = Math.Max(0.15 * band.Count, 0.5);   // at most 15 % of the rows may cross a gutter
        int minWidth = Math.Max(3, (int)Math.Round(0.4 * medianHeight));
        int x = 0;
        while (x < cov.Length)
        {
            if (cov[x] <= clearMax)
            {
                int e = x; while (e + 1 < cov.Length && cov[e + 1] <= clearMax) e++;
                if (e - x + 1 >= minWidth && x > 0 && e < cov.Length - 1) gutters.Add((x0 + x, x0 + e));
                x = e + 1;
            }
            else x++;
        }
        return gutters;
    }

    private static List<ColumnSpan> SpansFromGutters(List<Row> rows, int first, int last, double slope, List<(int x0, int x1)> gutters)
    {
        int lo = int.MaxValue, hi = int.MinValue;
        for (int k = first; k <= last; k++)
            foreach (var l in rows[k].Lines)
            {
                lo = Math.Min(lo, (int)Math.Floor(l.Bbox.X0 + slope * l.Bbox.CenterY));
                hi = Math.Max(hi, (int)Math.Ceiling(l.Bbox.X1 + slope * l.Bbox.CenterY));
            }
        var spans = new List<ColumnSpan>();
        int start = lo;
        foreach (var g in gutters)
        {
            if (g.x0 - 1 >= start) spans.Add(new ColumnSpan(spans.Count, start, g.x0 - 1));
            start = g.x1 + 1;
        }
        if (hi >= start) spans.Add(new ColumnSpan(spans.Count, start, hi));
        return spans;
    }

    /* ---- 4 · cells -------------------------------------------------------- */

    private static int ColumnOf(OcrLine l, List<ColumnSpan> columns, double slope)
    {
        double cx = l.Bbox.CenterX + slope * l.Bbox.CenterY;
        int best = -1; double bestDist = double.MaxValue;
        for (int i = 0; i < columns.Count; i++)
        {
            var c = columns[i];
            double d = cx < c.X0 ? c.X0 - cx : cx > c.X1 ? cx - c.X1 : 0;
            if (d < bestDist) { bestDist = d; best = i; }
        }
        return best;
    }

    private static List<CellText> CellsOf(Row r, List<ColumnSpan> columns, double slope)
    {
        var groups = new List<OcrLine>[columns.Count];
        for (int i = 0; i < groups.Length; i++) groups[i] = new List<OcrLine>();
        foreach (var l in r.Lines) { int c = ColumnOf(l, columns, slope); if (c >= 0) groups[c].Add(l); }
        var cells = new List<CellText>();
        for (int i = 0; i < groups.Length; i++)
        {
            var g = groups[i].OrderBy(l => l.Bbox.X0).ToList();
            if (g.Count == 0) { cells.Add(new CellText(i, string.Empty, 0, null)); continue; }
            cells.Add(new CellText(i, string.Join(" ", g.Select(l => l.Text)),
                                   Math.Round(g.Average(l => l.Confidence), 4),
                                   g.Skip(1).Aggregate(g[0].Bbox, (acc, l) => Box.Union(acc, l.Bbox))));
        }
        return cells;
    }

    /* ---- 4b · other engines' words in the table's cells ------------------- */

    /// <summary>
    /// Every region of another engine goes to the table row whose de-skewed
    /// centre is nearest (within a row height) and to the column under its
    /// centre. A fragment holding several words (EasyOCR reads "2x10's T3641004 1"
    /// as one) is split into its words, each placed along the box by character
    /// count, so a fragment spanning two columns fills both.
    /// </summary>
    private static (string[][] cells, double[][] conf) EngineCells(List<Row> rows, int first, int last, List<ColumnSpan> columns,
                                                                    double columnSlope, double rowSlope, double medianHeight, IReadOnlyList<OcrLine> words)
    {
        int n = last - first + 1;
        var groups = new List<(double x, string text, double conf)>[n, columns.Count];
        foreach (var w in words)
        {
            string[] parts = w.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) continue;
            double cyd = w.Bbox.CenterY - rowSlope * w.Bbox.CenterX;
            int best = -1; double bd = double.MaxValue;
            for (int k = first; k <= last; k++)
            {
                if (rows[k].Kind != "table") continue;
                double d = Math.Abs(cyd - rows[k].Cy);
                double tol = Math.Max(0.6 * medianHeight, 0.5 * Median(rows[k].Lines.Select(l => (double)l.Bbox.Height)));
                if (d <= tol && d < bd) { bd = d; best = k; }
            }
            if (best < 0) continue;
            int total = parts.Sum(p => p.Length) + parts.Length - 1, acc = 0;
            foreach (string p in parts)
            {
                double fx0 = w.Bbox.X0 + w.Bbox.Width * (double)acc / Math.Max(1, total);
                double fx1 = w.Bbox.X0 + w.Bbox.Width * (double)(acc + p.Length) / Math.Max(1, total);
                acc += p.Length + 1;
                double cx = (fx0 + fx1) / 2 + columnSlope * w.Bbox.CenterY;
                int col = -1; double cd = double.MaxValue;
                for (int i = 0; i < columns.Count; i++)
                {
                    var c = columns[i];
                    double d = cx < c.X0 ? c.X0 - cx : cx > c.X1 ? cx - c.X1 : 0;
                    if (d < cd) { cd = d; col = i; }
                }
                if (col < 0 || cd > Math.Max(8, 0.5 * columns[col].X1 - 0.5 * columns[col].X0)) continue;
                (groups[best - first, col] ??= new()).Add((cx, p, w.Confidence));
            }
        }
        var cells = new string[n][]; var conf = new double[n][];
        for (int r = 0; r < n; r++)
        {
            cells[r] = new string[columns.Count]; conf[r] = new double[columns.Count];
            for (int c = 0; c < columns.Count; c++)
            {
                var g = groups[r, c];
                if (g is null || g.Count == 0) { cells[r][c] = string.Empty; conf[r][c] = 0; continue; }
                g.Sort((a, b) => a.x.CompareTo(b.x));
                cells[r][c] = string.Join(" ", g.Select(t => t.text));
                conf[r][c] = Math.Round(g.Average(t => t.conf), 4);
            }
        }
        return (cells, conf);
    }

    private static readonly string[] EnginePriority = { "paddle", "easyocr", "tesseract5" };
    private static readonly Regex KeyRe = new(@"[\s.,:;'""`·\-]", RegexOptions.Compiled);
    private static string Key(string s) => KeyRe.Replace(s.ToLowerInvariant(), string.Empty);

    private static readonly Regex TidyNumberRe = new(@"^[-+]?\d[\d,]*(\.\d+)?%?$", RegexOptions.Compiled);

    /// <summary>
    /// Per cell: the reading at least two engines agree on (spelling from the
    /// engine highest in priority: PaddleOCR, EasyOCR, Tesseract; in a numeric
    /// column the spelling that is one clean number), else the most confident
    /// reading (PaddleOCR first on a tie). In a numeric column (most of
    /// PaddleOCR's cells there are numbers) a reading that is not one clean
    /// number does not vote while a clean one exists.
    /// </summary>
    private static (string[][] text, string[][] source) Consensus(string[][] paddle, double[][] paddleConf,
                                                                   Dictionary<string, string[][]> engineCells, Dictionary<string, double[][]> engineConf)
    {
        int n = paddle.Length;
        int cols = n > 0 ? paddle[0].Length : 0;
        var numericCol = new bool[cols];
        for (int c = 0; c < cols; c++)
        {
            int filled = 0, numbers = 0;
            for (int r = 0; r < n; r++) if (c < paddle[r].Length && paddle[r][c].Length > 0) { filled++; if (TidyNumberRe.IsMatch(paddle[r][c].Replace(" ", ""))) numbers++; }
            numericCol[c] = filled > 0 && numbers >= 0.6 * filled;
        }
        static bool Tidy(string s) => TidyNumberRe.IsMatch(s);
        var text = new string[n][]; var source = new string[n][];
        for (int r = 0; r < n; r++)
        {
            int m = paddle[r].Length;
            text[r] = new string[m]; source[r] = new string[m];
            for (int c = 0; c < m; c++)
            {
                var cands = new List<(string name, string text, double conf)>();
                if (paddle[r][c].Length > 0) cands.Add(("paddle", paddle[r][c], paddleConf[r][c]));
                foreach (string name in EnginePriority.Skip(1))
                    if (engineCells.TryGetValue(name, out var cells) && r < cells.Length && c < cells[r].Length && cells[r][c].Length > 0)
                        cands.Add((name, cells[r][c], engineConf[name][r][c]));
                if (cands.Count == 0) { text[r][c] = string.Empty; source[r][c] = string.Empty; continue; }
                var voters = c < cols && numericCol[c] && cands.Any(x => Tidy(x.text)) ? cands.Where(x => Tidy(x.text)).ToList() : cands;
                var groups = voters.GroupBy(x => Key(x.text)).Where(g => g.Key.Length > 0)
                    .OrderByDescending(g => g.Count()).ThenByDescending(g => g.Any(x => x.name == "paddle") ? 1 : 0).ThenByDescending(g => g.Sum(x => x.conf)).ToList();
                if (groups.Count > 0 && groups[0].Count() >= 2)
                {
                    var g = groups[0].OrderBy(x => Array.IndexOf(EnginePriority, x.name)).ToList();
                    var chosen = c < cols && numericCol[c] && !Tidy(g[0].text) ? g.FirstOrDefault(x => Tidy(x.text)) : g[0];
                    if (chosen.name is null) chosen = g[0];
                    text[r][c] = chosen.text; source[r][c] = "vote:" + string.Join("+", g.Select(x => x.name));
                    continue;
                }
                // no two agree: the most confident reading (PaddleOCR first on a tie)
                var pick = voters.OrderByDescending(x => x.conf).ThenBy(x => Array.IndexOf(EnginePriority, x.name)).First();
                text[r][c] = pick.text; source[r][c] = pick.name;
            }
        }
        return (text, source);
    }

    /* ---- 5 · footer ------------------------------------------------------- */

    private static int FooterCut(List<Row> rows, int first, int last, double slope, List<ColumnSpan> columns, out string? reason)
    {
        reason = null;
        if (columns.Count < 2) return last;
        bool HasFirst(Row r) => r.Lines.Any(l => ColumnOf(l, columns, slope) == 0);
        int Filled(Row r) => r.Lines.Select(l => ColumnOf(l, columns, slope)).Distinct().Count();

        var itemRows = new List<Row>();
        for (int k = first; k <= last; k++) if (rows[k].Tabular && HasFirst(rows[k])) itemRows.Add(rows[k]);
        double itemFill = itemRows.Count > 0 ? Median(itemRows.Select(r => (double)Filled(r))) : columns.Count;

        bool Continues(int k)
        {
            int j = k + 1, skipped = 0;
            while (j <= last && !rows[j].Tabular) { j++; if (++skipped > 1) return false; }
            int n = 0;
            for (; j <= last; j++)
            {
                if (!rows[j].Tabular) continue;
                if (HasFirst(rows[j])) { if (++n >= 3) return true; } else break;
            }
            return false;
        }

        int established = 0;
        for (int k = first; k <= last; k++)
        {
            Row r = rows[k];
            if (!r.Tabular) continue;
            bool keyword = TotalsRe.IsMatch(r.Text);
            if (HasFirst(r) && !keyword) { established++; continue; }
            if (established < 3) continue;
            bool totalsLike = keyword || Filled(r) < 0.7 * itemFill;
            if (!totalsLike || Continues(k)) continue;
            reason = keyword ? "keywords" : "structure";
            return k - 1;
        }
        return last;
    }

    /* ---- 6 · fields ------------------------------------------------------- */

    private static List<Field> ReadFields(List<Row> rows)
    {
        var found = new List<Field>();
        var seen = new HashSet<string>();
        for (int k = 0; k < rows.Count; k++)
        {
            string text = rows[k].Text;
            foreach (var (key, re) in FieldRes)
            {
                if (seen.Contains(key)) continue;
                var m = re.Match(text);
                if (!m.Success) continue;
                string value = m.Groups["v"].Value.Trim();
                if (value.Length == 0) continue;
                var numbers = NumberRe.Matches(value).Select(x => x.Value).ToList();
                found.Add(new Field(key, k, value, numbers));
                seen.Add(key);
            }
        }
        return found;
    }

    private static double Median(IEnumerable<double> values)
    {
        var v = values.OrderBy(x => x).ToList();
        if (v.Count == 0) return 0;
        return v.Count % 2 == 1 ? v[v.Count / 2] : (v[v.Count / 2 - 1] + v[v.Count / 2]) / 2;
    }
}
