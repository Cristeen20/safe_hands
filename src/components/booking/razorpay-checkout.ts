"use client";

import type { CheckoutStart } from "@/server/payments/provider";

type RazorpayStart = Extract<CheckoutStart, { kind: "razorpay" }>;

/**
 * D24: open Razorpay Standard Checkout for India. Implemented once Razorpay
 * keys are provisioned; until then India uses the dev provider (a redirect),
 * so this is never reached.
 */
export async function openRazorpayCheckout(
  _locale: string,
  _bookingId: string,
  _start: RazorpayStart,
): Promise<"paid" | "dismissed" | "failed"> {
  throw new Error("Razorpay checkout is not implemented yet");
}
