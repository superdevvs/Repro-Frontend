import { useEffect, useState } from 'react';
import { ChevronRight, Link2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ShootData, ShootReshootLineageSummary } from '@/types/shoots';
import { getShootCompensations } from './api';
import { getCompReshootReasonLabel } from './model';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    const number = Number(value);
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(number)) return number;
  }
  return null;
};

type OwnCompensation = {
  amount: number;
  status: string | null;
};

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const normalizeOwnCompensation = (
  payload: Record<string, unknown>,
  recipientType: 'photographer' | 'sales_rep',
): OwnCompensation | null => {
  const preferredRows = recipientType === 'photographer'
    ? asArray(payload.photographer_compensations ?? payload.photographerCompensations)
    : [payload.sales_rep_compensation ?? payload.salesRepCompensation].filter(Boolean);
  const fallbackRows = asArray(payload.compensations).filter((value) => {
    const row = asRecord(value);
    return String(row.recipient_type ?? row.recipientType ?? '') === recipientType;
  });
  const rows = (preferredRows.length ? preferredRows : fallbackRows).map(asRecord);
  const amounts = rows
    .map((row) => firstNumber(row.amount))
    .filter((value): value is number => value !== null);
  if (amounts.length === 0) return null;
  const statuses = [...new Set(rows
    .map((row) => String(row.payout_status ?? row.payoutStatus ?? '').trim())
    .filter(Boolean))];
  return {
    amount: amounts.reduce((total, amount) => total + amount, 0),
    status: statuses.length === 1 ? statuses[0] : statuses.length > 1 ? 'multiple_statuses' : null,
  };
};

const formatStatus = (status: string | null) => status
  ? status.split('_').join(' ').replace(/\b\w/g, (character) => character.toUpperCase())
  : 'Status unavailable';

const normalizeLineage = (value?: ShootReshootLineageSummary | null) => {
  if (!value?.id) return null;
  return {
    id: String(value.id),
    address: value.fullAddress ?? value.full_address ?? value.address ?? '',
    scheduledAt: value.scheduledAt
      ?? value.scheduled_at
      ?? value.scheduledDate
      ?? value.scheduled_date
      ?? null,
    reasonCode: value.reasonCode ?? value.reason_code ?? value.reasonCodes?.[0] ?? value.reason_codes?.[0] ?? null,
    affectedServiceNames: value.affectedServiceNames ?? value.affected_service_names ?? [],
    status: value.status ?? null,
  };
};

const formatChildDate = (value: string | null) => {
  if (!value) return 'Date pending';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};

type CompReshootOverviewStripProps = {
  shoot: ShootData;
  role: string;
  onOpenShoot: (shootId: string) => void;
};

export function CompReshootOverviewStrip({ shoot, role, onOpenShoot }: CompReshootOverviewStripProps) {
  const normalizedRole = role.trim().toLowerCase();
  const isOperationsAdmin = ['admin', 'superadmin', 'super_admin'].includes(normalizedRole);
  const isPhotographer = normalizedRole === 'photographer';
  const isRep = ['rep', 'salesrep', 'sales_rep', 'representative'].includes(normalizedRole);
  const isEditor = normalizedRole === 'editor';
  const isClient = normalizedRole === 'client';
  const isComp = shoot.shootType === 'complimentary_reshoot';
  const parent = normalizeLineage(shoot.reshootParent ?? shoot.reshoot_parent);
  const root = normalizeLineage(shoot.reshootRoot ?? shoot.reshoot_root);
  const children = (shoot.reshootChildren ?? shoot.reshoot_children ?? []).map(normalizeLineage).filter(Boolean) as Array<NonNullable<ReturnType<typeof normalizeLineage>>>;
  const compensation = asRecord(shoot.compensationSummary ?? shoot.compensation_summary);
  const staffTotal = firstNumber(
    compensation.staff_compensation_total,
    compensation.staff_total,
    compensation.staffTotal,
  );
  const [ownCompensationState, setOwnCompensationState] = useState<{
    state: 'idle' | 'loading' | 'loaded' | 'unavailable';
    value: OwnCompensation | null;
  }>({ state: 'idle', value: null });

  useEffect(() => {
    const recipientType = isPhotographer ? 'photographer' : isRep ? 'sales_rep' : null;
    if (!isComp || !recipientType) {
      setOwnCompensationState({ state: 'idle', value: null });
      return;
    }
    let cancelled = false;
    setOwnCompensationState({ state: 'loading', value: null });
    void getShootCompensations(shoot.id)
      .then((payload) => {
        if (cancelled) return;
        const value = normalizeOwnCompensation(payload, recipientType);
        setOwnCompensationState({ state: value ? 'loaded' : 'unavailable', value });
      })
      .catch(() => {
        if (!cancelled) setOwnCompensationState({ state: 'unavailable', value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [isComp, isPhotographer, isRep, shoot.id]);

  if (!isComp && ((!isOperationsAdmin && !isClient) || children.length === 0)) return null;

  if (!isComp) {
    return (
      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2" aria-label="Related comp reshoots">
        <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold text-foreground">{isOperationsAdmin ? 'Comp reshoots' : 'Related shoots'} ({children.length})</span>
        <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {children.slice(0, 3).map((child) => (
            <Button
              key={child.id}
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto min-w-0 justify-between gap-2 px-2 py-1.5 text-left text-xs"
              onClick={() => onOpenShoot(child.id)}
              title={child.address || undefined}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {isOperationsAdmin ? `#${child.id}${child.address ? ` · ${child.address}` : ''}` : child.address || 'Related shoot'}
                </span>
                <span className="block truncate text-[10px] font-normal text-muted-foreground">
                  {[
                    formatChildDate(child.scheduledAt),
                    child.affectedServiceNames.join(', ') || 'Service pending',
                    isOperationsAdmin
                      ? getCompReshootReasonLabel(child.reasonCode)
                      : child.status ? formatStatus(child.status) : 'Status pending',
                  ].join(' · ')}
                </span>
              </span>
              <ChevronRight className="ml-1 h-3 w-3 shrink-0" />
            </Button>
          ))}
          {children.length > 3 && <span className="text-xs text-muted-foreground">+{children.length - 3} more</span>}
        </div>
      </section>
    );
  }

  const ownSummary = (label: string) => ownCompensationState.state === 'loading'
    ? `${label} loading…`
    : ownCompensationState.state === 'loaded' && ownCompensationState.value
      ? `${label} ${money.format(ownCompensationState.value.amount)} · ${formatStatus(ownCompensationState.value.status)}`
      : `${label} unavailable`;
  const roleSummary = isOperationsAdmin
    ? staffTotal !== null ? `Staff ${money.format(staffTotal)}` : null
    : isPhotographer
      ? ownSummary('Your payout')
      : isRep
        ? ownSummary('Your compensation')
        : isEditor
          ? 'Standard editing workflow'
          : isClient
            ? '$0 client balance'
            : null;

  return (
    <section className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-950/25" aria-label="Complimentary reshoot lineage">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <RotateCcw className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <Badge className="bg-amber-200 text-amber-950 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100">Complimentary reshoot</Badge>
          {isOperationsAdmin && (
            <span className="truncate text-xs text-amber-900 dark:text-amber-100">
              {getCompReshootReasonLabel(shoot.reshootReasonCode ?? shoot.reshoot_reason_code)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:justify-end">
          {parent && root && parent.id !== root.id && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onOpenShoot(parent.id)} title={parent.address || undefined}>
              <Link2 className="mr-1 h-3 w-3" /> Parent #{parent.id}
            </Button>
          )}
          {(root || parent) && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onOpenShoot((root || parent)!.id)} title={(root || parent)!.address || undefined}>
              <Link2 className="mr-1 h-3 w-3" /> Original #{(root || parent)!.id}
            </Button>
          )}
          {roleSummary && <span className="ml-auto text-xs font-medium text-amber-900 dark:text-amber-100 sm:ml-1">{roleSummary}</span>}
        </div>
      </div>
    </section>
  );
}
