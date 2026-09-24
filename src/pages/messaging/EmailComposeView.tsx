import { EmailComposeMobile } from './EmailComposeMobile';
import { EmailComposeDesk } from './EmailComposeDesk';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import { CalendarClock } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  Message, MessageChannelConfig, MessageTemplate, MessagingJsonObject, TemplatePreviewResult,
} from '@/types/messaging';
import type {
  ComposeFormState, ComposeRecipients, ContactShootOption, DraftAttachmentPlaceholder, Priority, RecipientField,
} from './emailComposeModel';

type TemplateSuggestion = { name: string; label: string; source: string };
type MessageInfo = { recipients: number; words: number; characters: number; attachments: number };

export interface EmailComposeViewProps {
  currentMode: { title: string; subtitle: string; sendLabel: string };
  lastSaved: Date | null;
  draftAttachments: DraftAttachmentPlaceholder[];
  templatePreviewData?: TemplatePreviewResult;
  navigate: (to: string) => void;
  canSendExternal: boolean;
  setPreviewMode: Dispatch<SetStateAction<boolean>>;
  previewMode: boolean;
  setShowScheduleDialog: Dispatch<SetStateAction<boolean>>;
  resetCompose: () => void;
  handleSendNow: () => void;
  sendMutation: { isPending: boolean };
  scheduleMutation: { isPending: boolean };
  isMissingRequiredShootContext: boolean;
  isInternalReply: boolean;
  setPriority: Dispatch<SetStateAction<Priority>>;
  priority: Priority;
  showCcBcc: boolean;
  recipients: ComposeRecipients;
  setShowCcBcc: Dispatch<SetStateAction<boolean>>;
  renderRecipientField: (field: RecipientField, label: string, description: string, singleRecipient?: boolean) => ReactNode;
  form: ComposeFormState;
  setFormValue: <K extends keyof ComposeFormState>(key: K, value: ComposeFormState[K]) => void;
  setTemplateCustomized: Dispatch<SetStateAction<boolean>>;
  templates: MessageTemplate[];
  setForm: Dispatch<SetStateAction<ComposeFormState>>;
  applyTemplate: (templateId: string) => void;
  isLoadingContactShoots: boolean;
  contactShootOptions: ContactShootOption[];
  channels: MessageChannelConfig[];
  selectedTemplate?: MessageTemplate;
  previewSubject: string;
  previewBodyHtml: string;
  originalMessage?: Message;
  fileInputRef: RefObject<HTMLInputElement | null>;
  attachFiles: (files: FileList | null) => void;
  attachments: File[];
  setAttachments: Dispatch<SetStateAction<File[]>>;
  setDraftAttachments: Dispatch<SetStateAction<DraftAttachmentPlaceholder[]>>;
  templateSuggestions: TemplateSuggestion[];
  parsedVariables?: MessagingJsonObject;
  variableJsonError?: string;
  messageInfo: MessageInfo;
  showScheduleDialog: boolean;
  handleSchedule: () => void;
}

export function EmailComposeView(props: EmailComposeViewProps) {
  const { form, previewSubject, messageInfo, setShowScheduleDialog, setFormValue, handleSchedule, scheduleMutation } = props;
  const isCompact = useMediaQuery('(max-width: 1024px)');
  const scheduleDialog = (
    <Dialog open={props.showScheduleDialog} onOpenChange={setShowScheduleDialog}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule this message</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="compose-scheduled-at">Send at</Label>
            <Input
              id="compose-scheduled-at"
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(event) => setFormValue('scheduled_at', event.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            <p>{previewSubject || 'No subject yet'}</p>
            <p className="mt-2">
              {messageInfo.recipients} recipient{messageInfo.recipients === 1 ? '' : 's'} • {messageInfo.attachments} attachment{messageInfo.attachments === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
            <Button type="button" onClick={handleSchedule} disabled={scheduleMutation.isPending}>
              <CalendarClock className="mr-2 h-4 w-4" />
              {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (isCompact) {
    return <EmailComposeMobile {...props} scheduleDialog={scheduleDialog} />;
  }

  return <EmailComposeDesk {...props} scheduleDialog={scheduleDialog} />;
}
