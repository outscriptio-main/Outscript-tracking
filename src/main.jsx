import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../creator-tracker-v4.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
