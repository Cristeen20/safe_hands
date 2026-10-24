"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { DateTimeFormatOptions } from "next-intl";
import { TIME_SLOTS, bookableDays, isSlotBookable } from "@/domain/booking";
import { SERVICE_COUNTRY, SERVICE_TIME_ZONE, regionForLocale, type AppLocale } from "@/lib/region";
import { addDays, zonedToUtc } from "@/lib/time";
import { BackIcon, ChevronIcon } from "@/components/ui/icons";
import { card } from "@/components/ui/styles";
import { useBookingDraft } from "./draft-context";

/** Which weekday each site's calendar starts on (0 = Sunday). */
const FIRST_WEEKDAY: Record<AppLocale, 0 | 1> = { "en-US": 0, "en-CA": 0, "en-GB": 1, "en-IN": 0 };

const utcNoon = (date: string) => new Date(`${date}T12:00:00Z`);
const monthOf = (date: string) => date.slice(0, 7);
function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** A month calendar of the bookable days, and the start times for the chosen day. */
export function WhenSection() {
  const t = useTranslations("When");
  const format = useFormatter();
  const locale = useLocale() as AppLocale;
  const { draft, ready, update } = useBookingDraft();
  // Read once after hydration (not during prerender) so the options don't
  // shift while the customer is choosing.
  const [now, setNow] = useState<Date | null>(null);
  const [shownMonth, setShownMonth] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- current time is client-only
    setNow(new Date());
  }, []);

  if (!ready || !now) return <div className="h-96" aria-hidden="true" />;

  const timeZone = SERVICE_TIME_ZONE;
  const days = bookableDays(now, timeZone);
  const bookable = new Set(days);
  const date = draft.date && bookable.has(draft.date) ? draft.date : null;
  const time = date && draft.time && isSlotBookable(date, draft.time, timeZone, now) ? draft.time : null;
  const slotDay = date ?? days[0];
  const fmtSlot = (slot: string, opts: DateTimeFormatOptions) =>
    format.dateTime(zonedToUtc(slotDay, slot, timeZone), { ...opts, timeZone });
  const fmtDay = (d: string, opts: DateTimeFormatOptions) => format.dateTime(utcNoon(d), { ...opts, timeZone: "UTC" });

  const firstMonth = monthOf(days[0]);
  const lastMonth = monthOf(days[days.length - 1]);
  const month = shownMonth ?? monthOf(date ?? days[0]);
  const firstWeekday = FIRST_WEEKDAY[locale];
  const monthStart = `${month}-01`;
  const lead = (utcNoon(monthStart).getUTCDay() - firstWeekday + 7) % 7;
  const monthLength = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: monthLength }, (_, i) => addDays(monthStart, i)),
  ];
  // Any week of 7 consecutive days gives the weekday names in order.
  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(monthStart, i - lead));

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-field bg-primary-soft px-4 py-3 text-sm leading-snug text-primary">
        {t("leadNotice")}
        {regionForLocale(locale) !== SERVICE_COUNTRY && <> {t("indiaTime")}</>}
      </p>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className={`${card} flex flex-col gap-3 p-3 sm:p-5`}>
          <div className="flex items-center justify-between gap-2 pl-2">
            <h3 aria-live="polite" className="font-display text-lg font-bold">
              {format.dateTime(utcNoon(monthStart), { month: "long", year: "numeric", timeZone: "UTC" })}
            </h3>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label={t("prevMonth")}
                disabled={month <= firstMonth}
                onClick={() => setShownMonth(addMonths(month, -1))}
                className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-field disabled:opacity-30"
              >
                <BackIcon size={18} />
              </button>
              <button
                type="button"
                aria-label={t("nextMonth")}
                disabled={month >= lastMonth}
                onClick={() => setShownMonth(addMonths(month, 1))}
                className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-field disabled:opacity-30"
              >
                <ChevronIcon size={20} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center" aria-hidden="true">
            {weekdays.map((d) => (
              <span key={d} className="text-xs font-semibold text-muted">
                {fmtDay(d, { weekday: "short" }).slice(0, 2)}
              </span>
            ))}
          </div>
          <div role="group" aria-label={t("pickDay")} className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={`blank-${i}`} />;
              const open = bookable.has(d);
              const on = d === date;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  disabled={!open}
                  aria-label={fmtDay(d, { weekday: "long", day: "numeric", month: "long" })}
                  onClick={() => update({ date: d, timeZone })}
                  className={`mx-auto flex size-11 items-center justify-center rounded-full text-[15px] font-semibold disabled:cursor-not-allowed disabled:font-normal disabled:text-muted/60 ${
                    on ? "bg-primary font-bold text-white" : open ? "text-ink hover:bg-primary-soft" : ""
                  }`}
                >
                  {fmtDay(d, { day: "numeric" })}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`${card} flex flex-col gap-3 p-4 sm:p-5`}>
          <div>
            <h3 className="text-[15px] font-bold">{t("time")}</h3>
            <p className="text-sm text-muted">{fmtDay(slotDay, { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <div role="group" aria-label={t("time")} className="grid grid-cols-2 gap-2">
            {TIME_SLOTS.map((slot) => {
              const label = fmtSlot(slot, { hour: "numeric", minute: "2-digit" });
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
                    on ? "border-primary bg-primary font-bold text-white" : "border-border-strong bg-card text-ink hover:border-primary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
