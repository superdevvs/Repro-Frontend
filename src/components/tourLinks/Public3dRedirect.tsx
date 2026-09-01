import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { Public3dTourViewer } from './Public3dTourViewer';
import {
  normalizePublicTourUrl,
  resolvePublicIguideSources,
  type PublicIguideSources,
} from './publicIguideModel';

type Variant = 'branded' | 'mls';
type Provider = 'matterport' | 'iguide' | 'zillow';
type LooseRecord = Record<string, unknown>;

type Public3dRedirectProps = {
  variant: Variant;
};

const asRecord = (value: unknown): LooseRecord =>
  value && typeof value === 'object' ? (value as LooseRecord) : {};

const firstUrl = (...values: unknown[]): string => {
  for (const value of values) {
    const url = normalizePublicTourUrl(value);
    if (url) return url;
  }
  return '';
};

export const Public3dRedirect = ({ variant }: Public3dRedirectProps) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const shootId = params.get('shootId');
  const requestedProvider = params.get('provider');
  const provider: Provider | null =
    requestedProvider === 'matterport' || requestedProvider === 'iguide' || requestedProvider === 'zillow'
      ? requestedProvider
      : null;
  const [message, setMessage] = useState('Opening the 3D walkthrough…');
  const [inlineIguide, setInlineIguide] = useState<PublicIguideSources | null>(null);

  const fallbackPath = variant === 'mls' ? '/tour/mls' : '/tour/branded';
  const fallbackUrl = shootId
    ? `${fallbackPath}?shootId=${encodeURIComponent(shootId)}`
    : fallbackPath;

  useEffect(() => {
    if (!shootId || !/^[1-9][0-9]*$/.test(shootId)) {
      setMessage('This 3D tour link is missing a valid shoot.');
      return;
    }

    const controller = new AbortController();

    const openTour = async () => {
      try {
        const endpoint = variant === 'mls' ? 'mls' : 'branded';
        const response = await fetch(
          `${API_BASE_URL}/api/public/shoots/${encodeURIComponent(shootId)}/${endpoint}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Tour request failed (${response.status})`);

        const payload = asRecord(await response.json());
        const links = asRecord(payload.tour_links);
        const iguideSources = resolvePublicIguideSources(payload, variant);

        const providerTargets: Record<Provider, string> = {
          matterport: variant === 'mls'
            ? firstUrl(payload.matterport_url, links.matterport_mls)
            : firstUrl(payload.matterport_url, links.matterport_branded, links.matterport),
          iguide: iguideSources.inlineUrl,
          zillow: variant === 'mls' ? '' : firstUrl(links.zillow_3d),
        };
        const resolvedProvider = provider || (
          providerTargets.iguide ? 'iguide'
            : providerTargets.matterport ? 'matterport'
              : providerTargets.zillow ? 'zillow'
                : null
        );
        const target = resolvedProvider ? providerTargets[resolvedProvider] : '';

        if (resolvedProvider === 'iguide' || provider === 'iguide') {
          setInlineIguide(iguideSources);
          setMessage('');
          return;
        }

        if (!target) {
          setMessage('The 3D walkthrough is not available yet.');
          return;
        }

        window.location.replace(target);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Unable to open 3D tour:', error);
          setMessage('We could not open the 3D walkthrough.');
        }
      }
    };

    void openTour();
    return () => controller.abort();
  }, [provider, shootId, variant]);

  if (inlineIguide) {
    return (
      <main className="dark min-h-screen bg-[#060a0e] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          {variant === 'branded' && (
            <img src="/REPRO-HQ.png" alt="R/E Pro Photos" className="mx-auto mb-7 w-52 max-w-full" />
          )}
          <Public3dTourViewer
            iguideInlineUrl={inlineIguide.inlineUrl}
            iguideOpenUrl={inlineIguide.openUrl}
            initialProvider="iguide"
            showUnavailable
            heading="iGUIDE 3D Tour"
            className="mt-0 max-w-none px-0"
          />
          <div className="mt-5 text-center">
            <a className="text-sm text-[#75bfff] underline" href={fallbackUrl}>
              View the full property tour
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060a0e] px-6 text-white">
      <div className="max-w-md text-center">
        {/* The MLS variant is an unbranded route: it may be posted where agent,
            brokerage and photographer identity is not allowed, and this page is
            the terminal state when no compliant destination resolves. Matches
            OgCardRenderer::drawWordmark. */}
        {variant === 'branded' && (
          <img src="/REPRO-HQ.png" alt="R/E Pro Photos" className="mx-auto mb-8 w-64 max-w-full" />
        )}
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#0b6bc9]" />
        <p className="text-base text-white/75">{message}</p>
        <a className="mt-5 inline-block text-sm text-[#75bfff] underline" href={fallbackUrl}>
          View the property tour instead
        </a>
      </div>
    </main>
  );
};
