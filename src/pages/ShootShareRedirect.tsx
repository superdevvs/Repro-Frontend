import React from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/env';

const isNumericSegment = (value?: string) => Boolean(value && /^\d+$/.test(value));

export default function ShootShareRedirect() {
  const { shootId, shareId } = useParams();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isNumericSegment(shootId) || !isNumericSegment(shareId)) {
      setError('This share link is invalid.');
      return;
    }

    let cancelled = false;

    const resolveShareLink = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/public/share-links/${shootId}/${shareId}`,
          {
            headers: {
              Accept: 'application/json',
            },
          },
        );

        const data = (await response.json().catch(() => null)) as
          | { redirect_url?: string; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(data?.error || 'Unable to open this share link.');
        }

        if (!data?.redirect_url) {
          throw new Error('Share link destination is unavailable.');
        }

        if (!cancelled) {
          window.location.replace(data.redirect_url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unable to open this share link.',
          );
        }
      }
    };

    void resolveShareLink();

    return () => {
      cancelled = true;
    };
  }, [shareId, shootId]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        {error ? (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Share Link Unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Opening Shared Files</h1>
            <p className="text-sm text-muted-foreground">
              Preparing your download. You will be redirected automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
