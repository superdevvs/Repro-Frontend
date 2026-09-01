import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardRouteSkeleton } from '@/components/layout/DashboardRouteSkeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  Plus,
  LayoutGrid,
  List,
  Map as MapIcon,
  User,
  X,
  Globe,
  Eye,
  EyeOff,
} from 'lucide-react';
import { API_BASE_URL } from '@/config/env';
import { getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { ExclusiveListingsShowcase } from '@/components/listings/ExclusiveListingsShowcase';
import { ExclusiveListingGridCard } from '@/components/listings/ExclusiveListingGridCard';
import { useListingPresentation } from '@/hooks/useListingPresentation';
import { MapTabToolbar } from '@/components/listings/MapTabToolbar';
import { SavedViewsMenu } from '@/components/listings/SavedViewsMenu';
import {
  SAVED_VIEWS_KEY,
  parseSavedViews,
  serializeSavedViews,
} from '@/lib/listing-presentation/saved-views';
import type { SavedView } from '@/lib/listing-presentation/types';
import type { PrivateListing } from '@/types/privateListings';
import {
  asListingRecord,
  getErrorMessage,
  getResponseErrorMessage,
  getBrandedTourUrl,
  hasListingCoords,
  formatListingPrice,
  normalizePrivateListing,
  readGeoCache,
  resolveListingPreviewUrl,
  toDeliveredShootOption,
  writeGeoCache,
} from '@/utils/privateListings';
import type { ListingRecord } from '@/utils/privateListings';
import { PrivateListingPortalListRow } from './PrivateListingPortalListRow';

const PrivateListingPortal = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [listings, setListings] = useState<PrivateListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'showcase' | 'grid' | 'list'>('showcase');
  const [listingScope, setListingScope] = useState<'mine' | 'all'>('all');
  const [geoCache, setGeoCache] = useState<Record<string, { lat: number; lng: number }>>(readGeoCache);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() =>
    parseSavedViews(
      typeof window !== 'undefined' ? window.localStorage.getItem(SAVED_VIEWS_KEY) : null,
    ),
  );

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deliveredLoading, setDeliveredLoading] = useState(false);
  const [deliveredSearch, setDeliveredSearch] = useState('');
  const [deliveredShoots, setDeliveredShoots] = useState<ListingRecord[]>([]);
  const [selectedShootIds, setSelectedShootIds] = useState<Set<string>>(new Set());
  const [hideSelectionMode, setHideSelectionMode] = useState(false);
  const [selectedHiddenIds, setSelectedHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const isClient = role === 'client';
  const isAdmin = role === 'admin' || role === 'superadmin';
  const deliveredShootOptions = useMemo(() => {
    const query = deliveredSearch.trim().toLowerCase();
    return deliveredShoots
      .map(toDeliveredShootOption)
      .filter((shoot) => !query || shoot.searchText.includes(query))
      .slice(0, 80);
  }, [deliveredSearch, deliveredShoots]);

  const hiddenListingCount = useMemo(() => {
    return listings.filter((listing) => listing.isListingHidden).length;
  }, [listings]);

  const hasHiddenListings = hiddenListingCount > 0;

  useEffect(() => {
    if (showHidden && !hasHiddenListings) {
      setShowHidden(false);
    }
  }, [hasHiddenListings, showHidden]);

  // Admin hidden-visibility filter only (no text search). This is the base set
  // for both the legacy grid/list pipeline and the Map Tab presentation hook.
  const adminVisibleListings = useMemo(() => {
    return isAdmin && !showHidden
      ? listings.filter((listing) => !listing.isListingHidden)
      : listings;
  }, [isAdmin, showHidden, listings]);

  // Grid/List keep their existing behavior: portal-owned text search + date sort.
  const filteredListings = useMemo(() => {
    if (searchQuery.trim() === '') return adminVisibleListings;
    const query = searchQuery.toLowerCase().replace(/[$,]/g, '');
    return adminVisibleListings.filter((listing) => {
      const addressMatch = listing.fullAddress.toLowerCase().includes(query);
      const cityMatch = listing.city.toLowerCase().includes(query);
      const stateMatch = listing.state.toLowerCase().includes(query);
      const zipMatch = listing.zip.includes(query);
      const clientMatch = listing.client.name.toLowerCase().includes(query);
      const priceMatch = listing.price ? String(listing.price).includes(query) : false;
      return addressMatch || cityMatch || stateMatch || zipMatch || clientMatch || priceMatch;
    });
  }, [adminVisibleListings, searchQuery]);

  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
      const tsA = Date.parse(a.completedDate || a.scheduledDate || '') || 0;
      const tsB = Date.parse(b.completedDate || b.scheduledDate || '') || 0;
      return tsB - tsA;
    });
  }, [filteredListings]);

  // Integration decision (Map Tab / showcase): we feed the presentation hook the
  // geo-augmented, admin-visibility-filtered set WITHOUT the portal's own text
  // search, and let `useListingPresentation` own search + filter + sort. This
  // avoids double-filtering: the portal keeps the admin hidden-listing filter
  // and the geo-cache coordinate augmentation (each ShowcaseListing carries
  // `isPrivateListing`, already present on PrivateListing), while the hook drives
  // searching/filtering/sorting and exposes `displayedListings`. Grid/List views
  // continue to use the portal-owned `sortedListings` above so their behavior is
  // unchanged.
  const showcaseListings = useMemo<PrivateListing[]>(() => {
    return adminVisibleListings.map((listing) => {
      if (hasListingCoords(listing)) return listing;
      const cached = geoCache[listing.fullAddress];
      if (!cached) return listing;
      return {
        ...listing,
        latitude: cached.lat,
        longitude: cached.lng,
        coordsSource: 'cache',
      };
    });
  }, [geoCache, adminVisibleListings]);

  const showcaseGeocodeListings = useMemo(() => {
    if (viewMode !== 'showcase') return [];
    const unique = new Map<string, PrivateListing>();
    for (const listing of adminVisibleListings) {
      if (hasListingCoords(listing) || !listing.fullAddress || geoCache[listing.fullAddress]) continue;
      if (!unique.has(listing.fullAddress)) unique.set(listing.fullAddress, listing);
    }
    return Array.from(unique.values());
  }, [geoCache, adminVisibleListings, viewMode]);

  // Map Tab presentation coordinator: owns active filters, sort, saved views,
  // and the shared selected-listing id; derives displayedListings/summary/
  // suggestions/filterChips client-side (no network calls). Saved views are
  // seeded from localStorage-loaded `savedViews` and written back via setSavedViews.
  const presentation = useListingPresentation({
    listings: showcaseListings,
    searchQuery,
    initialSavedViews: savedViews,
    onSavedViewsChange: setSavedViews,
  });

  // Unique city names offered as city filters in the toolbar's FilterMenu.
  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    for (const listing of showcaseListings) {
      const city = listing.city?.trim();
      if (city) cities.add(city);
    }
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [showcaseListings]);

  useEffect(() => {
    writeGeoCache(geoCache);
  }, [geoCache]);

  // Persist Saved Views on change, mirroring the geo-cache write pattern
  // (R4.7/4.8). Wrapped so localStorage quota/private-mode failures are ignored.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SAVED_VIEWS_KEY, serializeSavedViews(savedViews));
    } catch {
      // Ignore localStorage quota/private-mode failures.
    }
  }, [savedViews]);

  useEffect(() => {
    if (!showcaseGeocodeListings.length) return;
    const unknownListings = showcaseGeocodeListings.slice(0, 6);
    let cancelled = false;

    const geocodeListings = async () => {
      const updates: Record<string, { lat: number; lng: number }> = {};

      for (const listing of unknownListings) {
        try {
          const coords = await getCoordinatesFromAddress(
            listing.address || listing.fullAddress,
            listing.city,
            listing.state,
            listing.zip,
          );
          if (coords && !cancelled) {
            updates[listing.fullAddress] = { lat: coords.lat, lng: coords.lon };
          }
        } catch {
          // Listings without geocodes still remain visible in the rail.
        }
        await new Promise((resolve) => setTimeout(resolve, 450));
      }

      if (!cancelled && Object.keys(updates).length) {
        setGeoCache((current) => ({ ...current, ...updates }));
      }
    };

    geocodeListings();

    return () => {
      cancelled = true;
    };
  }, [showcaseGeocodeListings]);

  const fetchPrivateListings = useCallback(async () => {
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
      if (isAdmin) {
        params.set('include_hidden', '1');
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

      const data: unknown = await response.json();
      const payload = asListingRecord(data).data ?? data;
      const shoots = Array.isArray(payload) ? payload : [];
      const formattedListings = shoots
        .map(normalizePrivateListing)
        .filter((listing): listing is PrivateListing => listing !== null)
        .filter((listing) => listing.isPrivateListing);

      setListings(formattedListings);
    } catch (error: unknown) {
      console.error('Error fetching private listings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load private listings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isClient, listingScope, toast]);

  const fetchDeliveredShoots = useCallback(async () => {
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

      const json: unknown = await res.json();
      const items = asListingRecord(json).data ?? json;
      const normalized = Array.isArray(items) ? items.map(asListingRecord) : [];
      const notPrivate = normalized.filter(
        (shoot) => !(shoot.is_private_listing ?? shoot.isPrivateListing),
      );
      setDeliveredShoots(notPrivate);
    } catch (error: unknown) {
      console.error('Error fetching delivered shoots', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load delivered shoots',
        variant: 'destructive',
      });
    } finally {
      setDeliveredLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchPrivateListings();
    // Keyed on primitives, not `fetchPrivateListings`: its identity follows `toast`,
    // so depending on it refetched `/api/shoots` four times per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingScope, role]);

  useEffect(() => {
    if (addDialogOpen) void fetchDeliveredShoots();
  }, [addDialogOpen, fetchDeliveredShoots]);

  const toggleShootSelected = (id: string) => {
    setSelectedShootIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleListingSelectedForHide = (listing: PrivateListing) => {
    if (listing.isListingHidden) return;
    setSelectedHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(listing.id)) next.delete(listing.id);
      else next.add(listing.id);
      return next;
    });
  };

  const patchListingVisibility = async (id: string, hidden: boolean) => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/api/shoots/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ is_listing_hidden: hidden }),
    });

    if (!res.ok) {
      throw new Error(await getResponseErrorMessage(res));
    }

    queryClient.invalidateQueries({ queryKey: ['shoot', id] });
  };

  const saveHiddenSelections = async () => {
    const ids = Array.from(selectedHiddenIds);
    if (!ids.length) {
      toast({
        title: 'Select listings',
        description: 'Pick at least one property to hide.',
      });
      return;
    }

    try {
      setSavingVisibility(true);
      const results = await Promise.allSettled(ids.map((id) => patchListingVisibility(id, true)));
      const failed = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];

      if (failed.length) {
        toast({
          title: 'Some listings failed',
          description: getErrorMessage(
            failed[0]?.reason,
            'One or more listings could not be hidden.',
          ),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Listings hidden',
          description: `${ids.length} ${ids.length === 1 ? 'property is' : 'properties are'} now hidden from Exclusive Listings.`,
        });
      }

      setHideSelectionMode(false);
      setSelectedHiddenIds(new Set());
      void fetchPrivateListings();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to hide listings'),
        variant: 'destructive',
      });
    } finally {
      setSavingVisibility(false);
    }
  };

  const unhideListing = async (listing: PrivateListing) => {
    try {
      setSavingVisibility(true);
      await patchListingVisibility(listing.id, false);
      toast({
        title: 'Listing unhidden',
        description: `${listing.address || 'This property'} is visible in Exclusive Listings again.`,
      });
      void fetchPrivateListings();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to unhide listing'),
        variant: 'destructive',
      });
    } finally {
      setSavingVisibility(false);
    }
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
            throw new Error(await getResponseErrorMessage(res));
          }

          queryClient.setQueryData<unknown>(['shoot', id], (previous) => {
            if (!previous) return previous;
            return {
              ...asListingRecord(previous),
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
          description: getErrorMessage(failed[0]?.reason, 'One or more shoots could not be added.'),
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
      void fetchPrivateListings();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to add listings'),
        variant: 'destructive',
      });
    } finally {
      setDeliveredLoading(false);
    }
  };

  const handleCardClick = (listing: Pick<PrivateListing, 'id'>) => {
    const url = getBrandedTourUrl(listing.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderGridCard = (listing: PrivateListing) => {
    return (
      <ExclusiveListingGridCard
        key={listing.id}
        listing={listing}
        onOpen={handleCardClick}
        selectionMode={hideSelectionMode}
        selected={selectedHiddenIds.has(listing.id)}
        canManageVisibility={isAdmin}
        savingVisibility={savingVisibility}
        onToggleSelect={toggleListingSelectedForHide}
        onUnhide={unhideListing}
      />
    );
  };

  const clientScopeControl = isClient ? (
    <div
      data-testid="listing-scope-control"
      className={
        viewMode === 'showcase'
          ? 'inline-flex w-full shrink-0 items-center rounded-xl border border-slate-300/80 bg-white/82 p-1 text-slate-950 shadow-xl backdrop-blur-xl sm:w-auto dark:border-white/15 dark:bg-slate-950/72 dark:text-white'
          : 'inline-flex w-full shrink-0 items-center rounded-xl border border-border/70 bg-muted/20 p-1 sm:w-auto'
      }
    >
      <button
        type="button"
        aria-label="Show all listings"
        onClick={() => setListingScope('all')}
        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:flex-none 2xl:px-4 ${
          listingScope === 'all'
            ? 'bg-blue-600 text-white shadow-sm'
            : viewMode === 'showcase'
              ? 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        }`}
      >
        <Globe className="h-4 w-4" />
        <span>All Listings</span>
      </button>
      <button
        type="button"
        aria-label="Show my listings"
        onClick={() => setListingScope('mine')}
        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:flex-none 2xl:px-4 ${
          listingScope === 'mine'
            ? 'bg-blue-600 text-white shadow-sm'
            : viewMode === 'showcase'
              ? 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        }`}
      >
        <User className="h-4 w-4" />
        <span>My Listings</span>
      </button>
    </div>
  ) : null;

  if (loading) {
    return <DashboardRouteSkeleton pathname="/portal" />;
  }

  // ─── Main Render ───────────────────────────────────────────
  return (
    <DashboardLayout hideFooter={viewMode === 'showcase'}>
      <div
        className={
          viewMode === 'showcase'
            ? 'flex min-h-0 flex-col gap-3 px-0 pb-0 pt-2 sm:px-3 sm:pt-0'
            : 'space-y-4 px-2 pb-3 pt-3 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0'
        }
      >
        {/* Header — emphasized title section with the Add Listing / Hide
            controls aligned in a single horizontal group (R9.1, R9.2). */}
        <div className="flex flex-col items-start justify-between gap-4 px-2 pb-2 sm:px-0 md:flex-row md:flex-nowrap">
          <div className="min-w-0 [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:tracking-tight">
            <PageHeader
              badge="Exclusive"
              title="Exclusive Listings"
              description="Private, pre-market properties — invitation only"
            />
          </div>
          <div
            className="flex w-full flex-row flex-nowrap items-center justify-start gap-2 self-start overflow-x-auto pb-1 [&>button]:shrink-0 md:w-auto md:justify-end md:overflow-visible md:pb-0"
            data-testid="listing-header-actions"
          >
            <SavedViewsMenu
              savedViews={presentation.savedViews}
              onApplyView={presentation.applyView}
              onSaveView={presentation.saveView}
              onDeleteView={presentation.deleteView}
            />
            {isAdmin && hideSelectionMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHideSelectionMode(false);
                    setSelectedHiddenIds(new Set());
                  }}
                  disabled={savingVisibility}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveHiddenSelections}
                  disabled={savingVisibility || selectedHiddenIds.size === 0}
                >
                  Save {selectedHiddenIds.size > 0 ? `(${selectedHiddenIds.size})` : ''}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Listing</span>
                </Button>
                {isAdmin && (
                  <>
                    {hasHiddenListings ? (
                      <Button
                        variant={showHidden ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setShowHidden((value) => !value)}
                        disabled={savingVisibility}
                      >
                        {showHidden ? <EyeOff className="h-4 w-4 sm:mr-2" /> : <Eye className="h-4 w-4 sm:mr-2" />}
                        <span className="hidden sm:inline">{showHidden ? 'Hide Hidden' : 'Show Hidden'}</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedHiddenIds(new Set());
                          setHideSelectionMode(true);
                        }}
                        disabled={savingVisibility}
                      >
                        <EyeOff className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Hide</span>
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Controls: the Map Tab (showcase) gets the new SummaryCards +
            MapTabToolbar rendered above it (R5.1, R5.3, R6.3); Grid/List keep
            a compact scope/search/view command row. The toolbar's ViewSwitcher
            and the legacy toggle both drive `viewMode`, so users can move
            between all three views. */}
        {viewMode !== 'showcase' ? (
          <div
            className="flex w-full flex-wrap items-center gap-2 md:flex-nowrap"
            data-testid="listing-browse-toolbar"
          >
            {clientScopeControl}
            <div
              className="relative min-w-[12rem] flex-1 sm:min-w-[16rem] md:min-w-0"
              data-testid="listing-browse-search"
            >
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
            <div
              className="flex shrink-0 items-center overflow-hidden rounded-md border bg-card/50"
              data-testid="listing-browse-view-switcher"
            >
              <button
                type="button"
                onClick={() => setViewMode('showcase')}
                className="p-2 transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
                title="Showcase view"
                aria-label="Showcase view"
              >
                <MapIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                title="List view"
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Count */}
        {viewMode !== 'showcase' && sortedListings.length > 0 && (
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
                    deliveredShootOptions.map(({ id, title, subtitle }) => {
                      const checked = selectedShootIds.has(id);
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
        {viewMode === 'showcase' ? (
          <ExclusiveListingsShowcase
            listings={presentation.displayedListings}
            resolveImageUrl={resolveListingPreviewUrl}
            formatPrice={formatListingPrice}
            onOpenListing={handleCardClick}
            selectedListingId={presentation.selectedListingId}
            onSelectListing={presentation.selectListing}
            showMarkerLabels={false}
            controlsOverlay={
              <div className="flex min-w-0 flex-nowrap items-stretch gap-2.5">
                {clientScopeControl}
                <MapTabToolbar
                  totalListings={presentation.summary.total}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  suggestions={presentation.suggestions}
                  filters={presentation.filters}
                  onAddFilter={presentation.addFilter}
                  onRemoveFilter={presentation.removeFilter}
                  cityOptions={cityOptions}
                  sort={presentation.sort}
                  onSortChange={presentation.setSort}
                  savedViews={presentation.savedViews}
                  onApplyView={presentation.applyView}
                  onSaveView={presentation.saveView}
                  onDeleteView={presentation.deleteView}
                  showSavedViews={false}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  variant="overlay"
                  className="min-w-0 flex-1"
                />
              </div>
            }
          />
        ) : sortedListings.length === 0 ? (
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
            {sortedListings.map((listing) => (
              <PrivateListingPortalListRow
                key={listing.id}
                listing={listing}
                selectionMode={hideSelectionMode}
                selected={selectedHiddenIds.has(listing.id)}
                canManageVisibility={isAdmin}
                savingVisibility={savingVisibility}
                onOpen={handleCardClick}
                onToggleSelect={toggleListingSelectedForHide}
                onUnhide={unhideListing}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PrivateListingPortal;
