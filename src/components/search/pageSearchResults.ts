import type { SearchResult } from './searchTypes';

/** Explicit display fields only; never serialize entire page records into previews. */
export function pageSearchResults(records: readonly unknown[], type: string, destination: string): SearchResult[] {
  return records.map((record, index) => {
    const row = record as Record<string, unknown>;
    const value = (...keys: string[]) => keys.map(key => key.split('.').reduce<unknown>((record, part) => record && typeof record === 'object' ? (record as Record<string, unknown>)[part] : undefined, row)).find(item => typeof item === 'string' || typeof item === 'number');
    const id = String(value('id', 'key', 'user_id', 'shoot_id', 'client_key') ?? index);
    const title = String(value('name', 'title', 'subject', 'fullAddress', 'address', 'location.fullAddress', 'location.address', 'propertyAddress', 'property_address', 'shoot.address', 'invoiceNumber', 'invoice_number', 'label', 'editor.name', 'photographer.name', 'payee.name', 'contact.name', 'summary') ?? `${type} #${id}`);
    const metadata: Record<string, string | number | null> = {};
    for (const [label, keys] of Object.entries({ Company: ['company', 'company_name'], Client: ['client.name', 'clientName'], Email: ['email', 'editor.email'], Phone: ['phone'], Status: ['status', 'account_status'], Role: ['role'], Address: ['address', 'propertyAddress', 'location.address'], Date: ['date', 'scheduledDate', 'created_at', 'createdAt'], Amount: ['amount', 'total_amount', 'totalAmount'] })) {
      const item = value(...keys); if (item !== undefined) metadata[label] = item as string | number;
    }
    return { type, id, title, subtitle: Object.values(metadata).slice(0, 3).join(' · '), metadata,
      destination: destination.replace('{id}', encodeURIComponent(id)).replace('{query}', encodeURIComponent(title)) };
  });
}
