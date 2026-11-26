import { describe, expect, it } from 'vitest';
import { previewRecipientNames } from './emailRecipientPreview';

describe('recipient name previews', () => {
  it('renders known fictional names without altering delivery source or unrelated fields', () => {
    const source = '<p>{{ greeting }}, {{recipient_name}} [recipient_last_name]</p><p>{{client_name}}</p>';
    expect(previewRecipientNames(source)).toEqual({ content: '<p>Hi Jamie, Jamie Example Example</p><p>{{client_name}}</p>', usesSample: true });
    expect(source).toContain('{{ greeting }}');
    expect(previewRecipientNames('Thanks, {{ recipient_first_name }}')).toEqual({ content: 'Thanks, Jamie', usesSample: true });
  });

  it('leaves literal names and unsupported placeholders unchanged', () => {
    const source = 'Hi Alex, {{Recipient_Name}} [First Name] {{recipient_note}}';
    expect(previewRecipientNames(source)).toEqual({ content: source, usesSample: false });
  });
});
