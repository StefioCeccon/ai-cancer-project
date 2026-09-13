import { NextRequest, NextResponse } from "next/server";
import { db, symptoms } from "@/lib/db";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId, isPatientOwnedBy } from "@/lib/auth/user";

const createSymptomSchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(1),
  severity: z.enum(["mild", "moderate", "severe"]).optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  rawText: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  sourceTitle: z.string().optional().nullable(),
});

const bulkCreateSchema = z.object({
  patientId: z.string().uuid(),
  rawText: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  sourceTitle: z.string().optional().nullable(),
  symptoms: z.array(
    createSymptomSchema.omit({ patientId: true }).extend({
      startDate: z.string().min(1),
    })
  ).min(1),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    const rows = patientId
      ? await db
          .select()
          .from(symptoms)
          .where(and(eq(symptoms.userId, userId), eq(symptoms.patientId, patientId)))
          .orderBy(desc(symptoms.startDate), desc(symptoms.createdAt))
      : await db
          .select()
          .from(symptoms)
          .where(eq(symptoms.userId, userId))
          .orderBy(desc(symptoms.startDate), desc(symptoms.createdAt));

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

    if (body.symptoms && Array.isArray(body.symptoms)) {
      const parsed = bulkCreateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors, success: false },
          { status: 400 }
        );
      }

      const { patientId, symptoms: entries, rawText, filePath, sourceTitle } = parsed.data;

      if (!(await isPatientOwnedBy(patientId, userId))) {
        return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
      }

      const created = await db
        .insert(symptoms)
        .values(
          entries.map((entry) => ({
            patientId,
            userId,
            name: entry.name,
            severity: entry.severity ?? null,
            startDate: entry.startDate,
            endDate: entry.endDate ?? null,
            notes: entry.notes ?? null,
            rawText: rawText ?? null,
            filePath: filePath ?? null,
            sourceTitle: sourceTitle ?? null,
          }))
        )
        .returning();

      return NextResponse.json({ data: created, success: true }, { status: 201 });
    }

    const parsed = createSymptomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    if (!(await isPatientOwnedBy(parsed.data.patientId, userId))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const [created] = await db.insert(symptoms).values({ ...parsed.data, userId }).returning();
    return NextResponse.json({ data: created, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
