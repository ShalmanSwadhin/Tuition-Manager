import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";
import { migrateLegacyAdmins } from "./utils/migrateLegacyAdmins";

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI || !process.env.JWT_SECRET) {
  console.error("MONGODB_URI and JWT_SECRET must be set (see .env.example).");
  process.exit(1);
}

connectDB(MONGODB_URI)
  .then(migrateLegacyAdmins)
  .then(() => {
    app.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("[server] failed to start", err);
    process.exit(1);
  });
