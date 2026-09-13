import { NextRequest, NextResponse } from "next/server";
import { db, bloodTests, bloodMarkers } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";

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
    const [test] = await db
      .select()
      .from(bloodTests)
      .where(and(eq(bloodTests.id, id), eq(bloodTests.userId, userId)));

    if (!test) {
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
    const body = await request.json();
    const parsed = updateBloodTestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const { markers, ...testFields } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(bloodTests)
        .set(testFields)
        .where(and(eq(bloodTests.id, id), eq(bloodTests.userId, userId)))
        .returning();

      if (!updated) return null;

      if (markers !== undefined) {
        await tx.delete(bloodMarkers).where(eq(bloodMarkers.bloodTestId, id));
        if (markers.length > 0) {
          await tx.insert(bloodMarkers).values(
            markers.map((m: z.infer<typeof markerSchema>) => ({ ...m, bloodTestId: id }))
          );
        }
      }

      const updatedMarkers = await tx
        .select()
        .from(bloodMarkers)
        .where(eq(bloodMarkers.bloodTestId, id));

      return { ...updated, markers: updatedMarkers };
    });

    if (!result) {
      return NextResponse.json({ error: "Blood test not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: result, success: true });
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
      .delete(bloodTests)
      .where(and(eq(bloodTests.id, id), eq(bloodTests.userId, userId)))
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
