"use client";

import { useLocale } from "next-intl";
import { startPayment, type StartPaymentResult } from "@/server/bookings";
import { openRazorpayCheckout } from "./razorpay-checkout";

type PayError = Extract<StartPaymentResult, { ok: false }>["error"] | "verifyFailed";
export type PayOutcome = { ok: true; redirected: boolean } | { ok: false; error: PayError };

/**
 * D13/D24: start paying a quoted booking. Stripe and the dev provider navigate
 * away (redirected: true); Razorpay opens its pop-up and resolves here.
 */
export function usePayBooking() {
  const locale = useLocale();
  return async function pay(bookingId: string): Promise<PayOutcome> {
    const result = await startPayment(locale, bookingId);
    if (!result.ok) return { ok: false, error: result.error };
    const { start } = result;
    if (start.kind === "redirect") {
      window.location.assign(start.url);
      return { ok: true, redirected: true };
    }
    const outcome = await openRazorpayCheckout(locale, bookingId, start);
    return outcome === "failed" ? { ok: false, error: "verifyFailed" } : { ok: true, redirected: false };
  };
}
