import "server-only";
import { createDevCheckout } from "./dev";
import type { CheckoutCreated, CheckoutInput, ProviderName } from "./provider";

export { providerFor } from "./provider";
export type { CheckoutStart, ProviderName } from "./provider";
export { recordPaymentClosed, recordPaymentSuccess } from "./fulfil";

/** Create the provider-side checkout for a pending payment. */
export async function createCheckout(provider: ProviderName, input: CheckoutInput): Promise<CheckoutCreated> {
  switch (provider) {
    case "dev":
      return createDevCheckout(input);
    case "stripe":
    case "razorpay":
      // Wired up once the provider accounts are provisioned (Milestone 2, step 5).
      throw new Error(`${provider} checkout is not implemented yet`);
  }
}
