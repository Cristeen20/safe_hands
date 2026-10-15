"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { quoteBooking, rejectBooking, type AdminActionResult } from "@/server/admin";
import { card, fieldLabel, primaryButton, secondaryButton } from "@/components/ui/styles";

const input =
  "h-12 w-full rounded-xl border border-border-strong bg-card px-3.5 text-base text-ink outline-none focus:border-[1.5px] focus:border-primary";

/**
 * D4/D22/D23: the admin's two choices for a submitted request. `expiryPreview`
 * is null when the booking starts too soon to quote (it must be rejected).
 */
export function RequestActions({
  bookingId,
  currency,
  currencySymbol,
  expiryPreview,
}: {
  bookingId: string;
  currency: string;
  currencySymbol: string;
  expiryPreview: string | null;
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const run = (
    action: () => Promise<AdminActionResult>,
    setError: (msg: string | null) => void,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setError(t(`errors.${result.error}`));
      router.refresh();
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form
        className={`${card} flex flex-col gap-4 p-6`}
        aria-labelledby="quote-title"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          run(
            () => quoteBooking(locale, bookingId, String(data.get("amount") ?? ""), String(data.get("note") ?? "")),
            setQuoteError,
          );
        }}
      >
        <h2 id="quote-title" className="font-display text-xl font-bold">
          {t("quoteTitle")}
        </h2>
        {expiryPreview ? (
          <>
            <label className={fieldLabel}>
              {t("amountLabel", { currency })}
              <span className="flex items-center rounded-xl border border-border-strong bg-card focus-within:border-[1.5px] focus-within:border-primary">
                <span className="pl-3.5 text-muted" aria-hidden="true">
                  {currencySymbol}
                </span>
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  autoComplete="off"
                  className="h-12 w-full rounded-xl bg-transparent px-2 text-base text-ink outline-none"
                />
              </span>
            </label>
            <label className={fieldLabel}>
              {t("noteLabel")}
              <textarea name="note" rows={3} maxLength={500} className={`${input} h-auto py-2.5`} />
            </label>
            <p className="text-sm text-muted">{t("expiresPreview", { date: expiryPreview })}</p>
            {quoteError && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {quoteError}
              </p>
            )}
            <button type="submit" disabled={pending} className={`${primaryButton} sm:w-fit sm:px-8`}>
              {pending ? t("saving") : t("sendQuote")}
            </button>
          </>
        ) : (
          <p className="text-sm font-semibold text-red-700">{t("errors.tooSoon")}</p>
        )}
      </form>

      <form
        className={`${card} flex flex-col gap-4 p-6`}
        aria-labelledby="reject-title"
        onSubmit={(e) => {
          e.preventDefault();
          const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
          run(() => rejectBooking(locale, bookingId, reason), setRejectError);
        }}
      >
        <h2 id="reject-title" className="font-display text-xl font-bold">
          {t("rejectTitle")}
        </h2>
        <label className={fieldLabel}>
          {t("reasonLabel")}
          <textarea name="reason" rows={4} required maxLength={500} className={`${input} h-auto py-2.5`} />
        </label>
        {rejectError && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {rejectError}
          </p>
        )}
        <button type="submit" disabled={pending} className={`${secondaryButton} sm:w-fit`}>
          {pending ? t("saving") : t("rejectButton")}
        </button>
      </form>
    </div>
  );
}
