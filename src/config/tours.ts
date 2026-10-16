import type { Region } from "@/lib/region";

// Guided tours (canvas "Guided tours"). There's no admin screen for these yet,
// so the packages and stays live here and change with a deploy.

export type TourPackage = {
  /** Stable id stored on bookings (`booking.tour_package`). Never reuse one. */
  id: string;
  region: Region;
  name: string;
  kind: "pilgrimage" | "group_tour";
  days: number;
  nights: number;
  /** Departure, in the package's local time. A package is a scheduled booking (D3). */
  departs: { date: string; time: string; timeZone: string };
};

// SAMPLE departures: replace with the real schedule before launch. The canvas
// also has "Alappuzha + [SECOND STOP]"; add it once its stops and length are set.
export const TOUR_PACKAGES: readonly TourPackage[] = [
  {
    id: "malayattoor-bharananganam",
    region: "IN",
    name: "Malayattoor + Bharananganam",
    kind: "pilgrimage",
    days: 2,
    nights: 1,
    departs: { date: "2026-11-14", time: "06:00", timeZone: "Asia/Kolkata" },
  },
  {
    id: "munnar-vagamon",
    region: "IN",
    name: "Munnar + Vagamon",
    kind: "group_tour",
    days: 3,
    nights: 2,
    departs: { date: "2026-11-21", time: "06:00", timeZone: "Asia/Kolkata" },
  },
];

/** Places with a private stay available for a staycation, by region. */
export const STAY_LOCATIONS: Record<Region, readonly string[]> = {
  US: [],
  CA: [],
  GB: [],
  IN: ["Munnar", "Vagamon", "Alappuzha"],
};

export function findTourPackage(id: string): TourPackage | undefined {
  return TOUR_PACKAGES.find((p) => p.id === id);
}
