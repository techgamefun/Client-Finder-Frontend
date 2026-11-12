export type QueueJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export function formatJobStatus(status: QueueJobStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "succeeded":
      return "Finished";
    case "failed":
      return "Failed";
  }
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      });
}

export function formatOptionalTimestamp(
  value: string | null,
  emptyLabel: string,
): string {
  return value ? formatTimestamp(value) : emptyLabel;
}

export function formatElapsedTime(
  startedAt: string | null,
  completedAt: string | null,
): string {
  if (!startedAt) return "Not started";

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return "Unavailable";

  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
