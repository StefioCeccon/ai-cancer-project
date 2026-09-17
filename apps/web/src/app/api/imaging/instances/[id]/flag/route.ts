import { NextRequest, NextResponse } from "next/server";
import { db, imagingInstances, imagingSeries, imagingStudies } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const flagged = typeof body.flagged === "boolean" ? body.flagged : undefined;

    if (flagged === undefined) {
      return NextResponse.json({ error: "flagged (boolean) is required", success: false }, { status: 400 });
    }

    const [row] = await db
      .select({
        id: imagingInstances.id,
        patientId: imagingStudies.patientId,
      })
      .from(imagingInstances)
      .innerJoin(imagingSeries, eq(imagingInstances.seriesId, imagingSeries.id))
      .innerJoin(imagingStudies, eq(imagingSeries.studyId, imagingStudies.id))
      .where(eq(imagingInstances.id, id));

    if (!row || !(await canAccessPatient(row.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Instance not found", success: false }, { status: 404 });
    }

    const [updated] = await db
      .update(imagingInstances)
      .set({ flaggedForAI: flagged })
      .where(eq(imagingInstances.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Instance not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
