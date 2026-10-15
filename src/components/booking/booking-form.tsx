"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { SERVICE_TYPES, VEHICLES } from "@/domain/booking";
import type { Vehicle } from "@/domain/booking";
import { useRouter } from "@/i18n/navigation";
import { zonedToUtc } from "@/lib/time";
import { CarIcon, MinusIcon, PlusIcon, VanIcon, WalkIcon } from "@/components/ui/icons";
import { card, chip, displayHeading, primaryButton } from "@/components/ui/styles";
import { isDraftComplete, useBookingDraft } from "./draft-context";
import { ForWhomSection } from "./for-whom-section";
import { WhenSection } from "./when-section";

const VEHICLE_ICON: Record<Vehicle, typeof CarIcon> = {
  none: WalkIcon,
  small: CarIcon,
  large: VanIcon,
};

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
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

export function BookingForm() {
  const t = useTranslations("Schedule");
  const ts = useTranslations("ServiceType");
  const tv = useTranslations("Vehicle");
  const tw = useTranslations("When");
  const tf = useTranslations("ForWhom");
  const format = useFormatter();
  const router = useRouter();
  const { draft, update } = useBookingDraft();
  const [showIncomplete, setShowIncomplete] = useState(false);

  const whenLabel =
    draft.date && draft.time && draft.timeZone
      ? format.dateTime(zonedToUtc(draft.date, draft.time, draft.timeZone), {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
          timeZone: draft.timeZone,
        })
      : t("whenUnset");
  const forWhomLabel =
    draft.recipient.kind === "self"
      ? t("forMe")
      : `${draft.recipient.firstName} ${draft.recipient.lastName}`.trim() || tf("someoneElse");

  const field =
    "h-12 w-full rounded-xl border border-border-strong bg-card px-3.5 text-base font-medium text-ink outline-none placeholder:text-muted focus:border-[1.5px] focus:border-primary";

  function next() {
    if (!isDraftComplete(draft)) {
      setShowIncomplete(true);
      return;
    }
    router.push("/book/review");
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <div className="flex flex-col gap-5">
        <Section n={1} title={t("whereTitle")}>
          {t("regionNote") && (
            <p className="rounded-field bg-accent-soft px-4 py-3 text-sm font-semibold text-ink">
              {t("regionNote")}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("startLocation")}
              <input
                type="text"
                required
                maxLength={200}
                autoComplete="street-address"
                placeholder={t("addressPlaceholder")}
                value={draft.startAddress}
                onChange={(e) => update({ startAddress: e.target.value })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("serviceLocation")}
              <input
                type="text"
                required
                maxLength={200}
                placeholder={t("addressPlaceholder")}
                value={draft.serviceAddress}
                onChange={(e) => update({ serviceAddress: e.target.value })}
                className={field}
              />
            </label>
          </div>
        </Section>

        <Section n={2} title={tw("title")}>
          <WhenSection />
        </Section>

        <Section n={3} title={tf("title")}>
          <ForWhomSection />
        </Section>

        <Section n={4} title={t("describeTitle")}>
          <fieldset className="flex flex-col">
            <legend className="mb-2.5 text-sm font-semibold">{t("kindLegend")}</legend>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={draft.serviceType === type}
                  onClick={() => update({ serviceType: type })}
                  className={chip(draft.serviceType === type)}
                >
                  {ts(type)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col">
            <legend className="mb-2.5 text-sm font-semibold">{t("vehicleLegend")}</legend>
            <div className="grid gap-2 md:grid-cols-3">
              {VEHICLES.map((v) => {
                const on = draft.vehicle === v;
                const Icon = VEHICLE_ICON[v];
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ vehicle: v })}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left md:flex-col md:items-start ${
                      on ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                        on ? "bg-primary text-white" : "bg-field text-primary"
                      }`}
                    >
                      <Icon />
                    </span>
                    <span className="flex flex-col">
                      <strong className="text-[15px]">{tv(v)}</strong>
                      <span className="text-[13px] text-muted">{tv(`${v}Sub`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex flex-col">
              <strong className="text-sm">{t("hours")}</strong>
              <span className="text-[13px] text-muted">{t("hoursSub")}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t("fewerHours")}
                disabled={draft.estimatedHours <= 1}
                onClick={() => update({ estimatedHours: Math.max(1, draft.estimatedHours - 1) })}
                className="flex size-11 items-center justify-center rounded-full border border-border-strong bg-card disabled:opacity-40"
              >
                <MinusIcon size={18} />
              </button>
              <span aria-live="polite" className="min-w-16 text-center font-display text-lg font-bold">
                {t("hoursValue", { count: draft.estimatedHours })}
              </span>
              <button
                type="button"
                aria-label={t("moreHours")}
                disabled={draft.estimatedHours >= 8}
                onClick={() => update({ estimatedHours: Math.min(8, draft.estimatedHours + 1) })}
                className="flex size-11 items-center justify-center rounded-full border border-border-strong bg-card disabled:opacity-40"
              >
                <PlusIcon size={18} />
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-sm font-semibold">
              <span>{t("task")}</span>
              <span className="font-medium text-muted">{t("counter", { count: draft.description.length })}</span>
            </span>
            <textarea
              rows={4}
              maxLength={500}
              placeholder={t("taskPlaceholder")}
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              className="rounded-xl border border-border-strong bg-card p-3.5 text-base leading-snug outline-none placeholder:text-muted focus:border-primary"
            />
          </label>

          <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
            <label className="flex min-h-11 items-center gap-3 text-[15px] font-medium">
              <input
                type="checkbox"
                checked={draft.needsMobilitySupport}
                onChange={(e) => update({ needsMobilitySupport: e.target.checked })}
                className="size-5 accent-primary"
              />
              {t("mobility")}
            </label>
            <label className="flex min-h-11 items-center gap-3 text-[15px] font-medium">
              <input
                type="checkbox"
                checked={draft.needsDocuments}
                onChange={(e) => update({ needsDocuments: e.target.checked })}
                className="size-5 accent-primary"
              />
              {t("documents")}
            </label>
          </div>
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
              {ts(draft.serviceType)} · {t("hoursValue", { count: draft.estimatedHours })}
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
        {showIncomplete && !isDraftComplete(draft) && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {t("incomplete")}
          </p>
        )}
        <button type="button" onClick={next} className={primaryButton}>
          {t("continue")}
        </button>
        <p className="text-[13px] leading-snug text-muted">{t("quoteNote")}</p>
      </aside>
    </div>
  );
}
