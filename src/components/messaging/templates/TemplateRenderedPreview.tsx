import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { previewTemplate, type TemplateDraft } from '@/services/messaging';
import { getTemplateErrorMessage } from './templatePreviewSupport';

interface Props {
  templateId: number | null;
  draft: TemplateDraft;
  enabled: boolean;
  theme: 'light' | 'dark';
  viewport: 'desktop' | 'mobile';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onViewportChange: (viewport: 'desktop' | 'mobile') => void;
}

export function TemplateRenderedPreview({ templateId, draft, enabled, theme, viewport, onThemeChange, onViewportChange }: Props) {
  const [previewDraft, setPreviewDraft] = useState(draft);

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewDraft(draft), 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const isUpdating = previewDraft !== draft;
  const preview = useQuery({
    queryKey: ['template-editor-preview', templateId, previewDraft, theme],
    queryFn: () => previewTemplate(templateId, undefined, {
      template: { ...previewDraft, name: previewDraft.name.trim() || 'Untitled email' },
      theme,
    }),
    enabled: enabled && !isUpdating,
    retry: false,
    staleTime: 0,
  });
  const html = preview.data?.body_html || preview.data?.html;
  const missing = preview.data?.missing_variables ?? preview.data?.missing ?? [];
  const width = viewport === 'desktop' ? 720 : 375;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-3 py-3 sm:px-6">
        <div className="flex gap-1" role="group" aria-label="Email color theme">
          {(['light', 'dark'] as const).map((value) => (
            <Button key={value} size="sm" variant={theme === value ? 'default' : 'outline'}
              aria-pressed={theme === value} onClick={() => onThemeChange(value)}>
              {value === 'light' ? 'Light' : 'Dark'}
            </Button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="Email viewport">
          {(['desktop', 'mobile'] as const).map((value) => (
            <Button key={value} size="sm" variant={viewport === value ? 'default' : 'outline'}
              aria-pressed={viewport === value} onClick={() => onViewportChange(value)}>
              {value === 'desktop' ? 'Desktop' : 'Mobile'}
            </Button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-muted/40 py-3 sm:p-6">
        <p className="mx-3 mb-3 text-xs text-muted-foreground sm:mx-0">
          Current draft rendered by the same server flow used for sending. Sample values replace shortcodes.
        </p>
        {preview.data?.subject && !isUpdating && (
          <p className="mx-3 mb-3 break-words text-sm sm:mx-0"><strong>Subject:</strong> {preview.data.subject}</p>
        )}
        {isUpdating || preview.isPending || preview.isFetching ? (
          <div role="status" className="flex min-h-[320px] items-center justify-center rounded-xl border bg-background text-sm text-muted-foreground">
            Rendering email preview…
          </div>
        ) : preview.isError || !html ? (
          <div role="alert" className="rounded-xl border bg-background p-6">
            <p className="text-sm">{getTemplateErrorMessage(preview.error, 'The server did not return an email preview.')}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void preview.refetch()}>Retry preview</Button>
          </div>
        ) : (
          <>
            {missing.length > 0 && (
              <p className="mb-3 text-sm text-muted-foreground" role="status">
                Sample values unavailable for: {missing.join(', ')}. These shortcodes need values when sending.
              </p>
            )}
            <div className="mx-auto overflow-hidden rounded-xl shadow-sm ring-1 ring-border" style={{ width }}>
              <iframe
                title="Delivered email preview"
                className="block h-[800px] border-0"
                width={width}
                style={{ width, background: theme === 'dark' ? '#080f17' : '#edf2f7', colorScheme: theme }}
                sandbox=""
                srcDoc={html}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
