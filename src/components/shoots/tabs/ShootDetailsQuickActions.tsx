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
} from 'lucide-react';
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';

interface ShootDetailsQuickActionsProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isClient: boolean;
  role: string;
  onShootUpdate: () => void;
}

export function ShootDetailsQuickActions({
  shoot,
  isAdmin,
  isPhotographer,
  isEditor,
  isClient,
  role,
  onShootUpdate,
}: ShootDetailsQuickActionsProps) {
  const { toast } = useToast();
  const [assignPhotographerOpen, setAssignPhotographerOpen] = useState(false);
  const [assignEditorOpen, setAssignEditorOpen] = useState(false);
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

  // Process payment
  const handleProcessPayment = () => {
    toast({
      title: 'Payment',
      description: 'Payment processing dialog would open here',
    });
  };

  // Mark as paid (Super Admin only)
  const handleMarkAsPaid = async () => {
    if (!shoot) return;
    const isPaid = (shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0);
    if (isPaid) {
      toast({
        title: 'Already Paid',
        description: 'This shoot is already fully paid',
      });
      return;
    }

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/mark-paid`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          payment_type: 'manual',
          amount: shoot.payment?.totalQuote ?? 0,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to mark as paid');
      
      toast({
        title: 'Success',
        description: 'Shoot marked as paid',
      });
      onShootUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark as paid',
        variant: 'destructive',
      });
    }
  };

  const isSuperAdmin = role === 'superadmin';
  const isPaid = (shoot.payment?.totalPaid ?? 0) >= (shoot.payment?.totalQuote ?? 0);

  return (
    <>
      <div className="flex flex-wrap gap-1.5 sm:gap-2.5">
        {isPhotographer && (
          <>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
            >
              <Upload className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Upload RAW</span>
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-700"
            >
              <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Add note</span>
            </Button>
          </>
        )}
        {isEditor && (
          <>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-800"
            >
              <Upload className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Upload Edits</span>
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-700"
            >
              <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Add note</span>
            </Button>
          </>
        )}
        {isClient && (
          <>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
            >
              <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">View media</span>
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3 bg-red-50 hover:bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-300 dark:border-red-800"
            >
              <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Raise issue</span>
            </Button>
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
    </>
  );
}

