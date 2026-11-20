// Recover a locked-out account (e.g. a forgotten password) by setting a new
// password. Run it like the seed script, from your own machine against the
// database (Render's free tier has no shell):
//
//   RESET_EMAIL=you@example.com RESET_PASSWORD='new password' npm run reset-password
//
// It changes only that account's password hash. Sessions are not revoked
// (logins are stateless JWTs); to sign everyone out, change JWT_SECRET.
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../models/User";

export const MIN_PASSWORD_LENGTH = 6; // same rule as sign-up

export type ResetResult = { ok: true; role: string } | { ok: false; reason: string };

export async function resetPassword(email: string, newPassword: string): Promise<ResetResult> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) return { ok: false, reason: `No account found for ${email}.` };
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  return { ok: true, role: user.role };
}

async function main() {
  dotenv.config();
  const { MONGODB_URI, RESET_EMAIL, RESET_PASSWORD } = process.env;
  if (!MONGODB_URI || !RESET_EMAIL || !RESET_PASSWORD) {
    console.error("Set MONGODB_URI, RESET_EMAIL and RESET_PASSWORD (see the comment at the top of this file).");
    process.exit(1);
  }
  const { connectDB } = await import("../config/db");
  await connectDB(MONGODB_URI);
  const result = await resetPassword(RESET_EMAIL, RESET_PASSWORD);
  if (result.ok) console.log(`Password updated for ${RESET_EMAIL} (${result.role}). Sign in with the new password.`);
  else console.error(result.reason);
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
