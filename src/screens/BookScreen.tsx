import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteAudios, generateAudioRange, getBook, getStreamUrl, toAbsoluteAudioUrl } from "../apiClient";
import type { Chapter } from "../types";
import { useApp, VOICES } from "../app/AppContext";
import { useToast } from "../ui/Toast";
import { usePlayer } from "../player/PlayerProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { ChatInterface } from "../components/ChatInterface";
import { processRagIndex } from "../apiClient";

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

  const { userId, voice: defaultVoice, setVoice } = useApp(); // Used as default for generation
  const { toast } = useToast();
  const player = usePlayer();

  const [bookTitle, setBookTitle] = useState("");
  const [chapters, setChapters] = useState<(Chapter & { voice?: string, style?: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("Cargando...");
  const [chatOpen, setChatOpen] = useState(false);

  // Local state for generation preference

  // Local state for generation preference
  const [genVoice, setGenVoice] = useState(defaultVoice);

  const readyCount = useMemo(() => chapters.filter(c => !!c.audio_path).length, [chapters]);

  async function refresh() {
    if (!bookId) return;
    setLoading(true);
    setErr(null);
    try {
      // No voice/style params sent to getBook - we want EVERYTHING
      const data = await getBook({ userId, bookId });
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

  // Play ignores local voice setting, it plays whatever the chapter has
  async function playIndex(index: number) {
    const ch = chapters[index];
    if (!ch) return;

    if (!ch.audio_path) {
      toast("Ese capítulo no tiene audio todavía. Generálo primero.");
      return;
    }

    setBusyMessage("Cargando reproductor...");
    setBusy(true);
    try {
      // Pass the audio's actual voice/style (or fallback to defaults if missing)
      await player.playChapter({
        bookId,
        bookTitle,
        chapters,
        index,
        voice: ch.voice || "onyx",
        style: ch.style || "learning"
      });
      nav("/player");
    } catch (e: any) {
      console.error(e);
      toast("Error al reproducir: " + (e?.message || "Posible error de red o audio no encontrado"));
    } finally {
      setBusy(false);
    }
  }

  async function onContinue() {
    // Modificación robusta: intentar 'resume', si falla (false), reproducir el primero que tenga audio.
    const ok = await player.resumeBook(bookId, bookTitle, chapters, genVoice, "learning");
    if (ok) {
      nav("/player");
      return;
    }

    // Fallback: reproducir el primero con audio
    const firstReadyIndex = chapters.findIndex(c => !!c.audio_path);
    if (firstReadyIndex >= 0) {
      // Usamos playIndex que ya maneja busy/nav
      await playIndex(firstReadyIndex);
    } else {
      toast("No hay audios disponibles para continuar.");
    }
  }




  // New: Play via Stream
  async function playStream(index: number) {
    const ch = chapters[index];
    if (!ch) return;

    setBusyMessage("Iniciando stream...");
    setBusy(true); // Show loading briefly
    try {
      // Construct the chapters list with this one "patched" with the stream URL
      const streamUrl = getStreamUrl(bookId, ch.id, genVoice, "learning");

      // Clone and patch
      const patchedChapters = chapters.map((c, i) => {
        if (i === index) {
          return { ...c, audio_path: streamUrl, voice: genVoice, style: "learning" };
        }
        return c;
      });

      await player.playChapter({
        bookId,
        bookTitle,
        chapters: patchedChapters,
        index,
        voice: genVoice,
        style: "learning"
      });
      nav("/player");
    } catch (e: any) {
      console.error(e);
      toast("Error iniciando stream: " + e?.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadToCache(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    const ch = chapters[index];
    if (!ch) return;

    setBusyMessage(ch.audio_path ? "Descargando..." : "Generando y descargando...");
    setBusy(true);
    try {
      let url = "";
      if (ch.audio_path) {
        url = toAbsoluteAudioUrl(ch.audio_path);
      } else {
        // Generate via stream URL
        url = getStreamUrl(bookId, ch.id, genVoice, "learning");
      }

      // Fetch to trigger generation/caching
      await fetch(url, { mode: "cors", cache: "reload" });

      toast(`Capítulo ${ch.index_in_book + 1} guardado en dispositivo.`);

      // If it was new, refresh to get the permanent path
      if (!ch.audio_path) {
        void refresh();
      }
    } catch (err: any) {
      toast("Error descarga: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function genNextChapter() {
    setBusyMessage("Generando audio...");
    setBusy(true);
    try {
      const firstMissing = chapters.find(c => !c.audio_path);
      if (!firstMissing) {
        toast("¡El libro ya tiene audio completo!");
        setBusy(false);
        return;
      }

      await generateAudioRange({
        userId,
        bookId,
        startIndex: firstMissing.index_in_book,
        endIndex: firstMissing.index_in_book,
        voice: genVoice,
        style: "learning"
      });

      toast(`Generado Cap. ${firstMissing.index_in_book + 1} (${genVoice})`);
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Error generando capítulo");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAudios() {
    if (!confirm("¿Borrar TODOS los audios del libro?")) return;
    setBusyMessage("Borrando...");
    setBusy(true);
    try {
      await deleteAudios({ userId, bookId, voice: "", style: "" });
      toast("Audios eliminados.");
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Error borrando audios");
    } finally {
      setBusy(false);
    }
  }

  async function activateAI() {
    setBusyMessage("Indexando libro (puede tardar)...");
    setBusy(true);
    try {
      await processRagIndex(bookId);
      toast("Indexación iniciada en segundo plano. Ya puedes usar el chat.");
      setChatOpen(true);
    } catch (e: any) {
      toast("Error indexando: " + e.message);
    } finally {
      setBusy(false);
    }
  }

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
        <div>{busyMessage}</div>
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
          <button className="btn" onClick={() => setSheetOpen(true)}>⚙️ Opciones</button>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 17, lineHeight: 1.1 }}>{bookTitle || "Libro"}</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {readyCount}/{chapters.length} con audio
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {readyCount > 0 && (
              <button className="btn btnPrimary" onClick={() => void onContinue()} disabled={loading}>
                Continuar
              </button>
            )}
            {readyCount === 0 && (
              <button className="btn btnPrimary" onClick={() => setSheetOpen(true)} disabled={loading}>
                Generar Audio
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 14, paddingBottom: "calc(110px + env(safe-area-inset-bottom))" }}>
        {loading ? (
          <div className="muted">Cargando...</div>
        ) : err ? (
          <div style={{ color: "rgba(255,120,120,0.95)", fontWeight: 800 }}>{err}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {chapters.map((ch, idx) => {
              const isReady = !!ch.audio_path;
              const label = ch.title || `Capítulo ${ch.index_in_book + 1}`;
              const voiceLabel = ch.voice ? (ch.voice === "onyx" ? "Masculina" : "Femenina") : "";

              return (
                <div key={ch.id} className="card">
                  <div
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      padding: 14,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 10
                    }}
                    onClick={() => {
                      // UNIFIED PLAY: If ready, play file. If not, play stream.
                      if (isReady) void playIndex(idx);
                      else void playStream(idx);
                    }}
                  >
                    <div style={{ fontWeight: 950, fontSize: 14, minWidth: 42 }}>{ch.index_in_book + 1}.</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {label}
                      </div>
                      <div className="small muted">
                        {/* Simplify Status Text: Just voice info or duration if we had it */}
                        {voiceLabel}
                      </div>
                    </div>

                    {/* Download/Offline Action */}
                    <div
                      style={{ fontSize: 18, padding: 8, zIndex: 5, opacity: isReady ? 0.5 : 1 }}
                      onClick={(e) => {
                        if (!isReady) void downloadToCache(idx, e);
                        else e.stopPropagation(); // Already saved
                      }}
                      // Display: Cloud if needs download, Check/Disk if saved
                      title={isReady ? "Guardado en dispositivo" : "Descargar para escuchar offline"}
                    >
                      {isReady ? "✅" : "⬇️"}
                    </div>

                    {/* Play Button is ALWAYS visible now */}
                    <div style={{ fontSize: 18 }}>▶</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomSheet open={sheetOpen} title="Gestión de Audio" onClose={() => setSheetOpen(false)}>
        <div style={{ display: "grid", gap: 20 }}>

          <div>
            <div className="small muted" style={{ fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Voz para generar</div>
            <div style={{ position: "relative" }}>
              <select className="select" value={genVoice} onChange={e => {
                const v = e.target.value as any;
                setGenVoice(v);
                setVoice(v); // Update global pref too
              }}>
                {VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>⌄</div>
            </div>
            <div className="small muted" style={{ marginTop: 6, lineHeight: 1.4 }}>
              Si generas un capítulo que ya existe, se sustituirá con esta nueva voz.
            </div>
          </div>

          <div className="divider" />

          <div>
            <button
              className="btn btnPrimary"
              style={{ width: "100%", justifyContent: "center", fontSize: 16 }}
              onClick={() => { setSheetOpen(false); void genNextChapter(); }}
              disabled={busy || readyCount === chapters.length}
            >
              ⚡ Generar
            </button>
            <div style={{ height: 16 }} />

            {/* "Generate this chapter" if applicable? For simplicity, just next/all or manual click on list */}

            <button
              className="btn"
              style={{ width: "100%", justifyContent: "center", color: "rgba(255,100,100,0.9)", borderColor: "rgba(255,100,100,0.2)" }}
              onClick={() => { setSheetOpen(false); onDeleteAudios(); }}
            >
              🗑️ Borrar audios de este libro
            </button>
            <div style={{ height: 16 }} />
            <div className="divider" />
            <div style={{ height: 16 }} />

            <button
              className="btn"
              style={{ width: "100%", justifyContent: "center", background: "#3b82f6", color: "white", border: "none" }}
              onClick={() => { setSheetOpen(false); void activateAI(); }}
            >
              💬 Activar Chat IA / Abrir Chat
            </button>
          </div>

        </div>
      </BottomSheet>

      {chatOpen && <ChatInterface bookId={bookId} onClose={() => setChatOpen(false)} />}
    </div >
  );
}
export default BookScreen;
