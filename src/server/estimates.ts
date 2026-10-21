"use server";

import { hasLocale } from "next-intl";
import { z } from "zod";
import {
  MAX_DAYS,
  MAX_HOURS,
  MIN_DRIVER_DAYS,
  MIN_LEAD_TIME_MS,
  TIME_SLOTS,
  geoPointSchema,
} from "@/domain/booking";
import { routing } from "@/i18n/routing";
import { regionForLocale } from "@/lib/region";
import { zonedToUtc } from "@/lib/time";
import { estimateBooking, type EstimateResult } from "./pricing";

// What the /book page sends while the customer is still filling it in. The
// slot is optional: until one is picked, prices use a departure 48 hours out.
const draftSchema = z.object({
  serviceType: z.enum(["hospital_visit", "driver", "companion"]),
  startPoint: geoPointSchema,
  servicePoint: geoPointSchema,
  vehicle: z.enum(["none", "own", "small", "large"]),
  estimatedHours: z.number().int().min(1).max(MAX_HOURS).catch(1),
  multiDay: z.boolean().catch(false),
  driverDays: z.number().int().min(MIN_DRIVER_DAYS).max(MAX_DAYS).catch(MIN_DRIVER_DAYS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  time: z.enum(TIME_SLOTS).nullable().catch(null),
  timeZone: z.string().nullable().catch(null),
});

/**
 * The spec's POST /quote: the price the server would charge for this draft,
 * shown before booking. Submitting recomputes it (src/server/bookings.ts), so
 * nothing returned here is trusted later.
 */
export async function estimateDraft(
  locale: string,
  input: unknown,
): Promise<EstimateResult | { ok: false; error: "invalid" }> {
  if (!hasLocale(routing.locales, locale)) return { ok: false, error: "invalid" };
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;

  let scheduledStart = new Date(Date.now() + MIN_LEAD_TIME_MS);
  if (d.date && d.time && d.timeZone) {
    try {
      scheduledStart = zonedToUtc(d.date, d.time, d.timeZone);
    } catch {
      return { ok: false, error: "invalid" };
    }
  }

  return estimateBooking(regionForLocale(locale), {
    serviceType: d.serviceType,
    startPoint: d.startPoint,
    servicePoint: d.servicePoint,
    vehicle: d.vehicle,
    estimatedHours: d.estimatedHours,
    days: d.multiDay && d.serviceType !== "hospital_visit" ? d.driverDays : null,
    scheduledStart,
  });
}
