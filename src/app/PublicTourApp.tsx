import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import { isPublicTourEntry } from './publicTourEntry';

const BrandedPage = lazy(() => import('@/components/tourLinks/BrandedPage').then(module => ({ default: module.BrandedPage })));
const MlsCompliant = lazy(() => import('@/components/tourLinks/MlsCompliant').then(module => ({ default: module.MlsCompliant })));
const GenericMLS = lazy(() => import('@/components/tourLinks/GenericMLS').then(module => ({ default: module.GenericMLS })));
const PublicVideoPage = lazy(() => import('@/components/tourLinks/PublicVideoPage').then(module => ({ default: module.PublicVideoPage })));
const Public3dRedirect = lazy(() => import('@/components/tourLinks/Public3dRedirect').then(module => ({ default: module.Public3dRedirect })));
const ShootShareRedirect = lazy(() => import('@/pages/ShootShareRedirect'));
const ShootArchiveRedirect = lazy(() => import('@/pages/ShootArchiveRedirect'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const DashboardApp = lazy(() => import('../App'));

const Loading = () => <div role="status" className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading property…</div>;

function PublicRoutes({ onExit }: { onExit: () => void }) {
  const location = useLocation();
  const isPublic = isPublicTourEntry(location.pathname);
  useEffect(() => { if (!isPublic) onExit(); }, [isPublic, onExit]);
  if (!isPublic) return <Loading />;
  return <Routes>
    <Route path="/tour/MLS/:legacyTourFile" caseSensitive element={<MlsCompliant key={location.pathname} legacyPath />} />
    <Route path="/tour/:legacyTourFile" caseSensitive element={<BrandedPage key={location.pathname} legacyPath />} />
    <Route path="/tour/branded" element={<BrandedPage />} />
    <Route path="/tour/mls" element={<MlsCompliant />} />
    <Route path="/tour/g-mls" element={<GenericMLS />} />
    <Route path="/tours/branded" element={<BrandedPage />} />
    <Route path="/tours/mls" element={<MlsCompliant />} />
    <Route path="/tours/g-mls" element={<GenericMLS />} />
    <Route path="/tour/video/branded" element={<PublicVideoPage variant="branded" />} />
    <Route path="/tour/video/mls" element={<PublicVideoPage variant="mls" />} />
    <Route path="/tour/video/generic" element={<PublicVideoPage variant="generic" />} />
    <Route path="/tour/3d/branded" element={<Public3dRedirect variant="branded" />} />
    <Route path="/tour/3d/mls" element={<Public3dRedirect variant="mls" />} />
    <Route path="/share/:token" element={<ShootShareRedirect />} />
    <Route path="/download/media" element={<ShootArchiveRedirect />} />
    <Route path="*" element={<NotFound />} />
  </Routes>;
}

/** Tour visitors do not initialize login, phone, uploads or dashboard requests. */
export default function PublicTourApp() {
  const [leftPublicRoutes, setLeftPublicRoutes] = useState(false);
  return <Suspense fallback={<Loading />}>
    {leftPublicRoutes ? <DashboardApp /> : <div className="app-root"><div className="app-shell">
      <TooltipProvider><ErrorBoundary><BrowserRouter>
        <PublicRoutes onExit={() => setLeftPublicRoutes(true)} />
      </BrowserRouter></ErrorBoundary></TooltipProvider>
    </div></div>}
  </Suspense>;
}
