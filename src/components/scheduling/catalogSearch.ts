export function serviceMatchesSearch(name: string, description: string | undefined, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return name.toLowerCase().includes(needle) || (description ?? '').toLowerCase().includes(needle);
}
