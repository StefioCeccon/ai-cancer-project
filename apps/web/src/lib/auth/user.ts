import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  users,
  patients,
  imagingStudies,
  bloodTests,
  medicalReports,
  symptoms,
  therapies,
  analysisRuns,
} from "@/lib/db";

export type UserIdentity = {
  internalUserId: string;
  clerkUserId: string;
  email?: string | null;
};

/**
 * One-time adoption of pre-auth ("orphan") rows that have no owner yet.
 * Gated behind CLAIM_ORPHAN_DATA so only a trusted local/self-hosted instance
 * adopts existing data — the public demo must never auto-claim seeded rows.
 * Idempotent: only touches rows where user_id IS NULL.
 */
async function claimOrphanData(internalUserId: string) {
  if (process.env.CLAIM_ORPHAN_DATA !== "true") return;
  try {
    await db.update(patients).set({ userId: internalUserId }).where(isNull(patients.userId));
    await db.update(imagingStudies).set({ userId: internalUserId }).where(isNull(imagingStudies.userId));
    await db.update(bloodTests).set({ userId: internalUserId }).where(isNull(bloodTests.userId));
    await db.update(medicalReports).set({ userId: internalUserId }).where(isNull(medicalReports.userId));
    await db.update(symptoms).set({ userId: internalUserId }).where(isNull(symptoms.userId));
    await db.update(therapies).set({ userId: internalUserId }).where(isNull(therapies.userId));
    await db.update(analysisRuns).set({ userId: internalUserId }).where(isNull(analysisRuns.userId));
  } catch (e) {
    console.error("[auth] claimOrphanData failed", e);
  }
}

/**
 * Resolve (or lazily create) the internal user row for the current Clerk session.
 * Cached per-request. Returns null when there is no authenticated session.
 */
export const getUserIdentity = cache(async (): Promise<UserIdentity | null> => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  let row = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });

  if (!row) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? null;

    const internalUserId = `usr_${randomUUID()}`;
    await db
      .insert(users)
      .values({ id: internalUserId, clerkUserId, email })
      .onConflictDoNothing({ target: users.clerkUserId });

    row = await db.query.users.findFirst({
      where: eq(users.clerkUserId, clerkUserId),
    });
    if (!row) throw new Error("Failed to resolve user after insert");
  }

  // Demo mode: seed (or backfill missing imaging) for this account. Idempotent.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    try {
      const { seedDemoForUser } = await import("@/lib/demo/seedDemoForUser");
      await seedDemoForUser(row.id);
    } catch (e) {
      console.error("[demo] seedDemoForUser failed", e);
    }
  }

  // Self-healing: while the flag is on, adopt any still-orphaned rows on every
  // request (idempotent — only touches user_id IS NULL). Lets an existing user
  // claim data even if their account predates the flag being set.
  await claimOrphanData(row.id);

  return { internalUserId: row.id, clerkUserId, email: row.email ?? null };
});

/** Internal user id for the current session, or throw (use in route handlers). */
export async function getInternalUserIdOrThrow(): Promise<string> {
  const identity = await getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity.internalUserId;
}

/** Internal user id for the current session, or null (for explicit 401 handling). */
export async function getCurrentUserId(): Promise<string | null> {
  const identity = await getUserIdentity();
  return identity?.internalUserId ?? null;
}

/** True when the given patient exists and belongs to the user. */
export async function isPatientOwnedBy(patientId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)));
  return Boolean(row);
}
