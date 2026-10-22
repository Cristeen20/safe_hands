"use client";

import type { ReactNode } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { useLocale } from "next-intl";
import type { LatLng } from "@/config/pricing";
import { SERVICE_COUNTRY, type AppLocale } from "@/lib/region";

/**
 * Browser key for the Maps JavaScript API and Places (restrict it to our
 * domains). Without it the location fields are plain text and route requests
 * go to an admin, so dev and tests work with no Google account.
 */
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const MAPS_ENABLED = MAPS_KEY !== "";

/** Where the map opens when we don't know the device location: the middle of India (D30). */
const INDIA_CENTER: LatLng = { lat: 20.6, lng: 78.9 };

export function mapFallbackCenter(): { center: LatLng; zoom: number } {
  return { center: INDIA_CENTER, zoom: 5 };
}

export function MapsProvider({ children }: { children: ReactNode }) {
  const locale = useLocale() as AppLocale;
  if (!MAPS_ENABLED) return children;
  return (
    <APIProvider apiKey={MAPS_KEY} region={SERVICE_COUNTRY} language={locale}>
      {children}
    </APIProvider>
  );
}
