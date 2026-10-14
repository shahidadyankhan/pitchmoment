"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { preparePhoto, type PreparedPhoto } from "@/lib/image";
import { TRENDS, type Trend } from "@/lib/trends";
import type { PublicJob } from "@/lib/types";

type Stage = "compose" | "generating" | "done" | "error";
type ProviderInfo = { id: string | null; label: string; demo: boolean; error?: string };

const STATUS_LINES = [
  "Switching on the floodlights…",
  "Lacing up your boots…",
  "Walking you out of the tunnel…",
  "Filling the stands…",
  "Rendering your first touch…",
  "Lining up the broadcast cameras…",
  "Final whistle approaching…",
];

export default function Studio() {
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [trendId, setTrendId] = useState(TRENDS[0].id);
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<Stage>("compose");
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<PublicJob[]>([]);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trend = TRENDS.find((t) => t.id === trendId) ?? TRENDS[0];

  // ── Initial data ──────────────────────────────────────────
  const loadGallery = useCallback(async () => {
    try {
      const r = await fetch("/api/jobs", { cache: "no-store" });
      const d = (await r.json()) as { jobs: PublicJob[] };
      setGallery(d.jobs ?? []);
    } catch {
      /* gallery is optional */
    }
  }, []);

  useEffect(() => {
    fetch("/api/provider", { cache: "no-store" })
      .then((r) => r.json())
      .then(setProvider)
      .catch(() => setProvider(null));
    loadGallery();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [loadGallery]);

  // Rotate the fun status lines while rendering
  useEffect(() => {
    if (stage !== "generating") return;
    const t = setInterval(() => setLineIdx((i) => (i + 1) % STATUS_LINES.length), 2600);
    return () => clearInterval(t);
  }, [stage]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Photo handling ────────────────────────────────────────
  async function onFile(f: File | undefined | null) {
    if (!f) return;
    setPhotoError(null);
    setBusyPhoto(true);
    try {
      const p = await preparePhoto(f);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      setPhoto(p);
      if (stage !== "generating") setStage("compose");
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setBusyPhoto(false);
    }
  }

  // ── Generate + poll ───────────────────────────────────────
  async function generate() {
    if (!photo || !consent) return;
    setError(null);
    setStage("generating");
    setLineIdx(0);
    setJob(null);
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    const fd = new FormData();
    fd.append("photo", photo.file);
    fd.append("trendId", trendId);
    fd.append("consent", String(consent));
    fd.append("thumbnail", photo.thumbnail);

    try {
      const r = await fetch("/api/generate", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Something went wrong.");
      setJob(d.job);
      poll(d.job.id, 0);
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  }

  function poll(id: string, attempt: number) {
    // 2s early on, easing off to 5s for long renders
    const delay = Math.min(5000, 2000 + attempt * 250);
    pollTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Lost track of the job.");
        const j = d.job as PublicJob;
        setJob(j);
        if (j.status === "succeeded") {
          setStage("done");
          loadGallery();
          return;
        }
        if (j.status === "failed") {
          setError(j.error ?? "The render failed. Try another photo or trend.");
          setStage("error");
          return;
        }
        poll(id, attempt + 1);
      } catch (e) {
        if (attempt > 6) {
          setError((e as Error).message);
          setStage("error");
        } else {
          poll(id, attempt + 1);
        }
      }
    }, delay);
  }

  function reset() {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setStage("compose");
    setJob(null);
    setError(null);
  }

  async function share(url: string) {
    const abs = new URL(url, window.location.href).toString();
    try {
      if (navigator.share) {
        try {
          const blob = await (await fetch(abs)).blob();
          const file = new File([blob], "my-pitch-moment.mp4", { type: "video/mp4" });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: "My stadium moment" });
            return;
          }
        } catch {
          /* fall through to link share */
        }
        await navigator.share({ url: abs, title: "My stadium moment" });
        return;
      }
      await navigator.clipboard.writeText(abs);
      setToast("Link copied");
    } catch {
      /* user cancelled */
    }
  }

  const canGenerate = !!photo && consent && stage !== "generating";
  const progress = Math.round((job?.progress ?? 0) * 100);

  return (
    <div className="app">
      <div className="floodlights" aria-hidden />

      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-ball" aria-hidden>
            ⚽
          </span>
          Pitch<span>Moment</span>
        </a>
        {provider && (
          <span className={`provider-badge ${provider.demo ? "is-demo" : ""} ${provider.error ? "is-bad" : ""}`}>
            <i aria-hidden />
            {provider.error ? "Provider misconfigured" : provider.demo ? "Demo mode · no API key" : `Powered by ${provider.label}`}
          </span>
        )}
      </header>

      <main className="layout">
        {/* ── Left: composer ─────────────────────────────── */}
        <section className="composer">
          <p className="eyebrow">The trend everyone&apos;s doing</p>
          <h1>
            One photo.
            <br />
            <em>Your</em> stadium moment.
          </h1>
          <p className="lede">
            Upload a selfie, pick a move, and AI puts you on the pitch under the floodlights. Ready in about a minute.
          </p>

          <div className="step">
            <div className="step-head">
              <span className="step-num">1</span>
              <h2>Add your photo</h2>
            </div>
            <label
              className={`dropzone ${photo ? "has-photo" : ""} ${busyPhoto ? "is-busy" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("is-over");
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove("is-over")}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("is-over");
                onFile(e.dataTransfer.files?.[0]);
              }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onFile(e.target.files?.[0])}
                data-testid="photo-input"
              />
              <div className="avatar">
                {photo ? <img src={photo.previewUrl} alt="Your photo" /> : <span className="avatar-empty">🙂</span>}
                <span className="avatar-plus" aria-hidden>
                  +
                </span>
              </div>
              <div className="dz-text">
                <strong>{busyPhoto ? "Preparing photo…" : photo ? "Looking good — tap to change" : "Drop a selfie or tap to upload"}</strong>
                <span>Clear face, good light, looking at the camera. JPG, PNG or WebP.</span>
              </div>
            </label>
            {photoError && <p className="field-error">{photoError}</p>}
          </div>

          <div className="step">
            <div className="step-head">
              <span className="step-num">2</span>
              <h2>Pick your move</h2>
            </div>
            <div className="trends" role="radiogroup" aria-label="Trend">
              {TRENDS.map((t) => (
                <TrendCard key={t.id} trend={t} selected={t.id === trendId} onSelect={() => setTrendId(t.id)} />
              ))}
            </div>
          </div>

          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>This is me, or I have permission from the person in the photo.</span>
          </label>

          <button className="cta" disabled={!canGenerate} onClick={generate}>
            {stage === "generating" ? "Rendering your moment…" : "Put me on the pitch"}
            <span aria-hidden>→</span>
          </button>
          {!photo && <p className="hint">Add a photo to start.</p>}
          {photo && !consent && <p className="hint">Tick the permission box to continue.</p>}
        </section>

        {/* ── Right: the 9:16 stage ──────────────────────── */}
        <section className="stage-wrap" ref={stageRef}>
          <div className={`stage stage-${stage}`} style={{ "--c1": trend.colors[0], "--c2": trend.colors[1] } as CSSProperties}>
            {stage === "done" && job?.videoUrl ? (
              <video key={job.videoUrl} src={job.videoUrl} autoPlay loop muted playsInline controls className="stage-video" />
            ) : (
              <div className="pitch" aria-hidden>
                <div className="crowd" />
                <div className="pitch-lines" />
                <div className="pitch-ball">{trend.icon}</div>
              </div>
            )}

            <div className="stage-banner">
              {stage === "done" ? "You made the highlights ✨" : `${trend.title} · ${trend.tagline}`}
            </div>

            {stage === "generating" && (
              <div className="rings" aria-live="polite">
                <span />
                <span />
                <span />
                <span />
                <div className="rings-core">
                  <strong>{progress > 0 ? `${progress}%` : "…"}</strong>
                  <small>{job?.status === "queued" ? "In the queue" : STATUS_LINES[lineIdx]}</small>
                </div>
              </div>
            )}

            {stage === "error" && (
              <div className="stage-error" role="alert">
                <strong>Offside!</strong>
                <p>{error}</p>
                <button onClick={reset}>Try again</button>
              </div>
            )}

            <div className="your-photo">
              <div className="your-photo-img">
                {photo ? <img src={photo.previewUrl} alt="" /> : <span>🙂</span>}
                <b aria-hidden>+</b>
              </div>
              <span>Your Photo</span>
            </div>

            {stage === "generating" && (
              <div className="progress" aria-hidden>
                <i style={{ width: `${Math.max(4, progress)}%` }} />
              </div>
            )}
          </div>

          {stage === "done" && job?.videoUrl && (
            <div className="result-actions">
              <a className="btn primary" href={job.videoUrl} download={`pitchmoment-${job.trendId}.mp4`}>
                Download
              </a>
              <button className="btn" onClick={() => share(job.videoUrl!)}>
                Share
              </button>
              <button className="btn ghost" onClick={reset}>
                Make another
              </button>
            </div>
          )}
          {provider?.demo && stage === "done" && (
            <p className="demo-note">Demo mode returns a sample clip. Add an API key in <code>.env.local</code> for real AI video.</p>
          )}
        </section>
      </main>

      {gallery.length > 0 && (
        <section className="gallery">
          <h2>Your moments</h2>
          <div className="gallery-grid">
            {gallery.map((g) => {
              const t = TRENDS.find((x) => x.id === g.trendId);
              return (
                <a
                  key={g.id}
                  className="gallery-item"
                  href={g.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={g.thumbnail ? ({ "--thumb": `url(${g.thumbnail})` } as CSSProperties) : undefined}
                >
                  <video src={`${g.videoUrl}#t=0.1`} muted loop playsInline preload="metadata" onMouseEnter={(e) => e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} />
                  <div className="gallery-meta">
                    {g.thumbnail && <img src={g.thumbnail} alt="" />}
                    <span>{t?.title ?? g.trendId}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <footer className="footer">
        Clips are AI-generated. Only upload photos you have the right to use.
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function TrendCard({ trend, selected, onSelect }: { trend: Trend; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`trend ${selected ? "is-selected" : ""}`}
      style={{ "--c1": trend.colors[0], "--c2": trend.colors[1] } as CSSProperties}
      onClick={onSelect}
    >
      <span className="trend-icon" aria-hidden>
        {trend.icon}
      </span>
      <span className="trend-title">{trend.title}</span>
      <span className="trend-tag">{trend.tagline}</span>
    </button>
  );
}
