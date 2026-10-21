"use client";

import type { ReactNode } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { useLocale } from "next-intl";
import { PRICING, type LatLng } from "@/config/pricing";
import { regionForLocale, type AppLocale, type Region } from "@/lib/region";

/**
 * Browser key for the Maps JavaScript API and Places (restrict it to our
 * domains). Without it the location fields are plain text and route requests
 * go to an admin, so dev and tests work with no Google account.
 */
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const MAPS_ENABLED = MAPS_KEY !== "";

/** Where the map opens when we don't know the device location: our base, else the country. */
const COUNTRY_CENTER: Record<Region, LatLng> = {
  US: { lat: 39.8, lng: -98.6 },
  CA: { lat: 45.4, lng: -79.4 },
  GB: { lat: 52.6, lng: -1.5 },
  IN: { lat: 20.6, lng: 78.9 },
};

export function mapFallbackCenter(region: Region): { center: LatLng; zoom: number } {
  const base = PRICING[region].base;
  return base ? { center: base, zoom: 14 } : { center: COUNTRY_CENTER[region], zoom: 5 };
}

export function MapsProvider({ children }: { children: ReactNode }) {
  const locale = useLocale() as AppLocale;
  if (!MAPS_ENABLED) return children;
  return (
    <APIProvider apiKey={MAPS_KEY} region={regionForLocale(locale)} language={locale}>
      {children}
    </APIProvider>
  );
}
