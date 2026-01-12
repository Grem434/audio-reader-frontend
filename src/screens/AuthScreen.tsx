import { useState } from "react";
import { useApp } from "../app/AppContext";

export function AuthScreen() {
  const { signIn, signUp, authError, authLoading } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    await signIn(email, password);
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    await signUp(email, password);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Audio Reader</h1>
        <p style={{ opacity: 0.8, marginBottom: 16 }}>Inicia sesión para continuar</p>

        <form style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Contraseña</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          {authError ? (
            <div style={{ color: "#b91c1c", background: "#fef2f2", padding: 10, borderRadius: 10 }}>
              {authError}
            </div>
          ) : null}

          <button
            onClick={onLogin}
            disabled={authLoading}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", cursor: "pointer" }}
          >
            {authLoading ? "Entrando…" : "Entrar"}
          </button>

          <button
            onClick={onSignup}
            disabled={authLoading}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              cursor: "pointer",
              background: "transparent",
            }}
          >
            {authLoading ? "Creando…" : "Crear cuenta"}
          </button>

          <p style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
            Si tu proyecto tiene “email confirmation” activado, tras crear cuenta tendrás que confirmar el email.
          </p>
        </form>
      </div>
    </div>
  );
}
