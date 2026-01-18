import { useState, useRef, useEffect } from "react";
import { chatWithBook } from "../apiClient";

type Props = {
    bookId: string;
    onClose: () => void;
};

type Message = {
    role: "user" | "ai";
    text: string;
};

export function ChatInterface({ bookId, onClose }: Props) {
    const [messages, setMessages] = useState<Message[]>([
        { role: "ai", text: "Hola, soy tu asistente de lectura. Pregúntame algo sobre el libro." }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function send() {
        if (!input.trim() || loading) return;
        const q = input;
        setInput("");
        setLoading(true);

        setMessages(prev => [...prev, { role: "user", text: q }]);

        try {
            const res = await chatWithBook(bookId, q);
            setMessages(prev => [...prev, { role: "ai", text: res.answer || "No pude encontrar respuesta." }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: "ai", text: "Error de conexión." }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "#0b0d10",
            zIndex: 200,
            display: "flex",
            flexDirection: "column"
        }}>
            {/* Header */}
            <div style={{
                padding: 16,
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#15171b"
            }}>
                <div style={{ fontWeight: "bold" }}>💬 Chat con el Libro</div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={async () => {
                            if (confirm("¿Indexar este libro para el chat? (Puede tardar unos segundos)")) {
                                try {
                                    // Import dynamically to avoid top-level issues if not needed
                                    const { processRagIndex } = await import("../apiClient");
                                    await processRagIndex(bookId);
                                    alert("Indexación iniciada en segundo plano. Espera unos segundos y pregunta.");
                                } catch (e) {
                                    alert("Error iniciando indexación");
                                }
                            }
                        }}
                        style={{ background: "#2563eb", border: "none", color: "white", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                        🧠 Preparar
                    </button>
                    <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 24, cursor: "pointer", color: "white" }}>✖</button>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        background: m.role === "user" ? "#3b82f6" : "#2a2d33",
                        color: "white",
                        padding: "10px 14px",
                        borderRadius: 12,
                        maxWidth: "80%",
                        lineHeight: 1.5,
                        fontSize: 15
                    }}>
                        {m.text}
                    </div>
                ))}
                {loading && <div style={{ alignSelf: "flex-start", color: "#888", fontSize: 13 }}>Escribiendo...</div>}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.1)", background: "#15171b", display: "flex", gap: 10 }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && send()}
                    placeholder="Ej: ¿Quién es el protagonista?"
                    style={{
                        flex: 1,
                        background: "#0b0d10",
                        border: "1px solid #333",
                        color: "white",
                        padding: "12px 16px",
                        borderRadius: 24,
                        outline: "none"
                    }}
                />
                <button
                    onClick={send}
                    disabled={loading || !input.trim()}
                    style={{
                        background: "#3b82f6",
                        border: "none",
                        color: "white",
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        opacity: loading || !input.trim() ? 0.5 : 1
                    }}
                >
                    ➤
                </button>
            </div>
        </div>
    );
}
