import { lazy } from 'react';
import { isPublicTourEntry } from './publicTourEntry';
import { initializeDashboardInstall } from '@/hooks/useDashboardInstall';

// Select before loading any dashboard providers. Capture install prompts early
// for dashboard visitors, while public links load their independent shell.
const isPublic = isPublicTourEntry(window.location.pathname);
if (!isPublic) initializeDashboardInstall();
const Entry = lazy(isPublic ? () => import('./PublicTourApp') : () => import('../App'));

export default function AppEntry() {
  return <Entry />;
}
