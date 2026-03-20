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
  Clock,
  X,
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

const isHtml = (v: string) => v.includes('<') && v.includes('>');

const extractUrlFromHtml = (html: string): string | null => {
  const match = html.match(/src=["']([^"']+)["']/i);
  return match?.[1] || null;
};

const pickUrl = (raw: string | undefined | null): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  if (isHtml(v)) return extractUrlFromHtml(v);
  return v;
};

const extractBrandedTourUrl = (tourLinks: any, shootId?: string): string | null => {
  if (!tourLinks || typeof tourLinks !== 'object') return null;

  // Flat top-level keys
  const flatBranded = pickUrl(tourLinks.branded) || pickUrl(tourLinks.branded_embed);
  if (flatBranded) return flatBranded;

  // Embeds array (most common structure from API)
  const embeds = tourLinks.embeds;
  if (Array.isArray(embeds) && embeds.length > 0) {
    for (const embed of embeds) {
      const url = pickUrl(embed?.branded) || pickUrl(embed?.branded_embed) || pickUrl(embed?.url);
      if (url) return url;
    }
  }

  // Other branded-related keys
  const matterport = pickUrl(tourLinks.matterport_branded) || pickUrl(tourLinks.iguide_branded) || pickUrl(tourLinks.matterport);
  if (matterport) return matterport;

  // Fallback: if tour_links has any embeds at all, open the app's branded page
  if (shootId && Array.isArray(embeds) && embeds.length > 0) {
    return `/tour/branded?shootId=${shootId}`;
  }

  return null;
};

const PrivateListingPortal = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [listings, setListings] = useState<PrivateListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deliveredLoading, setDeliveredLoading] = useState(false);
  const [deliveredSearch, setDeliveredSearch] = useState('');
  const [deliveredShoots, setDeliveredShoots] = useState<any[]>([]);
  const [selectedShootIds, setSelectedShootIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPrivateListings();
  }, []);

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
      const response = await fetch(
        `${API_BASE_URL}/api/shoots?tab=delivered&private_listing=1&no_cache=1&per_page=200`,
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
    const branded = extractBrandedTourUrl(listing.tourLinks, listing.id);
    if (branded) {
      window.open(branded, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: 'Tour Coming Soon',
        description: 'The branded agent tour for this property is not yet available. Check back soon.',
      });
    }
  };

  // ─── Grid Card ─────────────────────────────────────────────
  const renderGridCard = (listing: PrivateListing) => {
    const heroUrl = resolvePreviewUrl(listing.heroImage) || '/placeholder.svg';
    const hasTour = !!extractBrandedTourUrl(listing.tourLinks, listing.id);

    return (
      <Card
        key={listing.id}
        className="group overflow-hidden border-border/60 bg-card/60 backdrop-blur-sm cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5"
        onClick={() => handleCardClick(listing)}
      >
        {/* Hero Image */}
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={heroUrl}
            alt={listing.address}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Private Exclusive badge */}
          <div className="absolute top-3 left-3">
            <Badge variant="outline" className="border-white/20 bg-black/40 text-white backdrop-blur-sm text-[10px] px-2 py-0.5">
              <Lock className="h-2.5 w-2.5 mr-1" />
              Private Exclusive
            </Badge>
          </div>

          {/* Tour indicator */}
          <div className="absolute top-3 right-3">
            {hasTour ? (
              <div className="h-7 w-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-colors group-hover:bg-primary/80">
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            ) : (
              <div className="h-7 w-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/60">
                <Clock className="h-3.5 w-3.5" />
              </div>
            )}
          </div>

          {/* Price overlay */}
          {listing.price && (
            <div className="absolute bottom-3 right-3">
              <span className="text-white font-semibold text-lg drop-shadow-md">
                {formatPrice(listing.price)}
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <CardContent className="p-4 space-y-3">
          {/* Address */}
          <div>
            <h3 className="font-semibold text-sm leading-tight truncate">
              {listing.address}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{listing.city}, {listing.state} {listing.zip}</span>
            </div>
          </div>

          {/* Property Details */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {listing.bedrooms && (
              <div className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5" />
                <span>{listing.bedrooms} Bed</span>
              </div>
            )}
            {listing.bathrooms && (
              <div className="flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" />
                <span>{listing.bathrooms} Bath</span>
              </div>
            )}
            {listing.sqft && (
              <div className="flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" />
                <span>{listing.sqft.toLocaleString()} sqft</span>
              </div>
            )}
          </div>

          {/* Client / Agent */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
            <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{listing.client.name}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ─── List Row ──────────────────────────────────────────────
  const renderListRow = (listing: PrivateListing) => {
    const heroUrl = resolvePreviewUrl(listing.heroImage) || '/placeholder.svg';
    const hasTour = !!extractBrandedTourUrl(listing.tourLinks, listing.id);

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
          {hasTour ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
              <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </div>
          ) : (
            <div className="absolute bottom-1 right-1">
              <div className="h-5 w-5 rounded-full bg-black/40 flex items-center justify-center">
                <Clock className="h-2.5 w-2.5 text-white/70" />
              </div>
            </div>
          )}
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
