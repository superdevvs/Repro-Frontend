import React, { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  Home,
  Search,
  MapPin,
  Lock,
  Plus,
  LayoutGrid,
  List,
  BedDouble,
  Bath,
  Ruler,
  User,
  ExternalLink,
  X,
  Globe,
} from 'lucide-react';
import { API_BASE_URL } from '@/config/env';

interface PrivateListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
  heroImage?: string;
  scheduledDate?: string;
  completedDate?: string;
  client: {
    name: string;
    email?: string;
  };
  photographer?: {
    name: string;
  };
  services: string[];
  status: string;
  payment?: {
    totalPaid?: number;
    totalQuote?: number;
  };
  tourLinks?: Record<string, any>;
  isPrivateListing: boolean;
  listing_type?: 'for_sale' | 'for_rent';
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  price?: number;
  mls_number?: string;
}

type ListingTone = {
  surface: string;
  edge: string;
  border: string;
  shadow: string;
};

const DEFAULT_LISTING_TONE: ListingTone = {
  surface: 'rgba(24, 40, 29, 0.92)',
  edge: 'rgba(14, 24, 18, 0.98)',
  border: 'rgba(255, 255, 255, 0.18)',
  shadow: 'rgba(8, 12, 9, 0.42)',
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

const formatPrice = (price: number | undefined | null): string => {
  if (!price) return '';
  return `$${Number(price).toLocaleString()}`;
};

const getBrandedTourUrl = (shootId: string): string => {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/tour/branded?shootId=${encodeURIComponent(shootId)}`;
};

const clampColorChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const buildListingTone = (red: number, green: number, blue: number): ListingTone => {
  const darken = (factor: number) => ({
    red: clampColorChannel(red * factor),
    green: clampColorChannel(green * factor),
    blue: clampColorChannel(blue * factor),
  });

  const surface = darken(0.48);
  const edge = darken(0.28);
  const border = darken(0.9);
  const shadow = darken(0.42);

  return {
    surface: `rgba(${surface.red}, ${surface.green}, ${surface.blue}, 0.94)`,
    edge: `rgba(${edge.red}, ${edge.green}, ${edge.blue}, 0.98)`,
    border: `rgba(${border.red}, ${border.green}, ${border.blue}, 0.34)`,
    shadow: `rgba(${shadow.red}, ${shadow.green}, ${shadow.blue}, 0.42)`,
  };
};

const sampleListingTone = async (src: string): Promise<ListingTone> => {
  if (typeof window === 'undefined') return DEFAULT_LISTING_TONE;

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });

        if (!context) {
          resolve(DEFAULT_LISTING_TONE);
          return;
        }

        const width = 28;
        const height = 28;
        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);

        const startY = Math.floor(height * 0.64);
        const data = context.getImageData(0, startY, width, height - startY).data;

        let red = 0;
        let green = 0;
        let blue = 0;
        let pixels = 0;

        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3];
          if (alpha < 40) continue;
          red += data[index];
          green += data[index + 1];
          blue += data[index + 2];
          pixels += 1;
        }

        if (!pixels) {
          resolve(DEFAULT_LISTING_TONE);
          return;
        }

        resolve(buildListingTone(red / pixels, green / pixels, blue / pixels));
      } catch {
        resolve(DEFAULT_LISTING_TONE);
      }
    };

    image.onerror = () => resolve(DEFAULT_LISTING_TONE);
    image.src = src;
  });
};

const ExclusiveListingGridCard = ({
  listing,
  onOpen,
}: {
  listing: PrivateListing;
  onOpen: (listing: PrivateListing) => void;
}) => {
  const heroUrl = resolvePreviewUrl(listing.heroImage) || '/placeholder.svg';
  const [tone, setTone] = useState<ListingTone>(DEFAULT_LISTING_TONE);

  useEffect(() => {
    let isActive = true;

    setTone(DEFAULT_LISTING_TONE);
    sampleListingTone(heroUrl).then((nextTone) => {
      if (isActive) {
        setTone(nextTone);
      }
    });

    return () => {
      isActive = false;
    };
  }, [heroUrl]);

  const metrics = [
    listing.sqft
      ? {
          value: listing.sqft.toLocaleString(),
          label: 'Sq Ft',
        }
      : null,
    listing.bedrooms
      ? {
          value: String(listing.bedrooms),
          label: listing.bedrooms === 1 ? 'Bedroom' : 'Bedrooms',
        }
      : null,
    listing.bathrooms
      ? {
          value: String(listing.bathrooms),
          label: listing.bathrooms === 1 ? 'Bathroom' : 'Bathrooms',
        }
      : null,
  ].filter(Boolean) as Array<{ value: string; label: string }>;

  const location = [listing.city, listing.state].filter(Boolean).join(', ');
  const locationLine = [location, listing.zip].filter(Boolean).join(' ');
  const listingTypeLabel =
    listing.listing_type === 'for_rent'
      ? 'For Rent'
      : listing.listing_type === 'for_sale'
        ? 'For Sale'
        : null;

  return (
    <Card
      key={listing.id}
      className="group cursor-pointer overflow-hidden rounded-[30px] border-0 bg-transparent text-white transition-all duration-300 hover:-translate-y-1"
      onClick={() => onOpen(listing)}
      style={{
        boxShadow: `0 28px 60px -34px ${tone.shadow}`,
      }}
    >
      <div className="relative aspect-[4/5] min-h-[360px] overflow-hidden rounded-[30px] bg-[#101611]">
        <img
          src={heroUrl}
          alt={listing.address}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
        <div
          className="absolute inset-x-0 bottom-0 h-[58%]"
          style={{
            background: `linear-gradient(180deg, rgba(8, 12, 10, 0) 0%, rgba(8, 12, 10, 0.16) 16%, ${tone.surface} 50%, ${tone.edge} 100%)`,
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,6,0.08)_0%,rgba(5,7,6,0)_26%,rgba(5,7,6,0.1)_100%)]" />

        <div className="relative flex h-full flex-col p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <Badge
              variant="outline"
              className="rounded-full border-white/18 bg-white/88 px-3 py-1.5 text-[11px] font-semibold tracking-[0.02em] text-slate-900 shadow-sm backdrop-blur-sm"
            >
              <Lock className="mr-1.5 h-3 w-3" />
              Exclusive Listing
            </Badge>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-black/18 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/92 backdrop-blur-sm transition-colors duration-300 group-hover:bg-black/28">
              <span>Open</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          </div>

          <div className="mt-auto space-y-4">
            {listing.price && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/60">
                  List Price
                </p>
                <p className="text-[1.95rem] font-semibold leading-none tracking-[-0.05em] text-white">
                  {formatPrice(listing.price)}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <h3 className="max-w-[18ch] text-xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[1.6rem]">
                {listing.address}
              </h3>
              {locationLine && (
                <p className="max-w-[24ch] text-sm leading-relaxed text-white/76">
                  {locationLine}
                </p>
              )}
            </div>

            {metrics.length > 0 && (
              <div
                className="grid gap-3 border-t pt-4"
                style={{
                  borderColor: tone.border,
                  gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))`,
                }}
              >
                {metrics.map((metric, index) => (
                  <div
                    key={metric.label}
                    className={`min-w-0 ${index > 0 ? 'border-l pl-3' : ''}`}
                    style={index > 0 ? { borderColor: tone.border } : undefined}
                  >
                    <p className="truncate text-base font-semibold leading-none tracking-[-0.03em] text-white">
                      {metric.value}
                    </p>
                    <p className="mt-1 truncate text-[11px] uppercase tracking-[0.2em] text-white/58">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div
              className="flex items-center justify-between gap-3 border-t pt-3 text-sm text-white/72"
              style={{ borderColor: tone.border }}
            >
              <p className="min-w-0 truncate">
                By <span className="font-medium text-white">{listing.client.name}</span>
              </p>
              {listingTypeLabel && (
                <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.22em] text-white/54">
                  {listingTypeLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const PrivateListingPortal = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [listings, setListings] = useState<PrivateListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [listingScope, setListingScope] = useState<'mine' | 'all'>('all');

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deliveredLoading, setDeliveredLoading] = useState(false);
  const [deliveredSearch, setDeliveredSearch] = useState('');
  const [deliveredShoots, setDeliveredShoots] = useState<any[]>([]);
  const [selectedShootIds, setSelectedShootIds] = useState<Set<string>>(new Set());
  const isClient = role === 'client';

  useEffect(() => {
    fetchPrivateListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingScope, role]);

  useEffect(() => {
    if (!addDialogOpen) return;
    fetchDeliveredShoots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDialogOpen]);

  const filteredListings = useMemo(() => {
    if (searchQuery.trim() === '') return listings;
    const query = searchQuery.toLowerCase().replace(/[$,]/g, '');
    return listings.filter((listing) => {
      const addressMatch = listing.fullAddress.toLowerCase().includes(query);
      const cityMatch = listing.city.toLowerCase().includes(query);
      const stateMatch = listing.state.toLowerCase().includes(query);
      const zipMatch = listing.zip.includes(query);
      const clientMatch = listing.client.name.toLowerCase().includes(query);
      const priceMatch = listing.price ? String(listing.price).includes(query) : false;
      return addressMatch || cityMatch || stateMatch || zipMatch || clientMatch || priceMatch;
    });
  }, [searchQuery, listings]);

  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
      const tsA = Date.parse(a.completedDate || a.scheduledDate || '') || 0;
      const tsB = Date.parse(b.completedDate || b.scheduledDate || '') || 0;
      return tsB - tsA;
    });
  }, [filteredListings]);

  const fetchPrivateListings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const params = new URLSearchParams({
        tab: 'delivered',
        private_listing: '1',
        no_cache: '1',
        per_page: '200',
      });

      if (isClient) {
        params.set('listing_scope', listingScope);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/shoots?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch listings');

      const data = await response.json();
      const shoots = data.data || data || [];

      const formattedListings: PrivateListing[] = shoots
        .filter((shoot: any) => shoot.is_private_listing || shoot.isPrivateListing)
        .map((shoot: any) => ({
          id: String(shoot.id),
          address: shoot.address || shoot.location?.address || '',
          city: shoot.city || shoot.location?.city || '',
          state: shoot.state || shoot.location?.state || '',
          zip: shoot.zip || shoot.location?.zip || '',
          fullAddress: shoot.location?.fullAddress || shoot.fullAddress ||
            `${shoot.address || ''}, ${shoot.city || ''}, ${shoot.state || ''} ${shoot.zip || ''}`.trim(),
          heroImage: shoot.heroImage || shoot.hero_image || undefined,
          scheduledDate: shoot.scheduledDate || shoot.scheduled_date,
          completedDate: shoot.completedDate || shoot.completed_date,
          client: {
            name: shoot.client?.name || 'Unknown',
            email: shoot.client?.email,
          },
          photographer: shoot.photographer ? {
            name: shoot.photographer.name || 'Unassigned',
          } : undefined,
          services: Array.isArray(shoot.services) ? shoot.services : [],
          status: shoot.status || shoot.workflow_status || 'unknown',
          payment: shoot.payment ? {
            totalPaid: shoot.payment.totalPaid ?? shoot.payment.total_paid,
            totalQuote: shoot.payment.totalQuote ?? shoot.payment.total_quote,
          } : {
            totalPaid: shoot.total_paid,
            totalQuote: shoot.total_quote,
          },
          tourLinks: shoot.tourLinks || shoot.tour_links || {},
          isPrivateListing: shoot.is_private_listing || shoot.isPrivateListing || false,
          listing_type: shoot.listing_type || shoot.listingType || undefined,
          bedrooms: shoot.bedrooms || shoot.property_details?.bedrooms || undefined,
          bathrooms: shoot.bathrooms || shoot.property_details?.bathrooms || undefined,
          sqft: shoot.sqft || shoot.property_details?.sqft || undefined,
          price: shoot.price || shoot.property_details?.price || undefined,
          mls_number: shoot.mls_number || shoot.mls_id || undefined,
        }));

      setListings(formattedListings);
    } catch (error: any) {
      console.error('Error fetching private listings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load private listings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveredShoots = async () => {
    try {
      setDeliveredLoading(true);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots?tab=delivered&no_cache=1&per_page=200`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch delivered shoots');

      const json = await res.json();
      const items = json.data || json || [];
      const normalized = Array.isArray(items) ? items : [];

      const notPrivate = normalized.filter((s: any) => !(s?.is_private_listing || s?.isPrivateListing));
      setDeliveredShoots(notPrivate);
    } catch (e: any) {
      console.error('Error fetching delivered shoots', e);
      toast({
        title: 'Error',
        description: e?.message || 'Failed to load delivered shoots',
        variant: 'destructive',
      });
    } finally {
      setDeliveredLoading(false);
    }
  };

  const toggleShootSelected = (id: string) => {
    setSelectedShootIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelectedToExclusive = async () => {
    const ids = Array.from(selectedShootIds);
    if (!ids.length) {
      toast({
        title: 'Select a shoot',
        description: 'Pick at least one delivered shoot to add.',
      });
      return;
    }

    try {
      setDeliveredLoading(true);
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');

      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`${API_BASE_URL}/api/shoots/${id}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ is_private_listing: true }),
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => null);
            const msg = errJson?.message || `Server ${res.status}`;
            throw new Error(msg);
          }

          queryClient.setQueryData(['shoot', id], (prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              isPrivateListing: true,
              is_private_listing: true,
            };
          });
          queryClient.invalidateQueries({ queryKey: ['shoot', id] });
        })
      );

      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failed.length) {
        toast({
          title: 'Some listings failed',
          description: failed[0]?.reason?.message || 'One or more shoots could not be added.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Added to Exclusive Listings',
          description: `${ids.length} shoot(s) marked as Private Exclusive.`,
        });
      }

      setAddDialogOpen(false);
      setDeliveredSearch('');
      setSelectedShootIds(new Set());
      fetchPrivateListings();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message || 'Failed to add listings',
        variant: 'destructive',
      });
    } finally {
      setDeliveredLoading(false);
    }
  };

  const handleCardClick = (listing: PrivateListing) => {
    const url = getBrandedTourUrl(listing.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ─── Grid Card ─────────────────────────────────────────────
  const renderGridCard = (listing: PrivateListing) => {
    return <ExclusiveListingGridCard key={listing.id} listing={listing} onOpen={handleCardClick} />;
  };

  // ─── List Row ──────────────────────────────────────────────
  const renderListRow = (listing: PrivateListing) => {
    const heroUrl = resolvePreviewUrl(listing.heroImage) || '/placeholder.svg';
    return (
      <div
        key={listing.id}
        className="group flex items-center gap-4 p-3 sm:p-4 rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 hover:bg-accent/30"
        onClick={() => handleCardClick(listing)}
      >
        {/* Thumbnail */}
        <div className="relative h-16 w-24 sm:h-20 sm:w-32 flex-shrink-0 rounded-md overflow-hidden bg-muted">
          <img
            src={heroUrl}
            alt={listing.address}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
            <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{listing.address}</h3>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{listing.city}, {listing.state} {listing.zip}</span>
              </div>
            </div>
            {listing.price && (
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                {formatPrice(listing.price)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {listing.bedrooms && (
              <div className="flex items-center gap-1">
                <BedDouble className="h-3 w-3" />
                <span>{listing.bedrooms} Bed</span>
              </div>
            )}
            {listing.bathrooms && (
              <div className="flex items-center gap-1">
                <Bath className="h-3 w-3" />
                <span>{listing.bathrooms} Bath</span>
              </div>
            )}
            {listing.sqft && (
              <div className="flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                <span>{listing.sqft.toLocaleString()} sqft</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1 ml-auto">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[140px]">{listing.client.name}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 px-2 pt-3 pb-3 sm:space-y-6 sm:p-6">
          <PageHeader
            badge="Exclusive"
            title="Exclusive Listings"
            description="Private, pre-market properties — invitation only"
          />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden border-border/60 animate-pulse">
                <div className="aspect-[16/10] bg-muted" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="flex gap-3">
                    <div className="h-3 bg-muted rounded w-16" />
                    <div className="h-3 bg-muted rounded w-16" />
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Main Render ───────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-3 sm:space-y-6 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <PageHeader
            badge="Exclusive"
            title="Exclusive Listings"
            description="Private, pre-market properties — invitation only"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Listing</span>
            </Button>
          </div>
        </div>

        {isClient && (
          <div className="inline-flex w-full sm:w-auto items-center rounded-xl border border-border/70 bg-muted/20 p-1">
            <button
              type="button"
              onClick={() => setListingScope('all')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                listingScope === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <Globe className="h-4 w-4" />
              All Listings
            </button>
            <button
              type="button"
              onClick={() => setListingScope('mine')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                listingScope === 'mine'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <User className="h-4 w-4" />
              My Listings
            </button>
          </div>
        )}

        {/* Search + View Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address, city, state, zip, price, or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center border rounded-md overflow-hidden bg-card/50">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Count */}
        {sortedListings.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {sortedListings.length} {sortedListings.length === 1 ? 'listing' : 'listings'}
            {isClient && ` in ${listingScope === 'all' ? 'all listings' : 'my listings'}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="sm:max-w-[680px]">
            <DialogHeader>
              <DialogTitle>Add to Exclusive Listings</DialogTitle>
              <DialogDescription>
                Select delivered shoots and mark them as Private Exclusive.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                placeholder="Search delivered shoots (address, city, client)"
                value={deliveredSearch}
                onChange={(e) => setDeliveredSearch(e.target.value)}
              />

              <div className="border rounded-md overflow-hidden">
                <div className="max-h-[360px] overflow-auto">
                  {deliveredLoading ? (
                    <div className="p-4 text-sm text-muted-foreground">Loading delivered shoots…</div>
                  ) : (
                    (deliveredShoots
                      .filter((s: any) => {
                        if (!deliveredSearch.trim()) return true;
                        const q = deliveredSearch.toLowerCase();
                        const addr = String(s?.location?.fullAddress || s?.fullAddress || s?.address || '').toLowerCase();
                        const city = String(s?.location?.city || s?.city || '').toLowerCase();
                        const client = String(s?.client?.name || '').toLowerCase();
                        return addr.includes(q) || city.includes(q) || client.includes(q);
                      })
                      .slice(0, 80)
                    ).map((s: any) => {
                      const id = String(s?.id);
                      const checked = selectedShootIds.has(id);
                      const title = s?.location?.fullAddress || s?.fullAddress || `${s?.address || ''}, ${s?.city || ''}`;
                      const subtitle = `${s?.client?.name || 'Unknown'} · ${String(s?.workflowStatus || s?.workflow_status || s?.status || '').toLowerCase()}`;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleShootSelected(id)}
                          className={
                            `w-full text-left px-4 py-3 border-b border-border/60 transition-colors ` +
                            (checked ? 'bg-accent/40' : 'hover:bg-accent/20')
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{title}</div>
                              <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                            </div>
                            <div className="flex-shrink-0 text-xs text-muted-foreground">
                              {checked ? 'Selected' : 'Select'}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}

                  {!deliveredLoading && deliveredShoots.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">No delivered shoots available to add.</div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addSelectedToExclusive} disabled={deliveredLoading}>
                Add Selected
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Empty State */}
        {sortedListings.length === 0 ? (
          <Card>
            <CardContent className="py-24 text-center">
              <Home className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No exclusive listings found</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : isClient && listingScope === 'mine'
                    ? 'You have not marked any of your delivered shoots as Private Exclusive yet.'
                    : 'Private listings are created by marking a delivered shoot as Private Exclusive.'}
              </p>
              {!searchQuery && (
                <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
                  <Button
                    variant="default"
                    onClick={() => navigate('/shoot-history')}
                  >
                    View Delivered Shoots
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          /* ─── Grid View ─── */
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {sortedListings.map((listing) => renderGridCard(listing))}
          </div>
        ) : (
          /* ─── List View ─── */
          <div className="space-y-2">
            {sortedListings.map((listing) => renderListRow(listing))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PrivateListingPortal;
