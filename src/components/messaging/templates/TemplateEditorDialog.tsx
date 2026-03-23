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

const PREVIEW_EMAIL_STYLES = `
.preview-shell {
  background: linear-gradient(180deg, #f7f9fc 0%, #eef3f8 100%);
  padding: 16px;
  border-radius: 28px;
}
.preview-hero {
  position: relative;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid rgba(222, 230, 241, 0.7);
  border-radius: 32px;
  box-shadow: 0 24px 70px rgba(22, 34, 60, 0.09);
  padding: 28px;
}
.preview-brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}
.preview-brand-icon {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: #11192d;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(17, 25, 45, 0.14);
}
.preview-brand-copy {
  color: #1d2940;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 800;
}
.preview-brand-copy span {
  display: block;
  color: #7f90a7;
  font-size: 10px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  font-weight: 700;
}
.preview-title {
  position: relative;
  z-index: 2;
  max-width: 560px;
  margin: 0;
  color: #10192f;
  font-size: clamp(2.8rem, 4vw, 4.4rem);
  line-height: 0.96;
  letter-spacing: -0.06em;
  font-weight: 300;
}
.preview-title-primary { color: #10192f; }
.preview-title-accent { color: #3164ea; }
.preview-copy {
  position: relative;
  z-index: 2;
  max-width: 560px;
  margin: 18px 0 0;
  color: #667a96;
  font-size: 15px;
  line-height: 1.8;
}
.preview-orbit {
  position: absolute;
  top: 32px;
  right: -10px;
  width: 200px;
  height: 200px;
  border-radius: 999px;
  border: 1px solid #ebeff5;
}
.preview-orbit::before,
.preview-orbit::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  border: 1px solid #ebeff5;
}
.preview-orbit::before { inset: 26px; }
.preview-orbit::after { inset: 52px; }
.preview-gridline-h,
.preview-gridline-v {
  position: absolute;
  background: #eef2f7;
}
.preview-gridline-h {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
}
.preview-gridline-v {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
}
.preview-journey {
  position: relative;
  z-index: 2;
  margin-top: 28px;
}
.preview-journey-bars {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.preview-journey-bar {
  height: 7px;
  border-radius: 999px;
  background: #dce5f3;
}
.preview-journey-bar.complete { background: #3164ea; }
.preview-journey-bar.next { background: #7e9ff1; }
.preview-journey-labels {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 12px;
}
.preview-journey-label {
  color: #94a4bc;
  font-size: 10px;
  line-height: 1.4;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  font-weight: 800;
}
.preview-journey-label.complete { color: #3164ea; }
.preview-journey-label.next { color: #4d5f7c; }
.preview-body {
  margin-top: 16px;
  background: #ffffff;
  border: 1px solid rgba(222, 230, 241, 0.7);
  border-radius: 28px;
  box-shadow: 0 24px 70px rgba(22, 34, 60, 0.09);
  padding: 26px;
}
.preview-footer {
  margin-top: 16px;
  border-radius: 24px;
  background: linear-gradient(135deg, #0b1b30 0%, #102847 100%);
  padding: 22px;
  color: #dce8ff;
  box-shadow: 0 20px 40px rgba(16, 40, 71, 0.18);
}
.preview-footer h4 {
  margin: 0 0 8px;
  color: #ffffff;
  font-size: 18px;
  line-height: 1.4;
  font-weight: 800;
}
.preview-footer p {
  margin: 0;
  color: #dce8ff;
  font-size: 14px;
  line-height: 1.8;
}
.preview-footer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.preview-footer-card {
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(221, 232, 255, 0.14);
}
.preview-footer-label {
  display: block;
  margin-bottom: 4px;
  color: #9fb4d4;
  font-size: 10px;
  line-height: 1.4;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  font-weight: 800;
}
.preview-footer-value {
  color: #ffffff;
  font-size: 13px;
  line-height: 1.6;
  font-weight: 700;
}
.email-preview { color: #405875; font-size: 15px; line-height: 1.8; }
.email-preview p,
.email-preview li,
.email-preview div,
.email-preview td,
.email-preview span { color: #405875; line-height: 1.8; }
.email-preview p { margin: 0 0 14px; }
.email-preview a { color: #1463ff; text-decoration: none; }
.email-preview h1,
.email-preview h2,
.email-preview h3,
.email-preview h4 { margin: 0 0 14px; color: #0f1930; line-height: 1.15; }
.email-preview h1 { font-size: 42px; font-weight: 300; letter-spacing: -0.05em; }
.email-preview h2 { font-size: 28px; font-weight: 800; }
.email-preview h3 { font-size: 22px; font-weight: 800; }
.email-preview h4 { font-size: 16px; font-weight: 800; }
.email-preview strong { color: #0f1930; }
.email-preview ul,
.email-preview ol { margin: 0 0 16px; padding-left: 20px; }
.email-preview hr { border: 0; border-top: 1px solid #edf2f7; margin: 20px 0; }
.email-preview .button {
  display: inline-block;
  padding: 14px 22px;
  border-radius: 999px;
  background: linear-gradient(135deg, #1463ff 0%, #0b83ff 100%);
  color: #ffffff !important;
  font-weight: 800;
  font-size: 14px;
  line-height: 1.2;
  text-decoration: none;
  margin: 6px 10px 10px 0;
  box-shadow: 0 12px 24px rgba(20, 99, 255, 0.18);
}
.email-preview .info-box {
  margin: 20px 0;
  padding: 18px 20px;
  border-radius: 22px;
  border: 1px solid #dfe7f2;
  background: linear-gradient(180deg, #fbfcfe 0%, #f4f7fb 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.email-preview .info-row {
  padding: 10px 0;
  border-bottom: 1px solid #e4edf8;
}
.email-preview .info-row:last-child { border-bottom: 0; }
.email-preview .info-label {
  display: inline-block;
  min-width: 150px;
  color: #93a4bd;
  font-weight: 800;
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}
.email-preview .note {
  margin: 20px 0;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid #f0d7a8;
  background: linear-gradient(180deg, #fff9ee 0%, #fff3df 100%);
  color: #8b5b14 !important;
}
`;

type PreviewJourneyStep = {
  label: string;
  state: 'complete' | 'next' | 'pending';
};

function getPreviewTitleParts(title: string): { primary: string; accent?: string } {
  const trimmed = title.trim();
  if (!trimmed) {
    return { primary: 'R/E Pro Photos update.' };
  }

  const split = trimmed.split(/\s+-\s+|\s+\|\s+|\s*:\s*/, 2);
  if (split.length === 2) {
    return {
      primary: `${split[0].replace(/\.$/, '')}.`,
      accent: split[1],
    };
  }

  const sentenceSplit = trimmed.split(/(?<=[.!?])\s+/, 2);
  if (sentenceSplit.length === 2) {
    return {
      primary: sentenceSplit[0],
      accent: sentenceSplit[1],
    };
  }

  return { primary: trimmed };
}

function getPreviewCopy(category: string, description: string): string {
  if (description.trim()) {
    return description.trim();
  }

  switch (category) {
    case 'ACCOUNT':
      return 'Everything you need is organized below, including the latest account details and access links.';
    case 'BOOKING':
      return 'Your latest schedule details, property notes, and next actions are organized below in one place.';
    case 'REMINDER':
      return 'A timely reminder with the key details you need before the next step in the workflow.';
    case 'PAYMENT':
      return 'Your transaction status and the next milestones in the workflow are summarized below.';
    case 'INVOICE':
      return 'Invoice details, due dates, and follow-up actions are collected below for quick review.';
    default:
      return 'The latest update from your R/E Pro Photos workflow is ready below.';
  }
}

function getPreviewJourney(slug?: string): PreviewJourneyStep[] | null {
  if (!slug) {
    return null;
  }

  const definition =
    slug === 'payment-thank-you' || slug === 'payment-due-reminder'
      ? { labels: ['Payment', 'Editing', 'Quality Check', 'Delivery'], active: 0 }
      : slug === 'shoot-ready' || slug === 'shoot-summary'
        ? { labels: ['Payment', 'Editing', 'Quality Check', 'Delivery'], active: 3 }
        : ['shoot-scheduled', 'shoot-requested', 'shoot-request-approved', 'shoot-request-modified', 'shoot-reminder', 'shoot-updated'].includes(slug)
          ? { labels: ['Booking', 'Scheduled', 'Editing', 'Delivery'], active: 1 }
          : null;

  if (!definition) {
    return null;
  }

  return definition.labels.map((label, index) => ({
    label,
    state: index <= definition.active ? 'complete' : index === definition.active + 1 ? 'next' : 'pending',
  }));
}

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

  // Strip wrapped email chrome so the preview only shows the editable body content.
  const stripLegacyEmailWrapper = (html: string): string => {
    if (html.includes('email-container') && html.includes('logo-text')) {
      const contentMatch = html.match(/<div\s+class=["']content["']>\s*([\s\S]+)\s*<\/div>\s*<div\s+class=["']footer["']/);
      if (contentMatch) {
        return contentMatch[1].trim();
      }
    }
    if (html.includes('class="ew"') && html.includes('class="eb"')) {
      const contentMatch = html.match(/<div\s+class=["']eb["']>\s*([\s\S]+)\s*<\/div>\s*<\/div>\s*<\/body>/i);
      if (contentMatch) {
        return contentMatch[1].trim();
      }
    }
    if (html.includes('class="page"') && html.includes('class="brand-band"')) {
      const contentMatch = html.match(/<div\s+class=["']content["']>\s*([\s\S]+)\s*<\/div>\s*<div\s+class=["']footer-wrap["']/i);
      if (contentMatch) {
        return contentMatch[1].trim();
      }
    }
    if (html.includes('class="hero-card"') && html.includes('class="body-inner"')) {
      const contentMatch = html.match(/<div\s+class=["']body-inner["']>\s*([\s\S]+)\s*<\/div>\s*<div\s+class=["']footer-wrap["']/i);
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

  const previewTitleParts = getPreviewTitleParts(formData.subject || formData.name || 'R/E Pro Photos update');
  const previewCopy = getPreviewCopy(formData.category, formData.description);
  const previewJourney = getPreviewJourney(template?.slug);

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
          <style>{PREVIEW_EMAIL_STYLES}</style>
          <div className="max-w-4xl mx-auto">
            <div className="preview-shell">
              <div className="preview-hero">
                <div className="preview-orbit">
                  <div className="preview-gridline-h" />
                  <div className="preview-gridline-v" />
                </div>
                <div className="preview-brand">
                  <div className="preview-brand-icon">✓</div>
                  <div className="preview-brand-copy">
                    <span>{formData.category || 'Workflow update'}</span>
                    R/E Pro Photos
                  </div>
                </div>
                <h1 className="preview-title">
                  <span className="preview-title-primary">{previewTitleParts.primary}</span>
                  {previewTitleParts.accent ? (
                    <>
                      <br />
                      <span className="preview-title-accent">{previewTitleParts.accent}</span>
                    </>
                  ) : null}
                </h1>
                <p className="preview-copy">{previewCopy}</p>

                {previewJourney ? (
                  <div className="preview-journey">
                    <div className="preview-journey-bars">
                      {previewJourney.map((step) => (
                        <div key={step.label} className={`preview-journey-bar ${step.state}`} />
                      ))}
                    </div>
                    <div className="preview-journey-labels">
                      {previewJourney.map((step) => (
                        <div key={step.label} className={`preview-journey-label ${step.state}`}>
                          {step.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="preview-body">
                {formData.body_html ? (
                  <div
                    className="email-preview"
                    style={{ color: '#333333', lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: stripLegacyEmailWrapper(formData.body_html) }}
                  />
                ) : formData.body_text ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm">{formData.body_text}</pre>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No content to preview</p>
                )}
              </div>

              <div className="preview-footer">
                <h4>Need help with a shoot, invoice, or account question?</h4>
                <p>
                  Our team is here to keep your workflow moving. Reach us at
                  {' '}contact@reprophotos.com or call 202-868-1663.
                </p>
                <div className="preview-footer-grid">
                  <div className="preview-footer-card">
                    <span className="preview-footer-label">Support</span>
                    <span className="preview-footer-value">contact@reprophotos.com<br />202-868-1663</span>
                  </div>
                  <div className="preview-footer-card">
                    <span className="preview-footer-label">Portal</span>
                    <span className="preview-footer-value">Track shoots, invoices, and delivery updates in one place.</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-4">
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
