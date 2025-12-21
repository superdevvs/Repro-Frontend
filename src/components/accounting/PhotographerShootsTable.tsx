import React, { useState } from 'react';
import { Calendar as CalendarIcon, Eye, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShootData } from '@/types/shoots';
import { useNavigate } from 'react-router-dom';

interface PhotographerShootsTableProps {
  shoots: ShootData[];
}

export function PhotographerShootsTable({ shoots }: PhotographerShootsTableProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('paid') || statusLower === 'completed') {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
    if (statusLower.includes('pending') || statusLower.includes('review')) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
    if (statusLower === 'scheduled' || statusLower === 'booked') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getPhotographerFee = (shoot: ShootData): number => {
    // Use photographer pay from services (automatically calculated from services)
    // Fallback to 40% of total quote if not set
    if ((shoot as any).photographerPay || (shoot as any).totalPhotographerPay) {
      return Number((shoot as any).photographerPay || (shoot as any).totalPhotographerPay || 0);
    }
    return shoot.payment?.totalQuote ? Math.round(shoot.payment.totalQuote * 0.4) : 0;
  };

  const getPayoutDate = (shoot: ShootData): string | null => {
    // Check if shoot is paid and has payout date
    const status = shoot.status?.toLowerCase() || '';
    if (status.includes('paid') && shoot.payment?.lastPaymentDate) {
      return shoot.payment.lastPaymentDate;
    }
    return null;
  };

  const handleViewShoot = (shoot: ShootData) => {
    navigate(`/shoots/${shoot.id}`);
  };

  const filteredShoots = shoots; // Could add filtering by status if needed

  return (
    <div className="w-full">
      <Card className="mb-6">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-lg font-semibold">My Shoots & Earnings</h3>
          <div className="flex gap-1 ml-4 text-xs">
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              aria-label="List view" 
              onClick={() => setViewMode('list')}
            >
              List View
            </Button>
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm" 
              aria-label="Grid view" 
              onClick={() => setViewMode('grid')}
            >
              Grid View
            </Button>
          </div>
        </div>

        <div>
          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-1 px-2 text-left">Shoot ID</th>
                    <th className="py-1 px-2 text-left">Client</th>
                    <th className="py-1 px-2 text-left">Property Address</th>
                    <th className="py-1 px-2 text-left">Status</th>
                    <th className="py-1 px-2 text-left">Photographer Fee</th>
                    <th className="py-1 px-2 text-left">Shoot Date</th>
                    <th className="py-1 px-2 text-left">Payout Date</th>
                    <th className="py-1 px-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShoots.map((shoot) => {
                    const fee = getPhotographerFee(shoot);
                    const payoutDate = getPayoutDate(shoot);
                    return (
                      <tr key={shoot.id} className="border-b hover:bg-muted/30 transition">
                        <td className="py-1 px-2 font-medium text-xs">#{shoot.id}</td>
                        <td className="py-1 px-2 text-xs">{shoot.client?.name || 'N/A'}</td>
                        <td className="py-1 px-2 text-xs">
                          {shoot.location?.address || shoot.location?.fullAddress || 'N/A'}
                        </td>
                        <td className="py-1 px-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(shoot.status || '')}`}>
                            {shoot.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-xs font-medium">${fee.toLocaleString()}</td>
                        <td className="py-1 px-2 text-xs">
                          {shoot.scheduledDate ? format(new Date(shoot.scheduledDate), 'MMM d, yyyy') : 'TBD'}
                        </td>
                        <td className="py-1 px-2 text-xs">
                          {payoutDate ? format(new Date(payoutDate), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="py-1 px-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleViewShoot(shoot)} 
                            aria-label="View Shoot" 
                            className="px-3 py-1 text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View Shoot
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredShoots.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-muted-foreground text-sm">
                        No shoots found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-280px)]">
              <div className="space-y-3 p-3">
                {filteredShoots.map((shoot) => {
                  const fee = getPhotographerFee(shoot);
                  const payoutDate = getPayoutDate(shoot);
                  return (
                    <ShootItem 
                      key={shoot.id} 
                      shoot={shoot}
                      fee={fee}
                      payoutDate={payoutDate}
                      onView={handleViewShoot}
                      getStatusColor={getStatusColor}
                    />
                  );
                })}
                {filteredShoots.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground text-sm">No shoots found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </Card>
    </div>
  );
}

interface ShootItemProps {
  shoot: ShootData;
  fee: number;
  payoutDate: string | null;
  onView: (shoot: ShootData) => void;
  getStatusColor: (status: string) => string;
}

function ShootItem({ 
  shoot, 
  fee,
  payoutDate,
  onView, 
  getStatusColor,
}: ShootItemProps) {
  return (
    <div className="flex flex-col bg-card rounded-lg shadow-sm">
      <div className="p-3 flex-row justify-between items-center border-b border-border hidden sm:flex">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-medium text-sm">Shoot #{shoot.id}</h3>
            <div className="text-xs text-muted-foreground truncate max-w-xs">
              {shoot.client?.name || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-xs mt-1">
              {shoot.location?.address || shoot.location?.fullAddress || 'N/A'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Badge className={getStatusColor(shoot.status || '')}>
            {shoot.status || 'Unknown'}
          </Badge>
          <div className="text-right">
            <div className="font-medium">${fee.toLocaleString()}</div>
            <div className="text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              <span>
                {shoot.scheduledDate ? format(new Date(shoot.scheduledDate), 'MMM d, yyyy') : 'TBD'}
              </span>
            </div>
            {payoutDate && (
              <div className="text-muted-foreground text-xs mt-1">
                Paid: {format(new Date(payoutDate), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 flex-row justify-between items-center border-b border-border flex sm:hidden">
        <div className="space-y-1">
          <h3 className="font-medium text-sm">Shoot #{shoot.id}</h3>
          <div className="text-xs text-muted-foreground truncate max-w-xs">
            {shoot.client?.name || 'N/A'}
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-xs">
            {shoot.location?.address || shoot.location?.fullAddress || 'N/A'}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={getStatusColor(shoot.status || '')}>
              {shoot.status || 'Unknown'}
            </Badge>
            <div className="text-xs font-medium">${fee.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="p-3 flex justify-between items-center">
        <div className="flex flex-wrap gap-2 text-xs">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onView(shoot)}
            className="px-3 py-1"
          >
            <Eye className="h-3 w-3 mr-1" />
            View Shoot
          </Button>
        </div>
      </div>
    </div>
  );
}


