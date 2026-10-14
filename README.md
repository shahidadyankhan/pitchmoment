# PitchMoment ⚽

**One photo in, a stadium football clip out.** Users upload a selfie, pick a move (keepy-uppy, bicycle kick, penalty, knee-slide, trophy lift…), and an AI image-to-video model renders a 5–10 s vertical clip of them on the pitch under the floodlights.

Built with Next.js 14 (App Router) + TypeScript. No database and no other dependencies needed to start.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # optional — runs in Demo mode without keys
npm run dev                     # http://localhost:3000
```

With no API key the app runs in **Demo mode**. It simulates a ~10 s render and returns a sample clip, so you can try the whole flow at no cost.

## Turn on real AI video

Add **one** key to `.env.local` and restart:

| Provider | Key variable | Default model | Notes |
|---|---|---|---|
| **fal.ai** | `FAL_KEY` | `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | Simplest; pay per clip |
| **Replicate** | `REPLICATE_API_TOKEN` | `kwaivgi/kling-v2.1` | Set `REPLICATE_IMAGE_FIELD` if you switch models (`image` for Wan) |
| **Runway** | `RUNWAYML_API_SECRET` | `gen4_turbo` | `RUNWAY_RATIO=720:1280` for vertical |

The provider is picked automatically (fal → Replicate → Runway → Demo). To force one, set `VIDEO_PROVIDER=fal|replicate|runway|mock`. Model IDs are plain env vars, so you can move to a newer model without touching code. Check the provider's model page for the current ID.

## How it works

```
Browser                         Next.js server                     AI provider
───────                         ──────────────                     ───────────
resize photo → JPEG ≤1280px
POST /api/generate  ─────────▶  validate, rate-limit
 (photo, trendId, consent)      build prompt from trend ────────▶  submit image-to-video job
                                save job (.data/jobs.json)  ◀────  job id
poll GET /api/jobs/:id ──────▶  poll provider ──────────────────▶  queued / running / done
                                on success: download clip
                                → .data/videos/<id>.mp4
play /api/videos/:id  ◀───────  stream with HTTP range support
```

- **Provider layer** (`src/lib/providers/`): each backend is one file implementing `submit()` and `poll()`. To add Kling direct, Luma, Pika or a self-hosted model, write one more file and register it in `index.ts`.
- **Trends** (`src/lib/trends.ts`): each card is a prompt recipe. Edit prompts, add moves, or change colours here; the UI renders whatever is in the list.
- **Persistence**: finished clips are downloaded to `.data/videos` because provider URLs expire (Replicate after about 1 hour). Set `PERSIST_VIDEOS=false` to skip this.
- **Cost guard**: `RATE_LIMIT_PER_HOUR` (default 10) limits generations per IP.
- **Consent**: users must confirm they have the right to use the photo before generating.

## Project layout

```
src/
  app/
    page.tsx, layout.tsx, globals.css    UI shell + styles (plain CSS, no Tailwind)
    api/generate/route.ts                POST: upload + start job
    api/jobs/route.ts                    GET: gallery (recent finished clips)
    api/jobs/[id]/route.ts               GET: poll one job
    api/provider/route.ts                GET: which backend is active
    api/videos/[id]/route.ts             GET: stream saved clip (range requests)
  components/Studio.tsx                  The whole client experience
  lib/
    providers/{fal,replicate,runway,mock}.ts
    jobs.ts        file-backed job store + video download
    rateLimit.ts   per-IP limiter
    trends.ts      move templates + prompts
    image.ts       client-side resize + thumbnail
public/demo/mock-clip.mp4                clip returned in Demo mode
```

## Going to production

The file-based store and in-memory rate limiter assume **one server with a writable disk**, which covers a VPS, Docker, Railway or Render. For serverless or multi-instance hosting (e.g. Vercel):

1. Replace `src/lib/jobs.ts` with Postgres/Redis (same exported functions).
2. Store clips in S3/R2/Supabase Storage instead of `.data/videos`.
3. Replace the rate limiter with Redis (e.g. Upstash).
4. Optionally switch polling to provider **webhooks** (all three support them).
5. Add auth (NextAuth/Clerk) if you want per-user galleries; today the gallery shows the most recent clips on the server.

Also consider an NSFW/face check on uploads and your own terms of use. Video generation is billed per clip, so keep the rate limit on for any public deployment.
