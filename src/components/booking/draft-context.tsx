"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  MIN_DRIVER_DAYS,
  bookingRequestSchema,
  isRouteService,
  minHours,
  vehiclesFor,
  type GeoPoint,
  type ServiceType,
  type TourKind,
  type Vehicle,
} from "@/domain/booking";
import { SERVICE_TIME_ZONE, type Region } from "@/lib/region";
import { MAPS_ENABLED } from "./maps-provider";

/**
 * The booking a customer is building. It lives in the browser until they sign
 * in and submit it, so a guest can fill it in first. The server re-validates
 * everything on submit; nothing here is trusted.
 */
export type BookingDraft = {
  serviceType: ServiceType;
  startAddress: string;
  /** Set once the customer confirms a place on the map or picks a search result. */
  startPoint: GeoPoint | null;
  startNotes: string;
  serviceAddress: string;
  servicePoint: GeoPoint | null;
  serviceNotes: string;
  date: string | null;
  time: string | null;
  timeZone: string | null;
  estimatedHours: number;
  vehicle: Vehicle;
  description: string;
  recipient:
    | { kind: "self" }
    | { kind: "other"; firstName: string; lastName: string; phone: string };
  // Hospital visit
  accompanyingCount: number;
  needsBystander: boolean;
  // Driver (multi-day also for companions)
  childSeat: boolean;
  multiDay: boolean;
  driverDays: number;
  // Guided tours
  tourKind: TourKind;
  tourPackage: string;
  stayLocation: string;
  tourLocation: string;
  partySize: number;
  days: number;
  includeFood: boolean;
  needsStay: boolean;
};

export const EMPTY_DRAFT: BookingDraft = {
  serviceType: "hospital_visit",
  startAddress: "",
  startPoint: null,
  startNotes: "",
  serviceAddress: "",
  servicePoint: null,
  serviceNotes: "",
  date: null,
  time: null,
  timeZone: null,
  estimatedHours: 3,
  vehicle: "small",
  description: "",
  recipient: { kind: "self" },
  accompanyingCount: 1,
  needsBystander: false,
  childSeat: false,
  multiDay: false,
  driverDays: MIN_DRIVER_DAYS,
  tourKind: "package",
  tourPackage: "",
  stayLocation: "",
  tourLocation: "",
  partySize: 2,
  days: 2,
  includeFood: false,
  needsStay: false,
};

const STORAGE_KEY = "booking-draft:v2";

type DraftContextValue = {
  draft: BookingDraft;
  /** False until the saved draft has been read from sessionStorage. */
  ready: boolean;
  update: (patch: Partial<BookingDraft>) => void;
  reset: () => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

function load(): BookingDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const draft: BookingDraft = { ...EMPTY_DRAFT, ...JSON.parse(raw) };
    // A day and time picked before bookings moved to India time (D30) are picked again.
    if (draft.timeZone && draft.timeZone !== SERVICE_TIME_ZONE) return { ...draft, date: null, time: null, timeZone: null };
    return draft;
  } catch {
    return EMPTY_DRAFT;
  }
}

function save(draft: BookingDraft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable (private mode); the draft just won't survive a reload.
  }
}

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after hydration
    setDraft(load());
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    save(EMPTY_DRAFT);
    setDraft(EMPTY_DRAFT);
  }, []);

  const value = useMemo(() => ({ draft, ready, update, reset }), [draft, ready, update, reset]);
  return <DraftContext value={value}>{children}</DraftContext>;
}

export function useBookingDraft(): DraftContextValue {
  const ctx = use(DraftContext);
  if (!ctx) throw new Error("useBookingDraft must be used inside BookingDraftProvider");
  return ctx;
}

/**
 * The draft with its service switched, keeping the hours and vehicle valid for
 * the new service (drivers: 4+ hours; a service with a vehicle choice starts on
 * "my own car" if the old choice isn't offered).
 */
export function withService(d: BookingDraft, serviceType: ServiceType): Partial<BookingDraft> {
  const vehicles = vehiclesFor(serviceType);
  return {
    serviceType,
    vehicle: vehicles.includes(d.vehicle) ? d.vehicle : "own",
    estimatedHours: Math.max(minHours(serviceType), d.estimatedHours),
  };
}

/**
 * True when the draft has everything needed to submit (the same schema the
 * server uses). With maps on, route services also need both points picked.
 */
export function isDraftComplete(d: BookingDraft, region: Region): boolean {
  if (MAPS_ENABLED && isRouteService(d.serviceType) && (!d.startPoint || !d.servicePoint)) return false;
  return bookingRequestSchema.safeParse({ ...d, region }).success;
}
