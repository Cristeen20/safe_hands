import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import type { BookingStatus } from "@/domain/booking";
import { toMajor } from "@/domain/money";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/authz";
import { listCustomerBookings } from "@/server/queries";
import { container } from "@/components/site/container";
import { card, displayHeading, primaryButton } from "@/components/ui/styles";

const GROUPS: {
  key: "awaiting" | "upcoming" | "past";
  statuses: BookingStatus[];
}[] = [
  { key: "awaiting", statuses: ["submitted", "quoted"] },
  { key: "upcoming", statuses: ["confirmed", "assigned", "in_progress"] },
  { key: "past", statuses: ["completed", "rejected", "declined", "expired"] },
];

async function BookingList() {
  const user = await requireUser({ next: "/activity" });
  const [bookings, t, ts, tst, format] = await Promise.all([
    listCustomerBookings(user.id),
    getTranslations("Activity"),
    getTranslations("ServiceType"),
    getTranslations("Status"),
    getFormatter(),
  ]);

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted">{t("empty")}</p>
        <Link href="/book" className={`${primaryButton} w-fit`}>
          {t("bookFirst")}
        </Link>
      </div>
    );
  }

  return GROUPS.map(({ key, statuses }) => {
    const items = bookings.filter((b) => statuses.includes(b.status));
    if (items.length === 0) return null;
    return (
      <section
        key={key}
        className="flex flex-col gap-2.5"
        aria-labelledby={`group-${key}`}
      >
        <h2
          id={`group-${key}`}
          className="mt-2 text-[13px] font-bold tracking-wider text-muted uppercase"
        >
          {t(key)}
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((b) => {
            const month = format.dateTime(b.scheduledStart, {
              month: "short",
              timeZone: b.timeZone,
            });
            const day = format.dateTime(b.scheduledStart, {
              day: "numeric",
              timeZone: b.timeZone,
            });
            const time = format.dateTime(b.scheduledStart, {
              hour: "numeric",
              minute: "2-digit",
              timeZone: b.timeZone,
            });
            return (
              <li key={b.id}>
                <Link
                  href={`/activity/${b.id}`}
                  className={`${card} flex items-center gap-3.5 p-3.5 text-ink no-underline hover:border-primary`}
                >
                  <span className="flex size-13 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <span className="text-[11px] font-bold uppercase">
                      {month}
                    </span>
                    <span className="font-display text-xl leading-none font-bold">
                      {day}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <strong className="truncate text-base">
                      {b.serviceAddress}
                    </strong>
                    <span className="text-sm text-muted">
                      {ts(b.serviceType)} · {time}
                    </span>
                    <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-ink">
                      {tst(b.status)}
                    </span>
                  </span>
                  {b.status === "submitted" && (
                    <span className="shrink-0 text-right text-xs font-semibold text-muted">
                      {t("awaitingQuote")}
                    </span>
                  )}
                  {b.quoteAmountMinor !== null && b.quoteCurrency && (
                    <strong className="shrink-0 text-right text-base">
                      {format.number(toMajor(b.quoteAmountMinor), {
                        style: "currency",
                        currency: b.quoteCurrency,
                      })}
                    </strong>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  });
}

export default function ActivityPage() {
  const t = useTranslations("Activity");
  const tc = useTranslations("Common");
  return (
    <main className={`${container} flex flex-col gap-4 py-8 md:py-12`}>
      <h1 className={`${displayHeading} text-4xl`}>{t("title")}</h1>
      <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
        <BookingList />
      </Suspense>
    </main>
  );
}
