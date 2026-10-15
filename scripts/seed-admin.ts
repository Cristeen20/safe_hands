/**
 * Create (or promote) the first admin (D15). Later admins and helpers are
 * invited from the admin portal.
 *
 *   pnpm seed:admin "+447400123456" "Ada Admin"
 *   pnpm seed:admin "ada@example.com" "Ada Admin"
 *
 * The admin then signs in with that phone number (SMS code) or email (email
 * code). Indian admins must use email: we never text Indian numbers (D20).
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import { canReceiveSms } from "../src/lib/phone";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const [identifier, name = "Admin"] = process.argv.slice(2);
  const isEmail = !!identifier && EMAIL.test(identifier);
  if (!identifier || (!isEmail && !canReceiveSms(identifier))) {
    console.error(
      'Usage: pnpm seed:admin "<email>" "Name"  or  pnpm seed:admin "+447400123456" "Name"\n' +
        "(phone must be a US, Canadian or UK number in E.164; Indian admins use email)",
    );
    process.exit(1);
  }
  const email = isEmail ? identifier.toLowerCase() : `${identifier.replace("+", "")}@phone.invalid`;
  const match = isEmail ? eq(user.email, email) : eq(user.phoneNumber, identifier);

  const [existing] = await db.select().from(user).where(match).limit(1);
  if (existing) {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, existing.id));
    console.log(`Promoted existing user ${existing.id} to admin.`);
  } else {
    const id = randomUUID();
    await db.insert(user).values({
      id,
      name,
      email,
      emailVerified: isEmail,
      phoneNumber: isEmail ? null : identifier,
      phoneNumberVerified: !isEmail,
      role: "admin",
    });
    console.log(`Created admin ${id} for ${identifier}.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
