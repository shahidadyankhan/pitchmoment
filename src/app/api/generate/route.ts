import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createJob } from "@/lib/jobs";
import { getActiveProvider, type VideoProvider } from "@/lib/providers";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { DEFAULT_NEGATIVE_PROMPT, getTrend } from "@/lib/trends";
import { toPublic } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Send the photo as multipart/form-data.");
  }

  const photo = form.get("photo");
  const trendId = String(form.get("trendId") ?? "");
  const consent = form.get("consent") === "true";
  const thumbnail = String(form.get("thumbnail") ?? "");

  if (!(photo instanceof File)) return bad("Please add a photo.");
  if (!ALLOWED.has(photo.type)) return bad("Use a JPG, PNG or WebP photo.");
  if (photo.size > MAX_BYTES) return bad("That photo is over 8 MB — try a smaller one.");
  const trend = getTrend(trendId);
  if (!trend) return bad("Pick a trend first.");
  if (!consent) return bad("Please confirm you have the right to use this photo.");

  const limit = checkRateLimit(clientIp(req));
  if (!limit.ok) {
    return NextResponse.json(
      { error: `You've hit the hourly limit. Try again in about ${limit.retryInMin} min.` },
      { status: 429 },
    );
  }

  let provider: VideoProvider;
  try {
    provider = getActiveProvider();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  const imageDataUri = `data:${photo.type};base64,${bytes.toString("base64")}`;

  try {
    const { externalId, meta } = await provider.submit({
      imageDataUri,
      prompt: trend.prompt,
      negativePrompt: trend.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT,
      durationSec: Number(process.env.CLIP_SECONDS ?? 5),
    });

    const now = Date.now();
    const job = await createJob({
      id: randomUUID(),
      provider: provider.id,
      externalId,
      meta,
      trendId: trend.id,
      status: "queued",
      progress: 0,
      thumbnail: thumbnail.startsWith("data:image/") && thumbnail.length < 60_000 ? thumbnail : undefined,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ job: toPublic(job) }, { status: 202 });
  } catch (e) {
    console.error("[generate]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
