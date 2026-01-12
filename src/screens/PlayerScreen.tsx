import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../player/PlayerProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { useToast } from "../ui/Toast";

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function resolveAudioUrl(audioPath: string) {
  const base =
    (import.meta as any).env?.VITE_BACKEND_URL ||
    (import.meta as any).env?.VITE_API_URL ||
    "https://audio-reader-backend-production.up.railway.app";
  const b = String(base).replace(/\/+$/, "");
  if (!audioPath) return "";
  if (audioPath.startsWith("http://") || audioPath.startsWith("https://")) return audioPath;
  return `${b}${audioPath.startsWith("/") ? "" : "/"}${audioPath}`;
}

export function PlayerScreen() {
  const nav = useNavigate();
  const { toast } = useToast();
  const p = usePlayer();

  const [sheetOpen, setSheetOpen] = useState(false);

  const progress = useMemo(() => {
    if (!p.duration) return 0;
    return (p.position / p.duration) * 100;
  }, [p.position, p.duration]);

  const canPlay = p.hasAudio;

  const audioSrc = resolveAudioUrl(((p as any).state?.chapters?.[(p as any).state?.index ?? 0]?.audio_path) || "");

  async function onRecap() {
    try {
      const text = await p.recap();
      if (!text) {
        toast("Resumen vacío.");
        return;
      }
      await navigator.clipboard.writeText(text);
      toast("Resumen copiado al portapapeles.");
    } catch (e: any) {
      toast(e?.message || "Error generando resumen");
    }
  }

  if (!p.hasAudio) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "12px 14px",
            paddingTop: "calc(12px + env(safe-area-inset-top))",
            background: "rgba(10,12,16,0.86)",
            borderBottom: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <button className="btn" onClick={() => nav(-1)}>← Volver</button>
        </div>
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 14 }}>
          <div className="muted" style={{ textAlign: "center" }}>
            Nada reproduciéndose. Ve a un libro y toca un capítulo con audio.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div
        style={{
          padding: "12px 14px",
          paddingTop: "calc(12px + env(safe-area-inset-top))",
          background: "rgba(10,12,16,0.86)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn" onClick={() => nav(-1)}>←</button>
          <button className="btn" onClick={() => setSheetOpen(true)}>⚙️</button>
        </div>

        <div style={{ marginTop: 10, textAlign: "center" }}>
          <div style={{ fontWeight: 950, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.nowTitle}
          </div>
          <div className="small muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.nowSubtitle}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16, paddingBottom: 24 }}>
        <div
          className="card"
          style={{
            padding: 18,
            borderRadius: 22,
            display: "grid",
            placeItems: "center",
            height: 220,
            background:
              "radial-gradient(520px 260px at 20% 0%, rgba(98,140,255,0.22), transparent 65%), rgba(0,0,0,0.20)"
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>🎧</div>
            <div className="small muted" style={{ marginTop: 6 }}>
              Velocidad: {p.rate}x
            </div>
          </div>
        </div>
        
<audio
  controls
  preload="auto"
  style={{ width: "100%", marginTop: 20 }}
  src="https://audio-reader-backend-production.up.railway.app/audio/8be2f3df-ecf2-44e6-85ba-a8538a9baee8/alloy/learning/chapter-0.mp3"
/>


        {/* Slider */}
        <div style={{ marginTop: 16 }}>
          <input
            type="range"
            min={0}
            max={100}
            value={isFinite(progress) ? progress : 0}
            onChange={e => {
              if (!p.duration) return;
              const pct = Number(e.target.value || 0) / 100;
              p.seekTo(p.duration * pct);
            }}
            style={{ width: "100%" }}
          />
          <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
            <div className="small muted">{fmt(p.position)}</div>
            <div className="small muted">{fmt(p.duration)}</div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
          <button className="btn" disabled={!canPlay} onClick={p.prev} title="Anterior">⏮</button>
          <button className="btn" disabled={!canPlay} onClick={() => p.seekBy(-10)} title="-10s">↺ 10</button>
          <button className="btn btnPrimary" disabled={!canPlay} onClick={p.toggle} title="Play/Pause" style={{ flex: 1 }}>
            {p.playing ? "⏸ Pausa" : "▶ Reproducir"}
          </button>
          <button className="btn" disabled={!canPlay} onClick={() => p.seekBy(10)} title="+10s">10 ↻</button>
          <button className="btn" disabled={!canPlay} onClick={p.next} title="Siguiente">⏭</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn" onClick={onRecap} style={{ flex: 1 }}>
            🧠 Resumen (copiar)
          </button>
          <button
            className="btn"
            onClick={() => {
              // guardado manual (aprovecha el bookmark automático, pero esto da sensación de control)
              toast("Punto guardado.");
            }}
          >
            🔖
          </button>
        </div>

        <div className="small muted" style={{ marginTop: 14, textAlign: "center" }}>
          Consejo: en iPhone, usa los botones ±10s para “ir cómodo” sin pelearte con el slider.
        </div>
      </div>

      {/* Settings sheet */}
      <BottomSheet open={sheetOpen} title="Ajustes de reproducción" onClose={() => setSheetOpen(false)}>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Velocidad</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[0.75, 1, 1.15, 1.25, 1.5, 1.75, 2].map(r => (
                <button
                  key={r}
                  className={`btn ${p.rate === r ? "btnPrimary" : ""}`}
                  onClick={() => p.setRate(r)}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Acciones</div>
            <button className="btn" onClick={() => { p.seekBy(-10); setSheetOpen(false); }}>
              ↺ 10 segundos
            </button>
            <div style={{ height: 10 }} />
            <button className="btn" onClick={() => { p.seekBy(10); setSheetOpen(false); }}>
              10 segundos ↻
            </button>
          </div>

          <div className="small muted">
            La voz/modo se cambia en la pantalla del libro (Audio ⚙️), porque afecta a qué audios existen.
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
