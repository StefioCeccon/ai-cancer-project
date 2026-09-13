import { NextRequest, NextResponse } from "next/server";
import { db, analysisRuns } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth/user";

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
    const [run] = await db
      .select()
      .from(analysisRuns)
      .where(and(eq(analysisRuns.id, id), eq(analysisRuns.userId, userId)));

    if (!run) {
      return NextResponse.json({ error: "Analysis run not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: run, success: true });
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
      .delete(analysisRuns)
      .where(and(eq(analysisRuns.id, id), eq(analysisRuns.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Analysis run not found", success: false }, { status: 404 });
    }

    return NextResponse.json({ data: deleted, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
