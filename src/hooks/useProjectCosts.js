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
        // API indisponível - lançar erro em vez de usar dados mockados
        const errorMsg = 'API de custos indisponível. Não é possível calcular custos sem dados reais.';
        setError(errorMsg);
        setApiAvailable(false);
        throw new Error(errorMsg);
      }

      // Busca os custos usando o novo método
      const projectCosts = await solaryumApi.calcularCustosProjeto(dimensionamentoData);
      setCosts(projectCosts);
      return projectCosts;
    } catch (err) {
      console.error('❌ Erro ao buscar custos:', err);
      // NÃO usar fallback - propagar erro
      setError(err.message);
      setApiAvailable(false);
      setCosts(null);
      throw err;
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

    // Se consumo mês a mês foi informado e potencia não veio preenchida, calcular a potência automaticamente
    try {
      const temMesAMes = Array.isArray(formData.consumo_mes_a_mes) && formData.consumo_mes_a_mes.length > 0;
      if ((!dimensionamentoData.potencia_kw || dimensionamentoData.potencia_kw <= 0) && temMesAMes) {
        const totalAnualKwh = formData.consumo_mes_a_mes.reduce((sum, item) => sum + (parseFloat(item.kwh) || 0), 0);
        const consumoMedioMensal = totalAnualKwh / 12;
        const irradianciaMedia = parseFloat(formData.irradiacao_media) || 5.15; // kWh/m²/dia
        const eficienciaSistema = 0.80;
        const fatorCorrecao = 1.066;
        const potenciaCalculada = (consumoMedioMensal / ((irradianciaMedia * eficienciaSistema) * 30.4)) * fatorCorrecao;
        dimensionamentoData.potencia_kw = Math.max(parseFloat(potenciaCalculada.toFixed(2)), 0);
        console.log('⚙️ Potência calculada a partir do consumo mês a mês:', dimensionamentoData.potencia_kw, 'kW');
      }
    } catch (e) {
      console.warn('Não foi possível calcular potência a partir do consumo mês a mês:', e);
    }

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
    if (!totalCost || !consumoMensal) {
      throw new Error('Dados insuficientes para calcular economia - Custo total e consumo mensal são obrigatórios');
    }
    
    throw new Error('Cálculo de economia requer tarifa real da concessionária');
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
