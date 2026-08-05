import { useMediaViewerController } from './useMediaViewerController';
import { MediaViewerView } from './MediaViewerView';
import type { MediaViewerProps } from './mediaViewerTypes';

export function MediaViewer(props: MediaViewerProps) {
  const model = useMediaViewerController(props);
  return model ? <MediaViewerView model={model} /> : null;
}

