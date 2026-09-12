export const EMAIL_CONTENT_SECTIONS = [
  { label: 'Paragraph', html: '<p>Add your message here.</p>' },
  { label: 'Section', html: '<h2>Section title</h2>\n<p>Add the details your recipient needs.</p>' },
  { label: 'Details', html: '<div class="info-box">\n  <p><strong>Property:</strong> {{shoot_address}}</p>\n  <p><strong>Date:</strong> {{shoot_date}}</p>\n</div>' },
  { label: 'Action', html: '<p><a class="button" href="{{portal_url}}">Open dashboard</a></p>' },
] as const;

export function normalizeTemplateVariables(variables: string[] = []): string[] {
  return [...new Set(variables.map((value) => value.replace(/^\{\{\s*|\s*\}\}$/g, '').trim())
    .filter((value) => /^[a-zA-Z_][\w.]*$/.test(value)))];
}

export function getTemplateErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const response = 'response' in error
      ? (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response
      : undefined;
    for (const value of [response?.data?.error, response?.data?.message, 'message' in error ? error.message : undefined]) {
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return fallback;
}
