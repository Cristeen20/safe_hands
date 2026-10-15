import { execFileSync } from "node:child_process";
import { ADMIN_PHONE } from "./helpers";

export default function globalSetup() {
  // Idempotent: creates the admin or re-promotes the existing user.
  execFileSync("pnpm", ["seed:admin", ADMIN_PHONE, "E2E Admin"], { stdio: "inherit" });
}
