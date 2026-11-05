import mongoose from "mongoose";
import User from "../models/User";

// Before teacher/student accounts existed, the single admin lived in the
// `admins` collection. Copy any such admin into `users` (role "admin") so
// existing logins keep working without re-running the seed script.
export async function migrateLegacyAdmins(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const legacy = await db.collection("admins").find({}).toArray();
  for (const a of legacy) {
    if (await User.exists({ email: a.email })) continue;
    await User.create({
      name: a.name,
      email: a.email,
      passwordHash: a.passwordHash,
      role: "admin",
      createdAt: a.createdAt,
    });
    console.log(`[migrate] moved admin ${a.email} to users`);
  }
}
