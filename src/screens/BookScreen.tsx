import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteAudios, generateAudioRange, getBook } from "../apiClient";
import type { Chapter } from "../types";
import { useApp, VOICES } from "../app/AppContext";
import { useToast } from "../ui/Toast";
import { usePlayer } from "../player/PlayerProvider";
import { BottomSheet } from "../ui/BottomSheet";

// Simple spin animation style
const spinStyle = document.createElement("style");
spinStyle.innerHTML = `
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spin { animation: spin 1.5s linear infinite; display: inline-block; }
`;
document.head.appendChild(spinStyle);

export function BookScreen() {
  const { bookId: paramBookId } = useParams();
  const bookId = paramBookId || "";
  const nav = useNavigate();

  const { userId, voice, style, setVoice } = useApp();
  const { toast } = useToast();
  const player = usePlayer();

  const [bookTitle, setBookTitle] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const readyCount = useMemo(() => chapters.filter(c => !!c.audio_path).length, [chapters]);

  async function refresh() {
    // resetRange ignorado por ahora
    if (!bookId) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await getBook({ userId, bookId, voice, style });
      setBookTitle(data.book.title);
      setChapters(data.chapters);
    } catch (e: any) {
      setErr(e?.message || "Error cargando libro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  useEffect(() => {
    if (bookId) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, style]);

  async function playIndex(index: number) {
    const ch = chapters[index];
    if (!ch) return;

    if (!ch.audio_path) {
      toast("Ese capítulo no tiene audio todavía. Abre Ajustes y genera.");
      return;
    }

    // IMPORTANTÍSIMO: esto es lo que carga el audio (pone src) y deja listo el player
    await player.playChapter({ bookId, bookTitle, chapters, index, voice, style });
    nav("/player");
  }


  async function onContinue() {
    const ok = await player.resumeBook(bookId, bookTitle, chapters, voice, style);
    if (ok) nav("/player");
  }

  async function genSingleChapter(ch: Chapter) {
    setBusy(true);
    try {
      await generateAudioRange({
        userId,
        bookId,
        startIndex: ch.index_in_book,
        endIndex: ch.index_in_book,
        voice,
        style
      });
      toast("Capítulo generado.");
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Error generando capítulo");
    } finally {
      setBusy(false);
    }
  }

  async function genMissing() {
    setBusy(true);
    try {
      // Por simplicidad, "Generar faltantes" regenerará todo el libro en segundo plano
      // o podríamos iterar. Para MVP: generamos todo (backend debe manejarlo).
      // O podemos llamar a generateMissing del backend si hiciera algo, pero solo devuelve lista.
      // Así que llamamos a generateAudio sin rango = todo el libro.
      // toast("Solicitando generación completa (puede tardar)..."); // <-- Ruido visual
      const res: any = await generateAudioRange({
        userId,
        bookId,
        voice,
        style
      });

      if (res && res.generatedChapters === 0) {
        alert(`Ojo: El backend dice que ha generado 0 capítulos. \nMsg: ${res.message}\nError: ${JSON.stringify(res.error || res.details || "")}`);
      }

      // toast("Proceso iniciado."); // <-- Ya tenemos el loading overlay
      await refresh();
      toast("Generación completada / actualizada.");
    } catch (e: any) {
      toast(e?.message || "Error generando faltantes");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAudios(scope: "current" | "all") {
    if (scope === "all") {
      if (!confirm("¿Borrar TODOS los audios del libro?")) return;
      setBusy(true);
      try {
        await deleteAudios({ userId, bookId, voice: "", style: "" });
        toast("Audios eliminados (todos).");
        await refresh();
      } catch (e: any) {
        toast(e?.message || "Error borrando audios");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!confirm(`¿Borrar audios de ${voice}/${style}?`)) return;
    setBusy(true);
    try {
      await deleteAudios({ userId, bookId, voice, style });
      toast("Audios eliminados (voz/modo actual).");
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Error borrando audios");
    } finally {
      setBusy(false);
    }
  }

  // --- Loading Overlay ---
  const LoadingOverlay = () => (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)",
      display: "grid", placeItems: "center",
      zIndex: 9999
    }}>
      <div className="card" style={{ padding: 24, textAlign: "center", minWidth: 200 }}>
        <div style={{ fontSize: 24, marginBottom: 12 }} className="spin">⏳</div>
        <div>Generando audio...</div>
        <div className="small muted" style={{ marginTop: 8 }}>Esto puede tardar unos segundos</div>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {busy && <LoadingOverlay />}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding: "12px 14px",
          paddingTop: "calc(12px + env(safe-area-inset-top))",
          background: "rgba(10,12,16,0.86)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn" onClick={() => nav("/library")}>← Biblioteca</button>
          <button className="btn" onClick={() => setSheetOpen(true)}>Audio ⚙️</button>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 17, lineHeight: 1.1 }}>{bookTitle || "Libro"}</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {readyCount}/{chapters.length} con audio · {voice}/{style}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="btn btnPrimary" onClick={() => void onContinue()} disabled={loading || chapters.length === 0}>
              Continuar
            </button>
            <button className="btn" onClick={() => void playIndex(0)} disabled={loading || chapters.length === 0}>
              Reproducir desde 1
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 14, paddingBottom: 110 }}>
        {loading ? (
          <div className="muted">Cargando...</div>
        ) : err ? (
          <div style={{ color: "rgba(255,120,120,0.95)", fontWeight: 800 }}>{err}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {chapters.map((ch, idx) => {
              const isReady = !!ch.audio_path;
              const label = ch.title || `Capítulo ${ch.index_in_book + 1}`;

              return (
                <div key={ch.id} className="card">
                  <button
                    onClick={() => void playIndex(idx)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      padding: 14,
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 950, fontSize: 14, minWidth: 42 }}>{ch.index_in_book + 1}.</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {label}
                        </div>
                        <div className="small muted">{isReady ? "🎧 Audio listo" : "— Sin audio"}</div>
                      </div>
                      <div style={{ fontSize: 18 }}>{isReady ? "▶" : "⚡"}</div>
                    </div>
                  </button>

                  {!isReady && (
                    <>
                      <div className="divider" />
                      <div style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <button className="btn btnPrimary" onClick={() => void genSingleChapter(ch)} disabled={busy}>
                          Generar este
                        </button>
                        <button className="btn" onClick={() => setSheetOpen(true)}>
                          Ajustes
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomSheet open={sheetOpen} title="Configuración de Audio" onClose={() => setSheetOpen(false)}>
        <div style={{ display: "grid", gap: 20 }}>

          {/* Narrador (antes Voice) */}
          <div>
            <div className="small muted" style={{ fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Narrador</div>
            <div style={{ position: "relative" }}>
              <select className="select" value={voice} onChange={e => setVoice(e.target.value as any)}>
                {VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>⌄</div>
            </div>
            <div className="small muted" style={{ marginTop: 6, lineHeight: 1.4 }}>
              Cada narrador tiene su propia "personalidad". Elige el que más te guste para este libro.
            </div>
          </div>

          {/* Ocultamos Style (Modo) - Siempre Learning */}
          {/* 
          <div>
             ...
          </div>
          */}

          <div className="divider" />

          <div>
            <div className="small muted" style={{ fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Acciones</div>
            <button
              className="btn btnPrimary"
              style={{ width: "100%", justifyContent: "center", fontSize: 16 }}
              onClick={() => { setSheetOpen(false); void genMissing(); }}
              disabled={busy}
            >
              ✨ Generar Audio del Libro
            </button>
            <div className="small muted" style={{ marginTop: 8, textAlign: "center" }}>
              Generará todo lo que falte con el narrador seleccionado.
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <button
              className="btn"
              style={{ width: "100%", justifyContent: "center", color: "rgba(255,100,100,0.9)", borderColor: "rgba(255,100,100,0.2)" }}
              onClick={() => { setSheetOpen(false); onDeleteAudios("all"); }}
            >
              🗑️ Borrar audios de este libro
            </button>
          </div>

        </div>
      </BottomSheet>

    </div >
  );
}
export default BookScreen;
