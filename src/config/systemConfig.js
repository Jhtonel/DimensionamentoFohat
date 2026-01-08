/**
 * Configurações do sistema (sem Firebase).
 *
 * - `apiUrl`: override opcional do backend. Deixe vazio para usar `getBackendUrl()`.
 */
export const systemConfig = {
  // URL do servidor backend (Flask). Ex.: "http://localhost:8000"
  apiUrl: "",

  // Configurações padrão (mantidas por compatibilidade; podem ser movidas para Postgres/config)
  defaultSettings: {
    custo_instalacao_por_kw: 800.0,
    custo_ca_aterramento: 500.0,
    custo_homologacao: 300.0,
    custo_plaquinhas: 200.0,
    custo_obra_por_kw: 400.0,
    margem_desejada: 0.3,
    comissao_vendedor: 0.05,
    eficiencia_sistema: 0.85,
    degradacao_anual: 0.005,
    tarifas_concessionarias: {
      "EDP SP": 0.82,
      "Enel SP": 0.75,
      "CPFL": 0.78,
      "Light": 0.85,
      "Cemig": 0.72,
      "Coelba": 0.74,
      "Celpe": 0.76,
    },
  },
};


