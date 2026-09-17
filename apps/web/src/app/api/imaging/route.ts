import { NextRequest, NextResponse } from "next/server";
import { db, imagingStudies } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";
import { canAccessPatient, getAccessiblePatientIds, inArray } from "@/lib/auth/access";

const createImagingStudySchema = z.object({
  patientId: z.string().uuid(),
  modality: z.enum(["CT", "MRI", "PET", "XRAY", "ULTRASOUND", "OTHER"]),
  studyDate: z.string().min(1),
  bodyPart: z.string().min(1),
  description: z.string().optional().nullable(),
  seriesCount: z.number().int().nonnegative().optional(),
  instanceCount: z.number().int().nonnegative().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    let data;
    if (patientId) {
      if (!(await canAccessPatient(patientId, userId, "viewer"))) {
        return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
      }
      data = await db
        .select()
        .from(imagingStudies)
        .where(eq(imagingStudies.patientId, patientId))
        .orderBy(desc(imagingStudies.createdAt));
    } else {
      const ids = await getAccessiblePatientIds(userId);
      if (!ids.length) {
        return NextResponse.json({ data: [], success: true });
      }
      data = await db
        .select()
        .from(imagingStudies)
        .where(inArray(imagingStudies.patientId, ids))
        .orderBy(desc(imagingStudies.createdAt));
    }

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
    const parsed = createImagingStudySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    if (!(await canAccessPatient(parsed.data.patientId, userId, "collaborator"))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const [created] = await db
      .insert(imagingStudies)
      .values({
        ...parsed.data,
        userId,
        seriesCount: parsed.data.seriesCount ?? 0,
        instanceCount: parsed.data.instanceCount ?? 0,
      })
      .returning();

    return NextResponse.json({ data: created, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
