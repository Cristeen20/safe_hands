"use server";

import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hasLocale } from "next-intl";
import { forbidden, notFound } from "next/navigation";
import { db } from "@/db";
import { booking, payment } from "@/db/schema";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/lib/authz";
import { recordPaymentClosed, recordPaymentSuccess } from "./payments";
import { devProviderAllowed } from "./payments/provider";

/**
 * The dev provider's "Simulate payment succeeded / failed" buttons. Only the
 * paying customer can use them, and never in production.
 */
export async function completeDevPayment(
  locale: string,
  paymentId: string,
  outcome: "succeeded" | "failed",
): Promise<{ bookingId: string }> {
  if (!devProviderAllowed() || !hasLocale(routing.locales, locale)) forbidden();
  const user = await requireUser({ locale });

  const [row] = await db
    .select({ payment, customerId: booking.customerId })
    .from(payment)
    .innerJoin(booking, eq(booking.id, payment.bookingId))
    .where(and(eq(payment.id, paymentId), eq(payment.provider, "dev")))
    .limit(1);
  if (!row?.payment.providerRef) notFound();
  if (row.customerId !== user.id) forbidden();

  if (outcome === "succeeded") {
    await recordPaymentSuccess({ providerRef: row.payment.providerRef, providerPaymentId: `dev_pay_${randomUUID()}` });
  } else {
    await recordPaymentClosed(row.payment.providerRef, "failed");
  }
  return { bookingId: row.payment.bookingId };
}
