import { Suspense } from "react";
import { connection } from "next/server";
import { useTranslations } from "next-intl";
import { getFormatter, getLocale } from "next-intl/server";
import { STAY_LOCATIONS, TOUR_PACKAGES } from "@/config/tours";
import { meetsMinLeadTime } from "@/domain/booking";
import { regionForLocale, type AppLocale } from "@/lib/region";
import { zonedToUtc } from "@/lib/time";
import { tourPartyCounts } from "@/server/queries";
import { ToursForm, type PackageOption } from "@/components/booking/tours-form";
import { container } from "@/components/site/container";
import { displayHeading } from "@/components/ui/styles";

/** This region's packages that can still be booked (D17), with their pre-booked counts. */
async function Tours() {
  await connection();
  const [locale, format] = await Promise.all([getLocale(), getFormatter()]);
  const region = regionForLocale(locale as AppLocale);
  const now = new Date();
  const open = TOUR_PACKAGES.filter(
    (p) =>
      p.region === region &&
      meetsMinLeadTime(zonedToUtc(p.departs.date, p.departs.time, p.departs.timeZone), now),
  );
  const counts = await tourPartyCounts(open.map((p) => p.id));
  const packages: PackageOption[] = open.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    days: p.days,
    nights: p.nights,
    departs: format.dateTime(zonedToUtc(p.departs.date, p.departs.time, p.departs.timeZone), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: p.departs.timeZone,
    }),
    preBooked: counts[p.id] ?? 0,
  }));
  return <ToursForm packages={packages} stays={[...STAY_LOCATIONS[region]]} />;
}

export default function ToursPage() {
  const t = useTranslations("Tours");
  const tc = useTranslations("Common");
  return (
    <main className={`${container} flex max-w-3xl flex-col gap-6 py-8 md:py-12`}>
      <h1 className={`${displayHeading} text-4xl md:text-5xl`}>{t("title")}</h1>
      <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
        <Tours />
      </Suspense>
    </main>
  );
}
