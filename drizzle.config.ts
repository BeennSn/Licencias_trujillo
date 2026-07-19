import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// .env.local es donde Next.js y `vercel env pull` guardan las variables
// reales (incluida DATABASE_URL); dotenv/config por defecto solo lee .env.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
