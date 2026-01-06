import React, { createContext, useContext, useMemo, useState } from "react";

type AppCtx = {
  userId: string;
  voice: string;
  style: string;
  setVoice: (v: string) => void;
  setStyle: (s: string) => void;
};

const Ctx = createContext<AppCtx | null>(null);

function safeUUID() {
  // 1) Preferido
  const c: any = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  // 2) Fallback seguro: UUID v4 con getRandomValues
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);

    // RFC4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
    return (
      hex.slice(0, 8) +
      "-" +
      hex.slice(8, 12) +
      "-" +
      hex.slice(12, 16) +
      "-" +
      hex.slice(16, 20) +
      "-" +
      hex.slice(20)
    );
  }

  // 3) Último recurso (no cripto-fuerte, pero suficiente para un id local)
  return `uid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getOrCreateUserId() {
  const key = "audio_reader_user_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const id = safeUUID();
  localStorage.setItem(key, id);
  return id;
}

export const VOICES = [
  { id: "marin", label: "Marin (ES)" },
  { id: "alloy", label: "Alloy" },
  { id: "nova", label: "Nova" },
  { id: "shimmer", label: "Shimmer" }
] as const;

export const STYLES = [
  { id: "learning", label: "Learning" },
  { id: "narrative", label: "Narrative" }
] as const;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const userId = useMemo(() => getOrCreateUserId(), []);

  const [voice, setVoiceState] = useState(() => localStorage.getItem("audio_reader_voice") || "marin");
  const [style, setStyleState] = useState(() => localStorage.getItem("audio_reader_style") || "learning");

  const setVoice = (v: string) => {
    setVoiceState(v);
    localStorage.setItem("audio_reader_voice", v);
  };

  const setStyle = (s: string) => {
    setStyleState(s);
    localStorage.setItem("audio_reader_style", s);
  };

  return (
    <Ctx.Provider value={{ userId, voice, style, setVoice, setStyle }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider/>");
  return ctx;
}
