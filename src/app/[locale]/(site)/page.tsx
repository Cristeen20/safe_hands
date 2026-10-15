import { useTranslations } from "next-intl";
import { QuickStartForm, ServiceCardLink } from "@/components/booking/home-actions";
import { container } from "@/components/site/container";
import { CarIcon, HandIcon, HospitalIcon } from "@/components/ui/icons";
import { displayHeading } from "@/components/ui/styles";

export default function HomePage() {
  const t = useTranslations("Home");
  const steps = [
    [t("step1Title"), t("step1Body")],
    [t("step2Title"), t("step2Body")],
    [t("step3Title"), t("step3Body")],
  ] as const;

  return (
    <main>
      <section className={`${container} grid items-center gap-10 py-12 md:py-20 lg:grid-cols-2 lg:gap-16`}>
        <div className="flex flex-col gap-5">
          <h1 className={`${displayHeading} text-5xl leading-[1.02] md:text-6xl lg:text-7xl`}>
            {t("heroTitle")}
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-strong md:text-xl">
            {t("heroBody")}
          </p>
          {t("heroNote") && <p className="text-[15px] font-semibold text-primary">{t("heroNote")}</p>}
        </div>
        <div className="w-full max-w-xl lg:justify-self-end">
          <h2 className={`${displayHeading} mb-4 text-2xl`}>{t("readyTitle")}</h2>
          <QuickStartForm />
        </div>
      </section>

      <section className={`${container} flex flex-col gap-6 py-10`}>
        <h2 className={`${displayHeading} text-3xl md:text-4xl`}>{t("whatNeed")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ServiceCardLink
            serviceType="hospital_visit"
            className="flex min-h-48 flex-col justify-between gap-6 rounded-card bg-primary p-6 text-white no-underline hover:bg-primary-hover sm:col-span-2 lg:col-span-1"
          >
            <HospitalIcon size={44} strokeWidth={1.6} className="text-accent" />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-accent">{t("mostBooked")}</span>
              <span className="font-display text-2xl font-bold">{t("hospitalTitle")}</span>
              <span className="text-[15px] text-on-primary-soft">{t("hospitalBody")}</span>
            </span>
          </ServiceCardLink>
          <ServiceCardLink
            serviceType="driver"
            className="flex min-h-48 flex-col justify-between gap-6 rounded-card border border-border bg-card p-6 text-ink no-underline hover:border-primary"
          >
            <CarIcon size={44} strokeWidth={1.6} className="text-primary" />
            <span className="flex flex-col gap-1">
              <span className="font-display text-2xl font-bold">{t("driverTitle")}</span>
              <span className="text-[15px] text-muted">{t("driverBody")}</span>
            </span>
          </ServiceCardLink>
          <ServiceCardLink
            serviceType="errand"
            className="flex min-h-48 flex-col justify-between gap-6 rounded-card bg-accent p-6 text-ink no-underline hover:brightness-95"
          >
            <HandIcon size={44} strokeWidth={1.6} />
            <span className="flex flex-col gap-1">
              <span className="font-display text-2xl font-bold">{t("anyTitle")}</span>
              <span className="text-[15px]">{t("anyBody")}</span>
            </span>
          </ServiceCardLink>
        </div>
      </section>

      <section id="how-it-works" className={`${container} flex scroll-mt-20 flex-col gap-6 py-10`}>
        <h2 className={`${displayHeading} text-3xl md:text-4xl`}>{t("howTitle")}</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="flex flex-col gap-3 rounded-card border border-border bg-card p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                {i + 1}
              </span>
              <strong className="text-lg">{title}</strong>
              <span className="leading-relaxed text-muted">{body}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
