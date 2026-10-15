/**
 * Euro amounts as PayPal expects them: a decimal string with exactly two
 * decimals, e.g. "40.00". Calculations use integer cents, never floats.
 */
export const MONEY_PATTERN = /^(0|[1-9]\d{0,5})\.\d{2}$/;

export function isMoney(value: string): boolean {
  return MONEY_PATTERN.test(value);
}

/** "40.00" → 4000. Throws on anything that is not a valid amount. */
export function toCents(value: string): number {
  if (!isMoney(value)) throw new RangeError("Not a two-decimal euro amount.");
  const [units, decimals] = value.split(".");
  return Number(units) * 100 + Number(decimals);
}

/** 4000 → "40.00". */
export function fromCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError("Cents must be a non-negative integer.");
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
