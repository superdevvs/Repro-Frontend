import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { resolveShootMediaArchiveRequest } from '@/utils/shootMediaDownload';

export default function ShootArchiveRedirect() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = React.useState('Preparing your files. You will be redirected automatically.');
  const [error, setError] = React.useState<string | null>(null);
  const [complete, setComplete] = React.useState(false);

  React.useEffect(() => {
    setError(null);
    setComplete(false);
    setMessage('Preparing your files. Your download will start automatically.');
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
    const controller = new AbortController();

    void resolveShootMediaArchiveRequest({
      requestUrl,
      signal: controller.signal,
      redirectMode: 'same-tab',
      type: requestType,
      size: requestSize,
      onDownloading: () => { if (!cancelled) setMessage('Downloading your files.'); },
      onPreparing: ({ message: nextMessage }) => {
        if (!cancelled) {
          setMessage(nextMessage);
        }
      },
    }).then(() => {
      if (!cancelled) {
        setComplete(true);
        setMessage('Your download has started. Check your browser downloads for the file.');
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Unable to prepare this download.');
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
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
              {complete ? <CheckCircle2 className="h-8 w-8 text-primary" /> : <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            </div>
            <h1 className="text-xl font-semibold">{complete ? 'Download Started' : 'Downloading Files'}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
