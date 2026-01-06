import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteAudios, generateAudioRange, generateMissing, getBook } from "../apiClient";
import type { Chapter } from "../types";
import { useApp, VOICES, STYLES } from "../app/AppContext";
import { useToast } from "../ui/Toast";
import { usePlayer } from "../player/PlayerProvider";
import { BottomSheet } from "../ui/BottomSheet";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function BookScreen() {
  const { id } = useParams();
  const bookId = id || "";
  const nav = useNavigate();

  const { userId, voice, style, setVoice, setStyle } = useApp();
  const { toast } = useToast();
  const player = usePlayer();

  const [bookTitle, setBookTitle] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [busy, setBusy] = useState(false);

  const readyCount = useMemo(() => chapters.filter(c => !!c.audio_path).length, [chapters]);

  async function refresh(resetRange: boolean) {
    if (!bookId) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await getBook({ userId, bookId, voice, style });
      setBookTitle(data.book.title);
      setChapters(data.chapters);

      if (resetRange) {
        setRangeStart(1);
        setRangeEnd(Math.min(1, data.chapters.length || 1));
      } else {
        setRangeStart(s => clamp(s, 1, data.chapters.length || 1));
        setRangeEnd(e => clamp(e, 1, data.chapters.length || 1));
      }
    } catch (e: any) {
      setErr(e?.message || "Error cargando libro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  useEffect(() => {
    if (bookId) void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, style]);

  async function playIndex(index: number) {
    const ch = chapters[index];
    if (!ch) return;

    if (!ch.audio_path) {
      toast("Ese capítulo no tiene audio todavía. Abre Ajustes y genera.");
      return;
    }

    await player.playChapter({ bookId, bookTitle, chapters, index });
    nav("/player");
  }

  async function onContinue() {
    const ok = await player.resumeBook(bookId, bookTitle, chapters);
    if (ok) nav("/player");
  }

  async function genMissing() {
    setBusy(true);
    try {
      await generateMissing({ userId, bookId, voice, style });
      toast("Generación iniciada (faltantes).");
      await refresh(false);
    } catch (e: any) {
      toast(e?.message || "Error generando faltantes");
    } finally {
      setBusy(false);
    }
  }

  async function genRange() {
    setBusy(true);
    try {
      await generateAudioRange({
        userId,
        bookId,
        startIndex: clamp(rangeStart - 1, 0, Math.max(0, chapters.length - 1)),
        endIndex: clamp(rangeEnd - 1, 0, Math.max(0, chapters.length - 1)),
        voice,
        style
      });
      toast("Rango generado.");
      await refresh(false);
    } catch (e: any) {
      toast(e?.message || "Error generando rango");
    } finally {
      setBusy(false);
    }
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
      await refresh(false);
    } catch (e: any) {
      toast(e?.message || "Error generando capítulo");
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
        await refresh(false);
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
      await refresh(false);
    } catch (e: any) {
      toast(e?.message || "Error borrando audios");
    } finally {
      setBusy(false);
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

      <BottomSheet open={sheetOpen} title="Audio" onClose={() => setSheetOpen(false)}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div className="small muted" style={{ fontWeight: 900, marginBottom: 6 }}>Voz</div>
            <select className="select" value={voice} onChange={e => setVoice(e.target.value)}>
              {VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="small muted" style={{ fontWeight: 900, marginBottom: 6 }}>Modo</div>
            <select className="select" value={style} onChange={e => setStyle(e.target.value)}>
              {STYLES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Generación</div>
            <button className="btn btnPrimary" onClick={() => void genMissing()} disabled={busy}>
              ⚡ Generar faltantes
            </button>

            <div style={{ height: 10 }} />

            <div className="small muted" style={{ fontWeight: 900, marginBottom: 6 }}>Generar rango (1-based)</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="input"
                type="number"
                value={rangeStart}
                min={1}
                max={chapters.length || 1}
                onChange={e => setRangeStart(Number(e.target.value || 1))}
              />
              <input
                className="input"
                type="number"
                value={rangeEnd}
                min={1}
                max={chapters.length || 1}
                onChange={e => setRangeEnd(Number(e.target.value || 1))}
              />
            </div>
            <div style={{ height: 10 }} />
            <button className="btn" onClick={() => void genRange()} disabled={busy}>
              Generar rango
            </button>

            <div className="small muted" style={{ marginTop: 8 }}>
              Capítulos: 1..{chapters.length}
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Borrar audios</div>
            <button className="btn" onClick={() => void onDeleteAudios("current")} disabled={busy}>
              🧹 Borrar audios ({voice}/{style})
            </button>
            <div style={{ height: 10 }} />
            <button className="btn btnDanger" onClick={() => void onDeleteAudios("all")} disabled={busy}>
              🧨 Borrar TODOS los audios del libro
            </button>
            <div className="small muted" style={{ marginTop: 8 }}>
              Esto no borra el libro, solo los MP3.
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
