import { useTranslations } from "next-intl";
import { BRAND_NAME } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { QuickStartForm, ServiceCardLink } from "@/components/booking/home-actions";
import { container } from "@/components/site/container";
import {
  CameraIcon,
  ChevronIcon,
  CompanionIcon,
  GiftIcon,
  HomeIcon,
  HospitalIcon,
  MapIcon,
  SteeringIcon,
} from "@/components/ui/icons";
import { displayHeading } from "@/components/ui/styles";

// Content and order follow the canvas "Home" artboard, laid out as a website (D18).
export default function HomePage() {
  const t = useTranslations("Home");
  const steps = [
    [t("step1Title"), t("step1Body")],
    [t("step2Title"), t("step2Body")],
    [t("step3Title"), t("step3Body")],
  ] as const;
  const tile = "rounded-[20px] p-4 no-underline sm:p-5";
  const outlined = "border border-border bg-card text-ink hover:border-primary";

  return (
    <main>
      <section className={`${container} flex flex-col gap-3.5 pt-10 pb-5 md:pt-16`}>
        <h1 className={`${displayHeading} text-[44px] leading-[1.02] md:text-6xl lg:text-7xl`}>
          {t("heroTitle")}
        </h1>
        <p className="max-w-xl text-base leading-normal text-muted-strong md:text-xl">{t("heroBody")}</p>
        {t("heroNote") && <p className="text-[15px] font-semibold text-primary">{t("heroNote")}</p>}
      </section>

      <section className={`${container} flex flex-col gap-4 pt-3 pb-7`}>
        <h2 className={`${displayHeading} text-[26px] md:text-4xl`}>{t("whatNeed")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ServiceCardLink
            serviceType="hospital_visit"
            className={`${tile} col-span-2 flex min-h-33 items-end justify-between gap-4 bg-primary text-white hover:bg-primary-hover`}
          >
            <span className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-accent">{t("mostBooked")}</span>
              <span className="font-display text-[22px] font-bold">{t("hospitalTitle")}</span>
              <span className="text-sm text-on-primary-soft">{t("hospitalBody")}</span>
            </span>
            <HospitalIcon size={56} strokeWidth={1.6} className="shrink-0 text-accent" />
          </ServiceCardLink>
          <ServiceCardLink
            serviceType="driver"
            className={`${tile} ${outlined} flex min-h-39 flex-col justify-between gap-5`}
          >
            <SteeringIcon size={32} strokeWidth={1.8} className="text-primary" />
            <span className="flex flex-col gap-1">
              <span className="font-display text-lg leading-tight font-bold">{t("driverTitle")}</span>
              <span className="text-[13px] text-muted">{t("driverBody")}</span>
            </span>
          </ServiceCardLink>
          <ServiceCardLink
            serviceType="companion"
            className={`${tile} flex min-h-39 flex-col justify-between gap-5 bg-accent text-ink hover:brightness-95`}
          >
            <CompanionIcon size={32} strokeWidth={1.8} />
            <span className="flex flex-col gap-1">
              <span className="font-display text-lg leading-tight font-bold">{t("companionTitle")}</span>
              <span className="text-[13px] text-ink/80">{t("companionBody")}</span>
            </span>
          </ServiceCardLink>
          <Link
            href="/tours"
            className={`${tile} ${outlined} col-span-2 flex min-h-24 items-center gap-3.5 lg:self-start`}
          >
            <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <MapIcon size={28} strokeWidth={1.8} />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-display text-[19px] font-bold">{t("toursTitle")}</span>
              <span className="text-sm text-muted">{t("toursBody")}</span>
            </span>
            <ChevronIcon size={20} />
          </Link>

          <details open className="group col-span-2 self-start overflow-hidden rounded-[20px] border border-border bg-card">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3.5 px-4.5 py-3 text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
              <HomeIcon size={24} strokeWidth={1.9} className="text-primary" />
              <span className="flex flex-1 flex-col">
                <strong className="text-base">{t("propertyTitle")}</strong>
                <span className="text-[13px] text-muted">{t("propertyBody")}</span>
              </span>
              <ChevronIcon size={18} strokeWidth={2.2} className="rotate-90 transition-transform group-open:-rotate-90" />
            </summary>
            <div className="flex flex-col gap-3 px-4.5 pb-4.5 sm:px-5">
              <p className="text-sm leading-normal text-muted-strong">{t("propertyMore")}</p>
              <ServiceCardLink
                serviceType="property"
                className="flex h-11 items-center self-start rounded-full bg-primary-soft px-4 text-sm font-bold text-primary no-underline hover:brightness-95"
              >
                {t("propertyCta")}
              </ServiceCardLink>
            </div>
          </details>

          <div className="col-span-2 flex flex-col gap-2.5">
            <span className="text-[13px] font-bold tracking-[0.6px] text-muted uppercase">{t("special")}</span>
            <div className="flex gap-2">
              <ServiceCardLink
                serviceType="gift"
                className={`${outlined} flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold no-underline`}
              >
                <GiftIcon size={20} strokeWidth={1.9} className="text-primary" />
                {t("giftTitle")}
              </ServiceCardLink>
              <ServiceCardLink
                serviceType="camera"
                className={`${outlined} flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold no-underline`}
              >
                <CameraIcon size={20} strokeWidth={1.9} className="text-primary" />
                {t("cameraTitle")}
              </ServiceCardLink>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className={`${container} flex scroll-mt-20 flex-col gap-4 pt-3 pb-7`}>
        <h2 className={`${displayHeading} text-[26px] md:text-4xl`}>{t("howTitle", { brand: BRAND_NAME })}</h2>
        <ol className="grid gap-2.5 md:grid-cols-3 md:gap-4">
          {steps.map(([title, body], i) => (
            <li
              key={title}
              className="flex items-start gap-3.5 rounded-[18px] border border-border bg-card p-4 md:flex-col md:p-6"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                {i + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <strong className="text-base">{title}</strong>
                <span className="text-sm leading-snug text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${container} flex flex-col gap-3.5 pt-3 pb-10 md:pb-16`}>
        <h2 className={`${displayHeading} text-[26px] md:text-4xl`}>{t("readyTitle")}</h2>
        <div className="w-full max-w-xl">
          <QuickStartForm />
        </div>
      </section>
    </main>
  );
}
