import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function getHashParams() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  return {
    type: params.get("type"),
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
  };
}

export function RecoveryScreen() {
  const [{ type, access_token, refresh_token }] = useState(() => getHashParams());
  const isRecovery = useMemo(() => type === "recovery", [type]);

  const [ready, setReady] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    sessionStorage.setItem("audio_reader_recovery", "1");

    (async () => {
      try {
        setErr(null);
        setMsg(null);

        if (!isRecovery) {
          sessionStorage.removeItem("audio_reader_recovery");
          setErr("No es un enlace de recuperación válido (type!=recovery).");
          return;
        }
        if (!access_token || !refresh_token) {
          sessionStorage.removeItem("audio_reader_recovery");
          setErr("Faltan tokens en el enlace de recuperación.");
          return;
        }

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (setSessionError) {
          sessionStorage.removeItem("audio_reader_recovery");
          setErr(setSessionError.message);
          return;
        }

        setReady(true);
      } catch (e: any) {
        sessionStorage.removeItem("audio_reader_recovery");
        setErr(e?.message || "Error preparando recuperación.");
      }
    })();
  }, [isRecovery, access_token, refresh_token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!pw1 || pw1.length < 8) {
      setErr("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (pw1 !== pw2) {
      setErr("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Contraseña actualizada. Ya puedes iniciar sesión.");

    sessionStorage.removeItem("audio_reader_recovery");
window.history.replaceState({}, document.title, window.location.pathname);

await supabase.auth.signOut();
window.location.assign("/");

    // Limpia tokens del hash y desbloquea App (para que deje de forzar RecoveryScreen)
    sessionStorage.removeItem("audio_reader_recovery");
    window.history.replaceState({}, document.title, window.location.pathname);

    // opcional: redirigir a home (App decidirá si login o library)
    window.location.assign("/");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Restablecer contraseña</h1>

        {!ready ? (
          <p style={{ opacity: 0.8 }}>Preparando recuperación…</p>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Nueva contraseña</span>
              <input
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                type="password"
                placeholder="mínimo 8 caracteres"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Repite la contraseña</span>
              <input
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                type="password"
                placeholder="repite"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>

            {err ? (
              <div style={{ color: "#b91c1c", background: "#fef2f2", padding: 10, borderRadius: 10 }}>{err}</div>
            ) : null}

            {msg ? (
              <div style={{ color: "#166534", background: "#f0fdf4", padding: 10, borderRadius: 10 }}>{msg}</div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", cursor: "pointer" }}
            >
              {loading ? "Guardando…" : "Guardar nueva contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
