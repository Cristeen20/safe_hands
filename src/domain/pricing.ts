import { PRICING_RULES, type LatLng, type RegionPricing } from "@/config/pricing";
import { MAX_CHARGE_MINOR, MIN_CHARGE_MINOR, type Currency } from "./money";

// Pure pricing rules for the route services. The server computes every price
// (src/server/pricing.ts); the browser only shows what the server returns.

const METERS_PER = { kilometer: 1000, mile: 1609.344 } as const;
export type DistanceUnit = keyof typeof METERS_PER;

/** One driven leg, from the routing API or (estimated) a straight-line fallback. */
export type Leg = { meters: number; seconds: number; estimated: boolean };

/**
 * Why a request needs an admin instead of an automatic quote:
 * - noRates: the market has no rates yet.
 * - noBase: a driver booking, but the market has no driver base for the return leg.
 * - tooLong: a driver trip drives longer than PRICING_RULES.driverMaxDriveHours.
 * - estimatedRoute: routing failed and the straight-line fallback was used.
 * - multiDay: multi-day bookings have no rule yet.
 * - companion: companion pricing isn't defined.
 * - outOfRange: the computed price is outside what we can charge.
 * - noLocation: the request has no map points (maps not configured).
 * - areaUnchecked: we couldn't confirm the points are inside the market.
 */
export type PendingReason =
  | "noRates"
  | "noBase"
  | "tooLong"
  | "estimatedRoute"
  | "multiDay"
  | "companion"
  | "outOfRange"
  | "noLocation"
  | "areaUnchecked";

export type PriceLine = {
  kind: "distance" | "driveTime" | "serviceTime" | "minimum";
  /** Distance in the region's unit, or hours (1 for the minimum charge). */
  quantity: number;
  rateMinor: number;
  amountMinor: number;
};

/** One part of a driver's trip, shown on its own. */
export type TripLeg = {
  kind: "outbound" | "return";
  /** In the region's unit. */
  distance: number;
  driveHours: number;
};

export type PriceEstimate = {
  /** auto: quoted and payable now. pendingAdmin: an admin quotes it. */
  outcome: "auto" | "pendingAdmin";
  reasons: PendingReason[];
  currency: Currency;
  distanceUnit: DistanceUnit;
  /** Distance driven for the service (round trip for hospital visits, from → to → base for drivers), in the region's unit. */
  tripDistance: number;
  /** Driving time over that same trip, before rounding. */
  driveHours: number;
  /** Drivers: pickup → drop-off and drop-off → base. Missing on older estimates and other services. */
  legs?: TripLeg[];
  /** Hours of driving billed (hospital visit in the customer's car, driver), rounded up. Null when not hourly. */
  billedHours: number | null;
  serviceHours: number | null;
  /** The quote, or a suggestion for the admin when pending. Null when there is no rule. */
  amountMinor: number | null;
  lines: PriceLine[];
};

export type PricingInput = {
  serviceType: "hospital_visit" | "driver" | "companion";
  /** Our vehicle (priced per distance). The customer's own car or none counts as false. */
  withVehicle: boolean;
  /** The hospital service time the customer asked for (unused for drivers). */
  requestedHours: number;
  multiDay: boolean;
  /** Pickup → destination, one way. */
  fromToTo: Leg;
  /** Destination → the driver base (drivers only). Null when the market has no base or for other services. */
  toToBase: Leg | null;
};

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Assumed average speed for the straight-line fallback (it is only ever an estimate for an admin). */
const FALLBACK_KMH = 30;

/** A leg guessed from the straight-line distance, when routing is unavailable. */
export function straightLineLeg(a: LatLng, b: LatLng): Leg {
  const meters = haversineMeters(a, b);
  return { meters, seconds: (meters / 1000 / FALLBACK_KMH) * 3600, estimated: true };
}

export function isTooClose(a: LatLng, b: LatLng): boolean {
  return haversineMeters(a, b) < PRICING_RULES.minTripMeters;
}

/** Hours rounded up to the billing step (0.5 h), ignoring float noise like 2.0000001. */
export function roundUpHours(hours: number, step = PRICING_RULES.billedHourStep): number {
  return Math.ceil(hours / step - 1e-9) * step;
}

const toUnit = (meters: number, unit: DistanceUnit) => Math.round((meters / METERS_PER[unit]) * 10) / 10;
const line = (kind: PriceLine["kind"], quantity: number, rateMinor: number): PriceLine => ({
  kind,
  quantity,
  rateMinor,
  amountMinor: Math.round(quantity * rateMinor),
});

/**
 * Price a hospital visit, driver or companion booking.
 *
 * Hospital visit (from → to → from), plus serviceHour × the hours asked for:
 *   with our vehicle:      perDistance × round trip.
 *   in the customer's car: driveHour × round-trip drive time.
 * Driver, over from → to → base (the drive back to our base counts):
 *   driving:               max(driverMinimum, driveHour × drive time), so up to 4 h costs 400.
 *   with our vehicle, add: perDistance × that distance.
 *   over driverMaxDriveHours of driving: no price, an admin quotes it.
 * Companion: no rule yet, always an admin.
 */
export function priceRoute(
  input: PricingInput,
  pricing: RegionPricing,
  currency: Currency,
  distanceUnit: DistanceUnit,
): PriceEstimate {
  const { rates } = pricing;
  const reasons = new Set<PendingReason>();
  const { fromToTo } = input;

  if (fromToTo.estimated) reasons.add("estimatedRoute");
  if (!rates) reasons.add("noRates");

  const est: PriceEstimate = {
    outcome: "auto",
    reasons: [],
    currency,
    distanceUnit,
    tripDistance: toUnit(fromToTo.meters, distanceUnit),
    driveHours: fromToTo.seconds / 3600,
    billedHours: null,
    serviceHours: null,
    amountMinor: null,
    lines: [],
  };

  if (input.serviceType === "companion") {
    reasons.add("companion");
  } else if (input.serviceType === "hospital_visit") {
    est.tripDistance = toUnit(fromToTo.meters * 2, distanceUnit);
    est.driveHours = (fromToTo.seconds * 2) / 3600;
    est.serviceHours = input.requestedHours;
    if (input.withVehicle) {
      if (rates) est.lines.push(line("distance", est.tripDistance, rates.perDistance));
    } else {
      est.billedHours = roundUpHours(est.driveHours);
      if (rates) est.lines.push(line("driveTime", est.billedHours, rates.driveHour));
    }
    // The time at the hospital is billed with or without our vehicle.
    if (rates) est.lines.push(line("serviceTime", est.serviceHours, rates.serviceHour));
  } else {
    if (input.multiDay) reasons.add("multiDay");
    const { toToBase } = input;
    if (!toToBase) {
      reasons.add("noBase");
    } else {
      if (toToBase.estimated) reasons.add("estimatedRoute");
      est.tripDistance = toUnit(fromToTo.meters + toToBase.meters, distanceUnit);
      est.driveHours = (fromToTo.seconds + toToBase.seconds) / 3600;
      est.legs = [
        { kind: "outbound", distance: toUnit(fromToTo.meters, distanceUnit), driveHours: fromToTo.seconds / 3600 },
        { kind: "return", distance: toUnit(toToBase.meters, distanceUnit), driveHours: toToBase.seconds / 3600 },
      ];
      est.billedHours = roundUpHours(est.driveHours);
      if (est.driveHours > PRICING_RULES.driverMaxDriveHours) {
        reasons.add("tooLong");
      } else if (rates) {
        const driving = line("driveTime", est.billedHours, rates.driveHour);
        est.lines.push(
          driving.amountMinor > rates.driverMinimum ? driving : line("minimum", 1, rates.driverMinimum),
        );
        if (input.withVehicle) est.lines.push(line("distance", est.tripDistance, rates.perDistance));
      }
    }
  }

  if (est.lines.length > 0 && !reasons.has("multiDay")) {
    const total = est.lines.reduce((sum, l) => sum + l.amountMinor, 0);
    est.amountMinor = total;
    if (total < MIN_CHARGE_MINOR[currency] || total > MAX_CHARGE_MINOR[currency]) reasons.add("outOfRange");
  }

  est.reasons = [...reasons];
  if (est.reasons.length > 0) est.outcome = "pendingAdmin";
  return est;
}
