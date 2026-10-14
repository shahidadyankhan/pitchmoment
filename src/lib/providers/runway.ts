import { readError, type VideoProvider } from "./types";

/**
 * Runway developer API.
 *   POST https://api.dev.runwayml.com/v1/image_to_video
 *        { model, promptImage, promptText, ratio, duration }   → { id }
 *   GET  https://api.dev.runwayml.com/v1/tasks/{id}
 *        status: PENDING | THROTTLED | RUNNING | SUCCEEDED | FAILED | CANCELLED
 *        output: [videoUrl], progress: 0..1
 * Headers: "Authorization: Bearer <secret>", "X-Runway-Version: 2024-11-06"
 */
const API = "https://api.dev.runwayml.com/v1";

function secret() {
  return process.env.RUNWAYML_API_SECRET ?? "";
}
function headers() {
  return {
    Authorization: `Bearer ${secret()}`,
    "X-Runway-Version": "2024-11-06",
    "Content-Type": "application/json",
  };
}

export const runwayProvider: VideoProvider = {
  id: "runway",
  label: "Runway",
  isConfigured: () => secret().length > 0,

  async submit({ imageDataUri, prompt, durationSec }) {
    const res = await fetch(`${API}/image_to_video`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: process.env.RUNWAY_MODEL || "gen4_turbo",
        promptImage: imageDataUri, // Runway accepts base64 data URIs
        promptText: prompt.slice(0, 1000), // Runway caps prompt length
        ratio: process.env.RUNWAY_RATIO || "720:1280",
        duration: durationSec >= 10 ? 10 : 5,
      }),
    });
    if (!res.ok) throw new Error(`Runway submit failed — ${await readError(res)}`);
    const data = (await res.json()) as { id: string };
    return { externalId: data.id };
  },

  async poll(externalId) {
    const res = await fetch(`${API}/tasks/${externalId}`, { headers: headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`Runway poll failed — ${await readError(res)}`);
    const t = (await res.json()) as {
      status: string;
      output?: string[];
      failure?: string;
      progress?: number;
    };

    switch (t.status) {
      case "PENDING":
      case "THROTTLED":
        return { status: "queued" };
      case "RUNNING":
        return { status: "running", progress: t.progress };
      case "SUCCEEDED":
        if (!t.output?.[0]) return { status: "failed", error: "Runway returned no video" };
        return { status: "succeeded", videoUrl: t.output[0], progress: 1 };
      default:
        return { status: "failed", error: t.failure ?? `Runway status ${t.status}` };
    }
  },
};
