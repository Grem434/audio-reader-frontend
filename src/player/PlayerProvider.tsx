import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getContinue, recapChapter, saveBookmark } from "../apiClient";
import type { Chapter, ContinuePayload } from "../types";
import { useApp } from "../app/AppContext";
import { useToast } from "../ui/Toast";

type PlayerTrack = {
  bookId: string;
  bookTitle: string;
  chapters: Chapter[];
  index: number;
};

type PlayerState = {
  track: PlayerTrack | null;
  src: string | null;
  nowTitle: string;
  nowSubtitle: string;

  playing: boolean;
  position: number;
  duration: number;
  rate: number;
};

type PlayerCtx = PlayerState & {
  playChapter: (t: PlayerTrack) => Promise<void>;
  resumeBook: (bookId: string, bookTitle: string, chapters: Chapter[]) => Promise<boolean>;
  toggle: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  seekBy: (delta: number) => void;
  next: () => void;
  prev: () => void;
  setRate: (r: number) => void;
  recap: () => Promise<string>;
  hasAudio: boolean;
};

const Ctx = createContext<PlayerCtx | null>(null);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function chapterLabel(ch: Chapter) {
  return ch.title || `Capítulo ${ch.index_in_book + 1}`;
}

function resolveAudioSrc(audioPath: string) {
  // apiClient API_BASE="" => normalmente audio_path será relativo y vale tal cual.
  // Si en algún momento devuelves una URL absoluta, también funciona.
  return audioPath;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { userId, voice, style } = useApp();
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastBookmarkAt = useRef<number>(0);

  const [state, setState] = useState<PlayerState>(() => ({
    track: null,
    src: null,
    nowTitle: "",
    nowSubtitle: "",
    playing: false,
    position: 0,
    duration: 0,
    rate: Number(localStorage.getItem("audio_reader_rate") || "1")
  }));

  const hasAudio = !!state.src;

  // Mantener un ref del estado para callbacks
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Crear el <audio> una sola vez
  useEffect(() => {
    const el = new Audio();
    el.preload = "metadata";
    el.controls = false;
    (el as any).playsInline = true;

    el.playbackRate = stateRef.current.rate;

    audioRef.current = el;

    const onTime = () => {
      const pos = el.currentTime || 0;
      const dur = el.duration || 0;

      setState(prev => ({ ...prev, position: pos, duration: dur, playing: !el.paused }));

      const s = stateRef.current;
      if (!s.track || !s.src) return;

      // bookmark throttled (cada 2s)
      const now = Date.now();
      if (now - lastBookmarkAt.current < 2000) return;
      lastBookmarkAt.current = now;
      void persistBookmark(Math.floor(pos));
    };

    const onPause = () => {
      setState(prev => ({ ...prev, playing: false }));
      const s = stateRef.current;
      if (s.track && s.src) void persistBookmark(Math.floor(el.currentTime || 0));
    };

    const onPlay = () => setState(prev => ({ ...prev, playing: true }));
    const onLoaded = () => setState(prev => ({ ...prev, duration: el.duration || 0 }));
    const onEnded = () => {
      setState(prev => ({ ...prev, playing: false }));
      next();
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlay);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("ended", onEnded);

    return () => {
      el.pause();
      el.src = "";
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = state.rate;
    }
  }, [state.rate]);

  async function persistBookmark(positionSeconds: number) {
    const s = stateRef.current;
    if (!s.track || !audioRef.current) return;
    const chapter = s.track.chapters[s.track.index];
    if (!chapter) return;

    try {
      await saveBookmark({
        userId,
        bookId: s.track.bookId,
        chapterId: chapter.id,
        positionSeconds
      });
    } catch {
      // silencioso
    }
  }

  async function playChapter(track: PlayerTrack) {
    const ch = track.chapters[track.index];
    if (!ch) return;

    if (!ch.audio_path) {
      toast("Ese capítulo no tiene audio todavía.");
      return;
    }

    const src = resolveAudioSrc(ch.audio_path);
    const el = audioRef.current;
    if (!el) return;

    setState(prev => ({
      ...prev,
      track,
      src,
      nowTitle: track.bookTitle || "Libro",
      nowSubtitle: `${ch.index_in_book + 1}. ${chapterLabel(ch)}`
    }));

    el.pause();
    el.src = src;
    el.load();

    try {
      const cont: ContinuePayload = await getContinue({
        userId,
        bookId: track.bookId,
        voice,
        style
      });

      const pos = cont?.bookmark?.position_seconds ?? 0;
      if (cont?.bookmark?.chapter_id === ch.id) {
        const target = pos;
        const onLoaded = () => {
          try {
            el.currentTime = target;
          } catch {}
          el.removeEventListener("loadedmetadata", onLoaded);
        };
        el.addEventListener("loadedmetadata", onLoaded);
      }
    } catch {
      // ignore
    }

    setTimeout(() => {
      el.play().catch(() => {});
    }, 50);
  }

  async function resumeBook(bookId: string, bookTitle: string, chapters: Chapter[]) {
    try {
      const cont: ContinuePayload = await getContinue({ userId, bookId, voice, style });
      const chapter = cont?.chapter;

      if (chapter?.id && chapter.audio_path) {
        const idx = chapters.findIndex(c => c.id === chapter.id);
        const pick = idx >= 0 ? idx : Math.max(0, chapter.index_in_book);
        await playChapter({ bookId, bookTitle, chapters, index: pick });
        return true;
      }

      const firstReady = chapters.findIndex(c => !!c.audio_path);
      if (firstReady >= 0) {
        await playChapter({ bookId, bookTitle, chapters, index: firstReady });
        return true;
      }

      toast("Este libro todavía no tiene audios generados.");
      return false;
    } catch (e: any) {
      toast(e?.message || "Error en Continuar");
      return false;
    }
  }

  function toggle() {
    const el = audioRef.current;
    if (!el || !stateRef.current.src) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function pause() {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
  }

  function seekTo(seconds: number) {
    const el = audioRef.current;
    if (!el) return;
    const dur = el.duration || stateRef.current.duration || 0;
    const t = clamp(seconds, 0, Math.max(0, dur || 0));
    try {
      el.currentTime = t;
    } catch {}
    setState(prev => ({ ...prev, position: t }));
  }

  function seekBy(delta: number) {
    const el = audioRef.current;
    if (!el) return;
    seekTo((el.currentTime || 0) + delta);
  }

  function next() {
    const s = stateRef.current;
    if (!s.track) return;
    const idx = s.track.index + 1;
    if (idx >= s.track.chapters.length) {
      toast("Fin del libro.");
      return;
    }
    void playChapter({ ...s.track, index: idx });
  }

  function prev() {
    const s = stateRef.current;
    if (!s.track) return;
    const idx = Math.max(0, s.track.index - 1);
    void playChapter({ ...s.track, index: idx });
  }

  function setRate(r: number) {
    const rate = clamp(r, 0.75, 2.0);
    localStorage.setItem("audio_reader_rate", String(rate));
    setState(prev => ({ ...prev, rate }));
  }

  async function recap() {
    const s = stateRef.current;
    const el = audioRef.current;
    if (!s.track || !el) throw new Error("Nada reproduciéndose");
    const chapter = s.track.chapters[s.track.index];
    if (!chapter) throw new Error("Capítulo no encontrado");

    const positionSeconds = Math.floor(el.currentTime || 0);
    const res = await recapChapter({
      userId,
      bookId: s.track.bookId,
      chapterId: chapter.id,
      positionSeconds
    });
    return res.text || "";
  }

  const value: PlayerCtx = useMemo(
    () => ({
      ...state,
      playChapter,
      resumeBook,
      toggle,
      pause,
      seekTo,
      seekBy,
      next,
      prev,
      setRate,
      recap,
      hasAudio
    }),
    [state]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider/>");
  return ctx;
}
