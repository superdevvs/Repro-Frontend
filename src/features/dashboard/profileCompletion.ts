export type TaxDocumentCompletion = 'present' | 'missing' | 'unknown';

export type ProfileCompletionItem = {
  id: string;
  label: string;
  href: string;
  complete: boolean;
};

export type ProfileCompletionUser = {
  role?: string | null;
  avatar?: string | null;
  phone?: string | null;
  phonenumber?: string | null;
  company?: string | null;
  company_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  zipcode?: string | null;
  license_number?: string | null;
  licenseNumber?: string | null;
  metadata?: Record<string, unknown> | null;
  pending_address_change?: unknown;
};

const filled = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const text = (user: ProfileCompletionUser, ...keys: Array<keyof ProfileCompletionUser>) =>
  keys.some((key) => filled(user[key]));

const metadataText = (user: ProfileCompletionUser, key: string) => filled(user.metadata?.[key]);

const addressComplete = (user: ProfileCompletionUser) =>
  filled(user.address) && filled(user.city) && filled(user.state) && (filled(user.zip) || filled(user.zipcode));

const item = (id: string, label: string, href: string, complete: boolean): ProfileCompletionItem => ({
  id, label, href, complete,
});

const photographerItems = (user: ProfileCompletionUser, taxDocument: TaxDocumentCompletion): ProfileCompletionItem[] => {
  const account = '/photographer-account?tab=personal';
  const work = '/photographer-account?tab=work';
  const items = [
    item('photo', 'Profile photo', account, text(user, 'avatar')),
    item('phone', 'Phone number', account, text(user, 'phone', 'phonenumber')),
    item('address', 'Home base', work, addressComplete(user)),
    item('license', 'License number', work, text(user, 'licenseNumber', 'license_number')),
    item('insurance-number', 'Insurance number', work, metadataText(user, 'insuranceNumber')),
    item('insurance-document', 'Insurance document', work, metadataText(user, 'insuranceFile')),
    item('pilot-license', 'Pilot license', work, metadataText(user, 'pilotLicenseFile')),
  ];
  if (taxDocument !== 'unknown') {
    items.push(item('tax-document', 'Tax document', work, taxDocument === 'present'));
  }
  return items;
};

const clientItems = (user: ProfileCompletionUser): ProfileCompletionItem[] => {
  const profile = '/profile';
  return [
    item('photo', 'Profile photo', profile, text(user, 'avatar')),
    item('phone', 'Phone number', profile, text(user, 'phone', 'phonenumber')),
    item('company', 'Company', profile, text(user, 'company', 'company_name')),
    item('billing-address', 'Billing address', profile, addressComplete(user)),
  ];
};

const editorItems = (user: ProfileCompletionUser): ProfileCompletionItem[] => [
  item('photo', 'Profile photo', '/settings?tab=profile', text(user, 'avatar')),
  item('phone', 'Phone number', '/settings?tab=account', text(user, 'phone', 'phonenumber')),
];

const staffItems = (user: ProfileCompletionUser): ProfileCompletionItem[] => [
  item('photo', 'Profile photo', '/settings?tab=profile', text(user, 'avatar')),
  item('phone', 'Phone number', '/settings?tab=account', text(user, 'phone', 'phonenumber')),
  item('company', 'Company', '/settings?tab=account', text(user, 'company', 'company_name')),
];

const STAFF_ROLES = new Set(['admin', 'superadmin', 'editing_manager', 'salesRep']);

export function profileCompletionItems(
  user: ProfileCompletionUser | null | undefined,
  taxDocument: TaxDocumentCompletion = 'unknown',
): ProfileCompletionItem[] {
  const role = user?.role ?? '';
  if (!user) return [];
  if (role === 'photographer') return photographerItems(user, taxDocument);
  if (role === 'client') return clientItems(user);
  if (role === 'editor') return editorItems(user);
  if (STAFF_ROLES.has(role)) return staffItems(user);
  return [];
}

export function profileCompletionSummary(items: ProfileCompletionItem[]) {
  const complete = items.filter((entry) => entry.complete).length;
  return {
    total: items.length,
    complete,
    next: items.find((entry) => !entry.complete) ?? null,
    done: items.length > 0 && complete === items.length,
  };
}
