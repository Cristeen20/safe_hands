"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useHydrated } from "@/lib/use-hydrated";
import { completeDevPayment } from "@/server/dev-payments";
import { primaryButton, secondaryButton } from "@/components/ui/styles";

export function DevPayButtons({ paymentId, bookingId }: { paymentId: string; bookingId: string }) {
  const t = useTranslations("DevPay");
  const locale = useLocale();
  const hydrated = useHydrated();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const finish = (outcome: "succeeded" | "failed") =>
    startTransition(async () => {
      await completeDevPayment(locale, paymentId, outcome);
      // Same return URL shape as Stripe's success_url.
      router.push(`/activity/${bookingId}${outcome === "succeeded" ? "?paid=1" : ""}`);
    });

  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" disabled={pending || !hydrated} onClick={() => finish("succeeded")} className={primaryButton}>
        {t("succeed")}
      </button>
      <button type="button" disabled={pending || !hydrated} onClick={() => finish("failed")} className={secondaryButton}>
        {t("fail")}
      </button>
    </div>
  );
}
