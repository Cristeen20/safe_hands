import "server-only";
import { REGION_CONFIG, type AppLocale, type Region } from "@/lib/region";

export type ProviderName = "stripe" | "razorpay" | "dev";

/** What the browser does next to pay. */
export type CheckoutStart =
  | { kind: "redirect"; url: string }
  | {
      kind: "razorpay";
      keyId: string;
      orderId: string;
      amountMinor: number;
      currency: string;
      /** Seconds the checkout stays open: never past the quote's expiry. */
      timeoutSeconds: number;
    };

export type CheckoutInput = {
  paymentId: string;
  bookingId: string;
  locale: AppLocale;
  amountMinor: number;
  currency: string;
  description: string;
  customerEmail: string | null;
  /** The checkout must close by then (from `paymentWindow`). */
  closesAt: Date;
};

export type CheckoutCreated = { providerRef: string; start: CheckoutStart };

function isConfigured(provider: Exclude<ProviderName, "dev">): boolean {
  if (provider === "stripe") return !!process.env.STRIPE_SECRET_KEY;
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/**
 * D21: Razorpay for India, Stripe elsewhere. Without that provider's keys,
 * development and tests fall back to the dev provider; production refuses.
 */
export function providerFor(region: Region): ProviderName {
  const provider = REGION_CONFIG[region].paymentProvider;
  if (isConfigured(provider)) return provider;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Payment provider "${provider}" is not configured for ${region}.`);
  }
  return "dev";
}

export function devProviderAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}
