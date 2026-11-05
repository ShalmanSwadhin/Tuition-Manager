import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db";
import User from "../models/User";

async function run() {
  const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  await connectDB(MONGODB_URI);

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    console.log(`A ${existing.role} account already exists for ${ADMIN_EMAIL} — no changes made.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({
    name: ADMIN_NAME || "Admin",
    email: ADMIN_EMAIL.toLowerCase(),
    passwordHash,
    role: "admin",
  });

  console.log(`Admin account created for ${ADMIN_EMAIL}.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
