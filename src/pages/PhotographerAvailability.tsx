
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Clock, CheckCircle, XCircle, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/components/auth/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import API_ROUTES from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TimeSelect } from '@/components/ui/time-select';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

const PhotographerAvailability = () => {
  const { user, role } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { formatTime, preferences } = useUserPreferences();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Array<{ id: number; photographer_id: number; date?: string | null; day_of_week?: string | null; start_time: string; end_time: string; status?: 'available'|'unavailable' }>>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStart, setNewStart] = useState<string>('');
  const [newEnd, setNewEnd] = useState<string>('');
  const [isSpecificDate, setIsSpecificDate] = useState(false);

  // UI grid hours for quick toggle (1-hour blocks)
  const gridTimes = useMemo(() => ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'], []);

  const dayOfWeek = useMemo(() => selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() : undefined, [selectedDate]);
  const dateStr = useMemo(() => selectedDate ? formatDate(selectedDate) : undefined, [selectedDate]);
  const slotsForDay = useMemo(() => {
    if (!dayOfWeek) return [] as typeof slots;
    if (isSpecificDate && dateStr) {
      const specific = slots.filter(s => s.date && s.date === dateStr);
      if (specific.length > 0) return specific as any;
      return [] as any;
    }
    return slots.filter(s => !s.date && s.day_of_week === dayOfWeek) as any;
  }, [slots, dayOfWeek, isSpecificDate, dateStr]);
  const toHhMm = (t?: string) => (t ? t.slice(0,5) : '');
  const activeStartSet = useMemo(() => new Set(slotsForDay.map(s => toHhMm(s.start_time))), [slotsForDay]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const res = await fetch(API_ROUTES.photographerAvailability.list(user.id));
        const json = await res.json();
        setSlots(json?.data || []);
      } catch (e) {
        toast({ title: 'Failed to load availability', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const toggleTimeSlot = async (time24: string) => {
    if (!dayOfWeek || !user?.id) return;
    // exists? then delete that 1-hour slot, else create it
    const existing = slotsForDay.find(s => toHhMm(s.start_time) === time24);
    if (existing) {
      try {
        await fetch(API_ROUTES.photographerAvailability.delete(existing.id), { method: 'DELETE' });
        setSlots(prev => prev.filter(s => s.id !== existing.id));
      } catch (e) {
        toast({ title: 'Failed to remove slot', variant: 'destructive' });
      }
    } else {
      // create 1-hour block
      const end = addOneHour(time24);
      const payload: any = { photographer_id: user.id, start_time: time24, end_time: end };
      if (isSpecificDate && dateStr) {
        payload.date = dateStr;
      } else {
        payload.day_of_week = dayOfWeek;
      }
      try {
        const res = await fetch(API_ROUTES.photographerAvailability.create, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json?.data) setSlots(prev => [...prev, json.data]);
      } catch (e) {
        toast({ title: 'Failed to add slot', variant: 'destructive' });
      }
    }
  };

  const handleSaveAvailability = () => {
    toast({ title: 'Already saved', description: 'Toggles update immediately.' });
  };

  const addOneHour = (time24: string) => {
    const [h, m] = time24.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    d.setHours(d.getHours() + 1);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const handleAddInterval = async () => {
    if (!dayOfWeek || !user?.id || !newStart || !newEnd) return;
    const payload: any = { photographer_id: user.id, start_time: newStart, end_time: newEnd };
    if (isSpecificDate && dateStr) payload.date = dateStr; else payload.day_of_week = dayOfWeek;
    try {
      const res = await fetch(API_ROUTES.photographerAvailability.create, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json?.data) setSlots(prev => [...prev, json.data]);
      setIsAddOpen(false); setNewStart(''); setNewEnd('');
    } catch (e) {
      toast({ title: 'Failed to add interval', variant: 'destructive' });
    }
  };

  function formatDate(d: Date) {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-6 px-4">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full inline-block mb-4"></div>
              <p>Loading your availability settings...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (role !== 'photographer') {
    return null; // This should not render as we redirect in useEffect
  }

  return (
    <DashboardLayout>
      <div className="container py-4 sm:py-6 px-2 sm:px-4 md:px-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You are viewing your personal availability settings. Only you can see and edit these settings.
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 sm:gap-6">
          {/* Calendar Section */}
          <Card className="w-full md:w-1/2 shadow-md">
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Select Date</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="w-full max-w-full mx-auto"
                />
              </div>
            </CardContent>
          </Card>

          {/* Time Slots Section */}
          <Card className="w-full md:w-1/2 shadow-md mt-4 md:mt-0">
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Your Available Time Slots</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              <div className="text-center mb-3 sm:mb-4">
                {selectedDate ? (
                  <p className="text-sm sm:text-base md:text-lg font-medium">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">Please select a date</p>
                )}
              </div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-muted-foreground">Mode:</div>
                <div className="flex items-center gap-2">
                  <button
                    className={`text-xs px-2 py-1 rounded border ${!isSpecificDate ? 'bg-primary text-white' : 'bg-white'}`}
                    onClick={() => setIsSpecificDate(false)}
                  >Weekly Template</button>
                  <button
                    className={`text-xs px-2 py-1 rounded border ${isSpecificDate ? 'bg-primary text-white' : 'bg-white'}`}
                    onClick={() => setIsSpecificDate(true)}
                  >This Date Only</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-2">
                {gridTimes.map((t) => {
                  const isAvailable = activeStartSet.has(t);
                  return (
                    <div
                      key={t}
                      onClick={() => toggleTimeSlot(t)}
                      className={`
                        p-2 sm:p-3 rounded-md border text-center cursor-pointer transition-all flex flex-col items-center justify-center
                        ${isAvailable ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-white border-gray-200 hover:bg-gray-50'}
                      `}
                    >
                      <span className="text-xs sm:text-sm font-medium">{formatTime(t)}</span>
                      {isAvailable ? (
                        <span className="text-[10px] sm:text-xs text-green-600 flex items-center mt-1">
                          <CheckCircle className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                          Available
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-xs text-gray-500 flex items-center mt-1">
                          <XCircle className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                          Unavailable
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 sm:mt-6 flex gap-2">
                <Button onClick={() => setIsAddOpen(true)} variant="outline" className="w-1/2 text-sm sm:text-base"><Plus className="mr-2 h-4 w-4"/>Add Interval</Button>
                <Button onClick={handleSaveAvailability} className="w-1/2 text-sm sm:text-base">Save Availability</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Interval Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Availability Interval</DialogTitle>
              <DialogDescription>
                {isSpecificDate ? 'Specific date' : 'Weekly template'} for {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <TimeSelect value={newStart} onChange={setNewStart} placeholder="Select start time" />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <TimeSelect value={newEnd} onChange={setNewEnd} placeholder="Select end time" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddInterval} disabled={!newStart || !newEnd}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mobile View Legend - only show on mobile */}
        {isMobile && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 border rounded-md bg-gray-50">
            <h3 className="text-sm font-medium mb-2">Legend</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500 mr-2"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gray-400 mr-2"></div>
                <span>Unavailable</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500 mr-2"></div>
                <span>Booked</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PhotographerAvailability;
