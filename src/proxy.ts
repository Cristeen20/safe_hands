import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale routing only. Authorization happens on the server in every page and
// action (src/lib/authz.ts), never here.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
