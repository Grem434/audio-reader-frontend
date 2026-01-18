import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authLogin, authSignup } from "../apiClient";

const LS_USER_ID = "audio-reader-user-id";
const LS_VOICE = "audio-reader-voice";
const LS_STYLE = "audio-reader-style";



/** 👇 Estos exports SON los que tu BookScreen está importando */
export const VOICES = [
  { id: "echo", label: "Masculina (Echo - Suave)" },
  { id: "onyx", label: "Masculina (Onyx - Profunda)" },
  { id: "alloy", label: "Masculina (Alloy - Neutra)" },
  { id: "nova", label: "Femenina (Nova)" },
] as const;

// Styles "restored" but hidden from UI to satisfy types
export const STYLES = [
  { id: "learning", label: "Aprendizaje" }
] as const;

type VoiceId = typeof VOICES[number]["id"];
type StyleId = typeof STYLES[number]["id"];


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
  // Force default voice to avoid build error and ensure consistency
  const [voice, setVoiceState] = useState<VoiceId>(VOICES[2].id); // Default to Alloy (Neutral)

  const [style, setStyleState] = useState<StyleId>(() => {
    const saved = localStorage.getItem(LS_STYLE) as StyleId | null;
    // Check if saved is valid (e.g. if we changed available styles)
    if (saved && STYLES.some(s => s.id === saved)) {
      return saved;
    }
    return STYLES[0].id;
  });

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem(LS_USER_ID);
    if (existing) setUserId(existing);
  }, []);

  const setVoice = (v: VoiceId) => {
    setVoiceState(v);
    localStorage.setItem(LS_VOICE, v);
  };

  const setStyle = (s: StyleId) => {
    setStyleState(s);
    localStorage.setItem(LS_STYLE, s);
  };



  // --- Auth Real ---
  const signIn = async (email: string, p: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await authLogin(email, p);
      if (data?.user?.id) {
        setUserId(data.user.id);
        localStorage.setItem(LS_USER_ID, data.user.id);
      } else {
        throw new Error("Login exitoso pero sin User ID");
      }
    } catch (e: any) {
      console.error(e);
      setAuthError(e.message || "Error al iniciar sesión");
    } finally {
      setAuthLoading(false);
    }
  };

  const signUp = async (email: string, p: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await authSignup(email, p);
      if (data?.user?.id) {
        setUserId(data.user.id);
        localStorage.setItem(LS_USER_ID, data.user.id);
      } else {
        // A veces signup requiere confirmación de email (Supabase default)
        // pero asumimos que devulve user.
        throw new Error("Registro exitoso pero sin User ID (¿requiere confirmación?)");
      }
    } catch (e: any) {
      console.error(e);
      setAuthError(e.message || "Error al registrarse");
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = () => {
    setUserId("");
    localStorage.removeItem(LS_USER_ID);
    // Opcional: limpiar voice/style si quieres
  };

  const value = useMemo<AppCtx>(
    () => ({
      userId: userId,
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