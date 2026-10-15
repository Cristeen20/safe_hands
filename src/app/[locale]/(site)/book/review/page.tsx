import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { requireUser } from "@/lib/authz";
import { ReviewSummary } from "@/components/booking/review-summary";
import { container } from "@/components/site/container";
import { BackLink } from "@/components/ui/back-link";
import { displayHeading } from "@/components/ui/styles";

// Signing in is required to submit; a guest is sent to sign-in and back here.
async function SignedInReview() {
  const user = await requireUser({ next: "/book/review" });
  return <ReviewSummary needsEmail={!user.email} />;
}

export default function ReviewPage() {
  const t = useTranslations("Review");
  const tc = useTranslations("Common");
  return (
    <main className={`${container} flex max-w-3xl flex-col gap-5 py-8 md:py-12`}>
      <BackLink href="/book" label={t("backToForm")} />
      <h1 className={`${displayHeading} text-4xl`}>{t("title")}</h1>
      <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
        <SignedInReview />
      </Suspense>
    </main>
  );
}
