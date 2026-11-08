const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function assertIsoDate(value: string): void {
  if (!ISO_DATE.test(value)) {
    throw new Error(`Expected YYYY-MM-DD, received ${value}`);
  }
}

export function dateToUtc(isoDate: string): Date {
  assertIsoDate(isoDate);
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Bank value date minus ledger value date, in calendar days. */
export function calendarLagDays(ledgerDate: string, bankDate: string): number {
  const ms = dateToUtc(bankDate).getTime() - dateToUtc(ledgerDate).getTime();
  return Math.round(ms / DAY_MS);
}

/** Convert a wall-clock time in `timeZone` to a UTC instant. */
export function zonedLocalToUtc(isoDate: string, hhmm: string, timeZone: string): Date {
  assertIsoDate(isoDate);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    throw new Error(`Expected HH:MM, received ${hhmm}`);
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const rendered = (ms: number) => {
    const map: Record<string, string> = {};
    for (const part of formatter.formatToParts(new Date(ms))) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    let renderedHour = Number(map.hour);
    if (renderedHour === 24) renderedHour = 0;
    return Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), renderedHour, Number(map.minute));
  };
  let utc = desired;
  utc += desired - rendered(utc);
  utc += desired - rendered(utc);
  return new Date(utc);
}

export function calendarDateInZone(instant: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

export function calendarDaysBetween(startIso: string, endIso: string): number {
  return calendarLagDays(startIso, endIso);
}

/** The next `count` weekdays after `from`, skipping Saturday and Sunday. */
export function nextBusinessDays(from: string, count: number): string[] {
  if (count < 0) {
    throw new Error(`count must be >= 0, received ${count}`);
  }
  const days: string[] = [];
  const cursor = dateToUtc(from);
  while (days.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.push(formatUtcDate(cursor));
    }
  }
  return days;
}
