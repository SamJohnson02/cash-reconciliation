export function formatMoney(value: string | null): string {
  if (value == null) return "—";
  const negative = value.startsWith("-");
  const [whole, frac] = value.replace("-", "").split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${withCommas}.${frac}`;
}

export function toCents(amount: string): number {
  const negative = amount.startsWith("-");
  const [whole, frac] = amount.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac);
  return negative ? -cents : cents;
}

export function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function formatLong(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

export function formatShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

export function formatWhen(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatCutoff(hhmm: string): string {
  const [hourValue, minute] = hhmm.split(":").map(Number);
  const suffix = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 === 0 ? 12 : hourValue % 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function zoneLabel(timeZone: string): string {
  return timeZone === "America/Chicago" ? "CT" : timeZone;
}

export function maskAccount(value: string): string {
  return `•••${value.slice(-4)}`;
}

export function breakLabel(item: { classification: string; timingDifference: boolean }): string {
  if (item.timingDifference) return "Timing";
  switch (item.classification) {
    case "AMOUNT_BREAK":
      return "Amount break";
    case "MISSING_IN_BANK":
      return "Missing in bank";
    case "MISSING_IN_LEDGER":
      return "Missing in ledger";
    case "DUPLICATE":
      return "Duplicate";
    case "MATCHED":
      return "Matched";
    default:
      return item.classification;
  }
}

export function statusLabel(status: string | null): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "INVESTIGATING":
      return "Investigating";
    case "RESOLVED":
      return "Resolved";
    default:
      return "Matched";
  }
}

export function roleLabel(role: string): string {
  switch (role) {
    case "MAKER":
      return "Maker";
    case "CHECKER":
      return "Checker";
    case "ADMIN":
      return "Admin";
    default:
      return role;
  }
}

export function lagSentence(lagDays: number): string {
  if (lagDays === 0) return "Value dates match.";
  const days = Math.abs(lagDays);
  const unit = days === 1 ? "day" : "days";
  if (lagDays > 0) return `Bank value date is ${days} calendar ${unit} after the ledger.`;
  return `Bank value date is ${days} calendar ${unit} before the ledger.`;
}

export function bankVersusLedger(ledger: string | null, bank: string | null): string | null {
  if (ledger == null || bank == null) return null;
  const gap = toCents(bank) - toCents(ledger);
  if (gap === 0) return null;
  const amount = formatMoney(fromCents(Math.abs(gap)));
  return gap > 0 ? `Bank is ${amount} higher than the ledger.` : `Bank is ${amount} lower than the ledger.`;
}

export function ageLabel(ageDays: number | null): string {
  if (ageDays == null) return "";
  if (ageDays === 0) return "Opened today";
  if (ageDays === 1) return "1 day open";
  return `${ageDays} days open`;
}
