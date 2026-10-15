"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ServiceType, Vehicle } from "@/domain/booking";

/**
 * The booking a customer is building. It lives in the browser until they sign
 * in and submit it, so a guest can fill it in first. The server re-validates
 * everything on submit; nothing here is trusted.
 */
export type BookingDraft = {
  serviceType: ServiceType;
  startAddress: string;
  serviceAddress: string;
  date: string | null;
  time: string | null;
  timeZone: string | null;
  estimatedHours: number;
  vehicle: Vehicle;
  description: string;
  needsMobilitySupport: boolean;
  needsDocuments: boolean;
  recipient:
    | { kind: "self" }
    | { kind: "other"; firstName: string; lastName: string; phone: string };
};

export const EMPTY_DRAFT: BookingDraft = {
  serviceType: "hospital_visit",
  startAddress: "",
  serviceAddress: "",
  date: null,
  time: null,
  timeZone: null,
  estimatedHours: 2,
  vehicle: "small",
  description: "",
  needsMobilitySupport: false,
  needsDocuments: false,
  recipient: { kind: "self" },
};

const STORAGE_KEY = "booking-draft:v1";

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
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT;
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

/** True when the draft has everything needed to submit. */
export function isDraftComplete(d: BookingDraft): boolean {
  return Boolean(
    d.startAddress.trim() &&
      d.serviceAddress.trim() &&
      d.date &&
      d.time &&
      d.timeZone &&
      (d.recipient.kind === "self" || (d.recipient.firstName.trim() && d.recipient.phone.trim())),
  );
}
