import React, { useEffect } from "react";

export function BottomSheet({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 10,
        zIndex: 150
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(12,14,18,0.98)",
          overflow: "hidden",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))"
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <div style={{ fontWeight: 900 }}>{title}</div>
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}
