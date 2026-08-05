import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getBathroomMetricDisplay } from '@/utils/shootPropertyDisplay';
import { transformShootFromApi, type ApiShoot } from '@/context/shootNormalization';

type ExclusiveListingShoot = ShootData & {
  bedrooms?: string | number | null;
  bathrooms?: string | number | null;
  sqft?: string | number | null;
  price?: string | number | null;
  mls_number?: string | number | null;
  floorplans?: unknown[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const firstString = (...values: unknown[]): string | undefined => {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return typeof value === 'string' ? value : undefined;
};

const listingValue = (...values: unknown[]): string | number | null | undefined => {
  for (const value of values) {
    if (value === null) return null;
    if (typeof value === 'string' || typeof value === 'number') return value;
  }
  return undefined;
};

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

const normalizeFloorplanLinks = (shoot?: ExclusiveListingShoot | null): Array<{ label: string; url: string }> => {
  const rawItems = [
    ...(Array.isArray(shoot?.cubicasaFloorplans) ? shoot.cubicasaFloorplans : []),
    ...(Array.isArray(shoot?.cubicasa_floorplans) ? shoot.cubicasa_floorplans : []),
    ...(Array.isArray(shoot?.iguide_floorplans) ? shoot.iguide_floorplans : []),
    ...(Array.isArray(shoot?.floorplans) ? shoot.floorplans : []),
  ];

  const seen = new Set<string>();

  return rawItems
    .map((item, index) => {
      if (typeof item === 'string') {
        return { label: `Floor Plan ${index + 1}`, url: item };
      }

      const itemRecord = asRecord(item);
      const url = firstString(
        itemRecord.url,
        itemRecord.download_url,
        itemRecord.downloadUrl,
        itemRecord.pdf_url,
        itemRecord.pdfUrl,
        itemRecord.image_url,
        itemRecord.imageUrl,
        itemRecord.href,
        itemRecord.path,
      );

      if (!url) return null;

      return {
        label: firstString(itemRecord.label, itemRecord.name, itemRecord.title, itemRecord.type)
          || `Floor Plan ${index + 1}`,
        url,
      };
    })
    .filter((item): item is { label: string; url: string } => Boolean(item?.url))
    .map((item) => ({ ...item, url: resolvePreviewUrl(item.url) || item.url }))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
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

  const [shoot, setShoot] = useState<ExclusiveListingShoot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);

  const loadShoot = useCallback(async () => {
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

      const json: unknown = await res.json();
      const jsonRecord = asRecord(json);
      const rawShoot = asRecord(jsonRecord.data ?? json);
      if (rawShoot.id === undefined || rawShoot.id === null) throw new Error('Listing data is invalid');
      const propertyDetails = asRecord(rawShoot.property_details ?? rawShoot.propertyDetails);
      const shootData: ExclusiveListingShoot = {
        ...transformShootFromApi(rawShoot as ApiShoot),
        bedrooms: listingValue(rawShoot.bedrooms, propertyDetails.bedrooms, propertyDetails.beds),
        bathrooms: listingValue(rawShoot.bathrooms, propertyDetails.bathrooms, propertyDetails.baths),
        sqft: listingValue(rawShoot.sqft, propertyDetails.sqft, propertyDetails.squareFeet),
        price: listingValue(rawShoot.price, propertyDetails.price),
        mls_number: listingValue(rawShoot.mls_number, propertyDetails.mls_number, propertyDetails.mlsNumber),
        floorplans: Array.isArray(rawShoot.floorplans) ? rawShoot.floorplans : undefined,
      };
      setShoot(shootData);
    } catch (error: unknown) {
      console.error(error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to load listing', variant: 'destructive' });
      setShoot(null);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadShoot();
  }, [loadShoot]);

  const statusKey = normalizeStatusKey(shoot?.workflowStatus || shoot?.status);
  const statusCfg = statusBadgeMap[statusKey] || { label: statusKey || 'Unknown', variant: 'outline' as const };

  const heroImage = useMemo(() => {
    const firstMedia = resolvePreviewUrl(shoot?.heroImage);
    return firstMedia || '/placeholder.svg';
  }, [shoot]);

  const bathroomDisplay = useMemo(() => {
    return getBathroomMetricDisplay(shoot?.bathrooms);
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

  const floorplanLinks = useMemo(() => normalizeFloorplanLinks(shoot), [shoot]);

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
        const errorData: unknown = await res.json().catch(() => null);
        throw new Error(firstString(asRecord(errorData).error) || 'Failed to generate share link');
      }

      const data: unknown = await res.json();
      const shareLink = firstString(asRecord(data).share_link);
      if (!shareLink) throw new Error('Share link response is invalid');
      await navigator.clipboard.writeText(shareLink);
      toast({ title: 'Share link generated!', description: 'Link copied to clipboard. Lifetime link.' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate share link', variant: 'destructive' });
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
                    {shoot.listingType && (
                      <Badge className={`${
                        shoot.listingType === 'for_rent'
                          ? 'bg-blue-500 hover:bg-blue-600'
                          : 'bg-green-500 hover:bg-green-600'
                      } text-white border-0`}>
                        <Tag className="h-3 w-3 mr-1" />
                        {shoot.listingType === 'for_rent' ? 'For Rent' : 'For Sale'}
                      </Badge>
                    )}
                    {shoot.price && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground">Price</div>
                          <div className="font-medium">${Number(shoot.price).toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {(shoot.bedrooms || shoot.bathrooms || shoot.sqft || shoot.price || shoot.mls_number) && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-3 text-sm font-medium">Property Details</div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {shoot.bedrooms && (
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Beds</div>
                            <div className="font-medium">{shoot.bedrooms}</div>
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
                      {shoot.sqft && (
                        <div className="flex items-center gap-2">
                          <Ruler className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Sq Ft</div>
                            <div className="font-medium">{Number(shoot.sqft).toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                      {shoot.price && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-xs text-muted-foreground">Price</div>
                            <div className="font-medium">${Number(shoot.price).toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {shoot.mls_number && (
                      <div className="mt-3 border-t pt-3">
                        <div className="text-xs text-muted-foreground">MLS #</div>
                        <div className="font-medium">{shoot.mls_number}</div>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                {floorplanLinks.length > 0 && (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Floor Plans
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {floorplanLinks.map((floorplan, index) => (
                          <Button
                            key={`${floorplan.url}-${index}`}
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => window.open(floorplan.url, '_blank', 'noopener,noreferrer')}
                          >
                            {floorplan.label}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Separator />
                  </>
                )}

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
