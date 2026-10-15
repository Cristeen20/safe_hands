import { z } from "zod";
import { REGIONS } from "@/lib/region";
import { addDays, localDate, zonedToUtc } from "@/lib/time";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** D17: a request must start at least this long after it is submitted. */
export const MIN_LEAD_TIME_MS = 48 * HOUR;
/** D14: a quote lives at most this long… */
export const QUOTE_MAX_LIFETIME_MS = 7 * DAY;
/** …and always expires this long before the scheduled start. */
export const QUOTE_CUTOFF_BEFORE_START_MS = 24 * HOUR;

/** Start times offered on the When screen (from the canvas). */
export const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:30",
  "12:00",
  "13:30",
  "14:30",
  "16:00",
  "17:30",
  "19:00",
] as const;

/** How many days the When screen offers, starting at the first bookable day. */
export const BOOKABLE_DAY_COUNT = 5;

export const SERVICE_TYPES = ["hospital_visit", "driver", "errand", "other"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const VEHICLES = ["none", "small", "large"] as const;
export type Vehicle = (typeof VEHICLES)[number];

export const BOOKING_STATUSES = [
  "submitted",
  "rejected",
  "quoted",
  "declined",
  "expired",
  "confirmed",
  "assigned",
  "in_progress",
  "completed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type Actor = "customer" | "admin" | "helper" | "system";

export class LeadTimeError extends Error {
  constructor() {
    super("Bookings must start at least 48 hours from now.");
    this.name = "LeadTimeError";
  }
}

export class QuoteExpiredError extends Error {
  constructor() {
    super("This quote would expire immediately: the booking starts too soon.");
    this.name = "QuoteExpiredError";
  }
}

export function meetsMinLeadTime(scheduledStart: Date, now: Date): boolean {
  return scheduledStart.getTime() - now.getTime() >= MIN_LEAD_TIME_MS;
}

export function assertMinLeadTime(scheduledStart: Date, now: Date): void {
  if (!meetsMinLeadTime(scheduledStart, now)) throw new LeadTimeError();
}

/** True if `slot` on local `date` in `timeZone` is far enough ahead to book. */
export function isSlotBookable(date: string, slot: string, timeZone: string, now: Date): boolean {
  return meetsMinLeadTime(zonedToUtc(date, slot, timeZone), now);
}

/** The earliest local date that has at least one bookable slot. */
export function firstBookableDay(now: Date, timeZone: string): string {
  let date = localDate(new Date(now.getTime() + MIN_LEAD_TIME_MS), timeZone);
  // At most one extra day: the lead-time day may have no slots left.
  if (!TIME_SLOTS.some((slot) => isSlotBookable(date, slot, timeZone, now))) {
    date = addDays(date, 1);
  }
  return date;
}

export function bookableDays(now: Date, timeZone: string): string[] {
  const first = firstBookableDay(now, timeZone);
  return Array.from({ length: BOOKABLE_DAY_COUNT }, (_, i) => addDays(first, i));
}

/**
 * D14: a quote expires at the earlier of 7 days after it is issued or 24 hours
 * before the booking starts. Throws if that moment is not in the future.
 */
export function quoteExpiresAt(issuedAt: Date, scheduledStart: Date): Date {
  const expires = Math.min(
    issuedAt.getTime() + QUOTE_MAX_LIFETIME_MS,
    scheduledStart.getTime() - QUOTE_CUTOFF_BEFORE_START_MS,
  );
  if (expires <= issuedAt.getTime()) throw new QuoteExpiredError();
  return new Date(expires);
}

/** Stripe Checkout Sessions must live 30 minutes to 24 hours. */
export const MIN_PAYMENT_WINDOW_MS = 30 * 60 * 1000;
const MAX_PAYMENT_WINDOW_MS = 24 * HOUR;

export type PaymentWindow =
  | { ok: true; closesAt: Date }
  | { ok: false; reason: "expired" | "tooClose" };

/**
 * Whether a customer may start paying a quote now, and when the checkout must
 * close: never after the quote expires, so a payment can't outlive its quote.
 */
export function paymentWindow(quoteExpiresAt: Date, now: Date): PaymentWindow {
  const left = quoteExpiresAt.getTime() - now.getTime();
  if (left <= 0) return { ok: false, reason: "expired" };
  if (left < MIN_PAYMENT_WINDOW_MS) return { ok: false, reason: "tooClose" };
  return { ok: true, closesAt: new Date(now.getTime() + Math.min(left, MAX_PAYMENT_WINDOW_MS)) };
}

/**
 * Allowed status changes and who may make each one (see the lifecycle in
 * CLAUDE.md). There is no cancellation in v1 (D16).
 */
const TRANSITIONS: Record<BookingStatus, Partial<Record<BookingStatus, readonly Actor[]>>> = {
  submitted: { quoted: ["admin"], rejected: ["admin"] },
  quoted: { confirmed: ["customer", "system"], declined: ["customer"], expired: ["system"] },
  confirmed: { assigned: ["admin"] },
  assigned: { in_progress: ["helper"] },
  in_progress: { completed: ["helper"] },
  rejected: {},
  declined: {},
  expired: {},
  completed: {},
};

export function canTransition(from: BookingStatus, to: BookingStatus, actor: Actor): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

export const recipientSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("self") }),
  z.object({
    kind: z.literal("other"),
    firstName: nonEmpty(60),
    lastName: z.string().trim().max(60).default(""),
    phone: nonEmpty(30),
  }),
]);

export const bookingRequestSchema = z.object({
  region: z.enum(REGIONS),
  serviceType: z.enum(SERVICE_TYPES),
  startAddress: nonEmpty(200),
  serviceAddress: nonEmpty(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.enum(TIME_SLOTS),
  timeZone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone"),
  estimatedHours: z.number().int().min(1).max(8),
  vehicle: z.enum(VEHICLES),
  description: z.string().trim().max(500).default(""),
  needsMobilitySupport: z.boolean().default(false),
  needsDocuments: z.boolean().default(false),
  recipient: recipientSchema,
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;
