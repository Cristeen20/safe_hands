"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useHydrated } from "@/lib/use-hydrated";
import { declineQuote, startPayment } from "@/server/bookings";
import { primaryButton, secondaryButton } from "@/components/ui/styles";
import { openRazorpayCheckout } from "./razorpay-checkout";

/** D8/D13: accept and pay, or decline, a quoted booking. */
export function QuoteActions({ bookingId, amountLabel }: { bookingId: string; amountLabel: string }) {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await startPayment(locale, bookingId);
      if (!result.ok) return setError(t(`errors.${result.error}`));
      const { start } = result;
      if (start.kind === "redirect") {
        // Stripe Checkout (external) or the dev test page: a full navigation.
        window.location.assign(start.url);
        return;
      }
      const outcome = await openRazorpayCheckout(locale, bookingId, start);
      if (outcome === "failed") setError(t("errors.verifyFailed"));
      router.refresh();
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      const result = await declineQuote(locale, bookingId);
      if (!result.ok) return setError(t(`errors.${result.error}`));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      {confirmingDecline ? (
        <div role="group" aria-label={t("decline")} className="flex flex-col gap-3 rounded-xl bg-field p-4">
          <p className="text-[15px] font-semibold">{t("declineConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={decline} disabled={pending} className={secondaryButton}>
              {t("declineYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDecline(false)}
              disabled={pending}
              className={secondaryButton}
            >
              {t("declineNo")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={accept} disabled={pending || !hydrated} className={`${primaryButton} sm:w-fit sm:px-8`}>
            {pending ? t("paying") : t("accept", { amount: amountLabel })}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDecline(true)}
            disabled={pending || !hydrated}
            className={secondaryButton}
          >
            {t("decline")}
          </button>
        </div>
      )}
    </div>
  );
}
