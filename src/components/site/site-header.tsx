import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { BRAND_NAME } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/authz";
import { PlusIcon } from "@/components/ui/icons";
import { container } from "./container";
import { SignOutButton } from "./sign-out-button";

const navLink = "rounded-lg px-3 py-2.5 text-[15px] font-semibold text-ink no-underline hover:bg-field";

/** The signed-in/signed-out part of the header. Reads the session, so it streams in. */
async function AccountLinks() {
  const [user, t, tn] = await Promise.all([
    getCurrentUser(),
    getTranslations("Common"),
    getTranslations("Nav"),
  ]);
  if (!user) {
    return (
      <>
        <Link href="/sign-in" className={navLink}>
          {t("logIn")}
        </Link>
        <Link
          href="/sign-in"
          className="ml-1 rounded-full bg-ink px-4 py-2.5 text-[15px] font-semibold text-white no-underline hover:bg-ink/85"
        >
          {t("signUp")}
        </Link>
      </>
    );
  }
  return (
    <>
      {user.role === "admin" && (
        <Link href="/admin/requests" className={navLink}>
          {tn("admin")}
        </Link>
      )}
      {user.role === "helper" && (
        <Link href="/helper" className={navLink}>
          {tn("jobs")}
        </Link>
      )}
      <Link href="/activity" className={navLink}>
        {tn("activity")}
      </Link>
      <SignOutButton className={`${navLink} hidden cursor-pointer sm:block`} />
      <Link
        href="/#services"
        className="ml-1 rounded-full bg-primary px-4 py-2.5 text-[15px] font-semibold text-white no-underline hover:bg-primary-hover"
      >
        {tn("book")}
      </Link>
    </>
  );
}

export function SiteHeader() {
  const tn = useTranslations("Nav");
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className={`${container} flex h-16 items-center justify-between gap-3`}>
        <Link href="/" className="flex items-center gap-2 text-ink no-underline">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-accent">
            <PlusIcon size={18} strokeWidth={2.4} />
          </span>
          <span className="font-display text-[19px] font-bold tracking-tight">{BRAND_NAME}</span>
        </Link>
        <nav aria-label={tn("label")} className="flex items-center gap-1">
          <Link href="/#how-it-works" className={`${navLink} hidden md:block`}>
            {tn("howItWorks")}
          </Link>
          <Link href="/tours" className={`${navLink} hidden lg:block`}>
            {tn("tours")}
          </Link>
          <Suspense fallback={<span className="w-16" />}>
            <AccountLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
