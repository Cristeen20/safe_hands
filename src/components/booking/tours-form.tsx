"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MAX_DAYS, MAX_PARTY_SIZE, TOUR_KINDS, type TourKind } from "@/domain/booking";
import type { TourPackage } from "@/config/tours";
import { useRouter } from "@/i18n/navigation";
import { regionForLocale, type AppLocale } from "@/lib/region";
import { CheckIcon, ChevronIcon, GroupIcon } from "@/components/ui/icons";
import { Stepper } from "@/components/ui/stepper";
import { card, primaryButton } from "@/components/ui/styles";
import { checkRow, fieldBox, fieldInput, SettingRow } from "./booking-form";
import { isDraftComplete, useBookingDraft, type BookingDraft } from "./draft-context";
import { WhenSection } from "./when-section";

export type PackageOption = Pick<TourPackage, "id" | "name" | "kind" | "days" | "nights"> & {
  /** Departure date, already formatted in the package's time zone. */
  departs: string;
  preBooked: number;
};

/** Canvas "Guided tours": packages to pre-book, staycations and custom trips. */
export function ToursForm({ packages, stays }: { packages: PackageOption[]; stays: string[] }) {
  const t = useTranslations("Tours");
  const router = useRouter();
  const region = regionForLocale(useLocale() as AppLocale);
  const { draft, ready, update } = useBookingDraft();
  const [showIncomplete, setShowIncomplete] = useState(false);

  if (!ready) return <div className="h-96" aria-hidden="true" />;

  const kind = draft.tourKind;
  // Fall back to the first offered package or stay so something is always picked.
  const tourPackage = packages.some((p) => p.id === draft.tourPackage) ? draft.tourPackage : (packages[0]?.id ?? "");
  const stayLocation = stays.includes(draft.stayLocation) ? draft.stayLocation : (stays[0] ?? "");
  const tour: BookingDraft = { ...draft, serviceType: "tour", tourPackage, stayLocation };
  const complete = isDraftComplete(tour, region);

  function next() {
    update({ serviceType: "tour", tourPackage, stayLocation });
    if (!complete) {
      setShowIncomplete(true);
      return;
    }
    router.push("/book/review");
  }

  const setKind = (tourKind: TourKind) => {
    setShowIncomplete(false);
    update({ tourKind });
  };

  const counters = (
    <div className={`${card} flex flex-col divide-y divide-border px-4`}>
      {kind !== "package" && (
        <div className="py-2.5">
          <SettingRow label={t("days")}>
            <Stepper
              value={draft.days}
              min={1}
              max={MAX_DAYS}
              onChange={(days) => update({ days })}
              lessLabel={t("fewerDays")}
              moreLabel={t("moreDays")}
            />
          </SettingRow>
        </div>
      )}
      <div className="py-2.5">
        <SettingRow label={t("people")} hint={t("peopleSub")}>
          <Stepper
            value={draft.partySize}
            min={1}
            max={MAX_PARTY_SIZE}
            onChange={(partySize) => update({ partySize })}
            lessLabel={t("fewerPeople")}
            moreLabel={t("morePeople")}
          />
        </SettingRow>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg leading-relaxed text-muted-strong">{t(`intro.${kind}`)}</p>

      <div role="group" aria-label={t("tabsLabel")} className="grid grid-cols-3 gap-1 rounded-field bg-field p-1">
        {TOUR_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`h-12 rounded-[11px] text-sm sm:text-[15px] ${
              kind === k
                ? "bg-card font-bold text-ink shadow-[0_1px_2px_rgba(20,32,30,0.12)]"
                : "font-semibold text-muted-strong hover:text-ink"
            }`}
          >
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>

      {kind === "package" && (
        <fieldset className="flex flex-col">
          <legend className="mb-2.5 text-lg font-bold">{t("packagesLegend")}</legend>
          {packages.length === 0 ? (
            <p className="text-muted">{t("noPackages")}</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {packages.map((p) => {
                const on = p.id === tourPackage;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ tourPackage: p.id })}
                    className={`flex flex-col gap-2.5 rounded-[18px] text-left ${
                      on ? "border-2 border-primary bg-primary-soft p-[15px]" : "border border-border-strong bg-card p-4 hover:border-primary"
                    }`}
                  >
                    <span className="flex w-full items-start gap-2.5">
                      <span className="flex flex-1 flex-col gap-0.5">
                        <strong className="font-display text-lg leading-tight font-bold">{p.name}</strong>
                        <span className="text-sm text-muted-strong">
                          {t(`kind.${p.kind}`)} · {t("length", { days: p.days, nights: p.nights })}
                        </span>
                        <span className="text-sm text-muted-strong">{t("departs", { date: p.departs })}</span>
                      </span>
                      {on ? (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                          <CheckIcon size={13} strokeWidth={3.2} />
                        </span>
                      ) : (
                        <span className="size-6 shrink-0 rounded-full border-2 border-border-strong" />
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[13px] font-bold ${
                        on ? "bg-card text-primary" : "bg-field text-muted-strong"
                      }`}
                    >
                      <GroupIcon size={14} strokeWidth={2.2} />
                      {t("preBooked", { count: p.preBooked })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      {kind === "stay" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stay-location" className="text-lg font-bold">
            {t("stayLabel")}
          </label>
          <span className="text-[13px] text-muted">{t("staySub")}</span>
          {stays.length === 0 ? (
            <p className="mt-1 text-muted">{t("noStays")}</p>
          ) : (
            <div className="relative mt-1">
              <select
                id="stay-location"
                value={stayLocation}
                onChange={(e) => update({ stayLocation: e.target.value })}
                className="h-14 w-full cursor-pointer appearance-none rounded-field border-[1.5px] border-primary bg-card pr-11 pl-3.5 text-base font-semibold text-ink outline-none"
              >
                {stays.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <ChevronIcon
                size={18}
                strokeWidth={2.2}
                className="pointer-events-none absolute top-[19px] right-4 rotate-90"
              />
            </div>
          )}
        </div>
      )}

      {kind === "custom" && (
        <label className={`${fieldBox} border-[1.5px] border-primary`}>
          <span className="text-xs font-semibold text-primary">{t("location")}</span>
          <input
            type="text"
            maxLength={200}
            placeholder={t("locationPlaceholder")}
            value={draft.tourLocation}
            onChange={(e) => update({ tourLocation: e.target.value })}
            className={fieldInput}
          />
        </label>
      )}

      {counters}

      {kind !== "package" && (
        <div className={`${card} flex flex-col divide-y divide-border`}>
          <label className={checkRow}>
            <input
              type="checkbox"
              checked={draft.includeFood}
              onChange={(e) => update({ includeFood: e.target.checked })}
              className="size-5 accent-primary"
            />
            {kind === "stay" ? t("includeFood") : t("provideFood")}
          </label>
          {kind === "custom" && (
            <label className={checkRow}>
              <input
                type="checkbox"
                checked={draft.needsStay}
                onChange={(e) => update({ needsStay: e.target.checked })}
                className="size-5 accent-primary"
              />
              {t("needStay")}
            </label>
          )}
        </div>
      )}

      {kind === "custom" && (
        <label className="flex flex-col gap-2">
          <span className="text-lg font-bold">{t("description")}</span>
          <textarea
            rows={4}
            maxLength={500}
            placeholder={t("descriptionPlaceholder")}
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            className="min-h-28 rounded-field border-[1.5px] border-primary bg-card px-3.5 py-3 text-[15px] leading-snug outline-none placeholder:text-muted"
          />
        </label>
      )}

      {kind !== "package" && (
        <section aria-labelledby="tour-when" className={`${card} flex flex-col gap-5 p-5 sm:p-6`}>
          <h2 id="tour-when" className="font-display text-xl font-bold">
            {t("whenTitle")}
          </h2>
          <WhenSection />
        </section>
      )}

      <div className="flex flex-col gap-3">
        {showIncomplete && !complete && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {t("incomplete")}
          </p>
        )}
        <button type="button" onClick={next} className={`${primaryButton} sm:w-fit sm:px-10`}>
          {kind === "package"
            ? t("preBook", { count: draft.partySize })
            : kind === "stay"
              ? t("checkAvailability")
              : t("discussQuote")}
        </button>
        <p className="text-[13px] leading-snug text-muted">{t("quoteNote")}</p>
      </div>
    </div>
  );
}
