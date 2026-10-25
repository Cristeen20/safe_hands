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
 * - noBase: a driver or hospital visit, but the market has no base for the return leg.
 * - tooLong: the trip drives longer than PRICING_RULES.maxDriveHours.
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

/**
 * The divisions of a hospital visit's price: the service drive (pickup →
 * hospital → pickup), the drive back to our base, and the service hours.
 */
export const PRICE_PARTS = ["serviceDrive", "toBase", "service"] as const;
export type PricePart = (typeof PRICE_PARTS)[number];

export type PriceLine = {
  kind: "distance" | "driveTime" | "serviceTime" | "minimum";
  /** Which division the line belongs to (hospital visits). Missing on driver lines and older estimates. */
  part?: PricePart;
  /** Distance in the region's unit, or hours (1 for the minimum charge). */
  quantity: number;
  rateMinor: number;
  amountMinor: number;
};

/**
 * One part of a trip, shown on its own: pickup → destination (outbound),
 * destination → pickup (back), destination → base (return, drivers) and
 * pickup → base (pickupReturn, hospital visits).
 */
export type TripLeg = {
  kind: "outbound" | "back" | "return" | "pickupReturn";
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
  /** Distance driven, in the region's unit: from → to → from → base for hospital visits, from → to → base for drivers. */
  tripDistance: number;
  /** Driving time over that same trip, before rounding. */
  driveHours: number;
  /** Each part of that trip. Missing on older estimates and for companions. */
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
  /** The leg back to our base: from the destination (drivers) or the pickup (hospital visits). Null without a base. */
  toBase: Leg | null;
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

/** The division a trip leg belongs to. */
export function legPart(kind: TripLeg["kind"]): Exclude<PricePart, "service"> {
  return kind === "outbound" || kind === "back" ? "serviceDrive" : "toBase";
}

const toUnit = (meters: number, unit: DistanceUnit) => Math.round((meters / METERS_PER[unit]) * 10) / 10;
const line = (kind: PriceLine["kind"], quantity: number, rateMinor: number, part?: PricePart): PriceLine => ({
  kind,
  ...(part && { part }),
  quantity,
  rateMinor,
  amountMinor: Math.round(quantity * rateMinor),
});

/**
 * Price a hospital visit, driver or companion booking.
 *
 * Hospital visit, in three divisions: the service drive (from → to → from),
 * the drive to base (from → base), and serviceHour × the hours asked for.
 * Each drive is priced on its own:
 *   with our vehicle:      perDistance × its distance.
 *   in the customer's car: driveHour × its drive time, rounded up.
 * Driver, over from → to → base (the drive back to our base counts):
 *   driving:               max(driverMinimum, driveHour × drive time), so up to 4 h costs 400.
 *   with our vehicle, add: perDistance × that distance.
 * Either one, over maxDriveHours of driving: priced the same, but an admin must approve it.
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
    est.serviceHours = input.requestedHours;
    const { toBase } = input;
    if (!toBase) {
      reasons.add("noBase");
    } else {
      if (toBase.estimated) reasons.add("estimatedRoute");
      // The way back is assumed to mirror the way there.
      const drives = [
        { part: "serviceDrive" as const, distance: toUnit(fromToTo.meters * 2, distanceUnit), hours: (fromToTo.seconds * 2) / 3600 },
        { part: "toBase" as const, distance: toUnit(toBase.meters, distanceUnit), hours: toBase.seconds / 3600 },
      ];
      est.tripDistance = Math.round((drives[0].distance + drives[1].distance) * 10) / 10;
      est.driveHours = drives[0].hours + drives[1].hours;
      const leg = (kind: TripLeg["kind"], l: Leg): TripLeg => ({
        kind,
        distance: toUnit(l.meters, distanceUnit),
        driveHours: l.seconds / 3600,
      });
      est.legs = [leg("outbound", fromToTo), leg("back", fromToTo), leg("pickupReturn", toBase)];
      if (est.driveHours > PRICING_RULES.maxDriveHours) reasons.add("tooLong");
      if (rates) {
        for (const d of drives) {
          est.lines.push(
            input.withVehicle
              ? line("distance", d.distance, rates.perDistance, d.part)
              : line("driveTime", roundUpHours(d.hours), rates.driveHour, d.part),
          );
        }
        if (!input.withVehicle) est.billedHours = est.lines.reduce((sum, l) => sum + l.quantity, 0);
        // The time at the hospital is billed with or without our vehicle.
        est.lines.push(line("serviceTime", est.serviceHours, rates.serviceHour, "service"));
      }
    }
  } else {
    if (input.multiDay) reasons.add("multiDay");
    const { toBase } = input;
    if (!toBase) {
      reasons.add("noBase");
    } else {
      if (toBase.estimated) reasons.add("estimatedRoute");
      est.tripDistance = toUnit(fromToTo.meters + toBase.meters, distanceUnit);
      est.driveHours = (fromToTo.seconds + toBase.seconds) / 3600;
      est.legs = [
        { kind: "outbound", distance: toUnit(fromToTo.meters, distanceUnit), driveHours: fromToTo.seconds / 3600 },
        { kind: "return", distance: toUnit(toBase.meters, distanceUnit), driveHours: toBase.seconds / 3600 },
      ];
      est.billedHours = roundUpHours(est.driveHours);
      if (est.driveHours > PRICING_RULES.maxDriveHours) reasons.add("tooLong");
      if (rates) {
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
