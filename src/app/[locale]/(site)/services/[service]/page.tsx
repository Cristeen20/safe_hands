import { Suspense } from "react";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BOOK_SERVICES } from "@/domain/booking";
import { SERVICE_PHOTOS, SERVICE_SLUGS, serviceFromSlug, type BookService } from "@/config/services";
import { BookServiceLink } from "@/components/booking/book-service-link";
import { container } from "@/components/site/container";
import { BackLink } from "@/components/ui/back-link";
import {
  ArrowIcon,
  BellIcon,
  CalendarIcon,
  CameraIcon,
  CarIcon,
  CheckIcon,
  ClockIcon,
  CompanionIcon,
  GiftIcon,
  HandIcon,
  HomeIcon,
  HospitalIcon,
  KeyIcon,
  ListIcon,
  ShieldIcon,
  SteeringIcon,
} from "@/components/ui/icons";
import { Photo } from "@/components/ui/photo";
import { card, displayHeading, primaryButton } from "@/components/ui/styles";

type Feature = "trained" | "travel" | "onTime" | "updates" | "verified" | "yourCar" | "errands" | "keys" | "reports" | "ideas" | "delivered" | "events" | "photos";

const ICON: Record<Feature, typeof CheckIcon> = {
  trained: CompanionIcon,
  travel: CarIcon,
  onTime: ClockIcon,
  updates: BellIcon,
  verified: ShieldIcon,
  yourCar: KeyIcon,
  errands: ListIcon,
  keys: KeyIcon,
  reports: ListIcon,
  ideas: GiftIcon,
  delivered: HandIcon,
  events: CalendarIcon,
  photos: CameraIcon,
};

const FEATURES: Record<BookService, Feature[]> = {
  hospital_visit: ["trained", "travel", "onTime", "updates"],
  driver: ["verified", "yourCar", "travel", "onTime"],
  companion: ["trained", "errands", "onTime", "updates"],
  property: ["verified", "keys", "reports", "updates"],
  gift: ["ideas", "delivered", "photos", "onTime"],
  camera: ["events", "photos", "verified", "onTime"],
};

const SERVICE_ICON: Record<BookService, typeof CheckIcon> = {
  hospital_visit: HospitalIcon,
  driver: SteeringIcon,
  companion: CompanionIcon,
  property: HomeIcon,
  gift: GiftIcon,
  camera: CameraIcon,
};

const FAQS = ["notice", "someoneElse", "payment", "where", "helpers"] as const;

export function generateStaticParams() {
  return BOOK_SERVICES.map((s) => ({ service: SERVICE_SLUGS[s] }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/services/[service]">) {
  const service = serviceFromSlug((await params).service);
  if (!service) return {};
  const ts = await getTranslations("ServiceType");
  return { title: ts(service) };
}

/** A service's own page: what it is, what's included, how it's priced, then book it. */
export default function ServicePage({ params }: PageProps<"/[locale]/services/[service]">) {
  return (
    <main className={`${container} flex flex-col gap-8 py-6 md:py-10`}>
      <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
        <ServiceContent params={params} />
      </Suspense>
    </main>
  );
}

async function ServiceContent({ params }: { params: Promise<{ service: string }> }) {
  const service = serviceFromSlug((await params).service);
  if (!service) notFound();
  const [t, ts] = await Promise.all([getTranslations("ServicePage"), getTranslations("ServiceType")]);
  const name = ts(service);
  const Icon = SERVICE_ICON[service];
  const included = t.raw(`${service}.included`) as string[];

  const book = (
    <BookServiceLink serviceType={service} className={primaryButton}>
      {t(`${service}.cta`)}
      <ArrowIcon size={20} strokeWidth={2.2} />
    </BookServiceLink>
  );

  return (
    <>
      <BackLink href="/#services" label={t("backToServices")} />

      <section className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
        <div className="flex flex-col gap-4 md:order-1">
          <h1 className={`${displayHeading} text-4xl md:text-5xl`}>{name}</h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-strong">{t(`${service}.intro`)}</p>
          <div className="mt-2 md:max-w-sm">{book}</div>
        </div>
        <Photo
          src={SERVICE_PHOTOS[service]}
          alt={t(`${service}.photoAlt`)}
          icon={<Icon size={96} strokeWidth={1.2} />}
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="aspect-16/10 rounded-[28px] md:order-2"
        />
      </section>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FEATURES[service].map((f) => {
          const FeatureIcon = ICON[f];
          return (
            <li key={f} className="flex flex-col items-center gap-2 rounded-card bg-card p-4 text-center text-[15px] font-semibold">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <FeatureIcon size={24} strokeWidth={1.8} />
              </span>
              {t(`feature.${f}`)}
            </li>
          );
        })}
      </ul>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-8">
          <nav aria-label={t("onThisPage")} className="sticky top-16 z-10 -mx-4 border-b border-border bg-surface/95 px-4 backdrop-blur sm:mx-0 sm:px-0">
            <ul className="flex gap-1 overflow-x-auto">
              {(["overview", "included", "pricing", "faqs"] as const).map((id) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="flex min-h-12 items-center px-3 text-[15px] font-semibold whitespace-nowrap text-muted-strong no-underline hover:text-primary"
                  >
                    {t(`tab.${id}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <Section id="overview" title={t("aboutTitle")}>
            <p className="text-[17px] leading-relaxed text-muted-strong">{t(`${service}.about`)}</p>
          </Section>

          <Section id="included" title={t("tab.included")}>
            <ul className={`${card} flex flex-col gap-3 bg-primary-soft/50 p-5`}>
              {included.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[16px]">
                  <CheckIcon size={20} strokeWidth={2.4} className="mt-0.5 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="pricing" title={t("tab.pricing")}>
            <p className="text-[17px] leading-relaxed text-muted-strong">{t(`${service}.pricing`)}</p>
            <p className="text-[15px] text-muted">{t("pricingNote")}</p>
          </Section>

          <Section id="faqs" title={t("tab.faqs")}>
            <div className="flex flex-col gap-2">
              {FAQS.map((q) => (
                <details key={q} className={`${card} group px-5`}>
                  <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 text-[16px] font-bold">
                    {t(`faq.${q}.q`)}
                    <ArrowIcon size={18} className="shrink-0 rotate-90 transition-transform group-open:-rotate-90" />
                  </summary>
                  <p className="pb-4 text-[15px] leading-relaxed text-muted-strong">{t(`faq.${q}.a`)}</p>
                </details>
              ))}
            </div>
          </Section>
        </div>

        <aside className={`${card} flex flex-col gap-4 p-5 lg:sticky lg:top-24`}>
          <h2 className={`${displayHeading} text-xl`}>{t("readyTitle")}</h2>
          <p className="text-[15px] leading-relaxed text-muted-strong">{t("readyBody")}</p>
          {book}
        </aside>
      </div>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-32 flex-col gap-3">
      <h2 id={`${id}-title`} className={`${displayHeading} text-2xl`}>
        {title}
      </h2>
      {children}
    </section>
  );
}
