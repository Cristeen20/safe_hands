import { isRouteService, recipientSchema, type ServiceType } from "@/domain/booking";
import { toE164 } from "@/lib/phone";
import { SERVICE_COUNTRY } from "@/lib/region";
import type { BookingDraft } from "./draft-context";
import { MAPS_ENABLED } from "./maps-provider";

/**
 * The booking steps. Details, date & time and options each have a page under
 * /book; review is /book/review; payment is the provider's checkout.
 */
export type BookStep = "details" | "when" | "options" | "review" | "payment";

export const STEP_PATH = {
  details: "/book",
  when: "/book/when",
  options: "/book/options",
  review: "/book/review",
} as const satisfies Partial<Record<BookStep, string>>;

/** Only services with a route have options (vehicle, extras, multiple days). */
export function stepsFor(service: ServiceType): BookStep[] {
  return isRouteService(service)
    ? ["details", "when", "options", "review", "payment"]
    : ["details", "when", "review", "payment"];
}

/** Who it's for and where, with a map point for every place when maps are on (so it's checked to be in India). */
export function detailsComplete(d: BookingDraft): boolean {
  if (d.recipient.kind === "other" && !toE164(d.recipient.phone, SERVICE_COUNTRY)) return false;
  if (!recipientSchema.safeParse(d.recipient).success) return false;
  if (!d.serviceAddress.trim()) return false;
  if (MAPS_ENABLED && !d.servicePoint) return false;
  if (isRouteService(d.serviceType)) {
    if (!d.startAddress.trim()) return false;
    if (MAPS_ENABLED && !d.startPoint) return false;
  }
  return true;
}

/** A day and a time are picked (whether they're still far enough ahead is checked on the page). */
export function whenComplete(d: BookingDraft): boolean {
  return Boolean(d.date && d.time && d.timeZone);
}

/** The first step before `step` that still needs input, if any. */
export function firstIncompleteBefore(d: BookingDraft, step: BookStep): "details" | "when" | null {
  const order = stepsFor(d.serviceType);
  const before = (s: BookStep) => order.indexOf(s) < order.indexOf(step);
  if (before("details") && !detailsComplete(d)) return "details";
  if (before("when") && !whenComplete(d)) return "when";
  return null;
}
