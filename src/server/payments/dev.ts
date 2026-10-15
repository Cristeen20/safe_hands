import "server-only";
import type { CheckoutCreated, CheckoutInput } from "./provider";
import { devProviderAllowed } from "./provider";

/**
 * Development/test stand-in for Stripe and Razorpay when their keys aren't
 * set. It sends the customer to a local page that simulates the outcome and
 * then runs the same fulfilment code as the real providers. Never in production.
 */
export function createDevCheckout(input: CheckoutInput): CheckoutCreated {
  if (!devProviderAllowed()) throw new Error("The dev payment provider is disabled in production.");
  return {
    providerRef: `dev_${input.paymentId}`,
    start: { kind: "redirect", url: `/${input.locale}/pay/dev/${input.paymentId}` },
  };
}
