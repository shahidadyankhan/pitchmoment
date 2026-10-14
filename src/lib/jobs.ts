import { promises as fs, createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getProvider } from "./providers";
import type { Job } from "./types";

/**
 * Tiny file-backed job store: an in-memory Map mirrored to .data/jobs.json.
 * Good for a single server. For multi-instance deploys swap this module for
 * Postgres/Redis — the rest of the app only uses the exported functions.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
export const VIDEO_DIR = path.join(DATA_DIR, "videos");
const MAX_JOBS = 200;

type Store = { jobs: Map<string, Job>; loaded: boolean; persisting: Set<string> };
const g = globalThis as unknown as { __pitchStore?: Store };
const store: Store = (g.__pitchStore ??= { jobs: new Map(), loaded: false, persisting: new Set() });

async function load() {
  if (store.loaded) return;
  store.loaded = true;
  try {
    const raw = await fs.readFile(JOBS_FILE, "utf8");
    for (const j of JSON.parse(raw) as Job[]) store.jobs.set(j.id, j);
  } catch {
    /* first run — nothing saved yet */
  }
}

let writeChain: Promise<void> = Promise.resolve();
function save() {
  // Serialise writes so concurrent requests never interleave the file.
  writeChain = writeChain
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const all = [...store.jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_JOBS);
      const tmp = `${JOBS_FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(all));
      await fs.rename(tmp, JOBS_FILE);
    })
    .catch((e) => console.error("[jobs] save failed", e));
  return writeChain;
}

export async function createJob(job: Job) {
  await load();
  store.jobs.set(job.id, job);
  await save();
  return job;
}

export async function getJob(id: string) {
  await load();
  return store.jobs.get(id);
}

export async function listJobs(limit = 24) {
  await load();
  return [...store.jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

async function update(id: string, patch: Partial<Job>) {
  const cur = store.jobs.get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch, updatedAt: Date.now() };
  store.jobs.set(id, next);
  await save();
  return next;
}

/** Ask the provider for news on a job that hasn't finished yet. */
export async function refreshJob(id: string): Promise<Job | undefined> {
  const job = await getJob(id);
  if (!job || job.status === "succeeded" || job.status === "failed") return job;

  try {
    const r = await getProvider(job.provider).poll(job.externalId, job.meta);
    if (r.status === "succeeded" && r.videoUrl) {
      const videoUrl = await maybePersist(job.id, r.videoUrl);
      return update(id, { status: "succeeded", progress: 1, videoUrl, error: undefined });
    }
    return update(id, { status: r.status, progress: r.progress ?? job.progress, error: r.error });
  } catch (e) {
    // Transient network errors: keep the job alive, surface the message, try again next poll.
    // Give up after 20 minutes so a dead job doesn't spin forever.
    const msg = e instanceof Error ? e.message : String(e);
    const expired = Date.now() - job.createdAt > 20 * 60_000;
    return update(id, expired ? { status: "failed", error: msg } : { error: msg });
  }
}

/** Download the finished clip so provider links (which expire) aren't needed later. */
async function maybePersist(id: string, url: string): Promise<string> {
  if (process.env.PERSIST_VIDEOS === "false" || url.startsWith("/")) return url;
  if (store.persisting.has(id)) return url;
  store.persisting.add(id);
  try {
    await fs.mkdir(VIDEO_DIR, { recursive: true });
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
    const file = path.join(VIDEO_DIR, `${id}.mp4`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(file));
    return `/api/videos/${id}`;
  } catch (e) {
    console.warn("[jobs] could not persist video, using provider URL", e);
    return url;
  } finally {
    store.persisting.delete(id);
  }
}
