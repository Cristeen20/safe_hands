"use client";

import type { ReactNode } from "react";
import type { ServiceType } from "@/domain/booking";
import { Link } from "@/i18n/navigation";
import { useBookingDraft, withService } from "./draft-context";

/** A Home service card: picks the service type, then opens the booking form. */
export function ServiceCardLink({
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
