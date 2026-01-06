const API_BASE = ""; // proxy Vite

export type Book = {
  id: string;
  title: string;
  created_at: string;
};

export type Chapter = {
  id: string;
  index_in_book: number;
  title: string | null;
  audio_path: string | null;
};

export type Bookmark = {
  id: string;
  book_id: string;
  chapter_id: string;
  position_seconds: number;
  updated_at: string;
};

export function getUserId(): string {
  const key = "audio_reader_user_id";
  let id = localStorage.getItem(key);

  if (!id) {
    id = "b9592002-c017-47c4-ac6a-fad838296758";
    localStorage.setItem(key, id);
  }

  return id;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const userId = getUserId();

  const headers: Record<string, string> = {
    "x-user-id": userId,
    ...(options.headers as any)
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(typeof data === "string" ? data : data?.error || `HTTP ${res.status}`);
  }

  return data;
}

export async function listBooks(): Promise<Book[]> {
  return apiFetch("/api/books");
}

export async function getBook(bookId: string): Promise<{ book: any; chapters: Chapter[] }> {
  return apiFetch(`/api/books/${bookId}`);
}

export async function generateAudio(bookId: string, startIndex?: number, endIndex?: number) {
  const body: any = { style: "learning", voice: "marin" };
  if (startIndex !== undefined) body.startIndex = startIndex;
  if (endIndex !== undefined) body.endIndex = endIndex;

  return apiFetch(`/api/books/${bookId}/generate-audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function getBookmark(bookId: string): Promise<Bookmark | null> {
  return apiFetch(`/api/books/${bookId}/bookmark`);
}

export async function saveBookmark(bookId: string, chapterId: string, positionSeconds: number) {
  return apiFetch(`/api/books/${bookId}/bookmark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapterId, positionSeconds })
  });
}

export async function getContinue(bookId: string): Promise<{ bookmark: Bookmark | null; chapter: any | null }> {
  return apiFetch(`/api/books/${bookId}/continue`);
}
