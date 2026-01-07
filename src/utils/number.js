export function normalizeNumberBR(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace?.(/\./g, "")?.replace?.(",", ".") ?? v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export function formatCurrencyBRL(value) {
  const v = normalizeNumberBR(value);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}


