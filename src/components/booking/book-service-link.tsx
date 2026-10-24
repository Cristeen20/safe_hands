"use client";

import type { ReactNode } from "react";
import type { ServiceType } from "@/domain/booking";
import { Link } from "@/i18n/navigation";
import { useBookingDraft, withService } from "./draft-context";

/** Picks the service type, then opens the booking form at its first step. */
export function BookServiceLink({
  serviceType,
  className,
  children,
}: {
  serviceType: ServiceType;
  className: string;
  children: ReactNode;
}) {
  const { draft, update } = useBookingDraft();
  return (
    <Link href="/book" className={className} onClick={() => update(withService(draft, serviceType))}>
      {children}
    </Link>
  );
}
