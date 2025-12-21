
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  PenLine,
  DollarSignIcon,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { ShootData } from '@/types/shoots';
import { useAuth } from '@/components/auth/AuthProvider';
import { ShootDetailTabs } from './ShootDetailTabs';
import { ShootActionsDialog } from './ShootActionsDialog';
import { ShootApprovalWorkflow } from './ShootApprovalWorkflow';
import { useShoots } from '@/context/ShootsContext';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { InvoiceData } from '@/utils/invoiceUtils';
import { PaymentDialog } from "@/components/invoices/PaymentDialog";

interface ShootDetailProps {
  shoot: ShootData | null;
  isOpen: boolean;
  onClose: () => void;
  onPay: (invoice: InvoiceData) => void;
  invoice?: InvoiceData;
}

export function ShootDetail({ shoot, isOpen, onClose, onPay, invoice }: ShootDetailProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { updateShoot, deleteShoot } = useShoots();
  const [activeTab, setActiveTab] = useState("details");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const isAdmin = ['admin', 'superadmin'].includes(role);
  const isSuperAdmin = role === 'superadmin'; // Only Super Admin can see payment status
  const isPhotographer = role === 'photographer';
  const isClient = role === 'client'; 

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const { canNavigateToFullPage, fullPagePath } = useMemo(() => {
    if (!shoot?.id) {
      return {
        canNavigateToFullPage: false,
        fullPagePath: undefined,
      };
    }
    const parsedId = Number(shoot.id);
    const hasRealId = Number.isFinite(parsedId);
    return {
      canNavigateToFullPage: hasRealId,
      fullPagePath: hasRealId ? `/shoots/${parsedId}` : undefined,
    };
  }, [shoot?.id]);

  if (!shoot) return null;

  const getStatusBadge = (status: ShootData['status']) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Scheduled</Badge>;
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>;
      // case 'pending':
      //   return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending</Badge>;
      // case 'hold':
      //   return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Hold</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getPaymentStatus = () => {
    if (!shoot.payment.totalPaid) return <Badge variant="outline">Unpaid</Badge>;
    if (shoot.payment.totalPaid < shoot.payment.totalQuote) {
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Partial</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Paid</Badge>;
  };

  const handleOpenEditDialog = () => {
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
  };

  const handleMarkAsCompleted = async () => {
    if (!shoot || shoot.status !== 'scheduled') return;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'completed', workflow_status: 'completed' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to update shoot');
      toast({ title: 'Shoot marked as completed' });
    } catch (e:any) {
      toast({ title: 'Update failed', description: e?.message || 'Could not update shoot', variant: 'destructive' });
    }
  };

  const handleOpenDeleteDialog = () => {
    setIsDeleteDialogOpen(true);
  };

  const handlePayNow = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/create-checkout-link`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to create checkout');
      const url = json?.url || json?.checkout_url || json?.data?.url;
      if (!url) throw new Error('Checkout URL not returned');
      window.open(url, '_blank');
      toast({ title: 'Redirecting to payment', description: 'Secure checkout opened in a new tab.' });
    } catch (e:any) {
      toast({ title: 'Payment error', description: e?.message || 'Could not initialize payment', variant: 'destructive' });
    }
  };

  const handleDeleteShoot = () => {
    if (shoot) {
      deleteShoot(shoot.id);
      setIsDeleteDialogOpen(false);
      toast({
        title: "Shoot Deleted",
        description: `Shoot #${shoot.id} has been permanently deleted.`,
      });
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">Shoot Details</DialogTitle>
              <div className="flex items-center gap-2">
                {canNavigateToFullPage && fullPagePath && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      navigate(fullPagePath);
                    }}
                  >
                    View full page
                  </Button>
                )}
                {getStatusBadge(shoot.status)}
                {isSuperAdmin && getPaymentStatus()}
              </div>
            </div>
            <DialogDescription>
              ID: #{shoot.id} • Created by: {shoot.createdBy || 'Unknown'}
            </DialogDescription>
          </DialogHeader>

          <ShootDetailTabs
            shoot={shoot}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isAdmin={isAdmin}
            isPhotographer={isPhotographer}
            role={role}
          />

          {/* Approval Workflow Section */}
          {(isAdmin || isPhotographer) && (
            <div className="mt-4 pt-4 border-t">
              <ShootApprovalWorkflow
                shoot={shoot}
                isAdmin={isAdmin}
                isPhotographer={isPhotographer}
                onUpdate={() => {
                  // Refresh shoot data
                  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                  if (token) {
                    fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                      },
                    })
                      .then(res => res.json())
                      .then(data => {
                        if (data.data) {
                          updateShoot(shoot.id, {
                            workflowStatus: data.data.workflow_status,
                            isFlagged: data.data.is_flagged,
                            adminIssueNotes: data.data.admin_issue_notes,
                            issuesResolvedAt: data.data.issues_resolved_at,
                            issuesResolvedBy: data.data.issues_resolved_by,
                            submittedForReviewAt: data.data.submitted_for_review_at,
                          });
                        }
                      })
                      .catch(err => console.error('Failed to refresh shoot:', err));
                  }
                }}
              />
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2">
            {(isAdmin || isPhotographer || isClient) && shoot.status == 'scheduled' && (
              <Button onClick={handleOpenEditDialog}>
                <PenLine className="h-4 w-4 mr-2" />
                Edit Shoot
              </Button>
            )}

            {(isAdmin) && shoot.status === 'scheduled' && (
              <Button onClick={handleMarkAsCompleted}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Completed
              </Button>
            )}

            {/* Pay Now for unpaid/partial (admin or client) */}
            {(isAdmin || isClient) && (!shoot.payment.totalPaid || shoot.payment.totalPaid < shoot.payment.totalQuote) && (
              <Button variant="accent" onClick={handlePayNow}>
                <DollarSignIcon className="h-4 w-4 mr-2" />
                Pay Now
              </Button>
            )}

            {(isAdmin || isClient) && (
              <Button variant="destructive" onClick={handleOpenDeleteDialog}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}

            {/* {(role === 'superadmin' || role === 'admin') && (
              <Button variant="default">
                <DollarSignIcon className="h-4 w-4 mr-2" />
                Process Payment
              </Button>
            )} */}

            {/* {(role === 'superadmin' || role === 'admin') && (
              <Button variant="default" onClick={() => setIsPaymentDialogOpen(true)}>
                <DollarSignIcon className="h-4 w-4 mr-2" />
                Process Payment
              </Button>
            )}
            <PaymentDialog
              isOpen={isPaymentDialogOpen}
              onClose={() => setIsPaymentDialogOpen(false)}
              invoice={invoice} // jo invoice pass kar rahe ho props se
              onConfirm={onPay} // yeh function tumhare InvoiceList se aa raha hai
            /> */}

            {/* {isAdmin && (invoice.status === "pending" || invoice.status === "overdue") && (
              <Button
                variant="accent"
                size="sm"
                onClick={() => onPay(invoice)}
                className="!px-3 py-1 text-xs"
                aria-label="process payment"
              >
                Process Payment
              </Button>
            )} */}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shoot && (
        <>

          <ShootActionsDialog
            shoot={shoot}
            isOpen={isEditDialogOpen}
            onClose={handleCloseEditDialog}
          />

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Shoot</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this shoot? This action cannot be undone
                  and all associated data will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteShoot} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}
