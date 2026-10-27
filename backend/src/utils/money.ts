/**
 * Precise currency arithmetic utilities to prevent IEEE 754 floating-point drift.
 */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

export function roundMoney(amount: number): number {
  return Number(amount.toFixed(2));
}
