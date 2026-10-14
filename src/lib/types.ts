import type { JobStatus, ProviderId } from "./providers/types";

/** A generation job as stored on the server and returned to the browser. */
export interface Job {
  id: string;
  provider: ProviderId;
  externalId: string;
  /** Provider-specific polling data. Never sent to the browser. */
  meta?: Record<string, string>;
  trendId: string;
  status: JobStatus;
  progress?: number;
  videoUrl?: string;
  error?: string;
  /** Small JPEG data URI of the uploaded photo, for the gallery */
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

export type PublicJob = Omit<Job, "meta" | "externalId">;

export function toPublic(job: Job): PublicJob {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { meta, externalId, ...rest } = job;
  return rest;
}

export type { JobStatus, ProviderId };
