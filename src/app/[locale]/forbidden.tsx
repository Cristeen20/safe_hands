import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { displayHeading, primaryButton } from "@/components/ui/styles";

export default function Forbidden() {
  const t = useTranslations("Forbidden");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-6 px-4">
      <h1 className={`${displayHeading} text-[28px]`}>{t("title")}</h1>
      <Link href="/" className={`${primaryButton} w-fit`}>
        {t("home")}
      </Link>
    </main>
  );
}
