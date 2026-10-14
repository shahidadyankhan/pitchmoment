import { NextResponse } from "next/server";
import { getActiveProvider } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tells the UI which backend is active (so it can show the "Demo mode" badge). */
export async function GET() {
  try {
    const p = getActiveProvider();
    return NextResponse.json({ id: p.id, label: p.label, demo: p.id === "mock" });
  } catch (e) {
    return NextResponse.json({ id: null, label: "Misconfigured", demo: false, error: (e as Error).message });
  }
}
