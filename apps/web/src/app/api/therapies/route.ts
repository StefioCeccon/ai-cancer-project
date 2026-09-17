import { NextRequest, NextResponse } from "next/server";
import { db, therapies, therapyMedications } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient, getAccessiblePatientIds, inArray } from "@/lib/auth/access";

const medicationSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().optional().nullable(),
  dosage: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  route: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createTherapySchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(1),
  therapyType: z.enum([
    "chemotherapy", "immunotherapy", "radiation", "surgery",
    "targeted_therapy", "hormone_therapy", "supportive_care", "other",
  ]).default("other"),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  dosage: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  rawText: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  sourceTitle: z.string().optional().nullable(),
  medications: z.array(medicationSchema).default([]),
});

const bulkCreateSchema = z.object({
  patientId: z.string().uuid(),
  rawText: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  sourceTitle: z.string().optional().nullable(),
  therapies: z.array(
    createTherapySchema.omit({ patientId: true })
  ).min(1),
});

async function attachMedications(
  therapyRows: (typeof therapies.$inferSelect)[]
) {
  const ids = therapyRows.map((t) => t.id);
  if (ids.length === 0) return therapyRows.map((t) => ({ ...t, medications: [] }));

  const allMeds = await Promise.all(
    ids.map((id) =>
      db.select().from(therapyMedications).where(eq(therapyMedications.therapyId, id))
    )
  );

  return therapyRows.map((t, i) => ({
    ...t,
    medications: allMeds[i] ?? [],
  }));
}

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
        .from(therapies)
        .where(eq(therapies.patientId, patientId))
        .orderBy(desc(therapies.startDate), desc(therapies.createdAt));
    } else {
      const ids = await getAccessiblePatientIds(userId);
      if (!ids.length) {
        return NextResponse.json({ data: [], success: true });
      }
      rows = await db
        .select()
        .from(therapies)
        .where(inArray(therapies.patientId, ids))
        .orderBy(desc(therapies.startDate), desc(therapies.createdAt));
    }

    const data = await attachMedications(rows);
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

    if (body.therapies && Array.isArray(body.therapies)) {
      const parsed = bulkCreateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors, success: false },
          { status: 400 }
        );
      }

      const { patientId, therapies: entries, rawText, filePath, sourceTitle } = parsed.data;

      if (!(await canAccessPatient(patientId, userId, "collaborator"))) {
        return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = await db.transaction(async (tx: any) => {
        const results = [];
        for (const entry of entries) {
          const { medications, ...therapyData } = entry;
          const [therapy] = await tx
            .insert(therapies)
            .values({
              patientId,
              userId,
              ...therapyData,
              rawText: rawText ?? null,
              filePath: filePath ?? null,
              sourceTitle: sourceTitle ?? null,
            })
            .returning();

          let meds: (typeof therapyMedications.$inferSelect)[] = [];
          if (medications.length > 0) {
            meds = await tx
              .insert(therapyMedications)
              .values(medications.map((m: z.infer<typeof medicationSchema>) => ({ ...m, therapyId: therapy.id })))
              .returning();
          }
          results.push({ ...therapy, medications: meds });
        }
        return results;
      });

      return NextResponse.json({ data: created, success: true }, { status: 201 });
    }

    const parsed = createTherapySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const { medications, ...therapyData } = parsed.data;

    if (!(await canAccessPatient(therapyData.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.transaction(async (tx: any) => {
      const [therapy] = await tx.insert(therapies).values({ ...therapyData, userId }).returning();

      let meds: (typeof therapyMedications.$inferSelect)[] = [];
      if (medications.length > 0) {
        meds = await tx
          .insert(therapyMedications)
          .values(medications.map((m: z.infer<typeof medicationSchema>) => ({ ...m, therapyId: therapy.id })))
          .returning();
      }

      return { ...therapy, medications: meds };
    });

    return NextResponse.json({ data: result, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
