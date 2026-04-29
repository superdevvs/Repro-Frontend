import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardRouteSkeleton } from '@/components/layout/DashboardRouteSkeleton';
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
  Home,
  DollarSign,
  Tag,
  Ruler,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary';
import { getBathroomMetricDisplay } from '@/utils/shootPropertyDisplay';

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
      const shootData = (json.data || json) as any;

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

        const paymentSummary = normalizeShootPaymentSummary(shootData);

        if (!shootData.payment) {
          shootData.payment = {
            baseQuote: paymentSummary.baseQuote,
            taxRate: paymentSummary.taxRate,
            taxAmount: paymentSummary.taxAmount,
            totalQuote: paymentSummary.totalQuote,
            totalPaid: paymentSummary.totalPaid,
            lastPaymentDate: paymentSummary.lastPaymentDate,
            lastPaymentType: paymentSummary.lastPaymentType,
          };
        } else {
          shootData.payment = {
            ...shootData.payment,
            baseQuote: paymentSummary.baseQuote,
            taxRate: paymentSummary.taxRate,
            taxAmount: paymentSummary.taxAmount,
            totalQuote: paymentSummary.totalQuote,
            totalPaid: paymentSummary.totalPaid,
            lastPaymentDate: paymentSummary.lastPaymentDate ?? shootData.payment.lastPaymentDate,
            lastPaymentType: paymentSummary.lastPaymentType ?? shootData.payment.lastPaymentType,
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

  const statusKey = normalizeStatusKey(shoot?.workflowStatus || shoot?.status);
  const statusCfg = statusBadgeMap[statusKey] || { label: statusKey || 'Unknown', variant: 'outline' as const };

  const heroImage = useMemo(() => {
    const firstMedia = resolvePreviewUrl(shoot?.heroImage);
    return firstMedia || '/placeholder.svg';
  }, [shoot]);

  const bathroomDisplay = useMemo(() => {
    return getBathroomMetricDisplay((shoot as any)?.bathrooms);
  }, [shoot]);

  const isPaid = useMemo(() => {
    if (!shoot?.payment) return false;
    return (shoot.payment.totalPaid ?? 0) >= (shoot.payment.totalQuote ?? 0);
  }, [shoot]);

  const tourLink = useMemo(() => {
    if (!shoot?.tourLinks) return null;
    const links = shoot.tourLinks as Record<string, string | undefined>;
    return links.branded || links.mls || links.genericMls || links.matterport_branded || links.iguide_branded || links.matterport || links.iGuide || null;
  }, [shoot]);

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
    return <DashboardRouteSkeleton pathname={`/exclusive-listings/${id ?? ''}`} />;
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm text-muted-foreground">
                    Ref ID: <span className="text-foreground font-medium">{shoot.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(shoot as any)?.listing_type && (
                      <Badge className={`${
                        (shoot as any).listing_type === 'for_rent'
                          ? 'bg-blue-500 hover:bg-blue-600'
                          : 'bg-green-500 hover:bg-green-600'
                      } text-white border-0`}>
                        <Tag className="h-3 w-3 mr-1" />
                        {(shoot as any).listing_type === 'for_rent' ? 'For Rent' : 'For Sale'}
                      </Badge>
                    )}
                    {(shoot as any)?.price && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground">Price</div>
                          <div className="font-medium">${Number((shoot as any).price).toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {((shoot as any)?.bedrooms || (shoot as any)?.bathrooms || (shoot as any)?.sqft || (shoot as any)?.price || (shoot as any)?.mls_number) && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-3 text-sm font-medium">Property Details</div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {(shoot as any)?.bedrooms && (
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Beds</div>
                            <div className="font-medium">{(shoot as any).bedrooms}</div>
                          </div>
                        </div>
                      )}
                      {bathroomDisplay && (
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">{bathroomDisplay.label}</div>
                            <div className="font-medium">{bathroomDisplay.value}</div>
                          </div>
                        </div>
                      )}
                      {(shoot as any)?.sqft && (
                        <div className="flex items-center gap-2">
                          <Ruler className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Sq Ft</div>
                            <div className="font-medium">{Number((shoot as any).sqft).toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                      {(shoot as any)?.price && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Price</div>
                            <div className="font-medium">${Number((shoot as any).price).toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {(shoot as any)?.mls_number && (
                      <div className="mt-3 border-t pt-3">
                        <div className="text-xs text-muted-foreground">MLS #</div>
                        <div className="font-medium">{(shoot as any).mls_number}</div>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="border-border/70 bg-background/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Visibility</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
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
                      <CardTitle className="text-sm">Payment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {isPaid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className={isPaid ? 'font-medium text-foreground' : 'font-medium text-destructive'}>
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                      {shoot.payment && (
                        <div className="text-xs">
                          ${Number(shoot.payment.totalPaid ?? 0).toLocaleString()} / ${Number(shoot.payment.totalQuote ?? 0).toLocaleString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/70 bg-background/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Tour</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      {tourLink ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => window.open(tourLink, '_blank', 'noopener,noreferrer')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open Tour
                        </Button>
                      ) : (
                        <div className="text-xs">No tour link available</div>
                      )}
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
