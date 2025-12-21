
import React from 'react';
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link2, ExternalLink, PaperclipIcon, Share2Icon } from "lucide-react";
import { format } from 'date-fns';
import { ShootData } from '@/types/shoots';
import { toast } from "sonner";
import { getStateFullName } from '@/utils/stateUtils';
import {
  HomeIcon,
  CalendarIcon,
  ClockIcon,
  CameraIcon,
  UsersIcon,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ShootDetailContentProps {
  shoot: ShootData;
  isAdmin: boolean;
}

export function ShootDetailContent({ shoot, isAdmin }: ShootDetailContentProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return format(new Date(dateString), 'MMMM d, yyyy');
  };

  const openTourLink = (url?: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const copyToClipboard = (text: string, successMessage: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(successMessage);
    }).catch(err => {
      toast.error("Failed to copy text");
      console.error('Failed to copy text:', err);
    });
  };

  const copyAddress = () => {
    const fullAddress = `${shoot.location.address}, ${shoot.location.city}, ${getStateFullName(shoot.location.state)} ${shoot.location.zip}`;
    copyToClipboard(fullAddress, "Address copied to clipboard");
  };

  const shareShoot = () => {
    toast.success("Share link generated", {
      description: "A shareable link has been copied to your clipboard",
    });
  };

  // Helper function to safely get tour links
  const hasTourLinks = () => {
    return shoot.tourLinks && Object.values(shoot.tourLinks).some(link => !!link);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Client Information</h3>
          <div className="flex items-start gap-3">
            <UsersIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">{shoot.client.name}</p>
              <p className="text-sm text-muted-foreground">{shoot.client.email}</p>
              {shoot.client.phone && (
                <p className="text-sm text-muted-foreground">{shoot.client.phone}</p>
              )}
              {shoot.client.company && (
                <p className="text-sm text-muted-foreground">{shoot.client.company}</p>
              )}
              {shoot.client.totalShoots && (
                <Badge variant="outline" className="mt-1">
                  {shoot.client.totalShoots} Total Shoots
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-muted-foreground">Property Information</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={copyAddress}
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Copy address</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-start gap-3">
            <HomeIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">{shoot.location.address}</p>
              {shoot.location.address2 && (
                <p className="text-sm">{shoot.location.address2}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {shoot.location.city}, {getStateFullName(shoot.location.state)} {shoot.location.zip}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Photographer</h3>
          <div className="flex items-start gap-3">
            <CameraIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">{shoot.photographer.name}</p>
            </div>
          </div>
        </div>


        {/* <Separator /> */}
        {/* <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Tour Links</h3>
              <div className="space-y-2">
                {shoot.tourLinks?.matterport && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Matterport Tour</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7"
                      onClick={() => openTourLink(shoot.tourLinks?.matterport)}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                  </div>
                )}
                {shoot.tourLinks?.iGuide && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">iGuide Tour</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7"
                      onClick={() => openTourLink(shoot.tourLinks?.iGuide)}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                  </div>
                )}
                {shoot.tourLinks?.cubicasa && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Cubicasa Tour</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7"
                      onClick={() => openTourLink(shoot.tourLinks?.cubicasa)}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                  </div>
                )}
              </div>
            </div> */}



        {/* <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={shareShoot}
            >
              <Share2Icon className="h-3.5 w-3.5 mr-1.5" />
              Share Details
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8"
            >
              <PaperclipIcon className="h-3.5 w-3.5 mr-1.5" />
              Attach Files
            </Button>
          </div>
        </div> */}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Schedule</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Date</p>
                <p className="font-medium">{formatDate(shoot.scheduledDate)}</p>
              </div>
            </div>

            {shoot.completedDate && (
              <div className="flex items-start gap-3">
                <ClockIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Completed Date</p>
                  <p className="font-medium">{formatDate(shoot.completedDate)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Services</h3>
          <div className="flex flex-wrap gap-2">
            {shoot.services.length > 0 ? (
              shoot.services.map((service, index) => (
                <Badge key={index} variant="outline" className="bg-primary/10">
                  {service}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No services selected</p>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Payment Details</h3>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Quote:</span>
              <span>${shoot.payment.baseQuote.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({shoot.payment.taxRate}%):</span>
              <span>${shoot.payment.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Total Quote:</span>
              <span>${shoot.payment.totalQuote.toFixed(2)}</span>
            </div>

            {shoot.payment.totalPaid !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Paid:</span>
                <span>${shoot.payment.totalPaid.toFixed(2)}</span>
              </div>
            )}

            {shoot.payment.lastPaymentDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Payment:</span>
                <span>{formatDate(shoot.payment.lastPaymentDate)} ({shoot.payment.lastPaymentType})</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

      </div>
    </div>
  );
}
