import type { Region } from "@/lib/region";

// Automatic pricing for hospital visits and drivers (the "Care Services Spec —
// Pricing & Location Picking"). Every number lives here so it can change
// without touching the rules in src/domain/pricing.ts.

export type LatLng = { lat: number; lng: number };

/** Rates in minor units (paise, cents, pence). Distances use the region's unit (REGION_CONFIG.distanceUnit). */
export type Rates = {
  /** With our vehicle: per km/mile over the from ⇄ to round trip. */
  perDistance: number;
  /** With our vehicle: per km/mile from our base to the pickup. */
  locationPerDistance: number;
  /** Per hour of driving (hospital visit without a vehicle, driver). */
  driveHour: number;
  /** Per hour of the service itself (hospital visit, with or without a vehicle). */
  serviceHour: number;
};

export type RegionPricing = {
  /** Our operating location. Null until it's set: every route request then goes to an admin. */
  base: LatLng | null;
  /** Pickups this far from the base or further need an admin (no vehicle) or can't be booked (with vehicle). */
  maxBaseDistance: number;
  /** Null until the market has rates: its requests go to an admin for a quote. */
  rates: Rates | null;
};

export const PRICING: Record<Region, RegionPricing> = {
  IN: {
    // TODO: set the base before launch. Until then India requests also wait for an admin.
    base: null,
    maxBaseDistance: 10, // km
    rates: { perDistance: 25_00, locationPerDistance: 0, driveHour: 100_00, serviceHour: 500_00 },
  },
  // Placeholders: no rates yet, so these markets keep admin quotes (D4).
  US: { base: null, maxBaseDistance: 6, rates: null }, // miles
  CA: { base: null, maxBaseDistance: 10, rates: null }, // km
  GB: { base: null, maxBaseDistance: 6, rates: null }, // miles
};

/** Rules shared by every market. */
export const PRICING_RULES = {
  /** Drivers are booked for at least this long. */
  driverMinHours: 4,
  /** Billed hours are rounded up to this step. */
  billedHourStep: 0.5,
  /** Pickup and destination closer than this are rejected as the same place. */
  minTripMeters: 200,
};
