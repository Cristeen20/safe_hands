// Launch markets (CLAUDE.md D7): United States, Canada, United Kingdom, India.

export const REGIONS = ["US", "CA", "GB", "IN"] as const;
export type Region = (typeof REGIONS)[number];

/**
 * Every service takes place in India (D30), whichever site the customer books
 * from. Booking times are in India time; price and payment follow the site.
 */
export const SERVICE_COUNTRY = "IN" satisfies Region;
export const SERVICE_TIME_ZONE = "Asia/Kolkata";

export const LOCALES = ["en-US", "en-CA", "en-GB", "en-IN"] as const;
export type AppLocale = (typeof LOCALES)[number];

type RegionConfig = {
  locale: AppLocale;
  currency: "USD" | "CAD" | "GBP" | "INR";
  distanceUnit: "mile" | "kilometer";
  /** D20: false means we never send SMS to this country's numbers. */
  smsAllowed: boolean;
  /** D21: Razorpay for India, Stripe everywhere else. */
  paymentProvider: "stripe" | "razorpay";
};

export const REGION_CONFIG: Record<Region, RegionConfig> = {
  US: {
    locale: "en-US",
    currency: "USD",
    distanceUnit: "mile",
    smsAllowed: true,
    paymentProvider: "stripe",
  },
  CA: {
    locale: "en-CA",
    currency: "CAD",
    distanceUnit: "kilometer",
    smsAllowed: true,
    paymentProvider: "stripe",
  },
  GB: {
    locale: "en-GB",
    currency: "GBP",
    distanceUnit: "mile",
    smsAllowed: true,
    paymentProvider: "stripe",
  },
  IN: {
    locale: "en-IN",
    currency: "INR",
    distanceUnit: "kilometer",
    smsAllowed: false,
    paymentProvider: "razorpay",
  },
};

const LOCALE_REGION: Record<AppLocale, Region> = {
  "en-US": "US",
  "en-CA": "CA",
  "en-GB": "GB",
  "en-IN": "IN",
};

export function regionForLocale(locale: AppLocale): Region {
  return LOCALE_REGION[locale];
}

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && (REGIONS as readonly string[]).includes(value);
}

