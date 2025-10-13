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
        tarifaBasica: 0.656, // R$/kWh
        icms: 0.18, // 18%
        pisCofins: 0.09, // 9%
        totalComImpostos: 0.83 // R$/kWh
      },
      comercial: {
        tarifaBasica: 0.612, // R$/kWh
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.78
      },
      industrial: {
        tarifaBasica: 0.589, // R$/kWh
        icms: 0.18,
        pisCofins: 0.09,
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
        tarifaBasica: 0.642, // R$/kWh
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.81
      },
      comercial: {
        tarifaBasica: 0.598,
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.76
      },
      industrial: {
        tarifaBasica: 0.575,
        icms: 0.18,
        pisCofins: 0.09,
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
        tarifaBasica: 0.635, // R$/kWh
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.80
      },
      comercial: {
        tarifaBasica: 0.591,
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.75
      },
      industrial: {
        tarifaBasica: 0.568,
        icms: 0.18,
        pisCofins: 0.09,
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
        tarifaBasica: 0.630, // R$/kWh
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.79
      },
      comercial: {
        tarifaBasica: 0.586,
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.74
      },
      industrial: {
        tarifaBasica: 0.563,
        icms: 0.18,
        pisCofins: 0.09,
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
        tarifaBasica: 0.651, // R$/kWh
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.82
      },
      comercial: {
        tarifaBasica: 0.607,
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.77
      },
      industrial: {
        tarifaBasica: 0.584,
        icms: 0.18,
        pisCofins: 0.09,
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
        tarifaBasica: 0.625, // R$/kWh (após redução de 5,64% em agosto/2024)
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.79
      },
      comercial: {
        tarifaBasica: 0.581,
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.74
      },
      industrial: {
        tarifaBasica: 0.558,
        icms: 0.18,
        pisCofins: 0.09,
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
        tarifaBasica: 0.640, // R$/kWh
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.80
      },
      comercial: {
        tarifaBasica: 0.596,
        icms: 0.18,
        pisCofins: 0.09,
        totalComImpostos: 0.75
      },
      industrial: {
        tarifaBasica: 0.573,
        icms: 0.18,
        pisCofins: 0.09,
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
