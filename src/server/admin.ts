"use server";

import { eq } from "drizzle-orm";
import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { booking, quote } from "@/db/schema";
import { QuoteExpiredError, quoteExpiresAt } from "@/domain/booking";
import { parseAmount } from "@/domain/money";
import { routing } from "@/i18n/routing";
import { requireRole } from "@/lib/authz";
import { REGION_CONFIG } from "@/lib/region";
import { notifyCustomer } from "./notifications";
import { transitionBooking } from "./transitions";

export type AdminActionResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid" | "notFound" | "notSubmitted" | "invalidAmount" | "tooSmall" | "tooLarge" | "tooSoon" | "reasonRequired";
    };

/** D4/D14/D22: approve a submitted request with its one and only quote. */
export async function quoteBooking(
  locale: string,
  bookingId: string,
  amount: string,
  note?: string,
): Promise<AdminActionResult> {
  if (!hasLocale(routing.locales, locale)) return { ok: false, error: "invalid" };
  const admin = await requireRole("admin", { locale });

  const [b] = await db.select().from(booking).where(eq(booking.id, bookingId)).limit(1);
  if (!b) return { ok: false, error: "notFound" };
  if (b.status !== "submitted") return { ok: false, error: "notSubmitted" };

  const currency = REGION_CONFIG[b.region].currency;
  const parsed = parseAmount(amount, currency);
  if (!parsed.ok) return { ok: false, error: parsed.error === "invalid" ? "invalidAmount" : parsed.error };

  const now = new Date();
  let expiresAt: Date;
  try {
    expiresAt = quoteExpiresAt(now, b.scheduledStart);
  } catch (err) {
    if (err instanceof QuoteExpiredError) return { ok: false, error: "tooSoon" };
    throw err;
  }

  const done = await db.transaction(async (tx) => {
    const moved = await transitionBooking(tx, {
      bookingId,
      from: "submitted",
      to: "quoted",
      actor: "admin",
      actorId: admin.id,
    });
    if (!moved) return false;
    await tx.insert(quote).values({
      bookingId,
      amountMinor: parsed.minor,
      currency,
      note: note?.trim().slice(0, 500) || null,
      issuedBy: admin.id,
      issuedAt: now,
      expiresAt,
    });
    return true;
  });
  if (!done) return { ok: false, error: "notSubmitted" };

  await notifyCustomer(bookingId, "quoteReady");
  revalidatePath(`/${locale}/admin/requests/${bookingId}`);
  return { ok: true };
}

/** D23: reject a submitted request; the reason is shown to the customer. */
export async function rejectBooking(
  locale: string,
  bookingId: string,
  reason: string,
): Promise<AdminActionResult> {
  if (!hasLocale(routing.locales, locale)) return { ok: false, error: "invalid" };
  const admin = await requireRole("admin", { locale });

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "reasonRequired" };

  const moved = await db.transaction((tx) =>
    transitionBooking(tx, {
      bookingId,
      from: "submitted",
      to: "rejected",
      actor: "admin",
      actorId: admin.id,
      set: { rejectionReason: trimmed.slice(0, 500) },
    }),
  );
  if (!moved) return { ok: false, error: "notSubmitted" };

  await notifyCustomer(bookingId, "rejected");
  revalidatePath(`/${locale}/admin/requests/${bookingId}`);
  return { ok: true };
}
