
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Camera, ClipboardCheck, FileText, PenLine, Save, X } from "lucide-react";
import { ShootData } from '@/types/shoots';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';

interface ShootNotesTabProps {
  shoot: ShootData;
  isAdmin: boolean;
  isPhotographer: boolean;
  role: string;
  hideEmptySections?: boolean;
}

const noteTypes = [
  'shootNotes',
  'approvalNotes',
  'photographerNotes',
  'companyNotes',
  'editingNotes',
] as const;

type NoteType = (typeof noteTypes)[number];
type EditableNotesState = Record<NoteType, string>;
type ActiveEditsState = Record<NoteType, boolean>;
type StructuredShootNotes = NonNullable<Exclude<ShootData['notes'], string>> & {
  approval_notes?: string;
};
type ShootNotesSource = {
  shoot_notes?: string;
  approval_notes?: string;
  approvalNotes?: string;
  company_notes?: string;
  photographer_notes?: string;
  editor_notes?: string;
  notes?: string | StructuredShootNotes;
};

export function ShootNotesTab({ 
  shoot, 
  role,
  hideEmptySections = false,
}: ShootNotesTabProps) {
  const { toast } = useToast();
  const isSuperAdmin = role === 'superadmin';
  const isRealAdmin = role === 'admin' || isSuperAdmin;
  const isEditingManager = role === 'editing_manager';
  const isEditor = role === 'editor';
  
  const [editableNotes, setEditableNotes] = useState<EditableNotesState>({
    shootNotes: '',
    approvalNotes: '',
    photographerNotes: '',
    companyNotes: '',
    editingNotes: ''
  });
  
  const [activeEdits, setActiveEdits] = useState<ActiveEditsState>({
    shootNotes: false,
    approvalNotes: false,
    photographerNotes: false,
    companyNotes: false,
    editingNotes: false
  });

  // Server-side notes fetched from Laravel API (preferred source when available)
  const [serverNotes, setServerNotes] = useState<{
    shoot_notes?: string;
    approval_notes?: string;
    company_notes?: string;
    photographer_notes?: string;
    editor_notes?: string;
    notes?: string | {
      shootNotes?: string;
      approvalNotes?: string;
      photographerNotes?: string;
      companyNotes?: string;
      editingNotes?: string;
      approval_notes?: string;
    };
  } | null>(null);

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
          approval_notes: s.approval_notes ?? s.approvalNotes ?? undefined,
          company_notes: s.company_notes ?? undefined,
          photographer_notes: s.photographer_notes ?? undefined,
          editor_notes: s.editor_notes ?? undefined,
          notes: s.notes ?? undefined,
        });
      } catch (e) {
        console.warn('Failed to load server notes', e);
      }
    };
    loadServerNotes();
  }, [shoot?.id]);

  const getNotes = useCallback((key: NoteType): string => {
    const resolveApprovalNote = (source?: ShootNotesSource | null): string => {
      if (!source) return '';

      if (typeof source.approval_notes === 'string' && source.approval_notes.trim()) {
        return source.approval_notes;
      }

      if (typeof source.approvalNotes === 'string' && source.approvalNotes.trim()) {
        return source.approvalNotes;
      }

      if (source.notes && typeof source.notes === 'object') {
        const structuredApproval = source.notes.approvalNotes ?? source.notes.approval_notes;
        if (typeof structuredApproval === 'string' && structuredApproval.trim()) {
          return structuredApproval;
        }
      }

      if (typeof source.notes === 'string' && source.notes.trim()) {
        const hasDedicatedNotes = Boolean(
          source.shoot_notes ||
          source.company_notes ||
          source.photographer_notes ||
          source.editor_notes
        );
        if (hasDedicatedNotes) {
          return source.notes;
        }
      }

      return '';
    };

    // Prefer fresh server notes when available
    if (serverNotes) {
      switch (key) {
        case 'shootNotes':
          if (serverNotes.shoot_notes) return String(serverNotes.shoot_notes);
          break;
        case 'approvalNotes': {
          const resolved = resolveApprovalNote(serverNotes);
          if (resolved) return resolved;
          break;
        }
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
    const localShoot: ShootData & Partial<ShootNotesSource> = shoot as ShootData & Partial<ShootNotesSource>;
    if (localShoot) {
      switch (key) {
        case 'shootNotes':
          if (localShoot.shoot_notes) return String(localShoot.shoot_notes);
          break;
        case 'approvalNotes': {
          const resolved = resolveApprovalNote(localShoot);
          if (resolved) return resolved;
          break;
        }
        case 'photographerNotes':
          if (localShoot.photographer_notes) return String(localShoot.photographer_notes);
          break;
        case 'companyNotes':
          if (localShoot.company_notes) return String(localShoot.company_notes);
          break;
        case 'editingNotes':
          if (localShoot.editor_notes) return String(localShoot.editor_notes);
          break;
      }
    }
    // Legacy: stored under shoot.notes (string or object)
    if (!shoot.notes) return '';
    if (typeof shoot.notes === 'string') return shoot.notes;
    const notes = shoot.notes[key as keyof typeof shoot.notes];
    return notes ? String(notes) : '';
  }, [serverNotes, shoot]);

  // Sync editable note state when the loaded shoot or server-backed notes change,
  // while preserving any field the user is actively editing.
  useEffect(() => {
    if (!shoot) {
      return;
    }

    setEditableNotes((previous) => {
      const next = { ...previous };

      noteTypes.forEach((noteType) => {
        if (!activeEdits[noteType]) {
          next[noteType] = getNotes(noteType);
        }
      });

      return next;
    });
  }, [activeEdits, getNotes, shoot]);
  
  function handleEditToggle(noteType: NoteType) {
    if (!canEdit(noteType)) {
      return;
    }

    const currentlyEditing = activeEdits[noteType];
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
  
  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>, noteType: NoteType) {
    setEditableNotes(prev => ({
      ...prev,
      [noteType]: e.target.value
    }));
  }
  
  async function handleSaveNotes(noteType: NoteType) {
    if (!canEdit(noteType)) {
      return;
    }
    
    try {
      // Save to Laravel backend
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const apiKeyMap: Partial<Record<NoteType, string>> = {
        shootNotes: 'shoot_notes',
        photographerNotes: 'photographer_notes',
        companyNotes: 'company_notes',
        editingNotes: 'editor_notes'
      };
      const apiKey = apiKeyMap[noteType];
      if (!apiKey) return;

      const payload: Record<string, string> = {};
      payload[apiKey] = String(editableNotes[noteType] || '');

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
        approval_notes: d.approval_notes ?? serverNotes?.approval_notes,
        company_notes: d.company_notes ?? serverNotes?.company_notes,
        photographer_notes: d.photographer_notes ?? serverNotes?.photographer_notes,
        editor_notes: d.editor_notes ?? serverNotes?.editor_notes,
        notes: d.notes ?? serverNotes?.notes,
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

  // Only real admins can edit all note types. Editing managers are read-only here.
  function canEdit(noteType: NoteType): boolean {
    if (isRealAdmin) {
      return true;
    }

    switch (noteType) {
      case 'photographerNotes': 
        return role === 'photographer';
      default: 
        return false;
    }
  }

  // Visibility rules based on the permissions matrix:
  // - Super Admin & Admin: Can see all notes
  // - Editing Manager: Can see all notes, but cannot edit them from this tab
  // - Editor: Can see only shoot notes and editing notes
  // - Photographer: Can see shoot notes, approval notes, photographer notes, editing notes
  // - Client: Can see shoot notes only
  function canView(noteType: NoteType): boolean {
    // Super Admin and Admin can see everything
    if (isRealAdmin) {
      return true;
    }

    if (isEditingManager) {
      return true;
    }

    if (isEditor) {
      return noteType === 'shootNotes' || noteType === 'editingNotes';
    }

    // Shoot notes: visible to all roles
    if (noteType === 'shootNotes') {
      return true;
    }
    
    // Company notes: ONLY Super Admin and Admin
    if (noteType === 'companyNotes') {
      return false; // Already handled above for admin/superadmin
    }

    if (noteType === 'approvalNotes') {
      return role === 'photographer';
    }
    
    // Editing notes: visible to editor and photographer (admins handled above)
    if (noteType === 'editingNotes') {
      return role === 'editor' || role === 'photographer';
    }
    
    // Photographer notes: visible to photographer only (admins handled above)
    if (noteType === 'photographerNotes') {
      return role === 'photographer';
    }
    
    return false;
  }

  // Function to display the current note value, respecting the edit state
  function displayNoteValue(noteType: NoteType): string {
    if (activeEdits[noteType]) {
      return editableNotes[noteType];
    }
    
    return getNotes(noteType);
  }

  function hasNoteContent(noteType: NoteType): boolean {
    return getNotes(noteType).trim().length > 0;
  }

  function shouldRenderNoteSection(noteType: NoteType): boolean {
    const isEditing = activeEdits[noteType];
    const isEditable = canEdit(noteType);
    return canView(noteType) && (!hideEmptySections || isEditing || isEditable || hasNoteContent(noteType));
  }

  // Helper functions for styled notes with updated colors to match dashboard
  const getNoteBackgroundClass = (noteType: NoteType) => {
    switch (noteType) {
      case 'photographerNotes': 
        return 'bg-blue-50/60 dark:bg-blue-900/10';
      case 'approvalNotes':
        return 'bg-slate-50/60 dark:bg-slate-900/20';
      case 'editingNotes': 
        return 'bg-purple-50/60 dark:bg-purple-900/10';
      case 'companyNotes': 
        return 'bg-amber-50/60 dark:bg-amber-900/10';
      case 'shootNotes': 
      default:
        return 'bg-green-50/60 dark:bg-green-900/10';
    }
  };
  
  const getNoteTextClass = (noteType: NoteType) => {
    switch (noteType) {
      case 'photographerNotes': 
        return 'text-blue-800 dark:text-blue-300';
      case 'approvalNotes':
        return 'text-slate-800 dark:text-slate-300';
      case 'editingNotes': 
        return 'text-purple-800 dark:text-purple-300';
      case 'companyNotes': 
        return 'text-amber-800 dark:text-amber-300';
      case 'shootNotes': 
      default:
        return 'text-green-800 dark:text-green-300';
    }
  };
  
  const getNoteBorderClass = (noteType: NoteType) => {
    switch (noteType) {
      case 'photographerNotes': 
        return 'border-blue-200 dark:border-blue-700';
      case 'approvalNotes':
        return 'border-slate-200 dark:border-slate-700';
      case 'editingNotes': 
        return 'border-purple-200 dark:border-purple-700';
      case 'companyNotes': 
        return 'border-amber-200 dark:border-amber-700';
      case 'shootNotes': 
      default:
        return 'border-green-200 dark:border-green-700';
    }
  };

  const getNoteAccentClasses = (noteType: NoteType) => {
    switch (noteType) {
      case 'photographerNotes':
        return {
          iconWrap: 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
          title: 'text-blue-700 dark:text-blue-100',
          button: 'text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500/10 dark:hover:text-blue-300',
          icon: Camera,
        };
      case 'approvalNotes':
        return {
          iconWrap: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/20',
          title: 'text-slate-700 dark:text-slate-100',
          button: 'text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-300 dark:border-slate-500/20 dark:hover:bg-slate-500/10 dark:hover:text-slate-200',
          icon: ClipboardCheck,
        };
      case 'editingNotes':
        return {
          iconWrap: 'bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/20',
          title: 'text-purple-700 dark:text-purple-100',
          button: 'text-purple-600 border-purple-200 hover:bg-purple-50 hover:text-purple-700 dark:text-purple-400 dark:border-purple-500/20 dark:hover:bg-purple-500/10 dark:hover:text-purple-300',
          icon: FileText,
        };
      case 'companyNotes':
        return {
          iconWrap: 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
          title: 'text-amber-700 dark:text-amber-100',
          button: 'text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:border-amber-500/20 dark:hover:bg-amber-500/10 dark:hover:text-amber-300',
          icon: Building2,
        };
      case 'shootNotes':
      default:
        return {
          iconWrap: 'bg-green-100 text-green-600 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
          title: 'text-green-700 dark:text-green-100',
          button: 'text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-500/20 dark:hover:bg-green-500/10 dark:hover:text-green-300',
          icon: Camera,
        };
    }
  };

  const getNoteTitle = (noteType: NoteType) => {
    switch (noteType) {
      case 'approvalNotes':
        return 'Approval Notes';
      case 'photographerNotes':
        return 'Photographer Notes';
      case 'companyNotes':
        return 'Company Notes';
      case 'editingNotes':
        return 'Editing Notes';
      case 'shootNotes':
      default:
        return 'Shoot Notes';
    }
  };

  const renderNoteSection = (noteType: NoteType) => {
    const accent = getNoteAccentClasses(noteType);
    const Icon = accent.icon;
    const isEditing = activeEdits[noteType];
    const isEditable = canEdit(noteType);

    return (
      <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${accent.iconWrap}`}>
              <Icon className="h-4 w-4" />
            </span>
            <h3 className={`truncate text-sm font-semibold ${accent.title}`}>{getNoteTitle(noteType)}</h3>
          </div>
          {isEditable && !isEditing && (
            <Button variant="outline" size="sm" className={`h-8 rounded-lg px-2.5 text-xs ${accent.button}`} onClick={() => handleEditToggle(noteType)}>
              <PenLine className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {isEditable && isEditing && (
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-8 rounded-lg px-2.5 text-xs" onClick={() => handleEditToggle(noteType)}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button variant="default" size="sm" className="h-8 rounded-lg px-2.5 text-xs" onClick={() => handleSaveNotes(noteType)}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
        <Textarea
          placeholder={`No ${getNoteTitle(noteType).toLowerCase()} available`}
          value={displayNoteValue(noteType)}
          onChange={(e) => handleNoteChange(e, noteType)}
          readOnly={!isEditing}
          className={`resize-none min-h-[56px] rounded-lg bg-background/30 ${getNoteTextClass(noteType)} border ${getNoteBorderClass(noteType)} focus:ring-1`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-2.5 w-full mt-0">
      {shouldRenderNoteSection('shootNotes') && renderNoteSection('shootNotes')}
      {shouldRenderNoteSection('approvalNotes') && renderNoteSection('approvalNotes')}
      {shouldRenderNoteSection('photographerNotes') && renderNoteSection('photographerNotes')}
      {shouldRenderNoteSection('companyNotes') && renderNoteSection('companyNotes')}
      {shouldRenderNoteSection('editingNotes') && renderNoteSection('editingNotes')}
    </div>
  );
}
