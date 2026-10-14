import type { VideoProvider } from "./types";

/**
 * Demo provider: no AI, no key, no cost. Simulates a ~10 second render and
 * returns the bundled demo clip so the whole UI flow can be tried locally.
 */
const RENDER_MS = 10_000;
const QUEUE_MS = 1_500;

export const mockProvider: VideoProvider = {
  id: "mock",
  label: "Demo mode",
  isConfigured: () => true,

  async submit() {
    return { externalId: `mock_${Date.now()}` };
  },

  async poll(externalId) {
    const started = Number(externalId.replace("mock_", "")) || Date.now();
    const elapsed = Date.now() - started;
    if (elapsed < QUEUE_MS) return { status: "queued", progress: 0.05 };
    if (elapsed < RENDER_MS) return { status: "running", progress: Math.min(0.95, elapsed / RENDER_MS) };
    return { status: "succeeded", videoUrl: "/demo/mock-clip.mp4", progress: 1 };
  },
};
