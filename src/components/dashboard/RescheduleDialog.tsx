
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { TimeSelect } from "@/components/ui/time-select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShootData } from '@/types/shoots';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from "@/hooks/use-toast";
import { useShoots } from '@/context/ShootsContext';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import { MapPin, Camera, Calendar as CalendarIcon, Clock } from 'lucide-react';

interface RescheduleDialogProps {
  shoot: ShootData;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RescheduleDialog({ shoot, isOpen, onClose, onSuccess }: RescheduleDialogProps) {
  const [date, setDate] = useState<Date | undefined>(
    shoot.scheduledDate ? new Date(shoot.scheduledDate) : undefined
  );
  const [time, setTime] = useState<string>(
    shoot.time || "10:00 AM"
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { fetchShoots } = useShoots();
  
  const handleReschedule = async () => {
    if (!date) {
      toast({
        title: "Select a date",
        description: "Please select a new date for the shoot.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const originalDate = new Date(shoot.scheduledDate);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing');
      }

      await axios.post(
        `${API_BASE_URL}/api/shoots/${shoot.id}/reschedule`,
        {
          requested_date: format(date, 'yyyy-MM-dd'),
          requested_time: time,
          reason: reason || undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );
      
      await fetchShoots();
      
      // Show success message
      toast({
        title: 'Shoot rescheduled',
        description: 'The shoot has been rescheduled successfully.',
      });
      
      // Notify parent to refresh
      if (onSuccess) {
        onSuccess();
      }
      
      // Close the dialog
      onClose();
    } catch (error) {
      console.error('Error rescheduling shoot:', error);
      toast({
        title: "Failed to reschedule",
        description: "There was an error rescheduling the shoot. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reschedule Shoot</DialogTitle>
          <DialogDescription>
            Select a new date and time for this shoot.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Left Pane - Shoot Details */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">Current Shoot Details</h3>
            
            <div className="space-y-3">
              {/* Address */}
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium">{shoot.location?.address || 'No address'}</div>
                  {shoot.location?.city && (
                    <div className="text-muted-foreground">
                      {shoot.location.city}, {shoot.location.state} {shoot.location.zip}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Current Date & Time */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">
                    {shoot.scheduledDate ? format(new Date(shoot.scheduledDate), 'MMMM d, yyyy') : 'Not scheduled'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">{shoot.time || 'No time set'}</span>
                </div>
              </div>
              
              {/* Photographer */}
              {shoot.photographer?.name && (
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium">{shoot.photographer.name}</span>
                  </div>
                </div>
              )}
              
              {/* Services */}
              {shoot.services && shoot.services.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground mb-1.5">Services</div>
                  <div className="flex flex-wrap gap-1">
                    {shoot.services.map((service, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {typeof service === 'string' ? service : (service as any).name || service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Pane - Reschedule Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select New Date</Label>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="border rounded-md p-3"
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Select New Time</Label>
              <TimeSelect
                value={time}
                onChange={setTime}
                startHour={6}
                endHour={21}
                interval={15}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Reason for Rescheduling (Optional)</Label>
              <Textarea
                placeholder="Enter the reason for rescheduling..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleReschedule} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Reschedule Shoot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
