import React from "react";
import { MiniPlayer } from "../ui/MiniPlayer";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(900px 500px at 20% 0%, rgba(98, 140, 255, 0.12), transparent 60%), #0b0d10"
      }}
    >
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      <MiniPlayer />
    </div>
  );
}
