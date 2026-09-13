import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { TemplateContentBlockOverrides, TemplateEditableContentBlock } from '@/types/messaging';
import { normalizeTemplateVariables } from './templatePreviewSupport';

interface Props {
  blocks: TemplateEditableContentBlock[];
  overrides?: TemplateContentBlockOverrides | null;
  format: 'html' | 'text';
  onChange: (key: string, field: 'body_html' | 'body_text', value: string) => void;
  onInsert: (key: string, shortcode: string, field: 'body_html' | 'body_text') => void;
  setTextareaRef: (key: string, field: 'body_html' | 'body_text', node: HTMLTextAreaElement | null) => void;
}

export function TemplateContentBlocksEditor({ blocks, overrides, format, onChange, onInsert, setTextareaRef }: Props) {
  const field = format === 'html' ? 'body_html' : 'body_text';
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Edit the wording in each section. Names, dates, amounts, and repeating rows use the current data when the email is sent.
      </p>
      {blocks.map((block) => {
        const variables = normalizeTemplateVariables(block.variables_json).filter((name) => !name.endsWith(format === 'html' ? '_text' : '_html'));
        return (
        <fieldset key={block.key} data-testid={`email-content-block-${block.key}`} className="min-w-0 rounded-lg border bg-background p-3">
          <legend className="px-1 text-sm font-medium">{block.label}</legend>
          <Textarea
            ref={(node) => setTextareaRef(block.key, field, node)}
            aria-label={`${block.label} ${format === 'html' ? 'HTML' : 'plain text'} content`}
            value={overrides?.[block.key]?.[field] ?? block[field]}
            onChange={(event) => onChange(block.key, field, event.target.value)}
            className={format === 'html' ? 'min-h-[100px] font-mono text-sm' : 'min-h-[100px] text-sm'}
            rows={4}
          />
          {variables.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={`Fields for ${block.label}`}>
              <span className="text-xs text-muted-foreground">Fields for this section:</span>
              {variables.map((name) => (
                <Button key={name} variant="outline" size="sm" className="h-auto max-w-full whitespace-normal px-2 py-1 font-mono text-xs"
                  onClick={() => onInsert(block.key, `{{${name}}}`, field)}>{`{{${name}}}`}</Button>
              ))}
            </div>
          )}
        </fieldset>
        );
      })}
    </div>
  );
}
