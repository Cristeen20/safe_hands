import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * LOCAL DEVELOPMENT ONLY: sign in as an admin without a code.
 *
 *   http://localhost:3000/api/dev/admin-login            → first admin
 *   http://localhost:3000/api/dev/admin-login?email=a@b.c → that admin
 *
 * Disabled (404) unless `next dev` is running AND DEV_ADMIN_LOGIN=1 is set.
 * It creates a real Better Auth session through the normal email-code
 * sign-in, so role checks (D9) behave exactly as after a real sign-in.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_ADMIN_LOGIN !== "1") {
    return new Response("Not found", { status: 404 });
  }

  const wanted = new URL(request.url).searchParams.get("email")?.toLowerCase();
  const [admin] = await db
    .select({ email: user.email })
    .from(user)
    .where(wanted ? and(eq(user.email, wanted), eq(user.role, "admin")) : eq(user.role, "admin"))
    .orderBy(asc(user.createdAt))
    .limit(1);
  if (!admin) {
    return new Response('No such admin. Create one with: pnpm seed:admin "you@example.com" "Name"', {
      status: 404,
    });
  }

  const otp = await auth.api.createVerificationOTP({ body: { email: admin.email, type: "sign-in" } });
  const signIn = await auth.api.signInEmailOTP({
    body: { email: admin.email, otp },
    headers: request.headers,
    asResponse: true,
  });
  if (!signIn.ok) return new Response("Sign-in failed", { status: 500 });

  const res = new Response(null, {
    status: 303,
    headers: { Location: new URL("/en-GB/admin/requests", request.url).toString() },
  });
  for (const cookie of signIn.headers.getSetCookie()) res.headers.append("Set-Cookie", cookie);
  return res;
}
