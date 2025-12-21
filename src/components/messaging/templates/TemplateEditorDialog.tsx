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
import { Eye, Code, Save, X } from 'lucide-react';

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>
              {template ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saveMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Settings */}
          <div className="w-80 border-r p-6 overflow-y-auto">
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
                  rows={3}
                />
              </div>

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
          </div>

          {/* Middle Panel - Content Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'html' | 'text')} className="flex-1 flex flex-col">
              <div className="border-b px-6 py-3 bg-muted/30">
                <TabsList>
                  <TabsTrigger value="html" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    HTML Editor
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-2">
                    Text Only
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="html" className="flex-1 p-6 m-0 overflow-y-auto">
                <Textarea
                  ref={htmlTextareaRef}
                  value={formData.body_html}
                  onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                  placeholder="Paste your HTML email template here. Use shortcodes from the right panel..."
                  className="font-mono text-sm min-h-[500px] resize-none"
                />
              </TabsContent>

              <TabsContent value="text" className="flex-1 p-6 m-0 overflow-y-auto">
                <Textarea
                  ref={textTextareaRef}
                  value={formData.body_text}
                  onChange={(e) => setFormData({ ...formData, body_text: e.target.value })}
                  placeholder="Plain text version for email clients that don't support HTML..."
                  className="min-h-[500px] resize-none"
                />
              </TabsContent>

              <TabsContent value="preview" className="flex-1 m-0 bg-gray-100 overflow-hidden">
                <div className="h-full overflow-y-auto p-6">
                  <div className="max-w-3xl mx-auto space-y-4">
                    <Card className="shadow-lg">
                    {/* Email Client Header Simulation */}
                      <div className="bg-white border-b p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                              RP
                            </div>
                            <div>
                              <div className="font-semibold text-sm">REPro Photos</div>
                              <div className="text-xs text-muted-foreground">notifications@reprophotos.com</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">Just now</div>
                        </div>
                        <div className="font-semibold text-base">{formData.subject || '(No subject)'}</div>
                      </div>
                      
                      {/* Email Body */}
                      <div className="p-6 bg-white max-h-[60vh] overflow-y-auto">
                        {formData.body_html ? (
                          <div 
                            className="email-preview"
                            dangerouslySetInnerHTML={{ __html: formData.body_html }} 
                          />
                        ) : formData.body_text ? (
                          <pre className="whitespace-pre-wrap font-sans text-sm">{formData.body_text}</pre>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">No content to preview</p>
                        )}
                      </div>
                    </Card>
                    
                    <p className="text-center text-xs text-muted-foreground">
                      ℹ️ Shortcodes will be replaced with actual values when sent
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - Shortcodes */}
          <div className="w-80 border-l overflow-hidden">
            <ShortcodePanel onInsert={insertShortcode} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
