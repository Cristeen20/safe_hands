import type { useTranslations } from "next-intl";

/** A length of time in hours, split into whole days, hours and minutes (to the nearest minute). */
export function durationParts(hours: number): { days: number; hours: number; minutes: number } {
  const total = Math.max(0, Math.round(hours * 60));
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
}

/** "1 day 2 hrs 15 mins", leaving out the parts that are zero ("45 mins", "3 hrs"). */
export function formatDuration(hours: number, t: ReturnType<typeof useTranslations<"Duration">>): string {
  const p = durationParts(hours);
  const parts = [
    p.days > 0 && t("day", { count: p.days }),
    p.hours > 0 && t("hour", { count: p.hours }),
    p.minutes > 0 && t("minute", { count: p.minutes }),
  ].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join(" ") : t("minute", { count: 0 });
}
