import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // D14: expire quotes nobody accepted in time (src/app/api/cron/expire-quotes).
    // Daily, because the Hobby plan allows nothing more frequent. Payment already
    // refuses an expired quote (paymentWindow); this only updates its status and
    // emails the customer. Make it hourly ("0 * * * *") on the Pro plan.
    { path: "/api/cron/expire-quotes", schedule: "0 6 * * *" },
  ],
};
