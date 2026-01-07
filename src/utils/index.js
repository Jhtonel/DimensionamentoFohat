// Utilitários para navegação e URLs
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function createPageUrl(pageName) {
  const routes = {
    'Dashboard': '/',
    'Clientes': '/clientes',
    'Projetos': '/projetos',
    'NovoProjeto': '/projetos/novo',
    'Configuracoes': '/configuracoes'
  };
  
  return routes[pageName] || '/';
}

// Utilitário para classes CSS
export function cn(...inputs) {
  // Implementação moderna (shadcn): combina clsx + tailwind-merge
  // Isso evita classes duplicadas e melhora consistência visual.
  return twMerge(clsx(inputs));
}

// Utilitário para formatação de moeda
export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Utilitário para formatação de data
export function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

// Re-exports (helpers modernos)
export { formatDateBR, getDateRangePreset, isWithinRange } from "./date.js";
export { normalizeNumberBR, formatCurrencyBRL } from "./number.js";
