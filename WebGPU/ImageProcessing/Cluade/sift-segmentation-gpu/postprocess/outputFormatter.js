/**
 * postprocess/outputFormatter.js – produces the final structured output object.
 */
export class OutputFormatter {
  static format(graph, bboxes, polygonFits, W, H) {
    const bboxMap = new Map(bboxes.map(b => [b.id, b]));
    const polyMap = new Map(polygonFits.map(p => [p.id, p.polygon]));

    const segments = graph.nodes.map(n => ({
      id:          n.id,
      area:        n.area ?? 0,
      cx:          n.cx,
      cy:          n.cy,
      bbox:        bboxMap.get(n.id) ?? null,
      polygon:     polyMap.get(n.id) ?? null,
      color:       { r: Math.round(n.meanR ?? 128), g: Math.round(n.meanG ?? 128), b: Math.round(n.meanB ?? 128) },
      compactness: n.compactness ?? 0,
    }));

    return { width: W, height: H, segments, segmentCount: segments.length };
  }
}
