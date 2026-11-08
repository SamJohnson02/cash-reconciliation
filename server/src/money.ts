const MONEY = /^-?\d+\.\d{2}$/;

export function assertMoney(value: string): void {
  if (!MONEY.test(value)) {
    throw new Error(`Amount must be a signed 2-decimal string, received ${value}`);
  }
}

export function toCents(amount: string): number {
  assertMoney(amount);
  const negative = amount.startsWith("-");
  const [whole, frac] = amount.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac);
  return negative ? -cents : cents;
}

export function fromCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Cents value is not a safe integer: ${cents}`);
  }
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}
