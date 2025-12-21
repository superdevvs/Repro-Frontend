import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import type { ShootData } from '@/types/shoots';
import { format } from 'date-fns';
import { User, Camera, Building, DollarSign, List, Info, Clock, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/env';
import { SquarePaymentDialog } from '@/components/payments/SquarePaymentDialog';

interface ShootDetailDialogProps {
  shoot: ShootData | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) => (
  <div className="flex items-start text-sm">
    <Icon className="h-4 w-4 mr-3 mt-1 text-muted-foreground flex-shrink-0" />
    <div className="flex flex-col">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || 'Not Available'}</span>
    </div>
  </div>
);

export const ShootDetailDialog = ({ shoot, isOpen, onOpenChange }: ShootDetailDialogProps) => {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const { toast } = useToast();

  if (!shoot) return null;

  const formattedDate = shoot.scheduledDate ? format(new Date(shoot.scheduledDate), 'EEEE, MMMM dd, yy') : 'Not Scheduled';
  const amountDue = shoot.payment.totalQuote - shoot.payment.totalPaid;
  const isPaid = amountDue <= 0.01; // Use a small epsilon for float comparison

  const handlePaymentSuccess = (payment: any) => {
    toast({
      title: "Payment Successful",
      description: `Payment of $${amountDue.toFixed(2)} has been processed successfully.`,
    });
    // Refresh the shoot data or close dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background text-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl">{shoot.location.address}</DialogTitle>
          <DialogDescription>{shoot.location.fullAddress}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold mb-2">Shoot Details</h3>
            <DetailRow icon={CalendarIcon} label="Date" value={formattedDate} />
            <DetailRow icon={Clock} label="Time" value={shoot.time} />
            <DetailRow icon={Info} label="Status" value={<Badge className="capitalize">{shoot.status}</Badge>} />
            <DetailRow icon={Camera} label="Assigned Photographer" value={shoot.photographer.name} />
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold mb-2">Client Details</h3>
            <DetailRow icon={Building} label="Client Name" value={shoot.client.name} />
            <DetailRow icon={User} label="Contact Email" value={shoot.client.email} />
            <DetailRow icon={List} label="Services" value={
              <div className="flex flex-wrap gap-2 mt-1">
                {shoot.services.map((service, i) => <Badge key={i} variant="secondary">{service}</Badge>)}
              </div>
            } />
          </div>
        </div>

        <DialogFooter className="border-t pt-4 flex sm:justify-between items-center">
            <div className="text-left">
                <p className="text-sm text-muted-foreground">Amount Due</p>
                <p className="text-xl font-bold text-green-500">${amountDue.toFixed(2)}</p>
            </div>
            {isPaid ? (
                <Button disabled variant="outline">Fully Paid</Button>
            ) : (
                <Button onClick={() => setIsPaymentDialogOpen(true)} size="lg">
                  Pay ${amountDue.toFixed(2)}
                </Button>
            )}
        </DialogFooter>
      </DialogContent>

      <SquarePaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        amount={amountDue}
        shootId={shoot.id}
        shootAddress={shoot.location.fullAddress}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </Dialog>
  );
};