"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  MAX_ACCOMPANYING,
  MAX_DAYS,
  MAX_HOURS,
  MIN_DRIVER_DAYS,
  hasHours,
  hasVehicle,
  isRouteService,
  isSlotBookable,
  vehiclesFor,
} from "@/domain/booking";
import type { Vehicle } from "@/domain/booking";
import { BRAND_NAME } from "@/config/brand";
import { useRouter } from "@/i18n/navigation";
import { CarIcon, CheckIcon, InfoIcon, KeyIcon, VanIcon, WalkIcon } from "@/components/ui/icons";
import { Stepper } from "@/components/ui/stepper";
import { card } from "@/components/ui/styles";
import { useBookingDraft, type BookingDraft } from "./draft-context";
import { ForWhomSection } from "./for-whom-section";
import { LocationField } from "./location-field";
import { MapsProvider } from "./maps-provider";
import { PriceSummary, RoutePreview, payableAmount, useMoney, usePriceEstimate } from "./price-estimate";
import { STEP_PATH, detailsComplete, stepsFor } from "./steps";
import { WhenSection } from "./when-section";
import { WizardStep } from "./wizard";

const VEHICLE_ICON: Record<Vehicle, typeof CarIcon> = {
  none: WalkIcon,
  own: KeyIcon,
  small: CarIcon,
  large: VanIcon,
};

export const fieldBox = "flex flex-col gap-0.5 rounded-field border bg-card px-3.5 py-3";
export const fieldInput =
  "bg-transparent p-0 text-base font-medium text-ink outline-none placeholder:text-muted";
export const checkRow = "flex min-h-14 items-center gap-3 px-3.5 text-[15px] font-semibold";

/** A titled group of fields inside a step. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[17px] font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

/** A label with a hint on the left and a control on the right. */
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="flex flex-col gap-0.5">
        <strong className="text-base">{label}</strong>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

/** The draft's own service (the tours page shares the draft but never reaches these steps). */
function useServiceDraft() {
  const { draft, update } = useBookingDraft();
  const service = draft.serviceType === "tour" ? "hospital_visit" : draft.serviceType;
  return { d: draft, service, update };
}

/** Step 1: who it's for, where, and anything we should know. */
export function DetailsStep() {
  return (
    <MapsProvider>
      <DetailsFields />
    </MapsProvider>
  );
}

function DetailsFields() {
  const t = useTranslations("Schedule");
  const tw = useTranslations("Wizard");
  const tf = useTranslations("ForWhom");
  const router = useRouter();
  const { d, service, update } = useServiceDraft();
  const [error, setError] = useState<string | null>(null);
  const route = isRouteService(service);

  function next() {
    if (!detailsComplete(d)) {
      setError(tw("incomplete.details"));
      return;
    }
    router.push(STEP_PATH.when);
  }

  return (
    <WizardStep
      step="details"
      title={tw(`detailsTitle.${service}`)}
      subtitle={tw("detailsSub")}
      next={{ label: tw("nextWhen"), onClick: next }}
      error={error}
    >
      <div className={`${card} flex flex-col gap-8 p-5 sm:p-6`}>
        <Group title={tf("title")}>
          <ForWhomSection />
        </Group>

        <Group title={tw(`whereTitle.${route ? "route" : "place"}`)}>
          {t("regionNote") && (
            <p className="rounded-field bg-accent-soft px-4 py-3 text-sm font-semibold text-ink">{t("regionNote")}</p>
          )}
          {route ? (
            <div className="flex gap-3">
              <div className="flex w-3.5 flex-col items-center py-7" aria-hidden="true">
                <div className="size-2.5 rounded-full border-[2.5px] border-ink" />
                <div className="my-1 w-0.5 flex-1 bg-border-strong" />
                <div className="size-2.5 bg-ink" />
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <LocationField
                  label={t("from")}
                  placeholder={t("addressPlaceholder")}
                  autoComplete="street-address"
                  value={{ address: d.startAddress, point: d.startPoint, notes: d.startNotes }}
                  onChange={(v) => update({ startAddress: v.address, startPoint: v.point, startNotes: v.notes })}
                />
                <LocationField
                  label={t("to")}
                  placeholder={t(`destPlaceholder.${service as "hospital_visit"}`)}
                  value={{ address: d.serviceAddress, point: d.servicePoint, notes: d.serviceNotes }}
                  onChange={(v) => update({ serviceAddress: v.address, servicePoint: v.point, serviceNotes: v.notes })}
                />
              </div>
            </div>
          ) : (
            <LocationField
              label={t(`placeLabel.${service as "property"}`)}
              placeholder={t(`placePlaceholder.${service as "property"}`)}
              autoComplete="street-address"
              value={{ address: d.serviceAddress, point: d.servicePoint, notes: d.serviceNotes }}
              onChange={(v) => update({ serviceAddress: v.address, servicePoint: v.point, serviceNotes: v.notes })}
            />
          )}
        </Group>

        <label className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between">
            <span className="text-[17px] font-bold">{t(`descLabel.${service}`)}</span>
            <span className="text-[13px] text-muted">{t("counter", { count: d.description.length })}</span>
          </span>
          <textarea
            rows={4}
            maxLength={500}
            placeholder={t(`descPlaceholder.${service}`)}
            value={d.description}
            onChange={(e) => update({ description: e.target.value })}
            className="min-h-28 rounded-field border-[1.5px] border-border-strong bg-card px-3.5 py-3 text-[15px] leading-snug outline-none placeholder:text-muted focus:border-primary"
          />
        </label>
      </div>
    </WizardStep>
  );
}

/** Step 2: the day, the start time and, for services billed by time, how long. */
export function WhenStep() {
  const t = useTranslations("Schedule");
  const tw = useTranslations("Wizard");
  const router = useRouter();
  const { d, service, update } = useServiceDraft();
  const [error, setError] = useState<string | null>(null);
  const hasOptions = stepsFor(service).includes("options");

  function next() {
    if (!d.date || !d.time || !d.timeZone || !isSlotBookable(d.date, d.time, d.timeZone, new Date())) {
      setError(tw("incomplete.when"));
      return;
    }
    router.push(hasOptions ? STEP_PATH.options : STEP_PATH.review);
  }

  return (
    <WizardStep
      step="when"
      title={tw("whenTitle")}
      subtitle={tw("whenSub")}
      next={{ label: hasOptions ? tw("nextOptions") : tw("nextReview"), onClick: next }}
      error={error}
    >
      <WhenSection />
      {hasHours(service) && (
        <section aria-label={tw("duration")} className={`${card} flex flex-col gap-3 p-5`}>
          <SettingRow label={tw("duration")} hint={t("hoursHint")}>
            <Stepper
              value={d.estimatedHours}
              min={1}
              max={MAX_HOURS}
              onChange={(estimatedHours) => update({ estimatedHours })}
              lessLabel={t("fewerHours")}
              moreLabel={t("moreHours")}
              display={t("hoursValue", { count: d.estimatedHours })}
            />
          </SettingRow>
          {service === "hospital_visit" && (
            <p className="flex items-start gap-3 rounded-field bg-primary-soft p-3.5 text-sm leading-relaxed">
              <InfoIcon size={20} strokeWidth={1.9} className="mt-px shrink-0" />
              {t("hospitalTime", { count: d.estimatedHours })}
            </p>
          )}
        </section>
      )}
    </WizardStep>
  );
}

/** "Needed for multiple days?" with a day count, for drivers and companions. */
function MultiDay({ d, update }: { d: BookingDraft; update: (patch: Partial<BookingDraft>) => void }) {
  const t = useTranslations("Schedule");
  return (
    <div className="flex flex-col rounded-field border border-border">
      <label className={`${checkRow} min-h-15`}>
        <input
          type="checkbox"
          checked={d.multiDay}
          onChange={(e) => update({ multiDay: e.target.checked })}
          className="size-5 accent-primary"
        />
        <span className="flex flex-col">
          {t("multiDay")}
          <span className="text-[13px] font-medium text-muted">
            {d.serviceType === "driver" ? t("multiDaySub") : t("multiDaySubCompanion")}
          </span>
        </span>
      </label>
      {d.multiDay && (
        <div className="flex min-h-15 items-center justify-between gap-3 border-t border-border px-3.5">
          <span className="text-[15px] font-semibold">{t("numberOfDays")}</span>
          <Stepper
            value={d.driverDays}
            min={MIN_DRIVER_DAYS}
            max={MAX_DAYS}
            onChange={(driverDays) => update({ driverDays })}
            lessLabel={t("fewerDays")}
            moreLabel={t("moreDays")}
          />
        </div>
      )}
    </div>
  );
}

/** A vehicle choice with what it would cost (D28), worked out by the server. */
function VehicleOption({ d, vehicle, onPick }: { d: BookingDraft; vehicle: Vehicle; onPick: () => void }) {
  const tv = useTranslations("Vehicle");
  const tw = useTranslations("Wizard");
  const money = useMoney();
  const estimate = usePriceEstimate({ ...d, vehicle });
  const on = d.vehicle === vehicle;
  const Icon = VEHICLE_ICON[vehicle];

  let price: string | null = null;
  if (estimate.status === "loading") price = tw("pricing");
  else if (estimate.status === "done" && estimate.result.ok && estimate.result.estimate) {
    const e = estimate.result.estimate;
    if (e.amountMinor !== null) {
      price = e.outcome === "auto" ? money(e.amountMinor, e.currency) : tw("about", { amount: money(e.amountMinor, e.currency) });
    } else price = tw("quoted");
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`relative flex min-h-36 flex-col items-start gap-1.5 rounded-card text-left ${
        on ? "border-2 border-primary bg-primary-soft/60 p-4" : "border border-border-strong bg-card p-[17px] hover:border-primary"
      }`}
    >
      {on && (
        <span className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-primary text-white">
          <CheckIcon size={14} strokeWidth={3} />
        </span>
      )}
      <span className="flex size-11 items-center justify-center rounded-full bg-card text-primary">
        <Icon size={24} strokeWidth={1.8} />
      </span>
      <strong className="text-[16px]">{tv(vehicle, { brand: BRAND_NAME })}</strong>
      <span className="text-[13px] leading-snug text-muted-strong">
        {vehicle === "large" && d.serviceType === "driver" ? tv("largeSubDriver") : tv(`${vehicle}Sub`)}
      </span>
      {price && (
        <span aria-live="polite" className="mt-auto pt-1 font-display text-xl font-bold">
          {price}
        </span>
      )}
    </button>
  );
}

/** Step 3: vehicle, extras and multi-day, with the price of the chosen options. */
export function OptionsStep() {
  return (
    <MapsProvider>
      <OptionsFields />
    </MapsProvider>
  );
}

function OptionsFields() {
  const t = useTranslations("Schedule");
  const tw = useTranslations("Wizard");
  const router = useRouter();
  const { d, service, update } = useServiceDraft();
  const estimate = usePriceEstimate(d);
  const payable = payableAmount(estimate);
  const money = useMoney();

  return (
    <WizardStep
      step="options"
      title={tw("optionsTitle")}
      subtitle={tw(`optionsSub.${service as "hospital_visit"}`)}
      next={{ label: payable ? tw("nextReviewPay") : tw("nextReview"), onClick: () => router.push(STEP_PATH.review) }}
    >
      {hasVehicle(service) && (
        <fieldset className="flex flex-col">
          <legend className="mb-3 text-[17px] font-bold">{t("vehicle")}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {vehiclesFor(service).map((v) => (
              <VehicleOption key={v} d={d} vehicle={v} onPick={() => update({ vehicle: v })} />
            ))}
          </div>
        </fieldset>
      )}

      {service === "hospital_visit" && (
        <Group title={tw("extras")}>
          <div className={`${card} flex flex-col divide-y divide-border`}>
            <div className="px-3.5 py-2.5">
              <SettingRow label={t("accompanying")} hint={t("accompanyingSub")}>
                <Stepper
                  value={d.accompanyingCount}
                  min={0}
                  max={MAX_ACCOMPANYING}
                  onChange={(accompanyingCount) => update({ accompanyingCount })}
                  lessLabel={t("fewerPeople")}
                  moreLabel={t("morePeople")}
                />
              </SettingRow>
            </div>
            <label className={`${checkRow} min-h-15`}>
              <input
                type="checkbox"
                checked={d.needsBystander}
                onChange={(e) => update({ needsBystander: e.target.checked })}
                className="size-5 accent-primary"
              />
              <span className="flex flex-col">
                {t("bystander")}
                <span className="text-[13px] font-medium text-muted-strong">{t("bystanderSub")}</span>
              </span>
            </label>
          </div>
        </Group>
      )}

      {service === "driver" && (
        <Group title={tw("extras")}>
          <label className={`${checkRow} rounded-field border border-border bg-card`}>
            <input
              type="checkbox"
              checked={d.childSeat}
              onChange={(e) => update({ childSeat: e.target.checked })}
              className="size-5 accent-primary"
            />
            {t("childSeat")}
          </label>
          <MultiDay d={d} update={update} />
        </Group>
      )}

      {service === "companion" && (
        <Group title={tw("extras")}>
          <MultiDay d={d} update={update} />
          <p className="flex items-start gap-3 rounded-field bg-accent-soft p-3.5 text-sm leading-relaxed">
            <InfoIcon size={20} strokeWidth={1.9} className="mt-px shrink-0" />
            {t("companionNote")}
          </p>
        </Group>
      )}

      <section aria-labelledby="price-title" className={`${card} flex flex-col gap-3 p-5`}>
        <h2 id="price-title" className="text-[17px] font-bold">
          {tw("priceTitle")}
        </h2>
        <RoutePreview state={estimate} />
        <PriceSummary state={estimate} />
        <p className="text-[13px] leading-snug text-muted">
          {payable ? t("payNote", { amount: money(payable.minor, payable.currency) }) : t("quoteNote")}
        </p>
      </section>
    </WizardStep>
  );
}
