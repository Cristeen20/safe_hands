import "server-only";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
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

const OPEN_ADMIN_EMAIL = "open-admin@system.invalid";

/**
 * OPEN_ADMIN=1 (set on request, at the owner's risk): the admin portal needs
 * no sign-in, and anyone using it acts as this shared "Open admin" account,
 * so quotes and the audit trail still have an actor. Delete the variable on
 * Vercel and redeploy to require sign-in again.
 */
async function openAdmin(): Promise<CurrentUser> {
  const [row] = await db
    .insert(userTable)
    .values({ id: crypto.randomUUID(), name: "Open admin", email: OPEN_ADMIN_EMAIL, emailVerified: true, role: "admin" })
    .onConflictDoUpdate({ target: userTable.email, set: { role: "admin" } })
    .returning({ id: userTable.id, name: userTable.name });
  return { id: row.id, name: row.name, role: "admin", phoneNumber: null, email: null };
}

/**
 * D9: every admin/helper page AND server action calls this. Signed-out users
 * go to sign-in; signed-in users with the wrong role get a 403 (except for
 * admin pages while OPEN_ADMIN=1 is set).
 */
export async function requireRole(
  role: Exclude<Role, "customer">,
  options?: GuardOptions,
): Promise<CurrentUser> {
  if (role === "admin" && process.env.OPEN_ADMIN === "1") {
    const current = await getCurrentUser();
    return current?.role === "admin" ? current : openAdmin();
  }
  const user = await requireUser(options);
  if (user.role !== role) forbidden();
  return user;
}
