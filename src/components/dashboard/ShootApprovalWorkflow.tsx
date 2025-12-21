import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ShootData } from '@/types/shoots';
import { CheckCircle, XCircle, AlertCircle, Send, Flag } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { API_BASE_URL } from '@/config/env';

interface ShootApprovalWorkflowProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  onUpdate?: () => void;
}

export function ShootApprovalWorkflow({ shoot, isAdmin, isPhotographer, onUpdate }: ShootApprovalWorkflowProps) {
  const { toast } = useToast();
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const workflowStatus = shoot.workflowStatus || 'booked';
  const isFlagged = shoot.isFlagged || false;
  const adminIssueNotes = shoot.adminIssueNotes;

  const handleSubmitForReview = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/submit-for-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to submit shoot for review');

      toast({
        title: 'Shoot Submitted',
        description: 'Your shoot has been submitted for admin review.',
      });
      onUpdate?.();
    } catch (e: any) {
      toast({
        title: 'Submission Failed',
        description: e?.message || 'Could not submit shoot for review',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to approve shoot');

      toast({
        title: 'Shoot Approved',
        description: 'The shoot has been approved and marked as accepted.',
      });
      onUpdate?.();
    } catch (e: any) {
      toast({
        title: 'Approval Failed',
        description: e?.message || 'Could not approve shoot',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) {
      toast({
        title: 'Notes Required',
        description: 'Please provide notes about the issues found.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ admin_issue_notes: rejectNotes })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to reject shoot');

      toast({
        title: 'Shoot Put on Hold',
        description: 'The shoot has been flagged with issues. The photographer has been notified.',
      });
      setIsRejectDialogOpen(false);
      setRejectNotes('');
      onUpdate?.();
    } catch (e: any) {
      toast({
        title: 'Rejection Failed',
        description: e?.message || 'Could not reject shoot',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkIssuesResolved = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-issues-resolved`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to mark issues as resolved');

      toast({
        title: 'Issues Resolved',
        description: 'The shoot has been resubmitted for admin review.',
      });
      onUpdate?.();
    } catch (e: any) {
      toast({
        title: 'Update Failed',
        description: e?.message || 'Could not mark issues as resolved',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWorkflowStatusBadge = () => {
    switch (workflowStatus) {
      case 'pending_review':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending Review</Badge>;
      case 'on_hold':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">On Hold - Issues Found</Badge>;
      case 'admin_verified':
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Shoot Accepted</Badge>;
      default:
        return null;
    }
  };

  // Show workflow status and actions
  return (
    <div className="space-y-4">
      {/* Workflow Status Badge */}
      {getWorkflowStatusBadge() && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          {getWorkflowStatusBadge()}
        </div>
      )}

      {/* Admin Issue Notes Alert */}
      {isFlagged && adminIssueNotes && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-1">Issues Found:</div>
            <div className="whitespace-pre-wrap">{adminIssueNotes}</div>
          </AlertDescription>
        </Alert>
      )}

      {/* Photographer Actions */}
      {isPhotographer && (
        <div className="space-y-2">
          {workflowStatus === 'photos_uploaded' || workflowStatus === 'editing_complete' || workflowStatus === 'on_hold' ? (
            <Button
              onClick={handleSubmitForReview}
              disabled={isSubmitting}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {workflowStatus === 'on_hold' ? 'Resubmit for Review' : 'Submit for Review'}
            </Button>
          ) : null}

          {workflowStatus === 'on_hold' && isFlagged && adminIssueNotes && (
            <Button
              onClick={handleMarkIssuesResolved}
              disabled={isSubmitting}
              variant="outline"
              className="w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Issues as Resolved
            </Button>
          )}
        </div>
      )}

      {/* Admin Actions */}
      {isAdmin && workflowStatus === 'pending_review' && (
        <div className="space-y-2">
          <Button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve Shoot
          </Button>
          <Button
            onClick={() => setIsRejectDialogOpen(true)}
            disabled={isSubmitting}
            variant="destructive"
            className="w-full"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Put on Hold (Issues Found)
          </Button>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put Shoot on Hold</DialogTitle>
            <DialogDescription>
              Please provide details about the issues found in this shoot. The photographer will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-notes">Issue Notes *</Label>
              <Textarea
                id="reject-notes"
                placeholder="e.g., Missing images for bedroom, quality issues in kitchen photos..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isSubmitting || !rejectNotes.trim()}
              variant="destructive"
            >
              <Flag className="h-4 w-4 mr-2" />
              Put on Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


