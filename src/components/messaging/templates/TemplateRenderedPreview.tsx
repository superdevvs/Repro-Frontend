import { useEffect, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { previewTemplate, type TemplateDraft } from '@/services/messaging';
import { getTemplateErrorMessage } from './templatePreviewSupport';
import { safeEmailPreview } from './workspace/emailWorkspaceModel';
import { artworkRenderDraft, emailArtworkPreview, type EmailArtworkStates } from './workspace/emailArtworkPreview';

const noArtwork: EmailArtworkStates = {};

interface Props {
  compact?: boolean;
  templateId: number | null;
  draft: TemplateDraft;
  enabled: boolean;
  theme: 'light' | 'dark';
  viewport: 'desktop' | 'mobile';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onViewportChange: (viewport: 'desktop' | 'mobile') => void;
  artwork?: EmailArtworkStates;
  fallback?: ReactNode;
}

export function TemplateRenderedPreview({ compact, templateId, draft, enabled, theme, viewport, onThemeChange, onViewportChange, artwork = noArtwork, fallback }: Props) {
  const renderDraftKey = JSON.stringify(artworkRenderDraft(draft, artwork));
  const [previewDraft, setPreviewDraft] = useState<TemplateDraft>(() => JSON.parse(renderDraftKey));

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewDraft(JSON.parse(renderDraftKey)), 350);
    return () => window.clearTimeout(timer);
  }, [renderDraftKey]);

  const isUpdating = JSON.stringify(previewDraft) !== renderDraftKey;
  const preview = useQuery({
    queryKey: ['template-editor-preview', templateId, previewDraft, theme],
    queryFn: () => previewTemplate(templateId, undefined, {
      template: { ...previewDraft, name: previewDraft.name.trim() || 'Untitled email' },
      theme,
    }),
    enabled: enabled && !isUpdating,
    retry: false,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
  const sourceHtml = preview.data?.body_html || preview.data?.html;
  const html = sourceHtml ? emailArtworkPreview(sourceHtml, draft, artwork, theme) : undefined;
  const missing = preview.data?.missing_variables ?? preview.data?.missing ?? [];
  const width = viewport === 'desktop' ? 720 : 375;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!compact && <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-3 py-3 sm:px-6">
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
      </div>}
      <div className="min-h-0 flex-1 overflow-auto bg-muted/40 py-3 sm:p-6">
        <p className="mx-3 mb-3 text-xs text-muted-foreground sm:mx-0">
          Your current message, rendered as an email. Sample recipient and event data fill the dynamic fields.
        </p>
        {html && new Blob([html]).size > 90000 && <p role="status" className="mb-3 text-xs text-muted-foreground">This email contains a large amount of HTML. Shorten or simplify it to reduce clipping risk.</p>}
        {preview.data?.subject && !isUpdating && (
          <p className="mx-3 mb-3 break-words text-sm sm:mx-0"><strong>Subject:</strong> {preview.data.subject}</p>
        )}
        {fallback && (isUpdating || preview.isPlaceholderData) ? fallback : !html && (isUpdating || preview.isPending || preview.isFetching) ? fallback ?? (
          <div role="status" className="flex min-h-[320px] items-center justify-center rounded-xl border bg-background text-sm text-muted-foreground">
            Rendering email preview…
          </div>
        ) : !html ? (
          <div role="alert" className="rounded-xl border bg-background p-6">
            <p className="text-sm">{getTemplateErrorMessage(preview.error, 'The server did not return an email preview.')}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void preview.refetch()}>Retry preview</Button>
          </div>
        ) : (
          <>
            {(isUpdating || preview.isFetching) && <p role="status" className="mb-3 text-xs text-muted-foreground">Updating email preview…</p>}
            {preview.isError && <p role="alert" className="mb-3 text-sm text-muted-foreground">Could not refresh the preview. Your email is still here. <button className="underline" onClick={() => void preview.refetch()}>Retry</button></p>}
            {missing.length > 0 && (
              <p className="mb-3 text-sm text-muted-foreground" role="status">
                Sample values unavailable for: {missing.join(', ')}. These shortcodes need values when sending.
              </p>
            )}
            <div className="mx-auto overflow-hidden rounded-xl shadow-sm ring-1 ring-border" style={{ width, maxWidth: compact ? '100%' : undefined }}>
              <iframe
                title="Delivered email preview"
                className="block h-[800px] border-0"
                width={width}
                style={{ width: compact ? '100%' : width, background: theme === 'dark' ? '#080f17' : '#edf2f7', colorScheme: theme }}
                sandbox=""
                srcDoc={compact ? safeEmailPreview(html) : html}
                referrerPolicy="no-referrer"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
