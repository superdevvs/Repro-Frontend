/** Group display chips without changing the booked service lines or their quantities. */
export function groupServiceItems<T>(items: readonly T[], getLabel: (item: T) => string) {
  const groups = new Map<string, { item: T; label: string; count: number }>();
  for (const item of items) {
    const label = getLabel(item).trim().replace(/\s+/g, ' ');
    if (!label) continue;
    const key = label.toLowerCase();
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { item, label, count: 1 });
  }
  return [...groups.values()];
}

export const formatServiceCount = (label: string, count: number) =>
  count > 1 ? `${label} × ${count}` : label;
