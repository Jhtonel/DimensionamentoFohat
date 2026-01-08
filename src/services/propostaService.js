/**
 * Serviço para comunicação com o servidor de propostas
 */

import { getBackendUrl } from './backendUrl.js';

const SERVER_URL = getBackendUrl();

// Log da URL do servidor para debug
console.log('🌐 SERVER_URL configurado como:', SERVER_URL);
console.log('🌐 Hostname atual:', window.location.hostname);

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: options.signal || controller.signal });
    return resp;
  } finally {
    clearTimeout(t);
  }
};

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
      
      const token = (() => {
        try { return localStorage.getItem('app_jwt_token'); } catch { return null; }
      })();
      const response = await fetchWithTimeout(`${SERVER_URL}/salvar-proposta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(propostaData)
      }, 20000);

      console.log('📡 Resposta do servidor:', response.status, response.statusText);
      console.log('📡 Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        // Tentar extrair mensagem do backend (JSON ou texto)
        let backendMessage = '';
        try {
          const ct = response.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const errJson = await response.json();
            backendMessage = errJson?.message || errJson?.error || '';
          } else {
            backendMessage = await response.text();
          }
        } catch (_) {
          // ignore
        }
        const msg = backendMessage?.trim()
          ? backendMessage.trim()
          : `Erro HTTP ${response.status} - ${response.statusText || 'Falha ao salvar a proposta'}`;
        throw new Error(msg);
      }

      const result = await response.json();
      console.log('✅ Proposta salva no servidor:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Erro ao salvar proposta no servidor:', error);
      // Mensagens conhecidas do backend (ex.: validações 400/422)
      const known = [
        'Selecione a concessionária',
        'tarifa válida',
        'concessionária inválida',
        'dados inválidos',
      ];
      const errMsg = String(error?.message || '').toLowerCase();
      if (known.some(k => errMsg.includes(k.toLowerCase()))) {
        throw error;
      }
      // Se for erro de rede/timeout, retornar orientação de iniciar backend
      const networkHints = ['Failed to fetch', 'NetworkError', 'TypeError: fetch', 'aborted'];
      if (networkHints.some(h => String(error).includes(h))) {
        throw new Error('Servidor indisponível (porta 8000). Verifique se o backend está rodando e tente novamente.');
      }
      // Fallback genérico preservando a mensagem original
      throw new Error(error?.message || 'Não foi possível salvar a proposta.');
    }
  },

  /**
   * Calcula KPIs e tabelas diretamente no núcleo unificado
   * @param {Object} payload - mesmo contrato do backend (/dimensionamento/excel-calculo)
   * @returns {Promise<Object>} { success, resultado: { metrics, tabelas } }
   */
  async calcularNucleo(payload) {
    try {
      const response = await fetch(`${SERVER_URL}/dimensionamento/excel-calculo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(errText || `Erro ${response.status}`);
      }
      const json = await response.json();
      if (!json?.success) {
        throw new Error(json?.message || 'Falha ao calcular no núcleo');
      }
      return json;
    } catch (e) {
      console.error('❌ Erro em calcularNucleo:', e);
      return { success: false, message: e.message };
    }
  },

  /**
   * Gera os 5 gráficos da análise financeira no backend (sem salvar proposta)
   * @param {Object} payload - { consumo_mensal_kwh | consumo_mensal_reais, tarifa_energia, potencia_sistema, preco_venda, irradiacao_media | irradiancia_mensal_kwh_m2_dia }
   * @returns {Promise<Object>} { graficos_base64, metrics }
   */
  async gerarGraficos(payload) {
    try {
      const response = await fetchWithTimeout(`${SERVER_URL}/analise/gerar-graficos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 25000);
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Erro ao gerar gráficos: ${response.status} ${errText || ''}`);
      }
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message || 'Falha ao gerar gráficos');
      }
      return result;
    } catch (e) {
      console.error('❌ Erro ao gerar gráficos:', e);
      throw e;
    }
  },

  /**
   * Gera tabelas e gráficos (base64) da análise financeira
   * @param {Object} payload - { consumo_mensal_kwh | consumo_mensal_reais+tarifa_energia, tarifa_energia, potencia_sistema/kwp, irradiacao_media|irradiancia_mensal_kwh_m2_dia, preco_venda }
   */
  async analiseGerarGraficos(payload) {
    try {
      const response = await fetchWithTimeout(`${SERVER_URL}/analise/gerar-graficos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 25000);
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(errText || `Erro ${response.status}`);
      }
      return await response.json();
    } catch (e) {
      console.error('❌ Erro ao gerar gráficos:', e);
      return { success: false, message: e.message };
    }
  },

  /**
   * Anexa gráficos gerados ao JSON da proposta
   */
  async anexarGraficos(propostaId, body) {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}/propostas/${propostaId}/anexar-graficos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 20000);
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(err || `Erro ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      console.error('❌ Erro ao anexar gráficos na proposta:', e);
      return { success: false, message: e.message };
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
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          signal: opts.signal,
        },
        20000
      );

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