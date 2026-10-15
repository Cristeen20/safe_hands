import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { getFormatter } from "next-intl/server";
import { db } from "@/db";
import { booking, payment } from "@/db/schema";
import { toMajor } from "@/domain/money";
import { requireUser } from "@/lib/authz";
import { devProviderAllowed } from "@/server/payments/provider";
import { DevPayButtons } from "@/components/booking/dev-pay-buttons";
import { container } from "@/components/site/container";
import { card, displayHeading } from "@/components/ui/styles";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The dev payment provider's stand-in checkout (never in production). */
async function DevCheckout({ params }: { params: Promise<{ paymentId: string }> }) {
  if (!devProviderAllowed()) notFound();
  const { paymentId } = await params;
  if (!UUID.test(paymentId)) notFound();
  const user = await requireUser();
  const format = await getFormatter();
  const [row] = await db
    .select({ payment, customerId: booking.customerId })
    .from(payment)
    .innerJoin(booking, eq(booking.id, payment.bookingId))
    .where(eq(payment.id, paymentId))
    .limit(1);
  if (!row || row.customerId !== user.id || row.payment.provider !== "dev") notFound();

  return (
    <>
      <p className="font-display text-4xl font-bold">
        {format.number(toMajor(row.payment.amountMinor), { style: "currency", currency: row.payment.currency })}
      </p>
      <DevPayButtons paymentId={paymentId} bookingId={row.payment.bookingId} />
    </>
  );
}

export default function DevPayPage({ params }: PageProps<"/[locale]/pay/dev/[paymentId]">) {
  const t = useTranslations("DevPay");
  const tc = useTranslations("Common");
  return (
    <main className={`${container} flex justify-center py-10 md:py-16`}>
      <div className={`${card} flex w-full max-w-md flex-col gap-5 border-dashed p-6 sm:p-8`}>
        <h1 className={`${displayHeading} text-3xl`}>{t("title")}</h1>
        <p className="text-muted-strong">{t("body")}</p>
        <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
          <DevCheckout params={params} />
        </Suspense>
      </div>
    </main>
  );
}
