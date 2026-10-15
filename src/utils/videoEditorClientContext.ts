/** Server-authorized read access for the current editor's video assignment. */
export type VideoEditorClientContext = {
  canViewVideoEditorContext?: boolean;
  can_view_video_editor_context?: boolean;
};

export const canViewVideoEditorClientContext = (shoot?: VideoEditorClientContext | null): boolean =>
  (shoot?.canViewVideoEditorContext ?? shoot?.can_view_video_editor_context) === true;
