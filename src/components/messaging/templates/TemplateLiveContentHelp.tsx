import { Button } from '@/components/ui/button';
import { normalizeTemplateVariables } from './templatePreviewSupport';

interface Props {
  variables?: string[] | null;
  format: 'html' | 'text';
  content: string;
  onInsert: (shortcode: string) => void;
}

export function TemplateLiveContentHelp({ variables, format, content, onInsert }: Props) {
  const blocks = normalizeTemplateVariables(variables).filter((name) => name.endsWith(`_${format}`));
  if (blocks.length === 0) return null;
  const included = new Set([...content.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]));

  return (
    <div className="mb-3 rounded-lg border bg-muted/30 p-3">
      <p className="text-sm font-medium">Dynamic details</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Edit the message wording directly. These fields add the current rows and details when the email is sent.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {blocks.map((name) => (
          <Button key={name} variant="outline" size="sm" disabled={included.has(name)}
            onClick={() => onInsert(`{{${name}}}`)}>
            {included.has(name) ? 'Included: ' : 'Insert: '}{name.replace(/_(html|text)$/, '').replaceAll('_', ' ')}
          </Button>
        ))}
      </div>
    </div>
  );
}
