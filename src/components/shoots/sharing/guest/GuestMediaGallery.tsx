import { useState } from 'react';
import { Download, FileText, Grid2X2, ImageIcon, List, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GuestFile } from './guestOverviewTypes';
import '@/components/shoots/tabs/media/shootDetailsMediaWorkspace.css';

const labels: Record<string, string> = { photo: 'Photos', floorplan: 'Floorplans', video: 'Videos', file: 'Files' };

function GuestThumbnail({ file }: { file: GuestFile }) {
  return file.kind === 'photo'
    ? <img src={file.preview_url} alt={file.name} loading="lazy" className="h-full w-full object-cover" />
    : <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
      {file.kind === 'video' ? <Play className="h-7 w-7" /> : <FileText className="h-7 w-7" />}
      <span className="text-[10px]">{file.kind === 'floorplan' ? 'Floorplan' : file.kind === 'video' ? 'Video' : 'File'}</span>
    </span>;
}

export function GuestMediaGallery({ files, onPreview }: { files: GuestFile[]; onPreview: (file: GuestFile) => void }) {
  const [tab, setTab] = useState('photo');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const tabs = ['photo', 'floorplan', 'video', 'file'].filter(kind => kind === 'photo' || files.some(file => file.kind === kind));
  const activeTab = tabs.includes(tab) ? tab : 'photo';
  const visible = files.filter(file => file.kind === activeTab);
  return <section aria-label="Shared media" className="flex min-h-0 min-w-0 flex-1 flex-col p-3 shootDesktop:p-4">
    <Tabs value={activeTab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2 border-b pb-2">
        <div className="min-w-0 overflow-x-auto">
          <TabsList aria-label="Property media" className="h-8 justify-start gap-1 rounded-none bg-transparent p-0">
            {tabs.map(kind => <TabsTrigger key={kind} value={kind}
              className="h-8 rounded-full px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">
              {labels[kind]} ({files.filter(file => file.kind === kind).length})
            </TabsTrigger>)}
          </TabsList>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-lg border" aria-label="Media view">
          <Button size="icon" variant="ghost" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}
            className={`h-8 w-8 rounded-none ${view === 'list' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'text-muted-foreground'}`}><List className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}
            className={`h-8 w-8 rounded-none ${view === 'grid' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'text-muted-foreground'}`}><Grid2X2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <TabsContent value={activeTab} className="mt-0 min-h-0 flex-1 overflow-y-auto rounded-xl border bg-muted/20 p-2.5">
        {visible.length ? <>
          <div className="flex items-center justify-between gap-2 px-0.5 pb-2.5 text-[11px] text-muted-foreground"><span>{visible.length} {labels[activeTab].toLowerCase()}</span><span>Click to preview</span></div>
          <div className={view === 'grid' ? 'shoot-media-grid' : 'space-y-2'}>
            {visible.map(file => <article key={file.id} className={`group min-w-0 overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/50 ${view === 'list' ? 'flex items-center gap-3 p-2' : ''}`}>
              <button onClick={() => onPreview(file)} aria-label={`Preview ${file.name}`}
                className={`block overflow-hidden bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${view === 'list' ? 'aspect-[4/3] w-24 shrink-0 rounded-md sm:w-32' : 'aspect-[4/3] w-full'}`}>
                <GuestThumbnail file={file} />
              </button>
              <div className={`flex min-w-0 items-center justify-between gap-1.5 ${view === 'list' ? 'flex-1' : 'p-2'}`}>
                <button onClick={() => onPreview(file)} className="min-w-0 truncate text-left text-[11px] font-medium hover:text-primary" title={file.name}>{file.name}</button>
                <a href={file.download_url} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Download ${file.name}`}>
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            </article>)}
          </div>
        </> : <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">No {labels[activeTab].toLowerCase()} available yet</p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">Released {labels[activeTab].toLowerCase()} will appear here when available.</p>
        </div>}
      </TabsContent>
    </Tabs>
  </section>;
}
