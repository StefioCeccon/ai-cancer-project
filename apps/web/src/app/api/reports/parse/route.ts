import { NextRequest, NextResponse } from "next/server";
import { parseReportFile, extractReportMetadata } from "@/lib/upload/parseReportFile";
import { getCurrentUserId } from "@/lib/auth/user";
import { runWithUserKeys } from "@/lib/ai/keyContext";

export type { ParsedReportMetadata } from "@/lib/upload/parseReportFile";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const mode = formData.get("mode");

    if (!files.length) {
      return NextResponse.json({ error: "No files provided", success: false }, { status: 400 });
    }

    return await runWithUserKeys(userId, async () => {
      if (mode === "individual") {
        const results = await Promise.all(files.map((file) => parseReportFile(file)));
        return NextResponse.json({ success: true, files: results });
      }

      const parsed = await Promise.all(files.map((file) => parseReportFile(file)));
      const combinedText = parsed.map((p) => p.text).join("\n\n---\n\n").trim();
      const metadata = await extractReportMetadata(combinedText);

      return NextResponse.json({ success: true, text: combinedText, metadata });
    });
  } catch (e) {
    console.error("Parse error:", e);
    return NextResponse.json({ error: "Failed to parse files", success: false }, { status: 500 });
  }
}
