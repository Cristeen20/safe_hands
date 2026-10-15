import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  ADMIN_PHONE,
  bookingStatus,
  createSubmittedBooking,
  randomUkMobile,
  signInOnPage,
  sql,
} from "./helpers";

// Milestone 2: quote → accept and pay → confirmed, with the dev payment
// provider (no Stripe/Razorpay keys). Admin and customer use separate browsers.
// ``: while a page streams in, Next can keep a
// hidden copy of some content in the DOM, which strict locators also match.

async function signedIn(browser: Browser, typed: string, e164: string, width = 1280): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto("/en-GB/sign-in?next=/activity");
  await signInOnPage(page, typed, e164);
  await expect(page).toHaveURL(/\/en-GB\/activity$/);
  return page;
}

async function newCustomer(browser: Browser) {
  const phone = randomUkMobile();
  const page = await signedIn(browser, phone.typed, phone.e164, 390);
  return { page, phone };
}

const adminPage = (browser: Browser) => signedIn(browser, "07400 000001", ADMIN_PHONE);

async function quote(admin: Page, bookingId: string, amount: string, note = "") {
  await admin.goto(`/en-GB/admin/requests/${bookingId}`);
  await admin.locator("main").getByLabel("Amount (GBP)").fill(amount);
  if (note) await admin.locator("main").getByLabel("Note to the customer (optional)").fill(note);
  await admin.locator("main").getByRole("button", { name: "Send quote" }).click();
  await expect(admin.locator("main").getByRole("region", { name: "History" })).toContainText("Quote ready");
}

test("admin quotes, customer pays, booking is confirmed exactly once", async ({ browser }) => {
  const { page: customer, phone } = await newCustomer(browser);
  const { id, place } = await createSubmittedBooking(phone.e164);
  const admin = await adminPage(browser);

  await admin.goto("/en-GB/admin/requests");
  await expect(admin.locator("main").getByRole("row").filter({ hasText: place })).toBeVisible();
  await quote(admin, id, "45.50", "Includes waiting time.");

  // The customer sees the price on My bookings and on the booking page.
  await customer.goto("/en-GB/activity");
  await expect(customer.locator("main").getByRole("link", { name: new RegExp(place) })).toContainText("£45.50");
  await customer.locator("main").getByRole("link", { name: new RegExp(place) }).click();
  await expect(customer.locator("main").getByText("Includes waiting time.")).toBeVisible();

  await customer.locator("main").getByRole("button", { name: "Accept and pay £45.50" }).click();
  await expect(customer).toHaveURL(/\/en-GB\/pay\/dev\//);
  const devPayUrl = customer.url();
  await customer.locator("main").getByRole("button", { name: "Simulate payment succeeded" }).click();
  await expect(customer.locator("main").getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  expect(await bookingStatus(id)).toBe("confirmed");

  // Reporting the same success again changes nothing (idempotent fulfilment).
  await customer.goto(devPayUrl);
  await customer.locator("main").getByRole("button", { name: "Simulate payment succeeded" }).click();
  await expect(customer.locator("main").getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*) from booking_event where booking_id = ${id} and to_status = 'confirmed'`;
  expect(Number(count)).toBe(1);

  // The admin sees the payment and the history.
  await admin.goto(`/en-GB/admin/requests/${id}`);
  await expect(admin.locator("main").getByText("succeeded")).toBeVisible();
  await expect(admin.locator("main").getByRole("region", { name: "History" })).toContainText("Confirmed");
  await admin.context().close();
  await customer.context().close();
});

test("customer declines a quote", async ({ browser }) => {
  const { page: customer, phone } = await newCustomer(browser);
  const { id } = await createSubmittedBooking(phone.e164);
  const admin = await adminPage(browser);
  await quote(admin, id, "30");

  await customer.goto(`/en-GB/activity/${id}`);
  await customer.locator("main").getByRole("button", { name: "Decline quote" }).click();
  await customer.locator("main").getByRole("button", { name: "Yes, decline" }).click();
  await expect(customer.locator("main").getByText("You declined this quote.")).toBeVisible();
  expect(await bookingStatus(id)).toBe("declined");
  await admin.context().close();
  await customer.context().close();
});

test("admin rejects with a reason the customer can see (D23)", async ({ browser }) => {
  const { page: customer, phone } = await newCustomer(browser);
  const { id } = await createSubmittedBooking(phone.e164);
  const admin = await adminPage(browser);

  await admin.goto(`/en-GB/admin/requests/${id}`);
  const reason = admin.locator("main").getByLabel("Reason (shown to the customer)");
  await admin.locator("main").getByRole("button", { name: "Reject request" }).click();
  await expect(reason).toBeFocused(); // the required field blocks an empty submit
  await reason.fill("No helpers free in that area that day.");
  await admin.locator("main").getByRole("button", { name: "Reject request" }).click();
  await expect(admin.locator("main").getByRole("region", { name: "History" })).toContainText("Not approved");

  await customer.goto(`/en-GB/activity/${id}`);
  await expect(customer.locator("main").getByText("No helpers free in that area that day.")).toBeVisible();
  await admin.context().close();
  await customer.context().close();
});

test("admins can't quote a booking that starts within 24 hours", async ({ browser }) => {
  const { page: customer, phone } = await newCustomer(browser);
  const { id } = await createSubmittedBooking(phone.e164, { daysAhead: 0.5 });
  const admin = await adminPage(browser);
  await admin.goto(`/en-GB/admin/requests/${id}`);
  await expect(admin.locator("main").getByText("starts too soon to quote")).toBeVisible();
  await expect(admin.locator("main").getByLabel("Amount (GBP)")).toHaveCount(0);
  await admin.context().close();
  await customer.context().close();
});

test("the hourly job expires unanswered quotes; it needs the cron secret", async ({ browser, request }) => {
  const { page: customer, phone } = await newCustomer(browser);
  const { id } = await createSubmittedBooking(phone.e164);
  const admin = await adminPage(browser);
  await quote(admin, id, "20");

  expect((await request.get("/api/cron/expire-quotes")).status()).toBe(401);

  await sql`update quote set expires_at = now() - interval '1 minute' where booking_id = ${id}`;
  const res = await request.get("/api/cron/expire-quotes", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(res.status()).toBe(200);
  expect(await bookingStatus(id)).toBe("expired");

  await customer.goto(`/en-GB/activity/${id}`);
  await expect(customer.locator("main").getByText("This quote expired before it was accepted.")).toBeVisible();
  await admin.context().close();
  await customer.context().close();
});

test("customers can't see or pay someone else's booking", async ({ browser }) => {
  const owner = await newCustomer(browser);
  const { id } = await createSubmittedBooking(owner.phone.e164);
  const admin = await adminPage(browser);
  await quote(admin, id, "25");

  const other = await newCustomer(browser);
  await other.page.goto(`/en-GB/activity/${id}`);
  await expect(other.page.locator("main").getByText("Booking not found.")).toBeVisible();
  await expect(other.page.locator("main").getByRole("button", { name: /Accept and pay/ })).toHaveCount(0);
  for (const p of [admin, owner.page, other.page]) await p.context().close();
});
