// Utilitários para navegação e URLs
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
  return inputs.filter(Boolean).join(' ');
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
