import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import type { SmsContact } from '@/types/messaging';

interface SmsContactPanelProps {
  contact?: SmsContact;
  onUpdateContact: (payload: {
    name?: string;
    email?: string;
    type?: string;
    numbers?: SmsContact['numbers'];
    tags?: string[];
  }) => Promise<void>;
  onUpdateComment: (comment: string) => Promise<void>;
  onClose?: () => void;
}

export const SmsContactPanel = ({ contact, onUpdateContact, onUpdateComment, onClose }: SmsContactPanelProps) => {
  const [localContact, setLocalContact] = useState<SmsContact | undefined>(contact);
  const [commentDraft, setCommentDraft] = useState(contact?.comment ?? '');
  const [commentSaving, setCommentSaving] = useState(false);

  useEffect(() => {
    setLocalContact(contact);
    setCommentDraft(contact?.comment ?? '');
  }, [contact]);

  useEffect(() => {
    if (!contact) return;

    const handler = setTimeout(async () => {
      if (commentDraft === contact.comment) return;
      setCommentSaving(true);
      await onUpdateComment(commentDraft);
      setCommentSaving(false);
    }, 600);

    return () => clearTimeout(handler);
  }, [commentDraft, contact, onUpdateComment]);

  const numbers = localContact?.numbers ?? [];

  const handleFieldBlur = async (field: 'name' | 'email' | 'type', value: string) => {
    if (!localContact) return;
    if ((localContact as any)[field] === value) return;
    await onUpdateContact({
      name: field === 'name' ? value : localContact.name,
      email: field === 'email' ? value : localContact.email,
      type: field === 'type' ? value : localContact.type,
      numbers: localContact.numbers,
      tags: localContact.tags,
    });
  };

  const handleSaveNumbers = async () => {
    if (!localContact) return;
    await onUpdateContact({
      name: localContact.name,
      email: localContact.email,
      type: localContact.type,
      numbers: localContact.numbers,
      tags: localContact.tags,
    });
  };

  const handleAddNumber = () => {
    setLocalContact((prev) => {
      if (!prev) return prev;
      return { ...prev, numbers: [...(prev.numbers ?? []), { id: crypto.randomUUID(), number: '', label: 'Other' }] };
    });
  };

  const handleNumberChange = (index: number, field: 'number' | 'label', value: string) => {
    setLocalContact((prev) => {
      if (!prev) return prev;
      const updated = [...(prev.numbers ?? [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, numbers: updated };
    });
  };

  const handleRemoveNumber = (index: number) => {
    setLocalContact((prev) => {
      if (!prev) return prev;
      const updated = [...(prev.numbers ?? [])];
      updated.splice(index, 1);
      return { ...prev, numbers: updated };
    });
  };

  if (!localContact) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Select a thread to view contact details.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col border-l border-border/70">
      <CardHeader className="flex items-center justify-between gap-4">
        <CardTitle>Contact</CardTitle>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-6 overflow-y-auto pb-8">
        <section className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Name</label>
            <Input
              value={localContact.name ?? ''}
              onChange={(e) => setLocalContact((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
              onBlur={(e) => handleFieldBlur('name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Email</label>
            <Input
              type="email"
              value={localContact.email ?? ''}
              onChange={(e) => setLocalContact((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
              onBlur={(e) => handleFieldBlur('email', e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Numbers</label>
            <Button variant="ghost" size="icon" onClick={handleAddNumber}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {numbers.map((number, index) => (
              <div key={number.id ?? index} className="flex items-center gap-2">
                <Input
                  value={number.label ?? ''}
                  placeholder="Label"
                  onChange={(e) => handleNumberChange(index, 'label', e.target.value)}
                />
                <Input
                  value={number.number}
                  placeholder="+1 555 000 0000"
                  onChange={(e) => handleNumberChange(index, 'number', e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => handleRemoveNumber(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!numbers.length && <p className="text-xs text-muted-foreground">No numbers on file.</p>}
            <Button size="sm" onClick={handleSaveNumbers}>
              Save numbers
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Comment</label>
          <Textarea rows={4} value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Internal note..." />
          <p className="text-xs text-muted-foreground">{commentSaving ? 'Saving...' : 'Visible only to your team.'}</p>
        </section>

        <section className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Tags</label>
          <div className="flex flex-wrap gap-2">
            {(contact.tags ?? []).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs capitalize">
                {tag}
              </Badge>
            ))}
            {!contact.tags?.length && <p className="text-xs text-muted-foreground">No tags yet.</p>}
          </div>
        </section>
      </CardContent>
    </Card>
  );
};

