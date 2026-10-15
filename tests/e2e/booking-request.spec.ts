import { expect, test } from "@playwright/test";
import { ADMIN_PHONE, randomUkMobile, signInOnPage } from "./helpers";

test("a guest builds a request, signs in, submits it, and an admin sees it", async ({
  page,
  browser,
}) => {
  const destination = `St. James Hospital ${Date.now()}`;

  // Build the request as a guest.
  await page.goto("/en-GB");
  await page.getByRole("link", { name: /Book a hospital visit/ }).click();
  await expect(page).toHaveURL(/\/en-GB\/book$/);
  await page.getByLabel("Start location").fill("24 Elm Street, SW1A 1AA");
  await page.getByLabel("Service location").fill(destination);

  await page.getByRole("group", { name: "Pick a day" }).getByRole("button").nth(1).click();
  await page.getByRole("group", { name: "Time" }).getByRole("button", { name: "19:00" }).click();

  await page.getByRole("button", { name: "Someone else" }).click();
  await page.getByLabel("First name").fill("Anu");
  await page.getByLabel("Phone").fill("07400 123456");
  await expect(page.getByRole("complementary")).toContainText("Anu");

  // Reviewing requires sign-in, then returns here.
  await page.getByRole("button", { name: "Review request" }).click();
  await expect(page).toHaveURL(/\/en-GB\/sign-in\?next=/);
  const customer = randomUkMobile();
  await signInOnPage(page, customer.typed, customer.e164);
  await expect(page).toHaveURL(/\/en-GB\/book\/review$/);

  await expect(page.getByText(destination, { exact: false })).toBeVisible();

  // Phone-only customers must give an email for the quote (D11).
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Enter a valid email address so we can send your quote.")).toBeVisible();
  await page.getByLabel("Where should we email your quote?").fill(`e2e-${Date.now()}@example.co.uk`);
  await page.getByRole("button", { name: "Submit request" }).click();
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
    const date = soon.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    sessionStorage.setItem(
      "booking-draft:v1",
      JSON.stringify({
        serviceType: "errand",
        startAddress: "1 High Street",
        serviceAddress: "Post office",
        date,
        time: "12:00",
        timeZone: "Europe/London",
        estimatedHours: 1,
        vehicle: "none",
        description: "",
        needsMobilitySupport: false,
        needsDocuments: false,
        recipient: { kind: "self" },
      }),
    );
  });
  await page.reload();
  await page.getByLabel("Where should we email your quote?").fill(`e2e-${Date.now()}@example.co.uk`);
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("less than 48 hours away")).toBeVisible();
});
