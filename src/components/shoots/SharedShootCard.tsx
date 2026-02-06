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
  Check,
  X,
  Edit,
  Trash2,
  FileText,
  Send,
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
  onApprove?: (shoot: ShootData) => void;
  onDecline?: (shoot: ShootData) => void;
  onModify?: (shoot: ShootData) => void;
  onDelete?: (shoot: ShootData) => void;
  onViewInvoice?: (shoot: ShootData) => void;
  onSendToEditing?: (shoot: ShootData) => void;
  shouldHideClientDetails?: boolean;
}

const statusColors: Record<string, string> = {
  // Main status colors
  requested: 'bg-blue-100 text-blue-700 border-blue-300',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  booked: 'bg-blue-100 text-blue-700 border-blue-200', // Alias for scheduled
  uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  editing: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  
  // Legacy/alias statuses
  completed: 'bg-indigo-100 text-indigo-700 border-indigo-200', // Maps to uploaded
  raw_uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  photos_uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  review: 'bg-orange-100 text-orange-700 border-orange-200',
  pending_review: 'bg-orange-100 text-orange-700 border-orange-200',
  ready_for_client: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  admin_verified: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  
  // Other statuses
  on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
  declined: 'bg-red-100 text-red-700 border-red-200',
  canceled: 'bg-gray-100 text-gray-700 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
};

const roleDefaultActions: Record<Role, ShootAction> = {
  client: { label: 'View Media', action: 'view_media' },
  photographer: { label: 'Upload RAW', action: 'upload_raw' },
  editor: { label: 'Start Editing', action: 'upload_final' },
  editing_manager: { label: 'Open Workflow', action: 'open_workflow' },
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
  onApprove,
  onDecline,
  onModify,
  onDelete,
  onViewInvoice,
  onSendToEditing,
  shouldHideClientDetails = false,
}) => {
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const normalizedStatus = String(shoot.workflowStatus || shoot.status || '').toLowerCase();
  const isPreShootStatus = normalizedStatus === 'scheduled' || normalizedStatus === 'booked' || normalizedStatus === 'requested' || normalizedStatus === 'on_hold';
  const heroImage = shoot.heroImage || (!isPreShootStatus ? '/placeholder.svg' : null);
  // Get status color - check both workflowStatus and status, and handle case-insensitive lookup
  const statusKey = normalizedStatus;
  const statusClass =
    statusColors[statusKey] || 
    statusColors[shoot.workflowStatus || ''] || 
    statusColors[shoot.status || ''] || 
    'bg-slate-100 text-slate-700 border-slate-200';
  const primaryAction = shoot.primaryAction || roleDefaultActions[role];
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin';
  const isEditingManager = role === 'editing_manager';
  const isEditor = role === 'editor';
  const isClient = role === 'client';
  const canDelete = (isSuperAdmin || isAdmin) && onDelete;
  const editingNotes = shoot.notes && typeof shoot.notes === 'object' && !Array.isArray(shoot.notes)
    ? (shoot.notes as any)?.editingNotes
    : undefined;
  const canShowEditingNotes = Boolean(editingNotes) && (isSuperAdmin || isAdmin || isEditingManager || isEditor);
  const shootStatus = String(shoot.workflowStatus || shoot.status || '').toLowerCase();
  const canSendToEditing = Boolean(onSendToEditing) && shootStatus === 'uploaded';

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
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <Badge 
            className={cn('capitalize text-base font-medium px-6 py-2 rounded-full shadow-lg', statusClass)}
          >
            {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
          </Badge>
          {canShowEditingNotes && (
            <Badge className="bg-purple-500/90 text-white border-purple-400 text-xs px-3 py-1 rounded-full shadow-lg">
              Editing Notes
            </Badge>
          )}
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
          
          {/* Send to Editing Button */}
          {canSendToEditing && (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onSendToEditing?.(shoot);
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              size="sm"
              variant="outline"
              title="Send to Editing"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
          
          {/* Invoice Button - Available for all roles */}
          {onViewInvoice && (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onViewInvoice(shoot);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              size="sm"
              variant="outline"
              title="View Invoice"
            >
              <FileText className="h-4 w-4" />
            </Button>
          )}
          
          {/* Delete Button - Only for admin/superadmin */}
          {canDelete && (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(shoot);
              }}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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
        <div
          className={cn(
            'grid gap-4 pt-2 border-t border-border/50',
            shouldHideClientDetails ? 'grid-cols-1' : 'grid-cols-2'
          )}
        >
          {!shouldHideClientDetails && (
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
          )}
          
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
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-2">
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
          {/* Invoice Button - Show in card content when no hero image */}
          {!heroImage && onViewInvoice && (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onViewInvoice(shoot);
              }}
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              title="View Invoice"
            >
              <FileText className="h-3.5 w-3.5" />
              Invoice
            </Button>
          )}
        </div>

        {/* Action buttons for requested shoots - Only visible to admin/superadmin */}
        {normalizedStatus === 'requested' && (isAdmin || isSuperAdmin) && (onApprove || onDecline || onModify) && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-blue-200">
            {onApprove && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(shoot);
                }}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
            )}
            {onModify && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onModify(shoot);
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Modify
              </Button>
            )}
            {onDecline && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDecline(shoot);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Decline
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default SharedShootCard;

