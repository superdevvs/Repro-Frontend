export function valueLabel(value: number | null | undefined, unit: string) {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  if (unit === "bytes" || unit === "bytes/s") {
    const i = Math.min(
      4,
      Math.max(0, Math.floor(Math.log(Math.max(value, 1)) / Math.log(1024))),
    );
    return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${["B", "KiB", "MiB", "GiB", "TiB"][i]}${unit === "bytes/s" ? "/s" : ""}`;
  }
  if (unit === "seconds") {
    if (value > 86400) return `${(value / 86400).toFixed(1)} days`;
    if (value > 3600) return `${(value / 3600).toFixed(1)} hours`;
    return `${Math.round(value)}s`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit === "%" ? "%" : unit === "count" ? "" : ` ${unit}`}`;
}
export const timeLabel = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Not observed";
