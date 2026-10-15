import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { BOOKING_STATUSES, SERVICE_TYPES, VEHICLES } from "@/domain/booking";
import { REGIONS } from "@/lib/region";

// Column names are snake_case in Postgres (see `casing` in db/index.ts and
// drizzle.config.ts); TypeScript keys stay camelCase.

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const roleEnum = pgEnum("role", ["customer", "admin", "helper"]);
export const regionEnum = pgEnum("region", REGIONS);
export const serviceTypeEnum = pgEnum("service_type", SERVICE_TYPES);
export const vehicleEnum = pgEnum("vehicle", VEHICLES);
export const bookingStatusEnum = pgEnum("booking_status", BOOKING_STATUSES);
export const taskStatusEnum = pgEnum("task_status", ["pending", "current", "done"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["stripe", "razorpay", "dev"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "expired",
]);

// ── Better Auth tables (shape required by better-auth 1.7) ──────────────────

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  phoneNumber: text().unique(),
  phoneNumberVerified: boolean(),
  role: roleEnum().notNull().default("customer"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.identifier)],
);

// ── Domain tables ───────────────────────────────────────────────────────────

/** The person who receives the help: the customer themself or a contact. */
export const recipient = pgTable(
  "recipient",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isSelf: boolean().notNull(),
    firstName: text().notNull().default(""),
    lastName: text().notNull().default(""),
    phoneE164: text(),
    ...timestamps,
  },
  (t) => [index().on(t.ownerId)],
);

export const booking = pgTable(
  "booking",
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: text()
      .notNull()
      .references(() => user.id),
    recipientId: uuid()
      .notNull()
      .references(() => recipient.id),
    region: regionEnum().notNull(),
    serviceType: serviceTypeEnum().notNull(),
    startAddress: text().notNull(),
    serviceAddress: text().notNull(),
    scheduledStart: timestamp({ withTimezone: true }).notNull(),
    timeZone: text().notNull(),
    estimatedHours: smallint().notNull(),
    vehicle: vehicleEnum().notNull(),
    description: text().notNull().default(""),
    needsMobilitySupport: boolean().notNull().default(false),
    needsDocuments: boolean().notNull().default(false),
    status: bookingStatusEnum().notNull().default("submitted"),
    submittedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** D23: shown to the customer when an admin rejects the request. */
    rejectionReason: text(),
    helperId: text().references(() => user.id),
    ...timestamps,
  },
  (t) => [
    index().on(t.customerId),
    index().on(t.status, t.scheduledStart),
    index().on(t.helperId),
  ],
);

/** D4/D14/D22: at most one quote per booking; it can't be revised. */
export const quote = pgTable("quote", {
  id: uuid().primaryKey().defaultRandom(),
  bookingId: uuid()
    .notNull()
    .unique()
    .references(() => booking.id, { onDelete: "cascade" }),
  amountMinor: integer().notNull(),
  currency: text().notNull(),
  note: text(),
  issuedBy: text()
    .notNull()
    .references(() => user.id),
  issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

/** One checkout attempt for a quote (D13, D21, D24). */
export const payment = pgTable(
  "payment",
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    quoteId: uuid()
      .notNull()
      .references(() => quote.id),
    provider: paymentProviderEnum().notNull(),
    /** Stripe Checkout Session id, Razorpay order id, or the dev provider's own id. */
    providerRef: text().unique(),
    /** Stripe PaymentIntent id or Razorpay payment id, once paid. */
    providerPaymentId: text().unique(),
    amountMinor: integer().notNull(),
    currency: text().notNull(),
    status: paymentStatusEnum().notNull().default("pending"),
    /** Paid after the booking stopped being payable (expired/declined): needs an admin. */
    late: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [index().on(t.bookingId)],
);

/** Webhook deliveries already processed, so retries are ignored. */
export const paymentEvent = pgTable("payment_event", {
  providerEventId: text().primaryKey(),
  receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** An ordered step of a booking (Pickup → … → Drop back). */
export const bookingTask = pgTable(
  "booking_task",
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    title: text().notNull(),
    detail: text().notNull().default(""),
    status: taskStatusEnum().notNull().default("pending"),
    completedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.bookingId, t.position)],
);

/** Audit trail: one row per booking status change. */
export const bookingEvent = pgTable(
  "booking_event",
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    fromStatus: bookingStatusEnum(),
    toStatus: bookingStatusEnum().notNull(),
    actorId: text().references(() => user.id),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.bookingId)],
);

/** D15: staff accounts are created only through single-use invitations. */
export const invitation = pgTable("invitation", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull(),
  role: roleEnum().notNull(),
  tokenHash: text().notNull().unique(),
  invitedBy: text()
    .notNull()
    .references(() => user.id),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  usedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
