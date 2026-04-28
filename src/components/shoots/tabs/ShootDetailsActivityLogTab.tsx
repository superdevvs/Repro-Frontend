import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ChevronDown,
  ChevronUp,
  Mail,
  DollarSign,
  Upload,
  CheckCircle,
  FileText,
  User,
  Clock,
  AlertCircle,
  RefreshCw,
  LinkIcon,
} from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { format } from 'date-fns';
import { API_BASE_URL } from '@/config/env';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ShootDetailsActivityLogTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  onShootUpdate: () => void;
}

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    role?: string;
  } | null;
  action: string;
  type: 'email' | 'payment' | 'upload' | 'finalize' | 'note' | 'status_change' | 'sync' | 'tour' | 'other';
  description: string;
  details?: any;
  metadata?: Record<string, unknown>;
}

type PaymentActionDetails = {
  paymentId: string;
  provider: string;
  amount?: number;
  currency?: string;
  status?: string;
  refundStatus?: string;
  refundedAt?: string;
  hostedReceiptUrl?: string;
};

const activityTypeIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  payment: <DollarSign className="h-4 w-4" />,
  upload: <Upload className="h-4 w-4" />,
  finalize: <CheckCircle className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  status_change: <AlertCircle className="h-4 w-4" />,
  sync: <RefreshCw className="h-4 w-4" />,
  tour: <LinkIcon className="h-4 w-4" />,
  other: <Clock className="h-4 w-4" />,
};

const activityTypeColors: Record<string, string> = {
  email: 'bg-blue-100 text-blue-700 border-blue-200',
  payment: 'bg-green-100 text-green-700 border-green-200',
  upload: 'bg-purple-100 text-purple-700 border-purple-200',
  finalize: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  note: 'bg-gray-100 text-gray-700 border-gray-200',
  status_change: 'bg-orange-100 text-orange-700 border-orange-200',
  sync: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  tour: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const normalized = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
};

const normalizeActivityEntry = (item: any): ActivityLogEntry => ({
  id: item.id || `activity-${Date.now()}-${Math.random()}`,
  timestamp: item.created_at || item.timestamp || item.createdAt || new Date().toISOString(),
  actor: item.user ? {
    id: item.user.id || item.user_id,
    name: item.user.name || 'System',
    role: item.user.role,
  } : (item.actor || null),
  action: item.action || 'unknown',
  type: determineActivityType(item.action || ''),
  description: item.description || item.message || item.details || 'Activity logged',
  details: item.metadata || item.details,
  metadata: item.metadata,
});

function determineActivityType(action: string): ActivityLogEntry['type'] {
  const lower = action.toLowerCase();
  if (lower.includes('bright_mls') || lower.includes('bright mls') || lower.includes('mls_synced')) return 'sync';
  if (lower.includes('tour_links') || lower.includes('tour link') || (lower.includes('tour') && lower.includes('generated'))) return 'tour';
  if (lower.includes('email') || lower.includes('sent')) return 'email';
  if (lower.includes('payment') || lower.includes('paid') || lower.includes('charge')) return 'payment';
  if (lower.includes('upload') || lower.includes('file') || lower.includes('hero') || lower.includes('cover')) return 'upload';
  if (lower.includes('finalize') || lower.includes('complete')) return 'finalize';
  if (lower.includes('note')) return 'note';
  if (lower.includes('status') || lower.includes('workflow')) return 'status_change';
  return 'other';
}

const getPaymentActionDetails = (entry: ActivityLogEntry): PaymentActionDetails | null => {
  const containers = [entry.details, entry.metadata]
    .map(toRecord)
    .filter((container): container is Record<string, unknown> => Boolean(container))
    .flatMap((container) => {
      const nestedDetails = [
        toRecord(container.payment_details),
        toRecord(container.paymentDetails),
        toRecord(container.payment),
      ].filter((nested): nested is Record<string, unknown> => Boolean(nested));

      return [container, ...nestedDetails];
    });

  for (const container of containers) {
    const paymentId = toOptionalString(container.payment_id ?? container.paymentId ?? container.id);
    const provider = toOptionalString(container.provider ?? container.payment_method ?? container.paymentMethod)?.toLowerCase();

    if (!paymentId || (provider && provider !== 'stripe')) {
      continue;
    }

    return {
      paymentId,
      provider: provider || 'stripe',
      amount: toOptionalNumber(container.amount),
      currency: toOptionalString(container.currency),
      status: toOptionalString(container.status)?.toLowerCase(),
      refundStatus: toOptionalString(container.refund_status ?? container.refundStatus)?.toLowerCase(),
      refundedAt: toOptionalString(container.refunded_at ?? container.refundedAt),
      hostedReceiptUrl: toOptionalString(
        container.hosted_receipt_url
          ?? container.hostedReceiptUrl
          ?? container.receipt_url
          ?? container.receiptUrl,
      ),
    };
  }

  return null;
};

export function ShootDetailsActivityLogTab({
  shoot,
  isAdmin,
  onShootUpdate,
}: ShootDetailsActivityLogTabProps) {
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [pendingRefundEntry, setPendingRefundEntry] = useState<ActivityLogEntry | null>(null);
  const [refundingEntryId, setRefundingEntryId] = useState<string | null>(null);

  useEffect(() => {
    // Check if activity logs are already in shoot data
    if ((shoot as any).activityLogs && Array.isArray((shoot as any).activityLogs)) {
      const activitiesData = (shoot as any).activityLogs;
      const transformed = activitiesData.map(normalizeActivityEntry);
      
      setActivities(transformed.sort((a: ActivityLogEntry, b: ActivityLogEntry) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
      setLoading(false);
    }

    void loadActivities();
  }, [shoot.id, (shoot as any).activityLogs]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/activity-log`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      
      if (!res.ok) {
        // Silently handle errors - just show empty state
        // Don't show error message to user
        setActivities([]);
        return;
      }

      const json = await res.json();
      const activitiesData = json.data || json || [];
      
      if (!Array.isArray(activitiesData)) {
        console.warn('Activity log data is not an array:', activitiesData);
        setActivities([]);
        return;
      }
      
      // Transform API data to ActivityLogEntry format
      const transformed = activitiesData.map(normalizeActivityEntry);
      
      setActivities(transformed.sort((a: ActivityLogEntry, b: ActivityLogEntry) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
    } catch (error: any) {
      console.error('Error loading activity log:', error);
      // Silently handle errors - don't show error to user
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const groupByDate = (activities: ActivityLogEntry[]) => {
    const groups: Record<string, ActivityLogEntry[]> = {};
    activities.forEach(activity => {
      const date = format(new Date(activity.timestamp), 'MMM dd, yyyy');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });
    return groups;
  };

  const refundedPaymentIds = useMemo(() => {
    return activities.reduce((paymentIds, entry) => {
      const payment = getPaymentActionDetails(entry);
      const isRefundEvent = entry.action.toLowerCase().includes('refund');
      const isRefunded = Boolean(
        payment?.paymentId
        && (
          isRefundEvent
          || payment.status === 'refunded'
          || payment.refundStatus
          || payment.refundedAt
        )
      );

      if (isRefunded && payment) {
        paymentIds.add(payment.paymentId);
      }

      return paymentIds;
    }, new Set<string>());
  }, [activities]);

  const handleRefundCharge = async (entry: ActivityLogEntry) => {
    const refundablePayment = getPaymentActionDetails(entry);
    if (!refundablePayment) {
      toast({
        title: 'Refund unavailable',
        description: 'This activity entry is not linked to a refundable Stripe payment.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setRefundingEntryId(entry.id);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/payments/stripe-refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_id: refundablePayment.paymentId,
          amount: refundablePayment.amount,
        }),
      });

      const bodyText = await response.text();
      let payload: any = null;
      try {
        payload = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || bodyText || 'Refund failed.');
      }

      toast({
        title: 'Refund processed',
        description: 'The Stripe refund was submitted successfully.',
      });

      await loadActivities();
      await Promise.resolve(onShootUpdate());
      setPendingRefundEntry(null);
    } catch (error: any) {
      toast({
        title: 'Refund failed',
        description: error?.message || 'Unable to process the refund.',
        variant: 'destructive',
      });
    } finally {
      setRefundingEntryId(null);
    }
  };

  const handleViewCharge = (entry: ActivityLogEntry) => {
    const paymentDetails = getPaymentActionDetails(entry);
    if (!paymentDetails?.hostedReceiptUrl) {
      toast({
        title: 'Receipt unavailable',
        description: 'No Stripe receipt URL is available for this payment yet.',
        variant: 'destructive',
      });
      return;
    }

    const popup = window.open(
      paymentDetails.hostedReceiptUrl,
      'stripe-receipt',
      'popup=yes,width=980,height=760,noopener,noreferrer',
    );

    if (!popup) {
      toast({
        title: 'Popup blocked',
        description: 'Please allow popups for this site to view the Stripe receipt.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full !mt-0">
        <Card className="!mt-0">
          <CardHeader className="!pt-6">
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Timeline of all activities and events for this shoot</CardDescription>
          </CardHeader>
          <CardContent className="py-10 text-center">
            <div className="text-muted-foreground">Loading activity log...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const groupedActivities = groupByDate(activities);

  return (
    <div className="w-full !mt-0">
      <Card className="!mt-0">
        <CardHeader className="!pt-6">
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Timeline of all activities and events for this shoot</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity logged yet
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([date, dateActivities]) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px flex-1 bg-border" />
                    <h3 className="text-sm font-semibold text-muted-foreground">{date}</h3>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  
                  {dateActivities.map((entry) => {
                    const isExpanded = expandedEntries.has(entry.id);
                    const icon = activityTypeIcons[entry.type] || activityTypeIcons.other;
                    const colorClass = activityTypeColors[entry.type] || activityTypeColors.other;
                    const paymentDetails = getPaymentActionDetails(entry);
                    const isRefundEvent = entry.action.toLowerCase().includes('refund');
                    const canViewCharge = Boolean(paymentDetails?.hostedReceiptUrl);
                    const canRefundCharge = Boolean(
                      paymentDetails
                      && !isRefundEvent
                      && !refundedPaymentIds.has(paymentDetails.paymentId)
                      && paymentDetails.status !== 'refunded'
                      && !paymentDetails.refundStatus
                      && !paymentDetails.refundedAt
                    );
                    
                    return (
                      <div
                        key={entry.id}
                        className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors bg-card"
                      >
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                            {icon}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={colorClass}>
                                  {entry.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {entry.actor?.name || 'System'}
                                </span>
                                {entry.actor?.role && (
                                  <span className="text-xs text-muted-foreground">
                                    ({entry.actor.role})
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-foreground">{entry.description}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.timestamp), 'h:mm a')}
                              </span>
                              {(entry.details || entry.metadata) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => toggleExpand(entry.id)}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {isExpanded && (entry.details || entry.metadata) && (
                            <Collapsible open={isExpanded}>
                              <CollapsibleContent>
                                <div className="mt-3 p-4 bg-muted/30 rounded-lg border text-xs space-y-3">
                                  {entry.type === 'payment' && isAdmin && (canViewCharge || canRefundCharge) && (
                                    <div className="flex gap-2">
                                      {canViewCharge && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleViewCharge(entry)}
                                        >
                                          View Charge
                                        </Button>
                                      )}
                                      {canRefundCharge && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={refundingEntryId === entry.id}
                                          onClick={() => setPendingRefundEntry(entry)}
                                        >
                                          {refundingEntryId === entry.id ? 'Refunding...' : 'Refund Charge'}
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                  {entry.details && (
                                    <div className="space-y-1">
                                      <strong className="text-foreground">Details:</strong>
                                      <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground font-mono bg-background p-2 rounded border">
                                        {typeof entry.details === 'string' 
                                          ? entry.details 
                                          : JSON.stringify(entry.details, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                    <div className="space-y-1">
                                      <strong className="text-foreground">Metadata:</strong>
                                      <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground font-mono bg-background p-2 rounded border">
                                        {JSON.stringify(entry.metadata, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={Boolean(pendingRefundEntry)}
        onOpenChange={(open) => {
          if (!open && !refundingEntryId) {
            setPendingRefundEntry(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this Stripe charge?</AlertDialogTitle>
            <AlertDialogDescription>
              This will refund the recorded charge amount for this shoot. The payment total, receipt state, and available refund actions will update after the refund finishes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(refundingEntryId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
              disabled={!pendingRefundEntry || Boolean(refundingEntryId)}
              onClick={(event) => {
                event.preventDefault();
                if (pendingRefundEntry) {
                  void handleRefundCharge(pendingRefundEntry);
                }
              }}
            >
              {refundingEntryId ? 'Refunding...' : 'Refund charge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
