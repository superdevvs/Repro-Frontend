import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getPrivateVoiceAudio } from '@/services/voice';

export default function PrivateVoiceAudio({ path, label = 'Play recording', onLoaded }: { path: string; label?: string; onLoaded?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requests] = useState(() => ({ generation: 0 }));
  useEffect(() => {
    requests.generation++;
    setUrl(null);
    setError(null);
    setPending(false);
    return () => { requests.generation++; };
  }, [path, requests]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const load = async () => {
    const attempt = requests.generation;
    setPending(true);
    setError(null);
    try {
      const audio = await getPrivateVoiceAudio(path);
      if (attempt !== requests.generation) return;
      setUrl(URL.createObjectURL(audio));
      onLoaded?.();
    } catch {
      if (attempt === requests.generation) setError('Could not load recording. Check your access or try again.');
    } finally {
      if (attempt === requests.generation) setPending(false);
    }
  };
  return <div className="space-y-2">
    {url ? <audio aria-label={label} controls src={url} className="max-w-full" onError={() => setError('The audio could not be played.')} />
      : <Button variant="outline" disabled={pending} onClick={() => void load()}>{pending ? 'Loading…' : label}</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
