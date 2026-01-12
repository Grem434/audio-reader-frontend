import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listBooks, uploadBook, deleteBook } from "../apiClient";
import type { Book } from "../types";
import { useApp } from "../app/AppContext";
import { useToast } from "../ui/Toast";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function LibraryScreen() {
  const { userId } = useApp(); // sigue existiendo: se usa para subir/borrar
  const { toast } = useToast();
  const nav = useNavigate();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // 📚 REFRESH (usa el userId del contexto)
  async function refresh() {
    if (!userId) return; // aún no está listo
    setLoading(true);
    setErr(null);
    try {
      const data = await listBooks({ userId });
      setBooks(data);
    } catch (e: any) {
      setErr(e?.message || "Error cargando libros");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ⬆️ SUBIR (ADMIN)
  async function onUpload(file: File) {
    setUploading(true);
    try {
      const res = await uploadBook({ userId, file });
      toast(`Libro subido: ${res.book.title} (${res.chapters_count} capítulos)`);
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Error subiendo libro");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ❌ BORRAR (ADMIN)
  async function onDelete(b: Book) {
    if (!confirm(`¿Borrar el libro "${b.title}"?`)) return;
    try {
      await deleteBook({ userId, bookId: b.id });
      toast("Libro eliminado");
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Error borrando libro");
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding: "12px 14px",
          paddingTop: "calc(12px + env(safe-area-inset-top))",
          background: "rgba(10,12,16,0.86)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Biblioteca</div>
            <div className="small muted">Sube PDF/EPUB y escucha en móvil</div>
          </div>
          <button
            className="btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Subiendo..." : "＋ Subir"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.epub"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 14, paddingBottom: 110 }}>
        {loading ? (
          <div className="muted">Cargando...</div>
        ) : err ? (
          <div style={{ color: "rgba(255,120,120,0.95)", fontWeight: 800 }}>{err}</div>
        ) : books.length === 0 ? (
          <div className="muted">No hay libros todavía. Sube uno para empezar.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {books.map((b) => (
              <div key={b.id} className="card">
                <button
                  onClick={() => nav(`/book/${b.id}`)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    padding: 14,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 950, fontSize: 15, marginBottom: 4 }}>
                    {b.title}
                  </div>
                  <div className="small muted">Añadido: {formatDate(b.created_at)}</div>
                </button>
                <div className="divider" />
                <div style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <button className="btn" onClick={() => nav(`/book/${b.id}`)}>
                    Abrir
                  </button>
                  <button className="btn btnDanger" onClick={() => void onDelete(b)}>
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
