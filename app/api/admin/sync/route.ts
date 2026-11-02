export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getSyncOverview } from "@/lib/sync/syncDriveIndex";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const overview = await getSyncOverview();
  return NextResponse.json(overview);
}
