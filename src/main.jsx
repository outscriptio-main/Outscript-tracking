import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "../creator-tracker-v4.jsx";
import { configError } from "./supabase";
import "./theme.css";

// Global light/dark toggle. Sits fixed bottom-right on every screen (sign-in,
// loading, error, app). Initial theme is set pre-paint by the inline script in
// index.html (reads localStorage / prefers-color-scheme) to avoid a flash.
function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("tt_theme", theme); } catch {}
  }, [theme]);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      style={{
        position: "fixed", bottom: 18, right: 18, zIndex: 2000,
        width: 42, height: 42, borderRadius: 999,
        background: "var(--surf)", color: "var(--text)",
        border: "1px solid var(--border)", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17, lineHeight: 1, boxShadow: "var(--shadow)",
      }}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

function ConfigErrorScreen({ message }) {
  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)", color: "var(--text)",
      fontFamily: "'Inter', sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.2em", color: "#e5484d", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Configuration error</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 14, letterSpacing: "-0.02em" }}>App can't reach Supabase yet</h2>
        <p style={{ color: "var(--muted2)", fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>{message}</p>
        <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>After adding the variables in your host's dashboard, trigger a fresh deploy — Vite inlines them at build time, so existing builds won't pick up changes.</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeToggle />
    {configError ? <ConfigErrorScreen message={configError} /> : <App />}
  </StrictMode>
);
