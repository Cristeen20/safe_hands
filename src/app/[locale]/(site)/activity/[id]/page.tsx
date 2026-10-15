import { Suspense } from "react";
import { useTranslations, type DateTimeFormatOptions } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { toMajor } from "@/domain/money";
import { requireUser } from "@/lib/authz";
import { formatPhone } from "@/lib/phone";
import { getCustomerBooking } from "@/server/queries";
import { ConfirmingRefresh } from "@/components/booking/confirming-refresh";
import { QuoteActions } from "@/components/booking/quote-actions";
import { container } from "@/components/site/container";
import { BackLink } from "@/components/ui/back-link";
import { card, displayHeading } from "@/components/ui/styles";

type Search = { session_id?: string; paid?: string };

async function BookingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const user = await requireUser({ next: `/activity/${id}` });
  const search = await searchParams;
  const [t, ts, tst, format] = await Promise.all([
    getTranslations("Booking"),
    getTranslations("ServiceType"),
    getTranslations("Status"),
    getFormatter(),
  ]);
  const row = await getCustomerBooking(user.id, id);
  if (!row) return <p>{t("notFound")}</p>;

  const { booking: b, recipient: r, quote: q } = row;
  const inZone = (d: Date, opts: DateTimeFormatOptions) => format.dateTime(d, { ...opts, timeZone: b.timeZone });
  const amount = q ? format.number(toMajor(q.amountMinor), { style: "currency", currency: q.currency }) : null;
  const returnedFromPayment = Boolean(search.session_id || search.paid);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={`${displayHeading} text-3xl md:text-4xl`}>{b.serviceAddress}</h1>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-bold">{tst(b.status)}</span>
      </div>

      {b.status === "submitted" && <p className="text-lg text-muted-strong">{t("awaiting")}</p>}

      {b.status === "quoted" && q && amount && (
        <section aria-labelledby="quote-title" className={`${card} flex flex-col gap-4 border-primary p-6`}>
          <h2 id="quote-title" className="font-display text-xl font-bold">
            {t("quoteTitle")}
          </h2>
          <p className="font-display text-4xl font-bold">{amount}</p>
          <p className="text-muted">
            {t("validUntil", { date: inZone(q.expiresAt, { dateStyle: "full", timeStyle: "short" }) })}
          </p>
          {q.note && <p className="whitespace-pre-line">{q.note}</p>}
          {returnedFromPayment ? (
            <>
              <p role="status" className="font-semibold text-primary">
                {t("confirming")}
              </p>
              <ConfirmingRefresh />
            </>
          ) : (
            <QuoteActions bookingId={b.id} amountLabel={amount} />
          )}
        </section>
      )}

      {b.status === "rejected" && (
        <section className={`${card} flex flex-col gap-2 p-6`}>
          <h2 className="font-display text-xl font-bold">{t("rejectedTitle")}</h2>
          <p>
            <strong>{t("reason")}:</strong> {b.rejectionReason}
          </p>
        </section>
      )}

      {b.status === "confirmed" && (
        <section className={`${card} flex flex-col gap-2 border-success p-6`}>
          <h2 className="font-display text-xl font-bold">{t("confirmedTitle")}</h2>
          <p>{t("confirmedBody")}</p>
          {amount && <p className="text-muted">{amount}</p>}
        </section>
      )}

      {b.status === "declined" && <p className="text-muted-strong">{t("declinedBody")}</p>}
      {b.status === "expired" && <p className="text-muted-strong">{t("expiredBody")}</p>}

      <section aria-labelledby="details-title" className={`${card} p-6`}>
        <h2 id="details-title" className="mb-3 font-display text-xl font-bold">
          {t("details")}
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,9rem)_1fr]">
          <dt className="text-sm font-semibold text-muted">{t("service")}</dt>
          <dd>
            {ts(b.serviceType)} · {t("hours", { count: b.estimatedHours })}
          </dd>
          <dt className="text-sm font-semibold text-muted">{t("when")}</dt>
          <dd>{inZone(b.scheduledStart, { dateStyle: "full", timeStyle: "short" })}</dd>
          <dt className="text-sm font-semibold text-muted">{t("where")}</dt>
          <dd>
            {b.startAddress} → {b.serviceAddress}
          </dd>
          <dt className="text-sm font-semibold text-muted">{t("forWhom")}</dt>
          <dd>
            {r.isSelf
              ? t("you")
              : `${r.firstName} ${r.lastName}`.trim() + (r.phoneE164 ? ` · ${formatPhone(r.phoneE164)}` : "")}
          </dd>
        </dl>
      </section>
    </div>
  );
}

export default function BookingPage({ params, searchParams }: PageProps<"/[locale]/activity/[id]">) {
  const t = useTranslations("Booking");
  const tc = useTranslations("Common");
  return (
    <main className={`${container} flex max-w-4xl flex-col gap-5 py-8 md:py-12`}>
      <BackLink href="/activity" label={t("backToList")} />
      <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
        <BookingDetail params={params} searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </main>
  );
}
