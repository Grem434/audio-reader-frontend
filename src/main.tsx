import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AppProvider } from "./app/AppContext";
import { registerSW } from "virtual:pwa-register";
import { ToastProvider } from "./ui/Toast";
import { PlayerProvider } from "./player/PlayerProvider";

const disablePwa = (import.meta as any).env?.VITE_DISABLE_PWA === "1";

if (!disablePwa) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <ToastProvider>
        <PlayerProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PlayerProvider>
      </ToastProvider>
    </AppProvider>
  </StrictMode>
);
