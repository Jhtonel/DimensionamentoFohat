import { useState, useEffect, useCallback } from 'react';
import solaryumApi from '../services/solaryumApi';
import { SOLARYUM_CONFIG } from '../config/solaryum';

/**
 * Hook para gerenciar custos de projetos via API Solaryum
 */
export const useProjectCosts = () => {
  const [costs, setCosts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(true);

  /**
   * Busca custos do projeto baseado nos dados de dimensionamento
   */
  const fetchProjectCosts = useCallback(async (dimensionamentoData) => {
    if (!dimensionamentoData) {
      setError('Dados de dimensionamento são obrigatórios');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verifica se a API está disponível
      const isApiAvailable = await solaryumApi.checkApiHealth();
      setApiAvailable(isApiAvailable);
      
      console.log('🔍 API disponível:', isApiAvailable);

      if (!isApiAvailable) {
        console.log('⚠️ API não disponível, usando dados mock');
        const mockCosts = solaryumApi.getMockCustos(dimensionamentoData);
        setCosts(mockCosts);
        return mockCosts;
      }

      // Busca os custos usando o novo método
      const projectCosts = await solaryumApi.calcularCustosProjeto(dimensionamentoData);
      setCosts(projectCosts);
      
      return projectCosts;
    } catch (err) {
      console.error('❌ Erro ao buscar custos:', err);
      console.log('📋 Response completa do erro:', err);
      
      // Em caso de erro, usa dados mock
      console.log('⚠️ Erro na API, usando dados mock como fallback');
      const mockCosts = solaryumApi.getMockCustos(dimensionamentoData);
      setCosts(mockCosts);
      setApiAvailable(false);
      
      return mockCosts;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Limpa os custos atuais
   */
  const clearCosts = useCallback(() => {
    setCosts(null);
    setError(null);
  }, []);

  /**
   * Calcula custos em tempo real baseado nos dados do formulário
   */
  const calculateRealTimeCosts = useCallback(async (formData) => {
    console.log('=== INÍCIO calculateRealTimeCosts ===');
    console.log('calculateRealTimeCosts chamado com:', formData);
    
    // Validação dos dados obrigatórios
    if (!formData) {
      console.error('❌ formData é null ou undefined');
      setError('Dados do formulário são obrigatórios');
      return null;
    }
    
    if (!formData.potencia_kw || formData.potencia_kw <= 0) {
      console.error('❌ Potência inválida:', formData.potencia_kw);
      setError('Potência do sistema é obrigatória');
      return null;
    }
    
    const dimensionamentoData = {
      potencia_kw: parseFloat(formData.potencia_kw) || 0,
      tipo_instalacao: formData.tipo_instalacao || 'residencial',
      regiao: formData.regiao || 'sudeste',
      tipo_telhado: formData.tipo_telhado || 'ceramico',
      consumo_mensal: parseFloat(formData.consumo_mensal_kwh) || parseFloat(formData.consumo_mensal_reais) || 0,
      tensao: formData.tensao || '220',
      fase: formData.fase || 'monofasico',
      complexidade: formData.complexidade || 'media',
      ibge: formData.ibge || null,
      marcaPainel: formData.marcaPainel || null,
      marcaInversor: formData.marcaInversor || null,
      potenciaPainel: formData.potenciaPainel || null,
      tipoInv: formData.tipoInv || null
    };

    console.log('dimensionamentoData preparado:', dimensionamentoData);
    console.log('potencia_kw:', dimensionamentoData.potencia_kw);

    // Só busca se tiver dados mínimos
    if (dimensionamentoData.potencia_kw > 0) {
      console.log('✅ Potência válida, chamando fetchProjectCosts...');
      try {
        const resultado = await fetchProjectCosts(dimensionamentoData);
        console.log('✅ fetchProjectCosts retornou:', resultado);
        console.log('=== FIM calculateRealTimeCosts (SUCESSO) ===');
        return resultado;
      } catch (error) {
        console.error('💥 Erro em fetchProjectCosts:', error);
        console.log('=== FIM calculateRealTimeCosts (ERRO) ===');
        return null;
      }
    }

    console.log('❌ Potência não definida ou inválida, retornando null');
    console.log('=== FIM calculateRealTimeCosts (SEM POTÊNCIA) ===');
    return null;
  }, [fetchProjectCosts]);

  /**
   * Formata valores monetários
   */
  const formatCurrency = useCallback((value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  }, []);

  /**
   * Calcula economia mensal estimada
   */
  const calculateMonthlySavings = useCallback((totalCost, consumoMensal) => {
    if (!totalCost || !consumoMensal) return 0;
    
    const tarifaMedia = SOLARYUM_CONFIG.FALLBACK.AVERAGE_TARIFF;
    const economiaMensal = consumoMensal * tarifaMedia;
    const paybackAnos = totalCost / (economiaMensal * 12);
    
    return {
      economiaMensal,
      paybackAnos,
      economiaAnual: economiaMensal * 12
    };
  }, []);

  return {
    costs,
    loading,
    error,
    apiAvailable,
    fetchProjectCosts,
    calculateRealTimeCosts,
    clearCosts,
    formatCurrency,
    calculateMonthlySavings
  };
};

export default useProjectCosts;
