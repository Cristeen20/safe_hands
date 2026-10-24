import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { SERVICE_PHOTOS, servicePath } from "@/config/services";
import { Link } from "@/i18n/navigation";
import { container } from "@/components/site/container";
import {
  ArrowIcon,
  CalendarIcon,
  CardIcon,
  CompanionIcon,
  HandIcon,
  HomeIcon,
  HospitalIcon,
  MapIcon,
  ShieldIcon,
  SteeringIcon,
} from "@/components/ui/icons";
import { Photo } from "@/components/ui/photo";
import { displayHeading } from "@/components/ui/styles";

// Home: the hero, what we promise, the services as photo cards, and how it works (D18).
export default function HomePage() {
  const t = useTranslations("Home");

  const trust = [
    { icon: <ShieldIcon size={22} strokeWidth={1.9} />, label: t("trustVerified") },
    { icon: <HandIcon size={22} strokeWidth={1.9} />, label: t("trustSafe") },
    { icon: <CalendarIcon size={22} strokeWidth={1.9} />, label: t("trustAdvance") },
    { icon: <CardIcon size={22} strokeWidth={1.9} />, label: t("trustPayment") },
  ];

  return (
    <main>
      <section className={`${container} grid items-center gap-8 pt-10 pb-10 md:grid-cols-2 md:gap-12 md:pt-16 md:pb-14`}>
        <div className="flex flex-col gap-5">
          <h1 className={`${displayHeading} text-[44px] leading-[1.02] md:text-6xl`}>
            {t("heroTitle")}
            <span className="block text-primary">{t("heroTitleAccent")}</span>
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-strong md:text-xl">{t("heroBody")}</p>
          <a
            href="#services"
            className="mt-1 flex h-14 w-fit items-center gap-2 rounded-full bg-primary px-7 text-[17px] font-bold text-white no-underline hover:bg-primary-hover"
          >
            {t("heroCta")}
            <ArrowIcon size={20} strokeWidth={2.2} />
          </a>
        </div>
        <Photo
          src={SERVICE_PHOTOS.hero}
          alt={t("heroPhotoAlt")}
          icon={<HandIcon size={96} strokeWidth={1.2} />}
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="aspect-4/3 rounded-[28px]"
        />
      </section>

      <section aria-label={t("trustLabel")} className={`${container} pb-12 md:pb-16`}>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-card border border-border bg-card p-4 sm:p-5 md:grid-cols-4">
          {trust.map((item) => (
            <li key={item.label} className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                {item.icon}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      </section>

      <section id="services" className={`${container} flex scroll-mt-20 flex-col gap-2 pb-14`}>
        <h2 className={`${displayHeading} text-3xl md:text-4xl`}>{t("whatNeed")}</h2>
        <p className="text-lg text-muted-strong">{t("whatNeedSub")}</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ServiceCard
            href={servicePath("hospital_visit")}
            photo={SERVICE_PHOTOS.hospital_visit}
            icon={<HospitalIcon size={26} strokeWidth={1.8} />}
            cta="bg-primary text-white"
            title={t("hospitalTitle")}
            body={t("hospitalBody")}
            action={t("hospitalCta")}
          />
          <ServiceCard
            href={servicePath("driver")}
            photo={SERVICE_PHOTOS.driver}
            icon={<SteeringIcon size={26} strokeWidth={1.8} />}
            cta="bg-accent text-ink"
            title={t("driverTitle")}
            body={t("driverBody")}
            action={t("driverCta")}
          />
          <ServiceCard
            href={servicePath("companion")}
            photo={SERVICE_PHOTOS.companion}
            icon={<CompanionIcon size={26} strokeWidth={1.8} />}
            cta="bg-accent-soft text-ink"
            title={t("companionTitle")}
            body={t("companionBody")}
            action={t("companionCta")}
          />
          <ServiceCard
            href={servicePath("property")}
            photo={SERVICE_PHOTOS.property}
            icon={<HomeIcon size={26} strokeWidth={1.8} />}
            cta="bg-primary-soft text-primary"
            title={t("propertyTitle")}
            body={t("propertyBody")}
            action={t("propertyCta")}
          />
          <ServiceCard
            href="/tours"
            photo={SERVICE_PHOTOS.tour}
            icon={<MapIcon size={26} strokeWidth={1.8} />}
            cta="bg-primary-soft text-primary"
            title={t("toursTitle")}
            body={t("toursBody")}
            action={t("toursCta")}
          />
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-title" className={`${container} flex scroll-mt-20 flex-col gap-5 pb-16 md:pb-24`}>
        <h2 id="how-title" className={`${displayHeading} text-3xl md:text-4xl`}>
          {t("howTitle")}
        </h2>
        <ol className="grid gap-4 text-lg text-muted-strong md:grid-cols-3 md:gap-10">
          {(["step1", "step2", "step3"] as const).map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                {i + 1}
              </span>
              <span>
                <strong className="text-ink">{t(`${step}Title`)}</strong> {t(`${step}Body`)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function ServiceCard({
  href,
  photo,
  icon,
  cta,
  title,
  body,
  action,
}: {
  href: string;
  photo: string | null;
  icon: ReactNode;
  /** Colours of the call-to-action pill. */
  cta: string;
  title: string;
  body: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-card border border-border bg-card text-ink no-underline shadow-[0_2px_10px_rgba(20,32,30,0.05)] transition hover:-translate-y-0.5 hover:border-primary"
    >
      <Photo
        src={photo}
        alt=""
        icon={icon}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="aspect-16/10 [&>svg]:size-20"
      />
      <span className="relative flex flex-1 flex-col gap-1.5 px-5 pt-9 pb-5">
        <span className="absolute -top-7 left-5 flex size-14 items-center justify-center rounded-full border-4 border-card bg-primary-soft text-primary">
          {icon}
        </span>
        <span className="font-display text-2xl font-bold">{title}</span>
        <span className="flex-1 text-base leading-snug text-muted-strong">{body}</span>
        <span className={`mt-4 flex min-h-12 w-fit items-center gap-2 rounded-full px-5 text-[15px] font-bold ${cta}`}>
          {action}
          <ArrowIcon size={18} strokeWidth={2.2} className="transition-transform group-hover:translate-x-1" />
        </span>
      </span>
    </Link>
  );
}
