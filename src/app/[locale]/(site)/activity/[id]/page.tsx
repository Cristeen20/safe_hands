import { Suspense } from "react";
import { useTranslations, type DateTimeFormatOptions } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { bookingReference } from "@/domain/booking";
import { toMajor } from "@/domain/money";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/authz";
import { formatPhone } from "@/lib/phone";
import { getCustomerBooking } from "@/server/queries";
import { placeLabel, serviceDetails } from "@/components/booking/service-details";
import { ConfirmingRefresh } from "@/components/booking/confirming-refresh";
import { CopyButton } from "@/components/booking/copy-button";
import { EstimateDetails } from "@/components/booking/price-estimate";
import { QuoteActions } from "@/components/booking/quote-actions";
import { container } from "@/components/site/container";
import { BackLink } from "@/components/ui/back-link";
import { BellIcon, CheckIcon, ListIcon, MailIcon, PersonIcon } from "@/components/ui/icons";
import { card, displayHeading, primaryButton, secondaryButton } from "@/components/ui/styles";

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
  const [t, ts, tv, td, tst, format] = await Promise.all([
    getTranslations("Booking"),
    getTranslations("ServiceType"),
    getTranslations("Vehicle"),
    getTranslations("Details"),
    getTranslations("Status"),
    getFormatter(),
  ]);
  const row = await getCustomerBooking(user.id, id);
  if (!row) return <p>{t("notFound")}</p>;

  const { booking: b, recipient: r, quote: q } = row;
  const inZone = (d: Date, opts: DateTimeFormatOptions) => format.dateTime(d, { ...opts, timeZone: b.timeZone });
  const amount = q ? format.number(toMajor(q.amountMinor), { style: "currency", currency: q.currency }) : null;
  const returnedFromPayment = Boolean(search.session_id || search.paid);
  const reference = bookingReference(b);
  const justPaid = b.status === "confirmed" && returnedFromPayment;
  // The confirmation has the page's h1 when it's shown.
  const Title = justPaid ? "h2" : "h1";

  return (
    <div className="flex flex-col gap-5">
      {justPaid && (
        <Confirmation service={ts(b.serviceType)} reference={reference} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Title className={`${displayHeading} text-3xl md:text-4xl`}>{b.serviceAddress}</Title>
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
          {!q.issuedBy && b.priceEstimate && (
            <details className="rounded-xl bg-field p-4">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">{t("breakdown")}</summary>
              <EstimateDetails estimate={b.priceEstimate} />
            </details>
          )}
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

      {b.status === "confirmed" && !justPaid && (
        <section className={`${card} flex flex-col gap-2 border-success p-6`}>
          <h2 className="font-display text-xl font-bold">{t("confirmedTitle")}</h2>
          <p>{t("confirmedBody")}</p>
          {amount && <p className="text-muted">{amount}</p>}
        </section>
      )}

      {b.status === "declined" && <p className="text-muted-strong">{t("declinedBody")}</p>}
      {b.status === "expired" && <p className="text-muted-strong">{t("expiredBody")}</p>}

      <section id="details" aria-labelledby="details-title" className={`${card} scroll-mt-24 p-6`}>
        <h2 id="details-title" className="mb-3 font-display text-xl font-bold">
          {t("details")}
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,9rem)_1fr]">
          <dt className="text-sm font-semibold text-muted">{t("reference")}</dt>
          <dd className="font-mono tracking-wide">{reference}</dd>
          <dt className="text-sm font-semibold text-muted">{t("service")}</dt>
          <dd>
            {[ts(b.serviceType), ...serviceDetails(b, td, tv)].join(" · ")}
          </dd>
          <dt className="text-sm font-semibold text-muted">{t("when")}</dt>
          <dd>{inZone(b.scheduledStart, { dateStyle: "full", timeStyle: "short" })}</dd>
          <dt className="text-sm font-semibold text-muted">{t("where")}</dt>
          <dd>{placeLabel(b)}</dd>
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

/** D24: shown when the customer comes back from a successful payment. */
async function Confirmation({ service, reference }: { service: string; reference: string }) {
  const t = await getTranslations("Booking");
  const steps = [
    { icon: PersonIcon, text: t("next.assign") },
    { icon: MailIcon, text: t("next.details") },
    { icon: BellIcon, text: t("next.updates") },
    { icon: ListIcon, text: t("next.manage") },
  ];
  return (
    <section aria-labelledby="confirmed-title" className={`${card} flex flex-col items-center gap-5 p-6 text-center sm:p-10`}>
      <span className="flex size-18 items-center justify-center rounded-full bg-success text-white">
        <CheckIcon size={40} strokeWidth={2.6} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 id="confirmed-title" className={`${displayHeading} text-3xl md:text-4xl`}>
          {t("confirmedHeading")}
        </h1>
        <p className="text-lg text-muted-strong">{t("confirmedLead", { service: service.toLowerCase() })}</p>
      </div>
      <div className="flex w-full max-w-sm items-center justify-between gap-3 rounded-field bg-primary-soft px-4 py-3 text-left">
        <div>
          <p className="text-sm text-muted-strong">{t("reference")}</p>
          <p className="font-mono text-lg font-bold tracking-wide">{reference}</p>
        </div>
        <CopyButton text={reference} label={t("copyReference")} />
      </div>
      <p className="text-[15px] text-muted-strong">{t("emailSent")}</p>
      <div className="flex w-full max-w-sm flex-col gap-2.5">
        <a href="#details" className={primaryButton}>
          {t("viewDetails")}
        </a>
        <Link href="/" className={secondaryButton}>
          {t("goHome")}
        </Link>
      </div>
      <div className="flex w-full max-w-md flex-col gap-3 border-t border-border pt-5 text-left">
        <h2 className="text-[17px] font-bold">{t("whatsNext")}</h2>
        <ul className="flex flex-col gap-3">
          {steps.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-[15px]">
              <Icon size={20} strokeWidth={1.9} className="mt-0.5 shrink-0 text-primary" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </section>
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
