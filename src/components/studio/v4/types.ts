export type StudioMediaKind = 'image' | 'video' | 'raw';
export type StudioRatio = '9:16' | '16:9' | '1:1' | '4:5';
export interface V4Media { id: string; shootId?: number; fileId?: number; mediaRef?: string; url: string; thumbnailUrl: string; name: string; kind: StudioMediaKind }
export interface V4Preset { id: string; name: string; description: string; kind: 'image' | 'video'; tag: string; icon: string; color: string; workflow: 'photo-enhancement' | 'twilight' | 'listing-video' | 'reel-generator'; }
export interface V4Frame { mediaId: string; method: 'extend' | 'crop' | 'fit'; duration: number; prompt?: string }
export interface V4Config {
  prompt: string; ratio: StudioRatio; duration: number; transition: string; transitionDuration: number;
  text: { title: string; subtitle: string; style: 'none' | 'minimal' | 'editorial' | 'lower-third' | 'graphic'; position: 'top' | 'center' | 'bottom'; timing?: 'last-scene' | 'all' };
  adjustments: Record<string, string | number | boolean>; frames: V4Frame[];
  reviewedOutputIds?: string[]; reviewedFrameIds?: string[];
}
export interface V4Output { id: string; mediaId: string; url: string; thumbnailUrl?: string; kind: 'image' | 'video'; version: number; status: string }
export interface V4PreparedFrame { mediaId: string; url: string; method: 'extend' | 'crop' | 'fit'; ratio?: StudioRatio; status: string; version: number }
export interface V4Workspace {
  version?: number;
  generation?: { phase: 'submitting' | 'generating' | 'rendering'; total: number; submitted: number; completed: number } | null;
  id: string; name: string; presetId: string; media: V4Media[]; config: V4Config;
  status: 'draft' | 'preparing' | 'ready' | 'generating' | 'completed' | 'failed' | 'cancelled';
  progress: number | null; error: string | null; outputs: V4Output[]; preparedFrames: V4PreparedFrame[];
  createdAt: string; updatedAt: string;
}
export interface V4Region { x: number; y: number; width: number; height: number }
export interface V4Feedback { mediaId: string; prompt: string; region?: V4Region; drawing?: { x: number; y: number }[][] }
export interface V4Segment { id: string; label: string; region: V4Region }
export interface V4WorkspaceProps {
  workspace: V4Workspace; preset: V4Preset; busy: boolean; error: string | null;
  onBack: () => void; onChangeMedia: () => void;
  onSave: (config: V4Config) => Promise<void>;
  onGenerate: (config: V4Config) => Promise<void>;
  onPrepare: (config: V4Config) => Promise<void>;
  onRefine: (feedback: V4Feedback) => Promise<void>;
  onCancel: () => Promise<void>; onRefresh: () => void;
  onDetect: (mediaId: string) => Promise<V4Segment[]>;
}
