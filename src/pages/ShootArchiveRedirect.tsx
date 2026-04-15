import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { resolveShootMediaArchiveRequest } from '@/utils/shootMediaDownload';

export default function ShootArchiveRedirect() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = React.useState('Preparing your files. You will be redirected automatically.');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const requestUrl = searchParams.get('url');
    if (!requestUrl) {
      setError('This download link is invalid.');
      return;
    }

    let requestType: 'raw' | 'edited' = 'edited';
    let requestSize: 'small' | 'original' = 'original';

    try {
      const parsedUrl = new URL(requestUrl);
      requestType = parsedUrl.searchParams.get('type') === 'raw' ? 'raw' : 'edited';
      requestSize = parsedUrl.searchParams.get('size') === 'small' ? 'small' : 'original';
    } catch {
      // Fall back to the edited/original defaults.
    }

    let cancelled = false;

    void resolveShootMediaArchiveRequest({
      requestUrl,
      redirectMode: 'same-tab',
      type: requestType,
      size: requestSize,
      onPreparing: ({ message: nextMessage }) => {
        if (!cancelled) {
          setMessage(nextMessage);
        }
      },
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Unable to prepare this download.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        {error ? (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Download Unavailable</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Preparing Download</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
