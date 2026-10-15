import { useTranslations } from "next-intl";
import { BookingForm } from "@/components/booking/booking-form";
import { container } from "@/components/site/container";
import { displayHeading } from "@/components/ui/styles";

export default function BookPage() {
  const t = useTranslations("Schedule");
  return (
    <main className={`${container} flex flex-col gap-6 py-8 md:py-12`}>
      <div className="flex flex-col gap-2">
        <h1 className={`${displayHeading} text-4xl md:text-5xl`}>{t("title")}</h1>
        <p className="max-w-2xl text-lg text-muted-strong">{t("intro")}</p>
      </div>
      <BookingForm />
    </main>
  );
}
