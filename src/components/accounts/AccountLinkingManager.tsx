import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Building2, Camera, FileText, Files, Link2, Loader2, Mail, Plus, RefreshCw, Search, Settings2, ShieldCheck, Trash2, UserRound, Users2 } from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createAccountLinks, fetchAccountLinks, fetchAvailableLinkingAccounts, unlinkAccountLink, updateAccountLink, type LinkingAccountOption } from '@/services/accountLinkingService';
import type { AccountLinkRecord, SharedDetails } from '@/types/auth';

const DEFAULT_SHARED_DETAILS: SharedDetails = {
  shoots: true,
  invoices: true,
  clients: false,
  availability: false,
  settings: false,
  profile: true,
  documents: true,
};

const SHARE_OPTIONS: Array<{ key: keyof SharedDetails; label: string; description: string; icon: React.ElementType }> = [
  { key: 'shoots', label: 'Shoots', description: 'Job history and property activity', icon: Camera },
  { key: 'invoices', label: 'Invoices', description: 'Billing totals and payment context', icon: FileText },
  { key: 'clients', label: 'Client data', description: 'Contact records and linked context', icon: Users2 },
  { key: 'availability', label: 'Availability', description: 'Scheduling visibility', icon: Building2 },
  { key: 'settings', label: 'Settings', description: 'Operational account settings', icon: Settings2 },
  { key: 'profile', label: 'Profile', description: 'Branding and profile details', icon: UserRound },
  { key: 'documents', label: 'Documents', description: 'Files and attachments', icon: Files },
];

type OwnerGroup = { id: string; name: string; email: string; role?: string | null; links: AccountLinkRecord[]; active: number; attention: number; latest?: string | null };
type DraftState = { ownerId: string; clientIds: string[]; sharedDetails: SharedDetails; notes: string };

const emptyDraft = (ownerId = ''): DraftState => ({ ownerId, clientIds: [], sharedDetails: { ...DEFAULT_SHARED_DETAILS }, notes: '' });
const statusTone = (status: AccountLinkRecord['status']) => status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' : status === 'suspended' ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';
const relativeTime = (value?: string | null) => { if (!value) return 'No recent activity'; try { return formatDistanceToNow(new Date(value), { addSuffix: true }); } catch { return 'Recently'; } };

export function AccountLinkingManager() {
  const { toast } = useToast();
  const { can } = usePermission();
  const canView = can('account-linking', 'view');
  const canUpdate = can('account-linking', 'update');

  const [links, setLinks] = useState<AccountLinkRecord[]>([]);
  const [summary, setSummary] = useState({ owners: 0, linkedClients: 0, active: 0, inactive: 0, suspended: 0, attention: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [pickerSearch, setPickerSearch] = useState('');
  const [editLink, setEditLink] = useState<AccountLinkRecord | null>(null);
  const [editSharedDetails, setEditSharedDetails] = useState<SharedDetails>({ ...DEFAULT_SHARED_DETAILS });
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<AccountLinkRecord['status']>('active');
  const [unlinkTarget, setUnlinkTarget] = useState<AccountLinkRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [owners, setOwners] = useState<LinkingAccountOption[]>([]);
  const [clients, setClients] = useState<LinkingAccountOption[]>([]);

  const deferredOwnerSearch = useDeferredValue(ownerSearch);
  const deferredClientSearch = useDeferredValue(clientSearch);

  const loadLinks = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetchAccountLinks();
      setLinks(response.links || []);
      setSummary(response.summary || { owners: 0, linkedClients: 0, active: 0, inactive: 0, suspended: 0, attention: 0 });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load account linking.';
      setError(message);
      if (!silent) toast({ title: 'Failed to load linking workspace', description: message, variant: 'destructive' });
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadLinks(); }, [loadLinks]);

  const groups = useMemo(() => {
    const map = new Map<string, OwnerGroup>();
    links.forEach((link) => {
      const existing = map.get(link.mainAccountId);
      if (existing) {
        existing.links.push(link);
        existing.active += link.status === 'active' ? 1 : 0;
        existing.attention += link.status === 'active' ? 0 : 1;
        if (link.linkedAt && (!existing.latest || new Date(link.linkedAt) > new Date(existing.latest))) existing.latest = link.linkedAt;
        return;
      }
      map.set(link.mainAccountId, {
        id: link.mainAccountId,
        name: link.mainAccountName,
        email: link.mainAccountEmail,
        role: link.mainAccountRole,
        links: [link],
        active: link.status === 'active' ? 1 : 0,
        attention: link.status === 'active' ? 0 : 1,
        latest: link.linkedAt,
      });
    });

    return Array.from(map.values())
      .filter((group) => (`${group.name} ${group.email}`).toLowerCase().includes(deferredOwnerSearch.toLowerCase()))
      .sort((a, b) => new Date(b.latest || 0).getTime() - new Date(a.latest || 0).getTime());
  }, [deferredOwnerSearch, links]);

  useEffect(() => {
    if (groups.length === 0) { setSelectedOwnerId(''); return; }
    if (!selectedOwnerId || !groups.some((group) => group.id === selectedOwnerId)) setSelectedOwnerId(groups[0].id);
  }, [groups, selectedOwnerId]);

  const selectedGroup = groups.find((group) => group.id === selectedOwnerId) || null;
  const visibleLinks = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.links.filter((link) => (`${link.accountName} ${link.accountEmail} ${link.status}`).toLowerCase().includes(deferredClientSearch.toLowerCase()));
  }, [deferredClientSearch, selectedGroup]);

  const shareCoverage = useMemo(() => SHARE_OPTIONS.map((option) => ({
    ...option,
    count: selectedGroup?.links.filter((link) => link.status === 'active' && link.sharedDetails[option.key]).length || 0,
  })), [selectedGroup]);

  const filteredPickerClients = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => (`${client.name} ${client.email} ${client.company || ''}`).toLowerCase().includes(query));
  }, [clients, pickerSearch]);

  const loadDirectory = useCallback(async (ownerId: string) => {
    setLoadingDirectory(true);
    setDirectoryError(null);
    try {
      const response = await fetchAvailableLinkingAccounts({ ownerId: ownerId || undefined });
      setOwners(response.owners || []);
      setClients(response.clientAccounts || []);
    } catch (err) {
      setDirectoryError(err instanceof Error ? err.message : 'Unable to load available accounts.');
    } finally {
      setLoadingDirectory(false);
    }
  }, []);

  useEffect(() => { if (createOpen) void loadDirectory(draft.ownerId); }, [createOpen, draft.ownerId, loadDirectory]);

  const openCreate = (prefill?: Partial<DraftState>) => {
    setDraft({
      ownerId: prefill?.ownerId ?? selectedGroup?.id ?? '',
      clientIds: prefill?.clientIds ?? [],
      sharedDetails: prefill?.sharedDetails ? { ...prefill.sharedDetails } : { ...DEFAULT_SHARED_DETAILS },
      notes: prefill?.notes ?? '',
    });
    setPickerSearch('');
    setCreateOpen(true);
  };

  const handleEditOpen = (link: AccountLinkRecord) => {
    setEditLink(link);
    setEditSharedDetails({ ...link.sharedDetails });
    setEditNotes(link.notes || '');
    setEditStatus(link.status);
  };

  const handleCreate = async () => {
    if (!draft.ownerId || draft.clientIds.length === 0) {
      toast({ title: 'Select an owner and at least one client', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const response = await createAccountLinks({
        mainAccountId: draft.ownerId,
        clientAccountIds: draft.clientIds,
        sharedDetails: draft.sharedDetails,
        notes: draft.notes.trim() || undefined,
      });
      await loadLinks(true);
      setSelectedOwnerId(draft.ownerId);
      setCreateOpen(false);
      setDraft(emptyDraft(draft.ownerId));
      toast({ title: 'Relationships updated', description: response.message });
    } catch (err) {
      toast({ title: 'Unable to save links', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editLink) return;
    setSaving(true);
    try {
      const response = await updateAccountLink(editLink.id, {
        sharedDetails: editSharedDetails,
        notes: editNotes.trim() || undefined,
        status: editStatus,
      });
      await loadLinks(true);
      setEditLink(null);
      toast({ title: 'Link updated', description: response.message });
    } catch (err) {
      toast({ title: 'Unable to update link', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    setSaving(true);
    try {
      const response = await unlinkAccountLink(unlinkTarget.id);
      await loadLinks(true);
      setUnlinkTarget(null);
      toast({ title: 'Relationship removed', description: response.message });
    } catch (err) {
      toast({ title: 'Unable to unlink account', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return <Card className="rounded-3xl"><CardContent className="py-12 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-4 text-lg font-semibold">Account linking is unavailable</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(79,168,255,0.18),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(248,250,252,0.96))] p-5 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_34%),linear-gradient(180deg,_rgba(2,6,23,0.92),_rgba(15,23,42,0.96))] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"><Link2 className="h-3.5 w-3.5" /> Linking Workspace</div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Manage owner-to-client relationships from one focused surface.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Review active groups, reactivate broken relationships, and update shared access without the old batch-only flow.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadLinks(true)} disabled={loading || refreshing}>{refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh</Button>
            <Button onClick={() => openCreate()} disabled={!canUpdate}><Plus className="mr-2 h-4 w-4" />Link Clients</Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {[
            ['Owners', summary.owners, 'Grouped accounts'],
            ['Active clients', summary.active, 'Live relationships'],
            ['Needs attention', summary.attention, 'Inactive or suspended'],
          ].map(([label, value, note], index) => <div key={String(label)} className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/70"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p><p className={cn('mt-3 text-3xl font-semibold tracking-tight', index === 2 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-900 dark:text-white')}>{value}</p><p className="mt-1 text-sm text-muted-foreground">{note}</p></div>)}
        </div>
      </section>

      {error && <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-950/60 dark:bg-red-950/20 dark:text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">The linking workspace couldn&apos;t finish loading.</p><p className="mt-1">{error}</p></div></div>}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-sm font-semibold">Owner groups</p>
          <p className="mt-1 text-xs text-muted-foreground">Select an owner to inspect linked clients.</p>
          <div className="relative mt-4"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={ownerSearch} onChange={(e) => setOwnerSearch(e.target.value)} placeholder="Search owners" className="pl-9" /></div>
          <div className="mt-4">
            {loading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div> : groups.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center"><Users2 className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-4 text-sm font-medium">No linked groups yet</p><Button className="mt-4" onClick={() => openCreate()} disabled={!canUpdate}><Plus className="mr-2 h-4 w-4" />Start linking</Button></div> : <ScrollArea className="h-[520px] pr-3"><div className="space-y-3">{groups.map((group) => <button key={group.id} type="button" onClick={() => setSelectedOwnerId(group.id)} className={cn('w-full rounded-2xl border p-4 text-left transition-colors', selectedOwnerId === group.id ? 'border-blue-300 bg-blue-50 dark:border-blue-900/70 dark:bg-blue-950/30' : 'border-slate-200/70 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/80')}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{group.name}</p><p className="mt-1 text-xs text-muted-foreground">{group.email}</p></div><Badge className={cn('rounded-full border px-2.5 py-1 text-xs', group.attention > 0 ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300')}>{group.attention > 0 ? `${group.attention} attention` : 'Stable'}</Badge></div><div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{group.active} active clients</span><span>{relativeTime(group.latest)}</span></div></button>)}</div></ScrollArea>}
          </div>
        </aside>

        <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-6">
          {loading ? <div className="space-y-4"><Skeleton className="h-10 w-64" /><div className="grid gap-3 lg:grid-cols-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div><Skeleton className="h-12 rounded-2xl" /><Skeleton className="h-32 rounded-3xl" /></div> : !selectedGroup ? <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed text-center"><Link2 className="h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">Select an owner group</h3><p className="mt-2 max-w-md text-sm text-muted-foreground">Choose an owner from the list to inspect linked clients, update shared access, or reactivate relationships.</p></div> : <div className="space-y-6">
            <div className="border-b border-slate-200/80 pb-6 dark:border-slate-800">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div><p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:bg-slate-900 dark:text-slate-300"><Building2 className="h-3.5 w-3.5" />Owner account</p><h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{selectedGroup.name}</h3><div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" />{selectedGroup.email}</span>{selectedGroup.role && <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]">{selectedGroup.role}</Badge>}</div></div>
                <Button onClick={() => openCreate({ ownerId: selectedGroup.id })} disabled={!canUpdate}><Plus className="mr-2 h-4 w-4" />Add clients</Button>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-3">{[['Relationships', selectedGroup.links.length, 'Total linked clients for this owner'], ['Active', selectedGroup.active, 'Clients currently sharing live data'], ['Attention', selectedGroup.attention, 'Inactive or suspended links']].map(([label, value, note], index) => <div key={String(label)} className={cn('rounded-2xl border p-4', index === 1 ? 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20' : index === 2 ? 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20' : 'border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60')}><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p><p className="mt-1 text-sm text-muted-foreground">{note}</p></div>)}</div>
            </div>

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-base font-semibold">Linked clients</h4><p className="text-sm text-muted-foreground">Review status, notes, and shared access for each relationship.</p></div><div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search linked clients" className="pl-9" /></div></div>
                {visibleLinks.length === 0 ? <div className="rounded-3xl border border-dashed px-5 py-10 text-center"><Search className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-4 text-sm font-medium">No client relationships match this search.</p></div> : <div className="space-y-3">{visibleLinks.map((link) => <div key={link.id} className={cn('rounded-3xl border p-4', link.status === 'active' ? 'border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/50' : 'border-amber-200/70 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20')}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-3"><p className="text-lg font-semibold text-slate-900 dark:text-white">{link.accountName}</p><Badge className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', statusTone(link.status))}>{link.status}</Badge></div><div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" />{link.accountEmail}</span><span>Linked {relativeTime(link.linkedAt)}</span></div>{link.notes && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{link.notes}</p>}<div className="mt-3 flex flex-wrap gap-2">{SHARE_OPTIONS.filter((option) => link.sharedDetails[option.key]).map((option) => <Badge key={option.key} variant="outline" className="rounded-full px-3 py-1">{option.label}</Badge>)}</div></div><div className="flex flex-wrap gap-2">{link.status !== 'active' && <Button variant="outline" size="sm" onClick={() => openCreate({ ownerId: selectedGroup.id, clientIds: [link.accountId], sharedDetails: { ...link.sharedDetails }, notes: link.notes || '' })} disabled={!canUpdate}><RefreshCw className="mr-2 h-4 w-4" />Relink</Button>}<Button variant="outline" size="sm" onClick={() => handleEditOpen(link)} disabled={!canUpdate}><Settings2 className="mr-2 h-4 w-4" />Edit</Button>{link.status === 'active' && <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30" onClick={() => setUnlinkTarget(link)} disabled={!canUpdate}><Trash2 className="mr-2 h-4 w-4" />Unlink</Button>}</div></div></div>)}</div>}
              </div>

              <div className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50"><p className="text-sm font-semibold">Share coverage</p><p className="mt-1 text-sm text-muted-foreground">How many active clients receive each data category for this owner.</p><div className="mt-4 space-y-3">{shareCoverage.map((item) => { const Icon = item.icon; return <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm dark:bg-slate-950/70"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-300"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</p><p className="text-xs text-muted-foreground">{item.description}</p></div></div><span className="text-sm font-semibold text-slate-900 dark:text-white">{item.count}</span></div>; })}</div></div>
            </div>
          </div>}
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setDraft(emptyDraft(selectedGroup?.id || '')); setPickerSearch(''); } }}>
        <DialogContent className="max-w-[980px] rounded-[28px] border-0 p-0 shadow-2xl shadow-slate-950/20">
          <div className="grid max-h-[88vh] gap-0 lg:grid-cols-[minmax(0,1.15fr)_320px]">
            <div className="bg-white px-5 py-5 dark:bg-slate-950 sm:px-6 sm:py-6">
              <DialogHeader className="space-y-2 text-left"><DialogTitle className="text-left text-2xl">Link client accounts</DialogTitle><DialogDescription className="text-left">Choose an owner, pick one or more client accounts, and apply one shared-access profile.</DialogDescription></DialogHeader>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div className="space-y-4"><div className="space-y-2"><Label>Owner account</Label><Select value={draft.ownerId || undefined} onValueChange={(value) => setDraft((current) => ({ ...current, ownerId: value, clientIds: [] }))}><SelectTrigger><SelectValue placeholder="Select the owner account" /></SelectTrigger><SelectContent>{owners.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name} · {owner.email}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><div className="flex items-center justify-between"><Label>Client accounts</Label><Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">{draft.clientIds.length} selected</Badge></div><Input value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Search available clients" /><div className="rounded-3xl border border-slate-200/70 dark:border-slate-800"><ScrollArea className="h-[360px]"><div className="space-y-2 p-3">{loadingDirectory ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />) : directoryError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 dark:border-red-950/60 dark:bg-red-950/20 dark:text-red-300">{directoryError}</div> : filteredPickerClients.length === 0 ? <div className="rounded-2xl border border-dashed px-4 py-10 text-center"><p className="text-sm font-medium">{clients.length === 0 ? 'No clients available' : 'No clients match this search'}</p><p className="mt-1 text-xs text-muted-foreground">{clients.length === 0 ? 'Every eligible client is already active for this owner.' : 'Try a different name or email.'}</p></div> : filteredPickerClients.map((client) => { const checked = draft.clientIds.includes(client.id); return <button key={client.id} type="button" onClick={() => setDraft((current) => ({ ...current, clientIds: checked ? current.clientIds.filter((id) => id !== client.id) : [...current.clientIds, client.id] }))} className={cn('flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors', checked ? 'border-blue-300 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30' : 'border-slate-200/70 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/80')}><Checkbox checked={checked} className="mt-0.5" /><div><p className="text-sm font-medium text-slate-900 dark:text-white">{client.name}</p><p className="mt-1 text-xs text-muted-foreground">{client.email}</p></div></button>; })}</div></ScrollArea></div></div></div>
                <div className="space-y-4"><div className="space-y-2"><Label>Relationship note</Label><Textarea value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} rows={4} placeholder="Add context for why these clients are linked to this owner." /></div><div className="space-y-3"><Label>Shared access</Label><div className="space-y-3">{SHARE_OPTIONS.map((option) => { const Icon = option.icon; return <div key={option.key} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-300"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-medium text-slate-900 dark:text-white">{option.label}</p><p className="mt-1 text-xs text-muted-foreground">{option.description}</p></div></div><Switch checked={draft.sharedDetails[option.key]} onCheckedChange={(checked) => setDraft((current) => ({ ...current, sharedDetails: { ...current.sharedDetails, [option.key]: checked } }))} /></div></div>; })}</div></div></div>
              </div>
            </div>
            <div className="border-l border-slate-200/70 bg-slate-50/90 px-5 py-5 dark:border-slate-800 dark:bg-slate-900/80 sm:px-6 sm:py-6"><div className="rounded-3xl border border-white/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"><p className="text-sm font-semibold">Review before saving</p><div className="mt-4 space-y-4 text-sm"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Owner</p><p className="mt-2 font-medium text-slate-900 dark:text-white">{owners.find((owner) => owner.id === draft.ownerId)?.name || 'No owner selected'}</p><p className="text-muted-foreground">{owners.find((owner) => owner.id === draft.ownerId)?.email || 'Choose an owner account.'}</p></div><Separator /><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Clients</p><div className="mt-3 space-y-2">{draft.clientIds.length === 0 ? <p className="text-muted-foreground">No clients selected yet.</p> : draft.clientIds.map((id) => { const client = clients.find((item) => item.id === id); return <div key={id} className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900"><p className="font-medium text-slate-900 dark:text-white">{client?.name || id}</p><p className="text-xs text-muted-foreground">{client?.email || 'Pending selection sync'}</p></div>; })}</div></div></div></div><DialogFooter className="mt-5 gap-2 sm:flex-col sm:space-x-0"><Button variant="outline" className="w-full" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button><Button className="w-full" onClick={handleCreate} disabled={saving || !canUpdate}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Save relationships</Button></DialogFooter></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editLink)} onOpenChange={(open) => !open && setEditLink(null)}>
        <DialogContent className="max-w-[760px] rounded-[28px] border-0 p-0 shadow-2xl shadow-slate-950/20">
          {editLink && <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="bg-white px-5 py-5 dark:bg-slate-950 sm:px-6 sm:py-6"><DialogHeader className="space-y-2 text-left"><DialogTitle className="text-left text-2xl">Edit relationship</DialogTitle><DialogDescription className="text-left">Adjust shared access and status for {editLink.accountName}.</DialogDescription></DialogHeader><div className="mt-6 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Owner</p><p className="mt-2 font-medium text-slate-900 dark:text-white">{editLink.mainAccountName}</p><p className="text-sm text-muted-foreground">{editLink.mainAccountEmail}</p></div><div className="rounded-2xl border bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Client</p><p className="mt-2 font-medium text-slate-900 dark:text-white">{editLink.accountName}</p><p className="text-sm text-muted-foreground">{editLink.accountEmail}</p></div></div><div className="space-y-2"><Label>Status</Label><Select value={editStatus} onValueChange={(value) => setEditStatus(value as AccountLinkRecord['status'])}><SelectTrigger><SelectValue placeholder="Select relationship status" /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Relationship note</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} /></div><div className="space-y-3"><Label>Shared access</Label><div className="space-y-3">{SHARE_OPTIONS.map((option) => { const Icon = option.icon; return <div key={option.key} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-300"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-medium text-slate-900 dark:text-white">{option.label}</p><p className="mt-1 text-xs text-muted-foreground">{option.description}</p></div></div><Switch checked={editSharedDetails[option.key]} disabled={!canUpdate} onCheckedChange={(checked) => setEditSharedDetails((current) => ({ ...current, [option.key]: checked }))} /></div></div>; })}</div></div></div></div><div className="border-l border-slate-200/70 bg-slate-50/90 px-5 py-5 dark:border-slate-800 dark:bg-slate-900/80 sm:px-6 sm:py-6"><div className="rounded-3xl border border-white/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"><p className="text-sm font-semibold">Current state</p><p className="mt-4 text-sm text-muted-foreground">Linked {relativeTime(editLink.linkedAt)}</p><div className="mt-4 flex flex-wrap gap-2">{SHARE_OPTIONS.filter((option) => editSharedDetails[option.key]).map((option) => <Badge key={option.key} variant="outline" className="rounded-full px-3 py-1">{option.label}</Badge>)}</div></div><DialogFooter className="mt-5 gap-2 sm:flex-col sm:space-x-0"><Button variant="outline" className="w-full" onClick={() => setEditLink(null)} disabled={saving}>Cancel</Button><Button className="w-full" onClick={handleEditSave} disabled={saving || !canUpdate}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}Save changes</Button></DialogFooter></div></div>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(unlinkTarget)} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Unlink this client?</AlertDialogTitle><AlertDialogDescription>{unlinkTarget ? `${unlinkTarget.accountName} will move to inactive and stop sharing access with ${unlinkTarget.mainAccountName}.` : 'This relationship will be marked inactive.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600" onClick={(e) => { e.preventDefault(); void handleUnlink(); }} disabled={saving || !canUpdate}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Unlink account</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
