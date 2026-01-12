import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const LS_USER_ID = "audio-reader-user-id";
const LS_VOICE = "audio-reader-voice";
const LS_STYLE = "audio-reader-style";

function safeUUID() {
  try {
    // Navegadores modernos
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      // @ts-ignore
      return crypto.randomUUID();
    }
  } catch { }
  // Fallback simple
  return "xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateUserId() {
  const existing = localStorage.getItem(LS_USER_ID);
  if (existing && existing.trim()) return existing;

  const created = safeUUID();
  localStorage.setItem(LS_USER_ID, created);
  return created;
}

/** 👇 Estos exports SON los que tu BookScreen está importando */
export const VOICES = [
  { id: "alloy", label: "Alloy" },
  { id: "echo", label: "Echo" },
  { id: "fable", label: "Fable" },
  { id: "onyx", label: "Onyx" },
  { id: "nova", label: "Nova" },
  { id: "shimmer", label: "Shimmer" },
  { id: "coral", label: "Coral" },
  { id: "verse", label: "Verse" },
  { id: "ballad", label: "Ballad" },
  { id: "ash", label: "Ash" },
  { id: "sage", label: "Sage" },
  { id: "marin", label: "Marin" },
  { id: "cedar", label: "Cedar" },
] as const;

export const STYLES = [
  { id: "neutral", label: "Neutral" },
  { id: "warm", label: "Cálido" },
  { id: "energetic", label: "Enérgico" }
] as const;

type VoiceId = typeof VOICES[number]["id"];
type StyleId = typeof STYLES[number]["id"];


const isValidVoice = (v: any): v is VoiceId => VOICES.some(x => x.id === v);
const isValidStyle = (v: any): v is StyleId => STYLES.some(x => x.id === v);

type AppCtx = {
  userId: string;
  voice: VoiceId;
  style: StyleId;
  setVoice: (v: VoiceId) => void;
  setStyle: (s: StyleId) => void;
  signIn: (e: string, p: string) => Promise<void>;
  signUp: (e: string, p: string) => Promise<void>;
  signOut: () => void;
  authLoading: boolean;
  authError: string | null;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string>("");
  const [voice, setVoiceState] = useState<VoiceId>(() => {
    const saved = localStorage.getItem(LS_VOICE) as VoiceId | null;
    return saved || VOICES[0].id;
  });
  const [style, setStyleState] = useState<StyleId>(() => {
    const saved = localStorage.getItem(LS_STYLE) as StyleId | null;
    return saved || STYLES[0].id;
  });

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Se ejecuta SOLO cuando la app ya carga
    const id = getOrCreateUserId();
    setUserId(id);
  }, []);

  const setVoice = (v: VoiceId) => {
    setVoiceState(v);
    localStorage.setItem(LS_VOICE, v);
  };

  const setStyle = (s: StyleId) => {
    setStyleState(s);
    localStorage.setItem(LS_STYLE, s);
  };

  // --- Auth Fakes ---
  const signIn = async (email: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      // Simular delay y "login"
      await new Promise(r => setTimeout(r, 800));
      // En una app real aqui validarias credentials.
      // Para MVP, simplemente nos aseguramos que haya un userId (ya lo hay por defecto)
      // y si quieres podrías guardar el email en localStorage.
      if (!email.includes("@")) throw new Error("Email inválido");

      // Todo ok
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const signUp = async (email: string) => {
    // Mismo dummy behavior
    return signIn(email);
  };

  const signOut = () => {
    // Para "cerrar sesión", en este modelo sin backend-auth real, 
    // podríamos limpiar el userId, pero getOrCreateUserId lo regeneraría.
    // Vamos a simular un reload o limpiar storage
    if (confirm("¿Cerrar sesión y borrar datos locales?")) {
      localStorage.removeItem(LS_USER_ID);
      window.location.reload();
    }
  };

  const value = useMemo<AppCtx>(
    () => ({
      userId: userId || "pending",
      voice,
      style,
      setVoice,
      setStyle,
      signIn,
      signUp,
      signOut,
      authLoading,
      authError
    }),
    [userId, voice, style, authLoading, authError]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useApp() debe usarse dentro de <AppProvider>");
  }
  return ctx;
}