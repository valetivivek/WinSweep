/** Human-readable byte size, e.g. 1.4 GB. Returns a dash for unknown sizes. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "--";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  const rounded = value >= 100 || i === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}

/** Friendly date like "12 Mar 2025". Returns a dash for unknown dates. */
export function formatDate(iso: string | null): string {
  if (!iso) return "--";
  const date = parseLocalDate(iso);
  if (!date) return "--";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

