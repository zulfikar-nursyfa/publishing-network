import { formatDateTime } from "./ui";

export function relativeTime(value, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

export function RelativeTime({ value, timezone = "UTC" }) {
  return value ? (
    <time dateTime={value} title={formatDateTime(value, timezone)}>
      {relativeTime(value)}
    </time>
  ) : (
    "—"
  );
}
