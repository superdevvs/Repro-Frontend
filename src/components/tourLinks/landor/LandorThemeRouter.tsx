import { Suspense, useMemo } from 'react';
import type { PublicTourData } from '../publicTourData';
import { isLandorTourStyle } from '../publicTourStyle';
import { resolvePublicTourPalette } from './landorPalettes';
import { lazyLandorTheme, type LandorStyleId } from './landorRegistry';

/** Central lazy-load entry for every Landor layout id, including Signature. */
export function LandorThemeRouter({ data }: { data: PublicTourData }) {
  const styleId = (isLandorTourStyle(data.tourStyle) ? data.tourStyle : 'landor') as LandorStyleId;
  const Theme = useMemo(() => lazyLandorTheme(styleId), [styleId]);
  const palette = useMemo(() => {
    const preview = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('palette') : null;
    return resolvePublicTourPalette(data.tourPalette, preview);
  }, [data.tourPalette]);

  return (
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-background" role="status">Loading property tour...</div>}>
      <Theme data={data} palette={palette} />
    </Suspense>
  );
}

export default LandorThemeRouter;
