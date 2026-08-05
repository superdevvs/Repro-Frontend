export const formatEditorCurrency = (amount: number | string | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));

export const formatEditorTimestamp = (value?: string | null) => {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
};

export const formatEditorShortDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatEditorPeriodLabel = (
  period?: { start?: string | null; end?: string | null } | null,
) => {
  const start = formatEditorShortDate(period?.start);
  const end = formatEditorShortDate(period?.end);
  if (!start && !end) return 'All-time';
  if (start && end) return `${start} – ${end}`;
  return start || end || 'All-time';
};
