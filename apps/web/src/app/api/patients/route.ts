import { NextRequest, NextResponse } from "next/server";
import { db, patients } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/user";

const createPatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  gender: z.enum(["male", "female", "other"]).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  diagnosisDate: z.string().optional().nullable(),
  cancerType: z.string().optional().nullable(),
  cancerStage: z.string().optional().nullable(),
  primaryPhysician: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const data = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .orderBy(desc(patients.createdAt));

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
    const parsed = createPatientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors, success: false },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(patients)
      .values({
        ...parsed.data,
        userId,
        gender: parsed.data.gender ?? "other",
      })
      .returning();

    return NextResponse.json({ data: created, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
