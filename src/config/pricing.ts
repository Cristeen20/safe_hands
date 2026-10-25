import type { Region } from "@/lib/region";

// Automatic pricing for hospital visits and drivers (the "Care Services Spec —
// Pricing & Location Picking"). Every number lives here so it can change
// without touching the rules in src/domain/pricing.ts.

export type LatLng = { lat: number; lng: number };

/** Rates in minor units (paise, cents, pence). Distances use the region's unit (REGION_CONFIG.distanceUnit). */
export type Rates = {
  /** With our vehicle, per km/mile of the whole trip, including the drive back to our base. */
  perDistance: number;
  /** Per hour of driving over that trip: a hospital visit in the customer's own car, or a driver. */
  driveHour: number;
  /** Per hour of the service itself (hospital visit, with or without a vehicle). */
  serviceHour: number;
  /** The least a driver's driving costs (400 = 4 h at 100/hr, so trips up to 4 h pay this). */
  driverMinimum: number;
};

export type RegionPricing = {
  /**
   * Our base. Drivers drive back to it from the drop-off, and hospital visits
   * from the pickup once the customer is home. Null until it's set: those
   * requests then go to an admin.
   */
  base: LatLng | null;
  /** Null until the market has rates: its requests go to an admin for a quote. */
  rates: Rates | null;
};

export const PRICING: Record<Region, RegionPricing> = {
  // Thiruvalla town centre. Swap in the office's exact pin if it differs.
  IN: { base: { lat: 9.3835, lng: 76.5741 }, rates: { perDistance: 25_00, driveHour: 100_00, serviceHour: 500_00, driverMinimum: 400_00 } },
  // No rates yet, so these markets keep admin quotes (D4).
  US: { base: null, rates: null },
  CA: { base: null, rates: null },
  GB: { base: null, rates: null },
};

/** Rules shared by every market. */
export const PRICING_RULES = {
  /** Billed hours are rounded up to this step. */
  billedHourStep: 0.5,
  /** A driver or hospital-visit trip driving longer than this (base leg included) needs an admin's approval. */
  maxDriveHours: 9,
  /** Pickup and destination closer than this are rejected as the same place. */
  minTripMeters: 200,
};
