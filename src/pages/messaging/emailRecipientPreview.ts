const RECIPIENT_SAMPLES: Record<string, string> = {
  recipient_first_name: 'Jamie',
  recipient_name: 'Jamie Example',
  recipient_last_name: 'Example',
  greeting: 'Hi Jamie',
};

export const recipientNameFields = Object.keys(RECIPIENT_SAMPLES);

export const isAutomaticRecipientField = (name: string) => [
  ...recipientNameFields, 'recipient_id', 'recipient_email', 'recipient_company',
  'recipient_phone', 'recipient_role', 'recipient_type',
].includes(name);

// Preview only: the original draft keeps its tokens for per-address delivery.
export function previewRecipientNames(source: string): { content: string; usesSample: boolean } {
  let usesSample = false;
  const content = source.replace(/\{\{\s*(recipient_first_name|recipient_name|recipient_last_name|greeting)\s*\}\}|\[(recipient_first_name|recipient_name|recipient_last_name|greeting)\]/g, (_token, braces: string | undefined, brackets: string | undefined) => {
    usesSample = true;
    return RECIPIENT_SAMPLES[braces ?? brackets!];
  });
  return { content, usesSample };
}

export const RECIPIENT_PREVIEW_NOTE = 'Recipient names in this preview are examples. Each To recipient receives their own saved name; if no name is available, the greeting uses “there”.';
