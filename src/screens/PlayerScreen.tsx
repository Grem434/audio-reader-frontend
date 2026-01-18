import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../player/PlayerProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { Waveform } from "../components/Waveform";
import { useToast } from "../ui/Toast";

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
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



  async function onCopyRecap() {
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
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16, paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
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
          <div style={{ textAlign: "center", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ height: 60, display: "flex", alignItems: "center" }}>
              <Waveform isPlaying={p.playing} />
            </div>

            <div className="small muted" style={{ marginTop: 16 }}>
              Velocidad: {p.rate}x
            </div>
          </div>
        </div>




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

        {/* Controls: Two Rows for better spacing */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 24 }}>

          {/* Secondary Controls: Seek & Speed */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px" }}>
            <button className="btn" disabled={!canPlay} onClick={() => p.seekBy(-10)} title="-10s" style={{ width: 60 }}>
              ↺ 10
            </button>

            <button
              className="btn"
              style={{ fontWeight: 700, fontSize: 13, padding: "8px 16px", height: 36, minHeight: 0 }}
              onClick={() => {
                const speeds = [1, 1.25, 1.5, 2];
                const idx = speeds.indexOf(p.rate);
                const next = speeds[(idx + 1) % speeds.length];
                p.setRate(next);
              }}
            >
              {p.rate}x
            </button>

            <button className="btn" disabled={!canPlay} onClick={() => p.seekBy(10)} title="+10s" style={{ width: 60 }}>
              10 ↻
            </button>
          </div>

          {/* Primary Controls: Transport */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 30 }}>
            <button className="btn" disabled={!canPlay} onClick={p.prev} title="Anterior" style={{ width: 56, height: 56, borderRadius: "50%", fontSize: 24 }}>
              ⏮
            </button>

            <button
              className="btn btnPrimary"
              disabled={!canPlay}
              onClick={p.toggle}
              title="Play/Pause"
              style={{ width: 80, height: 80, borderRadius: "50%", fontSize: 32, boxShadow: "0 10px 40px rgba(59, 130, 246, 0.4)" }}
            >
              {p.playing ? "⏸" : "▶"}
            </button>

            <button className="btn" disabled={!canPlay} onClick={p.next} title="Siguiente" style={{ width: 56, height: 56, borderRadius: "50%", fontSize: 24 }}>
              ⏭
            </button>
          </div>

        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn" onClick={onCopyRecap} style={{ flex: 1 }}>
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
          {/* NEW: Chapter Summary Button */}
          <button
            className="btn btnPrimary"
            onClick={() => {
              setSheetOpen(false);
              const ch = p.chapters[p.index];
              if ((ch as any).summary) {
                // Show in alert for now or a custom modal. 
                // Using toast might be too short for a summary.
                // Let's toggle a "summary view" or just alert() since it's simple MVP.
                // Or better, navigate to a new screen / overlay? 
                // Let's use a simple native alert for the "WOW" effect of having it, 
                // or reuse the BottomSheet concept if possible.
                // Actually, let's put it in a Toast? No, too long.
                // Let's use a simple JS confirm/alert logic or a new state for "Reading Summary".
                alert("Resumen del Capítulo:\n\n" + (ch as any).summary);
              } else {
                toast("Este capítulo no tiene resumen generado.");
              }
            }}
          >
            📄 Ver Resumen del Capítulo
          </button>

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
            <div style={{ height: 10 }} />
            <button className="btn" onClick={() => { p.seekBy(10); setSheetOpen(false); }}>
              10 segundos ↻
            </button>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Temporizador (Sleep Timer)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[0, 5, 15, 30, 60].map(m => (
                <button
                  key={m}
                  className={`btn ${(!m && !p.sleepTarget) || (m && p.sleepTarget && Math.abs((p.sleepTarget - Date.now()) / 60000 - m) < 5) ? "btnPrimary" : ""}`}
                  onClick={() => { p.setSleepTimer(m); if (m === 0) toast("Temporizador apagado"); else toast(`Apagado en ${m} min`); }}
                >
                  {m === 0 ? "Off" : `${m}m`}
                </button>
              ))}
            </div>
            {p.sleepTarget && (
              <div className="small muted" style={{ marginTop: 6 }}>
                Se detendrá a las {new Date(p.sleepTarget).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>

          <div className="small muted">
            La voz/modo se cambia en la pantalla del libro (Audio ⚙️), porque afecta a qué audios existen.
          </div>
        </div>
      </BottomSheet>
    </div >
  );
}
