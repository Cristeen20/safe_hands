import "server-only";
import { cacheLife } from "next/cache";
import type { LatLng } from "@/config/pricing";
import { straightLineLeg, type Leg } from "@/domain/pricing";
import type { Region } from "@/lib/region";

// Google Maps Platform on the server: Routes API (traffic-aware drive time for
// the booked slot) and Geocoding (which country/province a point is in).
// Without GOOGLE_MAPS_API_KEY nothing is called: route requests then go to an
// admin, as before maps existed.

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export function mapsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  return key;
}

// ~11 m precision: close enough for pricing, and nearby pins share a cache entry.
const round = (p: LatLng) => ({ lat: Math.round(p.lat * 1e4) / 1e4, lng: Math.round(p.lng * 1e4) / 1e4 });
const latLng = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

type RoutedLeg = Leg & { polyline: string | null };

async function fetchRoute(from: LatLng, to: LatLng, departHourIso: string): Promise<RoutedLeg> {
  "use cache";
  // Spec: cache routing by (from, to, hour slot) for a short time to limit API cost.
  cacheLife("hours");
  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: latLng(from),
      destination: latLng(to),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      departureTime: departHourIso,
    }),
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}`);
  const body = (await res.json()) as {
    routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[];
  };
  const route = body.routes?.[0];
  if (!route?.duration) throw new Error("Routes API returned no route");
  return {
    meters: route.distanceMeters ?? 0,
    seconds: Number.parseFloat(route.duration),
    estimated: false,
    polyline: route.polyline?.encodedPolyline ?? null,
  };
}

/**
 * Driving distance and time from `from` to `to`, leaving at `departAt` (per
 * hour slot). If the routing API fails, falls back to the straight line and
 * marks the leg `estimated`, which sends the request to an admin.
 */
export async function routeLeg(from: LatLng, to: LatLng, departAt: Date): Promise<RoutedLeg> {
  const hour = new Date(departAt);
  hour.setUTCMinutes(0, 0, 0);
  try {
    return await fetchRoute(round(from), round(to), hour.toISOString());
  } catch (err) {
    console.error("[maps] routing failed, using straight-line estimate", err);
    return { ...straightLineLeg(from, to), polyline: null };
  }
}

type Area = { country: string | null; province: string | null };

async function fetchArea(p: LatLng): Promise<Area> {
  "use cache";
  cacheLife("days");
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("latlng", `${p.lat},${p.lng}`);
  url.searchParams.set("result_type", "country|administrative_area_level_1");
  url.searchParams.set("key", apiKey());
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding API ${res.status}`);
  const body = (await res.json()) as {
    status: string;
    results?: { address_components: { short_name: string; types: string[] }[] }[];
  };
  if (body.status === "ZERO_RESULTS") return { country: null, province: null };
  if (body.status !== "OK") throw new Error(`Geocoding API ${body.status}`);
  const parts = body.results?.flatMap((r) => r.address_components) ?? [];
  const find = (type: string) => parts.find((c) => c.types.includes(type))?.short_name ?? null;
  return { country: find("country"), province: find("administrative_area_level_1") };
}

/**
 * Whether a point is inside the market we serve: in the region's country, and
 * not in Quebec (D19). "unknown" when geocoding failed (an admin checks it).
 */
export async function serviceArea(p: LatLng, region: Region): Promise<"inside" | "outside" | "unknown"> {
  try {
    const { country, province } = await fetchArea(round(p));
    if (country !== region) return "outside";
    if (region === "CA" && province === "QC") return "outside";
    return "inside";
  } catch (err) {
    console.error("[maps] geocoding failed", err);
    return "unknown";
  }
}
