import "server-only";
import { and, eq } from "drizzle-orm";
import type { db } from "@/db";
import { booking, bookingEvent } from "@/db/schema";
import { canTransition, type Actor, type BookingStatus } from "@/domain/booking";

/** A transaction handle from `db.transaction(tx => …)`. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Extra = Partial<typeof booking.$inferInsert>;

/**
 * Move a booking from `from` to `to` and record who did it. The update only
 * applies if the booking is still in `from`, so two people acting at once
 * can't both win. Returns false when it no longer was (nothing changed).
 */
export async function transitionBooking(
  tx: Tx,
  {
    bookingId,
    from,
    to,
    actor,
    actorId,
    set,
  }: {
    bookingId: string;
    from: BookingStatus;
    to: BookingStatus;
    actor: Actor;
    actorId: string | null;
    set?: Extra;
  },
): Promise<boolean> {
  if (!canTransition(from, to, actor)) {
    throw new Error(`Transition ${from} → ${to} is not allowed for ${actor}`);
  }
  const updated = await tx
    .update(booking)
    .set({ ...set, status: to })
    .where(and(eq(booking.id, bookingId), eq(booking.status, from)))
    .returning({ id: booking.id });
  if (updated.length === 0) return false;
  await tx.insert(bookingEvent).values({ bookingId, fromStatus: from, toStatus: to, actorId });
  return true;
}
