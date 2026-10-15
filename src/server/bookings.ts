"use server";

import { and, eq, ne } from "drizzle-orm";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/db";
import { booking, bookingEvent, payment, quote, recipient, user as userTable } from "@/db/schema";
import { bookingRequestSchema, meetsMinLeadTime, paymentWindow } from "@/domain/booking";
import { createCheckout, providerFor, type CheckoutStart } from "./payments";
import { transitionBooking } from "./transitions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { routing } from "@/i18n/routing";
import { requireUser } from "@/lib/authz";
import { toE164 } from "@/lib/phone";
import { regionForLocale } from "@/lib/region";
import { zonedToUtc } from "@/lib/time";

export type SubmitResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: "invalid" | "invalidPhone" | "leadTime" | "invalidEmail" | "emailTaken" };

/**
 * D4/D17: a signed-in customer submits a booking request. Everything from the
 * browser is re-validated here; the region comes from the route, not the input.
 * Phone-only customers must also give an email so we can send the quote (D11).
 */
export async function submitBookingRequest(
  locale: string,
  input: unknown,
  contactEmail?: string,
): Promise<SubmitResult> {
  if (!hasLocale(routing.locales, locale)) return { ok: false, error: "invalid" };
  const user = await requireUser({ locale, next: "/book/review" });

  if (!user.email) {
    const email = z.email().safeParse(contactEmail?.trim().toLowerCase());
    if (!email.success) return { ok: false, error: "invalidEmail" };
    const [taken] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(eq(userTable.email, email.data), ne(userTable.id, user.id)))
      .limit(1);
    if (taken) return { ok: false, error: "emailTaken" };
    await db
      .update(userTable)
      .set({ email: email.data, emailVerified: false })
      .where(eq(userTable.id, user.id));
  }

  const region = regionForLocale(locale);
  const parsed = bookingRequestSchema.safeParse({ ...(input as object), region });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const req = parsed.data;

  let otherPhone: string | null = null;
  if (req.recipient.kind === "other") {
    otherPhone = toE164(req.recipient.phone, region);
    if (!otherPhone) return { ok: false, error: "invalidPhone" };
  }

  const scheduledStart = zonedToUtc(req.date, req.time, req.timeZone);
  if (!meetsMinLeadTime(scheduledStart, new Date())) return { ok: false, error: "leadTime" };

  const bookingId = await db.transaction(async (tx) => {
    let recipientId: string;
    if (req.recipient.kind === "self") {
      const [existing] = await tx
        .select({ id: recipient.id })
        .from(recipient)
        .where(and(eq(recipient.ownerId, user.id), eq(recipient.isSelf, true)))
        .limit(1);
      recipientId =
        existing?.id ??
        (
          await tx
            .insert(recipient)
            .values({ ownerId: user.id, isSelf: true, phoneE164: user.phoneNumber })
            .returning({ id: recipient.id })
        )[0].id;
    } else {
      [{ id: recipientId }] = await tx
        .insert(recipient)
        .values({
          ownerId: user.id,
          isSelf: false,
          firstName: req.recipient.firstName,
          lastName: req.recipient.lastName,
          phoneE164: otherPhone,
        })
        .returning({ id: recipient.id });
    }

    const [created] = await tx
      .insert(booking)
      .values({
        customerId: user.id,
        recipientId,
        region,
        serviceType: req.serviceType,
        startAddress: req.startAddress,
        serviceAddress: req.serviceAddress,
        scheduledStart,
        timeZone: req.timeZone,
        estimatedHours: req.estimatedHours,
        vehicle: req.vehicle,
        description: req.description,
        needsMobilitySupport: req.needsMobilitySupport,
        needsDocuments: req.needsDocuments,
        status: "submitted",
      })
      .returning({ id: booking.id });

    await tx.insert(bookingEvent).values({
      bookingId: created.id,
      fromStatus: null,
      toStatus: "submitted",
      actorId: user.id,
    });
    return created.id;
  });

  return { ok: true, bookingId };
}

/** The signed-in customer's own booking and its quote, or null. */
async function ownQuotedBooking(userId: string, bookingId: string) {
  if (!UUID.test(bookingId)) return null;
  const [row] = await db
    .select({ booking, quote })
    .from(booking)
    .innerJoin(quote, eq(quote.bookingId, booking.id))
    .where(and(eq(booking.id, bookingId), eq(booking.customerId, userId)))
    .limit(1);
  return row ?? null;
}

export type QuoteActionResult =
  | { ok: true }
  | { ok: false; error: "notQuoted" | "expired" | "tooClose" | "failed" };

/** D8: the customer declines their quote. */
export async function declineQuote(locale: string, bookingId: string): Promise<QuoteActionResult> {
  if (!hasLocale(routing.locales, locale)) return { ok: false, error: "failed" };
  const user = await requireUser({ locale });
  const row = await ownQuotedBooking(user.id, bookingId);
  if (!row || row.booking.status !== "quoted") return { ok: false, error: "notQuoted" };

  const moved = await db.transaction((tx) =>
    transitionBooking(tx, { bookingId, from: "quoted", to: "declined", actor: "customer", actorId: user.id }),
  );
  return moved ? { ok: true } : { ok: false, error: "notQuoted" };
}

export type StartPaymentResult =
  | { ok: true; start: CheckoutStart }
  | { ok: false; error: "notQuoted" | "expired" | "tooClose" | "failed" };

/**
 * D8/D13/D21/D24: the customer accepts their quote and starts paying it in
 * full. The booking is confirmed only once the provider reports success.
 */
export async function startPayment(locale: string, bookingId: string): Promise<StartPaymentResult> {
  if (!hasLocale(routing.locales, locale)) return { ok: false, error: "failed" };
  const user = await requireUser({ locale });
  const row = await ownQuotedBooking(user.id, bookingId);
  if (!row || row.booking.status !== "quoted") return { ok: false, error: "notQuoted" };
  const { booking: b, quote: q } = row;

  const window = paymentWindow(q.expiresAt, new Date());
  if (!window.ok) return { ok: false, error: window.reason };

  const provider = providerFor(b.region);
  const [created] = await db
    .insert(payment)
    .values({
      bookingId,
      quoteId: q.id,
      provider,
      amountMinor: q.amountMinor,
      currency: q.currency,
    })
    .returning({ id: payment.id });

  try {
    const t = await getTranslations({ locale, namespace: "ServiceType" });
    const { providerRef, start } = await createCheckout(provider, {
      paymentId: created.id,
      bookingId,
      locale,
      amountMinor: q.amountMinor,
      currency: q.currency,
      description: `${t(b.serviceType)} · ${b.serviceAddress}`,
      customerEmail: user.email,
      closesAt: window.closesAt,
    });
    await db.update(payment).set({ providerRef }).where(eq(payment.id, created.id));
    return { ok: true, start };
  } catch (err) {
    console.error(`[payments] could not start checkout for booking ${bookingId}`, err);
    await db.update(payment).set({ status: "failed" }).where(eq(payment.id, created.id));
    return { ok: false, error: "failed" };
  }
}
