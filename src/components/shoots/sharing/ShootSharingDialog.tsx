import { useState } from 'react';
import { CheckCircle2, Share2 } from 'lucide-react';
import type { ShootData } from '@/types/shoots';
import { getShootStreetAddress } from '@/components/shoots/details/shootDetailsModalHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useShootGuestSharing } from './useShootGuestSharing';
import { GuestShareInvitePanel } from './GuestShareInvitePanel';
import { GuestShareManagePanel } from './GuestShareManagePanel';
import './shootSharing.css';

export type ShootShareButtonProps = { shoot: ShootData; compact?: boolean; className?: string };

export function ShootSharingDialog({ shoot, compact = false, className }: ShootShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('invite');
  const sharing = useShootGuestSharing(shoot.id, open);
  const address = getShootStreetAddress(shoot) || 'This property';
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size={compact ? 'icon' : 'sm'} className={cn('gap-1.5 rounded-lg', className)} aria-label="Share shoot"><Share2 className="h-3.5 w-3.5" />{!compact && 'Share'}</Button></DialogTrigger>
    <DialogContent className="shoot-sharing-dialog max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[440px] gap-0 overflow-y-auto rounded-2xl border border-border/80 bg-background p-0 shadow-2xl">
      <DialogHeader className="m-0 space-y-1 border-b border-border/60 px-5 py-4 text-left">
        <DialogTitle className="pr-8 text-xl font-semibold leading-6 tracking-tight">Share</DialogTitle>
        <DialogDescription className="truncate pr-6 text-xs" title={address}>{address}</DialogDescription>
      </DialogHeader>
      <Tabs value={tab} onValueChange={setTab} className="px-5 pb-4 pt-3">
        <TabsList className="mb-4 grid h-9 w-full grid-cols-2 rounded-lg bg-muted/60 p-1"><TabsTrigger value="invite" className="rounded-md text-xs">Magic Link</TabsTrigger><TabsTrigger value="manage" className="gap-1.5 rounded-md text-xs">Manage access{sharing.invitations.length > 0 && <span className="rounded bg-foreground/5 px-1.5 text-[10px]">{sharing.invitations.length}{sharing.hasMore ? '+' : ''}</span>}</TabsTrigger></TabsList>
        <TabsContent value="invite" forceMount className="mt-0 focus-visible:ring-0 data-[state=inactive]:hidden"><GuestShareInvitePanel busy={sharing.busy} results={sharing.results} invitations={sharing.invitations} copiedId={sharing.copiedId} onInvite={sharing.invite} onCopy={invitation => void sharing.copy(invitation)} onManage={() => setTab('manage')} /></TabsContent>
        <TabsContent value="manage" className="mt-0 focus-visible:ring-0"><GuestShareManagePanel {...sharing} onLoadMore={() => void sharing.loadMore()} onCopy={invitation => void sharing.copy(invitation)} onManage={(invitation, action) => void sharing.manage(invitation, action)} onInvite={() => setTab('invite')} /></TabsContent>
        {sharing.error && <p role="alert" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs leading-relaxed text-destructive">{sharing.error}</p>}
        {sharing.message && <p role="status" className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />{sharing.message}</p>}
        {sharing.copyFallback && <div className="mt-3 space-y-1.5 rounded-lg border p-2"><p className="text-xs text-muted-foreground">Select and copy this personal link for {sharing.copyFallback.email}:</p><Input readOnly value={sharing.copyFallback.url} aria-label="Personal Magic Link" className="h-9 text-xs" onFocus={event => event.currentTarget.select()} /></div>}
      </Tabs>
    </DialogContent>
  </Dialog>;
}
