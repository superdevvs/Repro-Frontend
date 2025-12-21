import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import { format } from 'date-fns';
import { ShootIssueManager } from './ShootIssueManager';

interface ShootDetailsIssuesTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  role: string;
  onShootUpdate: () => void;
}

interface Issue {
  id: string;
  shootId: string;
  mediaId?: string;
  raisedBy: {
    id: string;
    name: string;
    role: string;
  };
  assignedToRole?: 'editor' | 'photographer';
  assignedToUser?: {
    id: string;
    name: string;
  };
  status: 'open' | 'in-progress' | 'resolved';
  note: string;
  createdAt: string;
  updatedAt: string;
  mediaFilename?: string;
}

export function ShootDetailsIssuesTab({
  shoot,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
  role,
  onShootUpdate,
}: ShootDetailsIssuesTabProps) {
  const { toast } = useToast();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueManagerOpen, setIssueManagerOpen] = useState(false);
  const [markingResolved, setMarkingResolved] = useState(false);
  
  // Check if shoot has issues that can be marked as resolved
  const shootHasIssues = shoot.isFlagged || 
    ['on_hold', 'raw_issue', 'editing_issue'].includes(shoot.workflowStatus || '');
  
  // Can mark as resolved if photographer/editor and shoot has issues
  const canMarkResolved = (isPhotographer || isEditor) && shootHasIssues;
  
  // Handle marking issues as resolved
  const handleMarkIssuesResolved = async () => {
    setMarkingResolved(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-issues-resolved`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to mark issues as resolved');
      }

      toast({
        title: 'Success',
        description: 'Requests marked as resolved. Shoot resubmitted for review.',
      });
      onShootUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark issues as resolved',
        variant: 'destructive',
      });
    } finally {
      setMarkingResolved(false);
    }
  };

  // Load issues
  useEffect(() => {
    if (!shoot.id) return;
    
    const loadIssues = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/issues`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (res.ok) {
          const json = await res.json();
          setIssues(json.data || json || []);
        }
      } catch (error) {
        console.error('Error loading issues:', error);
      }
    };
    
    loadIssues();
  }, [shoot.id, onShootUpdate]);

  // Filter issues based on role
  const visibleIssues = issues.filter(issue => {
    if (isAdmin) return true;
    if (isClient) {
      // Client sees only issues they raised
      const currentUserId = localStorage.getItem('userId') || '';
      return issue.raisedBy.id === currentUserId;
    }
    if (isEditor) {
      // Editor sees issues assigned to editor role or specific editor
      return issue.assignedToRole === 'editor';
    }
    if (isPhotographer) {
      // Photographer sees issues assigned to photographer role
      return issue.assignedToRole === 'photographer';
    }
    return false;
  });


  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'open': { label: 'Open', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
      'in-progress': { label: 'In Progress', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      'resolved': { label: 'Resolved', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
    };
    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };
    return <Badge className={statusInfo.className}>{statusInfo.label}</Badge>;
  };

  const handleIssueUpdate = () => {
    onShootUpdate();
    // Reload issues
    const loadIssues = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/issues`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (res.ok) {
          const json = await res.json();
          setIssues(json.data || json || []);
        }
      } catch (error) {
        console.error('Error loading issues:', error);
      }
    };
    loadIssues();
  };

  const hasOpenIssues = visibleIssues.some(issue => issue.status === 'open' || issue.status === 'in-progress');

  return (
    <div className="space-y-6">
      {/* Header with Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Requests</h3>
          {hasOpenIssues && (
            <p className="text-sm text-muted-foreground mt-1">
              {visibleIssues.filter(i => i.status === 'open' || i.status === 'in-progress').length} open request(s)
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canMarkResolved && (
            <Button 
              onClick={handleMarkIssuesResolved}
              disabled={markingResolved}
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {markingResolved ? 'Submitting...' : 'Mark Resolved & Resubmit'}
            </Button>
          )}
          {(isAdmin || isClient) && (
            <Button onClick={() => setIssueManagerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {isClient ? 'Raise request' : 'Add request'}
            </Button>
          )}
        </div>
      </div>

      {/* Issues List */}
      {visibleIssues.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No requests found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleIssues.map(issue => (
            <Card key={issue.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(issue.status)}
                      {issue.mediaFilename && (
                        <Badge variant="outline" className="text-xs">
                          {issue.mediaFilename}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Raised by {issue.raisedBy.name} ({issue.raisedBy.role}) on{' '}
                      {format(new Date(issue.createdAt), 'MMM d, yyyy h:mm a')}
                    </div>
                    {issue.assignedToRole && (
                      <div className="text-sm text-muted-foreground">
                        Assigned to: {issue.assignedToRole}
                        {issue.assignedToUser && ` (${issue.assignedToUser.name})`}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{issue.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Warning if open issues exist */}
      {hasOpenIssues && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This shoot has open requests and will remain in "In review" status until all requests are resolved.
          </AlertDescription>
        </Alert>
      )}

      {/* Issue Manager Modal */}
      <ShootIssueManager
        isOpen={issueManagerOpen}
        onClose={() => setIssueManagerOpen(false)}
        shootId={shoot.id}
        isAdmin={isAdmin}
        isPhotographer={isPhotographer}
        isEditor={isEditor}
        isClient={isClient}
        onIssueUpdate={handleIssueUpdate}
      />
    </div>
  );
}



