import { useLocation, useNavigate } from "react-router-dom";
import { usePlayer } from "../player/PlayerProvider";

export function MiniPlayer() {
  const nav = useNavigate();
  const loc = useLocation();
  const p = usePlayer();

  if (loc.pathname === "/player") return null;
  if (!p.hasAudio) return null;

  const pct = p.duration ? Math.min(100, Math.max(0, (p.position / p.duration) * 100)) : 0;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "rgba(10,12,16,0.92)",
        borderTop: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(10px)",
        zIndex: 120
      }}
    >
      {/* progreso */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.10)" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "rgba(110,160,255,0.75)" }} />
      </div>

      <button
        onClick={() => nav("/player")}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          color: "inherit",
          padding: 12,
          display: "flex",
          gap: 10,
          alignItems: "center",
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.nowSubtitle}
          </div>
          <div className="small muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.nowTitle}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button
          className="btn btnPrimary"
          onClick={(e) => { e.stopPropagation(); p.toggle(); }}
          title="Play/Pause"
        >
          {p.playing ? "⏸" : "▶"}
        </button>
      </button>
    </div>
  );
}
