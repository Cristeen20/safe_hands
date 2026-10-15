import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { booking, payment } from "@/db/schema";
import { notifyAdmins, notifyCustomer } from "../notifications";
import { transitionBooking } from "../transitions";

export type FulfilResult = "confirmed" | "alreadyRecorded" | "late" | "unknownPayment";

/**
 * Record a successful payment and confirm its booking. Called from every path
 * that learns a payment succeeded (webhooks, the Stripe return page, the
 * Razorpay checkout handler, the dev provider), possibly more than once and
 * concurrently for the same payment, so it is idempotent: the payment row is
 * locked and a second call finds it already succeeded.
 *
 * If the booking stopped being payable meanwhile (expired or declined), the
 * money is kept and an admin is asked to handle it — no automatic refund (D16).
 */
export async function recordPaymentSuccess({
  providerRef,
  providerPaymentId,
}: {
  providerRef: string;
  providerPaymentId: string;
}): Promise<FulfilResult> {
  const outcome = await db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(payment)
      .where(eq(payment.providerRef, providerRef))
      .for("update")
      .limit(1);
    if (!p) return { result: "unknownPayment" as const };
    if (p.status === "succeeded") return { result: "alreadyRecorded" as const, bookingId: p.bookingId };

    const confirmed = await transitionBooking(tx, {
      bookingId: p.bookingId,
      from: "quoted",
      to: "confirmed",
      actor: "system",
      actorId: null,
    });
    await tx
      .update(payment)
      .set({ status: "succeeded", providerPaymentId, late: !confirmed })
      .where(eq(payment.id, p.id));
    return { result: confirmed ? ("confirmed" as const) : ("late" as const), bookingId: p.bookingId, paymentId: p.id };
  });

  if (outcome.result === "confirmed") {
    await notifyCustomer(outcome.bookingId, "confirmed");
  } else if (outcome.result === "late") {
    const [b] = await db
      .select({ status: booking.status })
      .from(booking)
      .where(eq(booking.id, outcome.bookingId))
      .limit(1);
    await notifyAdmins(
      "Payment received for a booking that is no longer payable",
      `Payment ${outcome.paymentId} (provider ref ${providerRef}) succeeded for booking ${outcome.bookingId}, ` +
        `which is now "${b?.status}". Contact the customer and decide whether to confirm or refund it.`,
    );
  } else if (outcome.result === "unknownPayment") {
    console.error(`[payments] success for unknown provider ref ${providerRef}`);
  }
  return outcome.result;
}

/** Mark a still-pending payment failed or expired (the booking stays payable). */
export async function recordPaymentClosed(providerRef: string, status: "failed" | "expired"): Promise<void> {
  const [p] = await db.select().from(payment).where(eq(payment.providerRef, providerRef)).limit(1);
  if (p?.status === "pending") {
    await db.update(payment).set({ status }).where(eq(payment.id, p.id));
  }
}
