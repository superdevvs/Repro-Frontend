import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Eye, Edit, Clock, MapPin, User, Calendar } from 'lucide-react';
import { DashboardShootSummary } from '@/types/dashboard';
import { formatWorkflowStatus } from '@/utils/status';
import { ShootApprovalModal } from '@/components/shoots/ShootApprovalModal';
import { ShootDeclineModal } from '@/components/shoots/ShootDeclineModal';
import { cn } from '@/lib/utils';

interface RequestedShootsCardProps {
  shoots: DashboardShootSummary[];
  onPreview?: (shoot: DashboardShootSummary) => void;
  onModify?: (shoot: DashboardShootSummary) => void;
  onRefresh?: () => void;
  photographers?: Array<{ id: string | number; name: string; avatar?: string }>;
  className?: string;
}

export function RequestedShootsCard({
  shoots,
  onPreview,
  onModify,
  onRefresh,
  photographers = [],
  className,
}: RequestedShootsCardProps) {
  const [approvalModalShoot, setApprovalModalShoot] = useState<DashboardShootSummary | null>(null);
  const [declineModalShoot, setDeclineModalShoot] = useState<DashboardShootSummary | null>(null);

  const handleApproved = () => {
    setApprovalModalShoot(null);
    onRefresh?.();
  };

  const handleDeclined = () => {
    setDeclineModalShoot(null);
    onRefresh?.();
  };

  if (shoots.length === 0) {
    return null;
  }

  return (
    <>
      <Card className={cn("border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Shoot Requests
              <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">
                {shoots.length}
              </Badge>
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Pending shoot requests awaiting approval
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {shoots.map((shoot) => (
            <div
              key={shoot.id}
              className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-border shadow-sm"
            >
              <div className="flex flex-col gap-3">
                {/* Address and Client */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground truncate">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{shoot.addressLine}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                      {shoot.cityStateZip}
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="bg-amber-100 text-amber-700 border-amber-300 text-xs"
                  >
                    {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
                  </Badge>
                </div>

                {/* Client and Date */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {shoot.clientName && (
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      <span>{shoot.clientName}</span>
                    </div>
                  )}
                  {shoot.dayLabel && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{shoot.dayLabel}</span>
                      {shoot.timeLabel && <span className="text-muted-foreground">at {shoot.timeLabel}</span>}
                    </div>
                  )}
                </div>

                {/* Services */}
                {shoot.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {shoot.services.slice(0, 3).map((service, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800"
                      >
                        {service.label}
                      </Badge>
                    ))}
                    {shoot.services.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                        +{shoot.services.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                    onClick={() => setApprovalModalShoot(shoot)}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => onModify?.(shoot)}
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Modify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeclineModalShoot(shoot)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => onPreview?.(shoot)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      {approvalModalShoot && (
        <ShootApprovalModal
          isOpen={!!approvalModalShoot}
          onClose={() => setApprovalModalShoot(null)}
          shootId={approvalModalShoot.id}
          shootAddress={approvalModalShoot.addressLine}
          currentScheduledAt={approvalModalShoot.startTime}
          onApproved={handleApproved}
          photographers={photographers}
        />
      )}

      {/* Decline Modal */}
      {declineModalShoot && (
        <ShootDeclineModal
          isOpen={!!declineModalShoot}
          onClose={() => setDeclineModalShoot(null)}
          shootId={declineModalShoot.id}
          shootAddress={declineModalShoot.addressLine}
          onDeclined={handleDeclined}
        />
      )}
    </>
  );
}
