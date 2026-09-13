import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { putObject } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) ?? "misc";

    if (!file) {
      return NextResponse.json({ error: "No file provided", success: false }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop() ?? "bin";
    const filename = `${uuidv4()}.${ext}`;
    const { path } = await putObject(`/uploads/${type}/${filename}`, buffer, file.type);

    return NextResponse.json({
      success: true,
      data: {
        path,
        filename,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      },
    });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: "Upload failed", success: false }, { status: 500 });
  }
}
