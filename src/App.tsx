import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./app/AppContext";
import { ToastProvider } from "./ui/Toast";
import { PlayerProvider } from "./player/PlayerProvider";
import { AppLayout } from "./app/AppLayout";
import { LibraryScreen } from "./screens/LibraryScreen";
import { BookScreen } from "./screens/BookScreen";
import { PlayerScreen } from "./screens/PlayerScreen";

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <PlayerProvider>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/library" replace />} />
                <Route path="/library" element={<LibraryScreen />} />
                <Route path="/book/:id" element={<BookScreen />} />
                <Route path="/player" element={<PlayerScreen />} />
                <Route path="*" element={<Navigate to="/library" replace />} />
              </Routes>
            </AppLayout>
          </PlayerProvider>
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
