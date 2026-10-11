const partsFormatter = (timeZone: string) => new Intl.DateTimeFormat('en-US', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function localParts(instant: Date, timeZone: string): Record<string, number> {
  return Object.fromEntries(partsFormatter(timeZone).formatToParts(instant)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]));
}

export function localDate(instant: string, timeZone: string): string {
  const value = localParts(new Date(instant), timeZone);
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

/** Converts the last second of a site-local calendar day to an absolute instant. */
export function endOfSiteDay(date: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).valueOf())) {
    throw new Error('Choose a valid due date.');
  }
  const [year, month, day] = date.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day, 23, 59, 59);
  let epoch = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = localParts(new Date(epoch), timeZone);
    const offset = Date.UTC(local.year, local.month - 1, local.day,
      local.hour, local.minute, local.second) - epoch;
    const next = target - offset;
    if (next === epoch) break;
    epoch = next;
  }
  if (localDate(new Date(epoch).toISOString(), timeZone) !== date) {
    throw new Error('The due date could not be resolved in this site time zone.');
  }
  return new Date(epoch).toISOString();
}
