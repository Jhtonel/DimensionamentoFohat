/**
 * Configurações da API Solaryum
 * Documentação: https://api-d1297.cloud.solaryum.com.br/swagger/index.html?urls.primaryName=Plataforma-V1
 */

export const SOLARYUM_CONFIG = {
  // URL base da API
  // IMPORTANTE:
  // - Em DEV, o Vite faz proxy em /api/solaryum (ver vite.config.js)
  // - Em PROD (Railway), o backend Flask expõe /api/solaryum como proxy server-to-server
  BASE_URL: `${window.location.origin}/api/solaryum`,
  
  // Chave da API (configurar via variável de ambiente)
  API_KEY: '1R6OlSTa', // Token atualizado
  
  // Timeout para requisições (em ms)
  TIMEOUT: 10000,
  
  // Endpoints da API
  ENDPOINTS: {
    KITS_PRONTOS: '/integracaoPlataforma/BuscarKits',
    MONTAR_KITS: '/integracaoPlataforma/MontarKits',
    FILTROS: '/integracaoPlataforma/BuscarFiltros',
  },
  
  // Configurações de fallback removidas - agora retorna erro
  FALLBACK: {
    ENABLED: false, // Desabilitado
    ERROR_MESSAGE: 'Dados não disponíveis - API indisponível'
  }
};

export default SOLARYUM_CONFIG;
