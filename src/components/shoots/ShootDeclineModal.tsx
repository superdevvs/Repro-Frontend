import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Loader2, AlertTriangle, MapPin, User, DollarSign, Layers, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { format } from 'date-fns';

interface ShootDetails {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  client?: { id: number; name: string; email?: string };
  services?: Array<{ id: number; name: string; price?: number }>;
  scheduledAt?: string;
  totalQuote?: number;
  location?: { address?: string; city?: string; state?: string; zip?: string };
}

interface ShootDeclineModalProps {
  isOpen: boolean;
  onClose: () => void;
  shootId: string | number;
  shootAddress?: string;
  onDeclined?: () => void;
}

export function ShootDeclineModal({
  isOpen,
  onClose,
  shootId,
  shootAddress,
  onDeclined,
}: ShootDeclineModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shootDetails, setShootDetails] = useState<ShootDetails | null>(null);
  const [reason, setReason] = useState('');

  // Fetch shoot details when modal opens
  useEffect(() => {
    const fetchShootDetails = async () => {
      if (!isOpen || !shootId) return;
      
      setIsLoading(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setShootDetails(data.data || data);
        }
      } catch (error) {
        console.error('Error fetching shoot details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchShootDetails();
  }, [isOpen, shootId]);

  const handleDecline = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for declining this shoot request.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to decline shoot');
      }

      toast({
        title: 'Shoot declined',
        description: 'The shoot request has been declined.',
      });

      setReason('');
      onDeclined?.();
      onClose();
    } catch (error) {
      console.error('Error declining shoot:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to decline shoot. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get display values
  const displayAddress = shootDetails?.address || shootDetails?.location?.address || shootAddress || '';
  const displayCity = shootDetails?.city || shootDetails?.location?.city || '';
  const displayState = shootDetails?.state || shootDetails?.location?.state || '';
  const displayZip = shootDetails?.zip || shootDetails?.location?.zip || '';
  const fullLocation = [displayCity, displayState, displayZip].filter(Boolean).join(', ');
  const clientName = shootDetails?.client?.name || 'Unknown Client';
  const clientEmail = shootDetails?.client?.email || '';
  const services = shootDetails?.services || [];
  const totalQuote = shootDetails?.totalQuote || (shootDetails as any)?.payment?.totalQuote || 0;
  const scheduledAt = shootDetails?.scheduledAt || (shootDetails as any)?.scheduled_at;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] md:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <DialogTitle className="text-xl text-red-600">Decline Shoot Request</DialogTitle>
              <DialogDescription className="mt-1">
                This action will notify the client
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col md:flex-row gap-4 py-4">
            <Skeleton className="h-40 md:h-48 w-full md:w-1/2 rounded-xl" />
            <Skeleton className="h-40 md:h-48 w-full md:w-1/2 rounded-xl" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-5">
            {/* Left Column - Shoot Details */}
            <div className="flex-1">
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 h-full">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-sm">Shoot Details</p>
                </div>

                {/* Address */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Property</p>
                  <p className="font-semibold text-foreground mt-0.5">{displayAddress || 'No address'}</p>
                  {fullLocation && (
                    <p className="text-sm text-muted-foreground">{fullLocation}</p>
                  )}
                </div>

                <Separator />

                {/* Client & Quote & Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</p>
                    <p className="font-semibold text-foreground mt-0.5 truncate">{clientName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quote</p>
                    <p className="font-semibold text-emerald-600 mt-0.5">
                      ${typeof totalQuote === 'number' ? totalQuote.toFixed(2) : '0.00'}
                    </p>
                  </div>
                </div>

                {scheduledAt && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Requested: {format(new Date(scheduledAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </>
                )}

                {/* Services */}
                {services.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Services</p>
                      <div className="flex flex-wrap gap-1.5">
                        {services.map((service: any, index: number) => (
                          <Badge 
                            key={service.id || index} 
                            variant="secondary" 
                            className="bg-primary/10 text-primary border-primary/20 text-xs"
                          >
                            {service.name || service.label || 'Service'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right Column - Decline Reason */}
            <div className="flex-1 space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-700 dark:text-amber-400">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>The client will be notified that their shoot request has been declined with your reason.</span>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-3">
                <Label className="text-sm font-semibold">Reason for Declining *</Label>
                <Textarea
                  placeholder="Please explain why this request is being declined..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This message will be shared with the client.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDecline} 
            disabled={isSubmitting || isLoading || !reason.trim()} 
            variant="destructive"
            className="min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Declining...
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Decline Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
