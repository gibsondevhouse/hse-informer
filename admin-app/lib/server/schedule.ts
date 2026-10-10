export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next.toISOString().slice(0, 10);
}

export async function recurrenceId(sourceId: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceId));
  return `rec-${Array.from(new Uint8Array(bytes).slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
