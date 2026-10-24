import { BOOK_SERVICES, type ServiceType } from "@/domain/booking";

export type BookService = (typeof BOOK_SERVICES)[number];

/** The URL of each service's page: /services/<slug>. */
export const SERVICE_SLUGS: Record<BookService, string> = {
  hospital_visit: "hospital-visit",
  driver: "driver",
  companion: "companion",
  property: "property",
  gift: "surprise-gift",
  camera: "camera-man",
};

export function serviceFromSlug(slug: string): BookService | null {
  return BOOK_SERVICES.find((s) => SERVICE_SLUGS[s] === slug) ?? null;
}

export function servicePath(service: BookService): string {
  return `/services/${SERVICE_SLUGS[service]}`;
}

/**
 * Photos for the service cards and pages, as paths under /public (e.g.
 * "/photos/hospital-visit.jpg"). Null shows a tinted placeholder until real
 * photos are added.
 */
export const SERVICE_PHOTOS: Record<ServiceType | "hero", string | null> = {
  hero: null,
  hospital_visit: null,
  driver: null,
  companion: null,
  property: null,
  gift: null,
  camera: null,
  tour: null,
};
