import { useEffect, useRef, useState } from 'react';
import type { V4Workspace } from '@/components/studio/v4/types';

/** Polling must not overwrite edits; a deliberate source change must replace stale frame IDs. */
export function useWorkspaceDraft(workspace: V4Workspace) {
  const [config, setConfig] = useState(workspace.config);
  const server = JSON.stringify(workspace.config);
  const media = workspace.media.map(item => item.id).join('|');
  const previous = useRef({ id: workspace.id, media, server });
  useEffect(() => {
    const before = previous.current;
    if (workspace.id !== before.id || media !== before.media) setConfig(workspace.config);
    else if (server !== before.server) setConfig(current => JSON.stringify(current) === before.server || JSON.stringify(current) === server ? workspace.config : current);
    previous.current = { id: workspace.id, media, server };
  }, [workspace.id, workspace.config, media, server]);
  return { config, setConfig, dirty: JSON.stringify(config) !== server };
}
