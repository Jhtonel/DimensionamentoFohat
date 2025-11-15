/**
 * Serviço para comunicação com o servidor de propostas
 */

import { systemConfig } from '../config/firebase.js';

// Detectar automaticamente a URL do servidor baseada no host atual, priorizando config
const getServerUrl = () => {
  // Verificar se há uma variável de ambiente configurada
  if (import.meta.env.VITE_PROPOSAL_SERVER_URL) {
    return import.meta.env.VITE_PROPOSAL_SERVER_URL;
  }
  // Priorizar configuração do sistema
  if (typeof systemConfig?.apiUrl === 'string' && systemConfig.apiUrl.trim() !== '') {
    return systemConfig.apiUrl.trim();
  }
  
  const hostname = window.location.hostname;
  const port = '8000';
  
  // Se estiver rodando localmente, usar localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:${port}`;
  }
  
  // Caso contrário, usar o mesmo hostname com porta 8000
  return `http://${hostname}:${port}`;
};

const SERVER_URL = getServerUrl();

// Log da URL do servidor para debug
console.log('🌐 SERVER_URL configurado como:', SERVER_URL);
console.log('🌐 Hostname atual:', window.location.hostname);

export const propostaService = {
  /**
   * Salva uma proposta no servidor
   * @param {Object} propostaData - Dados da proposta
   * @returns {Promise<Object>} Resposta do servidor com proposta_id
   */
  async salvarProposta(propostaData) {
    try {
      console.log('🚀 Enviando proposta para o servidor:', propostaData);
      console.log('🌐 URL do servidor:', `${SERVER_URL}/salvar-proposta`);
      console.log('🌐 SERVER_URL configurado como:', SERVER_URL);
      
      const response = await fetch(`${SERVER_URL}/salvar-proposta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(propostaData)
      });

      console.log('📡 Resposta do servidor:', response.status, response.statusText);
      console.log('📡 Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Proposta salva no servidor:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Erro ao salvar proposta no servidor:', error);
      // Não salvar fallback local: exigimos backend para gerar imagens/gráficos
      throw new Error('Servidor indisponível na porta 8000. Inicie o backend para salvar a proposta.');
    }
  },

  /**
   * Gera HTML da proposta a partir dos dados salvos
   * @param {string} propostaId - ID da proposta
   * @returns {Promise<Object>} HTML da proposta
   */
  async gerarPropostaHTML(propostaId, opts = {}) {
    try {
      console.log('🔄 Gerando HTML da proposta:', propostaId);
      
      const url = `${SERVER_URL}/gerar-proposta-html/${propostaId}?t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: opts.signal
      });

      if (!response.ok) {
        // Ajuda a diagnosticar 404 por ID incorreto
        const errText = await response.text().catch(() => '');
        const msg = `Erro ao gerar HTML (status ${response.status}). ${errText || ''}`;
        throw new Error(msg);
      }

      const htmlContent = await response.text();
      console.log('✅ HTML da proposta gerado:', htmlContent.substring(0, 100) + '...');
      
      return {
        success: true,
        proposta_id: propostaId,
        html_content: htmlContent,
        message: 'HTML gerado com sucesso'
      };
    } catch (error) {
      console.error('❌ Erro ao gerar HTML da proposta:', error);
      throw error;
    }
  },

  /**
   * Atalho: salva a proposta e, com o ID retornado, já gera o HTML
   * Garante que o mesmo ID é utilizado, evitando 404 por ID incorreto
   */
  async salvarEGerarHTML(propostaData) {
    const salvar = await this.salvarProposta(propostaData);
    const propostaId = salvar?.proposta_id;
    if (!propostaId) {
      throw new Error('Não foi possível obter o proposta_id do servidor.');
    }
    // Não gerar HTML aqui para evitar chamadas duplicadas simultâneas.
    // A tela de visualização chamará gerarPropostaHTML quando abrir.
    return salvar;
  },

  /**
   * Obtém URL para visualizar a proposta
   * @param {string} propostaId - ID da proposta
   * @returns {string} URL da proposta
   */
  getPropostaURL(propostaId) {
    return `${SERVER_URL}/proposta/${propostaId}`;
  },

  /**
   * Gera PDF da proposta usando o backend (WeasyPrint)
   * @param {string} propostaId - ID da proposta
   * @param {boolean} force - Forçar regeneração do PDF (ignorar cache)
   * @returns {Promise<Object>} Blob do PDF e URL para visualização
   */
  async gerarPDF(propostaId, force = false) {
    try {
      console.log('🔄 Gerando PDF da proposta:', propostaId);
      
      const url = force 
        ? `${SERVER_URL}/gerar-pdf/${propostaId}?force=true`
        : `${SERVER_URL}/gerar-pdf/${propostaId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao gerar PDF: ${response.status}`);
      }

      const blob = await response.blob();
      const pdfUrl = URL.createObjectURL(blob);
      
      console.log('✅ PDF gerado com sucesso');
      
      return {
        success: true,
        blob: blob,
        url: pdfUrl,
        message: 'PDF gerado com sucesso'
      };
    } catch (error) {
      console.error('❌ Erro ao gerar PDF:', error);
      return {
        success: false,
        message: error.message
      };
    }
  },

  /**
   * Verifica se o servidor está funcionando
   * @returns {Promise<boolean>} Status do servidor
   */
  async verificarServidor() {
    try {
      // timeout curto (5s) para diagnóstico rápido de disponibilidade
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(t);

      return response.ok;
  } catch (error) {
      console.error('❌ Servidor não está funcionando:', error);
      return false;
    }
  }
};