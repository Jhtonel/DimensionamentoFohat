import { 
  buscarConcessionaria, 
  buscarConcessionariasPorCidade,
  calcularTarifaTotal,
  converterReaisParaKwh,
  converterKwhParaReais,
  obterTodasConcessionarias,
  obterEstatisticasTarifas
} from '../data/concessionariasSP.js';

/**
 * Utilitários para cálculos de energia elétrica em São Paulo
 */

/**
 * Calcula o consumo mensal em kWh baseado no valor em reais
 * @param {number} valorReais - Valor da conta de luz em reais
 * @param {string} concessionaria - Nome da concessionária
 * @param {string} tipoConsumo - Tipo de consumo ('residencial', 'comercial', 'industrial')
 * @param {string} bandeira - Bandeira tarifária ('verde', 'amarela', 'vermelha1', 'vermelha2')
 * @returns {Object} Resultado do cálculo
 */
export async function calcularConsumoPorValor(valorReais, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
  try {
    const concessionariaData = buscarConcessionaria(concessionaria);
    
    if (!concessionariaData) {
      throw new Error(`Concessionária "${concessionaria}" não encontrada`);
    }

    const consumoKwh = converterReaisParaKwh(valorReais, concessionariaData, tipoConsumo, bandeira);
    const tarifaTotal = calcularTarifaTotal(concessionariaData, tipoConsumo, bandeira);
    
    return {
      valorReais,
      consumoKwh: Math.round(consumoKwh * 100) / 100, // Arredonda para 2 casas decimais
      tarifaTotal: Math.round(tarifaTotal * 1000) / 1000, // Arredonda para 3 casas decimais
      concessionaria: concessionariaData.nome,
      tipoConsumo,
      bandeira,
      detalhes: {
        tarifaBasica: concessionariaData.tarifas[tipoConsumo].tarifaBasica,
        icms: concessionariaData.tarifas[tipoConsumo].icms,
        pisCofins: concessionariaData.tarifas[tipoConsumo].pisCofins,
        bandeiraTarifaria: concessionariaData.bandeirasTarifarias[bandeira]
      }
    };
  } catch (error) {
    console.error('Erro ao calcular consumo por valor:', error);
    throw error;
  }
}

/**
 * Calcula o valor em reais baseado no consumo em kWh
 * @param {number} consumoKwh - Consumo em kWh
 * @param {string} concessionaria - Nome da concessionária
 * @param {string} tipoConsumo - Tipo de consumo
 * @param {string} bandeira - Bandeira tarifária
 * @returns {Object} Resultado do cálculo
 */
export async function calcularValorPorConsumo(consumoKwh, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
  try {
    const concessionariaData = buscarConcessionaria(concessionaria);
    
    if (!concessionariaData) {
      throw new Error(`Concessionária "${concessionaria}" não encontrada`);
    }

    const valorReais = converterKwhParaReais(consumoKwh, concessionariaData, tipoConsumo, bandeira);
    const tarifaTotal = calcularTarifaTotal(concessionariaData, tipoConsumo, bandeira);
    
    return {
      consumoKwh,
      valorReais: Math.round(valorReais * 100) / 100,
      tarifaTotal: Math.round(tarifaTotal * 1000) / 1000,
      concessionaria: concessionariaData.nome,
      tipoConsumo,
      bandeira,
      detalhes: {
        tarifaBasica: concessionariaData.tarifas[tipoConsumo].tarifaBasica,
        icms: concessionariaData.tarifas[tipoConsumo].icms,
        pisCofins: concessionariaData.tarifas[tipoConsumo].pisCofins,
        bandeiraTarifaria: concessionariaData.bandeirasTarifarias[bandeira]
      }
    };
  } catch (error) {
    console.error('Erro ao calcular valor por consumo:', error);
    throw error;
  }
}

/**
 * Busca concessionárias que atendem uma cidade específica
 * @param {string} cidade - Nome da cidade
 * @returns {Array} Array de concessionárias
 */
export function buscarConcessionariasCidade(cidade) {
  return buscarConcessionariasPorCidade(cidade);
}

/**
 * Obtém informações completas de uma concessionária
 * @param {string} nomeConcessionaria - Nome da concessionária
 * @returns {Object|null} Dados completos da concessionária
 */
export function obterConcessionaria(nomeConcessionaria) {
  return buscarConcessionaria(nomeConcessionaria);
}

/**
 * Calcula economia com energia solar
 * @param {number} consumoKwh - Consumo mensal em kWh
 * @param {string} concessionaria - Concessionária
 * @param {string} tipoConsumo - Tipo de consumo
 * @param {string} bandeira - Bandeira tarifária
 * @param {number} percentualEconomia - Percentual de economia (0-1)
 * @returns {Object} Resultado do cálculo de economia
 */
export async function calcularEconomiaSolar(consumoKwh, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde', percentualEconomia = 0.8) {
  try {
    const valorAtual = await calcularValorPorConsumo(consumoKwh, concessionaria, tipoConsumo, bandeira);
    const consumoEconomizado = consumoKwh * percentualEconomia;
    const valorEconomizado = valorAtual.valorReais * percentualEconomia;
    
    return {
      consumoAtual: consumoKwh,
      valorAtual: valorAtual.valorReais,
      consumoEconomizado: Math.round(consumoEconomizado * 100) / 100,
      valorEconomizado: Math.round(valorEconomizado * 100) / 100,
      percentualEconomia: percentualEconomia * 100,
      economiaAnual: Math.round(valorEconomizado * 12 * 100) / 100,
      concessionaria: valorAtual.concessionaria,
      tarifaTotal: valorAtual.tarifaTotal
    };
  } catch (error) {
    console.error('Erro ao calcular economia solar:', error);
    throw error;
  }
}

/**
 * Compara tarifas entre concessionárias
 * @param {string} tipoConsumo - Tipo de consumo
 * @param {string} bandeira - Bandeira tarifária
 * @returns {Array} Array com comparação de tarifas
 */
export function compararTarifas(tipoConsumo = 'residencial', bandeira = 'verde') {
  const concessionarias = obterTodasConcessionarias();
  
  return concessionarias.map(concessionaria => ({
    nome: concessionaria.nome,
    sigla: concessionaria.sigla,
    tarifaTotal: calcularTarifaTotal(concessionaria, tipoConsumo, bandeira),
    tarifaBasica: concessionaria.tarifas[tipoConsumo].tarifaBasica,
    icms: concessionaria.tarifas[tipoConsumo].icms,
    pisCofins: concessionaria.tarifas[tipoConsumo].pisCofins,
    bandeiraTarifaria: concessionaria.bandeirasTarifarias[bandeira],
    areasAtendimento: concessionaria.areasAtendimento
  })).sort((a, b) => a.tarifaTotal - b.tarifaTotal);
}

/**
 * Obtém estatísticas gerais das tarifas
 * @returns {Object} Estatísticas das tarifas
 */
export function obterEstatisticas() {
  return obterEstatisticasTarifas();
}

/**
 * Valida se uma concessionária existe
 * @param {string} nomeConcessionaria - Nome da concessionária
 * @returns {boolean} True se existe, false caso contrário
 */
export function validarConcessionaria(nomeConcessionaria) {
  return buscarConcessionaria(nomeConcessionaria) !== null;
}

/**
 * Obtém lista de tipos de consumo disponíveis
 * @returns {Array} Array com tipos de consumo
 */
export function obterTiposConsumo() {
  return [
    { value: 'residencial', label: 'Residencial' },
    { value: 'comercial', label: 'Comercial' },
    { value: 'industrial', label: 'Industrial' }
  ];
}

/**
 * Obtém lista de bandeiras tarifárias
 * @returns {Array} Array com bandeiras tarifárias
 */
export function obterBandeirasTarifarias() {
  return [
    { value: 'verde', label: 'Verde', descricao: 'Sem acréscimo' },
    { value: 'amarela', label: 'Amarela', descricao: 'Acréscimo de R$ 0,010/kWh' },
    { value: 'vermelha1', label: 'Vermelha Patamar 1', descricao: 'Acréscimo de R$ 0,030/kWh' },
    { value: 'vermelha2', label: 'Vermelha Patamar 2', descricao: 'Acréscimo de R$ 0,030/kWh' }
  ];
}
