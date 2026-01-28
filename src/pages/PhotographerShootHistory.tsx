
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useShoots } from '@/context/ShootsContext';
import { useNavigate } from 'react-router-dom';
import { Eye, Calendar, Clock, MapPin, ChevronRight, Building, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShootData } from '@/types/shoots';
import { useAuth } from '@/components/auth/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShootCard } from '@/components/dashboard/ShootCard';
import { withErrorBoundary } from '@/components/ui/ErrorBoundary';

const statusColors = {
  scheduled: 'bg-blue-500',
  uploaded: 'bg-emerald-500',
  editing: 'bg-violet-500',
  review: 'bg-amber-500',
  delivered: 'bg-slate-500',
  pending: 'bg-yellow-500',
  hold: 'bg-purple-500',
  booked: 'bg-orange-500',
};

const PhotographerShootHistory = () => {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAddress, setFilterAddress] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { shoots } = useShoots();
  const { user } = useAuth();

  useEffect(() => {
    // Simulate loading for smoother UX
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Filter shoots based on photographer
  const photographerShoots = user ? shoots.filter(shoot => 
    shoot.photographer.name === user.name
  ) : [];

  // Get photographer shoots by status
  const scheduledShoots = photographerShoots.filter(shoot =>
    ['scheduled', 'booked'].includes(shoot.status)
  );
  // Completed tab: photographer completed + editing
  const completedShoots = photographerShoots.filter(shoot =>
    ['uploaded', 'editing'].includes(shoot.status)
  );
  // Delivered tab: final delivered/ready-for-client equivalents
  const deliveredShoots = photographerShoots.filter(shoot =>
    ['delivered'].includes(shoot.status)
  );

  // Apply filters to scheduled shoots
  const filteredScheduledShoots = scheduledShoots.filter(shoot => {
    return !filterAddress || 
      shoot.location.fullAddress.toLowerCase().includes(filterAddress.toLowerCase());
  });

  // Auto-expanding tabs configuration with badges
  const tabsConfig: AutoExpandingTab[] = useMemo(() => [
    {
      value: 'scheduled',
      icon: Calendar,
      label: 'Scheduled',
      badge: scheduledShoots.length > 0 ? scheduledShoots.length : undefined,
    },
    {
      value: 'completed',
      icon: Eye,
      label: 'Completed',
      badge: completedShoots.length > 0 ? completedShoots.length : undefined,
    },
    {
      value: 'delivered',
      icon: Eye,
      label: 'Delivered',
      badge: deliveredShoots.length > 0 ? deliveredShoots.length : undefined,
    },
  ], [scheduledShoots.length, completedShoots.length, deliveredShoots.length]);

  // Format date for display
  const formatShootDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy');
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Render shoot card for a single shoot
  const renderShootCard = (shoot: ShootData) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      key={shoot.id}
      className="p-4 border border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
      onClick={() => navigate(`/shoots?id=${shoot.id}`)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium">{shoot.location.address}</h3>
          <p className="text-sm text-muted-foreground">{shoot.location.city}, {shoot.location.state} {shoot.location.zip}</p>
        </div>
        <Badge 
          variant="outline" 
          className={`${
            statusColors[shoot.status as keyof typeof statusColors] || 'bg-gray-500'
          } text-white`}
        >
          {shoot.status.charAt(0).toUpperCase() + shoot.status.slice(1)}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{formatShootDate(shoot.scheduledDate)}</span>
        </div>
        
        {shoot.time && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{shoot.time}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 col-span-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">Client: {shoot.client.name}</span>
        </div>
        
        {shoot.services && shoot.services.length > 0 && (
          <div className="col-span-2 mt-2">
            <p className="text-xs text-muted-foreground mb-1">Services:</p>
            <div className="flex flex-wrap gap-1">
              {shoot.services.map((service, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {service}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="gap-1">
          <span>View Details</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );

  // Render table for scheduled shoots
  const renderScheduledShootsTable = () => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Services</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredScheduledShoots.length > 0 ? (
            filteredScheduledShoots.map((shoot) => (
              <TableRow key={shoot.id}>
                <TableCell>{formatShootDate(shoot.scheduledDate)}</TableCell>
                <TableCell>{shoot.time || 'Not set'}</TableCell>
                <TableCell className="max-w-xs truncate">{shoot.location.fullAddress}</TableCell>
                <TableCell>{shoot.client.name}</TableCell>
                <TableCell>{shoot.services.join(', ')}</TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate(`/shoots?id=${shoot.id}`)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    <span>View</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center p-4">No scheduled shoots found</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  // Render empty state when no shoots are available
  const renderEmptyState = (message: string) => (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-xl font-medium mb-2">No shoots to display</h3>
      <p className="text-muted-foreground mb-6">{message}</p>
    </div>
  );

  // Render loading state
  const renderLoadingState = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-end mt-4">
              <Skeleton className="h-8 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="container max-w-5xl py-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Shoots</h1>
            <p className="text-muted-foreground">View and manage your upcoming photo shoots</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <AutoExpandingTabsList 
            tabs={tabsConfig} 
            value={activeTab}
            className="mb-6"
          />

          {isLoading ? (
            renderLoadingState()
          ) : (
            <>
              <TabsContent value="scheduled" className="mt-0">
                {scheduledShoots.length > 0 ? (
                  <>
                    <Collapsible 
                      open={isFilterOpen} 
                      onOpenChange={setIsFilterOpen}
                      className="mb-6 border rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Filter Shoots</h3>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Filter className="h-4 w-4 mr-2" />
                            {isFilterOpen ? "Hide Filters" : "Show Filters"}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="address-filter" className="text-sm font-medium">
                            Address
                          </label>
                          <Input 
                            id="address-filter" 
                            placeholder="Filter by address" 
                            value={filterAddress}
                            onChange={(e) => setFilterAddress(e.target.value)}
                          />
                        </div>
                        
                        {filterAddress && (
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">
                              Showing {filteredScheduledShoots.length} of {scheduledShoots.length} shoots
                            </p>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setFilterAddress('');
                              }}
                            >
                              Clear Filters
                            </Button>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                    {renderScheduledShootsTable()}
                  </>
                ) : (
                  renderEmptyState("You don't have any scheduled shoots.")
                )}
              </TabsContent>
              
              <TabsContent value="completed" className="mt-0">
                {completedShoots.length > 0 ? (
                  <div className="grid gap-4">
                    {completedShoots.map(renderShootCard)}
                  </div>
                ) : (
                  renderEmptyState("You don't have any completed shoots yet.")
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const PhotographerShootHistoryWithBoundary = withErrorBoundary(PhotographerShootHistory);

export default PhotographerShootHistoryWithBoundary;
