import React from "react";
import { format, parseISO } from "date-fns";
import { Calendar, CreditCard, Download, Ghost, Image as ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getShootClientReleaseAccess } from "@/components/shoots/details/shootClientReleaseAccess";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { formatWorkflowStatus } from "@/utils/status";
import { getSpecialInstructions } from "@/utils/dashboardDerivedUtils";

import type { ClientShootTileProps } from "../types";
import { getClientDeliveredMedia } from "../utils";
import { ClientPaymentPill } from "./ClientPaymentPill";

export const ClientShootTile: React.FC<ClientShootTileProps> = React.memo(({
  record,
  variant,
  onSelect,
  onReschedule,
  onCancel,
  onContactSupport,
  onDownload,
  onRebook,
  onRequestRevision,
  onHoldAction,
  onPayment,
}) => {
  const { formatTime, formatDate } = useUserPreferences();
  const { data, summary } = record;
  
  const totalQuote = data.payment?.totalQuote ?? 0;
  const totalPaid = data.payment?.totalPaid ?? 0;
  const paymentStatus = summary.paymentStatus ?? "unpaid";
  const clientReleaseAccess = getShootClientReleaseAccess(data, true);
  const balanceDue = Math.max(totalQuote - totalPaid, 0);
  const hasPendingPayment = totalQuote > 0 && balanceDue > 0 && paymentStatus !== "paid";
  const startDate = summary.startTime ? new Date(summary.startTime) : null;
  const completedDate = data.completedDate ? parseISO(data.completedDate) : null;
  const dateLabel = variant === "completed" && completedDate
    ? formatDate(completedDate)
    : startDate
      ? formatDate(startDate)
      : data.scheduledDate
        ? formatDate(parseISO(data.scheduledDate))
        : "Date TBD";
  const timeLabel = formatTime(summary.timeLabel || data.time || (variant === "completed" ? "Delivered" : "Time TBD"));
  const services = data.services?.length ? data.services : summary.services.map((service) => service.label);
  const instructions = getSpecialInstructions(data);
  const statusLabel = formatWorkflowStatus(summary.workflowStatus || summary.status);
  const weatherLabel = summary.temperature || "—";
  const photographerLabel = data.photographer?.name ? `${data.photographer.name}${data.photographer.avatar ? "" : ""}` : "Assigning";

  const holdActionLabel = (() => {
    const status = (summary.workflowStatus || summary.status || "").toLowerCase();
    if (status.includes("payment")) return "Pay invoice";
    if (status.includes("access")) return "Provide access info";
    if (status.includes("reschedule")) return "Confirm reschedule";
    if (status.includes("document")) return "Upload documents";
    return "Contact support";
  })();

  const serviceBadges = services.slice(0, 4);
  const overflow = services.length - serviceBadges.length;

  if (variant === "completed") {
    const deliveredMedia = getClientDeliveredMedia(data);
    const coverPhoto = deliveredMedia.coverPhoto;
    const totalCount = deliveredMedia.count;

    return (
      <div
        className="group relative rounded-2xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-300 bg-card cursor-pointer hover:shadow-xl hover:shadow-primary/5"
        onClick={() => onSelect(record)}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Left - large cover photo with gradient overlay */}
          <div className="relative w-full sm:w-[280px] md:w-[320px] flex-shrink-0">
            {coverPhoto ? (
              <>
                <img
                  src={coverPhoto}
                  alt={summary.addressLine}
                  className="w-full h-[180px] sm:h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/30 hidden sm:block" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent sm:hidden" />
              </>
            ) : (
              <div className="w-full h-[180px] sm:h-full bg-muted flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-muted-foreground/20" />
              </div>
            )}
            {/* Photo count pill */}
            {totalCount > 0 && (
              <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3" />
                {totalCount} photo{totalCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Right - property details */}
          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between gap-3 min-w-0">
            <div className="space-y-2.5">
              {/* Address */}
              <div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight truncate group-hover:text-primary transition-colors">
                  {summary.addressLine}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{dateLabel} &middot; {timeLabel}</span>
                </div>
              </div>

              {/* Service tags */}
              <div className="flex flex-wrap gap-1.5">
                {serviceBadges.map((service) => (
                  <span key={service} className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border/50">
                    {service}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border/50">
                    +{overflow} more
                  </span>
                )}
              </div>

              {/* Instructions (if any) */}
              {instructions && (
                <p className="text-xs text-muted-foreground/80 line-clamp-1"><span className="font-medium text-muted-foreground not-italic">Notes: </span><span className="italic">&ldquo;{instructions}&rdquo;</span></p>
              )}
            </div>

            {/* Bottom row: status + actions */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/30">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] sm:text-[11px] h-6 px-2.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  Delivered
                </Badge>
                {data.isGhostVisibleForUser ? (
                  <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20 hover:bg-slate-500/15 text-[10px] sm:text-[11px] h-6 px-2.5 font-semibold">
                    <Ghost className="mr-1.5 h-3.5 w-3.5" />
                    Ghost Access
                  </Badge>
                ) : null}
                <ClientPaymentPill status={paymentStatus} />
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {hasPendingPayment && onPayment && (
                  <Button
                    size="sm"
                    className="h-8 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={() => onPayment(record)}
                  >
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                    Pay ${balanceDue.toFixed(2)}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8 text-xs px-3 shadow-sm" onClick={() => onDownload(record)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Downloads
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default layout for upcoming and hold variants
  return (
    <div className="border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3 sm:space-y-4 hover:border-primary/40 transition-colors bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {dateLabel} • {timeLabel}
          </p>
          <button onClick={() => onSelect(record)} className="text-base sm:text-lg font-semibold text-left hover:underline break-words">
            {summary.addressLine}
          </button>
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
            {serviceBadges.map((service) => (
              <Badge key={service} variant="outline" className="rounded-full text-[10px] sm:text-xs">
                {service}
              </Badge>
            ))}
            {overflow > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px] sm:text-xs">
                +{overflow}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <Badge variant="outline" className="uppercase tracking-widest text-[9px] sm:text-[10px]">
            {statusLabel}
          </Badge>
        </div>
      </div>

      {variant !== "hold" && (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Photographer{" "}
            <span className="text-foreground font-semibold">
              • {photographerLabel}
            </span>
          </p>
          {instructions && (
            <p className="line-clamp-2">
              Instructions: <span className="text-foreground">{instructions}</span>
            </p>
          )}
        </div>
      )}

      {variant === "hold" && (
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Reason: {data.adminIssueNotes || "Awaiting your action"}</p>
          <p className="text-xs">
            Scheduled for {summary.startTime ? format(new Date(summary.startTime), "MMM d, h:mm a") : "TBD"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {variant === "upcoming" && (
            <>
              <Button size="sm" className="text-xs sm:text-sm" onClick={() => onReschedule(record)}>
                Reschedule
              </Button>
              <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={onContactSupport}>
                Contact support
              </Button>
              {/* Only show cancel button for requested shoots (not yet approved) */}
              {(summary.workflowStatus || summary.status || '').toLowerCase() === 'requested' && (
                <Button 
                  size="sm"
                  variant="destructive"
                  className="text-xs sm:text-sm"
                  onClick={() => onCancel(record)}
                >
                  Cancel shoot
                </Button>
              )}
            </>
          )}
          {variant === "hold" && (
            <>
              <Button size="sm" className="text-xs sm:text-sm" onClick={() => onHoldAction(record)}>
                {holdActionLabel}
              </Button>
              <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={onContactSupport}>
                Contact support
              </Button>
            </>
          )}
        </div>
        {hasPendingPayment && onPayment && (
          <Button 
            size="sm" 
            variant="default"
            className="text-xs sm:text-sm bg-green-600 hover:bg-green-700"
            onClick={() => onPayment(record)}
          >
            <CreditCard className="w-3 h-3 mr-1" />
            Pay ${balanceDue.toFixed(2)}
          </Button>
        )}
        {variant === "upcoming" && clientReleaseAccess.canClientDownload && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs sm:text-sm"
            onClick={() => onDownload(record)}
          >
            <Download className="w-3 h-3 mr-1" />
            Downloads
          </Button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for ClientShootTile
  return (
    prevProps.record === nextProps.record &&
    prevProps.variant === nextProps.variant &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onReschedule === nextProps.onReschedule &&
    prevProps.onCancel === nextProps.onCancel &&
    prevProps.onContactSupport === nextProps.onContactSupport &&
    prevProps.onDownload === nextProps.onDownload &&
    prevProps.onRebook === nextProps.onRebook &&
    prevProps.onRequestRevision === nextProps.onRequestRevision &&
    prevProps.onHoldAction === nextProps.onHoldAction &&
    prevProps.onPayment === nextProps.onPayment
  );
});
