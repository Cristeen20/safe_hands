import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendSignInEmail } from "./email";
import { canReceiveSms } from "./phone";
import { sendSignInCode } from "./sms";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: google,
  user: {
    additionalFields: {
      // D15: never settable from client input. Only invitations and the
      // seed script change a role.
      role: { type: "string", required: false, defaultValue: "customer", input: false },
    },
  },
  plugins: [
    phoneNumber({
      otpLength: 4, // matches the Verify screen
      expiresIn: 5 * 60,
      allowedAttempts: 5,
      // D20: phone sign-in only for numbers we may text (never India).
      phoneNumberValidator: canReceiveSms,
      sendOTP: ({ phoneNumber, code }) => sendSignInCode(phoneNumber, code),
      signUpOnVerification: {
        // Phone-only customers have no email yet; Better Auth requires one.
        getTempEmail: (phone) => `${phone.replace("+", "")}@phone.invalid`,
        getTempName: () => "",
      },
    }),
    // Email sign-in: the only option for Indian customers (D20), and
    // "Continue with email" everywhere else.
    emailOTP({
      otpLength: 4, // same Verify screen as phone codes
      expiresIn: 5 * 60,
      allowedAttempts: 5,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === "sign-in") await sendSignInEmail(email, otp);
      },
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
