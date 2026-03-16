import React, { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Home, Search, MapPin, Calendar, Camera, Lock, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
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
  tourLinks?: {
    branded?: string;
    mls?: string;
    genericMls?: string;
  };
  isPrivateListing: boolean;
  listing_type?: 'for_sale' | 'for_rent';
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  price?: number;
  mls_number?: string;
}

const buildListingAlias = (listing: PrivateListing) => {
  const raw = listing.address || listing.fullAddress || '';
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

const PrivateListingPortal = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [listings, setListings] = useState<PrivateListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredListings, setFilteredListings] = useState<PrivateListing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredListings(listings);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = listings.filter((listing) => {
        const addressMatch = listing.fullAddress.toLowerCase().includes(query);
        const cityMatch = listing.city.toLowerCase().includes(query);
        const stateMatch = listing.state.toLowerCase().includes(query);
        const zipMatch = listing.zip.includes(query);
        const clientMatch = listing.client.name.toLowerCase().includes(query);
        const servicesMatch = listing.services.some((s) => s.toLowerCase().includes(query));
        return addressMatch || cityMatch || stateMatch || zipMatch || clientMatch || servicesMatch;
      });
      setFilteredListings(filtered);
    }
  }, [searchQuery, listings]);

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
          tourLinks: shoot.tourLinks || {},
          isPrivateListing: shoot.is_private_listing || shoot.isPrivateListing || false,
          listing_type: shoot.listing_type || shoot.listingType || undefined,
          bedrooms: shoot.bedrooms || shoot.property_details?.bedrooms || undefined,
          bathrooms: shoot.bathrooms || shoot.property_details?.bathrooms || undefined,
          sqft: shoot.sqft || shoot.property_details?.sqft || undefined,
          price: shoot.price || shoot.property_details?.price || undefined,
          mls_number: shoot.mls_number || shoot.mls_id || undefined,
        }));

      setListings(formattedListings);
      setFilteredListings(formattedListings);

      if (formattedListings.length && !selectedListingId) {
        setSelectedListingId(formattedListings[0].id);
      }
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      completed: { label: 'Completed', variant: 'default' },
      scheduled: { label: 'Scheduled', variant: 'secondary' },
      booked: { label: 'Booked', variant: 'outline' },
      delivered: { label: 'Delivered', variant: 'default' },
    };

    const config = statusMap[status.toLowerCase()] || { label: status, variant: 'outline' as const };
    return (
      <Badge variant={config.variant} className="capitalize">
        {config.label}
      </Badge>
    );
  };

  const selectedListing = useMemo(() => {
    const id = selectedListingId || (filteredListings[0]?.id ?? null);
    if (!id) return null;
    return filteredListings.find((l) => l.id === id) || listings.find((l) => l.id === id) || null;
  }, [filteredListings, listings, selectedListingId]);

  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
      const tsA = Date.parse(a.completedDate || a.scheduledDate || '') || 0;
      const tsB = Date.parse(b.completedDate || b.scheduledDate || '') || 0;
      return tsB - tsA;
    });
  }, [filteredListings]);

  const activeListingId = selectedListing?.id ?? null;

  const renderListingRow = (listing: PrivateListing) => {
    const active = listing.id === activeListingId;

    return (
      <button
        key={listing.id}
        type="button"
        onClick={() => setSelectedListingId(listing.id)}
        className={
          `w-full text-left px-4 py-3 border-b border-border/60 transition-colors ` +
          (active ? 'bg-accent/40' : 'hover:bg-accent/20')
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium truncate">{buildListingAlias(listing)}</div>
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {listing.city}, {listing.state}
            </div>
            {/* Property details row */}
            {(listing.bedrooms || listing.bathrooms || listing.sqft) && (
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                {listing.bedrooms && <span>{listing.bedrooms} bed</span>}
                {listing.bathrooms && <span>{listing.bathrooms} bath</span>}
                {listing.sqft && <span>{listing.sqft.toLocaleString()} sqft</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground truncate">
            Client: <span className="text-foreground">{listing.client.name}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {listing.completedDate
              ? `Marked · ${format(new Date(listing.completedDate), 'MMM d')}`
              : listing.scheduledDate
                ? `Scheduled · ${format(new Date(listing.scheduledDate), 'MMM d')}`
                : ''}
          </div>
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 px-2 pt-3 pb-3 sm:space-y-6 sm:p-6">
          <PageHeader
            badge="Exclusive"
            title="Exclusive Listings"
            description="Private, pre-market properties — invitation only"
          />
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading listings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-3 sm:space-y-6 sm:p-6">
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
              <Plus className="h-4 w-4 mr-2" />
              Add Listing
            </Button>
          </div>
        </div>

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

          <Card className="border-border/70 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Smart Search (address, city, client, services)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                {searchQuery && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {filteredListings.length === 0 ? (
            <Card>
              <CardContent className="py-24 text-center">
                <Home className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No exclusive listings found</h3>
                <p className="text-muted-foreground">
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
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* LEFT: Exclusive Ledger */}
              <Card className="lg:col-span-4 border-border/70 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">Exclusive Ledger</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {filteredListings.length} {filteredListings.length === 1 ? 'listing' : 'listings'}
                    </div>
                  </div>
                  <CardDescription>
                    Your private, pre-market properties.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[70vh] overflow-auto">
                    {sortedListings.length ? (
                      sortedListings.map((listing) => renderListingRow(listing))
                    ) : (
                      <div className="px-4 py-3 text-xs text-muted-foreground border-b border-border/60">
                        No listings found.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* RIGHT: Property Spotlight */}
              <Card className="lg:col-span-8 overflow-hidden border-border/70 bg-card/50 backdrop-blur-sm">
                <div className="relative h-[360px] w-full overflow-hidden bg-muted">
                  <img
                    src={resolvePreviewUrl(selectedListing?.heroImage) || '/placeholder.svg'}
                    alt={selectedListing ? buildListingAlias(selectedListing) : 'Listing'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <Badge variant="outline" className="border-white/20 bg-black/30 text-white">
                      <Lock className="h-3 w-3 mr-1" />
                      Private Exclusive
                    </Badge>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-white">
                      <div className="font-display text-2xl leading-tight">
                        {selectedListing ? buildListingAlias(selectedListing) : 'Exclusive Listing'}
                      </div>
                      <div className="text-white/80 text-sm">
                        {selectedListing?.city}, {selectedListing?.state}
                      </div>
                    </div>
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {selectedListing ? getStatusBadge(selectedListing.status) : null}
                      <div className="text-xs text-muted-foreground">Ref ID: {selectedListing?.id || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!selectedListing}
                        onClick={() => {
                          if (!selectedListing) return;
                          navigate(`/exclusive-listings/${selectedListing.id}`);
                        }}
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        disabled={!selectedListing}
                        onClick={() => {
                          if (!selectedListing) return;
                          navigate(`/shoots/${selectedListing.id}`);
                        }}
                      >
                        View Shoot
                      </Button>
                      {selectedListing?.tourLinks?.branded && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            window.open(selectedListing.tourLinks!.branded!, '_blank');
                          }}
                        >
                          Open Tour
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="border-border/70 bg-background/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Client</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-2">
                        <div className="text-foreground font-medium truncate">{selectedListing?.client?.name || '—'}</div>
                        <div className="truncate">{selectedListing?.client?.email || ''}</div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 bg-background/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Production</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-2">
                        <div className="flex items-center gap-2">
                          <Camera className="h-3.5 w-3.5" />
                          <span className="truncate">{selectedListing?.photographer?.name || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="truncate">
                            {selectedListing?.scheduledDate
                              ? format(new Date(selectedListing.scheduledDate), 'MMM d, yyyy')
                              : '—'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
      </div>
    </DashboardLayout>
  );
};

export default PrivateListingPortal;
