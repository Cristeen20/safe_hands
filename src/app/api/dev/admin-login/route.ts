import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * LOCAL DEVELOPMENT ONLY: sign in as an admin or helper without a code.
 *
 *   http://localhost:3000/api/dev/admin-login             → first admin
 *   http://localhost:3000/api/dev/admin-login?email=a@b.c → that admin
 *   http://localhost:3000/api/dev/admin-login?role=helper → first helper
 *     (creates a local "Dev Helper" if there is none yet)
 *
 * Disabled (404) unless `next dev` is running AND DEV_ADMIN_LOGIN=1 is set.
 * It creates a real Better Auth session through the normal email-code
 * sign-in, so role checks (D9) behave exactly as after a real sign-in.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_ADMIN_LOGIN !== "1") {
    return new Response("Not found", { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const role = params.get("role") === "helper" ? "helper" : "admin";
  const wanted = params.get("email")?.toLowerCase();
  let [account] = await db
    .select({ email: user.email })
    .from(user)
    .where(wanted ? and(eq(user.email, wanted), eq(user.role, role)) : eq(user.role, role))
    .orderBy(asc(user.createdAt))
    .limit(1);
  if (!account && role === "helper" && !wanted) {
    account = { email: "helper@dev.invalid" };
    await db
      .insert(user)
      .values({ id: randomUUID(), name: "Dev Helper", email: account.email, emailVerified: true, role })
      .onConflictDoUpdate({ target: user.email, set: { role } });
  }
  if (!account) {
    return new Response('No such admin. Create one with: pnpm seed:admin "you@example.com" "Name"', {
      status: 404,
    });
  }

  const otp = await auth.api.createVerificationOTP({ body: { email: account.email, type: "sign-in" } });
  const signIn = await auth.api.signInEmailOTP({
    body: { email: account.email, otp },
    headers: request.headers,
    asResponse: true,
  });
  if (!signIn.ok) return new Response("Sign-in failed", { status: 500 });

  const res = new Response(null, {
    status: 303,
    headers: { Location: new URL(role === "helper" ? "/en-GB/helper" : "/en-GB/admin/requests", request.url).toString() },
  });
  for (const cookie of signIn.headers.getSetCookie()) res.headers.append("Set-Cookie", cookie);
  return res;
}
