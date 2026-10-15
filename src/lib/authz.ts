import "server-only";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "./region";
import { auth } from "./auth";
import { isDeliverableEmail } from "./email";

export type Role = "customer" | "admin" | "helper";

export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
  phoneNumber: string | null;
  /** Null for phone-only accounts that haven't given an email yet. */
  email: string | null;
};

/** The signed-in user, or null. Reads the request, so call it inside Suspense. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; phoneNumber?: string | null };
  return {
    id: u.id,
    name: u.name,
    role: (u.role ?? "customer") as Role,
    phoneNumber: u.phoneNumber ?? null,
    email: isDeliverableEmail(u.email) ? u.email : null,
  };
}

type GuardOptions = {
  /** Where to return after signing in. */
  next?: string;
  /** Required in server actions, where the locale can't be read from the route. */
  locale?: AppLocale;
};

/** The signed-in user; redirects to sign-in when there isn't one. */
export async function requireUser({ next, locale: given }: GuardOptions = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const locale = given ?? (await getLocale());
    const href = next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";
    return redirect({ href, locale });
  }
  return user;
}

/**
 * D9: every admin/helper page AND server action calls this. Signed-out users
 * go to sign-in; signed-in users with the wrong role get a 403.
 */
export async function requireRole(
  role: Exclude<Role, "customer">,
  options?: GuardOptions,
): Promise<CurrentUser> {
  const user = await requireUser(options);
  if (user.role !== role) forbidden();
  return user;
}
