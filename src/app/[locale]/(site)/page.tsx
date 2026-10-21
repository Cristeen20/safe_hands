import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ServiceType } from "@/domain/booking";
import { Link } from "@/i18n/navigation";
import { ServiceCardLink } from "@/components/booking/home-actions";
import { container } from "@/components/site/container";
import {
  ArrowIcon,
  CheckIcon,
  CompanionIcon,
  HandIcon,
  HomeIcon,
  HospitalIcon,
  MapIcon,
  SteeringIcon,
} from "@/components/ui/icons";
import { displayHeading } from "@/components/ui/styles";

// The calm redesign of Home: one promise, the services as tiles, and how it works (D18).
export default function HomePage() {
  const t = useTranslations("Home");

  return (
    <main>
      <section className={`${container} grid items-center gap-8 pt-12 pb-14 md:grid-cols-[minmax(0,1fr)_22rem] md:gap-14 md:pt-20 md:pb-20`}>
        <div className="flex flex-col gap-5">
          <h1 className={`${displayHeading} text-[44px] leading-[1.05] md:text-6xl`}>{t("heroTitle")}</h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-strong md:text-xl">{t("heroBody")}</p>
          {t("heroNote") && <p className="text-[15px] font-semibold text-primary">{t("heroNote")}</p>}
          <a
            href="#services"
            className="mt-1 flex h-14 w-fit items-center gap-2 rounded-full bg-primary px-7 text-[17px] font-bold text-white no-underline hover:bg-primary-hover"
          >
            {t("heroCta")}
          </a>
        </div>

        <figure className="flex flex-col gap-4 rounded-[28px] bg-accent-soft p-7">
          <span className="flex size-14 items-center justify-center rounded-full bg-card text-primary">
            <HandIcon size={28} strokeWidth={1.8} />
          </span>
          <blockquote className="font-display text-2xl leading-snug font-bold">{t("promise")}</blockquote>
          <figcaption className="flex items-center gap-2 text-[15px] font-semibold text-muted-strong">
            <CheckIcon size={18} strokeWidth={2.4} className="text-primary" />
            {t("promiseNote")}
          </figcaption>
        </figure>
      </section>

      <section id="services" className={`${container} flex scroll-mt-20 flex-col gap-5 pb-14`}>
        <h2 className={`${displayHeading} text-3xl md:text-4xl`}>{t("whatNeed")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ServiceTile
            serviceType="hospital_visit"
            tone="bg-primary-soft"
            icon={<HospitalIcon size={28} strokeWidth={1.8} />}
            title={t("hospitalTitle")}
            body={t("hospitalBody")}
            cta={t("hospitalCta")}
          />
          <ServiceTile
            serviceType="driver"
            tone="bg-accent-soft"
            icon={<SteeringIcon size={28} strokeWidth={1.8} />}
            title={t("driverTitle")}
            body={t("driverBody")}
            cta={t("driverCta")}
          />
          <ServiceTile
            serviceType="companion"
            icon={<CompanionIcon size={28} strokeWidth={1.8} />}
            title={t("companionTitle")}
            body={t("companionBody")}
            cta={t("companionCta")}
          />
          <ServiceTile
            serviceType="property"
            icon={<HomeIcon size={28} strokeWidth={1.8} />}
            title={t("propertyTitle")}
            body={t("propertyBody")}
            cta={t("propertyCta")}
          />
          <Link href="/tours" className={tileClass("bg-card")}>
            <TileBody
              icon={<MapIcon size={28} strokeWidth={1.8} />}
              title={t("toursTitle")}
              body={t("toursBody")}
              cta={t("toursCta")}
            />
          </Link>
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

const tileClass = (tone: string) =>
  `group flex min-h-60 flex-col gap-4 rounded-[28px] border-2 border-transparent p-6 text-ink no-underline shadow-[0_2px_10px_rgba(20,32,30,0.05)] transition hover:-translate-y-0.5 hover:border-primary ${tone}`;

function ServiceTile({
  serviceType,
  tone = "bg-card",
  ...body
}: { serviceType: ServiceType; tone?: string } & TileBodyProps) {
  return (
    <ServiceCardLink serviceType={serviceType} className={tileClass(tone)}>
      <TileBody {...body} />
    </ServiceCardLink>
  );
}

type TileBodyProps = { icon: ReactNode; title: string; body: string; cta: string };

function TileBody({ icon, title, body, cta }: TileBodyProps) {
  return (
    <>
      <span className="flex size-14 items-center justify-center rounded-full bg-card text-primary group-[.bg-card]:bg-primary-soft">
        {icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-display text-2xl font-bold">{title}</span>
        <span className="text-base leading-snug text-muted-strong">{body}</span>
      </span>
      <span className="mt-auto flex items-center justify-between gap-3 border-t border-ink/10 pt-3.5 text-base font-bold text-primary">
        {cta}
        <ArrowIcon size={20} strokeWidth={2.2} className="transition-transform group-hover:translate-x-1" />
      </span>
    </>
  );
}
