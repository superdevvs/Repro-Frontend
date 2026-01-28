import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShootSummary } from '@/types/dashboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Camera,
  Phone,
  Mail,
  Sun,
  UploadCloud,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Download,
  Info,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getWeatherForLocation, WeatherInfo } from '@/services/weatherService';
import { subscribeToWeatherProvider } from '@/state/weatherProviderStore';
import { getStateFullName } from '@/utils/stateUtils';
import { formatWorkflowStatus } from '@/utils/status';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { RawImagePreview } from '@/components/media/RawImagePreview';

interface ShootDetailsModalProps {
  shoot: DashboardShootSummary | null;
  onClose: () => void;
  onViewInvoice?: (shoot: DashboardShootSummary) => void;
}

interface ShootDetailResponse {
  id: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  scheduled_date?: string;
  time?: string;
  status?: string;
  workflow_status?: string;
  client?: { name: string; email: string; phonenumber?: string };
  photographer?: { name: string; email: string };
  service?: { name: string };
  total_quote?: number | string;
  total_paid?: number | string;
}

const splitServices = (services: DashboardShootSummary['services']) =>
  services.flatMap(service => {
    const parts = service.label.split(/[,;]+/).map(part => part.trim()).filter(Boolean);
    if (parts.length === 0) return [service.label];
    return parts;
  });

const MEDIA_PLACEHOLDERS = (seed: number) =>
  Array.from({ length: 9 }).map((_, index) => ({
    id: `${seed}-${index}`,
    url: `https://images.unsplash.com/photo-${(seed + index) % 1000}?auto=format&fit=crop&w=600&q=80`,
    type: index % 3 === 0 ? 'image' : index % 3 === 1 ? 'video' : 'floorplan',
  }));

const TIMELINE_ENTRIES = [
  { id: '1', label: 'Shoot scheduled', timestamp: '09:12 AM', user: 'Ops team', type: 'info' },
  { id: '2', label: 'Photographer assigned', timestamp: '09:14 AM', user: 'Dispatch', type: 'info' },
  { id: '3', label: 'Raw upload received', timestamp: '02:40 PM', user: 'Mike Chen', type: 'success' },
  { id: '4', label: 'Editor flagged missing shots', timestamp: '03:15 PM', user: 'Editing', type: 'warning' },
];

export const ShootDetailsModal: React.FC<ShootDetailsModalProps> = ({ shoot, onClose, onViewInvoice }) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const [detail, setDetail] = useState<ShootDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);
  const [mediaTab, setMediaTab] = useState<'raw' | 'edited'>('raw');

  useEffect(() => {
    const unsubscribe = subscribeToWeatherProvider(() =>
      setProviderVersion((version) => version + 1),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!shoot) {
      setDetail(null);
      setWeather(null);
      return;
    }

    const token =
      session?.accessToken ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('token');

    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'Please log in again to view shoot details.',
        variant: 'destructive',
      });
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.message || 'Failed to load shoot details');
        }
        setDetail(json.data);
      } catch (error) {
        toast({
          title: 'Unable to load shoot',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [shoot, session?.accessToken, toast]);

  useEffect(() => {
    if (!shoot) {
      setWeather(null);
      return;
    }

    const location = shoot.cityStateZip || shoot.addressLine;
    if (!location) {
      setWeather(null);
      return;
    }

    const controller = new AbortController();
    setWeather(null);

    const dateInput =
      shoot.startTime && !Number.isNaN(Date.parse(shoot.startTime)) ? shoot.startTime : null;

    getWeatherForLocation(location, dateInput, controller.signal)
      .then((info) => {
        setWeather(info || null);
      })
      .catch(() => {
        setWeather(null);
      });

    return () => {
      controller.abort();
    };
  }, [
    shoot?.id,
    shoot?.cityStateZip,
    shoot?.addressLine,
    shoot?.startTime,
    shoot?.timeLabel,
    providerVersion,
  ]);

  if (!shoot) return null;

  const statusText = formatWorkflowStatus(detail?.workflow_status || shoot.workflowStatus || shoot.status);
  const services = splitServices(shoot.services);
  const mediaFiles = MEDIA_PLACEHOLDERS(shoot.id);

  return (
    <Dialog open={Boolean(shoot)} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl bg-card text-card-foreground border border-border p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading shoot details…</div>
        ) : (
          <div className="flex h-[80vh] divide-x divide-border">
            <div className="w-5/12 flex flex-col">
              <div className="p-6 border-b border-border bg-background">
                <div className="flex items-start justify-between">
                  <Badge variant="outline" className="uppercase text-[10px] font-semibold">
                    {statusText}
                  </Badge>
                  <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
                    <Sun size={14} />
                    <span>{(() => {
                      const temp = weather?.temperature ?? shoot.temperature;
                      if (!temp) return '--°';
                      if (typeof temp === 'number') return formatTemperature(temp);
                      const match = String(temp).match(/^(-?\d+)/);
                      if (match) return formatTemperature(parseInt(match[1], 10));
                      return temp;
                    })()}</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground mt-3">
                  {shoot.id ? `#${shoot.id} · ` : ''}
                  {shoot.addressLine}
                </h2>
                <p className="text-sm text-muted-foreground">{shoot.cityStateZip}</p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 border border-border rounded-2xl bg-muted/30">
                    <div className="flex items-center gap-2 text-primary text-xs font-semibold mb-1">
                      <Calendar size={14} /> Date & time
                    </div>
                    <p className="font-semibold text-foreground">{shoot.timeLabel ? formatTime(shoot.timeLabel) : 'TBD'}</p>
                    {detail?.scheduled_date && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(new Date(detail.scheduled_date))}
                      </p>
                    )}
                  </div>
                  <div className="p-4 border border-border rounded-2xl bg-muted/30">
                    <div className="flex items-center gap-2 text-primary text-xs font-semibold mb-1">
                      <MapPin size={14} /> Location
                    </div>
                    <p className="font-semibold text-foreground">
                      {detail?.address || shoot.addressLine || 'Address TBD'}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    Services ordered
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(services.length ? services.slice(0, 5) : ['General package']).map((service) => (
                      <Badge
                        key={service}
                        variant="secondary"
                        className="rounded-full px-3 py-1 text-[11px] font-semibold"
                      >
                        {service}
                      </Badge>
                    ))}
                    {services.length > 5 && (
                      <span className="px-2 py-1 text-[11px] text-muted-foreground bg-muted/40 rounded-full border border-dashed border-border">
                        +{services.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Team & contacts
                  </h3>
                  <div className="flex items-center gap-3 p-3 border border-border rounded-xl bg-background">
                    <User size={16} className="text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold text-foreground">{detail?.client?.name || shoot.clientName || 'Client TBD'}</p>
                      <p className="text-xs text-muted-foreground">
                        {detail?.client?.phonenumber || detail?.client?.email || 'No contact on file'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border border-border rounded-xl bg-background">
                    <Camera size={16} className="text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold text-foreground">
                        {detail?.photographer?.name || shoot.photographer?.name || 'Photographer unassigned'}
                      </p>
                      <p className="text-xs text-muted-foreground">Lead shooter</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="flex items-center justify-center gap-2 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                      <Phone size={14} /> Call client
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                      <Mail size={14} /> Email photographer
                    </button>
                  </div>
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Quick actions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                      <UploadCloud size={14} /> Upload RAW
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                      <FileText size={14} /> Add note
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                      <Send size={14} /> Dispatch editor
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors">
                      <CheckCircle2 size={14} /> Mark complete
                    </button>
                  </div>
                  {onViewInvoice && shoot && (
                    <button
                      onClick={() => onViewInvoice(shoot)}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors w-full mt-3"
                    >
                      <FileText size={14} /> View Invoice
                    </button>
                  )}
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Activity timeline
                  </h3>
                  <div className="border-l border-border/60 pl-4 space-y-4">
                    {TIMELINE_ENTRIES.map((event, index) => (
                      <div key={event.id} className="relative">
                        <span
                          className={cn(
                            'absolute -left-[21px] w-3 h-3 rounded-full border-2 border-white shadow',
                            event.type === 'success'
                              ? 'bg-emerald-500'
                              : event.type === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-primary',
                          )}
                        />
                        <p className="text-sm font-semibold text-foreground">{event.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {event.timestamp} • {event.user}
                        </p>
                        {index < TIMELINE_ENTRIES.length - 1 && (
                          <div className="absolute -left-[15px] top-3 bottom-[-16px] w-px bg-border/70" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="w-7/12 flex flex-col bg-muted/30">
              <div className="border-b border-border bg-background px-6 pt-4">
                <div className="flex gap-6">
                  {(['raw', 'edited'] as Array<'raw' | 'edited'>).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setMediaTab(tab)}
                      className={cn(
                        'pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
                        mediaTab === tab
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tab === 'raw' ? <UploadCloud size={14} /> : <CheckCircle2 size={14} />}
                      {tab === 'raw' ? 'RAW uploads' : 'Edited media'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 flex gap-3 border-b border-border bg-background/80">
                {mediaTab === 'raw' ? (
                  <>
                    <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                      <UploadCloud size={12} /> Upload more
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                      <PlayCircle size={12} /> Start editing
                    </button>
                  </>
                ) : (
                  <>
                    <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">
                      <UploadCloud size={12} /> Upload edits
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors">
                      <Send size={12} /> Deliver to client
                    </button>
                  </>
                )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="grid grid-cols-3 gap-4">
                  {mediaFiles
                    .filter((_, index) => (mediaTab === 'raw' ? index % 2 === 0 : index % 2 === 1))
                    .map((file) => (
                      <div
                        key={file.id}
                        className="relative aspect-square rounded-2xl overflow-hidden border border-border/60 group"
                      >
                        <RawImagePreview
                          src={file.url}
                          filename={file.id}
                          filePath={file.url}
                          containerClassName="h-full w-full"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white">
                          <span className="uppercase font-semibold">{file.type}</span>
                          <div className="flex gap-1">
                            <button className="p-1 rounded-full bg-white/80 text-slate-800 hover:bg-white">
                              <Download size={12} />
                            </button>
                            <button className="p-1 rounded-full bg-white/80 text-slate-800 hover:bg-white">
                              <Info size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="p-4 border-t border-border bg-background">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-200">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Issues flagged</p>
                    <p className="text-[11px] text-amber-700">2 items awaiting resolution</p>
                  </div>
                  <ChevronRight size={16} className="text-amber-600" />
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

