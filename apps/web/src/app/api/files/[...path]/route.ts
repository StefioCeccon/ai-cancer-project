import { NextRequest, NextResponse } from "next/server";
import { getSignedReadUrl, storageBackend } from "@/lib/storage";

/**
 * Serves uploaded files when they are NOT present on the local filesystem.
 *
 * A Next.js `afterFiles` rewrite sends `/uploads/:path*` here only when no static
 * file matched — i.e. on the R2-backed deploy, never in local dev where the files
 * live under `public/uploads`. We 302-redirect to a short-lived R2 signed URL so the
 * browser (and the DICOM viewer's range requests) stream bytes directly from R2,
 * never through the server (zero egress).
 *
 * Access model: stored paths are unguessable (UUID study id + UUID filename) and the
 * signed URL is short-lived — a capability URL. Requests for `/uploads/*.dcm` etc. are
 * outside the Clerk middleware matcher (dot-paths), so we intentionally do not call
 * `auth()` here. TODO (Phase 5): add ownership-scoped signing for the multi-tenant demo.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (storageBackend !== "r2") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { path } = await params;
  const webPath = `/uploads/${path.join("/")}`;
  const url = await getSignedReadUrl(webPath, 21_600); // 6h
  return NextResponse.redirect(url, 302);
}
