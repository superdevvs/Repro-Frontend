import { useId, useState } from 'react';
import { BedDouble, Check, Copy, Download, ExternalLink, MapPin, Ruler, ShieldCheck, ShowerHead, View } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuestMediaGallery } from './GuestMediaGallery';
import type { GuestFile, GuestOverview } from './guestOverviewTypes';

const sectionTabClass = 'h-8 rounded-none px-3 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none';

function GuestPropertyDetails({ overview }: { overview: GuestOverview }) {
  const { property, services } = overview;
  const metrics = [
    { icon: BedDouble, value: property.beds, label: 'Beds' },
    { icon: ShowerHead, value: property.baths, label: 'Baths' },
    { icon: Ruler, value: property.sqft, label: 'Sqft' },
  ];
  return <div className="space-y-2">
    <section aria-label="Property details" className="grid grid-cols-3 gap-2 rounded-lg border bg-card p-2.5">
      {metrics.map(({ icon: Icon, value, label }) => <div key={label} className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
        <div className="min-w-0"><div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div><div className="text-xs font-medium">{value == null ? '—' : Number(value).toLocaleString()}</div></div>
      </div>)}
    </section>
    <section aria-label="Property location" className="rounded-lg border bg-card p-2.5">
      <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Location</h2>
      <p className="text-xs font-semibold">{property.address}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{[property.city, property.state, property.zip].filter(Boolean).join(', ')}</p>
    </section>
    <section aria-label="Booked services" className="rounded-lg border bg-card p-2.5">
      <h2 className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Services</h2>
      {services.length ? <div className="divide-y">{services.map((service, index) => {
        const delivered = service.components.length > 0 && service.components.every(component => component.status === 'delivered' || component.status === 'cancelled');
        return <div key={index} className="relative space-y-1.5 py-2 first:pt-1 last:pb-0">
          <span aria-hidden="true" className={`absolute -left-3.5 top-2 h-5 w-1 rounded-full ${delivered ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <h3 className="text-xs font-semibold leading-5">{service.name}</h3>
          {service.components.map((component, componentIndex) => <div key={componentIndex} className="flex items-start justify-between gap-3 text-[11px]">
            <span className="text-muted-foreground">{component.label}</span>
            <span className={component.status === 'delivered' ? 'text-emerald-600 dark:text-emerald-400' : component.status === 'cancelled' ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300'}>{component.status === 'delivered' ? 'Delivered' : component.status === 'cancelled' ? 'Cancelled' : 'Pending'}</span>
          </div>)}
        </div>;
      })}</div> : <p className="text-xs text-muted-foreground">Shared property media</p>}
    </section>
    <section className="rounded-lg border bg-card p-2.5">
      <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Shared access</h2>
      <p className="text-xs text-muted-foreground">New deliveries appear here automatically.</p>
      <p className="mt-1 text-[11px] text-muted-foreground">Access until {new Date(overview.expires_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
    </section>
  </div>;
}

function GuestTours({ tours }: { tours: GuestOverview['tours'] }) {
  return <section aria-label="Property tours" className="space-y-2">
    {tours.length ? tours.map(tour => <article key={tour.url} className="rounded-lg border bg-card p-2.5">
      <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><View className="h-4 w-4" /></span><h2 className="text-xs font-semibold">{tour.label}</h2></div>
      <a href={tour.url} target="_blank" rel="noopener noreferrer" className="flex min-h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-xs font-medium text-primary hover:bg-primary/5" aria-label={`Open ${tour.label}`}>Open tour<ExternalLink className="h-3.5 w-3.5" /></a>
    </article>) : <div className="rounded-lg border bg-card px-4 py-10 text-center"><View className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" /><p className="text-xs text-muted-foreground">Tours will appear when released.</p></div>}
  </section>;
}

export function GuestOverviewView({ overview, selected, onSelect }: { overview: GuestOverview; selected: GuestFile | null; onSelect: (file: GuestFile | null) => void }) {
  const panelId = useId();
  const [section, setSection] = useState('overview');
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const components = overview.services.flatMap(service => service.components).filter(component => component.status !== 'cancelled');
  const status = components.length ? components.every(component => component.status === 'delivered') ? 'Delivered'
    : components.some(component => component.status === 'delivered') || overview.files.length || overview.tours.length ? 'Delivering' : 'Pending'
    : overview.files.length || overview.tours.length ? 'Delivered' : 'Pending';
  const address = [overview.property.address, overview.property.city, overview.property.state, overview.property.zip].filter(Boolean).join(', ');
  const activeDetailsTab = section === 'media' ? 'overview' : section;
  const copyAddress = async () => {
    try { await navigator.clipboard.writeText(address); setCopied(true); } catch { setCopied(false); }
  };
  return <main className="h-dvh min-h-0 bg-muted/20 p-0 text-foreground sm:p-4">
    <div className="flex h-full min-h-0 flex-col overflow-hidden border bg-background sm:rounded-lg">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-3 shootDesktop:px-4">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="min-w-0 max-w-full truncate text-base font-bold tracking-tight sm:text-lg" title={address}>{overview.property.address}</h1>
            <button onClick={() => void copyAddress()} aria-label={copied ? 'Address copied' : 'Copy address'} className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground sm:flex">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status === 'Delivered' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-primary/20 bg-primary/10 text-primary'}`}>{status}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Shared property overview</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex"><ShieldCheck className="h-3.5 w-3.5" />Verified guest access</span>
          <Button size="sm" variant="outline" disabled={!overview.files.length} onClick={() => setDownloadsOpen(true)} className="h-8 gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Downloads</span><span className="sr-only sm:hidden">Downloads</span></Button>
        </div>
      </header>
      <Tabs value={section} onValueChange={setSection} className="shrink-0 border-b px-2 shootDesktop:hidden">
        <TabsList aria-label="Property sections" className="h-11 w-full justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="overview" aria-controls={`${panelId}-overview`} className={sectionTabClass}>Overview</TabsTrigger>
          <TabsTrigger value="media" aria-controls={`${panelId}-media`} className={sectionTabClass}>Media ({overview.files.length})</TabsTrigger>
          <TabsTrigger value="tours" aria-controls={`${panelId}-tours`} className={sectionTabClass}>Tours ({overview.tours.length})</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside aria-label="Shoot details" className={`${section === 'media' ? 'hidden shootDesktop:flex' : 'flex'} min-h-0 min-w-0 w-full flex-col bg-muted/30 shootDesktop:w-[37.5%] shootDesktop:max-w-[540px] shootDesktop:shrink-0 shootDesktop:border-r`}>
          <Tabs value={activeDetailsTab} onValueChange={setSection} className="flex min-h-0 flex-1 flex-col">
            <div className="hidden shrink-0 border-b bg-background px-4 py-2 shootDesktop:block">
              <TabsList aria-label="Shoot sections" className="h-8 w-full justify-start bg-transparent p-0">
                <TabsTrigger value="overview" aria-controls={`${panelId}-overview`} className={sectionTabClass}>Overview</TabsTrigger>
                <TabsTrigger value="tours" aria-controls={`${panelId}-tours`} className={sectionTabClass}>Tours ({overview.tours.length})</TabsTrigger>
              </TabsList>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 shootDesktop:px-4">
              <TabsContent value="overview" id={`${panelId}-overview`} aria-labelledby={undefined} aria-label="Overview" className="mt-0"><GuestPropertyDetails overview={overview} /></TabsContent>
              <TabsContent value="tours" id={`${panelId}-tours`} aria-labelledby={undefined} aria-label="Tours" className="mt-0"><GuestTours tours={overview.tours} /></TabsContent>
            </div>
          </Tabs>
        </aside>
        <div id={`${panelId}-media`} role="tabpanel" aria-label="Media" className={`${section === 'media' ? 'flex' : 'hidden shootDesktop:flex'} min-h-0 min-w-0 flex-1`}>
          <GuestMediaGallery files={overview.files} onPreview={onSelect} />
        </div>
      </div>
    </div>
    <Dialog open={downloadsOpen} onOpenChange={setDownloadsOpen}><DialogContent className="max-w-lg">
      <DialogTitle>Downloads</DialogTitle><DialogDescription>Choose a file to download.</DialogDescription>
      <div className="max-h-[60dvh] space-y-1 overflow-y-auto">{overview.files.map(file => <a key={file.id} href={file.download_url} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs hover:bg-muted" aria-label={`Download ${file.name}`}><span className="min-w-0 truncate">{file.name}</span><Download className="h-4 w-4 shrink-0 text-primary" /></a>)}</div>
    </DialogContent></Dialog>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) onSelect(null); }}><DialogContent className="max-w-5xl">
      <DialogTitle className="pr-8 text-sm">{selected?.name}</DialogTitle><DialogDescription className="sr-only">Shared property media preview</DialogDescription>
      {selected?.kind === 'photo' ? <img src={selected.preview_url} alt={selected.name} className="max-h-[75dvh] w-full object-contain" /> : selected?.kind === 'video' ? <video controls src={selected.preview_url} className="max-h-[75dvh] w-full" /> : selected && <a href={selected.preview_url} target="_blank" rel="noopener noreferrer" className="py-10 text-center text-primary">Open file preview <ExternalLink className="inline h-4 w-4" /></a>}
      {selected && <a href={selected.download_url} className="inline-flex items-center gap-2 text-sm text-primary"><Download className="h-4 w-4" />Download file</a>}
    </DialogContent></Dialog>
  </main>;
}
