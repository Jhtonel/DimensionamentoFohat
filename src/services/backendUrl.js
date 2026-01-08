import { systemConfig } from "../config/systemConfig.js";

const stripTrailingSlash = (s) => String(s || "").replace(/\/+$/, "");

/**
 * URL base do backend (Flask).
 *
 * Regras:
 * - Se existir env `VITE_PROPOSAL_SERVER_URL` (ou `VITE_BACKEND_URL`), usa ela.
 * - Se `systemConfig.apiUrl` estiver preenchido, usa ela.
 * - Local: `http://localhost:8000`
 * - Produção: **mesmo origin** (backend serve o build do frontend no Railway)
 */
export const getBackendUrl = () => {
  const env =
    (import.meta?.env?.VITE_PROPOSAL_SERVER_URL || import.meta?.env?.VITE_BACKEND_URL || "").trim();
  if (env) return stripTrailingSlash(env);

  const cfg = (typeof systemConfig?.apiUrl === "string" ? systemConfig.apiUrl.trim() : "");
  if (cfg) return stripTrailingSlash(cfg);

  if (typeof window === "undefined") return "http://localhost:8000";

  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:8000";

  return stripTrailingSlash(window.location.origin);
};


