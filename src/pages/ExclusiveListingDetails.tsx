import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { ShootData } from '@/types/shoots';
import {
  ArrowLeft,
  Lock,
} from 'lucide-react';

const resolvePreviewUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const withBase = isAbsolute ? trimmed : `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;

  try {
    return new URL(withBase).toString();
  } catch {
    return withBase;
  }
};

const buildListingAlias = (address: string | null | undefined) => {
  const raw = String(address || '').trim();
  if (!raw) return 'Exclusive Listing';
  const cleaned = raw
    .replace(/^\d+\s*/, '')
    .replace(/\b(avenue|ave|street|st|road|rd|drive|dr|boulevard|blvd|lane|ln|court|ct|circle|cir|way|place|pl|terrace|ter|trail|trl|parkway|pkwy)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean);
  if (!words.length) return 'Exclusive Listing';
  const title = words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return title.toLowerCase().includes('house') ? title : `${title} House`;
};

const normalizeStatusKey = (value?: string | null) => {
  if (!value) return '';
  const key = value.toLowerCase();
  const map: Record<string, string> = {
    booked: 'scheduled',
    raw_upload_pending: 'scheduled',
    raw_uploaded: 'uploaded',
    photos_uploaded: 'uploaded',
    in_progress: 'uploaded',
    completed: 'uploaded',
    editing_uploaded: 'review',
    editing_complete: 'review',
    editing_issue: 'review',
    pending_review: 'review',
    ready_for_review: 'review',
    qc: 'review',
    ready: 'delivered',
    ready_for_client: 'delivered',
    admin_verified: 'delivered',
  };
  return map[key] || key;
};

const statusBadgeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  requested: { label: 'Requested', variant: 'secondary' },
  scheduled: { label: 'Scheduled', variant: 'default' },
  booked: { label: 'Scheduled', variant: 'secondary' },
  uploaded: { label: 'Uploaded', variant: 'default' },
  editing: { label: 'Editing', variant: 'secondary' },
  review: { label: 'In Review', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'default' },
  on_hold: { label: 'On Hold', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  canceled: { label: 'Cancelled', variant: 'destructive' },
  declined: { label: 'Declined', variant: 'destructive' },
};

export default function ExclusiveListingDetails() {
  const { toast } = useToast();
  const { user } = useAuth();
  const role = user?.role || 'client';
  const isAdminOrSuperAdmin = role === 'admin' || role === 'superadmin';

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [shoot, setShoot] = useState<ShootData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);

  const loadShoot = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch listing');

      const json = await res.json();
      let shootData = (json.data || json) as any;

      if (shootData) {
        // Normalize location
        if (!shootData.location && (shootData.address || shootData.city)) {
          shootData.location = {
            address: shootData.address || '',
            city: shootData.city || '',
            state: shootData.state || '',
            zip: shootData.zip || '',
            fullAddress: shootData.fullAddress || shootData.address || '',
          };
        }

        // Normalize payment fields when absent
        const toNumber = (value: any): number => {
          if (value === null || value === undefined) return 0;
          const num = typeof value === 'string' ? parseFloat(value) : Number(value);
          return isNaN(num) ? 0 : num;
        };

        if (!shootData.payment) {
          shootData.payment = {
            baseQuote: toNumber(shootData.base_quote),
            taxRate: toNumber(shootData.tax_rate),
            taxAmount: toNumber(shootData.tax_amount),
            totalQuote: toNumber(shootData.total_quote),
            totalPaid: toNumber(shootData.total_paid),
            lastPaymentDate: shootData.last_payment_date || undefined,
            lastPaymentType: shootData.last_payment_type || undefined,
          };
        }

        shootData.heroImage = shootData.heroImage || shootData.hero_image;
        shootData.workflowStatus = shootData.workflowStatus || shootData.workflow_status;
        shootData.isPrivateListing = Boolean(shootData.is_private_listing ?? shootData.isPrivateListing ?? shootData.isPrivateListing);
      }

      setShoot(shootData);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e?.message || 'Failed to load listing', variant: 'destructive' });
      setShoot(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isPaid = useMemo(() => {
    if (!shoot?.payment) return false;
    return (shoot.payment.totalPaid ?? 0) >= (shoot.payment.totalQuote ?? 0);
  }, [shoot]);

  const statusKey = normalizeStatusKey(shoot?.workflowStatus || shoot?.status);
  const statusCfg = statusBadgeMap[statusKey] || { label: statusKey || 'Unknown', variant: 'outline' as const };

  const heroImage = useMemo(() => {
    const firstMedia = resolvePreviewUrl(shoot?.heroImage);
    return firstMedia || '/placeholder.svg';
  }, [shoot]);

  const privateShareLink = useMemo(() => {
    if (!shoot?.tourLinks) return null;
    const links = shoot.tourLinks as Record<string, string | undefined>;
    return (
      links.branded ||
      links.mls ||
      links.genericMls ||
      links.matterport_branded ||
      links.iguide_branded ||
      links.matterport ||
      links.iGuide ||
      null
    );
  }, [shoot]);

  const hasTour = Boolean(privateShareLink);
  const isDelivered = statusKey === 'delivered';
  const canGoPublic = Boolean(shoot && isDelivered && isPaid && hasTour);
  const primaryActionLabel = !isPaid ? 'Resolve Payment' : !hasTour ? 'Add Tour' : 'Share Private Link';
  const goPublicHint = !canGoPublic
    ? 'Complete delivery, payment, and tour readiness before going public.'
    : 'Go public flow is not connected yet.';

  const handlePrimaryAction = () => {
    if (!shoot) return;
    if (!isPaid) {
      navigate(`/shoots/${shoot.id}?action=pay`);
      return;
    }
    if (!hasTour) {
      navigate(`/shoots/${shoot.id}#tour`);
      return;
    }
    if (privateShareLink) {
      window.open(privateShareLink, '_blank', 'noopener,noreferrer');
      return;
    }
    toast({
      title: 'Link unavailable',
      description: 'Add a branded tour link to share this listing.',
    });
  };

  const handleGoPublic = () => {
    if (!canGoPublic) return;
    toast({
      title: 'Not implemented',
      description: 'Public release flow is not connected yet.',
    });
  };

  const handleGenerateShareLink = async () => {
    if (!shoot) return;
    try {
      setIsGeneratingShareLink(true);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/generate-share-link`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to generate share link' }));
        throw new Error(errorData.error || 'Failed to generate share link');
      }

      const data = await res.json();
      await navigator.clipboard.writeText(data.share_link);
      toast({ title: 'Share link generated!', description: 'Link copied to clipboard. Lifetime link.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to generate share link', variant: 'destructive' });
    } finally {
      setIsGeneratingShareLink(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <PageHeader
            badge="Exclusive"
            title="Private Exclusive Listing"
            description="Loading listing…"
          />
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!shoot) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <PageHeader
            badge="Exclusive"
            title="Private Exclusive Listing"
            description="We couldn’t load this listing."
          />
          <Button variant="outline" onClick={() => navigate('/portal')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Exclusive Listings
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate('/portal')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Private Exclusive Listing</div>
                <div className="font-display text-2xl tracking-tight">Hidden from public discovery</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Lock className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">Private mode enabled</div>
              <div className="text-xs text-muted-foreground">
                This property is currently private and invisible to MLS & public portals.
              </div>
            </div>
          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-12 overflow-hidden border-border/70 bg-card/50 backdrop-blur-sm">
              <div className="relative h-[340px] w-full overflow-hidden bg-muted">
                <img
                  src={heroImage}
                  alt={buildListingAlias(shoot.location?.fullAddress || shoot.location?.address)}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                {!isPaid && (
                  <div className="absolute top-4 left-4">
                    <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/90 text-black shadow">
                      Payment Required to remove watermark
                    </div>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="text-white">
                    <div className="font-display text-2xl leading-tight">
                      {buildListingAlias(shoot.location?.fullAddress || shoot.location?.address)}
                    </div>
                    <div className="text-white/80 text-sm">
                      {shoot.location?.city}, {shoot.location?.state} {shoot.location?.zip}
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-5 space-y-4">
                <div className="text-sm text-muted-foreground">
                  Ref ID: <span className="text-foreground font-medium">{shoot.id}</span>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="border-border/70 bg-background/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Visibility</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                      <div>Visible to assigned Client / Rep and Admin team.</div>
                      <div className="text-foreground">
                        <span className="font-medium">Client:</span> {shoot.client?.name || 'Unknown'}
                      </div>
                      <div className="text-foreground">
                        <span className="font-medium">Photographer:</span> {shoot.photographer?.name || 'Unassigned'}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 bg-background/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Pre‑Market Readiness</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Delivered</span>
                        <span className="text-foreground font-medium">{statusKey === 'delivered' ? 'Yes' : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Payment</span>
                        <span className={isPaid ? 'text-foreground font-medium' : 'text-destructive font-medium'}>
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tour</span>
                        <span className="text-foreground font-medium">
                          {shoot.tourLinks?.matterport_branded || shoot.tourLinks?.iguide_branded || shoot.tourLinks?.matterport || shoot.tourLinks?.iGuide
                            ? 'Available'
                            : '—'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

          </div>
      </div>
    </DashboardLayout>
  );
}
