import type { Region } from "@/lib/region";

// Automatic pricing for hospital visits and drivers (the "Care Services Spec —
// Pricing & Location Picking"). Every number lives here so it can change
// without touching the rules in src/domain/pricing.ts.

export type LatLng = { lat: number; lng: number };

/** Rates in minor units (paise, cents, pence). Distances use the region's unit (REGION_CONFIG.distanceUnit). */
export type Rates = {
  /**
   * With our vehicle, per km/mile: a hospital visit's from ⇄ to round trip, and
   * a driver's one-way trip when it's longer than `driverDistanceAfterHours`.
   */
  perDistance: number;
  /** Per hour of driving (hospital visit in the customer's own car, driver). */
  driveHour: number;
  /** Per hour of the service itself (hospital visit, with or without a vehicle). */
  serviceHour: number;
};

export type RegionPricing = {
  /** Null until the market has rates: its requests go to an admin for a quote. */
  rates: Rates | null;
};

export const PRICING: Record<Region, RegionPricing> = {
  IN: { rates: { perDistance: 25_00, driveHour: 100_00, serviceHour: 500_00 } },
  // No rates yet, so these markets keep admin quotes (D4).
  US: { rates: null },
  CA: { rates: null },
  GB: { rates: null },
};

/** Rules shared by every market. */
export const PRICING_RULES = {
  /** Drivers are booked for at least this long. */
  driverMinHours: 4,
  /** A driver trip in our vehicle that takes longer than this also pays per distance. */
  driverDistanceAfterHours: 4,
  /** Billed hours are rounded up to this step. */
  billedHourStep: 0.5,
  /** Pickup and destination closer than this are rejected as the same place. */
  minTripMeters: 200,
};
