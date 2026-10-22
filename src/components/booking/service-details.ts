import type { useTranslations } from "next-intl";
import { BRAND_NAME } from "@/config/brand";
import type { BookingValues } from "@/domain/booking";

type DetailFields = Pick<
  BookingValues,
  | "vehicle"
  | "estimatedHours"
  | "accompanyingCount"
  | "needsBystander"
  | "childSeat"
  | "days"
  | "partySize"
  | "includeFood"
  | "needsStay"
  | "tourKind"
>;

/**
 * The service-specific facts of a booking as short phrases, e.g.
 * ["<brand> vehicle – Small", "3 hrs", "1 person accompanying"]. Works on a draft's
 * `bookingValues` and on a booking row alike, on the server or the client.
 */
export function serviceDetails(
  b: DetailFields,
  t: ReturnType<typeof useTranslations<"Details">>,
  tv: ReturnType<typeof useTranslations<"Vehicle">>,
): string[] {
  return [
    b.tourKind && t(`tourKind.${b.tourKind}`),
    b.vehicle && tv(b.vehicle, { brand: BRAND_NAME }),
    b.estimatedHours !== null && t("hours", { count: b.estimatedHours }),
    b.days !== null && t("days", { count: b.days }),
    b.partySize !== null && t("people", { count: b.partySize }),
    b.accompanyingCount !== null && t("accompanying", { count: b.accompanyingCount }),
    b.needsBystander && t("bystander"),
    b.childSeat && t("childSeat"),
    b.includeFood && t("food"),
    b.needsStay && t("stay"),
  ].filter((v): v is string => Boolean(v));
}

/** "Pickup → destination" for route services, otherwise the one location. */
export function placeLabel(b: { startAddress: string; serviceAddress: string }): string {
  return b.startAddress ? `${b.startAddress} → ${b.serviceAddress}` : b.serviceAddress;
}
