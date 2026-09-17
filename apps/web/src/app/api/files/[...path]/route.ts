import { NextRequest, NextResponse } from "next/server";
import { storageBackend, getObjectForResponse } from "@/lib/storage";
import { getCurrentUserId } from "@/lib/auth/user";
import { userCanReadUploadPath } from "@/lib/storage/authorizeUploadPath";

/**
 * Authenticated file proxy (no redirect to R2).
 * Browser Network tab only shows `/uploads/...` on our origin — requires the
 * caller's session cookie. Supports HTTP Range for DICOM loaders.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  if (!path?.length || path.some((p) => p === ".." || p.includes("\\"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const webPath = `/uploads/${path.join("/")}`;
  const allowed = await userCanReadUploadPath(userId, webPath);
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Local: static public/uploads usually wins; if rewrite hits us, stream from disk/R2 helper
  try {
    const range = req.headers.get("range");
    const obj = await getObjectForResponse(webPath, range);

    const headers = new Headers();
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    if (obj.contentType) headers.set("Content-Type", obj.contentType);
    else if (webPath.endsWith(".dcm")) headers.set("Content-Type", "application/dicom");
    else if (webPath.endsWith(".pdf")) headers.set("Content-Type", "application/pdf");
    else if (webPath.endsWith(".png")) headers.set("Content-Type", "image/png");
    if (obj.contentLength != null) headers.set("Content-Length", String(obj.contentLength));
    if (obj.acceptRanges) headers.set("Accept-Ranges", obj.acceptRanges);
    if (obj.contentRange) headers.set("Content-Range", obj.contentRange);

    const body =
      obj.body instanceof Buffer
        ? new Uint8Array(obj.body)
        : (obj.body as BodyInit);

    return new NextResponse(body, { status: obj.status, headers });
  } catch (e) {
    console.error("[files] proxy failed", storageBackend, webPath, e);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function HEAD(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const res = await GET(req, ctx);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
