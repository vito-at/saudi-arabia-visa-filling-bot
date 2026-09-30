import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { loadCallbacks } from "@/lib/callbacks-data";

export const dynamic = "force-dynamic";

/** Напоминания о звонках для всплывающего виджета (свои и нераспределённые лиды) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });
  return NextResponse.json({ items: await loadCallbacks(user, { personal: true }) });
}
