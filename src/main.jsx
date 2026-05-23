import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../creator-tracker-v4.jsx";
import { configError } from "./supabase";

function ConfigErrorScreen({ message }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#070708", color: "#f5f5f7",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.2em", color: "#ff4d6d", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Configuration error</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 14, letterSpacing: "-0.02em" }}>App can't reach Supabase yet</h2>
        <p style={{ color: "#b3b3bf", fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>{message}</p>
        <p style={{ color: "#7a7a85", fontSize: 12, lineHeight: 1.6 }}>After adding the variables in your host's dashboard, trigger a fresh deploy — Vite inlines them at build time, so existing builds won't pick up changes.</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {configError ? <ConfigErrorScreen message={configError} /> : <App />}
  </StrictMode>
);
