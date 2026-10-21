"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useLocale, useTranslations } from "next-intl";
import type { GeoPoint } from "@/domain/booking";
import { regionForLocale, type AppLocale } from "@/lib/region";
import { secondaryButton, primaryButton } from "@/components/ui/styles";
import { MAPS_ENABLED, mapFallbackCenter } from "./maps-provider";

export type LocationValue = { address: string; point: GeoPoint | null; notes: string };

type Props = {
  label: string;
  placeholder: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  autoComplete?: string;
};

const fieldBox = "flex flex-col gap-0.5 rounded-field border border-border bg-card px-3.5 py-3 focus-within:border-primary";
const fieldInput = "w-full bg-transparent p-0 text-base font-medium text-ink outline-none placeholder:text-muted";
/** GPS fixes less accurate than this ask the customer to check the pin (spec edge case). */
const GPS_ACCURACY_M = 50;

/**
 * An address field. With maps configured: search with autocomplete, or open
 * an inline map and move it under a fixed centre pin, then confirm. The
 * confirmed point's coordinates go to the server for pricing. Without maps:
 * a plain text field.
 */
export function LocationField(props: Props) {
  return MAPS_ENABLED ? <MapLocationField {...props} /> : <PlainLocationField {...props} />;
}

function NotesInput({ value, onChange }: Pick<Props, "value" | "onChange">) {
  const t = useTranslations("Location");
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
      {t("notesLabel")}
      <input
        type="text"
        maxLength={200}
        placeholder={t("notesPlaceholder")}
        value={value.notes}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
        className="h-11 rounded-field border border-border bg-card px-3.5 text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted focus:border-primary"
      />
    </label>
  );
}

function PlainLocationField({ label, placeholder, value, onChange, autoComplete }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <label className={fieldBox}>
        <span className="text-xs font-semibold text-muted">{label}</span>
        <input
          type="text"
          required
          maxLength={200}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value, point: null })}
          className={fieldInput}
        />
      </label>
      <NotesInput value={value} onChange={onChange} />
    </div>
  );
}

type Suggestion = { id: string; text: string; prediction: google.maps.places.PlacePrediction };

function MapLocationField({ label, placeholder, value, onChange, autoComplete }: Props) {
  const t = useTranslations("Location");
  const locale = useLocale() as AppLocale;
  const region = regionForLocale(locale);
  const places = useMapsLibrary("places");
  const id = useId();
  const listId = `${id}-list`;
  // Results for one query; shown only while the field still holds that query.
  const [found, setFound] = useState<{ input: string; items: Suggestion[] }>({ input: "", items: [] });
  const [active, setActive] = useState(-1);
  const [mapOpen, setMapOpen] = useState(false);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const input = value.point ? "" : value.address.trim();
  const suggestions = found.input === input ? found.items : [];
  const dismiss = () => setFound({ input, items: [] });

  // Debounced autocomplete (about 300 ms), limited to the market's country.
  useEffect(() => {
    if (!places || input.length < 3) return;
    let current = true;
    const timer = setTimeout(async () => {
      sessionToken.current ??= new places.AutocompleteSessionToken();
      try {
        const { suggestions: found } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          includedRegionCodes: [region.toLowerCase()],
          language: locale,
          sessionToken: sessionToken.current,
        });
        if (!current) return;
        setFound({
          input,
          items: found.flatMap((s) =>
            s.placePrediction
              ? [{ id: s.placePrediction.placeId, text: s.placePrediction.text.toString(), prediction: s.placePrediction }]
              : [],
          ),
        });
        setActive(-1);
      } catch (err) {
        console.error("[maps] autocomplete failed", err);
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [places, input, region, locale]);

  async function choose(s: Suggestion) {
    dismiss();
    const place = s.prediction.toPlace();
    try {
      await place.fetchFields({ fields: ["location", "formattedAddress", "id"] });
    } catch (err) {
      console.error("[maps] place details failed", err);
      return;
    }
    sessionToken.current = null; // a session ends with the details call
    if (!place.location) return;
    onChange({
      ...value,
      address: place.formattedAddress ?? s.text,
      point: { lat: place.location.lat(), lng: place.location.lng(), placeId: place.id, source: "search" },
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      void choose(suggestions[active]);
    } else if (e.key === "Escape") {
      dismiss();
    }
  }

  const needsPick = value.address.trim() !== "" && !value.point && suggestions.length === 0 && !mapOpen;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <label className={fieldBox}>
          <span className="text-xs font-semibold text-muted">{label}</span>
          <input
            type="text"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            required
            maxLength={200}
            autoComplete={autoComplete ?? "off"}
            placeholder={placeholder}
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value, point: null })}
            onKeyDown={onKeyDown}
            onBlur={dismiss}
            className={fieldInput}
          />
        </label>
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={suggestions.length === 0}
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-field border border-border-strong bg-card shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void choose(s)}
              className={`flex min-h-11 cursor-pointer items-center px-3.5 py-2 text-[15px] ${i === active ? "bg-primary-soft" : "hover:bg-field"}`}
            >
              {s.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {value.point ? (
          <span className="font-semibold text-success">{t("pinned")}</span>
        ) : (
          needsPick && <span className="font-semibold text-muted-strong">{t("pickHint")}</span>
        )}
        <button
          type="button"
          aria-expanded={mapOpen}
          onClick={() => setMapOpen((o) => !o)}
          className="min-h-11 font-bold text-primary"
        >
          {mapOpen ? t("closeMap") : t("chooseOnMap")}
          <span className="sr-only"> {label}</span>
        </button>
      </div>

      {mapOpen && (
        <PinPicker
          mapId={`${id}-map`}
          label={label}
          initial={value.point}
          onCancel={() => setMapOpen(false)}
          onConfirm={(address, point) => {
            onChange({ ...value, address, point });
            setMapOpen(false);
          }}
        />
      )}

      <NotesInput value={value} onChange={onChange} />
    </div>
  );
}

/** An inline map with a fixed centre pin: move the map, not the marker. */
function PinPicker({
  mapId,
  label,
  initial,
  onConfirm,
  onCancel,
}: {
  mapId: string;
  label: string;
  initial: GeoPoint | null;
  onConfirm: (address: string, point: GeoPoint) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Location");
  const region = regionForLocale(useLocale() as AppLocale);
  const map = useMap(mapId);
  const geocoding = useMapsLibrary("geocoding");
  const [center, setCenter] = useState<google.maps.LatLngLiteral | null>(initial);
  const [pinAddress, setPinAddress] = useState<{ text: string; placeId: string } | null>(null);
  const [gps, setGps] = useState<"idle" | "locating" | "approximate" | "denied">("idle");
  const source = useRef<GeoPoint["source"]>(initial?.source ?? "pin");
  const fallback = mapFallbackCenter(region);

  function locate() {
    if (!map || !("geolocation" in navigator)) return setGps("denied");
    setGps("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        source.current = "gps";
        map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        map.setZoom(17);
        setGps(pos.coords.accuracy > GPS_ACCURACY_M ? "approximate" : "idle");
      },
      () => setGps("denied"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // Open on the device location when there's no point yet (falls back to our base).
  const located = useRef(false);
  useEffect(() => {
    if (!map || initial || located.current) return;
    located.current = true;
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the map is ready
  }, [map, initial]);

  // Reverse-geocode only when the map stops moving.
  useEffect(() => {
    if (!geocoding || !center) return;
    let current = true;
    new geocoding.Geocoder().geocode({ location: center }).then(
      ({ results }) => {
        if (current && results[0]) setPinAddress({ text: results[0].formatted_address, placeId: results[0].place_id });
      },
      () => current && setPinAddress(null),
    );
    return () => {
      current = false;
    };
  }, [geocoding, center]);

  return (
    <div role="group" aria-label={t("mapGroup", { label })} className="flex flex-col gap-3 rounded-2xl border border-border p-3">
      <div className="relative h-72 overflow-hidden rounded-xl sm:h-80">
        <Map
          id={mapId}
          defaultCenter={initial ?? fallback.center}
          defaultZoom={initial ? 17 : fallback.zoom}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          onDragstart={() => {
            source.current = "pin";
            setPinAddress(null);
          }}
          onIdle={(e) => {
            const c = e.map.getCenter();
            if (c) setCenter({ lat: c.lat(), lng: c.lng() });
          }}
          className="size-full"
        />
        {/* The pin's tip marks the centre of the map. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="40"
          height="40"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full text-primary drop-shadow"
        >
          <path
            d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z"
            fill="currentColor"
            stroke="white"
            strokeWidth="1.5"
          />
          <circle cx="12" cy="10" r="2.6" fill="white" />
        </svg>
      </div>
      <p aria-live="polite" className="min-h-6 text-[15px] font-semibold">
        {pinAddress?.text ?? (center ? t("findingAddress") : t("moveMap"))}
      </p>
      {gps === "approximate" && <p className="text-sm font-semibold text-muted-strong">{t("approximate")}</p>}
      {gps === "denied" && <p className="text-sm text-muted-strong">{t("locationDenied")}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!center}
          onClick={() =>
            center &&
            onConfirm(pinAddress?.text ?? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`, {
              lat: center.lat,
              lng: center.lng,
              placeId: pinAddress?.placeId ?? "",
              source: source.current,
            })
          }
          className={`${primaryButton} sm:w-fit sm:px-8`}
        >
          {t("confirm")}
        </button>
        <button type="button" onClick={locate} disabled={gps === "locating"} className={secondaryButton}>
          {gps === "locating" ? t("locating") : t("useMyLocation")}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
