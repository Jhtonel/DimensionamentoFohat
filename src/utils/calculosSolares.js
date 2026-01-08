/**
 * Módulo de Cálculos Solares - Profissional e Robusto
 * 
 * Todas as fórmulas seguem padrões da indústria solar brasileira.
 * Referências: CRESESB, ANEEL, boas práticas de dimensionamento fotovoltaico.
 */

// ============================================================================
// CONSTANTES DO SISTEMA
// ============================================================================

export const CONSTANTES = {
  // Eficiência do sistema (Performance Ratio - PR)
  // Considera perdas: inversores, cabeamento, temperatura, sujeira, etc.
  PR_SISTEMA: 0.80, // 80% - valor conservador para SP
  
  // Degradação anual dos módulos (garantia fabricantes)
  DEGRADACAO_ANUAL: 0.005, // 0.5% ao ano
  
  // Vida útil do sistema para cálculos financeiros
  VIDA_UTIL_ANOS: 25,
  
  // Aumento médio anual da tarifa de energia (ANEEL histórico)
  AUMENTO_TARIFA_ANUAL: 0.041, // 4.1% ao ano
  
  // Área média ocupada por painel (m²)
  AREA_POR_PAINEL_M2: 2.2,
  
  // Dias médios por mês
  DIAS_MES: 30.4,
  
  // Meses por ano
  MESES_ANO: 12,
  
  // Custo mínimo de disponibilidade (kWh)
  DISPONIBILIDADE_MONOFASICA: 30,
  DISPONIBILIDADE_BIFASICA: 50,
  DISPONIBILIDADE_TRIFASICA: 100,
};

// ============================================================================
// FUNÇÕES DE CÁLCULO DE DIMENSIONAMENTO
// ============================================================================

/**
 * Calcula a potência necessária do sistema fotovoltaico
 * 
 * Fórmula: Potência (kWp) = Consumo Anual (kWh) / (Irradiação × PR × 365)
 * 
 * @param {number} consumoMensalKwh - Consumo mensal médio em kWh
 * @param {number} irradiacaoMedia - Irradiação média diária em kWh/m²/dia
 * @param {number} performanceRatio - Eficiência do sistema (default: 0.80)
 * @returns {number} Potência necessária em kWp
 */
export function calcularPotenciaNecessaria(consumoMensalKwh, irradiacaoMedia, performanceRatio = CONSTANTES.PR_SISTEMA) {
  if (consumoMensalKwh <= 0 || irradiacaoMedia <= 0) return 0;
  
  const consumoAnual = consumoMensalKwh * CONSTANTES.MESES_ANO;
  const geracaoEspecifica = irradiacaoMedia * performanceRatio * 365;
  
  return consumoAnual / geracaoEspecifica;
}

/**
 * Calcula a quantidade de painéis necessários
 * 
 * @param {number} potenciaKwp - Potência do sistema em kWp
 * @param {number} potenciaPainelW - Potência do painel em Watts
 * @returns {number} Quantidade de painéis (arredondado para cima)
 */
export function calcularQuantidadePaineis(potenciaKwp, potenciaPainelW) {
  if (potenciaKwp <= 0 || potenciaPainelW <= 0) return 0;
  
  const potenciaPainelKw = potenciaPainelW / 1000;
  return Math.ceil(potenciaKwp / potenciaPainelKw);
}

/**
 * Calcula a geração mensal estimada do sistema
 * 
 * Fórmula: Geração = Potência × Irradiação × PR × Dias
 * 
 * @param {number} potenciaKwp - Potência do sistema em kWp
 * @param {number} irradiacaoMedia - Irradiação média diária em kWh/m²/dia
 * @param {number} performanceRatio - Eficiência do sistema
 * @param {number} degradacaoAnos - Anos de degradação a considerar (para projeções futuras)
 * @returns {number} Geração mensal em kWh
 */
export function calcularGeracaoMensal(potenciaKwp, irradiacaoMedia, performanceRatio = CONSTANTES.PR_SISTEMA, degradacaoAnos = 0) {
  if (potenciaKwp <= 0 || irradiacaoMedia <= 0) return 0;
  
  const fatorDegradacao = Math.pow(1 - CONSTANTES.DEGRADACAO_ANUAL, degradacaoAnos);
  return potenciaKwp * irradiacaoMedia * performanceRatio * CONSTANTES.DIAS_MES * fatorDegradacao;
}

/**
 * Calcula a área necessária para instalação
 * 
 * @param {number} quantidadePaineis - Número de painéis
 * @param {number} areaPorPainel - Área por painel em m² (default: 2.2)
 * @returns {number} Área total em m²
 */
export function calcularAreaNecessaria(quantidadePaineis, areaPorPainel = CONSTANTES.AREA_POR_PAINEL_M2) {
  return quantidadePaineis * areaPorPainel;
}

// ============================================================================
// FUNÇÕES DE CÁLCULO FINANCEIRO
// ============================================================================

/**
 * Calcula a economia mensal estimada
 * 
 * Considera: geração, consumo, tarifa e custo de disponibilidade
 * 
 * @param {number} geracaoMensal - Geração mensal em kWh
 * @param {number} consumoMensal - Consumo mensal em kWh
 * @param {number} tarifaKwh - Tarifa em R$/kWh
 * @param {number} custoDisponibilidade - Custo mínimo mensal em R$
 * @returns {number} Economia mensal em R$
 */
export function calcularEconomiaMensal(geracaoMensal, consumoMensal, tarifaKwh, custoDisponibilidade = 0) {
  if (tarifaKwh <= 0) return 0;
  
  // A economia é limitada ao menor valor entre geração e consumo
  const energiaCompensada = Math.min(geracaoMensal, consumoMensal);
  
  // Valor economizado (energia que deixa de ser comprada)
  const economiaEnergia = energiaCompensada * tarifaKwh;
  
  // Desconta o custo de disponibilidade que sempre será pago
  return Math.max(0, economiaEnergia - custoDisponibilidade);
}

/**
 * Calcula o custo de disponibilidade baseado no tipo de ligação
 * 
 * @param {string} tipoLigacao - 'monofasica', 'bifasica' ou 'trifasica'
 * @param {number} tarifaKwh - Tarifa em R$/kWh
 * @returns {number} Custo de disponibilidade mensal em R$
 */
export function calcularCustoDisponibilidade(tipoLigacao, tarifaKwh) {
  let kwhMinimo;
  
  switch (tipoLigacao?.toLowerCase()) {
    case 'bifasica':
      kwhMinimo = CONSTANTES.DISPONIBILIDADE_BIFASICA;
      break;
    case 'trifasica':
      kwhMinimo = CONSTANTES.DISPONIBILIDADE_TRIFASICA;
      break;
    default:
      kwhMinimo = CONSTANTES.DISPONIBILIDADE_MONOFASICA;
  }
  
  return kwhMinimo * tarifaKwh;
}

/**
 * Calcula o payback simples do investimento
 * 
 * Fórmula: Payback = Investimento / Economia Mensal
 * 
 * @param {number} investimentoTotal - Valor total do investimento em R$
 * @param {number} economiaMensal - Economia mensal em R$
 * @returns {number} Payback em meses
 */
export function calcularPaybackSimples(investimentoTotal, economiaMensal) {
  if (economiaMensal <= 0 || investimentoTotal <= 0) return 0;
  
  return Math.ceil(investimentoTotal / economiaMensal);
}

/**
 * Calcula o payback considerando aumento anual da tarifa
 * 
 * @param {number} investimentoTotal - Valor total do investimento em R$
 * @param {number} economiaMensalInicial - Economia mensal inicial em R$
 * @param {number} aumentoAnual - Aumento anual da tarifa (default: 4.1%)
 * @returns {number} Payback em meses
 */
export function calcularPaybackComReajuste(investimentoTotal, economiaMensalInicial, aumentoAnual = CONSTANTES.AUMENTO_TARIFA_ANUAL) {
  if (economiaMensalInicial <= 0 || investimentoTotal <= 0) return 0;
  
  let acumulado = 0;
  let meses = 0;
  const maxMeses = CONSTANTES.VIDA_UTIL_ANOS * 12;
  
  while (acumulado < investimentoTotal && meses < maxMeses) {
    const ano = Math.floor(meses / 12);
    const fatorReajuste = Math.pow(1 + aumentoAnual, ano);
    const economiaMes = economiaMensalInicial * fatorReajuste;
    acumulado += economiaMes;
    meses++;
  }
  
  return meses;
}

/**
 * Calcula projeção financeira completa para 25 anos
 * 
 * @param {Object} params - Parâmetros do cálculo
 * @returns {Object} Projeções detalhadas
 */
export function calcularProjecaoFinanceira({
  potenciaKwp,
  irradiacaoMedia,
  consumoMensalKwh,
  tarifaKwh,
  investimentoTotal,
  tipoLigacao = 'monofasica',
  aumentoTarifaAnual = CONSTANTES.AUMENTO_TARIFA_ANUAL,
  degradacaoAnual = CONSTANTES.DEGRADACAO_ANUAL
}) {
  const anos = CONSTANTES.VIDA_UTIL_ANOS;
  const custoDisp = calcularCustoDisponibilidade(tipoLigacao, tarifaKwh);
  
  const projecao = {
    anos: [],
    economiaTotal25Anos: 0,
    paybackMeses: 0,
    paybackAnos: 0,
    economiaMensalAno1: 0,
    geracaoMensalAno1: 0,
    roi25Anos: 0,
    tir: 0
  };
  
  let economiaAcumulada = 0;
  let paybackEncontrado = false;
  
  for (let ano = 1; ano <= anos; ano++) {
    // Degradação do sistema
    const fatorDegradacao = Math.pow(1 - degradacaoAnual, ano - 1);
    
    // Reajuste da tarifa
    const fatorReajuste = Math.pow(1 + aumentoTarifaAnual, ano - 1);
    const tarifaAno = tarifaKwh * fatorReajuste;
    const custoDispAno = custoDisp * fatorReajuste;
    
    // Geração do ano
    const geracaoMensal = calcularGeracaoMensal(potenciaKwp, irradiacaoMedia, CONSTANTES.PR_SISTEMA, ano - 1);
    const geracaoAnual = geracaoMensal * 12;
    
    // Consumo do ano (assumindo crescimento vegetativo mínimo)
    const consumoMensal = consumoMensalKwh;
    const consumoAnual = consumoMensal * 12;
    
    // Economia do ano
    const economiaMensal = calcularEconomiaMensal(geracaoMensal, consumoMensal, tarifaAno, custoDispAno);
    const economiaAnual = economiaMensal * 12;
    
    economiaAcumulada += economiaAnual;
    
    // Verificar payback
    if (!paybackEncontrado && economiaAcumulada >= investimentoTotal) {
      // Calcular mês exato do payback
      const economiaAnoAnterior = economiaAcumulada - economiaAnual;
      const faltaParaPayback = investimentoTotal - economiaAnoAnterior;
      const mesesNoAno = Math.ceil(faltaParaPayback / economiaMensal);
      projecao.paybackMeses = (ano - 1) * 12 + mesesNoAno;
      projecao.paybackAnos = projecao.paybackMeses / 12;
      paybackEncontrado = true;
    }
    
    // Guardar dados do ano 1
    if (ano === 1) {
      projecao.economiaMensalAno1 = economiaMensal;
      projecao.geracaoMensalAno1 = geracaoMensal;
    }
    
    projecao.anos.push({
      ano,
      geracaoMensal: Math.round(geracaoMensal),
      geracaoAnual: Math.round(geracaoAnual),
      tarifaKwh: tarifaAno,
      economiaMensal: Math.round(economiaMensal * 100) / 100,
      economiaAnual: Math.round(economiaAnual * 100) / 100,
      economiaAcumulada: Math.round(economiaAcumulada * 100) / 100
    });
  }
  
  projecao.economiaTotal25Anos = Math.round(economiaAcumulada * 100) / 100;
  projecao.roi25Anos = investimentoTotal > 0 
    ? Math.round((economiaAcumulada / investimentoTotal - 1) * 100 * 100) / 100 
    : 0;
  
  // Se não encontrou payback em 25 anos
  if (!paybackEncontrado) {
    projecao.paybackMeses = CONSTANTES.VIDA_UTIL_ANOS * 12;
    projecao.paybackAnos = CONSTANTES.VIDA_UTIL_ANOS;
  }
  
  return projecao;
}

// ============================================================================
// FUNÇÕES DE CUSTO DO PROJETO
// ============================================================================

/**
 * Calcula custo de homologação baseado na potência
 * 
 * @param {number} potenciaKwp - Potência do sistema em kWp
 * @param {Object} faixas - Faixas de preço por potência
 * @returns {number} Custo de homologação em R$
 */
export function calcularCustoHomologacao(potenciaKwp, faixas = {}) {
  const defaultFaixas = {
    // Padrão (Fohat) — conforme tabela:
    // Até 10 kWp: R$ 500
    // 10,1 a 25 kWp: R$ 1.000
    // 25,1 a 50 kWp: R$ 1.500
    // 50,1 a 75 kWp: R$ 2.000
    ate10: 500,
    ate25: 1000,
    ate50: 1500,
    ate75: 2000,
    // Não informado na tabela; manter monotônico (>= ate75)
    acima75: 2000
  };
  
  // Aceitar tanto o schema novo do app (homologacao_ate_XX_kwp) quanto o antigo (ateXX)
  const mapped = { ...faixas };
  if (mapped && typeof mapped === "object") {
    if (mapped.homologacao_ate_10_kwp != null && mapped.ate10 == null) mapped.ate10 = mapped.homologacao_ate_10_kwp;
    if (mapped.homologacao_ate_25_kwp != null && mapped.ate25 == null) mapped.ate25 = mapped.homologacao_ate_25_kwp;
    if (mapped.homologacao_ate_20_kwp != null && mapped.ate20 == null) mapped.ate20 = mapped.homologacao_ate_20_kwp;
    if (mapped.homologacao_ate_50_kwp != null && mapped.ate50 == null) mapped.ate50 = mapped.homologacao_ate_50_kwp;
    if (mapped.homologacao_ate_75_kwp != null && mapped.ate75 == null) mapped.ate75 = mapped.homologacao_ate_75_kwp;
  }

  const f = { ...defaultFaixas, ...mapped };
  // Compatibilidade com configs antigas (ate20)
  if ((f.ate25 === undefined || f.ate25 === null) && (f.ate20 !== undefined && f.ate20 !== null)) {
    f.ate25 = f.ate20;
  }
  
  if (potenciaKwp <= 10) return f.ate10;
  if (potenciaKwp <= 25) return f.ate25;
  if (potenciaKwp <= 50) return f.ate50;
  if (potenciaKwp <= 75) return f.ate75;
  return f.acima75;
}

/**
 * Calcula o custo de instalação por placa usando faixas + percentual de segurança.
 *
 * Padrão (conforme tabela enviada):
 * - 1–5:   base 400,00  (+10%) => 440,00
 * - 6–10:  base 199,31  (+10%) => 219,24
 * - 11–20: base 150,00  (+10%) => 165,00
 * - 21–40: base 140,00  (+10%) => 154,00
 * - 41–80: base 125,00  (+10%) => 137,50
 *
 * Campos suportados em configs:
 * - instalacao_percentual_seguranca
 * - instalacao_faixa_1_5_base
 * - instalacao_faixa_6_10_base
 * - instalacao_faixa_11_20_base
 * - instalacao_faixa_21_40_base
 * - instalacao_faixa_41_80_base
 * - instalacao_faixa_acima_80_base (opcional)
 * - custo_instalacao_por_placa (fallback legado)
 */
export function calcularInstalacaoPorPlaca(quantidadePaineis, configs = {}) {
  const q = Math.max(0, Number(quantidadePaineis || 0) || 0);
  const pct = Number(configs?.instalacao_percentual_seguranca ?? 10);
  const safePct = Number.isFinite(pct) ? pct : 10;

  const legacy = Number(configs?.custo_instalacao_por_placa ?? 200);

  const bases = {
    f1_5: Number(configs?.instalacao_faixa_1_5_base ?? 400),
    f6_10: Number(configs?.instalacao_faixa_6_10_base ?? 199.31),
    f11_20: Number(configs?.instalacao_faixa_11_20_base ?? 150),
    f21_40: Number(configs?.instalacao_faixa_21_40_base ?? 140),
    f41_80: Number(configs?.instalacao_faixa_41_80_base ?? 125),
    facima80: Number(configs?.instalacao_faixa_acima_80_base ?? (configs?.instalacao_faixa_41_80_base ?? 125)),
  };

  const pickBase = () => {
    if (!q) return 0;
    // Se o projeto estiver usando só a config antiga, respeitar
    const hasNew =
      configs?.instalacao_faixa_1_5_base != null ||
      configs?.instalacao_faixa_6_10_base != null ||
      configs?.instalacao_faixa_11_20_base != null ||
      configs?.instalacao_faixa_21_40_base != null ||
      configs?.instalacao_faixa_41_80_base != null ||
      configs?.instalacao_faixa_acima_80_base != null;
    if (!hasNew && Number.isFinite(legacy)) return legacy;

    if (q <= 5) return Number.isFinite(bases.f1_5) ? bases.f1_5 : legacy;
    if (q <= 10) return Number.isFinite(bases.f6_10) ? bases.f6_10 : legacy;
    if (q <= 20) return Number.isFinite(bases.f11_20) ? bases.f11_20 : legacy;
    if (q <= 40) return Number.isFinite(bases.f21_40) ? bases.f21_40 : legacy;
    if (q <= 80) return Number.isFinite(bases.f41_80) ? bases.f41_80 : legacy;
    return Number.isFinite(bases.facima80) ? bases.facima80 : legacy;
  };

  const base = pickBase();
  const adicional = base * (safePct / 100);
  const valorFinal = base + adicional;
  // arredondar para 2 casas como moeda
  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  return {
    quantidade: q,
    percentual_seguranca: safePct,
    base_por_placa: round2(base),
    adicional_seguranca_por_placa: round2(adicional),
    final_por_placa: round2(valorFinal),
  };
}

/**
 * Calcula custo de instalação
 * 
 * @param {number} quantidadePaineis - Número de painéis
 * @param {number|Object} custoPorPainel - Custo (legado) por painel OU objeto configs (novo)
 * @returns {number} Custo total de instalação
 */
export function calcularCustoInstalacao(quantidadePaineis, custoPorPainel = 200) {
  const q = Math.max(0, Number(quantidadePaineis || 0) || 0);
  if (custoPorPainel && typeof custoPorPainel === 'object') {
    const info = calcularInstalacaoPorPlaca(q, custoPorPainel);
    return q * (info.final_por_placa || 0);
  }
  const v = Number(custoPorPainel || 0) || 0;
  return q * v;
}

/**
 * Calcula custo de CA e aterramento
 * 
 * @param {number} quantidadePaineis - Número de painéis
 * @param {number} custoPorPainel - Custo por painel
 * @returns {number} Custo total
 */
export function calcularCustoCA(quantidadePaineis, custoPorPainel = 100) {
  return quantidadePaineis * custoPorPainel;
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE DIMENSIONAMENTO COMPLETO
// ============================================================================

/**
 * Realiza o dimensionamento completo do sistema fotovoltaico
 * 
 * @param {Object} params - Parâmetros de entrada
 * @returns {Object} Resultado completo do dimensionamento
 */
export function dimensionarSistema({
  consumoMensalKwh,
  consumoMensalReais = 0,
  tarifaKwh,
  irradiacaoMedia,
  potenciaPainelW = 550,
  tipoLigacao = 'monofasica',
  custoKitPorKwp = 3500, // Custo médio do kit por kWp instalado
  margemLucro = 0.25, // 25% de margem
  comissaoVendedor = 0.05, // 5% de comissão
  configs = {}
}) {
  // Validações
  if (!tarifaKwh || tarifaKwh <= 0) {
    throw new Error('Tarifa de energia é obrigatória');
  }
  
  // Se consumo em kWh não foi informado, calcular a partir de R$
  if ((!consumoMensalKwh || consumoMensalKwh <= 0) && consumoMensalReais > 0) {
    consumoMensalKwh = consumoMensalReais / tarifaKwh;
  }
  
  if (!consumoMensalKwh || consumoMensalKwh <= 0) {
    throw new Error('Consumo mensal é obrigatório');
  }
  
  if (!irradiacaoMedia || irradiacaoMedia <= 0) {
    irradiacaoMedia = 4.5; // Fallback conservador para SP
  }
  
  // Cálculos de dimensionamento
  const potenciaKwp = calcularPotenciaNecessaria(consumoMensalKwh, irradiacaoMedia);
  const quantidadePaineis = calcularQuantidadePaineis(potenciaKwp, potenciaPainelW);
  const potenciaReal = (quantidadePaineis * potenciaPainelW) / 1000; // kWp real
  const geracaoMensal = calcularGeracaoMensal(potenciaReal, irradiacaoMedia);
  const areaNecessaria = calcularAreaNecessaria(quantidadePaineis);
  
  // Cálculos de custo
  const custoEquipamentos = potenciaReal * custoKitPorKwp;
  const custoInstalacao = calcularCustoInstalacao(quantidadePaineis, configs);
  const custoHomologacao = calcularCustoHomologacao(potenciaReal, configs);
  const custoCA = calcularCustoCA(quantidadePaineis, configs.custo_ca_aterramento_por_placa || 100);
  const custoPlaquinhas = configs.custo_placas_sinalizacao || 60;
  const custoObra = custoInstalacao * ((configs.percentual_obra_instalacao || 10) / 100);
  
  const custoTotal = custoEquipamentos + custoInstalacao + custoHomologacao + custoCA + custoPlaquinhas + custoObra;
  
  // Margem e preço final
  const valorMargem = custoTotal * margemLucro;
  const valorComissao = custoTotal * comissaoVendedor;
  const precoVenda = custoTotal + valorMargem + valorComissao;
  
  // Cálculos financeiros
  const custoDisponibilidade = calcularCustoDisponibilidade(tipoLigacao, tarifaKwh);
  const economiaMensal = calcularEconomiaMensal(geracaoMensal, consumoMensalKwh, tarifaKwh, custoDisponibilidade);
  const paybackMeses = calcularPaybackComReajuste(precoVenda, economiaMensal);
  
  // Projeção financeira completa
  const projecao = calcularProjecaoFinanceira({
    potenciaKwp: potenciaReal,
    irradiacaoMedia,
    consumoMensalKwh,
    tarifaKwh,
    investimentoTotal: precoVenda,
    tipoLigacao
  });
  
  return {
    // Dados técnicos
    potencia_sistema_kwp: Math.round(potenciaReal * 100) / 100,
    quantidade_placas: quantidadePaineis,
    potencia_placa_w: potenciaPainelW,
    geracao_media_mensal: Math.round(geracaoMensal * 100) / 100,
    area_necessaria: Math.round(areaNecessaria * 100) / 100,
    irradiacao_media: irradiacaoMedia,
    
    // Dados de consumo
    consumo_mensal_kwh: Math.round(consumoMensalKwh * 100) / 100,
    tarifa_energia: tarifaKwh,
    
    // Custos detalhados
    custo_equipamentos: Math.round(custoEquipamentos * 100) / 100,
    custo_instalacao: Math.round(custoInstalacao * 100) / 100,
    custo_homologacao: Math.round(custoHomologacao * 100) / 100,
    custo_ca: Math.round(custoCA * 100) / 100,
    custo_plaquinhas: custoPlaquinhas,
    custo_obra: Math.round(custoObra * 100) / 100,
    custo_total: Math.round(custoTotal * 100) / 100,
    
    // Preço de venda
    margem_lucro: Math.round(valorMargem * 100) / 100,
    comissao_vendedor: Math.round(valorComissao * 100) / 100,
    preco_venda: Math.round(precoVenda * 100) / 100,
    preco_final: Math.round(precoVenda * 100) / 100,
    
    // Dados financeiros
    economia_mensal_estimada: Math.round(economiaMensal * 100) / 100,
    payback_meses: paybackMeses,
    anos_payback: Math.round((paybackMeses / 12) * 10) / 10,
    economia_total_25_anos: projecao.economiaTotal25Anos,
    roi_25_anos: projecao.roi25Anos,
    custo_disponibilidade: Math.round(custoDisponibilidade * 100) / 100,
    
    // Projeção completa
    projecao_anual: projecao.anos
  };
}



