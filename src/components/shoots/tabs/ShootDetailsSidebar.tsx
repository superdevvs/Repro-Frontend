import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  Mail,
  Phone,
  Building,
  Camera,
  DollarSign,
  CheckCircle,
  Circle,
  ChevronRight,
  FileText,
  Loader2,
  Search,
  ArrowUpDown,
  MapPin,
} from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { InvoiceViewDialog } from '@/components/invoices/InvoiceViewDialog';
import { InvoiceData } from '@/utils/invoiceUtils';
import { API_BASE_URL } from '@/config/env';
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { getStateFullName } from '@/utils/stateUtils';
import { cn } from '@/lib/utils';

interface ShootDetailsSidebarProps {
  shoot: ShootData;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isPhotographer?: boolean;
  isEditor?: boolean;
  onMarkPaid: () => void;
  onShootUpdate?: () => void;
}

export function ShootDetailsSidebar({
  shoot,
  isSuperAdmin,
  isAdmin,
  isPhotographer = false,
  isEditor = false,
  onMarkPaid,
  onShootUpdate,
}: ShootDetailsSidebarProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  
  // Photographer selection state
  const [assignPhotographerOpen, setAssignPhotographerOpen] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string>('');
  const [photographers, setPhotographers] = useState<Array<{ 
    id: string; 
    name: string; 
    email: string;
    avatar?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    distance?: number;
  }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  
  const client = shoot.client;
  const photographer = shoot.photographer;
  const payment = shoot.payment || {
    baseQuote: 0,
    taxAmount: 0,
    totalQuote: 0,
    totalPaid: 0,
  };

  const remainingBalance = payment.totalQuote - payment.totalPaid;
  const isPaid = remainingBalance <= 0.01;

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  // Get shoot location for distance calculation
  const getShootLocation = () => {
    const address = shoot.location?.address || (shoot as any).address || '';
    const city = shoot.location?.city || (shoot as any).city || '';
    const state = shoot.location?.state || (shoot as any).state || '';
    const zip = shoot.location?.zip || (shoot as any).zip || '';
    return { address, city, state, zip };
  };

  // Fetch photographers for assignment
  useEffect(() => {
    if (!assignPhotographerOpen || !isAdmin) return;
    
    const fetchPhotographers = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/users/photographers`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (res.ok) {
          const json = await res.json();
          const photographersList = (json.data || json || []).map((p: any) => ({
            id: String(p.id),
            name: p.name,
            email: p.email,
            avatar: p.avatar,
            address: p.address || p.metadata?.address || p.metadata?.homeAddress,
            city: p.city || p.metadata?.city,
            state: p.state || p.metadata?.state,
            zip: p.zip || p.zipcode || p.metadata?.zip || p.metadata?.zipcode,
          }));
          setPhotographers(photographersList);
        }
      } catch (error) {
        console.error('Error fetching photographers:', error);
      }
    };
    
    fetchPhotographers();
  }, [assignPhotographerOpen, isAdmin]);

  // Calculate distances when dialog opens and shoot location/photographers are available
  useEffect(() => {
    const calculateDistances = async () => {
      if (!assignPhotographerOpen || photographers.length === 0) return;
      
      const shootLocation = getShootLocation();
      if (!shootLocation.address || !shootLocation.city || !shootLocation.state) {
        return; // Can't calculate without location
      }

      setIsCalculatingDistances(true);
      try {
        // Get coordinates for shoot location
        const shootCoords = await getCoordinatesFromAddress(
          shootLocation.address,
          shootLocation.city,
          shootLocation.state,
          shootLocation.zip
        );
        
        if (!shootCoords) {
          setIsCalculatingDistances(false);
          return;
        }

        // Calculate distance for each photographer
        const photographersWithDist = await Promise.all(
          photographers.map(async (photographer) => {
            if (!photographer.address || !photographer.city || !photographer.state) {
              return { ...photographer, distance: undefined };
            }

            const photographerCoords = await getCoordinatesFromAddress(
              photographer.address,
              photographer.city,
              photographer.state,
              photographer.zip
            );

            if (!photographerCoords) {
              return { ...photographer, distance: undefined };
            }

            const dist = calculateDistance(
              shootCoords.lat,
              shootCoords.lon,
              photographerCoords.lat,
              photographerCoords.lon
            );

            return {
              ...photographer,
              distance: Math.round(dist * 10) / 10, // Round to 1 decimal
            };
          })
        );

        setPhotographers(photographersWithDist);
      } catch (error) {
        console.error('Error calculating distances:', error);
      } finally {
        setIsCalculatingDistances(false);
      }
    };

    calculateDistances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignPhotographerOpen, photographers.length]);

  // Filter and sort photographers
  const filteredAndSortedPhotographers = useMemo(() => {
    let filtered = photographers;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query) ||
        p.state?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'distance') {
        // Sort by distance (undefined distances go to end)
        if (a.distance === undefined && b.distance === undefined) return 0;
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      } else {
        // Sort by name
        return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [photographers, searchQuery, sortBy]);

  // Assign photographer
  const handleAssignPhotographer = async () => {
    if (!selectedPhotographerId) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ photographer_id: selectedPhotographerId }),
      });
      
      if (!res.ok) throw new Error('Failed to assign photographer');
      
      toast({
        title: 'Success',
        description: 'Photographer assigned successfully',
      });
      
      setAssignPhotographerOpen(false);
      setSearchQuery('');
      setSelectedPhotographerId('');
      
      if (onShootUpdate) {
        onShootUpdate();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign photographer',
        variant: 'destructive',
      });
    }
  };

  const handleShowInvoice = async () => {
    setIsLoadingInvoice(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/invoice`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch invoice');
      }

      const data = await res.json();
      const invoiceData = data.data || data;

      // Convert API response to InvoiceData format
      const invoice: InvoiceData = {
        id: invoiceData.id?.toString() || '',
        number: invoiceData.invoice_number || invoiceData.number || `Invoice ${invoiceData.id}`,
        client: typeof invoiceData.client === 'string' 
          ? invoiceData.client 
          : invoiceData.client?.name || invoiceData.shoot?.client?.name || 'Unknown Client',
        property: invoiceData.shoot?.location?.fullAddress 
          || invoiceData.shoot?.address 
          || invoiceData.property 
          || 'N/A',
        date: invoiceData.issue_date || invoiceData.date || new Date().toISOString(),
        dueDate: invoiceData.due_date || invoiceData.dueDate || new Date().toISOString(),
        amount: invoiceData.total || invoiceData.amount || 0,
        status: invoiceData.status === 'paid' ? 'paid' : invoiceData.status === 'sent' ? 'pending' : 'pending',
        services: invoiceData.items?.map((item: any) => item.description) || invoiceData.services || [],
        paymentMethod: invoiceData.paymentMethod || 'N/A',
      };

      setSelectedInvoice(invoice);
      setIsInvoiceDialogOpen(true);
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load invoice',
        variant: 'destructive',
      });
      // Fallback: navigate to accounting page
      navigate('/accounting');
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  return (
    <div className="w-80 border-l bg-muted/20 p-6 space-y-4 overflow-y-auto h-full">
      {/* Client Info Card - Hidden for photographers and editors */}
      {!isPhotographer && !isEditor && (
      <Card className="shadow-sm border-2 hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            Client Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/20">
                {client?.name ? (
                  <span className="text-sm font-bold text-primary">
                    {client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{client?.name || 'Unknown'}</p>
                {client?.company && (
                  <p className="text-xs text-muted-foreground truncate">{client.company}</p>
                )}
              </div>
            </div>
            
            {client?.email && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm h-9"
                onClick={() => handleEmail(client.email!)}
              >
                <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="truncate">{client.email}</span>
              </Button>
            )}
            
            {client?.phone && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm h-9"
                onClick={() => handleCall(client.phone!)}
              >
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{client.phone}</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Photographer Card */}
      {photographer && (
        <Card className="shadow-sm border-2 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Camera className="h-4 w-4 text-blue-600" />
              </div>
              Photographer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border-2 border-blue-500/20">
                <Camera className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{photographer.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                  <span className="text-xs text-muted-foreground">Online</span>
                </div>
              </div>
            </div>
            
            {isAdmin && photographer.id && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setAssignPhotographerOpen(true)}
              >
                Change Photographer
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Billing Summary Card */}
      {(isAdmin || isSuperAdmin) && (
        <Card className="shadow-sm border-2 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              Billing Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Base</span>
                <span className="font-medium">${payment.baseQuote?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">${payment.taxAmount?.toFixed(2) || '0.00'}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-foreground">${payment.totalQuote?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-600 font-semibold">
                <span>Paid</span>
                <span>${payment.totalPaid?.toFixed(2) || '0.00'}</span>
              </div>
              <div className={`flex items-center justify-between font-semibold ${
                remainingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                <span>Outstanding</span>
                <span>${remainingBalance.toFixed(2)}</span>
              </div>
            </div>
            
            {isSuperAdmin && (
              <>
                <Separator className="my-3" />
                {!isPaid ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={onMarkPaid}
                  >
                    <CheckCircle className="h-3 w-3 mr-1.5" />
                    Mark as Paid
                  </Button>
                ) : (
                  <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Paid</span>
                  </div>
                )}
              </>
            )}
            
            {(isAdmin || isSuperAdmin) && isPaid && (
              <>
                <Separator className="my-3" />
                <Button
                  variant="default"
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleShowInvoice}
                  disabled={isLoadingInvoice}
                >
                  {isLoadingInvoice ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3 mr-1.5" />
                  )}
                  {isLoadingInvoice ? 'Loading...' : 'Show Invoice'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
      
      {selectedInvoice && (
        <InvoiceViewDialog
          isOpen={isInvoiceDialogOpen}
          onClose={() => {
            setIsInvoiceDialogOpen(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
        />
      )}

      {/* Assign Photographer Dialog - Matching Book Shoot selector */}
      <Dialog open={assignPhotographerOpen} onOpenChange={(open) => {
        setAssignPhotographerOpen(open);
        if (!open) {
          setSearchQuery('');
          setSelectedPhotographerId('');
        }
      }}>
        <DialogContent className="sm:max-w-md w-full">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <DialogHeader>
                  <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">Select Photographer</DialogTitle>
                  <DialogDescription>
                    Choose a photographer to assign to this shoot
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            {/* Search and Sort Controls */}
            <div className="space-y-3 mb-4">
              {/* Search Field */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search photographers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(value: 'distance' | 'name') => setSortBy(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Sort by Distance</SelectItem>
                    <SelectItem value="name">Sort by Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {/* Scrollable content area */}
              <div className="pt-3 max-h-[48vh] overflow-y-auto pr-2">
                {isCalculatingDistances ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
                  </div>
                ) : filteredAndSortedPhotographers.length > 0 ? (
                  <div className="grid gap-3">
                    {filteredAndSortedPhotographers.map((photographerItem) => (
                      <div
                        key={photographerItem.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={photographerItem.avatar} alt={photographerItem.name} />
                            <AvatarFallback>{photographerItem.name?.charAt(0)}</AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {photographerItem.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              {photographerItem.distance !== undefined ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {photographerItem.distance} mi away
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Distance unavailable</span>
                              )}
                              {photographerItem.city && photographerItem.state && (
                                <span className="text-muted-foreground">
                                  • {photographerItem.city}, {getStateFullName(photographerItem.state)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotographerId(photographerItem.id);
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors",
                              selectedPhotographerId === photographerItem.id
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600"
                            )}
                          >
                            {selectedPhotographerId === photographerItem.id ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                    {searchQuery ? 'No photographers found matching your search.' : 'No photographers available.'}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={() => {
                    setAssignPhotographerOpen(false);
                    setSearchQuery('');
                    setSelectedPhotographerId('');
                  }} className="w-full">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedPhotographerId) {
                        toast({
                          title: "No photographer selected",
                          description: "Please select a photographer before continuing.",
                          variant: "destructive",
                        });
                        return;
                      }
                      handleAssignPhotographer();
                    }}
                    className="w-full"
                    disabled={!selectedPhotographerId}
                  >
                    Assign
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


