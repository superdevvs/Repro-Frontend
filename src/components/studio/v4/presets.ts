import type { V4Config, V4Media, V4Preset } from './types';

export const V4_PRESETS: V4Preset[] = [
  { id: 'listing-ready', name: 'Listing ready', description: 'Balanced light. Natural color. Every photo ready.', kind: 'image', tag: 'Most used', icon: 'sparkles', color: 'workflow-photo-enhancement', workflow: 'photo-enhancement' },
  { id: 'twilight', name: 'Day to twilight', description: 'Warm windows and a beautiful evening sky.', kind: 'image', tag: 'Popular', icon: 'moon', color: 'workflow-twilight', workflow: 'twilight' },
  { id: 'virtual-staging', name: 'Virtual staging', description: 'Give empty rooms a considered, inviting look.', kind: 'image', tag: 'New', icon: 'sofa', color: 'workflow-photo-enhancement', workflow: 'photo-enhancement' },
  { id: 'walkthrough', name: 'Walkthrough', description: 'Smooth, drone-like motion through the property.', kind: 'video', tag: 'Popular', icon: 'video', color: 'workflow-listing-video', workflow: 'reel-generator' },
  { id: 'color-correction', name: 'Color correction', description: 'True whites, balanced exposure, crisp detail.', kind: 'image', tag: 'Most used', icon: 'sliders', color: 'hero-before', workflow: 'photo-enhancement' },
  { id: 'full-shoot', name: 'Full shoot edit', description: 'A consistent professional finish, across a shoot.', kind: 'image', tag: 'Batch', icon: 'layers', color: 'workflow-batch-ai-jobs', workflow: 'photo-enhancement' },
  { id: 'green-grass', name: 'Green grass', description: 'Refresh the lawn while keeping its texture.', kind: 'image', tag: 'New', icon: 'leaf', color: 'selected-shoot', workflow: 'photo-enhancement' },
  { id: 'sky-replacement', name: 'Sky replacement', description: 'A natural sky, matched to the property light.', kind: 'image', tag: 'New', icon: 'cloud', color: 'workflow-twilight', workflow: 'photo-enhancement' },
  { id: 'perspective-correction', name: 'Perspective correction', description: 'Straighten verticals while preserving the room.', kind: 'image', tag: 'New', icon: 'scan', color: 'hero-after', workflow: 'photo-enhancement' },
  { id: 'property-reel', name: 'Property reel', description: 'Turn your best rooms into a property story.', kind: 'video', tag: 'Most used', icon: 'film', color: 'workflow-reel-generator', workflow: 'reel-generator' },
  { id: 'social-teaser', name: 'Social teaser', description: 'A short first impression, made for social.', kind: 'video', tag: 'New', icon: 'play', color: 'workflow-video-cleanup', workflow: 'reel-generator' },
];
export const findPreset = (id?: string | null) => V4_PRESETS.find(p => p.id === id) || V4_PRESETS[0];
export function initialConfig(preset: V4Preset, media: V4Media[], prompt = ''): V4Config {
  const frames = media.filter(m => m.kind !== 'video').slice(0, preset.kind === 'image' ? undefined : preset.id === 'social-teaser' ? 3 : 6).map(m => ({ mediaId: m.id, method: 'extend' as const, duration: 5 }));
  return { prompt, ratio: preset.kind === 'video' ? '9:16' : '16:9', duration: preset.kind === 'video' ? Math.max(5, frames.length * 5) : 30, transition: 'none', transitionDuration: 0.5,
    text: { title: '', subtitle: '', style: 'none', position: 'bottom' }, adjustments: { preserveStructure: true, strength: 50, roomType: 'living-room', furnitureStyle: 'modern' }, frames };
}
