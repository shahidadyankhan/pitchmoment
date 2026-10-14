/**
 * The provider contract. Every AI video backend implements these two calls:
 * submit a job, then poll it until it finishes. Adding a new backend means
 * writing one file that satisfies this interface and registering it in index.ts.
 */

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface GenerateInput {
  /** The user's photo as a base64 data URI (data:image/jpeg;base64,...) */
  imageDataUri: string;
  prompt: string;
  negativePrompt?: string;
  /** Clip length in seconds */
  durationSec: number;
}

export interface SubmitResult {
  /** The provider's own id for the job (plus anything needed to poll it) */
  externalId: string;
  /** Opaque data the provider needs at poll time (e.g. fal's status URLs) */
  meta?: Record<string, string>;
}

export interface PollResult {
  status: JobStatus;
  videoUrl?: string;
  error?: string;
  /** 0..1 when the provider reports it */
  progress?: number;
}

export interface VideoProvider {
  id: ProviderId;
  label: string;
  /** True when the provider has credentials and can be used */
  isConfigured(): boolean;
  submit(input: GenerateInput): Promise<SubmitResult>;
  poll(externalId: string, meta?: Record<string, string>): Promise<PollResult>;
}

export type ProviderId = "fal" | "replicate" | "runway" | "mock";

/** Small helper so every provider reports HTTP errors the same way */
export async function readError(res: Response): Promise<string> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    /* ignore */
  }
  try {
    const j = JSON.parse(body);
    body = j.detail ?? j.error ?? j.message ?? body;
    if (typeof body !== "string") body = JSON.stringify(body);
  } catch {
    /* not JSON */
  }
  return `${res.status} ${res.statusText}${body ? `: ${body.slice(0, 300)}` : ""}`;
}
