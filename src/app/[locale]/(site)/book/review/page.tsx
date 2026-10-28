import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { requireUser } from "@/lib/authz";
import { ReviewSummary } from "@/components/booking/review-summary";
import { container } from "@/components/site/container";

// Signing in is required to submit; a guest is sent to sign-in and back here.
async function SignedInReview() {
  const user = await requireUser({ next: "/book/review" });
  return <ReviewSummary needsEmail={!user.email} />;
}

export default function ReviewPage() {
  const tc = useTranslations("Common");
  return (
    <main className={`${container} py-6 md:py-10`}>
      <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
        <SignedInReview />
      </Suspense>
    </main>
  );
}
