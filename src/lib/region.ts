// Launch markets (CLAUDE.md D7): United States, Canada, United Kingdom, India.

export const REGIONS = ["US", "CA", "GB", "IN"] as const;
export type Region = (typeof REGIONS)[number];

export const LOCALES = ["en-US", "en-CA", "en-GB", "en-IN"] as const;
export type AppLocale = (typeof LOCALES)[number];

type RegionConfig = {
  locale: AppLocale;
  currency: "USD" | "CAD" | "GBP" | "INR";
  defaultTimeZone: string;
  /** Time zones that belong to this region; the browser's zone is used when it's one of these. */
  timeZones: RegExp;
  distanceUnit: "mile" | "kilometer";
  /** D20: false means we never send SMS to this country's numbers. */
  smsAllowed: boolean;
  /** D21: Razorpay for India, Stripe everywhere else. */
  paymentProvider: "stripe" | "razorpay";
};

// Canadian zones, so they aren't mistaken for US ones.
const CANADA_TZ =
  /^America\/(Toronto|Montreal|Vancouver|Edmonton|Calgary|Winnipeg|Regina|Swift_Current|Halifax|Glace_Bay|Moncton|Goose_Bay|St_Johns|Whitehorse|Dawson|Dawson_Creek|Fort_Nelson|Creston|Yellowknife|Inuvik|Cambridge_Bay|Rankin_Inlet|Iqaluit|Resolute|Atikokan|Blanc-Sablon|Nipigon|Thunder_Bay|Rainy_River|Pangnirtung)$/;

export const REGION_CONFIG: Record<Region, RegionConfig> = {
  US: {
    locale: "en-US",
    currency: "USD",
    defaultTimeZone: "America/New_York",
    timeZones: /^(America\/|Pacific\/Honolulu$)/,
    distanceUnit: "mile",
    smsAllowed: true,
    paymentProvider: "stripe",
  },
  CA: {
    locale: "en-CA",
    currency: "CAD",
    defaultTimeZone: "America/Toronto",
    timeZones: CANADA_TZ,
    distanceUnit: "kilometer",
    smsAllowed: true,
    paymentProvider: "stripe",
  },
  GB: {
    locale: "en-GB",
    currency: "GBP",
    defaultTimeZone: "Europe/London",
    timeZones: /^Europe\/London$/,
    distanceUnit: "mile",
    smsAllowed: true,
    paymentProvider: "stripe",
  },
  IN: {
    locale: "en-IN",
    currency: "INR",
    defaultTimeZone: "Asia/Kolkata",
    timeZones: /^Asia\/(Kolkata|Calcutta)$/,
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

/**
 * The time zone to schedule in: the browser's zone when it belongs to the
 * region (the US and Canada span several zones), otherwise the region default.
 */
export function guessTimeZone(region: Region, browserTimeZone?: string): string {
  let tz = browserTimeZone;
  try {
    tz ??= Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // fall through to the default
  }
  const { timeZones, defaultTimeZone } = REGION_CONFIG[region];
  // A Canadian zone also matches the broad US pattern, so exclude it for the US.
  if (tz && timeZones.test(tz) && !(region === "US" && CANADA_TZ.test(tz))) return tz;
  return defaultTimeZone;
}
