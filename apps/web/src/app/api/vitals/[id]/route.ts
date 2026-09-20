import { NextRequest, NextResponse } from "next/server";
import { db, patientVitals } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";

const optionalPositive = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}, z.number().positive().nullable().optional());

const optionalBp = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}, z.number().int().min(40).max(300).nullable().optional());

const updateVitalSchema = z
  .object({
    recordedAt: z.string().min(1).optional(),
    weightKg: optionalPositive,
    heightCm: optionalPositive,
    bpSystolic: optionalBp,
    bpDiastolic: optionalBp,
    notes: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasSys = data.bpSystolic !== undefined && data.bpSystolic != null;
    const hasDia = data.bpDiastolic !== undefined && data.bpDiastolic != null;
    const clearedSys = data.bpSystolic === null;
    const clearedDia = data.bpDiastolic === null;
    if ((hasSys && data.bpDiastolic === undefined) || (hasDia && data.bpSystolic === undefined)) {
      // partial update of one BP field alone is ok if the other stays in DB —
      // validated after merge in handler when both provided in body
    }
    if ((clearedSys && !clearedDia && data.bpDiastolic != null) || (clearedDia && !clearedSys && data.bpSystolic != null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Blood pressure needs both systolic and diastolic, or clear both",
      });
    }
  });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const [row] = await db.select().from(patientVitals).where(eq(patientVitals.id, id));
    if (!row || !(await canAccessPatient(row.patientId, userId, "viewer"))) {
      return NextResponse.json({ error: "Vital not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: row, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const [existing] = await db.select().from(patientVitals).where(eq(patientVitals.id, id));
    if (!existing || !(await canAccessPatient(existing.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Vital not found", success: false }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateVitalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false, message: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    }

    const next = { ...existing, ...parsed.data };
    const hasWeight = next.weightKg != null;
    const hasHeight = next.heightCm != null;
    const hasSys = next.bpSystolic != null;
    const hasDia = next.bpDiastolic != null;
    if (!hasWeight && !hasHeight && !hasSys && !hasDia) {
      return NextResponse.json(
        { error: "Enter at least weight, height, or blood pressure", success: false },
        { status: 400 },
      );
    }
    if (hasSys !== hasDia) {
      return NextResponse.json(
        { error: "Blood pressure needs both systolic (high) and diastolic (low)", success: false },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(patientVitals)
      .set({
        recordedAt: parsed.data.recordedAt ?? existing.recordedAt,
        weightKg: parsed.data.weightKg !== undefined ? parsed.data.weightKg : existing.weightKg,
        heightCm: parsed.data.heightCm !== undefined ? parsed.data.heightCm : existing.heightCm,
        bpSystolic: parsed.data.bpSystolic !== undefined ? parsed.data.bpSystolic : existing.bpSystolic,
        bpDiastolic: parsed.data.bpDiastolic !== undefined ? parsed.data.bpDiastolic : existing.bpDiastolic,
        notes: parsed.data.notes !== undefined ? parsed.data.notes : existing.notes,
      })
      .where(eq(patientVitals.id, id))
      .returning();

    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { id } = await params;
    const [existing] = await db.select().from(patientVitals).where(eq(patientVitals.id, id));
    if (!existing || !(await canAccessPatient(existing.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Vital not found", success: false }, { status: 404 });
    }

    const [deleted] = await db.delete(patientVitals).where(eq(patientVitals.id, id)).returning();
    return NextResponse.json({ data: deleted, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
