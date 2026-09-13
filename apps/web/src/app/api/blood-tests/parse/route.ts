import { NextRequest, NextResponse } from "next/server";
import { parseBloodTestFile } from "@/lib/upload/parseBloodTestFile";
import { getCurrentUserId } from "@/lib/auth/user";
import { runWithUserKeys } from "@/lib/ai/keyContext";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const formData = await req.formData();
    const mode = formData.get("mode");

    return await runWithUserKeys(userId, async () => {
      if (mode === "individual") {
        const files = formData.getAll("files") as File[];
        if (!files.length) {
          return NextResponse.json({ error: "No files provided", success: false }, { status: 400 });
        }
        const results = await Promise.all(files.map((file) => parseBloodTestFile(file)));
        return NextResponse.json({ success: true, files: results });
      }

      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file", success: false }, { status: 400 });
      }

      const result = await parseBloodTestFile(file);
      return NextResponse.json({ success: true, ...result });
    });
  } catch (e) {
    console.error("Blood test parse error:", e);
    return NextResponse.json({ error: "Failed to parse file", success: false }, { status: 500 });
  }
}
