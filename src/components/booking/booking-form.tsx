"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  MAX_ACCOMPANYING,
  MAX_DAYS,
  MAX_HOURS,
  MIN_DRIVER_DAYS,
  hasHours,
  hasVehicle,
  isRouteService,
  minHours,
  vehiclesFor,
} from "@/domain/booking";
import type { Vehicle } from "@/domain/booking";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { REGION_CONFIG, regionForLocale, type AppLocale, type Region } from "@/lib/region";
import { zonedToUtc } from "@/lib/time";
import { CarIcon, InfoIcon, KeyIcon, VanIcon, WalkIcon } from "@/components/ui/icons";
import { Stepper } from "@/components/ui/stepper";
import { card, displayHeading, primaryButton } from "@/components/ui/styles";
import { isDraftComplete, useBookingDraft, withService, type BookingDraft } from "./draft-context";
import { ForWhomSection } from "./for-whom-section";
import { LocationField } from "./location-field";
import { MapsProvider } from "./maps-provider";
import { PriceSummary, RoutePreview, payableAmount, useMoney, usePriceEstimate } from "./price-estimate";
import { WhenSection } from "./when-section";

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

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = `step-${n}`;
  return (
    <section aria-labelledby={id} className={`${card} flex flex-col gap-5 p-5 sm:p-6`}>
      <h2 id={id} className="flex items-center gap-3 font-display text-xl font-bold">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[15px] text-primary">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
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

export function BookingForm() {
  return (
    <MapsProvider>
      <BookingFormFields />
    </MapsProvider>
  );
}

function BookingFormFields() {
  const t = useTranslations("Schedule");
  const ts = useTranslations("ServiceType");
  const tv = useTranslations("Vehicle");
  const td = useTranslations("Details");
  const tw = useTranslations("When");
  const tf = useTranslations("ForWhom");
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const region = regionForLocale(useLocale() as AppLocale);
  const { draft, update } = useBookingDraft();
  const [showIncomplete, setShowIncomplete] = useState(false);

  // The tours page shares the draft; /book always offers one of its own services.
  const d = draft.serviceType === "tour" ? { ...draft, ...withService(draft, "hospital_visit") } : draft;
  const service = d.serviceType === "tour" ? "hospital_visit" : d.serviceType;
  const route = isRouteService(service);
  const estimate = usePriceEstimate(d);
  const payable = payableAmount(estimate);
  const money = useMoney();

  const whenLabel =
    d.date && d.time && d.timeZone
      ? format.dateTime(zonedToUtc(d.date, d.time, d.timeZone), {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
          timeZone: d.timeZone,
        })
      : t("whenUnset");
  const forWhomLabel =
    d.recipient.kind === "self"
      ? t("forMe")
      : `${d.recipient.firstName} ${d.recipient.lastName}`.trim() || tf("someoneElse");

  // A place in another of our markets moves the booking to that country's site.
  // The day and time were in the old site's time zone, so they're picked again.
  function switchCountry(market: Region) {
    update({ date: null, time: null, timeZone: null });
    router.replace(pathname, { locale: REGION_CONFIG[market].locale });
  }

  function next() {
    if (draft.serviceType === "tour") update(withService(draft, service));
    if (!isDraftComplete(d, region)) {
      setShowIncomplete(true);
      return;
    }
    router.push("/book/review");
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <div className="flex flex-col gap-5">
        <div className={`${card} flex flex-col gap-3 p-5 sm:p-6`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-2xl font-bold">{ts(service)}</h2>
            <Link href="/#services" className="flex min-h-11 items-center text-[15px] font-bold text-primary">
              {t("changeService")}
            </Link>
          </div>
          {service === "driver" && <p className="text-[15px] leading-relaxed text-muted-strong">{t("driverIntro")}</p>}
          {service === "hospital_visit" && (
            <p className="flex items-start gap-3 rounded-field bg-primary-soft p-3.5 text-sm leading-relaxed">
              <InfoIcon size={20} strokeWidth={1.9} className="mt-px shrink-0" />
              {t("hospitalTime", { count: d.estimatedHours })}
            </p>
          )}
        </div>

        <Section n={1} title={t("whereTitle")}>
          {t("regionNote") && (
            <p className="rounded-field bg-accent-soft px-4 py-3 text-sm font-semibold text-ink">
              {t("regionNote")}
            </p>
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
                  onOtherCountry={switchCountry}
                  label={t("from")}
                  placeholder={t("addressPlaceholder")}
                  autoComplete="street-address"
                  value={{ address: d.startAddress, point: d.startPoint, notes: d.startNotes }}
                  onChange={(v) => update({ startAddress: v.address, startPoint: v.point, startNotes: v.notes })}
                />
                <LocationField
                  onOtherCountry={switchCountry}
                  label={t("to")}
                  placeholder={t(`destPlaceholder.${service}`)}
                  value={{ address: d.serviceAddress, point: d.servicePoint, notes: d.serviceNotes }}
                  onChange={(v) => update({ serviceAddress: v.address, servicePoint: v.point, serviceNotes: v.notes })}
                />
              </div>
            </div>
          ) : (
            <LocationField
              onOtherCountry={switchCountry}
              label={t(`placeLabel.${service}`)}
              placeholder={t(`placePlaceholder.${service}`)}
              autoComplete="street-address"
              value={{ address: d.serviceAddress, point: d.servicePoint, notes: d.serviceNotes }}
              onChange={(v) => update({ serviceAddress: v.address, servicePoint: v.point, serviceNotes: v.notes })}
            />
          )}
        </Section>

        <Section n={2} title={tw("title")}>
          <WhenSection />
        </Section>

        <Section n={3} title={tf("title")}>
          <ForWhomSection />
        </Section>

        <Section n={4} title={t("describeTitle")}>
          {hasHours(service) && (
            <SettingRow
              label={t("hours")}
              hint={service === "driver" ? t("hoursHintDriver", { count: minHours("driver") }) : t("hoursHint")}
            >
              <Stepper
                value={d.estimatedHours}
                min={minHours(service)}
                max={MAX_HOURS}
                onChange={(estimatedHours) => update({ estimatedHours })}
                lessLabel={t("fewerHours")}
                moreLabel={t("moreHours")}
                display={t("hoursValue", { count: d.estimatedHours })}
              />
            </SettingRow>
          )}

          {hasVehicle(service) && (
            <fieldset className="flex flex-col">
              <legend className="mb-2.5 text-base font-bold">{t("vehicle")}</legend>
              <div className="grid grid-cols-3 gap-2">
                {vehiclesFor(service).map((v) => {
                  const on = d.vehicle === v;
                  const Icon = VEHICLE_ICON[v];
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update({ vehicle: v })}
                      className={`flex min-h-31 flex-col items-start gap-1.5 rounded-2xl text-left disabled:opacity-50 ${
                        on
                          ? "border-2 border-primary bg-primary-soft p-3"
                          : "border border-border-strong bg-card p-[13px] hover:border-primary"
                      }`}
                    >
                      <Icon size={28} strokeWidth={1.8} className={on ? "text-primary" : "text-ink"} />
                      <strong className="text-sm">{tv(v)}</strong>
                      <span className="text-xs leading-snug text-muted">
                        {v === "large" && service === "driver" ? tv("largeSubDriver") : tv(`${v}Sub`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {service === "hospital_visit" && (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-border px-3.5 py-2">
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
              <label className={`${checkRow} min-h-15 rounded-field bg-accent-soft`}>
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
          )}

          {service === "driver" && (
            <div className="flex flex-col gap-3">
              <label className={`${checkRow} rounded-field border border-border`}>
                <input
                  type="checkbox"
                  checked={d.childSeat}
                  onChange={(e) => update({ childSeat: e.target.checked })}
                  className="size-5 accent-primary"
                />
                {t("childSeat")}
              </label>
              <MultiDay d={d} update={update} />
            </div>
          )}

          {service === "companion" && (
            <>
              <MultiDay d={d} update={update} />
              <p className="flex items-start gap-3 rounded-field bg-accent-soft p-3.5 text-sm leading-relaxed">
                <InfoIcon size={20} strokeWidth={1.9} className="mt-px shrink-0" />
                {t("companionNote")}
              </p>
            </>
          )}

          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between">
              <span className="text-base font-bold">{t(`descLabel.${service}`)}</span>
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
        </Section>
      </div>

      <aside aria-labelledby="summary-title" className={`${card} flex flex-col gap-4 p-5 sm:p-6 lg:sticky lg:top-24`}>
        <h2 id="summary-title" className={`${displayHeading} text-xl`}>
          {t("summaryTitle")}
        </h2>
        <dl className="flex flex-col gap-3 text-[15px]">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t("service")}</dt>
            <dd className="font-medium">
              {ts(service)}
              {hasHours(service) && ` · ${td("hours", { count: d.estimatedHours })}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t("when")}</dt>
            <dd className="font-medium">{whenLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{t("forWhom")}</dt>
            <dd className="font-medium">{forWhomLabel}</dd>
          </div>
        </dl>
        <RoutePreview state={estimate} />
        <PriceSummary state={estimate} />
        {showIncomplete && !isDraftComplete(d, region) && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {t("incomplete")}
          </p>
        )}
        <button type="button" onClick={next} className={primaryButton}>
          {t(`cta.${service}`)}
        </button>
        <p className="text-[13px] leading-snug text-muted">
          {payable ? t("payNote", { amount: money(payable.minor, payable.currency) }) : t("quoteNote")}
        </p>
      </aside>
    </div>
  );
}
