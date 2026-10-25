import { expect, test } from "@playwright/test";
import { ADMIN_PHONE, randomUkMobile, signInOnPage } from "./helpers";

test("a guest builds a request, signs in, submits it, and an admin sees it", async ({
  page,
  browser,
}) => {
  const destination = `St. James Hospital ${Date.now()}`;

  // Home → the service's page → the booking steps, as a guest.
  await page.goto("/en-GB");
  await page.getByRole("link", { name: /Book a hospital visit/ }).click();
  await expect(page).toHaveURL(/\/en-GB\/services\/hospital-visit$/);
  await expect(page.getByRole("heading", { name: "Hospital visit", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Book a hospital visit" }).first().click();
  await expect(page).toHaveURL(/\/en-GB\/book$/);

  // 1. Details
  await expect(page.getByRole("heading", { name: "Tell us about the visit", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Someone else" }).click();
  await page.getByLabel("First name").fill("Anu");
  await page.getByLabel("Phone").fill("98765 43210"); // read as Indian on every site (D30)
  await page.getByLabel("From", { exact: true }).fill("24 Elm Street, SW1A 1AA");
  await page.getByLabel("To", { exact: true }).fill(destination);
  await page.getByRole("button", { name: /Next: Choose date & time/ }).click();

  // 2. Date & time
  await expect(page).toHaveURL(/\/en-GB\/book\/when$/);
  await page.getByRole("group", { name: "Pick a day" }).getByRole("button", { disabled: false }).nth(1).click();
  await page.getByRole("group", { name: "Time" }).getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: /Next: Choose options/ }).click();

  // 3. Options
  await expect(page).toHaveURL(/\/en-GB\/book\/options$/);
  await page.getByRole("button", { name: "More people" }).click();
  await page.getByLabel(/I need a bystander/).check();

  // Reviewing requires sign-in, then returns here.
  await page.getByRole("button", { name: /Next: Review/ }).click();
  await expect(page).toHaveURL(/\/en-GB\/sign-in\?next=/);
  const customer = randomUkMobile();
  await signInOnPage(page, customer.typed, customer.e164);
  await expect(page).toHaveURL(/\/en-GB\/book\/review$/);

  await expect(page.getByText(destination, { exact: false })).toBeVisible();
  await expect(page.getByText("2 people accompanying · Needs a bystander", { exact: false })).toBeVisible();

  // Phone-only customers must give an email for the quote (D11).
  await page.getByRole("button", { name: "Send for admin approval" }).click();
  await expect(page.getByText("Enter a valid email address so we can send your quote.")).toBeVisible();
  await page.getByLabel("Where should we email your quote?").fill(`e2e-${Date.now()}@example.co.uk`);
  await page.getByRole("button", { name: "Send for admin approval" }).click();
  await expect(page).toHaveURL(/\/en-GB\/activity$/);
  await expect(page.getByText(destination)).toBeVisible();
  await expect(page.getByText("Awaiting approval")).toBeVisible();

  // Customers can't open the admin portal (D9).
  await page.goto("/en-GB/admin/requests");
  await expect(page.getByText("You don't have access to this page")).toBeVisible();

  // The admin sees it in the queue.
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminContext.newPage();
  await admin.goto("/en-GB/admin/requests");
  await expect(admin).toHaveURL(/\/en-GB\/sign-in/);
  await signInOnPage(admin, "07400 000001", ADMIN_PHONE);
  await expect(admin).toHaveURL(/\/en-GB\/activity$/);
  await admin.goto("/en-GB/admin/requests");
  const row = admin.getByRole("row").filter({ hasText: destination });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "View" }).click();
  await expect(admin.getByText("Anu")).toBeVisible();
  await expect(admin.getByText("Needs a bystander", { exact: false })).toBeVisible();
  await adminContext.close();
});

test("the server rejects a request less than 48 hours ahead (D17)", async ({ page }) => {
  const customer = randomUkMobile();
  await page.goto("/en-GB/sign-in?next=/book/review");
  await signInOnPage(page, customer.typed, customer.e164);
  await expect(page).toHaveURL(/\/en-GB\/book\/review$/);

  // Bypass the date picker: put a slot 24 hours from now straight into the draft.
  await page.evaluate(() => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const date = soon.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    sessionStorage.setItem(
      "booking-draft:v2",
      JSON.stringify({
        serviceType: "companion",
        startAddress: "1 High Street",
        serviceAddress: "Post office",
        date,
        time: "12:00",
        timeZone: "Asia/Kolkata",
        estimatedHours: 1,
        vehicle: "none",
        description: "",
        recipient: { kind: "self" },
      }),
    );
  });
  await page.reload();
  await page.getByLabel("Where should we email your quote?").fill(`e2e-${Date.now()}@example.co.uk`);
  await page.getByRole("button", { name: "Send for admin approval" }).click();
  await expect(page.getByText("less than 48 hours away")).toBeVisible();
});

test("each service asks for its own details", async ({ page }) => {
  await page.goto("/en-GB/services/driver");
  await page.getByRole("link", { name: "Book a driver" }).first().click();
  await expect(page.getByRole("heading", { name: "Tell us about the trip", level: 1 })).toBeVisible();
  await expect(page.getByLabel("From", { exact: true })).toBeVisible();
  // Drivers have an options step (vehicle, extras); it needs the earlier steps first.
  await page.goto("/en-GB/book/options");
  await expect(page.getByText("Some details are missing.")).toBeVisible();

  // Property checks have one address and no options step.
  await page.goto("/en-GB/services/property");
  await page.getByRole("link", { name: "Request a home visit" }).first().click();
  await expect(page.getByPlaceholder("Address of the home to visit")).toBeVisible();
  await expect(page.getByLabel("From", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Options", { exact: true })).toHaveCount(0);
});
