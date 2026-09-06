export type DrawingPoint = { x: number; y: number };
export const MAX_DRAWING_STROKES = 20;
export const MAX_STROKE_POINTS = 200;

/** Keep endpoints and the most significant bends instead of truncating a long gesture. */
export function simplifyStroke(points: DrawingPoint[], limit = MAX_STROKE_POINTS): DrawingPoint[] {
  if (points.length <= limit) return points;
  const selected = new Set([0, points.length - 1]);
  const measure = (first: number, last: number) => {
    const a = points[first], b = points[last], dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    let index = -1, error = 0;
    for (let i = first + 1; i < last; i++) {
      const point = points[i];
      const fraction = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
      const distance = (point.x - a.x - fraction * dx) ** 2 + (point.y - a.y - fraction * dy) ** 2;
      if (distance > error) { error = distance; index = i; }
    }
    return { first, last, index, error };
  };
  const segments = [measure(0, points.length - 1)];
  while (selected.size < limit && segments.length) {
    let next = 0;
    for (let i = 1; i < segments.length; i++) if (segments[i].error > segments[next].error) next = i;
    const segment = segments.splice(next, 1)[0];
    if (segment.index < 0 || segment.error < 1e-12) break;
    selected.add(segment.index);
    if (segment.index - segment.first > 1) segments.push(measure(segment.first, segment.index));
    if (segment.last - segment.index > 1) segments.push(measure(segment.index, segment.last));
  }
  return [...selected].sort((a, b) => a - b).map(index => points[index]);
}

export function prepareDrawingFeedback(strokes: DrawingPoint[][]): DrawingPoint[][] {
  return strokes.filter(stroke => stroke.length > 1).slice(0, MAX_DRAWING_STROKES).map(stroke => simplifyStroke(stroke));
}
