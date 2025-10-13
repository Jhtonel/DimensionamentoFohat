/**
 * Configurações da API Solaryum
 * Documentação: https://api-d1297.cloud.solaryum.com.br/swagger/index.html?urls.primaryName=Plataforma-V1
 */

export const SOLARYUM_CONFIG = {
  // URL base da API
  BASE_URL: import.meta.env.DEV 
    ? 'http://192.168.1.11:3002/api/solaryum'  // Proxy local para contornar CORS
    : 'https://api-d1297.cloud.solaryum.com.br',  // URL direta em produção
  
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
  
  // Configurações de fallback (dados mock)
  FALLBACK: {
    ENABLED: true,
    EQUIPMENT_PRICE_PER_KW: 8000, // R$ 8.000 por kW
    INSTALLATION_PRICE_PER_KW: 2000, // R$ 2.000 por kW
    TAX_RATE: 0.18, // 18% de impostos
    AVERAGE_TARIFF: 0.65 // R$ 0,65 por kWh
  }
};

export default SOLARYUM_CONFIG;
