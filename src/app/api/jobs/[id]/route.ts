import { NextResponse } from "next/server";
import { refreshJob } from "@/lib/jobs";
import { toPublic } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll a job. Each call checks the provider once and returns the latest state. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const job = await refreshJob(params.id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job: toPublic(job) });
}
