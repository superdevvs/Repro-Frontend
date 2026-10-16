import type { ComponentProps } from 'react';
import { TemplateEditorDialog } from './TemplateEditorDialog';
import { EmailTemplateWorkspace } from './workspace/EmailTemplateWorkspace';

/** Every email entry point uses the workspace; SMS keeps its channel-specific editor. */
export function TemplateWorkspaceDialog(props: ComponentProps<typeof TemplateEditorDialog>) {
  return props.template?.channel === 'SMS' ? <TemplateEditorDialog {...props}/> : <EmailTemplateWorkspace {...props}/>;
}
