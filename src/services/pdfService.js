import { getBackendUrl } from "./backendUrl.js";

export async function baixarPdfPuppeteer(propostaId) {
  const base = getBackendUrl();
  let token = null;
  try {
    token = localStorage.getItem("app_jwt_token");
  } catch (_) {}
  const resp = await fetch(`${base}/propostas/${propostaId}/pdf?t=${Date.now()}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!resp.ok) {
    let msg = `Falha ao gerar PDF (${resp.status})`;
    try {
      const j = await resp.json();
      if (j?.message) msg = j.message;
    } catch (_) {}
    throw new Error(msg);
  }
  return await resp.blob();
}


