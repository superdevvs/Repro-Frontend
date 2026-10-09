export function parseTimeInput(text: string): number | null {
  const match = text.trim().match(/^(\d{1,2}):([0-5]\d)\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  } else if (hour > 23) return null;
  return hour * 60 + Number(match[2]);
}
