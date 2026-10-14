import { falProvider } from "./fal";
import { mockProvider } from "./mock";
import { replicateProvider } from "./replicate";
import { runwayProvider } from "./runway";
import type { ProviderId, VideoProvider } from "./types";

export const PROVIDERS: Record<ProviderId, VideoProvider> = {
  fal: falProvider,
  replicate: replicateProvider,
  runway: runwayProvider,
  mock: mockProvider,
};

/**
 * Pick the active provider.
 * 1. VIDEO_PROVIDER, if set (throws if that provider has no key — fail loudly, not silently to mock)
 * 2. otherwise the first provider with credentials: fal → replicate → runway
 * 3. otherwise mock
 */
export function getActiveProvider(): VideoProvider {
  const wanted = (process.env.VIDEO_PROVIDER ?? "").trim().toLowerCase() as ProviderId | "";
  if (wanted) {
    const p = PROVIDERS[wanted];
    if (!p) throw new Error(`Unknown VIDEO_PROVIDER "${wanted}". Use fal, replicate, runway or mock.`);
    if (!p.isConfigured()) throw new Error(`VIDEO_PROVIDER is "${wanted}" but its API key is not set.`);
    return p;
  }
  for (const id of ["fal", "replicate", "runway"] as const) {
    if (PROVIDERS[id].isConfigured()) return PROVIDERS[id];
  }
  return mockProvider;
}

export function getProvider(id: ProviderId): VideoProvider {
  return PROVIDERS[id];
}

export type { ProviderId, VideoProvider } from "./types";
