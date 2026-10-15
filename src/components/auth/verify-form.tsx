"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { formatPhone } from "@/lib/phone";
import { ArrowIcon, BackIcon } from "@/components/ui/icons";
import { displayHeading, primaryButton, secondaryButton } from "@/components/ui/styles";
import { clearFlow, loadFlow, type SignInFlow } from "./sign-in-flow";

const LENGTH = 4;
const RESEND_SECONDS = 30;

export function VerifyForm() {
  const t = useTranslations("Verify");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const [flow, setFlow] = useState<SignInFlow | null | undefined>(undefined);
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after hydration
    setFlow(loadFlow());
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  if (flow === undefined) return null;
  if (flow === null) {
    return (
      <div className="flex flex-col gap-4">
        <p>{t("missingFlow")}</p>
        <Link href="/sign-in" className={primaryButton}>
          {tc("back")}
        </Link>
      </div>
    );
  }
  const { method, target, next } = flow;

  async function verify(code: string) {
    setPending(true);
    setError(null);
    const { error: verifyError } =
      method === "phone"
        ? await authClient.phoneNumber.verify({ phoneNumber: target, code })
        : await authClient.signIn.emailOtp({ email: target, otp: code });
    if (verifyError) {
      setPending(false);
      setError(t("invalid"));
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
      return;
    }
    clearFlow();
    // Full page load: the session cookie just changed, so nothing rendered
    // for the signed-out visitor (cached redirects included) may be reused.
    window.location.replace(`/${locale}${next}`);
  }

  function setDigit(i: number, value: string) {
    const clean = value.replace(/\D/g, "");
    const nextDigits = [...digits];
    if (clean.length > 1) {
      // Pasted or autofilled code: spread it across the boxes.
      clean
        .slice(0, LENGTH - i)
        .split("")
        .forEach((d, j) => (nextDigits[i + j] = d));
    } else {
      nextDigits[i] = clean;
    }
    setDigits(nextDigits);
    setError(null);
    const firstEmpty = nextDigits.findIndex((d) => !d);
    if (firstEmpty === -1) {
      void verify(nextDigits.join(""));
    } else if (clean) {
      inputs.current[Math.min(firstEmpty, LENGTH - 1)]?.focus();
    }
  }

  async function resend() {
    setWait(RESEND_SECONDS);
    if (method === "phone") await authClient.phoneNumber.sendOtp({ phoneNumber: target });
    else await authClient.emailOtp.sendVerificationOtp({ email: target, type: "sign-in" });
  }

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (digits.every(Boolean)) void verify(digits.join(""));
      }}
    >
      <h1 className={`${displayHeading} mb-2.5 text-3xl leading-tight`}>
        {method === "phone" ? t("titlePhone") : t("titleEmail")}
      </h1>
      <p className="mb-7 text-base leading-snug text-muted-strong">
        {t.rich("body", {
          target: method === "phone" ? formatPhone(target) : target,
          strong: (c) => <strong className="text-ink">{c}</strong>,
        })}
      </p>

      <fieldset>
        <legend className="sr-only">{t("codeLegend")}</legend>
        <div className="grid grid-cols-4 gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={i === 0 ? LENGTH : 1}
              aria-label={t("digit", { n: i + 1 })}
              value={d}
              disabled={pending}
              autoFocus={i === 0}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !d && i > 0) inputs.current[i - 1]?.focus();
              }}
              className="h-16 rounded-button border-[1.5px] border-border-strong bg-card text-center font-display text-3xl font-bold outline-none focus:border-2 focus:border-primary focus:shadow-[0_0_0_4px_var(--color-primary-soft)]"
            />
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-4 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <p className="mt-5 text-[15px] text-muted">
        {t("notReceived")}{" "}
        <button
          type="button"
          disabled={wait > 0}
          onClick={resend}
          className="px-1 py-3 font-bold text-primary disabled:text-muted"
        >
          {wait > 0 ? t("resendIn", { seconds: String(wait).padStart(2, "0") }) : t("resend")}
        </button>
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link href="/sign-in" className={secondaryButton}>
          <BackIcon size={18} />
          {tc("back")}
        </Link>
        <button
          type="submit"
          disabled={pending || !digits.every(Boolean)}
          className={`${primaryButton} flex-1`}
        >
          {pending ? t("verifying") : t("verify")}
          <ArrowIcon size={18} />
        </button>
      </div>
    </form>
  );
}
