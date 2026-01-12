import { Routes, Route, Navigate } from "react-router-dom";
import { LibraryScreen } from "./screens/LibraryScreen";
import { BookScreen } from "./screens/BookScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { RecoveryScreen } from "./screens/RecoveryScreen";
import { useApp } from "./app/AppContext";

export default function App() {
  const { userId, authLoading, signOut } = useApp();

  const isRecovery =
    (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) ||
    (typeof window !== "undefined" && sessionStorage.getItem("audio_reader_recovery") === "1");

  // ✅ Recovery manda antes que authLoading / userId
  if (isRecovery) {
    return <RecoveryScreen />;
  }

  if (authLoading) {
    return (
      <div style={{ padding: 16 }}>
        <div>Cargando sesión…</div>
      </div>
    );
  }

  if (!userId) {
    return <AuthScreen />;
  }

  return (
    <>
      <div style={{ padding: 8, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={signOut} style={{ padding: 8, borderRadius: 10, border: "1px solid #e5e7eb" }}>
          Salir
        </button>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<LibraryScreen />} />
        <Route path="/book/:bookId" element={<BookScreen />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Routes>
    </>
  );
}
