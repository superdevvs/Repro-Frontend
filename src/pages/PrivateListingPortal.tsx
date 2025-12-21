import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { Home, Search, MapPin, Calendar, Camera, ExternalLink, Download } from 'lucide-react';
import { format } from 'date-fns';
import { API_BASE_URL } from '@/config/env';
import { ShootData } from '@/types/shoots';

interface PrivateListing {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
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
  tourLinks?: {
    branded?: string;
    mls?: string;
    genericMls?: string;
  };
  isPrivateListing: boolean;
}

const PrivateListingPortal = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [listings, setListings] = useState<PrivateListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredListings, setFilteredListings] = useState<PrivateListing[]>([]);

  useEffect(() => {
    fetchPrivateListings();
  }, []);

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
      const response = await fetch(`${API_BASE_URL}/api/shoots?private_listing=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

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
          tourLinks: shoot.tourLinks || {},
          isPrivateListing: shoot.is_private_listing || shoot.isPrivateListing || false,
        }));

      setListings(formattedListings);
      setFilteredListings(formattedListings);
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      completed: { label: 'Completed', variant: 'default' },
      scheduled: { label: 'Scheduled', variant: 'secondary' },
      booked: { label: 'Booked', variant: 'outline' },
    };

    const config = statusMap[status.toLowerCase()] || { label: status, variant: 'outline' as const };
    return (
      <Badge variant={config.variant} className="capitalize">
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageTransition>
          <div className="space-y-6 p-6">
            <PageHeader
              badge="Portal"
              title="Private Listing Portal"
              description="Browse and search private listings"
            />
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading listings...</p>
            </div>
          </div>
        </PageTransition>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 p-6">
          <PageHeader
            badge="Portal"
            title="Private Listing Portal"
            description="Browse and search private listings"
          />

          {/* Search Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by address, city, state, zip, client, or services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredListings.length} {filteredListings.length === 1 ? 'listing' : 'listings'} found
              {searchQuery && ` for "${searchQuery}"`}
            </p>
          </div>

          {/* Listings Grid */}
          {filteredListings.length === 0 ? (
            <Card>
              <CardContent className="py-24 text-center">
                <Home className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No listings found</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : 'No private listings available at this time'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredListings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{listing.fullAddress}</CardTitle>
                        <CardDescription className="mt-1">
                          {listing.city}, {listing.state} {listing.zip}
                        </CardDescription>
                      </div>
                      {getStatusBadge(listing.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Client Info */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Client:</span>
                      <span className="font-medium">{listing.client.name}</span>
                    </div>

                    {/* Photographer */}
                    {listing.photographer && (
                      <div className="flex items-center gap-2 text-sm">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Photographer:</span>
                        <span>{listing.photographer.name}</span>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="space-y-1 text-sm">
                      {listing.scheduledDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Scheduled:</span>
                          <span>{format(new Date(listing.scheduledDate), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {listing.completedDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Completed:</span>
                          <span>{format(new Date(listing.completedDate), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                    </div>

                    {/* Services */}
                    {listing.services.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {listing.services.slice(0, 3).map((service, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {service}
                          </Badge>
                        ))}
                        {listing.services.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{listing.services.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Tour Links */}
                    {(listing.tourLinks?.branded || listing.tourLinks?.mls || listing.tourLinks?.genericMls) && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        {listing.tourLinks.branded && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => window.open(listing.tourLinks!.branded, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Branded
                          </Button>
                        )}
                        {listing.tourLinks.mls && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => window.open(listing.tourLinks!.mls, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            MLS
                          </Button>
                        )}
                        {listing.tourLinks.genericMls && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => window.open(listing.tourLinks!.genericMls, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Generic MLS
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default PrivateListingPortal;
