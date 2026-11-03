import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db";
import Admin from "../models/Admin";

async function run() {
  const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  await connectDB(MONGODB_URI);

  const existing = await Admin.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    console.log(`Admin already exists for ${ADMIN_EMAIL} — no changes made.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await Admin.create({
    name: ADMIN_NAME || "Admin",
    email: ADMIN_EMAIL.toLowerCase(),
    passwordHash,
  });

  console.log(`Admin account created for ${ADMIN_EMAIL}.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
