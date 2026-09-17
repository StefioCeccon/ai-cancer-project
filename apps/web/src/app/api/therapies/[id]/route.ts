import { NextRequest, NextResponse } from "next/server";
import { db, therapies, therapyMedications } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";

const medicationSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().optional().nullable(),
  dosage: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  route: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateTherapySchema = z.object({
  name: z.string().min(1).optional(),
  therapyType: z.enum([
    "chemotherapy", "immunotherapy", "radiation", "surgery",
    "targeted_therapy", "hormone_therapy", "supportive_care", "other",
  ]).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().optional().nullable(),
  dosage: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  rawText: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  sourceTitle: z.string().optional().nullable(),
  medications: z.array(medicationSchema).optional(),
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
    const [therapy] = await db.select().from(therapies).where(eq(therapies.id, id));

    if (!therapy || !(await canAccessPatient(therapy.patientId, userId, "viewer"))) {
      return NextResponse.json({ error: "Therapy not found", success: false }, { status: 404 });
    }

    const medications = await db
      .select()
      .from(therapyMedications)
      .where(eq(therapyMedications.therapyId, id));

    return NextResponse.json({ data: { ...therapy, medications }, success: true });
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
    const [existing] = await db.select().from(therapies).where(eq(therapies.id, id));
    if (!existing || !(await canAccessPatient(existing.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Therapy not found", success: false }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateTherapySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const { medications, ...therapyFields } = parsed.data;

    // Sequential writes — neon-http does not support db.transaction()
    const [updated] = await db
      .update(therapies)
      .set(therapyFields)
      .where(eq(therapies.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Therapy not found", success: false }, { status: 404 });
    }

    if (medications !== undefined) {
      await db.delete(therapyMedications).where(eq(therapyMedications.therapyId, id));
      if (medications.length > 0) {
        await db.insert(therapyMedications).values(
          medications.map((m: z.infer<typeof medicationSchema>) => ({ ...m, therapyId: id })),
        );
      }
    }

    const updatedMeds = await db
      .select()
      .from(therapyMedications)
      .where(eq(therapyMedications.therapyId, id));

    return NextResponse.json({ data: { ...updated, medications: updatedMeds }, success: true });
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
    const [existing] = await db.select().from(therapies).where(eq(therapies.id, id));
    if (!existing || !(await canAccessPatient(existing.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Therapy not found", success: false }, { status: 404 });
    }

    const [deleted] = await db.delete(therapies).where(eq(therapies.id, id)).returning();

    if (!deleted) {
      return NextResponse.json({ error: "Therapy not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: deleted, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
