import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/sonner-toast';
import { archiveEmailAsset, importDashboardEmailMedia, listDashboardEmailMedia, listEmailAssets, resolveEmailVideo, uploadEmailAsset, variantEmailAsset } from '@/services/emailWorkspaceV2';
import type { EmailAssetOptions, EmailMediaAsset, EmailTemplateSection } from '@/types/emailTemplateWorkspace';
import { getTemplateErrorMessage } from '../templatePreviewSupport';

interface Props {
  target?: EmailTemplateSection; templateId?: number;
  onUse: (asset: EmailMediaAsset) => void;
  onVideo: (url: string, title: string, asset?: EmailMediaAsset) => void;
  onGenerate: () => void;
  onBusyChange?: (busy: boolean) => void;
}

export function EmailWorkspaceMedia({ target, templateId, onUse, onVideo, onGenerate, onBusyChange }: Props) {
  const client = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState(target?.type === 'video' && !target.video_url ? 'video' : 'uploaded'), [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [video, setVideo] = useState(target?.video_url ?? '');
  const [options, setOptions] = useState<EmailAssetOptions>({ slot: target?.type === 'hero' ? 'header' : target?.type === 'feature' ? 'icon' : 'content', quality: 'balanced' });
  // Email clients cannot rely on a CSS overlay. A video poster always goes
  // through the server with the play glyph baked into its published pixels.
  const renditionOptions: EmailAssetOptions = { ...options, play: target?.type === 'video' || (options.play ?? tab === 'video-thumbnail') };
  const [local, setLocal] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  // Notify at the actual request boundaries, including after this picker has
  // unmounted. Dismissing it must not enable sending a still incomplete email.
  function operationBusy(value: boolean) { setBusy(value); onBusyChange?.(value); }
  useEffect(() => () => { if (local) URL.revokeObjectURL(local); }, [local]);
  const assets = useQuery({ queryKey: ['email-media-library', user?.id, tab, search, page], queryFn: () => listEmailAssets({ source: tab, search, page }), enabled: ['uploaded','generated','video-thumbnail'].includes(tab), refetchInterval: query => query.state.data?.data.some(item => item.status === 'processing') ? 2000 : false });
  const dashboard = useQuery({ queryKey: ['email-dashboard-media', user?.id, search], queryFn: () => listDashboardEmailMedia(search), enabled: tab === 'dashboard' });
  async function upload(file: File) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { toast.error('Choose a JPEG, PNG or WebP image below 10 MB.'); return; }
    operationBusy(true); setLocal(URL.createObjectURL(file)); setProgress(0);
    try { const asset = await uploadEmailAsset(file, renditionOptions, setProgress); void client.invalidateQueries({ queryKey: ['email-media-library'] }); onUse(asset); }
    catch (error) { toast.error(getTemplateErrorMessage(error, 'Could not upload this image.')); }
    finally { operationBusy(false); }
  }
  async function resolveVideo() {
    operationBusy(true);
    try { const result = await resolveEmailVideo(video); onVideo(result.url, result.title, result.asset ?? undefined); if (result.needs_thumbnail) toast.info('Video added. Choose Media on its section to upload a thumbnail.'); }
    catch (error) { toast.error(getTemplateErrorMessage(error, 'Could not add this video.')); }
    finally { operationBusy(false); }
  }
  async function choose(asset: EmailMediaAsset) {
    if (!renditionOptions.crop && !renditionOptions.play && !asset.legacy) { onUse(asset); return; }
    operationBusy(true);
    try { onUse(await variantEmailAsset(asset.id, renditionOptions, templateId)); }
    catch (error) { toast.error(getTemplateErrorMessage(error, 'Could not prepare this image.')); }
    finally { operationBusy(false); }
  }
  async function cropCurrent() {
    if (!target?.media_id) return;
    operationBusy(true);
    try { onUse(await variantEmailAsset(target.media_id, renditionOptions, templateId)); }
    catch (error) { toast.error(getTemplateErrorMessage(error, 'Could not create this crop.')); }
    finally { operationBusy(false); }
  }
  async function chooseBrand(key: string) {
    const url = '/images/email-atelier/v6/'+key+'.png';
    if (!renditionOptions.play && !renditionOptions.crop) {
      onUse({ id: '', name: key, source: 'uploaded', status: 'ready', url: window.location.origin+url, mime: 'image/png', original_bytes: 0, bytes: 0, width: 0, height: 0, error: null });
      return;
    }
    operationBusy(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Brand image unavailable');
      const file = new File([await response.blob()], key+'.png', { type: 'image/png' });
      onUse(await uploadEmailAsset(file, renditionOptions));
      void client.invalidateQueries({ queryKey: ['email-media-library'] });
    } catch (error) { toast.error(getTemplateErrorMessage(error, 'Could not prepare this brand image.')); }
    finally { operationBusy(false); }
  }
  return <div className="ews-media-panel" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file && !busy) void upload(file); }} onPaste={event => { const file = [...event.clipboardData.items].find(item => item.kind === 'file')?.getAsFile(); if (file && !busy) { event.preventDefault(); void upload(file); } }}>
    <div className="ews-media-primary"><Button disabled={busy} onClick={() => input.current?.click()}>Upload image</Button><Button variant="outline" disabled={busy} onClick={onGenerate}>Generate with Robbie</Button></div>
    <input ref={input} aria-label="Upload email image" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }}/>
    <p className="ews-help">Drop an image here or paste it from your clipboard. Images are automatically optimized for email.</p>
    <div className="ews-media-options"><label>Image use<select aria-label="Image use" value={options.slot} onChange={event => setOptions({ ...options, slot: event.target.value as EmailAssetOptions['slot'] })}><option value="header">Wide header</option><option value="content">Content image</option><option value="icon">Small icon</option></select></label><label>Quality<select aria-label="Image quality" value={options.quality} onChange={event => setOptions({ ...options, quality: event.target.value as EmailAssetOptions['quality'] })}><option value="balanced">Balanced</option><option value="high">Higher quality</option></select></label><label>Crop<select aria-label="Image crop" value={options.crop ?? ''} onChange={event => setOptions({ ...options, crop: event.target.value || undefined })}><option value="">Keep original proportions</option>{['1:1','3:2','16:9','12:5'].map(value => <option key={value}>{value}</option>)}</select></label></div>
    {options.crop && <div className="ews-media-options"><label>Horizontal focus<input aria-label="Horizontal crop focus" type="range" min="0" max="100" value={options.focal_x ?? 50} onChange={event => setOptions({ ...options, focal_x: Number(event.target.value) })}/></label><label>Vertical focus<input aria-label="Vertical crop focus" type="range" min="0" max="100" value={options.focal_y ?? 50} onChange={event => setOptions({ ...options, focal_y: Number(event.target.value) })}/></label></div>}
    {(target?.type === 'video' || tab === 'video-thumbnail') && <label><input type="checkbox" checked={renditionOptions.play} disabled={target?.type === 'video'} onChange={event => setOptions({ ...options, play: event.target.checked })}/> Show play button on thumbnail{target?.type === 'video' && <span className="ews-help"> · Included for email video previews</span>}</label>}
    {target?.media_id && <Button variant="outline" disabled={busy} onClick={() => void cropCurrent()}>Create new crop / rendition</Button>}
    {busy && <div role="status" className="ews-upload-progress">{local && <img src={local} alt="Your upload preview"/>}<span>{progress < 100 ? `Uploading ${progress}%` : 'Preparing your image…'}</span></div>}
    <div className="ews-media-tabs" role="tablist" aria-label="Media sources">{[['uploaded','Uploaded'],['generated','Generated'],['brand','Brand assets'],['dashboard','Dashboard media'],['video','Video'],['video-thumbnail','Video thumbnails']].map(([key, name]) => <button role="tab" aria-selected={tab === key} key={key} onClick={() => { setTab(key); setPage(1); }}>{name}</button>)}</div>
    {tab === 'video' ? <div className="ews-settings"><label>Video URL<Input aria-label="Video URL" value={video} onChange={event => setVideo(event.target.value)} placeholder="YouTube, Vimeo, Loom or a hosted video link"/></label><Button disabled={busy || !/^https:\/\//i.test(video)} onClick={() => void resolveVideo()}>Add video with thumbnail</Button><p className="ews-help">Your email shows a clickable thumbnail. Recipients watch the hosted video in their browser. You can upload your own thumbnail.</p></div> : <>
      <Input aria-label="Search email media" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search images or properties…"/>
      <div className="ews-media-grid">
        {tab === 'brand' ? ['welcome','editing','invoice','schedule','delivery_access'].map(key => <button key={key} disabled={busy} onClick={() => void chooseBrand(key)}><img src={'/images/email-atelier/v6/'+key+'.png'} alt={key}/><span>{key.replace(/_/g, ' ')}</span></button>)
          : tab === 'dashboard' ? dashboard.data?.map(item => <div key={item.id}><button disabled={busy} onClick={async () => { operationBusy(true); try { onUse(await importDashboardEmailMedia(item, renditionOptions)); } catch (error) { toast.error(getTemplateErrorMessage(error, 'Could not import this image.')); } finally { operationBusy(false); } }}><img src={item.url} alt={item.name}/><span>{item.name}</span></button>{item.watch_url && <Button variant="ghost" size="sm" disabled={busy} onClick={async () => { operationBusy(true); try { const poster = await importDashboardEmailMedia(item, { ...renditionOptions, play: true }); onVideo(item.watch_url!, item.name, poster); } catch (error) { toast.error(getTemplateErrorMessage(error, 'Could not prepare this video thumbnail.')); } finally { operationBusy(false); } }}>Use video</Button>}</div>)
            : assets.data?.data.map(asset => <div key={asset.id}><button disabled={asset.status !== 'ready' || busy} onClick={() => void choose(asset)}>{asset.url ? <img src={asset.url} alt={asset.name}/> : <span>{asset.status === 'processing' ? 'Optimizing…' : 'Could not process'}</span>}<span>{asset.name}</span><small>{Math.round(asset.bytes / 1024)} KB{asset.bytes > 600000 ? ' · Large image' : ''}{asset.original_bytes > asset.bytes ? ` · ${Math.round(100 * (1 - asset.bytes / asset.original_bytes))}% smaller` : ''}</small></button><button className="ews-media-archive" onClick={async () => { await archiveEmailAsset(asset.id); void client.invalidateQueries({ queryKey: ['email-media-library'] }); }}>Archive</button></div>)}
      </div>
      {(tab === 'dashboard' ? dashboard.isPending : tab !== 'brand' && assets.isPending) && <p role="status">Loading media…</p>}
      {(tab === 'dashboard' ? dashboard.isError : tab !== 'brand' && assets.isError) && <p role="alert">Media could not be loaded. <button onClick={() => void (tab === 'dashboard' ? dashboard.refetch() : assets.refetch())}>Retry</button></p>}
      {tab !== 'brand' && tab !== 'dashboard' && assets.data?.data.length === 0 && <p>No images here yet. Upload one or generate with Robbie.</p>}
      {tab !== 'dashboard' && assets.data && assets.data.last_page > 1 && <div className="ews-media-primary"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={page === assets.data.last_page} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </>}
  </div>;
}
