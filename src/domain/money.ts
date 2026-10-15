export const CURRENCIES = ["USD", "CAD", "GBP", "INR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * Smallest charge each provider accepts, in minor units (cents, pence, paise):
 * Stripe 0.50 USD / 0.50 CAD / 0.30 GBP; Razorpay 1.00 INR.
 */
export const MIN_CHARGE_MINOR: Record<Currency, number> = {
  USD: 50,
  CAD: 50,
  GBP: 30,
  INR: 100,
};

/** Largest quote we accept, as a typo guard (10,00,000 INR ≈ 10k USD). */
export const MAX_CHARGE_MINOR: Record<Currency, number> = {
  USD: 10_000_00,
  CAD: 15_000_00,
  GBP: 10_000_00,
  INR: 10_00_000_00,
};

export type ParseAmountResult =
  | { ok: true; minor: number }
  | { ok: false; error: "invalid" | "tooSmall" | "tooLarge" };

/**
 * Parse an admin-typed amount ("49.5", "1,250.00") into integer minor units.
 * All four launch currencies have two decimal places. Never uses floats for
 * the stored value.
 */
export function parseAmount(input: string, currency: Currency): ParseAmountResult {
  const clean = input.trim().replace(/[,\s]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return { ok: false, error: "invalid" };
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) return { ok: false, error: "invalid" };
  if (minor < MIN_CHARGE_MINOR[currency]) return { ok: false, error: "tooSmall" };
  if (minor > MAX_CHARGE_MINOR[currency]) return { ok: false, error: "tooLarge" };
  return { ok: true, minor };
}

/** Minor units as a major-unit number, for display formatting only. */
export function toMajor(minor: number): number {
  return minor / 100;
}
