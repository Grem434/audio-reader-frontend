import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getContinue, saveBookmark } from "../apiClient";

type ChapterLite = {
  id: string;
  index_in_book: number;
  title: string | null;
  audio_path: string | null;
};

type PlayChapterArgs = {
  bookId: string;
  bookTitle: string;
  chapters: ChapterLite[];
  index: number;
  voice: string;
  style: string; // en backend lo normalizas a learning|narrative, pero aquí puede venir cualquier string
};

type PlayerState = {
  bookId: string | null;
  bookTitle: string | null;
  chapters: ChapterLite[];
  index: number; // índice dentro de chapters[]
  chapterId: string | null;

  voice: string;
  style: string;

  isPlaying: boolean;
  rate: number;
  position: number;
  duration: number;
  sleepTarget: number | null;
};

type PlayerContextValue = {
  // estado “plano” para que PlayerScreen lo use fácil
  hasAudio: boolean;
  playing: boolean;
  position: number;
  duration: number;
  rate: number;
  nowTitle: string;
  nowSubtitle: string;

  // Exposed state for UI
  chapters: ChapterLite[];
  index: number;

  // acciones
  playChapter: (args: PlayChapterArgs) => Promise<void>;
  resumeBook: (bookId: string, bookTitle: string, chapters: ChapterLite[], voice: string, style: string) => Promise<boolean>;

  toggle: () => void;
  play: () => void;
  pause: () => void;

  seekTo: (sec: number) => void;
  seekBy: (delta: number) => void;

  next: () => void;
  prev: () => void;

  setRate: (r: number) => void;

  recap: () => Promise<string>; // si no lo usas, devuelve ""

  // Sleep Timer
  sleepTarget: number | null;
  setSleepTimer: (minutes: number) => void;

  // helpers para otros sitios (por si algo los usa)
  setVoice: (v: string) => void;
  setStyle: (s: string) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// Importante: tu VITE_API_URL suele ser ".../api". Para audios necesitamos el ORIGIN (sin /api)
function getApiOrigin(): string {
  // Misma lógica que apiClient para consistencia
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL; // e.g. https://...railway.app
  if (envUrl) return envUrl.replace(/\/+$/, "");

  // Fallback duro a producción, igual que apiClient (para que funcione sin .env local)
  return "https://audio-reader-backend-production.up.railway.app";
}

function audioUrlFromPath(audio_path: string): string {
  if (!audio_path) return "";
  if (/^https?:\/\//i.test(audio_path)) return audio_path;
  const origin = getApiOrigin();
  // audio_path suele venir como "/audio/..." o "audio/..."
  const cleanPath = audio_path.startsWith("/") ? audio_path : `/${audio_path}`;
  return `${origin}${cleanPath}`;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [s, setS] = useState<PlayerState>({
    bookId: null,
    bookTitle: null,
    chapters: [],
    index: 0,
    chapterId: null,
    voice: "alloy",
    style: "learning",
    isPlaying: false,
    rate: 1,
    position: 0,
    duration: 0,
    sleepTarget: null as number | null, // timestamp (ms) to stop
  });

  // Supabase Realtime
  import { supabase } from "../supabase";

  const CLIENT_ID = Math.random().toString(36).slice(2);

  // throttle bookmarks para no spamear
  const lastSavedRef = useRef<{ key: string; t: number } | null>(null);
  // Prevent loops from incoming events
  const ignoreNextSeekRef = useRef<boolean>(false);

  // Realtime subscription
  useEffect(() => {
    if (!supabase) return;

    // We need userId to isolate channels. Assuming userId is in localStorage "audio-reader-user-id"
    // Ideally this comes from Context, but reading LS is a safe fallback.
    const userId = localStorage.getItem("audio-reader-user-id");
    if (!userId) return;

    const channel = supabase.channel(`player-sync:${userId}`, {
      config: {
        broadcast: { self: false } // Don't receive own messages if possible, but manual check is safer
      }
    });

    channel
      .on("broadcast", { event: "play" }, (payload) => {
        if (payload.payload.sender === CLIENT_ID) return;
        const a = audioRef.current;
        if (a && a.paused) {
          // sync time if diff is large
          if (Math.abs(a.currentTime - payload.payload.time) > 2) {
            a.currentTime = payload.payload.time;
          }
          void a.play();
        }
      })
      .on("broadcast", { event: "pause" }, (payload) => {
        if (payload.payload.sender === CLIENT_ID) return;
        audioRef.current?.pause();
      })
      .on("broadcast", { event: "seek" }, (payload) => {
        if (payload.payload.sender === CLIENT_ID) return;
        const a = audioRef.current;
        if (a) {
          ignoreNextSeekRef.current = true;
          a.currentTime = payload.payload.time;
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Helpers to broadcast
  const broadcast = (event: "play" | "pause" | "seek", time: number) => {
    if (!supabase) return;
    const userId = localStorage.getItem("audio-reader-user-id");
    if (!userId) return;

    void supabase.channel(`player-sync:${userId}`).send({
      type: "broadcast",
      event,
      payload: { sender: CLIENT_ID, time }
    });
  };

  // crea el <audio> una sola vez
  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    a.crossOrigin = "anonymous";
    audioRef.current = a;

    const onTime = () => {
      const cur = safeNum(a.currentTime, 0);
      const dur = safeNum(a.duration, 0);

      // Detect manual seek (large jump) could be done here or in seekTo helper.
      // Doing it in seekTo is better.


      setS((prev) => {
        // Sleep Timer Check
        if (prev.sleepTarget && Date.now() > prev.sleepTarget) {
          a.pause();
          return { ...prev, isPlaying: false, sleepTarget: null, position: cur, duration: dur || prev.duration };
        }
        return {
          ...prev,
          position: cur,
          duration: dur || prev.duration,
        };
      });

      // bookmark automático (cada ~1.5s)
      const { bookId, chapterId, voice, style } = s;
      if (!bookId || !chapterId) return;

      const key = `${bookId}:${chapterId}:${voice}:${style}`;
      const now = Date.now();
      const last = lastSavedRef.current;
      if (last && last.key === key && now - last.t < 1500) return;
      lastSavedRef.current = { key, t: now };

      // no esperamos (fire & forget)
      void saveBookmark({
        bookId,
        chapterId,
        positionSeconds: cur,
        voice,
        style,
      }).catch(() => { });
    };

    const onPlay = () => {
      setS((prev) => ({ ...prev, isPlaying: true }));
      broadcast("play", a.currentTime);
    };
    const onPause = () => {
      setS((prev) => ({ ...prev, isPlaying: false }));
      // Only broadcast pause if not ended (ended logic handles itself)
      if (a.currentTime < a.duration - 0.5) {
        broadcast("pause", a.currentTime);
      }
    };
    const onEnded = () => {
      // cuando termina, pasa al siguiente si existe
      setS((prev) => {
        const nextIndex = prev.index + 1;
        if (nextIndex >= prev.chapters.length) return { ...prev, isPlaying: false };
        return prev; // el salto real lo hace next()
      });
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // MediaSession Integration
    if ("mediaSession" in navigator) {
      const updateMetadata = () => {
        const { bookTitle, chapters, index, voice } = s;
        const ch = chapters[index];
        if (!bookTitle || !ch) return;

        navigator.mediaSession.metadata = new MediaMetadata({
          title: ch.title || `Capítulo ${ch.index_in_book + 1}`,
          artist: bookTitle, // "Artist" is usually the book author, but bookTitle works well here
          album: `Narrado por ${voice === "echo" ? "Echo" : voice === "shimmer" ? "Shimmer" : "IA"}`,
          artwork: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" }
          ]
        });
      };

      updateMetadata(); // Initial update

      navigator.mediaSession.setActionHandler("play", () => {
        void a.play();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        a.pause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        // We need to access the LATEST state, but we are in a closure.
        // However, 's' is in dependency array of the parent effect? NO.
        // This is tricky. Simplified approach: since 's' changes rapidly, 
        // binding handlers once might be stale. 
        // ACTUALLY: The best place for MediaSession logic is in a separate effect that depends on [s.index, s.bookId, etc]
      });
    }

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.pause();
      audioRef.current = null;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Separate effect for MediaSession Metadata updates based on state changes
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const { bookTitle, chapters, index, voice } = s;
    const ch = chapters[index];
    if (!bookTitle || !ch) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: ch.title || `Capítulo ${ch.index_in_book + 1}`,
      artist: bookTitle,
      album: `Voz: ${voice === "echo" ? "Echo" : "Shimmer"}`,
      artwork: [
        { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" }
      ]
    });
  }, [s.bookTitle, s.chapters, s.index, s.voice]);

  // Separate effect for MediaSession Action Handlers (needs access to methods/latest refs)
  // To avoid stale closures, we can use refs or re-bind. Re-binding is safer for small apps.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const a = audioRef.current;
    if (!a) return;

    // Handlers
    const handlers = {
      play: () => void a.play(),
      pause: () => a.pause(),
      previoustrack: () => {
        // Logic to go to prev chapter
        // Since we can't easily access 'api.prev' here without recursion, 
        // we might need to rely on 's' dependency or expose the logic differently.
        // For now, let's skip complex track skipping in background to avoid bugs 
        // unless we refactor 'next/prev' to be stable functions.
        // A simple workaround: fire a custom event or use a ref for the 'api' object?
        // Let's just use the audio native seeking for now.
      },
      seekbackward: (details: MediaSessionActionDetails) => {
        const skip = details.seekOffset || 10;
        a.currentTime = Math.max(a.currentTime - skip, 0);
      },
      seekforward: (details: MediaSessionActionDetails) => {
        const skip = details.seekOffset || 10;
        a.currentTime = Math.min(a.currentTime + skip, a.duration);
      },
      seekto: (details: MediaSessionActionDetails) => {
        if (details.seekTime !== undefined && details.fastSeek === false) {
          a.currentTime = details.seekTime;
        }
      }
    };

    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch { /* ignore */ }
    }
  }, []); // Static handlers that rely on 'audioRef' only

  // aplica rate al audio
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = s.rate;
  }, [s.rate]);

  async function loadAndPlayByIndex(chapters: ChapterLite[], idx: number, bookId: string, bookTitle: string, voice: string, style: string) {
    const a = audioRef.current;
    if (!a) return;

    const ch = chapters[idx];
    if (!ch || !ch.audio_path) throw new Error("Ese capítulo no tiene audio.");

    const url = audioUrlFromPath(ch.audio_path);

    // carga
    a.pause();
    a.src = url;
    a.currentTime = 0;

    setS((prev) => ({
      ...prev,
      bookId,
      bookTitle,
      chapters,
      index: idx,
      chapterId: ch.id,
      voice,
      style,
      position: 0,
      duration: 0,
    }));

    // reproduce (si el navegador lo permite; aquí viene de un click normalmente)
    await a.play();
  }

  const api = useMemo<PlayerContextValue>(() => {
    return {
      hasAudio: !!(s.chapters[s.index]?.audio_path),
      playing: s.isPlaying,
      position: s.position,
      duration: s.duration,
      rate: s.rate,
      nowTitle: s.bookTitle || "Reproductor",
      nowSubtitle: (() => {
        const ch = s.chapters[s.index];
        if (!ch) return "";
        const n = ch.index_in_book ?? s.index;
        const t = ch.title || `Capítulo ${n + 1}`;
        return t;
      })(),

      chapters: s.chapters,
      index: s.index,

      setVoice: (v) => setS((prev) => ({ ...prev, voice: v })),
      setStyle: (st) => setS((prev) => ({ ...prev, style: st })),

      playChapter: async ({ bookId, bookTitle, chapters, index, voice, style }) => {
        await loadAndPlayByIndex(chapters, index, bookId, bookTitle, voice, style);
      },

      resumeBook: async (bookId, bookTitle, chapters, voice, style) => {
        try {
          const data = await getContinue({ bookId, voice, style });
          const chapterId = (data?.chapterId ?? data?.chapter_id ?? null) as string | null;
          const positionSeconds = safeNum(data?.positionSeconds ?? data?.position_seconds ?? 0, 0);

          let idx = 0;
          if (chapterId) {
            const found = chapters.findIndex((c) => c.id === chapterId);
            if (found >= 0) idx = found;
          }

          await loadAndPlayByIndex(chapters, idx, bookId, bookTitle, voice, style);

          const a = audioRef.current;
          if (a) {
            a.currentTime = Math.max(0, positionSeconds);
          }
          return true;
        } catch {
          return false;
        }
      },

      toggle: () => {
        const a = audioRef.current;
        if (!a) return;
        if (a.paused) void a.play();
        else a.pause();
      },

      play: () => {
        const a = audioRef.current;
        if (!a) return;
        void a.play();
      },

      pause: () => {
        const a = audioRef.current;
        if (!a) return;
        a.pause();
      },

      seekTo: (sec) => {
        const a = audioRef.current;
        if (!a) return;
        // Ignore update if it came from sync
        if (ignoreNextSeekRef.current) {
          ignoreNextSeekRef.current = false;
        } else {
          broadcast("seek", sec);
        }
        a.currentTime = clamp(sec, 0, Number.isFinite(a.duration) ? a.duration : sec);
        setS((prev) => ({ ...prev, position: a.currentTime }));
      },

      seekBy: (delta) => {
        const a = audioRef.current;
        if (!a) return;
        const next = (safeNum(a.currentTime, 0) || 0) + delta;
        a.currentTime = clamp(next, 0, Number.isFinite(a.duration) ? a.duration : next);
        setS((prev) => ({ ...prev, position: a.currentTime }));
      },

      next: async () => {
        const { chapters, index, bookId, bookTitle, voice, style } = s;
        if (!bookId || !bookTitle) return;
        const nextIndex = index + 1;
        if (nextIndex >= chapters.length) return;
        try {
          await loadAndPlayByIndex(chapters, nextIndex, bookId, bookTitle, voice, style);
        } catch {
          // si el siguiente no tiene audio, paramos
        }
      },

      prev: async () => {
        const { chapters, index, bookId, bookTitle, voice, style } = s;
        if (!bookId || !bookTitle) return;
        const prevIndex = index - 1;
        if (prevIndex < 0) return;
        try {
          await loadAndPlayByIndex(chapters, prevIndex, bookId, bookTitle, voice, style);
        } catch { }
      },

      setRate: (r) => setS((prev) => ({ ...prev, rate: clamp(r, 0.5, 3) })),

      sleepTarget: s.sleepTarget,
      setSleepTimer: (minutes) => {
        if (minutes <= 0) setS(prev => ({ ...prev, sleepTarget: null }));
        else setS(prev => ({ ...prev, sleepTarget: Date.now() + minutes * 60 * 1000 }));
      },

      recap: async () => {
        const { bookId, chapterId, position, style } = s as any; // userId might be missing in 's', check AppContext or pass it?
        // Wait, 's' (PlayerState) doesn't have userId. We need it from somewhere. 
        // We can ignore it if apiClient handles it via global auth or if we pass nothing (but backend needs it).
        // Actually, PlayerProvider doesn't readily know 'userId' unless we pass it or store it in 's'.
        // Quick fix: assume apiClient might have a way or just pass null and hope backend handles it via session (it doesn't, it demands header).
        // Best approach: Add userId to PlayerState or useContext.
        // HACK: We can read localStorage directly here to avoid large refactors, matching AppContext logic.
        const storedUserId = localStorage.getItem("audio-reader-user-id");

        if (!bookId || !chapterId) throw new Error("No hay capítulo activo");

        const res = await import("../apiClient").then(m => m.recapChapter({
          userId: storedUserId,
          bookId,
          chapterId,
          positionSeconds: position,
          style
        }));
        return res.summary;
      },
    };
    // OJO: dependemos de s entero, es simple y seguro aquí
  }, [s]);

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider/>");
  return ctx;
}
