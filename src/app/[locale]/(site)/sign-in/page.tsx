import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { SignInForm } from "@/components/auth/sign-in-form";
import { container } from "@/components/site/container";
import { card, displayHeading } from "@/components/ui/styles";

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export default function SignInPage() {
  const t = useTranslations("SignIn");
  return (
    <main className={`${container} flex justify-center py-10 md:py-16`}>
      <div className={`${card} flex w-full max-w-md flex-col p-6 sm:p-8`}>
        <p className="mb-1.5 text-sm font-bold tracking-wider text-primary uppercase">{t("eyebrow")}</p>
        <h1 className={`${displayHeading} mb-6 text-3xl leading-tight`}>{t("title")}</h1>
        <Suspense>
          <SignInForm googleEnabled={googleEnabled} />
        </Suspense>
        <p className="mt-6 text-[13px] leading-normal text-muted">{t("terms")}</p>
      </div>
    </main>
  );
}
