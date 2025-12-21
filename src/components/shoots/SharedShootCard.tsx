import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  MapPin,
  Cloud,
  MoreHorizontal,
  ChevronRight,
  Layers,
  User,
  Camera,
  Sun,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ShootAction, ShootData } from '@/types/shoots';
import type { Role } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getStateFullName } from '@/utils/stateUtils';
import { formatWorkflowStatus } from '@/utils/status';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

interface SharedShootCardProps {
  shoot: ShootData;
  role: Role;
  onSelect?: (shoot: ShootData) => void;
  onPrimaryAction?: (action: ShootAction, shoot: ShootData) => void;
  onOpenWorkflow?: (shoot: ShootData) => void;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  booked: 'bg-slate-100 text-slate-700 border-slate-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
  raw_uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  editing: 'bg-purple-100 text-purple-700 border-purple-200',
};

const roleDefaultActions: Record<Role, ShootAction> = {
  client: { label: 'View Media', action: 'view_media' },
  photographer: { label: 'Upload RAW', action: 'upload_raw' },
  editor: { label: 'Start Editing', action: 'upload_final' },
  admin: { label: 'Open Workflow', action: 'open_workflow' },
  superadmin: { label: 'Open Workflow', action: 'open_workflow' },
  salesRep: { label: 'View Details', action: 'open_workflow' },
};

export const SharedShootCard: React.FC<SharedShootCardProps> = ({
  shoot,
  role,
  onSelect,
  onPrimaryAction,
  onOpenWorkflow,
}) => {
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const normalizedStatus = String(shoot.workflowStatus || shoot.status || '').toLowerCase();
  const isScheduledOrBooked = normalizedStatus === 'scheduled' || normalizedStatus === 'booked';
  const heroImage = shoot.heroImage || (!isScheduledOrBooked ? '/placeholder.svg' : null);
  const statusClass =
    statusColors[shoot.workflowStatus || shoot.status] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  const primaryAction = shoot.primaryAction || roleDefaultActions[role];
  const isSuperAdmin = role === 'superadmin';
  const isClient = role === 'client';

  const handlePrimary = () => {
    const action = shoot.primaryAction || roleDefaultActions[role];
    if (action.action === 'open_workflow' && onOpenWorkflow) {
      onOpenWorkflow(shoot);
      return;
    }
    onPrimaryAction?.(action, shoot);
  };

  const handlePayNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const payAction: ShootAction = { label: 'Pay now', action: 'pay' };
    onPrimaryAction?.(payAction, shoot);
  };

  const bracketMode = shoot.package?.bracketMode || null;
  const bracketSummary =
    bracketMode && shoot.package?.expectedDeliveredCount
      ? `${bracketMode}-bracket · ${shoot.package.expectedDeliveredCount * bracketMode} RAW expected`
      : null;

  // Determine if payment is complete - Only Super Admin can see payment status
  // Clients can see if their own shoot is paid/unpaid for payment button visibility
  const isPaid = isSuperAdmin || isClient 
    ? (shoot.payment.totalPaid >= shoot.payment.totalQuote)
    : false; // Hide payment status from Admin, Editor, Photographer

  // Format the date
  const formattedDate = shoot.scheduledDate 
    ? formatDate(new Date(shoot.scheduledDate))
    : 'Not scheduled';

  return (
    <Card
      className="overflow-hidden border border-border/70 hover:border-primary/50 transition-all hover:shadow-xl cursor-pointer bg-card/50 backdrop-blur-sm group"
      onClick={() => onSelect?.(shoot)}
    >
      {/* Hero Image */}
      {heroImage && (
        <div className="relative h-56 w-full overflow-hidden">
          <img src={heroImage} alt={shoot.location.address} className="h-full w-full object-cover" loading="lazy" />
        
        {/* Status Badge - Left */}
        <div className="absolute top-4 left-4">
          <Badge 
            className={cn('capitalize text-base font-medium px-6 py-2 rounded-full shadow-lg', statusClass)}
          >
            {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
          </Badge>
        </div>

        {/* Weather & Pay Button - Right */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {shoot.weather?.temperature && (
            <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur px-3 py-1.5 rounded-full shadow-md">
              <Sun className="h-4 w-4 text-orange-500" />
              <span className="font-semibold text-sm">
                {typeof shoot.weather.temperature === 'number' 
                  ? formatTemperature(shoot.weather.temperature)
                  : shoot.weather.temperature}
              </span>
            </div>
          )}
          
          {/* Pay Now Button - Only show to clients for their own shoots if not paid */}
          {isClient && !isPaid && (
            <Button 
              onClick={handlePayNow}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-full shadow-lg"
              size="sm"
            >
              Pay now
            </Button>
          )}
        </div>
        </div>
      )}

      {/* Card Content */}
      <div className="p-6 space-y-5">
        {/* Address & Date Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold leading-tight mb-1.5">{shoot.location.address}</h3>
              <p className="text-base text-muted-foreground mb-2">
                {shoot.location.city}, {getStateFullName(shoot.location.state)} {shoot.location.zip}
              </p>
            </div>
            {/* Date and Time stacked vertically on the right */}
            <div className="flex flex-col items-end gap-1.5 text-sm text-muted-foreground flex-shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{formattedDate}</span>
              </div>
              {shoot.time && shoot.time !== 'TBD' && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">{formatTime(shoot.time)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Services - Prominent Display */}
        {(() => {
          const services = Array.isArray(shoot.services) ? shoot.services : [];
          
          // Always show services section
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Layers className="h-3.5 w-3.5" />
                <span>Services</span>
                {services.length === 0 && (
                  <span className="text-xs text-muted-foreground/50 normal-case font-normal">(Empty)</span>
                )}
              </div>
              {services.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {services.map((service, index) => {
                    const serviceName = typeof service === 'string' 
                      ? service 
                      : (service as any)?.name || (service as any)?.label || String(service);
                    if (!serviceName) return null;
                    return (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="bg-primary/10 text-primary hover:bg-primary/20 font-medium px-3 py-1.5 text-sm rounded-md border border-primary/20"
                      >
                        {serviceName}
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70 italic">No services assigned</p>
              )}
            </div>
          );
        })()}

        {/* Client & Photographer Info */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <User className="h-3.5 w-3.5" />
              <span>Client</span>
            </div>
            <p className="text-sm font-semibold">{shoot.client.name}</p>
            {shoot.client.email && (
              <p className="text-xs text-muted-foreground truncate">{shoot.client.email}</p>
            )}
          </div>
          
          {shoot.photographer?.name && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Camera className="h-3.5 w-3.5" />
                <span>Photographer</span>
              </div>
              <p className="text-sm font-semibold">{shoot.photographer.name}</p>
            </div>
          )}
        </div>

        {/* Additional Info & Metadata */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          {bracketSummary && (
            <Badge variant="secondary" className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium">
              <Layers className="h-3 w-3" />
              {bracketSummary}
            </Badge>
          )}
          {shoot.missingRaw && (
            <Badge variant="destructive" className="rounded-md px-2.5 py-1 text-xs font-medium">
              Missing RAW · {shoot.rawMissingCount}
            </Badge>
          )}
          {shoot.missingFinal && (
            <Badge variant="destructive" className="rounded-md px-2.5 py-1 text-xs font-medium">
              Missing Finals · {shoot.editedMissingCount}
            </Badge>
          )}
          {shoot.payment?.totalQuote && (isSuperAdmin || isClient) && (
            <Badge variant="outline" className="rounded-md px-2.5 py-1 text-xs font-medium">
              ${shoot.payment.totalQuote.toLocaleString()}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};

export default SharedShootCard;

