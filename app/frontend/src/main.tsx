import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./ui/fonts.css";
import "./ui/tokens.css";
import "./styles.css";
import "./ui/semantic/semantic.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
