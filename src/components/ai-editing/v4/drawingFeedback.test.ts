import { describe, expect, it } from 'vitest';
import { MAX_STROKE_POINTS, prepareDrawingFeedback, simplifyStroke, type DrawingPoint } from './drawingFeedback';

describe('drawing feedback API limits', () => {
  it('retains the endpoints and exact corner of a long L-shaped gesture', () => {
    const horizontal = Array.from({ length: 601 }, (_, index) => ({ x: index / 600, y: 0 }));
    const vertical = Array.from({ length: 600 }, (_, index) => ({ x: 1, y: (index + 1) / 600 }));
    expect(simplifyStroke([...horizontal, ...vertical])).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
  });

  it('keeps a long curved gesture within 200 points without clipping the tail or flattening its loops', () => {
    const original = Array.from({ length: 5001 }, (_, index) => ({ x: index / 5000, y: .5 + .35 * Math.sin(index / 5000 * Math.PI * 8) }));
    const result = simplifyStroke(original);
    expect(result.length).toBeLessThanOrEqual(MAX_STROKE_POINTS);
    expect(result[0]).toEqual(original[0]);
    expect(result[result.length - 1]).toEqual(original[original.length - 1]);
    let segment = 0;
    for (const point of original) {
      while (segment < result.length - 2 && result[segment + 1].x < point.x) segment++;
      const a = result[segment], b = result[segment + 1];
      const y = a.y + (b.y - a.y) * (point.x - a.x) / (b.x - a.x);
      expect(Math.abs(y - point.y)).toBeLessThan(.002);
    }
  });

  it('defensively caps payload strokes and removes empty clicks', () => {
    const stroke: DrawingPoint[] = [{ x: .1, y: .2 }, { x: .3, y: .4 }];
    const result = prepareDrawingFeedback([[], [{ x: 0, y: 0 }], ...Array.from({ length: 25 }, () => stroke)]);
    expect(result).toHaveLength(20);
    expect(result.every(points => points.length <= 200)).toBe(true);
  });
});
