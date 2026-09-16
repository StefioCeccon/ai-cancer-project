import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, imagingStudies, patients, users } from "@/lib/db";
import { seedDemoForUser } from "@/lib/demo/seedDemoForUser";

// Imaging backfill inserts ~150 rows; allow enough time on Vercel.
export const maxDuration = 60;

/**
 * Force demo seed / imaging backfill for the signed-in user and return status.
 * Resolves the user without triggering the background seed in getUserIdentity,
 * so we don't race two inserts.
 */
export async function POST() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const demoMode =
    process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (!demoMode) {
    return NextResponse.json(
      {
        error: "Demo mode is off",
        hint: "Set DEMO_MODE=true (and/or NEXT_PUBLIC_DEMO_MODE=true) on Vercel, then retry.",
      },
      { status: 400 },
    );
  }

  const row = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });
  if (!row) {
    return NextResponse.json({ error: "User not provisioned yet — load any page once first" }, { status: 400 });
  }

  try {
    await seedDemoForUser(row.id);

    const patientRows = await db
      .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })
      .from(patients)
      .where(eq(patients.userId, row.id));

    const imagingRows = await db
      .select({
        id: imagingStudies.id,
        description: imagingStudies.description,
        instanceCount: imagingStudies.instanceCount,
      })
      .from(imagingStudies)
      .where(eq(imagingStudies.userId, row.id));

    return NextResponse.json({
      ok: true,
      patients: patientRows,
      imaging: imagingRows,
    });
  } catch (e) {
    console.error("[demo] /api/demo/ensure failed", e);
    const err = e as Error & { cause?: unknown };
    const cause =
      err.cause instanceof Error
        ? err.cause.message
        : err.cause
          ? String(err.cause)
          : undefined;
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(e),
        cause,
      },
      { status: 500 },
    );
  }
}
