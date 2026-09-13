import { NextRequest, NextResponse } from "next/server";
import { db, bloodTests, bloodMarkers } from "@/lib/db";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId, isPatientOwnedBy } from "@/lib/auth/user";

const optionalNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());

const markerSchema = z.object({
  name: z.string().min(1),
  value: z.coerce.number(),
  unit: z.preprocess((value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text || "-";
  }, z.string().min(1)),
  referenceMin: optionalNumber,
  referenceMax: optionalNumber,
  status: z.enum(["normal", "low", "high", "critical_low", "critical_high"]).default("normal"),
  notes: z.string().optional().nullable(),
});

const createBloodTestSchema = z.object({
  patientId: z.string().uuid(),
  testDate: z.string().min(1),
  labName: z.string().optional().nullable(),
  requestingPhysician: z.string().optional().nullable(),
  markers: z.array(markerSchema).default([]),
  rawText: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    const tests = patientId
      ? await db.select().from(bloodTests).where(and(eq(bloodTests.userId, userId), eq(bloodTests.patientId, patientId))).orderBy(desc(bloodTests.testDate), desc(bloodTests.createdAt))
      : await db.select().from(bloodTests).where(eq(bloodTests.userId, userId)).orderBy(desc(bloodTests.testDate), desc(bloodTests.createdAt));

    const testIds = tests.map((t: typeof tests[number]) => t.id);

    type MarkerRow = typeof bloodMarkers.$inferSelect;

    // Fetch markers for all tests in parallel
    const allMarkers: MarkerRow[][] =
      testIds.length > 0
        ? await Promise.all(
            testIds.map((id: string) =>
              db.select().from(bloodMarkers).where(eq(bloodMarkers.bloodTestId, id))
            )
          )
        : [];

    const markersMap = new Map<string, MarkerRow[]>();
    testIds.forEach((id: string, i: number) => {
      markersMap.set(id, allMarkers[i] ?? []);
    });

    const data = tests.map((test: typeof tests[number]) => ({
      ...test,
      markers: markersMap.get(test.id) ?? [],
    }));

    return NextResponse.json({ data, success: true });
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
    const parsed = createBloodTestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const { markers, ...testData } = parsed.data;

    if (!(await isPatientOwnedBy(testData.patientId, userId))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.transaction(async (tx: any) => {
      const [createdTest] = await tx
        .insert(bloodTests)
        .values({ ...testData, userId })
        .returning();

      let createdMarkers: (typeof bloodMarkers.$inferSelect)[] = [];
      if (markers.length > 0) {
        createdMarkers = await tx
          .insert(bloodMarkers)
          .values(markers.map((m: z.infer<typeof markerSchema>) => ({ ...m, bloodTestId: createdTest.id })))
          .returning();
      }

      return { ...createdTest, markers: createdMarkers };
    });

    return NextResponse.json({ data: result, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
