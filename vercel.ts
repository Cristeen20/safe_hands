import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    // D14: expire quotes nobody accepted in time (src/app/api/cron/expire-quotes).
    { path: "/api/cron/expire-quotes", schedule: "0 * * * *" },
  ],
};
