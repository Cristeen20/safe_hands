"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { DateTimeFormatOptions } from "next-intl";
import { TIME_SLOTS, bookableDays, isSlotBookable } from "@/domain/booking";
import { guessTimeZone, regionForLocale, type AppLocale } from "@/lib/region";
import { zonedToUtc } from "@/lib/time";
import { useBookingDraft } from "./draft-context";

/** Day and time pickers, inline in the booking form. */
export function WhenSection() {
  const t = useTranslations("When");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const { draft, ready, update } = useBookingDraft();
  // Read once after hydration (not during prerender) so the options don't
  // shift while the customer is choosing.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- current time is client-only
    setNow(new Date());
  }, []);

  if (!ready || !now) return <div className="h-64" aria-hidden="true" />;

  const timeZone = draft.timeZone ?? guessTimeZone(regionForLocale(locale));
  const days = bookableDays(now, timeZone);
  const date = draft.date && days.includes(draft.date) ? draft.date : null;
  const time = date && draft.time && isSlotBookable(date, draft.time, timeZone, now) ? draft.time : null;
  const fmt = (d: string, slot: string, opts: DateTimeFormatOptions) =>
    format.dateTime(zonedToUtc(d, slot, timeZone), { ...opts, timeZone });
  const slotDay = date ?? days[0];

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-field bg-primary-soft px-4 py-3 text-sm leading-snug text-primary">
        {t("leadNotice")}
      </p>

      <div className="flex flex-col gap-3">
        <h3 className="text-[15px] font-bold">{t("pickDay")}</h3>
        <div role="group" aria-label={t("pickDay")} className="grid grid-cols-5 gap-2 sm:max-w-lg">
          {days.map((d) => {
            const on = d === date;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={fmt(d, "12:00", { weekday: "long", day: "numeric", month: "long" })}
                onClick={() => update({ date: d, timeZone })}
                className={`flex h-18 flex-col items-center justify-center gap-0.5 rounded-xl border ${
                  on ? "border-primary bg-primary text-white" : "border-border bg-card text-ink hover:border-primary"
                }`}
              >
                <span className="text-xs font-semibold uppercase">{fmt(d, "12:00", { weekday: "short" })}</span>
                <span className="font-display text-xl font-bold">{fmt(d, "12:00", { day: "numeric" })}</span>
                <span className="text-[11px] font-semibold">{fmt(d, "12:00", { month: "short" })}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-[15px] font-bold">{t("time")}</h3>
        <div role="group" aria-label={t("time")} className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {TIME_SLOTS.map((slot) => {
            const label = fmt(slotDay, slot, { hour: "numeric", minute: "2-digit" });
            const available = isSlotBookable(slotDay, slot, timeZone, now);
            const on = slot === time;
            return (
              <button
                key={slot}
                type="button"
                aria-pressed={on}
                disabled={!available}
                aria-label={available ? label : t("unavailable", { time: label })}
                onClick={() => update({ date: slotDay, time: slot, timeZone })}
                className={`h-11 rounded-xl border text-sm font-semibold disabled:cursor-not-allowed disabled:border-border disabled:bg-field disabled:text-muted disabled:line-through ${
                  on ? "border-accent bg-accent font-bold text-ink" : "border-border bg-card text-ink hover:border-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
