import type { StudioRatio, V4Config, V4Frame, V4Media, V4Output, V4PreparedFrame, V4Region } from '@/components/studio/v4/types';

export const RATIO_VALUES: Record<StudioRatio, number> = { '9:16': 9 / 16, '16:9': 16 / 9, '1:1': 1, '4:5': 4 / 5 };
export const FRAME_SECONDS = 5;
export const isWorkspaceRunning = (status: string) => status === 'preparing' || status === 'generating';
export const methodLabel = (method: V4Frame['method']) => ({ extend: 'AI Extend', crop: 'Smart Crop', fit: 'Already fits' })[method];

export function latestOutputs(outputs: V4Output[]): Map<string, V4Output> {
  const result = new Map<string, V4Output>();
  for (const output of outputs) {
    if (!output.url || !['completed', 'ready'].includes(output.status)) continue;
    const previous = result.get(output.mediaId);
    if (!previous || output.version >= previous.version) result.set(output.mediaId, output);
  }
  return result;
}

/** An explicitly reviewed older version is a delivery choice, not a request for the latest. */
export function reviewedOutputs(outputs: V4Output[], reviewedIds: ReadonlySet<string>): Map<string, V4Output> {
  const result = latestOutputs(outputs);
  for (const id of reviewedIds) {
    const selected = outputs.find(output => output.id === id && output.url && ['completed', 'ready'].includes(output.status));
    if (selected) result.set(selected.mediaId, selected);
  }
  return result;
}

export function currentPreparedFrame(frames: V4PreparedFrame[], mediaId: string, method: V4Frame['method'], ratio?: StudioRatio) {
  return frames.filter(frame => frame.mediaId === mediaId && frame.method === method && (!ratio || !frame.ratio || frame.ratio === ratio) && frame.url && ['completed', 'ready'].includes(frame.status)).sort((a, b) => b.version - a.version)[0];
}

/** Preserve selections and order on every edit; never silently substitute arbitrary media. */
export function selectedFrames(config: V4Config, media: V4Media[]): V4Frame[] {
  const ids = new Set(media.filter(item => item.kind !== 'video').map(item => item.id));
  const seen = new Set<string>();
  return config.frames.filter(frame => ids.has(frame.mediaId) && !seen.has(frame.mediaId) && Boolean(seen.add(frame.mediaId)));
}

export function prepareMethod(width: number, height: number, ratio: StudioRatio): V4Frame['method'] {
  if (!width || !height) return ratio === '9:16' ? 'extend' : 'crop';
  return Math.abs(width / height - RATIO_VALUES[ratio]) / RATIO_VALUES[ratio] < .025 ? 'fit' : ratio === '9:16' || ratio === '4:5' ? 'extend' : 'crop';
}

export function clampUnit(value: number) { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
export function regionFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): V4Region {
  const x = Math.min(clampUnit(a.x), clampUnit(b.x)), y = Math.min(clampUnit(a.y), clampUnit(b.y));
  return { x, y, width: Math.max(clampUnit(a.x), clampUnit(b.x)) - x, height: Math.max(clampUnit(a.y), clampUnit(b.y)) - y };
}

export function containRect(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number) {
  const scale = Math.min(containerWidth / (imageWidth || 1), containerHeight / (imageHeight || 1));
  const width = imageWidth * scale, height = imageHeight * scale;
  return { x: (containerWidth - width) / 2, y: (containerHeight - height) / 2, width, height };
}
