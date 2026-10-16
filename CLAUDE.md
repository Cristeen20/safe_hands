# CLAUDE.md — safe_hands (working name)

The product name isn't decided yet. "safe_hands" (the repo) and "bookahelp" (the design) are both placeholders. Keep the brand name in one config constant and never hard-code it in UI copy, emails, routes or database names.

A responsive website for booking a person to help you: drive you somewhere, go with you to a hospital visit or the bank, look after your property, arrange a surprise gift, shoot an event, or take you on a guided tour. You can book for yourself or for someone you care for, then follow the helper live as they complete each task.

The design comes from the "Book a Help" canvas: https://claude.ai/artifact/SNXWpVWk3k7MhXAx5QyStH. Its artboards are phone-app mockups drawn at 390 px wide. The canvas is the spec for content, fields and visual tokens. Layout follows D18 (a responsive website). Ask before changing anything else it defines.

## Status

**Milestone 1 (foundation + booking request) is built.** A guest builds a request, signs in with a phone code, submits it, and sees it as "Awaiting approval". Admins see it in `/admin/requests`. Customers get a 403 on admin pages.

**Milestone 2 (quote → pay → confirmed) is built, except the real payment providers.** Admins quote or reject (with a reason). Customers accept and pay, or decline. A scheduled job (daily on the Hobby plan, see `vercel.ts`) expires unanswered quotes, and customers get email at each step. Payments currently run through the **dev provider**; the Stripe and Razorpay adapters (`src/server/payments/index.ts`) and their webhooks are next, once the accounts exist.

**Still to build:**
- Stripe Checkout + webhook; Razorpay Standard Checkout + webhook.
- Helper assignment and staff invitation UI.
- Tasks and live tracking.
- Maps and places autocomplete.
- Recipient SMS.

Not built yet from the canvas:
- An account page.
- Prices on Activity (they show "Awaiting quote").

## Decisions made

| # | Decision |
| --- | --- |
| D1 | **Web app**, mobile-first and responsive. No native app. |
| D2 | **Three roles: customer, admin, helper.** Only the customer app is designed so far. The admin portal and helper app are in scope but have no designs yet. |
| D3 | **Every booking is scheduled.** There is no "book now". |
| D4 | **Admin approval with a quote.** A customer submits a booking request. An admin reviews it in the admin portal and approves it with a price quote, or rejects it. |
| D5 | **Admins assign helpers.** There is no automatic matching and the customer doesn't pick a helper. |
| D6 | **Pricing is undecided.** Model a quote as an admin-entered amount for now. Don't build any pricing rules. |
| D7 | **Launch markets: United States, Canada, United Kingdom and India.** Each has its own site locale (`/en-US`, `/en-CA`, `/en-GB`, `/en-IN`). See **Localisation**. |
| D8 | **The customer must accept the quote.** A booking is only confirmed after the customer accepts. They can also decline. |
| D9 | **One Next.js app, three role-based views**: customer (`/`), admin (`/admin`), helper (`/helper`). Role checks are enforced on the server for every route and action, not just hidden in the UI. |
| D10 | **Browser-only helper location.** Location updates only while the helper has the job page open. This is acceptable for v1. |
| D11 | **Email for notifications** (quote ready, booking confirmed, helper assigned, reminders). SMS is used only for phone sign-in codes and the "someone else" recipient texts, and never for Indian numbers (D20). |
| D12 | **Product name undecided.** See the note at the top of this file. |
| D13 | **Charge on acceptance.** The customer pays the full quote when they accept it (Stripe PaymentIntent, captured immediately). |
| D14 | **Quote expiry.** A quote expires at whichever comes first: 7 days after it was issued, or 24 hours before the scheduled start. Store `expires_at` on the quote and compute it when the quote is issued. An admin can't issue a quote that would already be expired. A scheduled job moves unanswered quotes to `expired`. |
| D15 | **Staff accounts by invitation.** Admins invite admins and helpers by email. Invitations are single-use and expire. Nobody can sign up as staff. The first admin is created by a one-off seed script. |
| D16 | **No cancellation in v1.** Neither customers nor admins can cancel a confirmed booking, and there are no refunds. Don't build cancel buttons or refund flows. Customers can still decline a quote, and admins can still reject a request, before any payment. |
| D17 | **48-hour minimum notice.** A request's scheduled start must be at least 48 hours after it is submitted. Check this on the server at submit time, not just in the date picker. The When screen's day picker starts at the first valid day, not "Today". |
| D18 | **A responsive website, not an app-like design.** The canvas supplies content and tokens; layouts follow normal website patterns (see **Customer pages**). |
| D19 | **No service in Quebec.** The Canadian site says "We can't take bookings in Quebec", and admins reject Quebec requests. Once places autocomplete arrives, block Quebec service addresses automatically. No French version is needed. |
| D20 | **No text messages to Indian (+91) numbers, ever.** This covers sign-in codes and recipient updates. <ul><li>Enforced by `canReceiveSms()` (`src/lib/phone.ts`), Better Auth's phone validator and a guard in `src/lib/sms.ts`.</li><li>Indians sign in with an email code (or Google). The Indian site doesn't offer phone sign-in.</li><li>Email-code sign-in is also offered everywhere else as "Continue with email".</li></ul> |
| D21 | **Payments: Razorpay for India (INR), Stripe for the US, Canada and UK (USD, CAD, GBP).** The provider is chosen by the booking's region (`REGION_CONFIG[region].paymentProvider`). The full quote is charged when the customer accepts it (D13). Both integrations sit behind one payment interface, so the quote-accept flow doesn't care which provider is used. |
| D22 | **One quote per booking.** A sent quote can't be revised (`quote.booking_id` is unique). To change the price, the customer declines and books again. |
| D23 | **Rejections carry a reason the customer sees.** It's required; it goes in the rejection email and on the booking page. |
| D24 | **How customers pay:**<ul><li>US, Canada and UK: Stripe hosted Checkout (redirect).</li><li>India: Razorpay Standard Checkout (pop-up).</li><li>Without provider keys (dev and tests only), a **dev provider** shows a local "simulate payment" page. Production refuses to take payment without keys.</li><li>Confirmation is idempotent (`recordPaymentSuccess` in `src/server/payments/fulfil.ts`). Webhooks, the return page and the Razorpay handler can all report the same payment safely.</li><li>A payment that lands after its quote expired or was declined is kept and flagged `late` for an admin to handle. There's no automatic refund (D16).</li></ul> |
| D25 | **Every customer needs a real email for quotes.** Customers who signed in by phone are asked for one on the review page before submitting. |
| D26 | **Seven services** (canvas Home and "Book a service"): hospital visit, driver, companion, property management, surprise gift, camera man and guided tour.<ul><li>Hospital visit, driver and companion have a route (from → to), a vehicle and an hours estimate. Drivers are booked for at least 3 hours, can drive the customer's own car, and can be booked for 2–30 days.</li><li>Property, gift and camera bookings have one location; camera bookings also have hours.</li><li>Which booking columns each service uses is defined by `bookingValues` in `src/domain/booking.ts`.</li><li>The old "errand" and "other" types became "companion" (migration 0003).</li></ul> |
| D27 | **Guided tours go through the same request → quote → pay flow (D4).**<ul><li>Packages: pre-booking a package sends a request for N people, starting at the package's departure. The tours page shows how many people have pre-booked each package (requests that aren't rejected, declined or expired).</li><li>Staycations and custom trips have a day, time, length in days and party size.</li><li>Tour bookings are always for the customer themself.</li><li>Packages and stay locations live in `src/config/tours.ts` until there's an admin screen. Their departure dates are **samples** and must be replaced before launch.</li></ul> |

## Localisation (US, Canada, UK, India)

| Market | Locale | Currency | Phone | Default time zone | Address wording | Distance |
| --- | --- | --- | --- | --- | --- | --- |
| United States | `en-US` | USD | +1 | America/New_York (browser zone if American) | Street and ZIP code | miles |
| Canada (excl. Quebec, D19) | `en-CA` | CAD | +1 | America/Toronto (browser zone if Canadian) | Street and postal code | km |
| United Kingdom | `en-GB` | GBP | +44 | Europe/London | Street and postcode | miles |
| India | `en-IN` | INR | +91, no SMS (D20) | Asia/Kolkata (no DST) | Street, area and PIN code | km |

The table lives in code in `src/lib/region.ts`. Add a market there, in `messages/` and in `src/i18n/request.ts`.

- **Money**: store integer minor units (cents, pence, paise) plus an ISO currency code. Never use floats.
- **Phone**: store E.164 and validate with `libphonenumber`. Numbers from any of the four markets are accepted on every site. A number typed without `+` is read as the site's own country, so "(416) 555-0142" counts as Canadian on `/en-CA`.
- **Time**: store UTC, and show times in the booking's own time zone. Date and time formats follow the locale through `Intl`.
- **Copy**: `messages/en.json` is shared. Per-locale files override only the words that differ.
- **Privacy**: treat hospital-visit notes as sensitive health data in every market. Collect only what's needed, keep consent records, and support export and deletion. The laws by market:
    - UK: UK GDPR / Data Protection Act 2018.
    - US: state laws such as CCPA/CPRA.
    - Canada: PIPEDA. Quebec's Law 25 shouldn't apply (D19); confirm with counsel.
    - India: Digital Personal Data Protection Act 2023.
- **Helpers**: background checks differ by country (e.g. UK DBS, Canadian police checks, Indian police verification). Keep the vetting status generic in the data model.

## Booking lifecycle

```
customer                      admin                          helper
────────                      ─────                          ──────
draft ──submit──▶ submitted ──approve + quote──▶ quoted
                      │                            │
                      └──reject──▶ rejected        ├──customer declines──▶ declined
                                                   ├──no reply by expires_at──▶ expired
                                                   ▼ customer accepts + pays
                                               confirmed ──assign helper──▶ assigned
                                                                              │
                                                    in_progress ◀──start──────┘
                                                         │  (helper ticks off tasks)
                                                         ▼
                                                     completed
   (no cancelled state in v1 — D16)
```

## Customer pages

The canvas is a phone-app mockup. The product is a **responsive website** (D18). Take content, fields, copy and tokens from the canvas, but not app-style layout. That means no bottom nav, bottom sheets, full-screen pickers or circular back buttons. Every page has a site header and footer and works from 360 px up to desktop.

| Route | Canvas source | Page |
| --- | --- | --- |
| `/` | Home | Follows the Home artboard: hero, "What do you need?" (hospital, driver, companion, guided tours, property management, something special), "How to use", and the "Ready to go?" quick form |
| `/book` | Book a service, When, For whom | **One page** with five numbered sections. A summary sidebar with the service's call to action sits beside them on desktop and below them on phones. <ul><li>What do you need: service chips, plus a link to Guided tours</li><li>Where: from → to, or one location</li><li>When: day + time, from the first day 48 h ahead</li><li>Who for: me / someone else, with name + phone</li><li>Describe the service: the fields for the chosen service (D26)</li></ul> |
| `/tours` | Guided tours | Packages / Staycation / Custom trip (D27) |
| `/book/review` | (new) | Summary + "Submit request". Requires sign-in, then returns here. |
| `/sign-in`, `/sign-in/verify` | Sign in, Verify | Centred card: phone number, then a 4-digit code |
| `/activity` | Activity | "My bookings", grouped as waiting on our team / upcoming / past |
| `/activity/[id]` | Service tracking | Not built yet: live map, task timeline, details, Receipt / Rebook / Invoice |

## Admin portal (not designed yet)

- Queue of submitted requests, sorted by scheduled date.
- Request detail: approve with a quote (amount and an optional note), or reject with a reason.
- Assign a helper to a confirmed booking, and reassign if needed.
- Lists of bookings, helpers and customers.
- Desktop-first. It's an internal tool.

## Helper app (not designed yet)

- See assigned jobs.
- Start a job, then tick off each task in order.
- Share live location only while a job is in progress.
- Message or call the customer.

## Core domain (draft)

- **User**: one account table with a `role` of `customer`, `admin` or `helper`.
- **Customer**: has a phone (verified), an email, an optional Google identity, and saved payment methods.
- **Quote**: amount, currency, an optional note, the admin who quoted it, and when. Add a new row for each re-quote.
- **Recipient**: the person who receives the help. Either the user or a saved contact (name and phone).
- **Booking**: service type, start location, service location, scheduled start, description, recipient, status, plus the per-service fields from D26/D27 (hours, vehicle, people accompanying, bystander, child seat, days, party size, food, stay, tour kind and package).
- **Helper**: a user with the `helper` role. An admin assigns them to a booking. Has a live location while on the job.
- **Task**: an ordered step inside a booking. The canvas shows Pickup → Check documents → Destination → Process → Drop back. Each step has a status (pending / current / done) and a timestamp.
- **Booking status**: see **Booking lifecycle**. Every status change is recorded with who made it and when.

## Cross-cutting requirements

- **Responsive.** Build mobile-first, but pages must also work well on tablet and desktop. Touch targets are at least 44 px.
- **Accessibility.** Use real `<button>`, `<a>` and `<label>` elements, as the canvas does. Text contrast is at least 4.5:1. This audience includes older people, people with low vision and people with mobility needs, so treat accessibility as a requirement, not a nice-to-have.
- **Trust and safety.** The users are vulnerable people. Helper identity and vetting, sharing live location only during an active booking, notifying the recipient, and an audit trail of task changes all matter from v1.
- **Real-time.** The tracking screen needs live helper location and task updates.
- **PII.** Phone numbers, addresses and health context (hospital visits, medication notes) are sensitive. Minimise what is stored, don't log it, and protect it at rest.

## Design tokens (from the canvas)

| Token | Value | Use |
| --- | --- | --- |
| `ink` | `#14201E` | Primary text, dark buttons |
| `primary` | `#0E4A43` | Brand green, primary CTAs |
| `accent` | `#F2B33D` | Highlights, the current step, selected time |
| `surface` | `#F7F7F4` | Page background |
| `card` | `#FFFFFF` | Cards |
| `field` | `#F2F3EF` | Input background |
| `border` | `#E2E4DF` / `#D5D8D3` | Card and input borders |
| `muted` | `#5B6763` / `#4F5B57` | Secondary text |
| `primary-soft` | `#E3EEEA` | Chips, step badges |
| `success` | `#1F8A5B` | "Live" dot |

- Display font: **Bricolage Grotesque** (500/700). Body font: **Figtree** (400–700).
- Radii: about 12–16 px for inputs and buttons, 18–22 px for cards, pill buttons for chips.
- Icons: inline stroke SVG, 24 px viewBox, stroke width about 2. No emoji.

## Stack

- **Next.js 16** (App Router, TypeScript), deployed on Vercel.
    - `cacheComponents` is on. Anything that reads the session or request goes inside `<Suspense>`.
    - Client components must not read `new Date()` during render. Read it in an effect.
    - Middleware is `src/proxy.ts`. It does locale routing only.
    - This Next version differs from older docs. Read `node_modules/next/dist/docs/` first (see `AGENTS.md`).
- **Tailwind CSS v4.** Tokens live in `src/app/globals.css` (`@theme`).
- **next-intl 4** with always-prefixed locales `en-US`, `en-CA`, `en-GB` and `en-IN`. Unprefixed visits are routed by browser language, falling back to `en-GB`.
    - The locale comes from `next/root-params`, so don't use `setRequestLocale`.
    - `messages/en.json` holds every string. `messages/en-<XX>.json` holds only the words that differ.
    - Server actions can't read the route locale, so pass it in explicitly.
- **Postgres + Drizzle** (`postgres` driver).
    - Neon in Vercel, any local Postgres in development.
    - DB columns are snake_case; TypeScript fields are camelCase.
- **Better Auth** (chosen over Clerk to avoid per-user fees and keep user data in our own database).
    - Sign-in uses a 4-digit code sent by SMS (US, Canadian and UK numbers) or by email (everyone, and the only option in India). Google sign-in is optional.
    - `user.role` is `input: false`, so a client can never set it.
- **Payments** (not built yet): Stripe for USD, CAD and GBP, and Razorpay for INR (D21). The full quote is charged when the customer accepts it (D13).
- **Maps and real-time**: a maps/places provider for address autocomplete and the live map. Location pushed over WebSockets or a real-time service.
- **Email**: a transactional email provider (e.g. Resend) with React Email templates, localised per locale.
- **SMS**: a provider for the sign-in code and recipient texts only.

## Open decisions

1. Pricing model (deferred, D6).
2. Product name (D12).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server. Sign-in codes are printed to the console when Twilio isn't configured. |
| `pnpm test` | Vitest unit tests for the domain rules (`src/**/*.test.ts`) |
| `pnpm test:e2e` | Playwright end-to-end tests at desktop and phone sizes. Starts a dev server on :3100 and seeds an admin. If `pnpm dev` is already running, use `E2E_BASE_URL=http://localhost:3000 pnpm test:e2e`. |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc` |
| `pnpm db:generate` / `pnpm db:migrate` | Create / apply Drizzle migrations in `drizzle/` |
| `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/expire-quotes` | Run the quote-expiry job by hand (`vercel.ts` schedules it on Vercel) |
| `localhost:3000/api/dev/admin-login[?email=…]` | **Local only:** signs you in as an admin without a code. Works only under `next dev` with `DEV_ADMIN_LOGIN=1`; returns 404 everywhere else. |
| `pnpm seed:admin "<email or +phone>" "Name"` | Create or promote the first admin (D15). Indian admins use email (D20). |

Copy `.env.example` to `.env.local` and set `DATABASE_URL` and `BETTER_AUTH_SECRET`. Without Twilio or Resend keys, sign-in codes are printed to the `pnpm dev` console as `[sms:dev]` or `[email:dev]`.

## Layout

- `src/app/[locale]/`: pages.
    - Customer pages are in the `(site)` route group, which adds the site header and footer: `/`, `/book`, `/tours`, `/book/review`, `/sign-in`, `/sign-in/verify`, `/activity`, `/helper`.
    - Admin: `/admin/requests[/id]`, with its own desktop layout.
- `src/app/api/auth/[...all]`: the Better Auth handler.
- `src/domain/booking.ts`: pure business rules and the Zod request schema. Unit-tested.
    - 48-hour notice (D17), quote expiry (D14), allowed status changes (no cancellation, D16).
- `src/db/schema.ts`: every table, including the ones Better Auth needs.
- `src/lib/`: shared helpers.
    - `auth.ts` sets up sign-in.
    - `authz.ts` holds `requireUser` and `requireRole`. Call them in **every** staff page and server action (D9).
    - `phone.ts`, `region.ts` and `time.ts` handle phone numbers, regions and time zones.
- `src/server/`: server-side code.
    - Server actions: `bookings.ts` (customer), `admin.ts` (quote/reject) and `dev-payments.ts`.
    - `queries.ts`, `notifications.ts` (emails) and `transitions.ts` (guarded status changes and their audit rows).
    - `payments/`: provider choice, checkout and idempotent fulfilment.
- `src/app/api/cron/`: scheduled jobs, protected by `CRON_SECRET`.
- `src/components/site/`: header, footer and the shared page `container`.
- `src/components/booking/`: the booking form and its sections. The draft booking lives in `draft-context.tsx` (sessionStorage) until it's submitted.
- `src/config/brand.ts`: the product name (D12). `src/config/tours.ts`: tour packages and stay locations (D27).

## Working conventions

- Make small, reviewable changes. Don't add features the canvas or this file doesn't ask for.
- Before building a page, re-read its artboard on the canvas (Artifact tool `read`, path `project/<Name>.dc.html`) for content and fields, then lay it out as a website (D18).
- Update this file when an open decision is made.
