import "server-only";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { booking, quote, user } from "@/db/schema";
import { appUrl, isDeliverableEmail, sendEmail } from "@/lib/email";
import { REGION_CONFIG } from "@/lib/region";
import { toMajor } from "@/domain/money";

type Kind = "quoteReady" | "rejected" | "confirmed" | "expired";

/**
 * D11: email the customer about a booking change, in the booking's own
 * locale. Never throws: a failed email must not undo the change it reports.
 */
export async function notifyCustomer(bookingId: string, kind: Kind): Promise<void> {
  try {
    const [row] = await db
      .select({ booking, email: user.email, quote })
      .from(booking)
      .innerJoin(user, eq(user.id, booking.customerId))
      .leftJoin(quote, eq(quote.bookingId, booking.id))
      .where(eq(booking.id, bookingId))
      .limit(1);
    if (!row || !isDeliverableEmail(row.email)) return;

    const b = row.booking;
    const locale = REGION_CONFIG[b.region].locale;
    const t = await getTranslations({ locale, namespace: "Email" });
    const ts = await getTranslations({ locale, namespace: "ServiceType" });
    const when = new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: b.timeZone,
    }).format(b.scheduledStart);
    const money = (minor: number, currency: string) =>
      new Intl.NumberFormat(locale, { style: "currency", currency }).format(toMajor(minor));
    const link = `${appUrl()}/${locale}/activity/${b.id}`;
    const vars = { service: ts(b.serviceType), place: b.serviceAddress, when, link };

    const content: Record<Kind, () => { subject: string; text: string }> = {
      quoteReady: () => {
        const q = row.quote!;
        const expires = new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: b.timeZone,
        }).format(q.expiresAt);
        return {
          subject: t("quoteReadySubject", { amount: money(q.amountMinor, q.currency) }),
          text: t("quoteReadyBody", {
            ...vars,
            amount: money(q.amountMinor, q.currency),
            expires,
            note: q.note ? `\n\n${q.note}` : "",
          }),
        };
      },
      rejected: () => ({
        subject: t("rejectedSubject"),
        text: t("rejectedBody", { ...vars, reason: b.rejectionReason ?? "" }),
      }),
      confirmed: () => ({
        subject: t("confirmedSubject"),
        text: t("confirmedBody", vars),
      }),
      expired: () => ({
        subject: t("expiredSubject"),
        text: t("expiredBody", vars),
      }),
    };

    await sendEmail({ to: row.email, ...content[kind]() });
  } catch (err) {
    console.error(`[notify] ${kind} for booking ${bookingId} failed`, err);
  }
}

/** Tell every admin with a real email address about something needing a person. */
export async function notifyAdmins(subject: string, text: string): Promise<void> {
  try {
    const admins = await db.select({ email: user.email }).from(user).where(eq(user.role, "admin"));
    await Promise.all(
      admins.filter((a) => isDeliverableEmail(a.email)).map((a) => sendEmail({ to: a.email, subject, text })),
    );
    console.warn(`[notify:admins] ${subject}\n${text}`);
  } catch (err) {
    console.error("[notify:admins] failed", err);
  }
}
