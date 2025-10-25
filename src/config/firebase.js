/**
 * Configuração do Firebase
 */

export const firebaseConfig = {
  apiKey: "AIzaSyAZJON1lmOuD9rFhdQIataet49wAEN9b3Y",
  authDomain: "fohat-energia.firebaseapp.com",
  projectId: "fohat-energia",
  storageBucket: "fohat-energia.firebasestorage.app",
  messagingSenderId: "703891029555",
  appId: "1:703891029555:web:935b2b70e809e23dc2ad46",
  measurementId: "G-GY108V55FK"
};

// Configurações do sistema
export const systemConfig = {
  // URL do servidor backend
  // Deixe vazio para o frontend usar automaticamente `${window.location.hostname}:8000`
  apiUrl: '',
  
  // Configurações padrão
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
      "Celpe": 0.76
    }
  }
};
