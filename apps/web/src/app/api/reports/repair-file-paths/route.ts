import { NextRequest, NextResponse } from "next/server";
import { repairReportFilePaths } from "@/lib/upload/repairReportFilePaths";
import { getCurrentUserId, isPatientOwnedBy } from "@/lib/auth/user";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const patientId = typeof body.patientId === "string" ? body.patientId : undefined;

    if (patientId && !(await isPatientOwnedBy(patientId, userId))) {
      return NextResponse.json({ error: "Patient not found", success: false }, { status: 404 });
    }

    const result = await repairReportFilePaths(userId, patientId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
