import { normalizeSlotTime } from '@/utils/suggestedTimeSlots';
import { TravelFeasibilityPanel } from '@/features/travel/TravelFeasibilityPanel';
import { useTravelFeasibility } from '@/features/travel/useTravelFeasibility';
import { shootTravelPayload } from '@/features/travel/travelPayload';

import React, { useEffect, useRef, useState } from 'react';
import { ServiceDurationPicker } from '@/components/shoots/ServiceDurationPicker';
import { buildRescheduleDurationPayload, getRescheduleDurationEntries } from '@/utils/rescheduleDurations';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { TimeSelect } from "@/components/ui/time-select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShootData } from '@/types/shoots';
import { format } from 'date-fns';
import { getShootSchedule } from '@/utils/shootSchedule';
import { parseLocalYmd } from '@/utils/shootLocalDate';
import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import { useRescheduleAccess } from '@/hooks/useRescheduleAccess';
import { useToast } from "@/hooks/use-toast";
import { useShoots } from '@/context/shootsContextState';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import { MapPin, Camera, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { getShootUnits } from '@/features/shoot-units/shootUnitData';
import { getShootDetailsServiceNames } from '@/components/shoots/details/shootDetailsPresentation';

interface RescheduleDialogProps {
  shoot: ShootData;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RescheduleDialog({ shoot, isOpen, onClose, onSuccess }: RescheduleDialogProps) {
  const units = getShootUnits(shoot);
  const schedule = getShootSchedule(shoot);
  const [date, setDate] = useState<Date | undefined>(
    schedule.date ? parseLocalYmd(schedule.date) : undefined
  );
  const [time, setTime] = useState<string>(
    schedule.time ? formatTimeForDisplay(schedule.time) : "10:00 AM"
  );
  const [reason, setReason] = useState("");
  const [durationChanges, setDurationChanges] = useState<Record<string, number>>({});
  const draftSession = useRef({ isOpen: false, shootId: shoot.id, revision: 0 });
  useEffect(() => {
    const previous = draftSession.current;
    const newDraft = isOpen && (!previous.isOpen || previous.shootId !== shoot.id);
    draftSession.current = { isOpen, shootId: shoot.id, revision: previous.revision + (newDraft ? 1 : 0) };
    if (!newDraft) return;
    setDate(schedule.date ? parseLocalYmd(schedule.date) : undefined);
    setTime(schedule.time ? formatTimeForDisplay(schedule.time) : '10:00 AM');
    setReason('');
    setDurationChanges({});
    setIsSubmitting(false);
  }, [isOpen, shoot.id, schedule.date, schedule.time]);
  const durationEntries = getRescheduleDurationEntries(shoot);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { fetchShoots } = useShoots();
  const { access, viewerScope } = useRescheduleAccess(shoot);
  const appliesImmediately = access === 'apply';
  const canSubmit = appliesImmediately || access === 'request';
  const submissionScope = `${shoot.id}:${viewerScope}:${access}:${isOpen}:${draftSession.current.revision}`;
  const currentSubmissionScope = useRef(submissionScope);
  currentSubmissionScope.current = submissionScope;
  useEffect(() => () => { currentSubmissionScope.current = ''; }, []);
  const accessMessage = access === 'checking'
    ? 'Checking your scheduling permissions…'
    : access === 'unavailable'
      ? 'Scheduling permissions could not be loaded. Close this dialog and refresh before trying again.'
      : 'You do not have permission to reschedule this appointment.';

  const durationPayload = appliesImmediately ? buildRescheduleDurationPayload(shoot, durationChanges) : {};
  const travel = useTravelFeasibility({ requestedOnly: !appliesImmediately, payload: isOpen && canSubmit && date && time ? shootTravelPayload(shoot, {
    requested_date: format(date, 'yyyy-MM-dd'), requested_time: normalizeSlotTime(time), ...durationPayload,
  }, 'reschedule') : null });
  const handleReschedule = async () => {
    if (!canSubmit || travel.blocked) return;
    const submittedScope = submissionScope;
    const submittedRevision = draftSession.current.revision;
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
      const travelConfirmation = await travel.confirmSave();
      if (!travelConfirmation || submittedScope !== currentSubmissionScope.current) return;
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing');
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/shoots/${shoot.id}/reschedule`,
        {
          ...travelConfirmation,
          requested_date: format(date, 'yyyy-MM-dd'),
          requested_time: normalizeSlotTime(time),
          reason: reason || undefined,
          ...(appliesImmediately ? buildRescheduleDurationPayload(shoot, durationChanges) : {}),
          ...(units.length ? { expected_units_revision: shoot.units_revision } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );

      await fetchShoots();

      // The server reports whether it applied the change or queued a request;
      // trust that over a capability snapshot so the toast is never wrong.
      const applied = response?.data?.applied ?? appliesImmediately;

      toast({
        title: applied ? 'Shoot rescheduled' : 'Reschedule requested',
        description: applied
          ? 'The shoot has been rescheduled successfully.'
          : 'Your request was submitted for review. The shoot keeps its current date until it is approved.',
      });
      
      // Notify parent to refresh
      if (onSuccess) {
        onSuccess();
      }
      
      // Close the dialog
      onClose();
    } catch (error) {
      console.error('Error rescheduling shoot:', error);
      const response = axios.isAxiosError(error) ? error.response?.data : undefined;
      travel.acceptServerError(response);
      const validationMessage = response?.errors ? Object.values(response.errors).flat().join(' ') : response?.message;
      toast({
        title: appliesImmediately ? 'Failed to reschedule' : 'Failed to submit request',
        description: validationMessage || (appliesImmediately
          ? 'There was an error rescheduling the shoot. Please try again.'
          : 'There was an error submitting your reschedule request. Please try again.'),
        variant: "destructive",
      });
    } finally {
      if (submittedRevision === draftSession.current.revision) setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {!canSubmit ? 'Reschedule unavailable' : appliesImmediately ? 'Reschedule Shoot' : 'Request to Reschedule'}
          </DialogTitle>
          <DialogDescription>
            {!canSubmit ? accessMessage : appliesImmediately
              ? 'Select a new date and time. This is applied to the shoot straight away.'
              : 'Select the date and time you would like. The shoot keeps its current slot until our team approves the request.'}
          </DialogDescription>
        </DialogHeader>
        {units.length > 0 && <p className="rounded-lg border bg-muted/40 p-3 text-sm">Whole property · {units.length} units / areas. Moves all unit visits by the same amount, keeping their spacing, assignments, and booked prices. To change one unit, use Edit.</p>}
        
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
                    {schedule.date ? format(parseLocalYmd(schedule.date), 'MMMM d, yyyy') : 'Not scheduled'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">{schedule.time ? formatTimeForDisplay(schedule.time) : 'No time set'}</span>
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
                    {getShootDetailsServiceNames(shoot).map((service, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {service}
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
              <Label>{appliesImmediately ? 'Select New Date' : 'Preferred Date'}</Label>
              <Calendar
                mode="single"
                selected={date}
                defaultMonth={date}
                onSelect={setDate}
                className="border rounded-md p-3"
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{appliesImmediately ? 'Select New Time' : 'Preferred Time'}</Label>
              <TimeSelect
                value={time}
                onChange={setTime}
                startHour={6}
                endHour={21}
                interval={15}
              />
            </div>
            
            <div className="space-y-2">
              <Label>
                {appliesImmediately
                  ? 'Reason for Rescheduling (Optional)'
                  : 'Reason for the Request (Optional)'}
              </Label>
              <Textarea
                placeholder="Enter the reason for rescheduling..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
            {appliesImmediately && durationEntries.length > 0 && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Service duration</p>
                {durationEntries.map(entry => <div key={entry.id} className="space-y-1">
                  <p className="text-xs font-medium">{entry.name}</p>
                  <ServiceDurationPicker serviceName={entry.name} durationSource={entry.durationSource} value={durationChanges[entry.id] ?? entry.duration}
                    disabled={isSubmitting} onChange={minutes => setDurationChanges(current => ({ ...current, [entry.id]: minutes }))} />
                </div>)}
              </div>
            )}
          </div>
        </div>
        
        <TravelFeasibilityPanel travel={travel} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleReschedule} disabled={!canSubmit || isSubmitting || travel.blocked}>
            {isSubmitting
              ? 'Submitting...'
              : !canSubmit
                ? access === 'checking' ? 'Checking permissions...' : 'Reschedule unavailable'
              : appliesImmediately
                ? 'Reschedule Shoot'
                : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
