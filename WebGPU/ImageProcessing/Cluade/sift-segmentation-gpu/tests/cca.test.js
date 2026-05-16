/**
 * tests/cca.test.js – unit tests for connected component analysis.
 */
import { UnionFind } from '../segmentation/cca/unionFind.js';
import { flattenLabels } from '../segmentation/cca/flattenLabels.js';

describe('UnionFind', () => {
  test('each element is its own root initially', () => {
    const uf = new UnionFind(5);
    for (let i = 0; i < 5; i++) expect(uf.find(i)).toBe(i);
  });

  test('union connects elements', () => {
    const uf = new UnionFind(5);
    uf.union(0, 1); uf.union(1, 2);
    expect(uf.connected(0, 2)).toBe(true);
    expect(uf.connected(0, 3)).toBe(false);
  });
});

describe('flattenLabels', () => {
  test('maps component IDs to dense range', () => {
    const labels = new Int32Array([10, 20, 10, -1, 20]);
    const components = [{ id: 10 }, { id: 20 }];
    const flat = flattenLabels(labels, components);
    expect(flat[0]).toBe(0);
    expect(flat[1]).toBe(1);
    expect(flat[3]).toBe(-1);
  });
});
