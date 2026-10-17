export function accountMatchesSearch(account: { id: string | number; name: string; email: string; company?: string; phone?: string; office_phone?: string }, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  if ([account.name, account.email, account.company ?? ''].some(value => value.toLowerCase().includes(term))) return true;
  if (/^\d+$/.test(term) && Number(account.id) === Number(term)) return true;
  if (/^[+\d\s()./-]+$/.test(term)) {
    const digits = term.replace(/\D/g, '');
    return !!digits && [account.phone, account.office_phone].some(value => value?.replace(/\D/g, '').includes(digits));
  }
  return false;
}
