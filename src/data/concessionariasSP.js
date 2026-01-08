/**
 * Dados das concessionárias de energia elétrica do estado de São Paulo
 * Baseado em informações atualizadas de 2024/2025
 */

export const concessionariasSP = [
  {
    id: 'enel-sp',
    nome: 'Enel Distribuição São Paulo',
    sigla: 'Enel SP',
    website: 'https://www.enel.com.br/sp',
    telefone: '0800 727 2016',
    areasAtendimento: [
      'São Paulo (Capital)',
      'Região Metropolitana de São Paulo',
      'Grande São Paulo',
      'Zona Sul de São Paulo',
      'Zona Norte de São Paulo',
      'Zona Leste de São Paulo',
      'Zona Oeste de São Paulo'
    ],
    tarifas: {
      residencial: {
        te: 0.358, // Tarifa de Energia (TE) R$/kWh
        tusd: 0.298, // TUSD - Tarifa de Uso do Sistema de Distribuição R$/kWh
        tarifaBasica: 0.656, // TE + TUSD (sem impostos)
        pis: 0.0165, // PIS 1.65%
        cofins: 0.076, // COFINS 7.6%
        icms: 0.18, // ICMS 18%
        pisCofins: 0.0925, // PIS + COFINS combinado
        totalComImpostos: 0.83 // R$/kWh final
      },
      comercial: {
        te: 0.334,
        tusd: 0.278,
        tarifaBasica: 0.612,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.78
      },
      industrial: {
        te: 0.321,
        tusd: 0.268,
        tarifaBasica: 0.589,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.75
      }
    },
    bandeirasTarifarias: {
      verde: 0.000, // Sem acréscimo
      amarela: 0.010, // R$/kWh
      vermelha1: 0.030, // R$/kWh
      vermelha2: 0.030 // R$/kWh
    },
    observacoes: 'Maior distribuidora do estado, atende principalmente a capital e região metropolitana'
  },
  {
    id: 'cpfl-piratininga',
    nome: 'CPFL Piratininga',
    sigla: 'CPFL Piratininga',
    website: 'https://www.cpfl.com.br',
    telefone: '0800 010 2570',
    areasAtendimento: [
      'Campinas',
      'Sorocaba',
      'Santos',
      'São José dos Campos',
      'Ribeirão Preto',
      'Piracicaba',
      'Jundiaí',
      'Americana',
      'Araraquara',
      'São Carlos',
      'Limeira',
      'Sumaré',
      'Hortolândia',
      'Indaiatuba',
      'Valinhos'
    ],
    tarifas: {
      residencial: {
        te: 0.350,
        tusd: 0.292,
        tarifaBasica: 0.642,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.81
      },
      comercial: {
        te: 0.326,
        tusd: 0.272,
        tarifaBasica: 0.598,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.76
      },
      industrial: {
        te: 0.313,
        tusd: 0.262,
        tarifaBasica: 0.575,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.73
      }
    },
    bandeirasTarifarias: {
      verde: 0.000,
      amarela: 0.010,
      vermelha1: 0.030,
      vermelha2: 0.030
    },
    observacoes: 'Atende região de Campinas e interior central de SP'
  },
  {
    id: 'cpfl-paulista',
    nome: 'CPFL Paulista',
    sigla: 'CPFL Paulista',
    website: 'https://www.cpfl.com.br',
    telefone: '0800 010 2570',
    areasAtendimento: [
      'Região de Campinas',
      'Região de Sorocaba',
      'Região de Santos',
      'Região de São José dos Campos',
      'Região de Ribeirão Preto',
      'Região de Piracicaba',
      'Região de Jundiaí'
    ],
    tarifas: {
      residencial: {
        te: 0.346,
        tusd: 0.289,
        tarifaBasica: 0.635,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.80
      },
      comercial: {
        te: 0.322,
        tusd: 0.269,
        tarifaBasica: 0.591,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.75
      },
      industrial: {
        te: 0.309,
        tusd: 0.259,
        tarifaBasica: 0.568,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.72
      }
    },
    bandeirasTarifarias: {
      verde: 0.000,
      amarela: 0.010,
      vermelha1: 0.030,
      vermelha2: 0.030
    },
    observacoes: 'Subsidiária da CPFL Energia - tarifas específicas'
  },
  {
    id: 'cpfl-santa-cruz',
    nome: 'CPFL Santa Cruz',
    sigla: 'CPFL Santa Cruz',
    website: 'https://www.cpfl.com.br',
    telefone: '0800 010 2570',
    areasAtendimento: [
      'Região de Sorocaba',
      'Região de Itu',
      'Região de Salto',
      'Região de Porto Feliz',
      'Região de Tietê',
      'Região de Cerquilho',
      'Região de Boituva',
      'Região de Piedade',
      'Região de Votorantim'
    ],
    tarifas: {
      residencial: {
        te: 0.343,
        tusd: 0.287,
        tarifaBasica: 0.630,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.79
      },
      comercial: {
        te: 0.319,
        tusd: 0.267,
        tarifaBasica: 0.586,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.74
      },
      industrial: {
        te: 0.307,
        tusd: 0.256,
        tarifaBasica: 0.563,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.71
      }
    },
    bandeirasTarifarias: {
      verde: 0.000,
      amarela: 0.010,
      vermelha1: 0.030,
      vermelha2: 0.030
    },
    observacoes: 'Subsidiária da CPFL Energia - região de Sorocaba'
  },
  {
    id: 'edp-sao-paulo',
    nome: 'EDP São Paulo',
    sigla: 'EDP SP',
    website: 'https://www.edp.com.br',
    telefone: '0800 721 0110',
    areasAtendimento: [
      'Região de Guarulhos',
      'Região de Osasco',
      'Região de Santo André',
      'Região de São Bernardo do Campo',
      'Região de São Caetano do Sul',
      'Região de Diadema',
      'Região de Mauá',
      'Região de Ribeirão Pires',
      'Região de Rio Grande da Serra'
    ],
    tarifas: {
      residencial: {
        te: 0.355,
        tusd: 0.296,
        tarifaBasica: 0.651,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.82
      },
      comercial: {
        te: 0.331,
        tusd: 0.276,
        tarifaBasica: 0.607,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.77
      },
      industrial: {
        te: 0.318,
        tusd: 0.266,
        tarifaBasica: 0.584,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.74
      }
    },
    bandeirasTarifarias: {
      verde: 0.000,
      amarela: 0.010,
      vermelha1: 0.030,
      vermelha2: 0.030
    },
    observacoes: 'Atende principalmente o ABC Paulista e região metropolitana'
  },
  {
    id: 'neoenergia-elektro',
    nome: 'Neoenergia Elektro',
    sigla: 'Neoenergia Elektro',
    website: 'https://www.neoenergia.com',
    telefone: '0800 701 0102',
    areasAtendimento: [
      'Região de Santos',
      'Região de São Vicente',
      'Região de Guarujá',
      'Região de Cubatão',
      'Região de Praia Grande',
      'Região de Mongaguá',
      'Região de Itanhaém',
      'Região de Peruíbe',
      'Região de Bertioga',
      'Região de São Sebastião',
      'Região de Caraguatatuba',
      'Região de Ubatuba',
      'Região de Ilhabela'
    ],
    tarifas: {
      residencial: {
        te: 0.341,
        tusd: 0.284,
        tarifaBasica: 0.625,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.79
      },
      comercial: {
        te: 0.317,
        tusd: 0.264,
        tarifaBasica: 0.581,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.74
      },
      industrial: {
        te: 0.304,
        tusd: 0.254,
        tarifaBasica: 0.558,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.71
      }
    },
    bandeirasTarifarias: {
      verde: 0.000,
      amarela: 0.010,
      vermelha1: 0.030,
      vermelha2: 0.030
    },
    observacoes: 'Atende Baixada Santista e Litoral Norte - redução tarifária em agosto/2024'
  },
  {
    id: 'energia-sul',
    nome: 'Energia Sul',
    sigla: 'Energia Sul',
    website: 'https://www.energiasul.com.br',
    telefone: '0800 010 2570',
    areasAtendimento: [
      'Região de Sorocaba',
      'Região de Itu',
      'Região de Salto',
      'Região de Porto Feliz',
      'Região de Tietê',
      'Região de Cerquilho',
      'Região de Boituva',
      'Região de Piedade',
      'Região de Votorantim',
      'Região de Araçoiaba da Serra'
    ],
    tarifas: {
      residencial: {
        te: 0.349,
        tusd: 0.291,
        tarifaBasica: 0.640,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.80
      },
      comercial: {
        te: 0.325,
        tusd: 0.271,
        tarifaBasica: 0.596,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.75
      },
      industrial: {
        te: 0.312,
        tusd: 0.261,
        tarifaBasica: 0.573,
        pis: 0.0165,
        cofins: 0.076,
        icms: 0.18,
        pisCofins: 0.0925,
        totalComImpostos: 0.72
      }
    },
    bandeirasTarifarias: {
      verde: 0.000,
      amarela: 0.010,
      vermelha1: 0.030,
      vermelha2: 0.030
    },
    observacoes: 'Atende região de Sorocaba e cidades vizinhas'
  }
];

/**
 * Busca concessionária por nome ou sigla
 * @param {string} nome - Nome ou sigla da concessionária
 * @returns {Object|null} Dados da concessionária ou null se não encontrada
 */
export function buscarConcessionaria(nome) {
  const nomeLower = nome.toLowerCase();
  
  return concessionariasSP.find(concessionaria => 
    concessionaria.nome.toLowerCase().includes(nomeLower) ||
    concessionaria.sigla.toLowerCase().includes(nomeLower) ||
    concessionaria.id.toLowerCase().includes(nomeLower)
  ) || null;
}

/**
 * Busca concessionárias por cidade
 * @param {string} cidade - Nome da cidade
 * @returns {Array} Array de concessionárias que atendem a cidade
 */
export function buscarConcessionariasPorCidade(cidade) {
  const cidadeLower = cidade.toLowerCase();
  
  return concessionariasSP.filter(concessionaria =>
    concessionaria.areasAtendimento.some(area =>
      area.toLowerCase().includes(cidadeLower) ||
      cidadeLower.includes(area.toLowerCase())
    )
  );
}

/**
 * Calcula tarifa total com impostos
 * @param {Object} concessionaria - Dados da concessionária
 * @param {string} tipoConsumo - 'residencial', 'comercial' ou 'industrial'
 * @param {string} bandeira - 'verde', 'amarela', 'vermelha1' ou 'vermelha2'
 * @returns {number} Tarifa total em R$/kWh
 */
export function calcularTarifaTotal(concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
  if (!concessionaria || !concessionaria.tarifas[tipoConsumo]) {
    return 0;
  }

  const tarifaBasica = concessionaria.tarifas[tipoConsumo].totalComImpostos;
  const bandeiraTarifaria = concessionaria.bandeirasTarifarias[bandeira] || 0;
  
  return tarifaBasica + bandeiraTarifaria;
}

/**
 * Converte consumo em R$ para kWh
 * @param {number} valorReais - Valor em reais
 * @param {Object} concessionaria - Dados da concessionária
 * @param {string} tipoConsumo - Tipo de consumo
 * @param {string} bandeira - Bandeira tarifária
 * @returns {number} Consumo em kWh
 */
export function converterReaisParaKwh(valorReais, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
  const tarifaTotal = calcularTarifaTotal(concessionaria, tipoConsumo, bandeira);
  
  if (tarifaTotal === 0) {
    return 0;
  }
  
  return valorReais / tarifaTotal;
}

/**
 * Converte consumo em kWh para R$
 * @param {number} consumoKwh - Consumo em kWh
 * @param {Object} concessionaria - Dados da concessionária
 * @param {string} tipoConsumo - Tipo de consumo
 * @param {string} bandeira - Bandeira tarifária
 * @returns {number} Valor em reais
 */
export function converterKwhParaReais(consumoKwh, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
  const tarifaTotal = calcularTarifaTotal(concessionaria, tipoConsumo, bandeira);
  
  return consumoKwh * tarifaTotal;
}

/**
 * Obtém todas as concessionárias de SP
 * @returns {Array} Array com todas as concessionárias
 */
export function obterTodasConcessionarias() {
  return concessionariasSP;
}

/**
 * Obtém estatísticas das tarifas de SP
 * @returns {Object} Estatísticas das tarifas
 */
export function obterEstatisticasTarifas() {
  const tarifasResidenciais = concessionariasSP.map(c => c.tarifas.residencial.totalComImpostos);
  
  return {
    totalConcessionarias: concessionariasSP.length,
    tarifaMediaResidencial: tarifasResidenciais.reduce((a, b) => a + b, 0) / tarifasResidenciais.length,
    tarifaMinimaResidencial: Math.min(...tarifasResidenciais),
    tarifaMaximaResidencial: Math.max(...tarifasResidenciais),
    concessionarias: concessionariasSP.map(c => ({
      nome: c.nome,
      sigla: c.sigla,
      tarifaResidencial: c.tarifas.residencial.totalComImpostos
    }))
  };
}

/**
 * Calcula a decomposição detalhada da tarifa
 * @param {number} consumoKwh - Consumo em kWh
 * @param {Object|string} concessionaria - Dados da concessionária ou nome
 * @param {string} tipoConsumo - 'residencial', 'comercial' ou 'industrial'
 * @param {string} bandeira - Bandeira tarifária
 * @returns {Object} Decomposição detalhada da tarifa
 */
export function calcularDecomposicaoTarifa(consumoKwh, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
  // Se for string, buscar a concessionária
  const concData = typeof concessionaria === 'string' 
    ? buscarConcessionaria(concessionaria) 
    : concessionaria;
  
  if (!concData || !concData.tarifas || !concData.tarifas[tipoConsumo]) {
    // Retornar valores estimados padrão se concessionária não encontrada
    const tarifaPadrao = 0.676; // Tarifa média SP
    return {
      consumoKwh,
      tipoConsumo,
      bandeira,
      concessionaria: concessionaria || 'Não especificada',
      // Componentes da tarifa (valores estimados)
      te: { valor: 0.368, percentual: 0.545, total: 0.368 * consumoKwh },
      tusd: { valor: 0.308, percentual: 0.455, total: 0.308 * consumoKwh },
      tarifaBase: { valor: 0.676, total: 0.676 * consumoKwh },
      // Impostos
      pis: { aliquota: 0.0165, valor: 0.676 * 0.0165, total: consumoKwh * 0.676 * 0.0165 },
      cofins: { aliquota: 0.076, valor: 0.676 * 0.076, total: consumoKwh * 0.676 * 0.076 },
      icms: { aliquota: 0.18, valor: 0.676 * 0.18, total: consumoKwh * 0.676 * 0.18 },
      bandeiraTarifaria: { valor: 0, total: 0 },
      // Totais
      totalSemImpostos: 0.676 * consumoKwh,
      totalImpostos: consumoKwh * 0.676 * (0.0165 + 0.076 + 0.18),
      totalFinal: tarifaPadrao * consumoKwh * 1.27, // Aproximação com impostos
      tarifaFinalKwh: tarifaPadrao
    };
  }
  
  const tarifas = concData.tarifas[tipoConsumo];
  const bandeiraTarifaria = concData.bandeirasTarifarias?.[bandeira] || 0;
  
  // Valores por kWh
  const te = tarifas.te || tarifas.tarifaBasica * 0.545; // TE ~54.5% da tarifa base
  const tusd = tarifas.tusd || tarifas.tarifaBasica * 0.455; // TUSD ~45.5% da tarifa base
  const tarifaBase = tarifas.tarifaBasica;
  
  // Impostos (alíquotas)
  const pisAliquota = tarifas.pis || 0.0165;
  const cofinsAliquota = tarifas.cofins || 0.076;
  const icmsAliquota = tarifas.icms || 0.18;
  
  // Calcular valores em R$ por kWh dos impostos
  const pisValorKwh = tarifaBase * pisAliquota;
  const cofinsValorKwh = tarifaBase * cofinsAliquota;
  const icmsValorKwh = tarifaBase * icmsAliquota;
  
  // Totais
  const totalSemImpostos = tarifaBase * consumoKwh;
  const totalPis = pisValorKwh * consumoKwh;
  const totalCofins = cofinsValorKwh * consumoKwh;
  const totalIcms = icmsValorKwh * consumoKwh;
  const totalBandeira = bandeiraTarifaria * consumoKwh;
  const totalImpostos = totalPis + totalCofins + totalIcms;
  const totalFinal = (tarifas.totalComImpostos + bandeiraTarifaria) * consumoKwh;
  
  return {
    consumoKwh,
    tipoConsumo,
    bandeira,
    concessionaria: concData.nome || concData.sigla || 'Não especificada',
    // Componentes da tarifa
    te: { 
      valor: te, 
      percentual: te / tarifaBase, 
      total: te * consumoKwh,
      descricao: 'Tarifa de Energia (TE) - Custo da geração de energia'
    },
    tusd: { 
      valor: tusd, 
      percentual: tusd / tarifaBase, 
      total: tusd * consumoKwh,
      descricao: 'TUSD - Tarifa de Uso do Sistema de Distribuição'
    },
    tarifaBase: { valor: tarifaBase, total: totalSemImpostos },
    // Impostos
    pis: { 
      aliquota: pisAliquota, 
      valor: pisValorKwh, 
      total: totalPis,
      descricao: 'PIS - Programa de Integração Social'
    },
    cofins: { 
      aliquota: cofinsAliquota, 
      valor: cofinsValorKwh, 
      total: totalCofins,
      descricao: 'COFINS - Contribuição para Financiamento da Seguridade Social'
    },
    icms: { 
      aliquota: icmsAliquota, 
      valor: icmsValorKwh, 
      total: totalIcms,
      descricao: 'ICMS - Imposto sobre Circulação de Mercadorias e Serviços'
    },
    bandeiraTarifaria: { 
      valor: bandeiraTarifaria, 
      total: totalBandeira,
      descricao: `Bandeira Tarifária ${bandeira.charAt(0).toUpperCase() + bandeira.slice(1)}`
    },
    // Totais
    totalSemImpostos,
    totalImpostos,
    totalFinal,
    tarifaFinalKwh: tarifas.totalComImpostos + bandeiraTarifaria
  };
}
