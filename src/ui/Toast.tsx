import React, { createContext, useContext, useMemo, useState } from "react";

type ToastItem = { id: string; text: string };
type ToastCtx = { toast: (text: string) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = (text: string) => {
    const id = (globalThis.crypto && 'randomUUID' in globalThis.crypto) ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setItems(prev => [...prev, { id, text }]);
    window.setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id));
    }, 2600);
  };

  const value = useMemo(() => ({ toast }), []);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom: "calc(12px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 200
        }}
      >
        {items.map(t => (
          <div
            key={t.id}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(10,12,16,0.92)",
              backdropFilter: "blur(10px)",
              color: "rgba(255,255,255,0.92)",
              borderRadius: 14,
              padding: "10px 12px",
              fontWeight: 700,
              boxShadow: "0 12px 40px rgba(0,0,0,0.40)"
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider/>");
  return ctx;
}