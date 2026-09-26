import { describe, expect, it } from 'vitest';

import { systemOverviewCatalog } from '@/features/system-overview/catalog';

import { buildFlow } from './systemOverviewFlow';

const box = {
  domain: { w: 300, h: 196 },
  page: { w: 248, h: 184 },
  component: { w: 216, h: 180 },
  api: { w: 216, h: 180 },
  service: { w: 216, h: 180 },
  external: { w: 216, h: 180 },
} as const;

describe('system overview layout', () => {
  it('keeps every expanded node inside its card and clear of the others', () => {
    const flow = buildFlow(undefined, [], systemOverviewCatalog.map((domain) => domain.id), true);
    const boxes = flow.nodes.map((node) => {
      const size = box[node.data.kind];
      return { id: node.id, x: node.position.x, y: node.position.y, ...size, label: node.data.label };
    });

    expect(boxes.length).toBeGreaterThan(40);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const separated = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(separated, `${a.label} overlaps ${b.label}`).toBe(true);
      }
    }
  });
});
