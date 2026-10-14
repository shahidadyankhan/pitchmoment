import { readError, type VideoProvider } from "./types";

/**
 * fal.ai queue REST API.
 *   POST https://queue.fal.run/{model}          → { request_id, status_url, response_url }
 *   GET  status_url                              → { status: IN_QUEUE | IN_PROGRESS | COMPLETED }
 *   GET  response_url                            → { video: { url } }
 * Auth header: "Authorization: Key <FAL_KEY>"
 */
const QUEUE = "https://queue.fal.run";

function key() {
  return process.env.FAL_KEY ?? "";
}
function model() {
  return process.env.FAL_MODEL || "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
}
function headers() {
  return { Authorization: `Key ${key()}`, "Content-Type": "application/json" };
}

export const falProvider: VideoProvider = {
  id: "fal",
  label: "fal.ai",
  isConfigured: () => key().length > 0,

  async submit({ imageDataUri, prompt, negativePrompt, durationSec }) {
    const res = await fetch(`${QUEUE}/${model()}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        prompt,
        image_url: imageDataUri, // fal accepts data URIs here
        duration: String(durationSec >= 10 ? 10 : 5),
        negative_prompt: negativePrompt,
      }),
    });
    if (!res.ok) throw new Error(`fal submit failed — ${await readError(res)}`);
    const data = (await res.json()) as {
      request_id: string;
      status_url?: string;
      response_url?: string;
    };
    return {
      externalId: data.request_id,
      meta: {
        statusUrl: data.status_url ?? `${QUEUE}/${model()}/requests/${data.request_id}/status`,
        responseUrl: data.response_url ?? `${QUEUE}/${model()}/requests/${data.request_id}`,
      },
    };
  },

  async poll(_externalId, meta) {
    if (!meta?.statusUrl || !meta?.responseUrl) {
      return { status: "failed", error: "Missing fal status URLs for this job" };
    }
    const sRes = await fetch(meta.statusUrl, { headers: headers(), cache: "no-store" });
    if (!sRes.ok) throw new Error(`fal status failed — ${await readError(sRes)}`);
    const s = (await sRes.json()) as { status: string; error?: string };

    if (s.status === "IN_QUEUE") return { status: "queued" };
    if (s.status === "IN_PROGRESS") return { status: "running" };
    if (s.status !== "COMPLETED") return { status: "failed", error: s.error ?? `fal status ${s.status}` };

    const rRes = await fetch(meta.responseUrl, { headers: headers(), cache: "no-store" });
    if (!rRes.ok) return { status: "failed", error: `fal result — ${await readError(rRes)}` };
    const r = (await rRes.json()) as { video?: { url?: string }; detail?: unknown };
    if (!r.video?.url) return { status: "failed", error: "fal returned no video" };
    return { status: "succeeded", videoUrl: r.video.url, progress: 1 };
  },
};
