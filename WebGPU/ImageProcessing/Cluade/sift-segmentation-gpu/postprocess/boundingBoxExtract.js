/**
 * postprocess/boundingBoxExtract.js – extract axis-aligned bounding boxes from graph nodes.
 */
export class BoundingBoxExtract {
  static extract(graph) {
    return graph.nodes.map(n => ({
      id:    n.id,
      x:     n.bbox?.[0] ?? n.cx,
      y:     n.bbox?.[1] ?? n.cy,
      w:     (n.bbox?.[2] ?? n.cx) - (n.bbox?.[0] ?? n.cx) + 1,
      h:     (n.bbox?.[3] ?? n.cy) - (n.bbox?.[1] ?? n.cy) + 1,
    }));
  }
}
