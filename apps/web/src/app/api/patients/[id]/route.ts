import { NextRequest, NextResponse } from "next/server";
import { db, patients } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";

const updatePatientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  diagnosisDate: z.string().optional().nullable(),
  cancerType: z.string().optional().nullable(),
  cancerStage: z.string().optional().nullable(),
  primaryPhysician: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.userId, userId)));

    if (!patient) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: patient, success: true });
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
    const body = await request.json();
    const parsed = updatePatientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(patients)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
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
    const [deleted] = await db
      .delete(patients)
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: deleted, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
