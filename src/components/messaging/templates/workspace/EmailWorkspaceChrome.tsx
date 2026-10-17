import { ArrowLeft, Braces, ChevronDown, FolderOpen, History, ImagePlus, MoreHorizontal, Plus, Redo2, Save, Send, Settings2, Sparkles, Undo2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { WorkspacePanel } from './EmailWorkspacePanels';

export type EmailWorkspaceMode = 'edit' | 'html' | 'preview';

interface Props {
  name: string; status: string; saving: boolean; disabled: boolean;
  mode: EmailWorkspaceMode; assistantActive: boolean; assistantOnly: boolean;
  reviewDisabled?: boolean; canUndo: boolean; canRedo: boolean; canAdd: boolean;
  onClose: () => void; onSave: () => void; onMode: (mode: EmailWorkspaceMode) => void;
  onAssistant: () => void; onUndo: () => void; onRedo: () => void;
  onPanel: (panel: WorkspacePanel) => void;
}

export function EmailWorkspaceChrome(props: Props) {
  const { disabled, onPanel } = props;
  return <>
    <header className="ews-header">
      <Button variant="ghost" size="icon" onClick={props.onClose} aria-label="Close editor" title="Back to templates"><ArrowLeft size={20}/></Button>
      <div className="ews-document-name">
        <button onClick={() => onPanel('settings')} aria-label="Template settings" title={props.name}>
          <span>{props.name}</span><ChevronDown size={14}/>
        </button>
        <span><span className="ews-header-context">Email templates · </span><span>{props.status}</span></span>
      </div>
      <div className="ews-header-actions">
        <Button variant="outline" onClick={props.onSave} disabled={disabled} aria-label={props.saving ? 'Saving…' : 'Save'} title="Save template"><Save size={16}/><span>{props.saving ? 'Saving…' : 'Save'}</span></Button>
        <Button onClick={() => onPanel('review')} disabled={disabled || props.reviewDisabled} aria-label="Review & send" title="Review & send"><Send size={16}/><span>Review & send</span></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Template actions" title="More actions"><MoreHorizontal size={20}/></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="ews-actions-menu w-56">
            <DropdownMenuItem disabled={disabled} onSelect={() => onPanel('start')}><Plus size={16}/>New email</DropdownMenuItem>
            <DropdownMenuItem disabled={disabled} onSelect={() => onPanel('library')}><FolderOpen size={16}/>Open template</DropdownMenuItem>
            <DropdownMenuItem disabled={disabled} onSelect={() => onPanel('import')}><Upload size={16}/>Import HTML</DropdownMenuItem>
            <DropdownMenuSeparator/>
            <DropdownMenuItem disabled={disabled} onSelect={() => onPanel('fields')}><Braces size={16}/>Personalize</DropdownMenuItem>
            <DropdownMenuItem disabled={disabled} onSelect={() => onPanel('artwork')}><ImagePlus size={16}/>Generate artwork</DropdownMenuItem>
            <DropdownMenuItem disabled={disabled} onSelect={() => onPanel('history')}><History size={16}/>History</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPanel('settings')}><Settings2 size={16}/>Template settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <div className="ews-toolbar">
      <div className="ews-editor-navigation">
        <Tabs value={props.assistantOnly ? '' : props.mode} onValueChange={value => props.onMode(value as EmailWorkspaceMode)}>
          <TabsList className="ews-mode-tabs" aria-label="Email editing mode">{(['edit', 'html', 'preview'] as const).map(mode => <TabsTrigger key={mode} id={'ews-mode-'+mode} value={mode} aria-controls="ews-email-panel">{mode === 'edit' ? 'Edit email' : mode === 'html' ? 'HTML' : 'Preview'}</TabsTrigger>)}</TabsList>
        </Tabs>
        <Button variant="ghost" className="ews-assistant-toggle" aria-label="Robbie assistant" aria-pressed={props.assistantActive} onClick={props.onAssistant}><Sparkles size={16}/>Robbie</Button>
      </div>
      {!props.assistantOnly && <div className="ews-toolbar-tools" role="group" aria-label="Email editing tools">
        <Button size="icon" variant="ghost" aria-label="Undo" title="Undo" disabled={disabled || !props.canUndo} onClick={props.onUndo}><Undo2 size={17}/></Button>
        <Button size="icon" variant="ghost" aria-label="Redo" title="Redo" disabled={disabled || !props.canRedo} onClick={props.onRedo}><Redo2 size={17}/></Button>
        <span className="ews-tool-divider"/>
        <Button size="sm" variant="outline" disabled={disabled || !props.canAdd} onClick={() => onPanel('sections')}><Plus size={16}/>Add section</Button>
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onPanel('artwork')}><ImagePlus size={16}/><span>Artwork</span></Button>
      </div>}
    </div>
  </>;
}
