"use client";

import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("Common");
  const locale = useLocale();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await authClient.signOut();
        // Full page load so nothing rendered for the signed-in user is reused.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/${locale}`);
      }}
    >
      {t("signOut")}
    </button>
  );
}
