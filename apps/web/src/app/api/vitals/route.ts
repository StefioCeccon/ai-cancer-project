import { NextRequest, NextResponse } from "next/server";
import { db, patientVitals } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient, getAccessiblePatientIds, inArray } from "@/lib/auth/access";

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

const createVitalSchema = z
  .object({
    patientId: z.string().uuid(),
    recordedAt: z.string().min(1),
    weightKg: optionalPositive,
    heightCm: optionalPositive,
    bpSystolic: optionalBp,
    bpDiastolic: optionalBp,
    notes: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasWeight = data.weightKg != null;
    const hasHeight = data.heightCm != null;
    const hasSys = data.bpSystolic != null;
    const hasDia = data.bpDiastolic != null;
    if (!hasWeight && !hasHeight && !hasSys && !hasDia) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter at least weight, height, or blood pressure",
      });
    }
    if (hasSys !== hasDia) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Blood pressure needs both systolic (high) and diastolic (low)",
        path: ["bpSystolic"],
      });
    }
  });

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    let rows;
    if (patientId) {
      if (!(await canAccessPatient(patientId, userId, "viewer"))) {
        return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
      }
      rows = await db
        .select()
        .from(patientVitals)
        .where(eq(patientVitals.patientId, patientId))
        .orderBy(desc(patientVitals.recordedAt), desc(patientVitals.createdAt));
    } else {
      const ids = await getAccessiblePatientIds(userId);
      if (!ids.length) {
        return NextResponse.json({ data: [], success: true });
      }
      rows = await db
        .select()
        .from(patientVitals)
        .where(inArray(patientVitals.patientId, ids))
        .orderBy(desc(patientVitals.recordedAt), desc(patientVitals.createdAt));
    }

    return NextResponse.json({ data: rows, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createVitalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false, message: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (!(await canAccessPatient(data.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const [created] = await db
      .insert(patientVitals)
      .values({
        userId,
        patientId: data.patientId,
        recordedAt: data.recordedAt,
        weightKg: data.weightKg ?? null,
        heightCm: data.heightCm ?? null,
        bpSystolic: data.bpSystolic ?? null,
        bpDiastolic: data.bpDiastolic ?? null,
        notes: data.notes ?? null,
      })
      .returning();

    return NextResponse.json({ data: created, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
