import { useNavigate, useLocation } from "react-router-dom";
import { usePlayer } from "../player/PlayerProvider";

export function FloatingPlayer() {
    const { hasAudio, nowTitle, playing } = usePlayer();
    const nav = useNavigate();
    const loc = useLocation();

    if (!hasAudio) return null;
    if (loc.pathname === "/player") return null; // Don't show if already on player screen

    return (
        <div
            style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                height: 64,
                background: "rgba(20,22,28,0.95)",
                backdropFilter: "blur(12px)",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                cursor: "pointer",
                zIndex: 100,
                paddingBottom: "env(safe-area-inset-bottom)"
            }}
            onClick={() => nav("/player")}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "bold", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {nowTitle || "Reproduciendo..."}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                    {playing ? "Escuchando" : "Pausado"}
                </div>
            </div>

            <div style={{ fontSize: 24 }}>
                {playing ? "🔊" : "⏸"}
            </div>
        </div>
    );
}
