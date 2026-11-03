export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { requireSession } from "@/lib/auth/require-admin";
import { getDownloadHistory } from "@/lib/downloads/history";

export async function GET() {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const history = await getDownloadHistory({
    userId: session.user.id,
    role: session.user.role as Role,
  });

  return NextResponse.json({
    history,
    scope: session.user.role === "ADMIN" ? "all" : "own",
  });
}
