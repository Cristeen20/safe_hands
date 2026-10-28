import { z } from "zod";
import { STAY_LOCATIONS, findTourPackage } from "@/config/tours";
import { REGIONS, SERVICE_TIME_ZONE } from "@/lib/region";
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

/** How many days the date picker offers, starting at the first bookable day. */
export const BOOKABLE_DAY_COUNT = 60;

export const SERVICE_TYPES = [
  "hospital_visit",
  "driver",
  "companion",
  "property",
  "gift",
  "camera",
  "tour",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** The services picked on /book. Guided tours have their own page (/tours). */
export const BOOK_SERVICES = SERVICE_TYPES.filter(
  (s): s is Exclude<ServiceType, "tour"> => s !== "tour",
);

/** Services with a pickup and a destination and a vehicle choice. */
export function isRouteService(s: ServiceType): s is "hospital_visit" | "driver" | "companion" {
  return s === "hospital_visit" || s === "driver" || s === "companion";
}

/** Services where the customer chooses how many hours they need (not drivers: they're priced by drive time). */
export function hasHours(s: ServiceType): boolean {
  return s === "hospital_visit" || s === "companion" || s === "camera";
}
export const MAX_HOURS = 12;

export const VEHICLES = ["none", "own", "small", "large"] as const;
export type Vehicle = (typeof VEHICLES)[number];

/** Our vehicle, priced per distance (the customer's own car and "none" aren't). */
export function isOurVehicle(v: Vehicle | null): boolean {
  return v === "small" || v === "large";
}

/** A driver can drive the customer's own car; other helpers can come on foot. */
/** Hospital visits and drivers ask which vehicle; companions don't. */
export function hasVehicle(s: ServiceType): s is "hospital_visit" | "driver" {
  return s === "hospital_visit" || s === "driver";
}

/** The vehicle choices for a service that asks for one: the customer's car or ours. */
export function vehiclesFor(s: ServiceType): readonly Vehicle[] {
  return hasVehicle(s) ? ["own", "small", "large"] : [];
}

export const TOUR_KINDS = ["package", "stay", "custom"] as const;
export type TourKind = (typeof TOUR_KINDS)[number];

export const MAX_ACCOMPANYING = 6;
export const MIN_DRIVER_DAYS = 2;
export const MAX_DAYS = 30;
export const MAX_PARTY_SIZE = 40;

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

const SERVICE_CODES: Record<ServiceType, string> = {
  hospital_visit: "HV",
  driver: "DR",
  companion: "CO",
  property: "PR",
  gift: "GF",
  camera: "CM",
  tour: "TR",
};

/**
 * A short reference customers can quote to us, e.g. "HV-20261022-3F9A1C":
 * the service, the local start date, and the start of the booking's id.
 */
export function bookingReference(b: { id: string; serviceType: ServiceType; scheduledStart: Date; timeZone: string }): string {
  const day = localDate(b.scheduledStart, b.timeZone).replaceAll("-", "");
  return `${SERVICE_CODES[b.serviceType]}-${day}-${b.id.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
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
  // "system": an automatic quote from the pricing rules.
  submitted: { quoted: ["admin", "system"], rejected: ["admin"] },
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
const count = (min: number, max: number) => z.number().int().min(min).max(max);

export const recipientSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("self") }),
  z.object({
    kind: z.literal("other"),
    firstName: nonEmpty(60),
    lastName: z.string().trim().max(60).default(""),
    phone: nonEmpty(30),
  }),
]);

const when = {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.enum(TIME_SLOTS),
  /** Services are in India, so bookings are in India time (D30). */
  timeZone: z.literal(SERVICE_TIME_ZONE),
};

export const LOCATION_SOURCES = ["gps", "search", "pin"] as const;

/** A point picked on the map: where the pin was confirmed, and how. */
export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeId: z.string().max(300).default(""),
  source: z.enum(LOCATION_SOURCES),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

const point = geoPointSchema.nullable().default(null);
const notes = z.string().trim().max(200).default("");

const base = {
  region: z.enum(REGIONS),
  description: z.string().trim().max(500).default(""),
  recipient: recipientSchema,
  ...when,
};

const route = {
  ...base,
  startAddress: nonEmpty(200),
  startPoint: point,
  startNotes: notes,
  serviceAddress: nonEmpty(200),
  servicePoint: point,
  serviceNotes: notes,
};

const multiDay = {
  multiDay: z.boolean().default(false),
  driverDays: count(MIN_DRIVER_DAYS, MAX_DAYS).default(MIN_DRIVER_DAYS),
};

const place = { ...base, serviceAddress: nonEmpty(200), servicePoint: point, serviceNotes: notes };

// A tour party always includes the customer ("People · including you"), so
// the booking is for them whatever the draft's recipient says.
const tour = {
  region: z.enum(REGIONS),
  serviceType: z.literal("tour"),
  partySize: count(1, MAX_PARTY_SIZE),
  recipient: z.unknown().optional().transform(() => ({ kind: "self" as const })),
};

export const bookingRequestSchema = z.discriminatedUnion("serviceType", [
  z.object({
    ...route,
    serviceType: z.literal("hospital_visit"),
    vehicle: z.enum(["own", "small", "large"]),
    estimatedHours: count(1, MAX_HOURS),
    accompanyingCount: count(0, MAX_ACCOMPANYING),
    needsBystander: z.boolean().default(false),
  }),
  z.object({
    ...route,
    serviceType: z.literal("driver"),
    vehicle: z.enum(["own", "small", "large"]),
    childSeat: z.boolean().default(false),
    ...multiDay,
  }),
  z.object({ ...route, serviceType: z.literal("companion"), estimatedHours: count(1, MAX_HOURS), ...multiDay }),
  z.object({ ...place, serviceType: z.literal("property") }),
  z.object({ ...place, serviceType: z.literal("gift") }),
  z.object({ ...place, serviceType: z.literal("camera"), estimatedHours: count(1, MAX_HOURS) }),
  z.discriminatedUnion("tourKind", [
    z.object({ ...tour, tourKind: z.literal("package"), tourPackage: nonEmpty(80) }),
    z.object({
      ...tour,
      ...when,
      tourKind: z.literal("stay"),
      stayLocation: nonEmpty(80),
      days: count(1, MAX_DAYS),
      includeFood: z.boolean().default(false),
    }),
    z.object({
      ...tour,
      ...when,
      tourKind: z.literal("custom"),
      tourLocation: nonEmpty(200),
      days: count(1, MAX_DAYS),
      includeFood: z.boolean().default(false),
      needsStay: z.boolean().default(false),
      description: z.string().trim().max(500).default(""),
    }),
  ]),
]);

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export class UnknownTourError extends Error {
  constructor() {
    super("That tour package or stay isn't available here.");
    this.name = "UnknownTourError";
  }
}

/** The booking columns a request turns into, one shape for every service. */
export type BookingValues = {
  serviceType: ServiceType;
  startAddress: string;
  startPoint: GeoPoint | null;
  startNotes: string;
  serviceAddress: string;
  servicePoint: GeoPoint | null;
  serviceNotes: string;
  scheduledStart: Date;
  timeZone: string;
  estimatedHours: number | null;
  vehicle: Vehicle | null;
  description: string;
  accompanyingCount: number | null;
  needsBystander: boolean;
  childSeat: boolean;
  days: number | null;
  partySize: number | null;
  includeFood: boolean;
  needsStay: boolean;
  tourKind: TourKind | null;
  tourPackage: string | null;
};

const EMPTY_VALUES = {
  startAddress: "",
  startPoint: null,
  startNotes: "",
  servicePoint: null,
  serviceNotes: "",
  estimatedHours: null,
  vehicle: null,
  description: "",
  accompanyingCount: null,
  needsBystander: false,
  childSeat: false,
  days: null,
  partySize: null,
  includeFood: false,
  needsStay: false,
  tourKind: null,
  tourPackage: null,
} satisfies Partial<BookingValues>;

/**
 * Flattens a validated request into booking columns. A package tour takes its
 * start time from the package. Throws UnknownTourError for a package or stay
 * we don't offer.
 */
export function bookingValues(req: BookingRequest): BookingValues {
  if (req.serviceType === "tour") {
    const tourCommon = { ...EMPTY_VALUES, serviceType: req.serviceType, tourKind: req.tourKind, partySize: req.partySize };
    if (req.tourKind === "package") {
      const pkg = findTourPackage(req.tourPackage);
      if (!pkg) throw new UnknownTourError();
      return {
        ...tourCommon,
        serviceAddress: pkg.name,
        tourPackage: pkg.id,
        days: pkg.days,
        scheduledStart: zonedToUtc(pkg.departs.date, pkg.departs.time, pkg.departs.timeZone),
        timeZone: pkg.departs.timeZone,
      };
    }
    const at = { scheduledStart: zonedToUtc(req.date, req.time, req.timeZone), timeZone: req.timeZone };
    if (req.tourKind === "stay") {
      if (!STAY_LOCATIONS.includes(req.stayLocation)) throw new UnknownTourError();
      return { ...tourCommon, ...at, serviceAddress: req.stayLocation, days: req.days, includeFood: req.includeFood };
    }
    return {
      ...tourCommon,
      ...at,
      serviceAddress: req.tourLocation,
      days: req.days,
      includeFood: req.includeFood,
      needsStay: req.needsStay,
      description: req.description,
    };
  }

  const common = {
    ...EMPTY_VALUES,
    serviceType: req.serviceType,
    serviceAddress: req.serviceAddress,
    servicePoint: req.servicePoint,
    serviceNotes: req.serviceNotes,
    description: req.description,
    scheduledStart: zonedToUtc(req.date, req.time, req.timeZone),
    timeZone: req.timeZone,
  };
  const start = (r: Pick<BookingValues, "startAddress" | "startPoint" | "startNotes">) => ({
    startAddress: r.startAddress,
    startPoint: r.startPoint,
    startNotes: r.startNotes,
  });
  switch (req.serviceType) {
    case "hospital_visit":
      return {
        ...common,
        ...start(req),
        vehicle: req.vehicle,
        estimatedHours: req.estimatedHours,
        accompanyingCount: req.accompanyingCount,
        needsBystander: req.needsBystander,
      };
    case "driver":
      return {
        ...common,
        ...start(req),
        vehicle: req.vehicle,
        childSeat: req.childSeat,
        days: req.multiDay ? req.driverDays : null,
      };
    case "companion":
      return {
        ...common,
        ...start(req),
        estimatedHours: req.estimatedHours,
        days: req.multiDay ? req.driverDays : null,
      };
    case "camera":
      return { ...common, estimatedHours: req.estimatedHours };
    case "property":
    case "gift":
      return common;
  }
}
