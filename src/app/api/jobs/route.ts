import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";
import { toPublic } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent finished clips for the gallery. */
export async function GET() {
  const jobs = (await listJobs(24)).filter((j) => j.status === "succeeded");
  return NextResponse.json({ jobs: jobs.map(toPublic) });
}
