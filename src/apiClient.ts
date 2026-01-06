const API_BASE = "";

function headers(userId: string) {
  return {
    "x-user-id": userId,
    "Content-Type": "application/json"
  };
}

/* ---------------- BOOKS ---------------- */

export async function listBooks({ userId }: { userId: string }) {
  const res = await fetch(`${API_BASE}/api/books`, {
    headers: headers(userId)
  });
  if (!res.ok) throw new Error("Error cargando libros");
  return res.json();
}

export async function uploadBook({
  userId,
  file
}: {
  userId: string;
  file: File;
}) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/books/upload`, {
    method: "POST",
    headers: { "x-user-id": userId },
    body: form
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Error subiendo libro");
  }

  return res.json();
}

export async function getBook({
  userId,
  bookId,
  voice,
  style
}: {
  userId: string;
  bookId: string;
  voice: string;
  style: string;
}) {
  const res = await fetch(
    `${API_BASE}/api/books/${bookId}?voice=${voice}&style=${style}`,
    { headers: headers(userId) }
  );
  if (!res.ok) throw new Error("Error cargando libro");
  return res.json();
}

/* ---------------- AUDIO GENERATION ---------------- */

export async function generateAudioRange({
  userId,
  bookId,
  startIndex,
  endIndex,
  voice,
  style
}: {
  userId: string;
  bookId: string;
  startIndex: number;
  endIndex: number;
  voice: string;
  style: string;
}) {
  const res = await fetch(
    `${API_BASE}/api/books/${bookId}/generate-audio`,
    {
      method: "POST",
      headers: headers(userId),
      body: JSON.stringify({ startIndex, endIndex, voice, style })
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Error generando audio");
  }

  return res.json();
}

export async function generateMissing({
  userId,
  bookId,
  voice,
  style
}: {
  userId: string;
  bookId: string;
  voice: string;
  style: string;
}) {
  const res = await fetch(
    `${API_BASE}/api/books/${bookId}/generate-missing`,
    {
      method: "POST",
      headers: headers(userId),
      body: JSON.stringify({ voice, style })
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Error generando faltantes");
  }

  return res.json();
}

/* ---------------- CONTINUE / BOOKMARK ---------------- */

export async function getContinue({
  userId,
  bookId,
  voice,
  style
}: {
  userId: string;
  bookId: string;
  voice: string;
  style: string;
}) {
  const res = await fetch(
    `${API_BASE}/api/books/${bookId}/continue?voice=${voice}&style=${style}`,
    { headers: headers(userId) }
  );
  if (!res.ok) throw new Error("Error obteniendo continuar");
  return res.json();
}

export async function saveBookmark({
  userId,
  bookId,
  chapterId,
  positionSeconds
}: {
  userId: string;
  bookId: string;
  chapterId: string;
  positionSeconds: number;
}) {
  const res = await fetch(
    `${API_BASE}/api/books/${bookId}/bookmark`,
    {
      method: "POST",
      headers: headers(userId),
      body: JSON.stringify({ chapterId, positionSeconds })
    }
  );

  if (!res.ok) throw new Error("Error guardando bookmark");
  return res.json();
}

/* ---------------- RECAP ---------------- */

export async function recapChapter({
  userId,
  bookId,
  chapterId,
  positionSeconds
}: {
  userId: string;
  bookId: string;
  chapterId: string;
  positionSeconds: number;
}) {
  const res = await fetch(
    `${API_BASE}/api/books/${bookId}/recap`,
    {
      method: "POST",
      headers: headers(userId),
      body: JSON.stringify({ chapterId, positionSeconds })
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Error generando resumen");
  }

  return res.json();
}

/* ---------------- DELETE ---------------- */

export async function deleteBook({
  userId,
  bookId
}: {
  userId: string;
  bookId: string;
}) {
  const res = await fetch(`${API_BASE}/api/books/${bookId}`, {
    method: "DELETE",
    headers: headers(userId)
  });

  if (!res.ok) throw new Error("Error eliminando libro");
}

export async function deleteAudios({
  userId,
  bookId,
  voice,
  style
}: {
  userId: string;
  bookId: string;
  voice?: string;
  style?: string;
}) {
  const qs =
    voice && style ? `?voice=${voice}&style=${style}` : "";

  const res = await fetch(
    `${API_BASE}/api/books/${bookId}/audios${qs}`,
    {
      method: "DELETE",
      headers: headers(userId)
    }
  );

  if (!res.ok) throw new Error("Error eliminando audios");
}
