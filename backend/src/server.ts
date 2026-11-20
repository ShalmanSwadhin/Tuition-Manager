import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import { migrateLegacyAdmins } from "./utils/migrateLegacyAdmins";
import { checkAuthConfig, sessionDays } from "./config/auth";

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

const { errors, warnings } = checkAuthConfig();
if (!MONGODB_URI) errors.push("MONGODB_URI is not set.");
warnings.forEach((w) => console.warn(`[config] ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`[config] ${e}`));
  console.error("Fix these environment variables (see .env.example) and redeploy.");
  process.exit(1);
}
console.log(`[auth] logins last ${sessionDays()} days`);

connectDB(MONGODB_URI as string)
  .then(migrateLegacyAdmins)
  .then(() => {
    app.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("[server] failed to start", err);
    process.exit(1);
  });
