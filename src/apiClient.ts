// src/apiClient.ts
// Simplificado: UNA voz (alloy) + UN estilo (learning)

const API_BASE =
  (import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/+$/, "") ||
  "https://audio-reader-backend-production.up.railway.app";

export const DEFAULT_VOICE = "onyx";
export const DEFAULT_STYLE = "learning";

type FetchOpts = {
  method?: string;
  path: string;
  userId?: string | null;
  body?: any;
};

async function apiFetch<T>({ method = "GET", path, userId, body }: FetchOpts): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };

  // Solo ponemos x-user-id si tenemos userId (para bookmarks/progreso/audios por usuario).
  if (userId) headers["x-user-id"] = userId;

  if (body !== undefined) headers["Content-Type"] = "application/json";

  // Prevent URL caching with timestamp
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.append("_t", Date.now().toString());

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      (payload && typeof payload === "object" && (payload.error || payload.message)) ||
      (typeof payload === "string" && payload) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return payload as T;
}

// ---------- AUTH ----------

export async function authLogin(email: string, pass: string) {
  return apiFetch<{ user: { id: string; email?: string }; session?: any }>({
    method: "POST",
    path: "/api/auth/login",
    body: { email, password: pass },
  });
}

export async function authSignup(email: string, pass: string) {
  return apiFetch<{ user: { id: string; email?: string } }>({
    method: "POST",
    path: "/api/auth/signup",
    body: { email, password: pass },
  });
}

// ---------- BOOKS ----------

export async function listBooks(args?: { userId?: string | null }) {
  return apiFetch<any[]>({
    path: `/api/books`,
    userId: args?.userId ?? null
  });
}

export async function uploadBook(args: { userId?: string | null; file: File }) {
  const formData = new FormData();
  formData.append("file", args.file);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (args.userId) headers["x-user-id"] = args.userId;

  const res = await fetch(`${(import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/+$/, "") || "https://audio-reader-backend-production.up.railway.app"}/api/books/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Error uploading: ${res.status}`);
  }
  return res.json();
}

export async function getBook(args: { userId?: string | null; bookId: string; voice?: string; style?: string }) {
  // Nota: aunque la librería sea compartida, enviamos userId si existe
  // para que el backend pueda devolver audios/bookmarks de ESE usuario.
  const voice = args.voice || DEFAULT_VOICE;
  const style = args.style || DEFAULT_STYLE;
  return apiFetch<{
    book: any;
    chapters: Array<{ id: string; book_id: string; index_in_book: number; title: string | null; audio_path: string | null }>;
    voice: string;
    style: string;
  }>({
    path: `/api/books/${args.bookId}?voice=${encodeURIComponent(voice)}&style=${encodeURIComponent(style)}`,
    userId: args.userId ?? null,
  });
}

export async function deleteBook(args: { userId?: string | null; bookId: string }) {
  return apiFetch<{ ok: boolean }>({
    method: "DELETE",
    path: `/api/books/${args.bookId}`,
    userId: args.userId ?? null,
  });
}

// ---------- AUDIO GENERATION ----------

export async function generateAudio(args: {
  userId?: string | null;
  bookId: string;
  startIndex?: number | null;
  endIndex?: number | null;
  voice?: string;
  style?: string;
}) {
  // Backend: /generate-audio
  return apiFetch<any>({
    method: "POST",
    path: `/api/books/${args.bookId}/generate-audio`,
    userId: args.userId ?? null,
    body: {
      voice: args.voice || DEFAULT_VOICE,
      style: args.style || DEFAULT_STYLE,
      startIndex: args.startIndex ?? null,
      endIndex: args.endIndex ?? null,
    },
  });
}

export async function generateMissing(args: { userId?: string | null; bookId: string }) {
  // Si tu backend lo llama /generate-missing, dejamos este wrapper.
  // Si NO existe en tu backend, bórralo del frontend.
  return apiFetch<any>({
    method: "POST",
    path: `/api/books/${args.bookId}/generate-missing`,
    userId: args.userId ?? null,
    body: {
      voice: DEFAULT_VOICE,
      style: DEFAULT_STYLE,
    },
  });
}

// ---------- BOOKMARKS / CONTINUE ----------

export async function getContinue(args: { userId?: string | null; bookId: string; voice?: string; style?: string }) {
  const voice = args.voice || DEFAULT_VOICE;
  const style = args.style || DEFAULT_STYLE;
  return apiFetch<any>({
    path: `/api/books/${args.bookId}/continue?voice=${encodeURIComponent(voice)}&style=${encodeURIComponent(style)}`,
    userId: args.userId ?? null,
  });
}

export async function saveBookmark(args: {
  userId?: string | null;
  bookId: string;
  chapterId: string;
  positionSeconds: number;
  voice?: string;
  style?: string;
}) {
  return apiFetch<any>({
    method: "POST",
    path: `/api/books/${args.bookId}/bookmark`,
    userId: args.userId ?? null,
    body: {
      chapterId: args.chapterId,
      positionSeconds: args.positionSeconds,
      voice: args.voice || DEFAULT_VOICE,
      style: args.style || DEFAULT_STYLE,
    },
  });
}


export async function recapChapter(args: {
  userId?: string | null;
  bookId: string;
  chapterId: string;
  positionSeconds: number;
  style?: string;
}) {
  return apiFetch<{ summary: string }>({
    method: "POST",
    path: `/api/books/${args.bookId}/recap`,
    userId: args.userId ?? null,
    body: {
      chapterId: args.chapterId,
      positionSeconds: args.positionSeconds,
      style: args.style || DEFAULT_STYLE,
    },
  });
}

// ---------- AUDIO DELETION ----------

export async function deleteAudios(args: {
  userId?: string | null;
  bookId: string;
  voice?: string;
  style?: string;
}) {
  const params = new URLSearchParams();
  if (args.voice) params.set("voice", args.voice);
  if (args.style) params.set("style", args.style);

  return apiFetch<any>({
    method: "DELETE",
    path: `/api/books/${args.bookId}/audios?${params.toString()}`,
    userId: args.userId ?? null,
  });
}

// Alias para compatibilidad con BookScreen
export const generateAudioRange = generateAudio;

// ---------- AUDIO URL ----------

export function toAbsoluteAudioUrl(audioPath: string) {
  // audioPath viene tipo "/audio/....mp3"
  if (!audioPath) return "";
  if (/^https?:\/\//i.test(audioPath)) return audioPath;
  return `${API_BASE}${audioPath.startsWith("/") ? "" : "/"}${audioPath}`;
}
