import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Create apps/web/.env.local and add DATABASE_URL=postgresql://..."
  );
}

// url is now narrowed to string — capture in a const so TypeScript knows it's non-nullable
const dbUrl: string = url;

// Auto-detect driver:
//   Neon cloud URLs (*.neon.tech) → @neondatabase/serverless (HTTP, works on Vercel/Edge)
//   Everything else (local, Supabase, Railway, etc.) → postgres.js (standard TCP)
function createDb() {
  if (dbUrl.includes("neon.tech") || dbUrl.includes("neon.database")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require("@neondatabase/serverless");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/neon-http");
    return drizzle(neon(dbUrl), { schema });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require("postgres");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/postgres-js");
  const client = postgres(dbUrl, { max: 10 });
  return drizzle(client, { schema });
}

// Reuse the connection pool across hot reloads in dev to avoid exhausting connections.
const globalWithDb = global as typeof global & { _db?: ReturnType<typeof createDb> };
export const db = globalWithDb._db ?? createDb();
if (process.env.NODE_ENV !== "production") globalWithDb._db = db;

export * from "./schema";
