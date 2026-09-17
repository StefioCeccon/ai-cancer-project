import { NextRequest, NextResponse } from "next/server";
import { db, bloodTests, bloodMarkers } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient } from "@/lib/auth/access";

const markerSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  referenceMin: z.number().optional().nullable(),
  referenceMax: z.number().optional().nullable(),
  status: z.enum(["normal", "low", "high", "critical_low", "critical_high"]).default("normal"),
  notes: z.string().optional().nullable(),
});

const updateBloodTestSchema = z.object({
  testDate: z.string().min(1).optional(),
  labName: z.string().optional().nullable(),
  requestingPhysician: z.string().optional().nullable(),
  rawText: z.string().optional().nullable(),
  markers: z.array(markerSchema).optional(),
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
    const [test] = await db.select().from(bloodTests).where(eq(bloodTests.id, id));

    if (!test || !(await canAccessPatient(test.patientId, userId, "viewer"))) {
      return NextResponse.json({ error: "Blood test not found", success: false }, { status: 404 });
    }

    const markers = await db
      .select()
      .from(bloodMarkers)
      .where(eq(bloodMarkers.bloodTestId, id));

    return NextResponse.json({ data: { ...test, markers }, success: true });
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
    const [existing] = await db.select().from(bloodTests).where(eq(bloodTests.id, id));
    if (!existing || !(await canAccessPatient(existing.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Blood test not found", success: false }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateBloodTestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const { markers, ...testFields } = parsed.data;

    // Sequential writes — neon-http (Vercel/Neon) does not support db.transaction()
    const [updated] = await db
      .update(bloodTests)
      .set(testFields)
      .where(eq(bloodTests.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Blood test not found", success: false }, { status: 404 });
    }

    if (markers !== undefined) {
      await db.delete(bloodMarkers).where(eq(bloodMarkers.bloodTestId, id));
      if (markers.length > 0) {
        await db.insert(bloodMarkers).values(
          markers.map((m: z.infer<typeof markerSchema>) => ({ ...m, bloodTestId: id })),
        );
      }
    }

    const updatedMarkers = await db
      .select()
      .from(bloodMarkers)
      .where(eq(bloodMarkers.bloodTestId, id));

    return NextResponse.json({ data: { ...updated, markers: updatedMarkers }, success: true });
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
    const [existing] = await db.select().from(bloodTests).where(eq(bloodTests.id, id));
    if (!existing || !(await canAccessPatient(existing.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Blood test not found", success: false }, { status: 404 });
    }

    const [deleted] = await db
      .delete(bloodTests)
      .where(eq(bloodTests.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Blood test not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: deleted, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
