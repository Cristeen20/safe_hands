import { describe, expect, it } from "vitest";
import {
  QuoteExpiredError,
  assertMinLeadTime,
  bookableDays,
  bookingRequestSchema,
  canTransition,
  firstBookableDay,
  isSlotBookable,
  meetsMinLeadTime,
  paymentWindow,
  quoteExpiresAt,
} from "./booking";

const HOUR = 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);

describe("paymentWindow", () => {
  const now = at("2026-10-14T12:00:00Z");
  const later = (ms: number) => new Date(now.getTime() + ms);

  it("closes checkout when the quote expires, if that is within 24 hours", () => {
    expect(paymentWindow(later(3 * HOUR), now)).toEqual({ ok: true, closesAt: later(3 * HOUR) });
  });

  it("caps checkout at 24 hours for quotes that last longer", () => {
    expect(paymentWindow(later(5 * 24 * HOUR), now)).toEqual({ ok: true, closesAt: later(24 * HOUR) });
  });

  it("allows exactly 30 minutes, but not less", () => {
    expect(paymentWindow(later(30 * 60 * 1000), now).ok).toBe(true);
    expect(paymentWindow(later(29 * 60 * 1000), now)).toEqual({ ok: false, reason: "tooClose" });
  });

  it("refuses an expired quote", () => {
    expect(paymentWindow(now, now)).toEqual({ ok: false, reason: "expired" });
  });
});

describe("48-hour minimum notice (D17)", () => {
  const now = at("2026-10-14T12:00:00Z");

  it("rejects a start 47h59m away", () => {
    const start = new Date(now.getTime() + 48 * HOUR - 60_000);
    expect(meetsMinLeadTime(start, now)).toBe(false);
    expect(() => assertMinLeadTime(start, now)).toThrow();
  });

  it("accepts a start exactly 48h away", () => {
    const start = new Date(now.getTime() + 48 * HOUR);
    expect(meetsMinLeadTime(start, now)).toBe(true);
    expect(() => assertMinLeadTime(start, now)).not.toThrow();
  });

  it("checks slots in the booking's local time zone", () => {
    // 12:00 UTC on 14 Oct = 13:00 BST. 48h later is 13:00 BST on 16 Oct.
    expect(isSlotBookable("2026-10-16", "12:00", "Europe/London", now)).toBe(false);
    expect(isSlotBookable("2026-10-16", "13:30", "Europe/London", now)).toBe(true);
  });

  it("starts the day picker on the lead-time day when it still has slots", () => {
    expect(firstBookableDay(now, "Europe/London")).toBe("2026-10-16");
  });

  it("skips to the next day when the lead-time day has no slots left", () => {
    const late = at("2026-10-14T19:00:00Z"); // 20:00 BST, after the last 19:00 slot
    expect(firstBookableDay(late, "Europe/London")).toBe("2026-10-17");
  });

  it("works in India's single, DST-free zone", () => {
    // 12:00 UTC = 17:30 IST on 14 Oct; 48h later is 17:30 IST on 16 Oct.
    expect(isSlotBookable("2026-10-16", "17:30", "Asia/Kolkata", now)).toBe(true);
    expect(isSlotBookable("2026-10-16", "16:00", "Asia/Kolkata", now)).toBe(false);
    expect(firstBookableDay(now, "Asia/Kolkata")).toBe("2026-10-16");
  });

  it("offers five consecutive days", () => {
    expect(bookableDays(now, "America/New_York")).toEqual([
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
    ]);
  });
});

describe("quote expiry (D14)", () => {
  const issuedAt = at("2026-10-14T12:00:00Z");

  it("expires 7 days after issue when the booking is far away", () => {
    const start = at("2026-11-30T10:00:00Z");
    expect(quoteExpiresAt(issuedAt, start)).toEqual(at("2026-10-21T12:00:00Z"));
  });

  it("expires 24h before the start when that comes first", () => {
    const start = at("2026-10-17T10:00:00Z");
    expect(quoteExpiresAt(issuedAt, start)).toEqual(at("2026-10-16T10:00:00Z"));
  });

  it("refuses a quote that would already be expired", () => {
    const start = at("2026-10-15T11:00:00Z"); // 23h away
    expect(() => quoteExpiresAt(issuedAt, start)).toThrow(QuoteExpiredError);
  });
});

describe("status transitions", () => {
  it("lets admins quote or reject a submitted request", () => {
    expect(canTransition("submitted", "quoted", "admin")).toBe(true);
    expect(canTransition("submitted", "rejected", "admin")).toBe(true);
    expect(canTransition("submitted", "quoted", "customer")).toBe(false);
  });

  it("lets only the customer accept or decline a quote, and only the system expire it", () => {
    expect(canTransition("quoted", "confirmed", "customer")).toBe(true);
    expect(canTransition("quoted", "declined", "customer")).toBe(true);
    expect(canTransition("quoted", "confirmed", "admin")).toBe(false);
    expect(canTransition("quoted", "expired", "system")).toBe(true);
    expect(canTransition("quoted", "expired", "admin")).toBe(false);
  });

  it("has no cancellation (D16)", () => {
    expect(canTransition("confirmed", "declined", "customer")).toBe(false);
    expect(canTransition("assigned", "rejected", "admin")).toBe(false);
  });

  it("lets helpers run an assigned job", () => {
    expect(canTransition("confirmed", "assigned", "admin")).toBe(true);
    expect(canTransition("assigned", "in_progress", "helper")).toBe(true);
    expect(canTransition("in_progress", "completed", "helper")).toBe(true);
  });
});

describe("bookingRequestSchema", () => {
  const valid = {
    region: "GB",
    serviceType: "hospital_visit",
    startAddress: "24 Elm Street",
    serviceAddress: "St. James Hospital",
    date: "2026-10-16",
    time: "14:30",
    timeZone: "Europe/London",
    estimatedHours: 2,
    vehicle: "small",
    description: "Help with check-in.",
    needsMobilitySupport: true,
    needsDocuments: false,
    recipient: { kind: "self" },
  };

  it("accepts a valid request", () => {
    expect(bookingRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects hours outside 1–8, unknown slots and long descriptions", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, estimatedHours: 9 }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...valid, time: "15:00" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...valid, description: "x".repeat(501) }).success).toBe(
      false,
    );
  });

  it("requires a name and phone for someone else", () => {
    expect(
      bookingRequestSchema.safeParse({ ...valid, recipient: { kind: "other", firstName: "Anu" } })
        .success,
    ).toBe(false);
  });
});
