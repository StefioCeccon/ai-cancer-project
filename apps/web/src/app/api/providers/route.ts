import { NextResponse } from "next/server";
import { getConfiguredProvidersForUser } from "@/lib/ai/keys";
import { getCurrentUserId } from "@/lib/auth/user";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const providers = await getConfiguredProvidersForUser(userId);
    return NextResponse.json({ success: true, data: providers });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
