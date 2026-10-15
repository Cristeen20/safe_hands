import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { booking, quote } from "@/db/schema";
import { notifyCustomer } from "@/server/notifications";
import { transitionBooking } from "@/server/transitions";

/**
 * D14: hourly (vercel.ts `crons`). Expires quotes nobody accepted in time.
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const due = await db
    .select({ id: booking.id })
    .from(booking)
    .innerJoin(quote, eq(quote.bookingId, booking.id))
    .where(and(eq(booking.status, "quoted"), lte(quote.expiresAt, new Date())));

  const expired: string[] = [];
  for (const { id } of due) {
    const moved = await db.transaction((tx) =>
      transitionBooking(tx, { bookingId: id, from: "quoted", to: "expired", actor: "system", actorId: null }),
    );
    if (moved) expired.push(id);
  }
  await Promise.all(expired.map((id) => notifyCustomer(id, "expired")));

  return Response.json({ expired: expired.length });
}
