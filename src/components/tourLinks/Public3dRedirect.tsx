import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/config/env';

type Variant = 'branded' | 'mls';
type Provider = 'matterport' | 'iguide' | 'zillow';
type LooseRecord = Record<string, unknown>;

type Public3dRedirectProps = {
  variant: Variant;
};

const asRecord = (value: unknown): LooseRecord =>
  value && typeof value === 'object' ? (value as LooseRecord) : {};

const asUrl = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim() === '') return '';

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const firstUrl = (...values: unknown[]): string => {
  for (const value of values) {
    const url = asUrl(value);
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
        const brandedMatterport = firstUrl(
          links.matterport_branded,
          links.matterport,
          variant === 'branded' ? payload.matterport_url : '',
        );
        const mlsMatterport = firstUrl(
          links.matterport_mls,
          variant === 'mls' ? payload.matterport_url : '',
        );
        const brandedIguide = firstUrl(
          links.iguide_branded,
          links.iGuide,
          links.iguide,
          variant === 'branded' ? payload.iguide_tour_url : '',
          variant === 'branded' ? payload.iguide_url : '',
        );
        const mlsIguide = firstUrl(
          links.iguide_mls,
          variant === 'mls' ? payload.iguide_tour_url : '',
          variant === 'mls' ? payload.iguide_url : '',
        );

        const providerTargets: Record<Provider, string> = {
          matterport: variant === 'mls'
            ? (mlsMatterport && mlsMatterport !== brandedMatterport ? mlsMatterport : '')
            : brandedMatterport,
          iguide: variant === 'mls'
            ? (mlsIguide && mlsIguide !== brandedIguide ? mlsIguide : '')
            : brandedIguide,
          zillow: variant === 'mls' ? '' : firstUrl(links.zillow_3d),
        };

        const target = provider
          ? providerTargets[provider]
          : firstUrl(providerTargets.matterport, providerTargets.iguide, providerTargets.zillow);

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
