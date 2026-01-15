import { getBackendUrl } from "./backendUrl.js";

export async function baixarPdfPuppeteer(propostaId) {
  const base = getBackendUrl();
  // Usando rota pública que não requer autenticação
  const resp = await fetch(`${base}/proposta/${propostaId}/ver-pdf?download=true&t=${Date.now()}`);
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


