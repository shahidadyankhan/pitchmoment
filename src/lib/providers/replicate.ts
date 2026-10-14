import { readError, type VideoProvider } from "./types";

/**
 * Replicate predictions API (official models endpoint).
 *   POST https://api.replicate.com/v1/models/{owner}/{name}/predictions  { input }
 *   GET  https://api.replicate.com/v1/predictions/{id}
 *        status: starting | processing | succeeded | failed | canceled
 *        output: string URL (or array of URLs)
 * Auth header: "Authorization: Bearer <REPLICATE_API_TOKEN>"
 */
const API = "https://api.replicate.com/v1";

function token() {
  return process.env.REPLICATE_API_TOKEN ?? "";
}
function model() {
  return process.env.REPLICATE_MODEL || "kwaivgi/kling-v2.1";
}
function imageField() {
  return process.env.REPLICATE_IMAGE_FIELD || "start_image";
}
function headers() {
  return { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };
}

export const replicateProvider: VideoProvider = {
  id: "replicate",
  label: "Replicate",
  isConfigured: () => token().length > 0,

  async submit({ imageDataUri, prompt, negativePrompt, durationSec }) {
    const input: Record<string, unknown> = {
      prompt,
      [imageField()]: imageDataUri, // Replicate accepts data URIs for file inputs
      duration: durationSec >= 10 ? 10 : 5,
    };
    if (negativePrompt) input.negative_prompt = negativePrompt;

    const res = await fetch(`${API}/models/${model()}/predictions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ input }),
    });
    if (!res.ok) throw new Error(`Replicate submit failed — ${await readError(res)}`);
    const data = (await res.json()) as { id: string };
    return { externalId: data.id };
  },

  async poll(externalId) {
    const res = await fetch(`${API}/predictions/${externalId}`, { headers: headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`Replicate poll failed — ${await readError(res)}`);
    const p = (await res.json()) as {
      status: string;
      output?: string | string[] | null;
      error?: string | null;
      logs?: string;
    };

    switch (p.status) {
      case "starting":
        return { status: "queued" };
      case "processing":
        return { status: "running" };
      case "succeeded": {
        const url = Array.isArray(p.output) ? p.output[0] : p.output;
        if (!url) return { status: "failed", error: "Replicate returned no video" };
        return { status: "succeeded", videoUrl: url, progress: 1 };
      }
      default:
        return { status: "failed", error: p.error ?? `Replicate status ${p.status}` };
    }
  },
};
