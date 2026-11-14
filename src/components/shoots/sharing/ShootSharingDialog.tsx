import { useState } from 'react';
import { CheckCircle2, ShieldCheck, Share2 } from 'lucide-react';
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
    <DialogContent className="shoot-sharing-dialog max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[480px] gap-0 overflow-y-auto rounded-[24px] border border-border/80 bg-background p-0 shadow-2xl">
      <DialogHeader className="relative m-0 border-b border-border/60 px-6 pb-5 pt-6 text-left">
        <img src="/brand/magic-link-glass.png" alt="" aria-hidden="true" className="pointer-events-none absolute right-10 top-5 h-[72px] w-[108px] object-contain" />
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-primary"><Share2 className="h-3 w-3" />Share property</p>
        <DialogTitle className="pr-28 text-[25px] font-semibold leading-tight tracking-tight">Magic Link</DialogTitle>
        <DialogDescription className="max-w-[310px] pt-1 text-xs leading-relaxed">{address}</DialogDescription>
      </DialogHeader>
      <Tabs value={tab} onValueChange={setTab} className="px-5 pb-5 pt-4 sm:px-6">
        <TabsList className="mb-5 grid h-10 w-full grid-cols-2 rounded-xl bg-muted/60 p-1"><TabsTrigger value="invite" className="rounded-lg text-xs">Invite people</TabsTrigger><TabsTrigger value="manage" className="gap-1.5 rounded-lg text-xs">Manage access{sharing.invitations.length > 0 && <span className="rounded-md bg-foreground/5 px-1.5 text-[10px]">{sharing.invitations.length}{sharing.hasMore ? '+' : ''}</span>}</TabsTrigger></TabsList>
        <TabsContent value="invite" forceMount className="mt-0 focus-visible:ring-0 data-[state=inactive]:hidden"><GuestShareInvitePanel busy={sharing.busy} results={sharing.results} invitations={sharing.invitations} copiedId={sharing.copiedId} onInvite={sharing.invite} onCopy={invitation => void sharing.copy(invitation)} onManage={() => setTab('manage')} /></TabsContent>
        <TabsContent value="manage" className="mt-0 focus-visible:ring-0"><GuestShareManagePanel {...sharing} onLoadMore={() => void sharing.loadMore()} onCopy={invitation => void sharing.copy(invitation)} onManage={(invitation, action) => void sharing.manage(invitation, action)} onInvite={() => setTab('invite')} /></TabsContent>
        {sharing.error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">{sharing.error}</p>}
        {sharing.message && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-xs leading-relaxed text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{sharing.message}</p>}
        {sharing.copyFallback && <div className="mt-4 space-y-2 rounded-xl border p-3"><p className="text-xs text-muted-foreground">Select and copy this personal link for {sharing.copyFallback.email}:</p><Input readOnly value={sharing.copyFallback.url} aria-label="Personal Magic Link" className="h-9 text-xs" onFocus={event => event.currentTarget.select()} /></div>}
        <p className="mt-5 flex items-start gap-2 border-t border-border/60 pt-4 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Guests see released media and tours. Internal notes, billing details and lockbox codes stay private.</p>
      </Tabs>
    </DialogContent>
  </Dialog>;
}
