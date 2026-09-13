import { loadEnvFile } from "node:process";
import type { Config } from "drizzle-kit";

for (const envFile of [".env", ".env.local"]) {
  try {
    loadEnvFile(envFile);
  } catch {
    // optional env files
  }
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
