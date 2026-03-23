export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoOrNow(value?: string): string {
  if (!value) return nowIso();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowIso();
  return date.toISOString();
}
