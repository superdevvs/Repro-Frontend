export const studioRevisionTaskId = (value: string | null): string | null =>
  value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;

export function studioRevisionsDashboardHref(search: string): string {
  const params = new URLSearchParams({ requests: 'editing', editingSource: 'studio' });
  const task = studioRevisionTaskId(new URLSearchParams(search).get('task'));
  if (task) params.set('studioTask', task);
  return `/dashboard?${params}`;
}
