import "server-only";
import { PRICING } from "@/config/pricing";
import { isOurVehicle, isRouteService, type BookingValues, type GeoPoint } from "@/domain/booking";
import { isTooClose, priceRoute, type PriceEstimate } from "@/domain/pricing";
import { REGION_CONFIG, type Region } from "@/lib/region";
import { mapsConfigured, routeLeg, serviceArea } from "./maps";

export type EstimateResult =
  | { ok: true; estimate: PriceEstimate | null; polyline: string | null }
  | { ok: false; error: "outsideArea" | "tooClose" };

type Pricable = Pick<
  BookingValues,
  "serviceType" | "startPoint" | "servicePoint" | "vehicle" | "estimatedHours" | "days" | "scheduledStart"
>;

/**
 * The server's price for a booking. Only route services (hospital visit,
 * driver, companion) are priced; other services return a null estimate and
 * go to an admin as before. Also checks every map point is inside the market.
 */
export async function estimateBooking(region: Region, v: Pricable): Promise<EstimateResult> {
  const points = [v.startPoint, v.servicePoint].filter((p): p is GeoPoint => p !== null);
  const areaChecks = mapsConfigured() ? await Promise.all(points.map((p) => serviceArea(p, region))) : [];
  if (areaChecks.includes("outside")) return { ok: false, error: "outsideArea" };

  if (!isRouteService(v.serviceType)) return { ok: true, estimate: null, polyline: null };
  const { currency, distanceUnit } = REGION_CONFIG[region];
  const pricing = PRICING[region];

  const from = v.startPoint;
  const to = v.servicePoint;
  if (!from || !to || !mapsConfigured()) {
    // No coordinates: nothing to price, an admin quotes it.
    return { ok: true, estimate: pendingWithoutRoute(currency, distanceUnit, pricing.maxBaseDistance), polyline: null };
  }
  if (isTooClose(from, to)) return { ok: false, error: "tooClose" };

  const [fromToTo, baseToFrom] = await Promise.all([
    routeLeg(from, to, v.scheduledStart),
    pricing.base ? routeLeg(pricing.base, from, v.scheduledStart) : Promise.resolve(null),
  ]);
  const estimate = priceRoute(
    {
      serviceType: v.serviceType,
      withVehicle: isOurVehicle(v.vehicle),
      requestedHours: v.estimatedHours ?? 0,
      multiDay: v.days !== null,
      baseToFrom,
      fromToTo,
    },
    pricing,
    currency,
    distanceUnit,
  );
  if (areaChecks.includes("unknown") && estimate.outcome === "auto") {
    estimate.outcome = "pendingAdmin";
    estimate.reasons.push("areaUnchecked");
  }
  return { ok: true, estimate, polyline: fromToTo.polyline };
}

function pendingWithoutRoute(
  currency: PriceEstimate["currency"],
  distanceUnit: PriceEstimate["distanceUnit"],
  maxBaseDistance: number,
): PriceEstimate {
  return {
    outcome: "pendingAdmin",
    reasons: ["noLocation"],
    currency,
    distanceUnit,
    tripDistance: 0,
    baseDistance: null,
    maxBaseDistance,
    vehicleAllowed: true,
    driveHours: 0,
    billedHours: null,
    serviceHours: null,
    amountMinor: null,
    lines: [],
  };
}
