import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createTemplate, updateTemplate } from '@/services/messaging';
import type { MessageTemplate, TemplateCategory, TemplateScope, MessageChannel } from '@/types/messaging';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ShortcodePanel } from './ShortcodePanel';
import { Eye, Code, Save, X, ChevronDown, ChevronUp, Braces } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface TemplateEditorDialogProps {
  template: MessageTemplate | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const categories = [
  { value: 'BOOKING', label: 'Booking' },
  { value: 'REMINDER', label: 'Reminder' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'GENERAL', label: 'General' },
];

const scopes = [
  { value: 'GLOBAL', label: 'Global (All users)' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'USER', label: 'My Templates' },
];

type TemplateFormState = {
  name: string;
  description: string;
  category: string;
  scope: string;
  subject: string;
  body_html: string;
  body_text: string;
  channel: 'EMAIL' | 'SMS';
};

export function TemplateEditorDialog({ template, open, onClose, onSuccess }: TemplateEditorDialogProps) {
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState<TemplateFormState>({
    name: '',
    description: '',
    category: 'GENERAL',
    scope: 'USER',
    subject: '',
    body_html: '',
    body_text: '',
    channel: 'EMAIL',
  });
  const [activeTab, setActiveTab] = useState<'html' | 'text'>('html');
  const [mobileSection, setMobileSection] = useState<'editor' | 'settings' | 'shortcodes'>('editor');
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category || 'GENERAL',
        scope: template.scope,
        subject: template.subject || '',
        body_html: template.body_html || '',
        body_text: template.body_text || '',
        channel: template.channel || 'EMAIL',
      });
    } else {
      // Reset form for new template
      setFormData({
        name: '',
        description: '',
        category: 'GENERAL',
        scope: 'USER',
        subject: '',
        body_html: '',
        body_text: '',
        channel: 'EMAIL',
      });
    }
  }, [template, open]);

  const saveMutation = useMutation({
    mutationFn: (data: TemplateFormState) => {
      if (template) {
        return updateTemplate(template.id, data);
      } else {
        return createTemplate({ ...data, channel: data.channel || 'EMAIL', is_active: true });
      }
    },
    onSuccess: () => {
      toast.success(template ? 'Template updated successfully' : 'Template created successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save template');
    },
  });

  const handleSave = () => {
    if (!formData.name) {
      toast.error('Please enter a template name');
      return;
    }
    if (!formData.subject) {
      toast.error('Please enter a subject line');
      return;
    }
    if (!formData.body_html && !formData.body_text) {
      toast.error('Please enter template content');
      return;
    }

    saveMutation.mutate({
      ...formData,
      channel: formData.channel || 'EMAIL',
    });
  };

  // Strip the legacy email wrapper (header + footer chrome) so the preview
  // only shows the inner content, matching what the backend will extract.
  const stripLegacyEmailWrapper = (html: string): string => {
    if (html.includes('email-container') && html.includes('logo-text')) {
      // Extract content between <div class="content"> and <div class="footer">
      const contentMatch = html.match(/<div\s+class=["']content["']>\s*([\s\S]+)\s*<\/div>\s*<div\s+class=["']footer["']/);
      if (contentMatch) {
        return contentMatch[1].trim();
      }
    }
    // Strip full HTML document wrapper
    const trimmed = html.trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        return bodyMatch[1].trim();
      }
    }
    return html;
  };

  const insertShortcode = (shortcode: string) => {
    const textarea = activeTab === 'html' ? htmlTextareaRef.current : textTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const field = activeTab === 'html' ? 'body_html' : 'body_text';
    const text = formData[field];
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    setFormData({
      ...formData,
      [field]: before + shortcode + after,
    });

    // Set cursor position after inserted shortcode
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + shortcode.length, start + shortcode.length);
    }, 0);
  };

  // Settings form fields (shared between mobile and desktop)
  const settingsContent = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Template Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Shoot Confirmation"
          disabled={template?.is_system}
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of when this template is used..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
            disabled={template?.is_system}
          >
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="scope">Scope</Label>
          <Select
            value={formData.scope}
            onValueChange={(value) => setFormData({ ...formData, scope: value })}
            disabled={template?.is_system}
          >
            <SelectTrigger id="scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((scope) => (
                <SelectItem key={scope.value} value={scope.value}>
                  {scope.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="subject">Email Subject *</Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Use shortcodes like {{shoot_location}}"
        />
      </div>

      {template?.is_system && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <strong>System Template:</strong> Some fields cannot be edited.
        </div>
      )}
    </div>
  );

  // Editor tabs content (shared)
  const editorContent = (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'html' | 'text')} className="flex-1 flex flex-col">
      <div className="border-b px-3 sm:px-6 py-2 sm:py-3 bg-muted/30">
        <TabsList>
          <TabsTrigger value="html" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <Code className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            HTML
          </TabsTrigger>
          <TabsTrigger value="text" className="text-xs sm:text-sm">
            Text
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Preview
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="html" className="flex-1 p-3 sm:p-6 m-0 overflow-y-auto">
        <Textarea
          ref={htmlTextareaRef}
          value={formData.body_html}
          onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
          placeholder="Paste your HTML email template here..."
          className="font-mono text-sm min-h-[300px] sm:min-h-[500px] resize-none"
        />
      </TabsContent>

      <TabsContent value="text" className="flex-1 p-3 sm:p-6 m-0 overflow-y-auto">
        <Textarea
          ref={textTextareaRef}
          value={formData.body_text}
          onChange={(e) => setFormData({ ...formData, body_text: e.target.value })}
          placeholder="Plain text version..."
          className="min-h-[300px] sm:min-h-[500px] resize-none"
        />
      </TabsContent>

      <TabsContent value="preview" className="flex-1 m-0 bg-gray-100 overflow-hidden">
        <div className="h-full overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <Card className="shadow-lg">
              <div className="text-center py-5 px-4 border-b" style={{ borderRadius: '12px 12px 0 0', backgroundColor: '#1a1a2e' }}>
                <img src="https://api.reprodashboard.com/images/repro-logo.png" alt="REPRO Photos" className="inline-block max-w-[180px] h-auto" />
              </div>
              <div className="bg-white border-b p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                      RP
                    </div>
                    <div>
                      <div className="font-semibold text-xs sm:text-sm">REPro Photos</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">notifications@reprophotos.com</div>
                    </div>
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Just now</div>
                </div>
                <div className="font-semibold text-sm sm:text-base">{formData.subject || '(No subject)'}</div>
              </div>
              <div className="p-3 sm:p-6 bg-white max-h-[50vh] sm:max-h-[60vh] overflow-y-auto" style={{ color: '#333333' }}>
                {formData.body_html ? (
                  <div className="email-preview" style={{ color: '#333333', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: stripLegacyEmailWrapper(formData.body_html) }} />
                ) : formData.body_text ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm">{formData.body_text}</pre>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No content to preview</p>
                )}
              </div>
            </Card>
            <p className="text-center text-xs text-muted-foreground">
              Shortcodes will be replaced with actual values when sent
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "p-0 gap-0 [&>button:last-child]:hidden",
        isMobile
          ? "max-w-[100vw] w-full h-[100dvh] !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0 m-0"
          : "max-w-7xl h-[90vh]"
      )}>
        {/* Header */}
        <DialogHeader className="px-3 py-2.5 sm:px-6 sm:py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm sm:text-base">
              {template ? 'Edit Template' : 'New Template'}
            </DialogTitle>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={saveMutation.isPending} className="h-8 sm:h-9 text-xs sm:text-sm">
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="h-8 sm:h-9 text-xs sm:text-sm">
                <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isMobile ? (
          // Mobile: stacked layout with section switcher
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Section Switcher */}
            <div className="flex border-b bg-muted/30 shrink-0">
              <button
                onClick={() => setMobileSection('editor')}
                className={cn(
                  "flex-1 py-2 text-xs font-medium text-center transition-colors border-b-2",
                  mobileSection === 'editor' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                )}
              >
                <Code className="h-3.5 w-3.5 mx-auto mb-0.5" />
                Editor
              </button>
              <button
                onClick={() => setMobileSection('settings')}
                className={cn(
                  "flex-1 py-2 text-xs font-medium text-center transition-colors border-b-2",
                  mobileSection === 'settings' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                )}
              >
                <ChevronDown className="h-3.5 w-3.5 mx-auto mb-0.5" />
                Settings
              </button>
              <button
                onClick={() => setMobileSection('shortcodes')}
                className={cn(
                  "flex-1 py-2 text-xs font-medium text-center transition-colors border-b-2",
                  mobileSection === 'shortcodes' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                )}
              >
                <Braces className="h-3.5 w-3.5 mx-auto mb-0.5" />
                Shortcodes
              </button>
            </div>

            {/* Section Content */}
            <div className="flex-1 overflow-hidden flex flex-col" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.25rem)' }}>
              {mobileSection === 'editor' && editorContent}
              {mobileSection === 'settings' && (
                <div className="flex-1 overflow-y-auto p-4">
                  {settingsContent}
                </div>
              )}
              {mobileSection === 'shortcodes' && (
                <div className="flex-1 overflow-hidden">
                  <ShortcodePanel onInsert={(code) => { insertShortcode(code); setMobileSection('editor'); }} />
                </div>
              )}
            </div>
          </div>
        ) : (
          // Desktop: 3-column layout
          <div className="flex-1 flex overflow-hidden">
            <div className="w-80 border-r p-6 overflow-y-auto">
              {settingsContent}
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {editorContent}
            </div>
            <div className="w-80 border-l overflow-hidden">
              <ShortcodePanel onInsert={insertShortcode} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
