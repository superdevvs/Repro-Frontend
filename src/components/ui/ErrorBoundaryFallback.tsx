import { useSyncExternalStore, type ErrorInfo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isRecoverableChunkError } from '@/lib/chunkLoadRecovery';
import { hasUploadsProtectedFromNavigation, subscribeUploadNavigationProtection } from '@/lib/uploadNavigationProtection';
export function ErrorFallback({ error, errorInfo, onReset }: {
  error?: Error;
  errorInfo?: ErrorInfo;
  onReset: () => void;
}) {
  const uploading = useSyncExternalStore(subscribeUploadNavigationProtection, hasUploadsProtectedFromNavigation, () => false);
  return (
    <div className="flex min-h-[240px] items-center justify-center p-4" role="alert">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">This view could not load</CardTitle>
          <CardDescription>
            {isRecoverableChunkError(error)
              ? 'Part of the app could not be downloaded. Check your connection, then try again.'
              : 'This part of the page had a problem. Try opening it again below.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploading && <p className="text-sm" role="status">Uploads are still running. Keep this tab open. You can retry this view without reloading the page.</p>}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="rounded bg-muted p-3 text-sm">
              <summary className="cursor-pointer font-medium">Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{error.toString()}{errorInfo?.componentStack}</pre>
            </details>
          )}
          <div className="flex gap-2">
            <Button onClick={onReset} className="flex-1"><RefreshCw className="mr-2 h-4 w-4" />Try Again</Button>
            <Button variant="outline" disabled={uploading} onClick={() => {
              // Recheck synchronously in case a job started after this render.
              if (!hasUploadsProtectedFromNavigation()) window.location.reload();
            }} className="flex-1">Reload Page</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
