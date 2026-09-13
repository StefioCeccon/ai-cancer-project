import { NextRequest, NextResponse } from "next/server";
import { parseSymptomFile } from "@/lib/upload/parseSymptomFile";
import { getCurrentUserId } from "@/lib/auth/user";
import { runWithUserKeys } from "@/lib/ai/keyContext";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file", success: false }, { status: 400 });
    }

    const result = await runWithUserKeys(userId, () => parseSymptomFile(file));
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("Symptom parse error:", e);
    return NextResponse.json({ error: "Failed to parse file", success: false }, { status: 500 });
  }
}
