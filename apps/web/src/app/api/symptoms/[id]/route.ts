import { NextRequest, NextResponse } from "next/server";
import { db, symptoms } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";

const updateSymptomSchema = z.object({
  name: z.string().min(1).optional(),
  severity: z.enum(["mild", "moderate", "severe"]).optional().nullable(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  rawText: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  sourceTitle: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const [row] = await db.select().from(symptoms).where(eq(symptoms.id, id));

    if (!row || !(await canAccessPatient(row.patientId, userId, "viewer"))) {
      return NextResponse.json({ error: "Symptom not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: row, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

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
    const [existing] = await db.select().from(symptoms).where(eq(symptoms.id, id));
    if (!existing || !(await canAccessPatient(existing.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Symptom not found", success: false }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSymptomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(symptoms)
      .set(parsed.data)
      .where(eq(symptoms.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Symptom not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const [existing] = await db.select().from(symptoms).where(eq(symptoms.id, id));
    if (!existing || !(await canAccessPatient(existing.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Symptom not found", success: false }, { status: 404 });
    }

    const [deleted] = await db.delete(symptoms).where(eq(symptoms.id, id)).returning();

    if (!deleted) {
      return NextResponse.json({ error: "Symptom not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: deleted, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
