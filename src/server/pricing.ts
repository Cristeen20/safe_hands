import "server-only";
import { PRICING } from "@/config/pricing";
import { isOurVehicle, isRouteService, type BookingValues, type GeoPoint } from "@/domain/booking";
import { isTooClose, priceRoute, type PriceEstimate } from "@/domain/pricing";
import { REGION_CONFIG, inServiceBounds, type Region } from "@/lib/region";
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
 * go to an admin as before. Also checks every map point is in India (D30).
 */
export async function estimateBooking(region: Region, v: Pricable): Promise<EstimateResult> {
  const points = [v.startPoint, v.servicePoint].filter((p): p is GeoPoint => p !== null);
  if (!points.every(inServiceBounds)) return { ok: false, error: "outsideArea" };
  const areaChecks = mapsConfigured() ? await Promise.all(points.map((p) => serviceArea(p))) : [];
  if (areaChecks.includes("outside")) return { ok: false, error: "outsideArea" };

  if (!isRouteService(v.serviceType)) return { ok: true, estimate: null, polyline: null };
  const { currency, distanceUnit } = REGION_CONFIG[region];
  const pricing = PRICING[region];

  const from = v.startPoint;
  const to = v.servicePoint;
  if (!from || !to || !mapsConfigured()) {
    // No coordinates: nothing to price, an admin quotes it.
    return { ok: true, estimate: pendingWithoutRoute(currency, distanceUnit), polyline: null };
  }
  if (isTooClose(from, to)) return { ok: false, error: "tooClose" };

  // Drivers head back to our base from the drop-off; hospital visits from the pickup, once the customer is home.
  const baseFrom = v.serviceType === "driver" ? to : v.serviceType === "hospital_visit" ? from : null;
  const base = baseFrom ? pricing.base : null;
  const [fromToTo, toBase] = await Promise.all([
    routeLeg(from, to, v.scheduledStart),
    baseFrom && base ? routeLeg(baseFrom, base, v.scheduledStart) : Promise.resolve(null),
  ]);
  const estimate = priceRoute(
    {
      serviceType: v.serviceType,
      withVehicle: isOurVehicle(v.vehicle),
      requestedHours: v.estimatedHours ?? 0,
      multiDay: v.days !== null,
      fromToTo,
      toBase,
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
): PriceEstimate {
  return {
    outcome: "pendingAdmin",
    reasons: ["noLocation"],
    currency,
    distanceUnit,
    tripDistance: 0,
    driveHours: 0,
    billedHours: null,
    serviceHours: null,
    amountMinor: null,
    lines: [],
  };
}
