"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { canReceiveSms, toE164 } from "@/lib/phone";
import { REGION_CONFIG, regionForLocale, type AppLocale } from "@/lib/region";
import { useHydrated } from "@/lib/use-hydrated";
import { fieldLabel, primaryButton, secondaryButton, textInput } from "@/components/ui/styles";
import { safeNext, saveFlow, type SignInMethod } from "./sign-in-flow";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations("SignIn");
  const locale = useLocale() as AppLocale;
  const region = regionForLocale(locale);
  // D20: no text messages in India, so the Indian site offers email only.
  const phoneAvailable = REGION_CONFIG[region].smsAllowed;
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const hydrated = useHydrated();
  const [method, setMethod] = useState<SignInMethod>(phoneAvailable ? "phone" : "email");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchTo(m: SignInMethod) {
    setMethod(m);
    setValue("");
    setError(null);
  }

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    let target: string;
    if (method === "phone") {
      const e164 = toE164(value, region);
      if (!e164) return setError(t("invalidPhone"));
      if (!canReceiveSms(e164)) return setError(t("noSmsForNumber"));
      target = e164;
    } else {
      target = value.trim().toLowerCase();
      if (!EMAIL.test(target)) return setError(t("invalidEmail"));
    }

    setPending(true);
    setError(null);
    const { error: sendError } =
      method === "phone"
        ? await authClient.phoneNumber.sendOtp({ phoneNumber: target })
        : await authClient.emailOtp.sendVerificationOtp({ email: target, type: "sign-in" });
    setPending(false);
    if (sendError) return setError(t("sendFailed"));
    saveFlow({ method, target, next });
    router.push("/sign-in/verify");
  }

  const isPhone = method === "phone";

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <label className={fieldLabel}>
          {isPhone ? t("phoneLabel") : t("emailLabel")}
          <input
            key={method}
            type={isPhone ? "tel" : "email"}
            inputMode={isPhone ? "tel" : "email"}
            autoComplete={isPhone ? "tel" : "email"}
            required
            placeholder={isPhone ? t("phonePlaceholder") : t("emailPlaceholder")}
            value={value}
            aria-invalid={!!error}
            aria-describedby={error ? "signin-error" : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            className={textInput}
          />
        </label>
        {error && (
          <p id="signin-error" role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending || !hydrated} className={primaryButton}>
          {pending ? t("sending") : t("continue")}
        </button>
        <p className="text-[13px] text-muted">{isPhone ? t("phoneNote") : t("emailNote")}</p>
      </form>

      {(phoneAvailable || googleEnabled) && (
        <>
          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-border-strong" />
            <span className="text-sm text-muted">{t("or")}</span>
            <div className="h-px flex-1 bg-border-strong" />
          </div>
          <div className="flex flex-col gap-2.5">
            {phoneAvailable && (
              <button
                type="button"
                className={`${secondaryButton} w-full`}
                onClick={() => switchTo(isPhone ? "email" : "phone")}
              >
                {isPhone ? t("useEmail") : t("usePhone")}
              </button>
            )}
            {googleEnabled && (
              <button
                type="button"
                className={`${secondaryButton} w-full`}
                onClick={() =>
                  authClient.signIn.social({ provider: "google", callbackURL: `/${locale}${next}` })
                }
              >
                <span
                  aria-hidden="true"
                  className="flex size-6 items-center justify-center rounded-full border-[1.5px] border-ink text-[13px] font-bold"
                >
                  G
                </span>
                {t("google")}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
