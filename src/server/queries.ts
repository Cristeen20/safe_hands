import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { booking, bookingEvent, payment, quote, recipient, user } from "@/db/schema";
import type { BookingStatus } from "@/domain/booking";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A customer's own bookings with any quote, soonest first. Caller passes the session user's id. */
export async function listCustomerBookings(customerId: string) {
  return db
    .select({
      id: booking.id,
      status: booking.status,
      serviceType: booking.serviceType,
      serviceAddress: booking.serviceAddress,
      scheduledStart: booking.scheduledStart,
      timeZone: booking.timeZone,
      quoteAmountMinor: quote.amountMinor,
      quoteCurrency: quote.currency,
    })
    .from(booking)
    .leftJoin(quote, eq(quote.bookingId, booking.id))
    .where(eq(booking.customerId, customerId))
    .orderBy(asc(booking.scheduledStart));
}

/** One of the customer's own bookings, with its recipient and quote. Null if not theirs. */
export async function getCustomerBooking(customerId: string, id: string) {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .select({ booking, recipient, quote })
    .from(booking)
    .innerJoin(recipient, eq(recipient.id, booking.recipientId))
    .leftJoin(quote, eq(quote.bookingId, booking.id))
    .where(and(eq(booking.id, id), eq(booking.customerId, customerId)))
    .limit(1);
  return row ?? null;
}

/** Admin list: bookings in the given statuses, soonest start first. Admin-only. */
export async function listRequestsByStatus(statuses: BookingStatus[]) {
  return db
    .select({
      id: booking.id,
      status: booking.status,
      serviceType: booking.serviceType,
      startAddress: booking.startAddress,
      serviceAddress: booking.serviceAddress,
      scheduledStart: booking.scheduledStart,
      timeZone: booking.timeZone,
      submittedAt: booking.submittedAt,
      customerName: user.name,
      customerPhone: user.phoneNumber,
      customerEmail: user.email,
    })
    .from(booking)
    .innerJoin(user, eq(user.id, booking.customerId))
    .where(inArray(booking.status, statuses))
    .orderBy(asc(booking.scheduledStart), desc(booking.submittedAt));
}

const customer = alias(user, "customer");

/** One request with its customer, recipient, quote, payments and history. Admin-only. */
export async function getRequestForAdmin(id: string) {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .select({
      booking,
      customerName: customer.name,
      customerPhone: customer.phoneNumber,
      customerEmail: customer.email,
      recipient,
      quote,
    })
    .from(booking)
    .innerJoin(customer, eq(customer.id, booking.customerId))
    .innerJoin(recipient, eq(recipient.id, booking.recipientId))
    .leftJoin(quote, eq(quote.bookingId, booking.id))
    .where(eq(booking.id, id))
    .limit(1);
  if (!row) return null;

  const actor = alias(user, "actor");
  const [payments, events] = await Promise.all([
    db.select().from(payment).where(eq(payment.bookingId, id)).orderBy(asc(payment.createdAt)),
    db
      .select({ event: bookingEvent, actorName: actor.name, actorRole: actor.role })
      .from(bookingEvent)
      .leftJoin(actor, eq(actor.id, bookingEvent.actorId))
      .where(eq(bookingEvent.bookingId, id))
      .orderBy(asc(bookingEvent.at)),
  ]);
  return { ...row, payments, events };
}
