
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PenLine, Save, X } from "lucide-react";
import { ShootData } from '@/types/shoots';
import { useShoots } from '@/context/ShootsContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';

interface ShootNotesTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  role: string;
}

export function ShootNotesTab({ 
  shoot, 
  isAdmin, 
  isPhotographer,
  role 
}: ShootNotesTabProps) {
  const { updateShoot } = useShoots();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [editableNotes, setEditableNotes] = useState({
    shootNotes: '',
    photographerNotes: '',
    companyNotes: '',
    editingNotes: ''
  });
  
  const [activeEdits, setActiveEdits] = useState({
    shootNotes: false,
    photographerNotes: false,
    companyNotes: false,
    editingNotes: false
  });

  // Server-side notes fetched from Laravel API (preferred source when available)
  const [serverNotes, setServerNotes] = useState<{
    shoot_notes?: string;
    company_notes?: string;
    photographer_notes?: string;
    editor_notes?: string;
  } | null>(null);

  // Initialize notes from the shoot data when component mounts or shoot changes
  useEffect(() => {
    if (shoot) {
      console.log("Notes from shoot:", shoot.notes);
      setEditableNotes({
        shootNotes: getNotes('shootNotes'),
        photographerNotes: getNotes('photographerNotes'),
        companyNotes: getNotes('companyNotes'),
        editingNotes: getNotes('editingNotes')
      });
    }
  }, [shoot]);

  // Fetch canonical shoot notes from backend API so we can display new top-level fields even if context lacks them
  useEffect(() => {
    const loadServerNotes = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token || !shoot?.id) return;
        const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const json = await res.json();
        const s = json?.data || {};
        setServerNotes({
          shoot_notes: s.shoot_notes ?? undefined,
          company_notes: s.company_notes ?? undefined,
          photographer_notes: s.photographer_notes ?? undefined,
          editor_notes: s.editor_notes ?? undefined,
        });
      } catch (e) {
        console.warn('Failed to load server notes', e);
      }
    };
    loadServerNotes();
  }, [shoot?.id]);

  // Helper function to read notes from API response (supports legacy object and new top-level fields)
  function getNotes(key: string): string {
    // Prefer fresh server notes when available
    if (serverNotes) {
      switch (key) {
        case 'shootNotes':
          if (serverNotes.shoot_notes) return String(serverNotes.shoot_notes);
          break;
        case 'photographerNotes':
          if (serverNotes.photographer_notes) return String(serverNotes.photographer_notes);
          break;
        case 'companyNotes':
          if (serverNotes.company_notes) return String(serverNotes.company_notes);
          break;
        case 'editingNotes':
          if (serverNotes.editor_notes) return String(serverNotes.editor_notes);
          break;
      }
    }
    // Fallback: check any existing top-level fields on the local shoot object
    const anyShoot: any = shoot as any;
    if (anyShoot) {
      switch (key) {
        case 'shootNotes':
          if (anyShoot.shoot_notes) return String(anyShoot.shoot_notes);
          break;
        case 'photographerNotes':
          if (anyShoot.photographer_notes) return String(anyShoot.photographer_notes);
          break;
        case 'companyNotes':
          if (anyShoot.company_notes) return String(anyShoot.company_notes);
          break;
        case 'editingNotes':
          if (anyShoot.editor_notes) return String(anyShoot.editor_notes);
          break;
      }
    }
    // Legacy: stored under shoot.notes (string or object)
    if (!shoot.notes) return '';
    if (typeof shoot.notes === 'string') return shoot.notes;
    const notes = shoot.notes[key as keyof typeof shoot.notes];
    return notes ? String(notes) : '';
  }
  
  function handleEditToggle(noteType: string) {
    const currentlyEditing = !!activeEdits[noteType as keyof typeof activeEdits];
    const nextEditing = !currentlyEditing;

    // When entering edit mode, prefill with current displayed note
    if (nextEditing) {
      const currentValue = getNotes(noteType);
      setEditableNotes(prev => ({
        ...prev,
        [noteType]: currentValue
      }));
    }

    setActiveEdits(prev => ({
      ...prev,
      [noteType]: nextEditing
    }));
  }
  
  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>, noteType: string) {
    setEditableNotes(prev => ({
      ...prev,
      [noteType]: e.target.value
    }));
  }
  
  async function handleSaveNotes(noteType: string) {
    console.log(`Saving ${noteType} with content: ${editableNotes[noteType as keyof typeof editableNotes]}`);
    
    // Create a new notes object based on existing notes
    let updatedNotes: any = {};
    
    // If notes is a string, convert to object first
    if (typeof shoot.notes === 'string') {
      updatedNotes = { shootNotes: shoot.notes };
    } else if (shoot.notes) {
      updatedNotes = { ...shoot.notes };
    }
    
    // Update the specific note type
    updatedNotes[noteType] = editableNotes[noteType as keyof typeof editableNotes];
    
    console.log("Updated notes object:", updatedNotes);
    console.log("Shoot ID:", shoot.id);
    
    try {
      // Save to Laravel backend
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const apiKeyMap: Record<string, string> = {
        shootNotes: 'shoot_notes',
        photographerNotes: 'photographer_notes',
        companyNotes: 'company_notes',
        editingNotes: 'editor_notes'
      };
      const apiKey = apiKeyMap[noteType];
      if (!apiKey) return;

      const payload: Record<string, string> = {};
      payload[apiKey] = String(editableNotes[noteType as keyof typeof editableNotes] || '');

      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to save');
      }
      const json = await res.json();
      const d = json?.data || {};
      setServerNotes({
        shoot_notes: d.shoot_notes ?? serverNotes?.shoot_notes,
        company_notes: d.company_notes ?? serverNotes?.company_notes,
        photographer_notes: d.photographer_notes ?? serverNotes?.photographer_notes,
        editor_notes: d.editor_notes ?? serverNotes?.editor_notes,
      });
      
      // Exit edit mode
      setActiveEdits(prev => ({
        ...prev,
        [noteType]: false
      }));
      
      toast({
        title: "Note saved",
        description: "Your changes have been saved successfully",
      });
    } catch (error) {
      console.error("Error saving note:", error);
      toast({
        title: "Error saving note",
        description: "There was a problem saving your changes",
        variant: "destructive"
      });
    }
  }

  // Updated to allow admin and superadmin to edit all types of notes
  function canEdit(noteType: string): boolean {
    if (isAdmin || role === 'superadmin') {
      return true; // Admin and superadmin can edit all note types
    }
    
    switch (noteType) {
      case 'photographerNotes': 
        return isPhotographer;
      case 'editingNotes': 
        return role === 'editor';
      default: 
        return false;
    }
  }

  // Visibility rules based on the permissions matrix:
  // - Super Admin & Admin: Can see all notes
  // - Editor: Can see shoot notes, editing notes, photographer notes (NOT company notes)
  // - Photographer: Can see shoot notes, photographer notes (NOT company notes, NOT editing notes)
  // - Client: Can see shoot notes only (NOT company notes, NOT editing notes, NOT photographer notes)
  function canView(noteType: string): boolean {
    // Super Admin and Admin can see everything
    if (isAdmin || role === 'superadmin') {
      return true;
    }
    
    // Shoot notes: visible to all roles
    if (noteType === 'shootNotes') {
      return true;
    }
    
    // Company notes: ONLY Super Admin and Admin
    if (noteType === 'companyNotes') {
      return false; // Already handled above for admin/superadmin
    }
    
    // Editing notes: Super Admin, Admin, Editor (NOT Photographer, NOT Client)
    if (noteType === 'editingNotes') {
      return role === 'editor' || role === 'admin' || role === 'superadmin';
    }
    
    // Photographer notes: Super Admin, Admin, Editor, Photographer (NOT Client)
    if (noteType === 'photographerNotes') {
      return role === 'photographer' || role === 'editor' || role === 'admin' || role === 'superadmin';
    }
    
    return false;
  }

  // Function to display the current note value, respecting the edit state
  function displayNoteValue(noteType: string): string {
    if (activeEdits[noteType as keyof typeof activeEdits]) {
      return editableNotes[noteType as keyof typeof editableNotes];
    }
    
    return getNotes(noteType);
  }

  // Helper functions for styled notes with updated colors to match dashboard
  const getNoteBackgroundClass = (noteType: string) => {
    switch (noteType) {
      case 'photographerNotes': 
        return 'bg-blue-50/60 dark:bg-blue-900/10';
      case 'editingNotes': 
        return 'bg-purple-50/60 dark:bg-purple-900/10';
      case 'companyNotes': 
        return 'bg-amber-50/60 dark:bg-amber-900/10';
      case 'shootNotes': 
      default:
        return 'bg-green-50/60 dark:bg-green-900/10';
    }
  };
  
  const getNoteTextClass = (noteType: string) => {
    switch (noteType) {
      case 'photographerNotes': 
        return 'text-blue-800 dark:text-blue-300';
      case 'editingNotes': 
        return 'text-purple-800 dark:text-purple-300';
      case 'companyNotes': 
        return 'text-amber-800 dark:text-amber-300';
      case 'shootNotes': 
      default:
        return 'text-green-800 dark:text-green-300';
    }
  };
  
  const getNoteBorderClass = (noteType: string) => {
    switch (noteType) {
      case 'photographerNotes': 
        return 'border-blue-200 dark:border-blue-700';
      case 'editingNotes': 
        return 'border-purple-200 dark:border-purple-700';
      case 'companyNotes': 
        return 'border-amber-200 dark:border-amber-700';
      case 'shootNotes': 
      default:
        return 'border-green-200 dark:border-green-700';
    }
  };

  return (
    <div className="space-y-4">
      {canView('shootNotes') && (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-green-700 dark:text-green-400">Shoot Notes</h3>
          {canEdit('shootNotes') && !activeEdits.shootNotes && (
            <Button variant="ghost" size="sm" onClick={() => handleEditToggle('shootNotes')}>
              <PenLine className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {canEdit('shootNotes') && activeEdits.shootNotes && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleEditToggle('shootNotes')}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={() => handleSaveNotes('shootNotes')}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
        <Textarea 
          placeholder="No shoot notes available" 
          value={displayNoteValue('shootNotes')}
          onChange={(e) => handleNoteChange(e, 'shootNotes')}
          readOnly={!activeEdits.shootNotes}
          className={`resize-none min-h-[100px] ${getNoteBackgroundClass('shootNotes')} ${getNoteTextClass('shootNotes')} border-2 ${getNoteBorderClass('shootNotes')} focus:ring-green-500/40`}
          style={{
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
            transition: "all 0.2s ease"
          }}
        />
      </div>
      )}
      
      {canView('photographerNotes') && (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-blue-700 dark:text-blue-400">Photographer Notes</h3>
          {canEdit('photographerNotes') && !activeEdits.photographerNotes && (
            <Button variant="ghost" size="sm" onClick={() => handleEditToggle('photographerNotes')}>
              <PenLine className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {canEdit('photographerNotes') && activeEdits.photographerNotes && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleEditToggle('photographerNotes')}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={() => handleSaveNotes('photographerNotes')}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
        <Textarea 
          placeholder="No photographer notes available" 
          value={displayNoteValue('photographerNotes')}
          onChange={(e) => handleNoteChange(e, 'photographerNotes')}
          readOnly={!activeEdits.photographerNotes}
          className={`resize-none min-h-[100px] ${getNoteBackgroundClass('photographerNotes')} ${getNoteTextClass('photographerNotes')} border-2 ${getNoteBorderClass('photographerNotes')} focus:ring-blue-500/40`}
          style={{
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
            transition: "all 0.2s ease"
          }}
        />
      </div>
      )}
      
      {canView('companyNotes') && (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400">Company Notes</h3>
          {canEdit('companyNotes') && !activeEdits.companyNotes && (
            <Button variant="ghost" size="sm" onClick={() => handleEditToggle('companyNotes')}>
              <PenLine className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {canEdit('companyNotes') && activeEdits.companyNotes && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleEditToggle('companyNotes')}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={() => handleSaveNotes('companyNotes')}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
        <Textarea 
          placeholder="No company notes available" 
          value={displayNoteValue('companyNotes')}
          onChange={(e) => handleNoteChange(e, 'companyNotes')}
          readOnly={!activeEdits.companyNotes}
          className={`resize-none min-h-[100px] ${getNoteBackgroundClass('companyNotes')} ${getNoteTextClass('companyNotes')} border-2 ${getNoteBorderClass('companyNotes')} focus:ring-amber-500/40`}
          style={{
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
            transition: "all 0.2s ease"
          }}
        />
      </div>
      )}
      
      {canView('editingNotes') && (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-purple-700 dark:text-purple-400">Editing Notes</h3>
          {canEdit('editingNotes') && !activeEdits.editingNotes && (
            <Button variant="ghost" size="sm" onClick={() => handleEditToggle('editingNotes')}>
              <PenLine className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {canEdit('editingNotes') && activeEdits.editingNotes && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleEditToggle('editingNotes')}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={() => handleSaveNotes('editingNotes')}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
        <Textarea 
          placeholder="No editing notes available" 
          value={displayNoteValue('editingNotes')}
          onChange={(e) => handleNoteChange(e, 'editingNotes')}
          readOnly={!activeEdits.editingNotes}
          className={`resize-none min-h-[100px] ${getNoteBackgroundClass('editingNotes')} ${getNoteTextClass('editingNotes')} border-2 ${getNoteBorderClass('editingNotes')} focus:ring-purple-500/40`}
          style={{
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
            transition: "all 0.2s ease"
          }}
        />
      </div>
      )}
    </div>
  );
}
