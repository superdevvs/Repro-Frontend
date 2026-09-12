import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/sonner-toast';
import { createTemplate, testSendTemplate, updateTemplate } from '@/services/messaging';
import type { MessageTemplate, TemplateCategory, TemplateScope } from '@/types/messaging';
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
import { Eye, Code, Save, X, ChevronDown, Braces, Send } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { getStoredTemplateTestEmail, setStoredTemplateTestEmail } from './testSendStorage';
import { DIRECT_EDITOR_TEMPLATE_SLUGS, getTemplateOverrideDefaults, PROTECTED_EMAIL_TYPES } from './templateOverrideDefaults';
import { EMAIL_CONTENT_SECTIONS, getTemplateErrorMessage } from './templatePreviewSupport';
import { TemplateRenderedPreview } from './TemplateRenderedPreview';
import { TemplateLiveContentHelp } from './TemplateLiveContentHelp';

interface TemplateEditorDialogProps {
  template: MessageTemplate | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (template: MessageTemplate) => void;
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
  { value: 'SYSTEM', label: 'System' },
  { value: 'GLOBAL', label: 'Global (All users)' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'USER', label: 'My Templates' },
];

type TemplateFormState = {
  name: string;
  description: string;
  category: TemplateCategory;
  scope: TemplateScope;
  subject: string;
  body_html: string;
  body_text: string;
  channel: 'EMAIL' | 'SMS';
  email_type: string;
  override_enabled: boolean;
};

export function TemplateEditorDialog({ template, open, onClose, onSuccess }: TemplateEditorDialogProps) {
  const isMobile = useIsMobile();
  const isDirectSystemTemplate = Boolean(template?.is_system && DIRECT_EDITOR_TEMPLATE_SLUGS.has(template.slug ?? ''));
  const [formData, setFormData] = useState<TemplateFormState>({
    name: '',
    description: '',
    category: 'GENERAL',
    scope: 'USER',
    subject: '',
    body_html: '',
    body_text: '',
    channel: 'EMAIL',
    email_type: '',
    override_enabled: false,
  });
  const [activeTab, setActiveTab] = useState<'html' | 'text' | 'preview'>('html');
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [mobileSection, setMobileSection] = useState<'editor' | 'settings' | 'shortcodes'>('editor');
  const [testEmail, setTestEmail] = useState('');
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && isMobile) setPreviewViewport('mobile');
  }, [isMobile, open]);

  useEffect(() => {
    if (template) {
      const overrideDefaults = getTemplateOverrideDefaults(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category || 'GENERAL',
        scope: template.scope,
        subject: template.subject || '',
        body_html: template.editable_body_html ?? template.body_html ?? '',
        body_text: template.body_text || '',
        channel: template.channel || 'EMAIL',
        email_type: overrideDefaults.emailType,
        override_enabled: overrideDefaults.overrideEnabled,
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
        email_type: '',
        override_enabled: false,
      });
    }

    setActiveTab('html');
    setTestEmail(getStoredTemplateTestEmail());
  }, [template, open]);

  const saveMutation = useMutation({
    mutationFn: (data: TemplateFormState) => {
      if (template) {
        return updateTemplate(template.id, data);
      } else {
        return createTemplate({ ...data, channel: data.channel || 'EMAIL', is_active: true });
      }
    },
    onSuccess: (savedTemplate) => {
      toast.success(template ? 'Template updated successfully' : 'Template created successfully');
      onSuccess(savedTemplate);
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(getTemplateErrorMessage(error, 'Failed to save template'));
    },
  });

  const testSendMutation = useMutation({
    mutationFn: async () => {
      if (!template) {
        throw new Error('Save this template before sending a test email.');
      }

      const email = testEmail.trim();
      if (!email) {
        throw new Error('Enter a test email address first.');
      }

      setStoredTemplateTestEmail(email);

      return testSendTemplate(template.id, {
        to: email,
        template: { ...formData },
      });
    },
    onSuccess: () => {
      toast.success(`Test email sent to ${testEmail.trim()}`);
    },
    onError: (error: unknown) => {
      toast.error(getTemplateErrorMessage(error, 'Failed to send test email'));
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (!formData.subject.trim()) {
      toast.error('Please enter a subject line');
      return;
    }
    if (!formData.body_html.trim() && !formData.body_text.trim()) {
      toast.error('Please enter template content');
      return;
    }

    saveMutation.mutate({
      ...formData,
      channel: formData.channel || 'EMAIL',
    });
  };

  const handleTestEmailChange = (value: string) => {
    setTestEmail(value);
    setStoredTemplateTestEmail(value);
  };

  const insertShortcode = (shortcode: string) => {
    const blockFormat = shortcode.match(/^\{\{\s*[\w.]+_(html|text)\s*\}\}$/)?.[1];
    const field = blockFormat === 'text' || (!blockFormat && activeTab === 'text') ? 'body_text' : 'body_html';
    const textareaRef = field === 'body_html' ? htmlTextareaRef : textTextareaRef;
    const start = textareaRef.current?.selectionStart ?? formData[field].length;
    const end = textareaRef.current?.selectionEnd ?? start;
    const text = formData[field];
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    setFormData({
      ...formData,
      [field]: before + shortcode + after,
    });
    setActiveTab(field === 'body_html' ? 'html' : 'text');

    // Set cursor position after inserted shortcode
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + shortcode.length, start + shortcode.length);
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
            onValueChange={(value) => setFormData({ ...formData, category: value as TemplateCategory })}
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
            onValueChange={(value) => setFormData({ ...formData, scope: value as TemplateScope })}
            disabled={template?.is_system}
          >
            <SelectTrigger id="scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((scope) => (
                <SelectItem key={scope.value} value={scope.value} disabled={scope.value === 'SYSTEM'}>
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

      {formData.channel === 'EMAIL' && !isDirectSystemTemplate && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label htmlFor="email_type">Automated email override</Label>
          <p className="text-xs text-muted-foreground">
            When enabled, the saved subject and body in this editor will be used for the selected automated email.
            Canonical system templates are matched and enabled automatically the first time you save them.
          </p>
          <Select
            value={formData.email_type || 'none'}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                email_type: value === 'none' ? '' : value,
                override_enabled: value === 'none' ? false : formData.override_enabled,
              })
            }
          >
            <SelectTrigger id="email_type">
              <SelectValue placeholder="Not an override" />
            </SelectTrigger>
            <SelectContent>
              {PROTECTED_EMAIL_TYPES.map((option) => (
                <SelectItem key={option.value || 'none'} value={option.value || 'none'}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={formData.override_enabled}
              disabled={!formData.email_type}
              onChange={(e) => setFormData({ ...formData, override_enabled: e.target.checked })}
            />
            Use the saved subject and body for this automated email
          </label>
        </div>
      )}

      {template?.is_system && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <strong>System Template:</strong> Name, Category, and Scope are locked, but you can still edit the subject, body, and description.
          {isDirectSystemTemplate && ' Your saved content is used automatically when this email is sent.'}
        </div>
      )}

      {formData.channel === 'EMAIL' && (
        <Card className="border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Send Test Email</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Send this template to any email address. The last email you enter stays saved for the next template.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-test-email">Test email address</Label>
              <Input
                id="template-test-email"
                type="email"
                value={testEmail}
                onChange={(e) => handleTestEmailChange(e.target.value)}
                placeholder="name@example.com"
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => testSendMutation.mutate()}
              disabled={testSendMutation.isPending || !template}
            >
              <Send className="h-4 w-4 mr-2" />
              {testSendMutation.isPending ? 'Sending test...' : 'Send test email'}
            </Button>

            {!template && (
              <p className="text-xs text-muted-foreground">
                Save the template once to enable test sending from this editor.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );

  // Editor tabs content (shared)
  const editorContent = (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'html' | 'text' | 'preview')} className="flex-1 min-h-0 flex flex-col">
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

      <TabsContent value="html" className="flex-1 min-h-0 p-3 sm:p-6 m-0 overflow-y-auto">
        <TemplateLiveContentHelp variables={template?.variables_json} format="html" content={formData.body_html} onInsert={insertShortcode} />
        <p id="email-content-help" className="mb-3 text-xs text-muted-foreground">
          Edit the message content here. The logo, illustration, light/dark colors, and footer are added automatically.
          A pasted complete email is reduced to its message content when saved.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Insert email content section">
          <span className="text-xs text-muted-foreground">Add:</span>
          {EMAIL_CONTENT_SECTIONS.map((section) => (
            <Button key={section.label} variant="outline" size="sm" onClick={() => insertShortcode(`\n${section.html}\n`)}>
              {section.label}
            </Button>
          ))}
        </div>
        <Textarea
          ref={htmlTextareaRef}
          value={formData.body_html}
          onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
          placeholder="Paste your HTML email template here..."
          aria-label="Email HTML content"
          aria-describedby="email-content-help"
          className="font-mono text-sm min-h-[300px] sm:min-h-[500px] resize-none"
        />
      </TabsContent>

      <TabsContent value="text" className="flex-1 min-h-0 p-3 sm:p-6 m-0 overflow-y-auto">
        <TemplateLiveContentHelp variables={template?.variables_json} format="text" content={formData.body_text} onInsert={insertShortcode} />
        <Textarea
          ref={textTextareaRef}
          value={formData.body_text}
          onChange={(e) => setFormData({ ...formData, body_text: e.target.value })}
          placeholder="Plain text version..."
          aria-label="Email plain text content"
          className="min-h-[300px] sm:min-h-[500px] resize-none"
        />
      </TabsContent>

      <TabsContent value="preview" className="flex-1 min-h-0 m-0 overflow-hidden">
        <TemplateRenderedPreview
          templateId={template?.id ?? null} draft={formData} enabled={open && activeTab === 'preview'}
          theme={previewTheme} viewport={previewViewport} onThemeChange={setPreviewTheme} onViewportChange={setPreviewViewport}
        />
      </TabsContent>
    </Tabs>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "flex min-h-0 flex-col p-0 gap-0 overflow-hidden [&>button:last-child]:hidden",
        isMobile
          ? "max-w-[100vw] w-full h-[100dvh] !border-0 !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0 m-0"
          : "max-w-7xl h-[90vh]"
      )}>
        {/* Header */}
        <DialogHeader className="px-3 py-2.5 sm:px-6 sm:py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm sm:text-base">
              {template ? 'Edit Template' : 'New Template'}
            </DialogTitle>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="outline" size="sm" aria-label="Cancel" onClick={onClose} disabled={saveMutation.isPending} className="h-8 sm:h-9 text-xs sm:text-sm">
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
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
                  <ShortcodePanel variables={template?.variables_json} onInsert={(code) => { insertShortcode(code); setMobileSection('editor'); }} />
                </div>
              )}
            </div>
          </div>
        ) : (
          // Desktop: 3-column layout
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="w-80 shrink-0 min-h-0 border-r p-6 overflow-y-auto">
              {settingsContent}
            </div>
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
              {editorContent}
            </div>
            {activeTab !== 'preview' && (
              <div className="w-72 shrink-0 min-h-0 border-l overflow-hidden">
                <ShortcodePanel variables={template?.variables_json} onInsert={insertShortcode} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
