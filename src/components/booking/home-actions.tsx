"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ServiceType } from "@/domain/booking";
import { Link, useRouter } from "@/i18n/navigation";
import { ArrowIcon, ClockIcon } from "@/components/ui/icons";
import { primaryButton } from "@/components/ui/styles";
import { useHydrated } from "@/lib/use-hydrated";
import { useBookingDraft } from "./draft-context";

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
  const { update } = useBookingDraft();
  return (
    <Link href="/book" className={className} onClick={() => update({ serviceType })}>
      {children}
    </Link>
  );
}

/** The "Ready to go?" quick form on Home. */
export function QuickStartForm() {
  const t = useTranslations("Home");
  const router = useRouter();
  const { draft, update } = useBookingDraft();
  const hydrated = useHydrated();

  return (
    <form
      className="flex flex-col gap-3 rounded-[22px] bg-card p-4 shadow-[0_1px_2px_rgba(20,32,30,0.06),0_8px_24px_rgba(20,32,30,0.06)]"
      onSubmit={(e) => {
        e.preventDefault();
        router.push("/book");
      }}
    >
      <p className="flex items-center gap-2 self-start rounded-full bg-primary-soft px-3.5 py-2.5 text-sm font-semibold text-primary">
        <ClockIcon size={16} />
        {t("scheduledChip")}
      </p>
      <div className="flex items-stretch gap-3">
        <div className="flex w-3.5 flex-col items-center py-5" aria-hidden="true">
          <div className="size-2.5 rounded-full border-[2.5px] border-ink" />
          <div className="my-1 w-0.5 flex-1 bg-border-strong" />
          <div className="size-2.5 bg-ink" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className="flex flex-col gap-0.5 rounded-field bg-field px-3.5 py-2.5">
            <span className="text-xs font-semibold text-muted">{t("pickup")}</span>
            <input
              type="text"
              autoComplete="street-address"
              placeholder={t("pickupPlaceholder")}
              value={draft.startAddress}
              onChange={(e) => update({ startAddress: e.target.value })}
              className="bg-transparent p-0 text-base font-medium text-ink outline-none placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-0.5 rounded-field bg-field px-3.5 py-2.5">
            <span className="text-xs font-semibold text-muted">{t("destination")}</span>
            <input
              type="text"
              placeholder={t("destinationPlaceholder")}
              value={draft.serviceAddress}
              onChange={(e) => update({ serviceAddress: e.target.value })}
              className="bg-transparent p-0 text-base font-medium text-ink outline-none placeholder:text-muted"
            />
          </label>
        </div>
      </div>
      <button type="submit" disabled={!hydrated} className={`${primaryButton} h-13 text-base`}>
        {t("requestQuote")}
        <ArrowIcon size={18} />
      </button>
    </form>
  );
}
