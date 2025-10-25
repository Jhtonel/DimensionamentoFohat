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
      
      // Fallback: salvar no localStorage se o servidor não estiver disponível
      console.log('🔄 Tentando fallback para localStorage...');
      const propostaId = `proposta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const propostaCompleta = {
        id: propostaId,
        ...propostaData,
        data_criacao: new Date().toISOString()
      };
      
      // Salvar no localStorage
      const propostasSalvas = JSON.parse(localStorage.getItem('propostas_salvas') || '[]');
      propostasSalvas.push(propostaCompleta);
      localStorage.setItem('propostas_salvas', JSON.stringify(propostasSalvas));
      
      console.log('✅ Proposta salva no localStorage como fallback:', propostaId);
      
      return {
        success: true,
        proposta_id: propostaId,
        message: 'Proposta salva localmente (servidor indisponível)'
      };
    }
  },

  /**
   * Gera HTML da proposta a partir dos dados salvos
   * @param {string} propostaId - ID da proposta
   * @returns {Promise<Object>} HTML da proposta
   */
  async gerarPropostaHTML(propostaId) {
    try {
      console.log('🔄 Gerando HTML da proposta:', propostaId);
      
      const response = await fetch(`${SERVER_URL}/gerar-proposta-html/${propostaId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'text/html',
        }
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
      
      // Fallback: gerar HTML localmente
      console.log('🔄 Tentando fallback para geração local de HTML...');
      
      try {
        // Carregar template
        const response = await fetch('/template.html');
        if (!response.ok) {
          throw new Error('Template não encontrado');
        }
        
        let templateHtml = await response.text();
        
        // Buscar dados da proposta no localStorage
        const propostasSalvas = JSON.parse(localStorage.getItem('propostas_salvas') || '[]');
        const proposta = propostasSalvas.find(p => p.id === propostaId);
        
        if (!proposta) {
          throw new Error('Proposta não encontrada');
        }
        
        // Substituir TODAS as variáveis do template
        templateHtml = templateHtml.replace(/{{cliente_nome}}/g, proposta.cliente_nome || 'Cliente');
        templateHtml = templateHtml.replace(/{{cliente_endereco}}/g, proposta.cliente_endereco || 'Endereço não informado');
        templateHtml = templateHtml.replace(/{{cliente_telefone}}/g, proposta.cliente_telefone || 'Telefone não informado');
        templateHtml = templateHtml.replace(/{{potencia_sistema}}/g, proposta.potencia_sistema || '0');
        templateHtml = templateHtml.replace(/{{potencia_sistema_kwp}}/g, proposta.potencia_sistema || '0.00');
        templateHtml = templateHtml.replace(/{{preco_final}}/g, `R$ ${(proposta.preco_final || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{cidade}}/g, proposta.cidade || 'Projeto');
        templateHtml = templateHtml.replace(/{{vendedor_nome}}/g, proposta.vendedor_nome || 'Representante Comercial');
        templateHtml = templateHtml.replace(/{{vendedor_cargo}}/g, proposta.vendedor_cargo || 'Especialista em Energia Solar');
        templateHtml = templateHtml.replace(/{{vendedor_telefone}}/g, proposta.vendedor_telefone || '(11) 99999-9999');
        templateHtml = templateHtml.replace(/{{vendedor_email}}/g, proposta.vendedor_email || 'contato@empresa.com');
        templateHtml = templateHtml.replace(/{{data_proposta}}/g, proposta.data_proposta || new Date().toLocaleDateString('pt-BR'));
        
        // Dados financeiros
        templateHtml = templateHtml.replace(/{{conta_atual_anual}}/g, `R$ ${(proposta.conta_atual_anual || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{anos_payback}}/g, proposta.anos_payback || '0');
        templateHtml = templateHtml.replace(/{{gasto_acumulado_payback}}/g, `R$ ${(proposta.gasto_acumulado_payback || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{consumo_mensal_kwh}}/g, proposta.consumo_mensal_kwh || '0');
        templateHtml = templateHtml.replace(/{{tarifa_energia}}/g, (proposta.tarifa_energia || 0.75).toFixed(3));
        templateHtml = templateHtml.replace(/{{economia_mensal_estimada}}/g, `R$ ${(proposta.economia_mensal_estimada || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        
        // Dados do kit
        templateHtml = templateHtml.replace(/{{quantidade_placas}}/g, proposta.quantidade_placas || '0');
        templateHtml = templateHtml.replace(/{{potencia_placa_w}}/g, proposta.potencia_placa_w || '0');
        templateHtml = templateHtml.replace(/{{area_necessaria}}/g, proposta.area_necessaria || '0');
        templateHtml = templateHtml.replace(/{{irradiacao_media}}/g, (proposta.irradiacao_media || 5.15).toFixed(2));
        templateHtml = templateHtml.replace(/{{geracao_media_mensal}}/g, proposta.geracao_media_mensal || '0');
        templateHtml = templateHtml.replace(/{{creditos_anuais}}/g, `R$ ${(proposta.creditos_anuais || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{economia_total_25_anos}}/g, `R$ ${(proposta.economia_total_25_anos || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{payback_meses}}/g, proposta.payback_meses || '0');
        
        // Custos
        templateHtml = templateHtml.replace(/{{custo_total_projeto}}/g, `R$ ${(proposta.custo_total_projeto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{custo_equipamentos}}/g, `R$ ${(proposta.custo_equipamentos || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{custo_instalacao}}/g, `R$ ${(proposta.custo_instalacao || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{custo_homologacao}}/g, `R$ ${(proposta.custo_homologacao || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{custo_outros}}/g, `R$ ${(proposta.custo_outros || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        templateHtml = templateHtml.replace(/{{margem_lucro}}/g, `R$ ${(proposta.margem_lucro || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        
        console.log('✅ HTML da proposta gerado localmente');
        
        return {
          success: true,
          proposta_id: propostaId,
          html_content: templateHtml,
          message: 'HTML gerado localmente (servidor indisponível)'
        };
      } catch (fallbackError) {
        console.error('❌ Erro no fallback de geração de HTML:', fallbackError);
        throw error; // Re-throw o erro original
      }
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
    return await this.gerarPropostaHTML(propostaId);
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
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      return response.ok;
  } catch (error) {
      console.error('❌ Servidor não está funcionando:', error);
      return false;
    }
  }
};