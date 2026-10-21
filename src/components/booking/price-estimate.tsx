"use client";

import { useEffect, useState } from "react";
import { Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { isRouteService } from "@/domain/booking";
import { toMajor } from "@/domain/money";
import type { PriceEstimate } from "@/domain/pricing";
import { estimateDraft } from "@/server/estimates";
import type { BookingDraft } from "./draft-context";
import { MAPS_ENABLED } from "./maps-provider";

type Response = Awaited<ReturnType<typeof estimateDraft>>;
export type EstimateState = { status: "none" } | { status: "loading" } | { status: "done"; result: Response };

/**
 * Ask the server what this draft would cost, whenever the inputs that affect
 * the price change. "none" when there's nothing to price yet (no maps, not a
 * route service, or a point still to pick).
 */
export function usePriceEstimate(d: BookingDraft): EstimateState {
  const locale = useLocale();
  const priced = MAPS_ENABLED && isRouteService(d.serviceType) && d.startPoint !== null && d.servicePoint !== null;
  const input = priced
    ? {
        serviceType: d.serviceType,
        startPoint: d.startPoint,
        servicePoint: d.servicePoint,
        vehicle: d.vehicle,
        estimatedHours: d.estimatedHours,
        multiDay: d.multiDay,
        driverDays: d.driverDays,
        date: d.date,
        time: d.time,
        timeZone: d.timeZone,
      }
    : null;
  const key = input ? JSON.stringify(input) : null;
  const [done, setDone] = useState<{ key: string; result: Response } | null>(null);

  useEffect(() => {
    if (!key) return;
    let current = true;
    const timer = setTimeout(async () => {
      const result = await estimateDraft(locale, JSON.parse(key));
      if (current) setDone({ key, result });
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key, locale]);

  if (!key) return { status: "none" };
  return done?.key === key ? { status: "done", result: done.result } : { status: "loading" };
}

export function useMoney() {
  const format = useFormatter();
  return (minor: number, currency: string) => format.number(toMajor(minor), { style: "currency", currency });
}

/** The estimate's price when it can be paid straight away, else null. */
export function payableAmount(state: EstimateState): { minor: number; currency: string } | null {
  if (state.status !== "done" || !state.result.ok) return null;
  const est = state.result.estimate;
  return est?.outcome === "auto" && est.amountMinor !== null ? { minor: est.amountMinor, currency: est.currency } : null;
}

/** Distance, drive time and price (or why it needs an admin) for a draft or a stored booking. */
export function PriceSummary({ state }: { state: EstimateState }) {
  const t = useTranslations("Price");
  if (state.status === "none") return null;
  if (state.status === "loading") {
    return (
      <p role="status" className="text-[15px] text-muted">
        {t("loading")}
      </p>
    );
  }
  const { result } = state;
  if (!result.ok) {
    return (
      <p role="alert" className="text-sm font-semibold text-red-700">
        {t(result.error)}
      </p>
    );
  }
  return result.estimate ? <EstimateDetails estimate={result.estimate} /> : null;
}

export function EstimateDetails({ estimate: e, forAdmin = false }: { estimate: PriceEstimate; forAdmin?: boolean }) {
  const t = useTranslations("Price");
  const format = useFormatter();
  const money = useMoney();
  const distance = (value: number) =>
    format.number(value, { style: "unit", unit: e.distanceUnit, maximumFractionDigits: 1 });
  const hours = (value: number) => format.number(value, { style: "unit", unit: "hour", maximumFractionDigits: 1 });

  if (e.reasons.includes("noLocation")) {
    return <p className="text-[15px] text-muted">{forAdmin ? t("reasons.noLocation") : t("pending")}</p>;
  }

  return (
    <div className="flex flex-col gap-2 text-[15px]">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted">{t("distance")}</dt>
        <dd className="text-right font-medium">{distance(e.tripDistance)}</dd>
        <dt className="text-muted">{t("driveTime")}</dt>
        <dd className="text-right font-medium">{hours(Math.round(e.driveHours * 10) / 10)}</dd>
        {e.lines.map((l) => (
          <div key={l.kind} className="contents">
            <dt className="text-muted">
              {t(`lines.${l.kind}`, {
                quantity: l.kind === "distance" ? distance(l.quantity) : hours(l.quantity),
                rate: money(l.rateMinor, e.currency),
              })}
            </dt>
            <dd className="text-right font-medium">{money(l.amountMinor, e.currency)}</dd>
          </div>
        ))}
      </dl>
      {e.amountMinor !== null && (
        <p className="flex items-baseline justify-between border-t border-border pt-2">
          <span className="font-bold">{e.outcome === "auto" ? t("total") : t("suggested")}</span>
          <span className="font-display text-2xl font-bold">{money(e.amountMinor, e.currency)}</span>
        </p>
      )}
      {e.outcome === "pendingAdmin" &&
        (forAdmin ? (
          <ul className="list-disc pl-5 text-sm font-semibold text-muted-strong">
            {e.reasons.map((r) => (
              <li key={r}>{t(`reasons.${r}`)}</li>
            ))}
          </ul>
        ) : (
          <p className="rounded-field bg-accent-soft px-3 py-2 text-sm font-semibold">{t("pending")}</p>
        ))}
    </div>
  );
}

/** A small map of the route from pickup to destination. */
export function RoutePreview({ state }: { state: EstimateState }) {
  const t = useTranslations("Price");
  if (state.status !== "done" || !state.result.ok || !state.result.polyline) return null;
  return (
    <div className="h-44 overflow-hidden rounded-xl" role="img" aria-label={t("routeMap")}>
      <Map id="route-preview" defaultCenter={{ lat: 0, lng: 0 }} defaultZoom={2} disableDefaultUI gestureHandling="none" keyboardShortcuts={false} clickableIcons={false} className="size-full">
        <RouteLine encoded={state.result.polyline} />
      </Map>
    </div>
  );
}

function RouteLine({ encoded }: { encoded: string }) {
  const map = useMap("route-preview");
  const geometry = useMapsLibrary("geometry");
  const maps = useMapsLibrary("maps");
  useEffect(() => {
    if (!map || !geometry || !maps) return;
    const path = geometry.encoding.decodePath(encoded);
    const end = { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillOpacity: 1, strokeWeight: 2 };
    const line = new maps.Polyline({
      map,
      path,
      strokeColor: "#0E4A43",
      strokeWeight: 4,
      icons: [
        { icon: { ...end, fillColor: "#FFFFFF" }, offset: "0%" },
        { icon: { ...end, fillColor: "#0E4A43" }, offset: "100%" },
      ],
    });
    const bounds = new google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 24);
    return () => line.setMap(null);
  }, [map, geometry, maps, encoded]);
  return null;
}
