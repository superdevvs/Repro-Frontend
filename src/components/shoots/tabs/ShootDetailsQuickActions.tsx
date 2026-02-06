import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  UserPlus,
  Send,
  Eye,
  DollarSignIcon,
  Download,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { MarkAsPaidDialog, MarkAsPaidPayload } from '@/components/payments/MarkAsPaidDialog';

interface ShootDetailsQuickActionsProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  role: string;
  isEditMode?: boolean;
  onShootUpdate: () => void;
  onProcessPayment?: () => void;
  onViewInvoice?: () => void;
  onDownloadAll?: () => void;
}

export function ShootDetailsQuickActions({
  shoot,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
  role,
  isEditMode = false,
  onShootUpdate,
  onProcessPayment,
  onViewInvoice,
  onDownloadAll,
}: ShootDetailsQuickActionsProps) {
  const { toast } = useToast();
  const [assignPhotographerOpen, setAssignPhotographerOpen] = useState(false);
  const [assignEditorOpen, setAssignEditorOpen] = useState(false);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string>('');
  const [selectedEditorId, setSelectedEditorId] = useState<string>('');
  const [photographers, setPhotographers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [editors, setEditors] = useState<Array<{ id: string; name: string; email: string }>>([]);
  // Fetch photographers for assignment
  const fetchPhotographers = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/users/photographers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        setPhotographers(json.data || json || []);
      }
    } catch (error) {
      console.error('Error fetching photographers:', error);
    }
  };

  // Fetch editors for assignment
  const fetchEditors = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/users/editors`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        setEditors(json.data || json || []);
      }
    } catch (error) {
      console.error('Error fetching editors:', error);
    }
  };

  // Assign photographer
  const handleAssignPhotographer = async () => {
    if (!selectedPhotographerId) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ photographer_id: selectedPhotographerId }),
      });
      
      if (!res.ok) throw new Error('Failed to assign photographer');
      
      toast({
        title: 'Success',
        description: 'Photographer assigned successfully',
      });
      setAssignPhotographerOpen(false);
      onShootUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign photographer',
        variant: 'destructive',
      });
    }
  };

  // Assign editor
  const handleAssignEditor = async () => {
    if (!selectedEditorId) return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ editor_id: selectedEditorId }),
      });
      
      if (!res.ok) throw new Error('Failed to assign editor');
      
      toast({
        title: 'Success',
        description: 'Editor assigned successfully',
      });
      setAssignEditorOpen(false);
      onShootUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign editor',
        variant: 'destructive',
      });
    }
  };

  // Send to editing
  const handleSendToEditing = async () => {
    if (!selectedEditorId) {
      setAssignEditorOpen(true);
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/send-to-editing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ editor_id: selectedEditorId }),
      });
      
      if (!res.ok) throw new Error('Failed to send to editing');
      
      toast({
        title: 'Success',
        description: 'Shoot sent to editing',
      });
      onShootUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send to editing',
        variant: 'destructive',
      });
    }
  };

  // Mark complete
  const handleMarkComplete = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      
      if (!res.ok) throw new Error('Failed to mark complete');
      
      toast({
        title: 'Success',
        description: 'Shoot marked as complete',
      });
      onShootUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark complete',
        variant: 'destructive',
      });
    }
  };

  // Process payment handler
  const handleProcessPayment = () => {
    if (onProcessPayment) {
      onProcessPayment();
    } else {
      toast({
        title: 'Payment',
        description: 'Payment processing dialog would open here',
      });
    }
  };

  // View invoice handler
  const handleViewInvoice = () => {
    if (onViewInvoice) {
      onViewInvoice();
    } else {
      toast({
        title: 'Invoice',
        description: 'Invoice view would open here',
      });
    }
  };

  // Download all handler
  const handleDownloadAll = () => {
    if (onDownloadAll) {
      onDownloadAll();
    } else {
      toast({
        title: 'Download',
        description: 'Download all media would start here',
      });
    }
  };

  // Mark as paid (Super Admin only)
  const handleMarkAsPaid = () => {
    if (!shoot) return;
    const isPaid = (shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0);
    if (isPaid) {
      toast({
        title: 'Already Paid',
        description: 'This shoot is already fully paid',
      });
      return;
    }
    setIsMarkPaidDialogOpen(true);
  };

  const handleMarkPaidConfirm = async (payload: MarkAsPaidPayload) => {
    if (!shoot) return;
    const outstandingAmount = (shoot.payment?.totalQuote ?? 0) - (shoot.payment?.totalPaid ?? 0);
    const amount = outstandingAmount > 0 ? outstandingAmount : (shoot.payment?.totalQuote ?? 0);
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');

    const body: Record<string, any> = {
      payment_type: payload.paymentMethod,
      amount,
    };

    if (payload.paymentDetails) {
      body.payment_details = payload.paymentDetails;
    }
    if (payload.paymentDate) {
      body.payment_date = payload.paymentDate;
    }

    const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: 'Failed to mark as paid' }));
      throw new Error(errorData.message || 'Failed to mark as paid');
    }

    toast({
      title: 'Success',
      description: 'Shoot marked as paid',
    });
    onShootUpdate();
  };

  const isPaid = (shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0);
  const iguideUrl =
    shoot.iguideTourUrl ||
    shoot.tourLinks?.iGuide ||
    shoot.tourLinks?.iguide_branded ||
    shoot.tourLinks?.iguide_mls ||
    (shoot as any).iguide_tour_url ||
    '';

  return (
    <>
      <div className="flex flex-wrap gap-1.5 sm:gap-2.5">
        {/* Editor quick action buttons removed - Download Raw and Share Link are now in the header */}
        {iguideUrl && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3"
            onClick={() => window.open(iguideUrl, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Open iGUIDE</span>
          </Button>
        )}
        {role === 'superadmin' && !isPaid && (
          <Button
            variant="default"
            size="sm"
            className="flex-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3"
            onClick={handleMarkAsPaid}
          >
            <DollarSignIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Mark as Paid</span>
          </Button>
        )}
        {isClient && (
          <>
            {/* Process Payment - only show when not paid */}
            {!isPaid && (
              <Button 
                variant="default" 
                size="sm" 
                className="flex-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-300 dark:border-orange-800"
                onClick={handleProcessPayment}
              >
                <DollarSignIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Process Payment</span>
              </Button>
            )}
            {/* View Invoice - always visible */}
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
              onClick={handleViewInvoice}
            >
              <Receipt className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">View Invoice</span>
            </Button>
            {/* Download All - only show when paid */}
            {isPaid && (
              <Button 
                variant="default" 
                size="sm" 
                className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                onClick={handleDownloadAll}
              >
                <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Download All</span>
              </Button>
            )}
          </>
        )}
      </div>

      {/* Assign Photographer Dialog */}
      <Dialog open={assignPhotographerOpen} onOpenChange={setAssignPhotographerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Photographer</DialogTitle>
            <DialogDescription>
              Select a photographer to assign to this shoot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Photographer</Label>
              <Select value={selectedPhotographerId} onValueChange={setSelectedPhotographerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select photographer" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {photographers.map((photographer) => (
                    <SelectItem key={photographer.id} value={String(photographer.id)}>
                      {photographer.name} ({photographer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignPhotographerOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignPhotographer} disabled={!selectedPhotographerId}>
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Editor Dialog */}
      <Dialog open={assignEditorOpen} onOpenChange={setAssignEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Editor</DialogTitle>
            <DialogDescription>
              Select an editor to assign to this shoot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Editor</Label>
              <Select value={selectedEditorId} onValueChange={setSelectedEditorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select editor" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {editors.map((editor) => (
                    <SelectItem key={editor.id} value={String(editor.id)}>
                      {editor.name} ({editor.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignEditorOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignEditor} disabled={!selectedEditorId}>
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MarkAsPaidDialog
        isOpen={isMarkPaidDialogOpen}
        onClose={() => setIsMarkPaidDialogOpen(false)}
        onConfirm={handleMarkPaidConfirm}
        title="Mark Shoot as Paid"
        description="Select the payment method and provide any required details."
        confirmLabel="Mark as Paid"
      />
    </>
  );
}

