export function MediaViewerImageStatus({ message, loading, className = 'top-3' }: {
  message: string;
  loading: boolean;
  className?: string;
}) {
  if (!message) return null;
  return <div role="status" className={`pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 rounded-xl bg-black/75 px-3 py-1.5 text-xs text-white ${className}`}>
    {message}
    {loading && <div aria-hidden="true" className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/25">
      <div className="h-full w-1/3 rounded-full bg-white motion-safe:animate-media-loading motion-reduce:mx-auto" />
    </div>}
  </div>;
}
