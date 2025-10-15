/**
 * Serviço para integração com a API Solaryum
 * Documentação: https://api-d1297.cloud.solaryum.com.br/swagger/index.html?urls.primaryName=Plataforma-V1
 */

import { SOLARYUM_CONFIG } from '../config/solaryum';

class SolaryumApiService {
  constructor() {
    this.baseURL = SOLARYUM_CONFIG.BASE_URL;
    this.apiKey = SOLARYUM_CONFIG.API_KEY;
    this.timeout = SOLARYUM_CONFIG.TIMEOUT;
  }

  /**
   * Configura headers padrão para requisições
   */
  getHeaders() {
    const headers = {
      'Accept': 'text/plain', // API espera text/plain, não application/json
    };

    console.log('🔑 Headers configurados:', headers);
    return headers;
  }

  /**
   * Faz uma requisição HTTP genérica
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    console.log('🌐 Fazendo requisição para:', url);
    console.log('📋 Configuração:', config);

    try {
      const response = await fetch(url, config);
      
      console.log('📡 Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro HTTP:', errorText);
        
        // Retorna response completa para análise
        const fullResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText,
          url: url,
          config: config,
          errorType: 'HTTP_ERROR'
        };
        
        console.log('📋 Response completa do erro:', fullResponse);
        throw fullResponse;
      }

      const data = await response.json();
      console.log('✅ Dados recebidos:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro na requisição para Solaryum API:', error);
      
      // Se for um erro de rede (CORS, DNS, etc.)
      if (error.name === 'TypeError' || (error.message && error.message.includes('fetch'))) {
        const networkError = {
          errorType: 'NETWORK_ERROR',
          message: error.message,
          name: error.name,
          url: url,
          config: config,
          possibleCauses: [
            'CORS policy blocking the request',
            'API endpoint not accessible',
            'Network connectivity issues',
            'DNS resolution problems'
          ]
        };
        console.log('🌐 Erro de rede detectado:', networkError);
        throw networkError;
      }
      
      throw error;
    }
  }

  /**
   * Busca produtos disponíveis para dimensionamento
   */
  async getProdutos(filtros = {}) {
    try {
      const endpoint = SOLARYUM_CONFIG.ENDPOINTS.PRODUTOS;
      const queryParams = new URLSearchParams();
      
      // Adiciona filtros como query parameters
      if (filtros.potencia) queryParams.append('potencia', filtros.potencia);
      if (filtros.tipoTelhado) queryParams.append('tipoTelhado', filtros.tipoTelhado);
      if (filtros.marcaPainel) queryParams.append('marcaPainel', filtros.marcaPainel);
      if (filtros.marcaInversor) queryParams.append('marcaInversor', filtros.marcaInversor);
      if (filtros.tensao) queryParams.append('tensao', filtros.tensao);
      if (filtros.fase) queryParams.append('fase', filtros.fase);
      
      const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;
      
      return await this.makeRequest(url, {
        method: 'GET'
      });
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      return this.getMockProdutos(filtros);
    }
  }

  /**
   * Busca filtros disponíveis (marcas, tipos de telhado, etc.)
   */
  async getFiltros() {
    try {
      const endpoint = SOLARYUM_CONFIG.ENDPOINTS.FILTROS;
      
      return await this.makeRequest(endpoint, {
        method: 'GET'
      });
    } catch (error) {
      console.error('Erro ao buscar filtros:', error);
      return this.getMockFiltros();
    }
  }

  /**
   * Calcula custos do projeto usando o endpoint Montar_Kits
   */
  async calcularCustosProjeto(dimensionamentoData) {
    try {
      console.log('🔍 calcularCustosProjeto iniciado com:', dimensionamentoData);
      
      // Monta kit customizado usando o endpoint Montar_Kits
      console.log('🔍 Chamando montarKitCustomizado...');
      const kitCustomizado = await this.montarKitCustomizado(dimensionamentoData);
      console.log('🔍 Kit customizado retornado:', kitCustomizado);
      
      // Calcula custos baseado no kit montado
      console.log('🔍 Chamando calcularCustosComKit...');
      const custos = this.calcularCustosComKit(kitCustomizado, dimensionamentoData);
      console.log('🔍 Custos calculados:', custos);
      
      return custos;
    } catch (error) {
      console.error('❌ Erro ao calcular custos do projeto:', error);
      console.log('📋 Response completa do erro:', error);
      
      // Retorna erro completo em vez de dados mock
      throw {
        error: error,
        dimensionamentoData: dimensionamentoData,
        message: 'Erro ao calcular custos do projeto - verifique os logs para detalhes'
      };
    }
  }

  /**
   * Busca filtros disponíveis da API (marcas, tipos de telhado, potências)
   */
  async buscarFiltros() {
    const endpoint = SOLARYUM_CONFIG.ENDPOINTS.FILTROS;
    
    const queryParams = new URLSearchParams();
    queryParams.append('token', this.apiKey);
    
    const url = `${endpoint}?${queryParams.toString()}`;
    console.log('🔍 Buscando filtros da API:', url);

    try {
      const filtros = await this.makeRequest(url, {
        method: 'GET'
      });

      console.log('✅ Filtros retornados pela API:', filtros);
      return filtros;
    } catch (error) {
      console.error('❌ Erro ao buscar filtros:', error);
      console.log('📋 Response completa do erro:', error);
      
      // Retorna estrutura vazia em caso de erro
      return {
        marcasPaineis: [],
        marcasInversores: [],
        tiposTelhados: [],
        potenciasPaineis: []
      };
    }
  }

  /**
   * Monta kit customizado usando o endpoint Montar_Kits (GET request com token como query parameter)
   */
  async montarKitCustomizado(dimensionamentoData) {
    const endpoint = SOLARYUM_CONFIG.ENDPOINTS.MONTAR_KITS;
    
    // Prepara query parameters para GET request com nomes corretos da API
    const queryParams = new URLSearchParams();
    queryParams.append('token', this.apiKey); // Token como query parameter
    queryParams.append('potenciaDoKit', dimensionamentoData.potencia_kw);
    console.log('🔍 Potência do kit enviada:', dimensionamentoData.potencia_kw, typeof dimensionamentoData.potencia_kw);
    console.log('🔍 Valor após append:', queryParams.get('potenciaDoKit'));
    queryParams.append('tensao', this.mapTensao(dimensionamentoData.tensao));
    queryParams.append('fase', this.mapFase(dimensionamentoData.fase));
    queryParams.append('telhados', this.mapTipoTelhado(dimensionamentoData.tipo_telhado));
    
    // Adiciona código IBGE se disponível
    if (dimensionamentoData.ibge) {
      queryParams.append('ibge', dimensionamentoData.ibge);
      console.log('🏙️ Incluindo código IBGE:', dimensionamentoData.ibge);
    } else {
      console.log('⚠️ Código IBGE não fornecido - pode causar erro na API');
    }

    // Adiciona filtros se disponíveis
    if (dimensionamentoData.marcaPainel) {
      queryParams.append('marcaPainel', dimensionamentoData.marcaPainel);
      console.log('🔍 Filtro por marca de painel:', dimensionamentoData.marcaPainel);
    }
    if (dimensionamentoData.marcaInversor) {
      queryParams.append('marcaInversor', dimensionamentoData.marcaInversor);
      console.log('🔍 Filtro por marca de inversor:', dimensionamentoData.marcaInversor);
    }
    if (dimensionamentoData.potenciaPainel) {
      queryParams.append('potenciaDoPainel', dimensionamentoData.potenciaPainel);
      console.log('🔍 Filtro por potência do painel:', dimensionamentoData.potenciaPainel, typeof dimensionamentoData.potenciaPainel);
    }
    if (dimensionamentoData.tipoInv) {
      queryParams.append('tipoInv', dimensionamentoData.tipoInv);
      console.log('🔍 Filtro por tipo de inversor:', dimensionamentoData.tipoInv);
    }

    const url = `${endpoint}?${queryParams.toString()}`;
    console.log('🔍 Fazendo GET request para:', url);
    console.log('🔍 Query params string:', queryParams.toString());
    console.log('📊 Dados enviados:', dimensionamentoData);
    console.log('🔧 Parâmetros mapeados:', {
      potenciaDoKit: dimensionamentoData.potencia_kw,
      potenciaDoPainel: dimensionamentoData.potenciaPainel,
      tensao: this.mapTensao(dimensionamentoData.tensao),
      fase: this.mapFase(dimensionamentoData.fase),
      telhados: this.mapTipoTelhado(dimensionamentoData.tipo_telhado),
      ibge: dimensionamentoData.ibge,
      marcaPainel: dimensionamentoData.marcaPainel,
      marcaInversor: dimensionamentoData.marcaInversor,
      potenciaPainel: dimensionamentoData.potenciaPainel,
      tipoInv: dimensionamentoData.tipoInv
    });

    try {
      const kitMontado = await this.makeRequest(url, {
        method: 'GET'
      });

      console.log('✅ Kit customizado retornado pela API:', kitMontado);
      return kitMontado;
    } catch (error) {
      console.error('❌ Erro ao montar kit customizado:', error);
      console.log('📋 Response completa do erro:', error);
      
      // Retorna o erro completo para análise
      throw {
        error: error,
        url: url,
        dimensionamentoData: dimensionamentoData,
        message: 'Erro ao buscar kit customizado - verifique os logs para detalhes'
      };
    }
  }

  /**
   * Mapeia tensão para código da API
   * 220V = 1, 380V = 2, +380V = 3
   */
  mapTensao(tensao) {
    const mapeamento = {
      '220': 1,
      '380': 2,
      '+380': 3
    };
    return mapeamento[tensao] || 1; // Default para 220V (código 1)
  }

  /**
   * Mapeia fase para código da API
   * Monofásico = 0, Trifásico = 2
   */
  mapFase(fase) {
    const mapeamento = {
      'monofasico': 0,
      'trifasico': 2
    };
    return mapeamento[fase] || 0; // Default para monofásico (código 0)
  }

  /**
   * Mapeia tipo de telhado para código da API (mapeamento correto)
   */
  mapTipoTelhado(tipoTelhado) {
    const mapeamento = {
      'ceramico': 0,        // Cerâmico
      'fibrocimento': 1,    // Fibrocimento
      'fibrometalico': 8,   // Fibrometálico
      'metalico': 4,        // Metálico
      'mini_trilho': 7,     // Mini Trilho
      'laje': 5,            // Laje
      'solo': 6,            // Solo
      'calhetao': 12,       // Calhetão
      'carport': 13         // Carport (em breve)
    };
    return mapeamento[tipoTelhado] || 0; // Default para cerâmico (código 0)
  }

  /**
   * Testa todos os tipos de telhado válidos para identificar estruturas
   */
  async testarTodosTiposTelhado() {
    console.log('🏠 Testando todos os tipos de telhado válidos...');
    
    const baseUrl = 'http://192.168.1.9:3002/api/solaryum';
    const endpoint = `${baseUrl}/integracaoPlataforma/MontarKits`;
    
    // Tipos de telhado válidos baseados no mapeamento correto
    const tiposTelhado = [
      { codigo: 0, nome: 'Cerâmico' },
      { codigo: 1, nome: 'Fibrocimento' },
      { codigo: 4, nome: 'Metálico' },
      { codigo: 5, nome: 'Laje' },
      { codigo: 6, nome: 'Solo' },
      { codigo: 7, nome: 'Mini Trilho' },
      { codigo: 8, nome: 'Fibrometálico' },
      { codigo: 12, nome: 'Calhetão' },
      { codigo: 13, nome: 'Carport' }
    ];
    
    const resultados = [];
    
    for (const tipo of tiposTelhado) {
      console.log(`🔍 Testando tipo de telhado: ${tipo.codigo} (${tipo.nome})`);
      
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('token', this.apiKey);
        queryParams.append('potenciaDoKit', '3');
        queryParams.append('tensao', '1');
        queryParams.append('fase', '0');
        queryParams.append('telhados', tipo.codigo.toString());
        queryParams.append('ibge', '3549904');
        
        const url = `${endpoint}?${queryParams.toString()}`;
        console.log(`🔗 URL: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/plain'
          }
        });
        
        console.log(`📡 Tipo ${tipo.codigo} (${tipo.nome}): ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Tipo ${tipo.codigo} funcionou!`);
          
          // Procura por estruturas na resposta
          let estruturaEncontrada = null;
          if (Array.isArray(data) && data.length > 0) {
            data.forEach(kit => {
              if (kit.composicao && Array.isArray(kit.composicao)) {
                kit.composicao.forEach(componente => {
                  if (componente.agrupamento === 'Estrutura') {
                    estruturaEncontrada = componente;
                  }
                });
              }
            });
          }
          
          const resultado = {
            codigo: tipo.codigo,
            nome: tipo.nome,
            status: 'success',
            estrutura: estruturaEncontrada,
            descricaoEstrutura: estruturaEncontrada ? estruturaEncontrada.descricao : 'Nenhuma estrutura encontrada'
          };
          
          resultados.push(resultado);
          console.log(`📋 Estrutura encontrada para ${tipo.nome}:`, estruturaEncontrada);
          
        } else {
          const errorText = await response.text();
          console.log(`❌ Tipo ${tipo.codigo} (${tipo.nome}): ${errorText}`);
          
          resultados.push({
            codigo: tipo.codigo,
            nome: tipo.nome,
            status: 'error',
            error: errorText,
            estrutura: null,
            descricaoEstrutura: 'Erro na requisição'
          });
        }
        
      } catch (error) {
        console.log(`❌ Tipo ${tipo.codigo} (${tipo.nome}): ${error.message}`);
        
        resultados.push({
          codigo: tipo.codigo,
          nome: tipo.nome,
          status: 'error',
          error: error.message,
          estrutura: null,
          descricaoEstrutura: 'Erro de rede'
        });
      }
      
      // Pequena pausa entre requisições para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('📊 Resultados finais dos tipos de telhado:', resultados);
    
    // Agrupa resultados por tipo de estrutura encontrada
    const estruturasPorTipo = {};
    resultados.forEach(resultado => {
      if (resultado.status === 'success' && resultado.descricaoEstrutura) {
        if (!estruturasPorTipo[resultado.descricaoEstrutura]) {
          estruturasPorTipo[resultado.descricaoEstrutura] = [];
        }
        estruturasPorTipo[resultado.descricaoEstrutura].push({
          codigo: resultado.codigo,
          nome: resultado.nome
        });
      }
    });
    
    console.log('🏗️ Estruturas agrupadas por tipo:', estruturasPorTipo);
    
    return {
      resultados: resultados,
      estruturasPorTipo: estruturasPorTipo
    };
  }

  /**
   * Testa diferentes IPs para identificar qual está na whitelist da API
   */
  async testarIPsPermitidos() {
    console.log('🔍 Testando diferentes IPs para identificar qual está na whitelist...');
    
    const ipsParaTestar = [
      '192.168.1.9',    // IP atual da máquina
      '192.168.1.72',    // IP mencionado anteriormente pelo usuário
      '127.0.0.1',       // Localhost
      '8.8.8.8',         // IP público (Google DNS)
      '1.1.1.1'          // IP público (Cloudflare DNS)
    ];
    
    // Usa a URL direta da API, não o proxy local
    const baseUrl = 'https://api-d1297.cloud.solaryum.com.br';
    const endpoint = `${baseUrl}/integracaoPlataforma/MontarKits`;
    
    const queryParams = new URLSearchParams();
    queryParams.append('token', this.apiKey);
    queryParams.append('potenciaDoKit', '3');
    queryParams.append('tensao', '1');
    queryParams.append('fase', '0');
    queryParams.append('ibge', '3549904');
    
    for (const ip of ipsParaTestar) {
      console.log(`🔍 Testando IP: ${ip}`);
      
      try {
        // Simula requisição com IP específico através de headers
        const url = `${endpoint}?${queryParams.toString()}`;
        console.log(`🔗 URL: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/plain',
            'X-Forwarded-For': ip,
            'X-Real-IP': ip,
            'X-Client-IP': ip,
            'Client-IP': ip,
            'Remote-Addr': ip
          }
        });
        
        console.log(`📡 IP ${ip}: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          console.log(`✅ IP ${ip} FUNCIONOU!`);
          const data = await response.text();
          console.log('📋 Resposta:', data);
          return { success: true, ip: ip, data: data };
        } else {
          const errorText = await response.text();
          console.log(`❌ IP ${ip}: ${errorText}`);
        }
        
      } catch (error) {
        console.log(`❌ IP ${ip}: ${error.message}`);
      }
    }
    
    console.log('🔍 Nenhum IP funcionou');
    return { success: false };
  }

  /**
   * Calcula custos baseado no kit montado pela API
   */
  calcularCustosComKit(kitMontado, dimensionamentoData) {
    console.log('🔍 calcularCustosComKit iniciado com:');
    console.log('  - kitMontado:', kitMontado);
    console.log('  - dimensionamentoData:', dimensionamentoData);
    
    const potencia = dimensionamentoData.potencia_kw || 5;
    
    // Verifica se kitMontado é válido
    if (!kitMontado || !Array.isArray(kitMontado) || kitMontado.length === 0) {
      console.warn('⚠️ Kit montado inválido ou vazio, usando valores padrão');
      return this.getMockCustos(dimensionamentoData);
    }
    
    // Pega o primeiro kit da lista
    const kit = kitMontado[0];
    console.log('🔍 Kit selecionado:', kit);
    
    // Extrai informações do kit montado
    const componentes = kit.composicao || [];
    const custoTotalKit = kit.precoTotal || 0;
    
    console.log('🔍 Componentes:', componentes);
    console.log('🔍 Custo total do kit:', custoTotalKit);
    
    // Calcula custos de equipamentos baseado no kit
    const custoEquipamentos = custoTotalKit;
    const custoInstalacao = custoTotalKit * 0.3; // 30% do custo dos equipamentos

    return {
      equipamentos: {
        kit: {
          nome: kit.nome || 'Kit Solar Customizado',
          potencia: kit.potencia || potencia,
          componentes: componentes,
          total: custoEquipamentos
        },
        total: custoEquipamentos
      },
      instalacao: {
        mao_obra: {
          dias: Math.ceil(potencia / 2),
          valor_dia: 300,
          total: Math.ceil(potencia / 2) * 300
        },
        equipamentos_instalacao: {
          total: custoInstalacao * 0.5
        },
        transporte: {
          total: custoInstalacao * 0.2
        },
        outros: {
          total: custoInstalacao * 0.3
        },
        total: custoInstalacao
      },
      total: this.calculateTotalCost(
        { total: custoEquipamentos },
        { total: custoInstalacao }
      )
    };
  }

  /**
   * Retorna custos mock quando não há kits disponíveis
   */
  getMockCustos(dimensionamentoData) {
    const potencia = dimensionamentoData.potencia_kw || 5;
    const custoEquipamentos = potencia * 8000; // R$ 8.000 por kW
    const custoInstalacao = potencia * 2000; // R$ 2.000 por kW
    
    return {
      equipamentos: {
        kit: {
          nome: 'Kit Solar Estimado',
          potencia: potencia,
          componentes: [],
          total: custoEquipamentos
        },
        total: custoEquipamentos
      },
      instalacao: {
        mao_obra: {
          dias: Math.ceil(potencia / 2),
          valor_dia: 300,
          total: Math.ceil(potencia / 2) * 300
        },
        equipamentos_instalacao: {
          total: custoInstalacao * 0.5
        },
        transporte: {
          total: custoInstalacao * 0.2
        },
        outros: {
          total: custoInstalacao * 0.3
        },
        total: custoInstalacao
      },
      total: custoEquipamentos + custoInstalacao
    };
  }

  /**
   * Calcula custos baseado nos produtos retornados pela API
   */
  calcularCustosComProdutos(produtos, dimensionamentoData) {
    const potencia = dimensionamentoData.potencia_kw || 5;
    
    // Agrupa produtos por tipo
    const paineis = produtos.filter(p => p.agrupamento === 'PAINEL' || p.idAgrupamento === 1);
    const inversores = produtos.filter(p => p.agrupamento === 'INVERSOR' || p.idAgrupamento === 2);
    const estruturas = produtos.filter(p => p.agrupamento === 'ESTRUTURA' || p.idAgrupamento === 3);
    const outros = produtos.filter(p => !['PAINEL', 'INVERSOR', 'ESTRUTURA'].includes(p.agrupamento));

    // Calcula quantidades necessárias
    const potenciaPainel = paineis.length > 0 ? paineis[0].potencia : 400; // 400W padrão
    const quantidadePaineis = Math.ceil((potencia * 1000) / potenciaPainel);
    const quantidadeInversores = Math.ceil(potencia / 5); // 1 inversor para cada 5kW

    // Calcula custos
    const custoPaineis = quantidadePaineis * (paineis.length > 0 ? paineis[0].precoVenda : 800);
    const custoInversores = quantidadeInversores * (inversores.length > 0 ? inversores[0].precoVenda : 2500);
    const custoEstruturas = quantidadePaineis * (estruturas.length > 0 ? estruturas[0].precoVenda : 150);
    const custoOutros = outros.reduce((total, produto) => total + produto.precoVenda, 0);

    const custoTotalEquipamentos = custoPaineis + custoInversores + custoEstruturas + custoOutros;
    const custoInstalacao = custoTotalEquipamentos * 0.3; // 30% do custo dos equipamentos

    return {
      equipamentos: {
        paineis: {
          quantidade: quantidadePaineis,
          preco_unitario: paineis.length > 0 ? paineis[0].precoVenda : 800,
          total: custoPaineis,
          produto: paineis[0] || null
        },
        inversores: {
          quantidade: quantidadeInversores,
          preco_unitario: inversores.length > 0 ? inversores[0].precoVenda : 2500,
          total: custoInversores,
          produto: inversores[0] || null
        },
        estruturas: {
          quantidade: quantidadePaineis,
          preco_unitario: estruturas.length > 0 ? estruturas[0].precoVenda : 150,
          total: custoEstruturas,
          produto: estruturas[0] || null
        },
        outros: {
          produtos: outros,
          total: custoOutros
        },
        total: custoTotalEquipamentos
      },
      instalacao: {
        mao_obra: {
          dias: Math.ceil(potencia / 2),
          valor_dia: 300,
          total: Math.ceil(potencia / 2) * 300
        },
        equipamentos_instalacao: {
          total: custoInstalacao * 0.5
        },
        transporte: {
          total: custoInstalacao * 0.2
        },
        outros: {
          total: custoInstalacao * 0.3
        },
        total: custoInstalacao
      },
      total: this.calculateTotalCost(
        { total: custoTotalEquipamentos },
        { total: custoInstalacao }
      )
    };
  }

  /**
   * Calcula custo total
   */
  calculateTotalCost(equipmentCosts, installationCosts) {
    const equipmentTotal = equipmentCosts?.total || 0;
    const installationTotal = installationCosts?.total || 0;
    
    return {
      equipamentos: equipmentTotal,
      instalacao: installationTotal,
      subtotal: equipmentTotal + installationTotal,
      impostos: (equipmentTotal + installationTotal) * SOLARYUM_CONFIG.FALLBACK.TAX_RATE,
      total: (equipmentTotal + installationTotal) * (1 + SOLARYUM_CONFIG.FALLBACK.TAX_RATE)
    };
  }

  /**
   * Dados mock para kit customizado (fallback)
   */
  getMockKitCustomizado(dimensionamentoData) {
    const potencia = dimensionamentoData.potencia_kw || 5;
    const tipoTelhado = dimensionamentoData.tipo_telhado || 'ceramico';
    
    // Calcula componentes baseado na potência
    const quantidadePaineis = Math.ceil((potencia * 1000) / 400);
    const quantidadeInversores = Math.ceil(potencia / 5);
    
    return {
      idKit: 'custom-' + Date.now(),
      nome: `Kit Solar Customizado ${potencia}kW`,
      descricao: `Kit customizado para ${potencia}kW com telhado ${tipoTelhado}`,
      potenciaTotal: potencia,
      precoTotal: potencia * SOLARYUM_CONFIG.FALLBACK.EQUIPMENT_PRICE_PER_KW,
      categoria: "Customizado",
      componentes: {
        paineis: {
          marca: "Canadian Solar",
          modelo: "CS3K-400MS",
          quantidade: quantidadePaineis,
          potenciaUnitaria: 400,
          precoUnidade: 800,
          total: quantidadePaineis * 800,
          especificacoes: {
            area: 2.0,
            dimensoes: "1.0m × 2.0m",
            tensao: dimensionamentoData.tensao || 220,
            fase: dimensionamentoData.fase || 1
          }
        },
        inversores: {
          marca: "SMA",
          modelo: "STP 5000TL-20",
          quantidade: quantidadeInversores,
          potencia: 5000,
          precoUnidade: 2500,
          total: quantidadeInversores * 2500,
          especificacoes: {
            tensao: dimensionamentoData.tensao || 220,
            fase: dimensionamentoData.fase || 1,
            tipo: "String"
          }
        },
        estruturas: {
          marca: "Estrutura Solar",
          modelo: `ES-${tipoTelhado.toUpperCase()}-001`,
          quantidade: quantidadePaineis,
          precoUnidade: 150,
          total: quantidadePaineis * 150,
          especificacoes: {
            tipo: `Telhado ${tipoTelhado.charAt(0).toUpperCase() + tipoTelhado.slice(1)}`,
            material: "Alumínio"
          }
        },
        acessorios: [
          {
            nome: "String Box 20A",
            quantidade: 1,
            precoUnidade: 300,
            total: 300
          },
          {
            nome: "Cabos Solares 4mm²",
            quantidade: Math.ceil(potencia * 10),
            precoUnidade: 25,
            total: Math.ceil(potencia * 10) * 25
          },
          {
            nome: "Monitoramento WiFi",
            quantidade: 1,
            precoUnidade: 500,
            total: 500
          }
        ]
      },
      garantia: "25 anos painéis, 10 anos inversor",
      instalacao: "Incluída",
      estoque: 999,
      fotoUrl: "https://example.com/kit-customizado.jpg"
    };
  }

  /**
   * Dados mock para kits completos
   */
  getMockKits(filtros = {}) {
    const potencia = filtros.potencia || 5;
    
    return [
      {
        idKit: 1,
        nome: "Kit Solar Residencial Premium",
        descricao: "Kit completo para residência com painéis Canadian Solar e inversor SMA",
        potenciaTotal: 4.4,
        precoTotal: 18500,
        categoria: "Premium",
        componentes: {
          paineis: {
            marca: "Canadian Solar",
            modelo: "CS3K-400MS",
            quantidade: 11,
            potenciaUnitaria: 400,
            precoUnidade: 800,
            total: 8800,
            especificacoes: {
              area: 2.0,
              dimensoes: "1.0m × 2.0m",
              tensao: 220,
              fase: 1
            }
          },
          inversores: {
            marca: "SMA",
            modelo: "STP 5000TL-20",
            quantidade: 1,
            potencia: 5000,
            precoUnidade: 2500,
            total: 2500,
            especificacoes: {
              tensao: 220,
              fase: 1,
              tipo: "String"
            }
          },
          estruturas: {
            marca: "Estrutura Solar",
            modelo: "ES-CER-001",
            quantidade: 11,
            precoUnidade: 150,
            total: 1650,
            especificacoes: {
              tipo: "Telhado Cerâmico",
              material: "Alumínio"
            }
          },
          acessorios: [
            {
              nome: "String Box 20A",
              quantidade: 1,
              precoUnidade: 300,
              total: 300
            },
            {
              nome: "Cabos Solares 4mm²",
              quantidade: 50,
              precoUnidade: 25,
              total: 1250
            },
            {
              nome: "Monitoramento WiFi",
              quantidade: 1,
              precoUnidade: 500,
              total: 500
            }
          ]
        },
        garantia: "25 anos painéis, 10 anos inversor",
        instalacao: "Incluída",
        estoque: 15,
        fotoUrl: "https://example.com/kit-premium.jpg"
      },
      {
        idKit: 2,
        nome: "Kit Solar Residencial Standard",
        descricao: "Kit econômico com painéis Trina Solar e inversor Huawei",
        potenciaTotal: 4.0,
        precoTotal: 15200,
        categoria: "Standard",
        componentes: {
          paineis: {
            marca: "Trina Solar",
            modelo: "TSM-400DE14",
            quantidade: 10,
            potenciaUnitaria: 400,
            precoUnidade: 750,
            total: 7500,
            especificacoes: {
              area: 2.0,
              dimensoes: "1.0m × 2.0m",
              tensao: 220,
              fase: 1
            }
          },
          inversores: {
            marca: "Huawei",
            modelo: "SUN2000-5KTL-L1",
            quantidade: 1,
            potencia: 5000,
            precoUnidade: 2200,
            total: 2200,
            especificacoes: {
              tensao: 220,
              fase: 1,
              tipo: "String"
            }
          },
          estruturas: {
            marca: "SolarTech",
            modelo: "ST-MET-002",
            quantidade: 10,
            precoUnidade: 180,
            total: 1800,
            especificacoes: {
              tipo: "Telhado Metálico",
              material: "Aço Galvanizado"
            }
          },
          acessorios: [
            {
              nome: "String Box 15A",
              quantidade: 1,
              precoUnidade: 250,
              total: 250
            },
            {
              nome: "Cabos Solares 6mm²",
              quantidade: 40,
              precoUnidade: 30,
              total: 1200
            },
            {
              nome: "Monitoramento Básico",
              quantidade: 1,
              precoUnidade: 300,
              total: 300
            }
          ]
        },
        garantia: "25 anos painéis, 10 anos inversor",
        instalacao: "Incluída",
        estoque: 25,
        fotoUrl: "https://example.com/kit-standard.jpg"
      },
      {
        idKit: 3,
        nome: "Kit Solar Residencial Econômico",
        descricao: "Kit básico com painéis JinkoSolar e inversor Fronius",
        potenciaTotal: 3.6,
        precoTotal: 12800,
        categoria: "Econômico",
        componentes: {
          paineis: {
            marca: "JinkoSolar",
            modelo: "JKM400M-54HL4",
            quantidade: 9,
            potenciaUnitaria: 400,
            precoUnidade: 820,
            total: 7380,
            especificacoes: {
              area: 2.0,
              dimensoes: "1.0m × 2.0m",
              tensao: 220,
              fase: 1
            }
          },
          inversores: {
            marca: "Fronius",
            modelo: "Primo 3.6-1",
            quantidade: 1,
            potencia: 3600,
            precoUnidade: 2000,
            total: 2000,
            especificacoes: {
              tensao: 220,
              fase: 1,
              tipo: "String"
            }
          },
          estruturas: {
            marca: "Estrutura Solar",
            modelo: "ES-BAS-003",
            quantidade: 9,
            precoUnidade: 120,
            total: 1080,
            especificacoes: {
              tipo: "Telhado Cerâmico",
              material: "Alumínio"
            }
          },
          acessorios: [
            {
              nome: "String Box 10A",
              quantidade: 1,
              precoUnidade: 200,
              total: 200
            },
            {
              nome: "Cabos Solares 4mm²",
              quantidade: 30,
              precoUnidade: 25,
              total: 750
            },
            {
              nome: "Monitoramento Básico",
              quantidade: 1,
              precoUnidade: 200,
              total: 200
            }
          ]
        },
        garantia: "25 anos painéis, 10 anos inversor",
        instalacao: "Incluída",
        estoque: 30,
        fotoUrl: "https://example.com/kit-economico.jpg"
      }
    ];
  }

  /**
   * Dados mock para produtos (mantido para compatibilidade)
   */
  getMockProdutos(filtros = {}) {
    const potencia = filtros.potencia || 5;
    
    return [
      {
        idProduto: 1,
        codErp: "PAINEL-400W",
        descricao: "Painel Solar 400W Policristalino",
        precoVenda: 800,
        marca: "Canadian Solar",
        modelo: "CS3K-400MS",
        idAgrupamento: 1,
        agrupamento: "PAINEL",
        potencia: 400,
        area: 2.0,
        largura: 1.0,
        altura: 2.0,
        comprimento: 0.05,
        estoque: 100,
        estrutura: "Estrutura para telhado cerâmico",
        marcaPainel: "Canadian Solar",
        unidade: "UN",
        tensao: 220,
        fase: 1,
        tipoInv: 1,
        telhado: filtros.tipoTelhado || 0,
        orientacao: "Norte",
        fornecedorEstrutura: "Estrutura Solar",
        fotoUrl: "https://example.com/painel.jpg"
      },
      {
        idProduto: 2,
        codErp: "INV-5KW",
        descricao: "Inversor String 5kW",
        precoVenda: 2500,
        marca: "SMA",
        modelo: "STP 5000TL-20",
        idAgrupamento: 2,
        agrupamento: "INVERSOR",
        potencia: 5000,
        estoque: 50,
        marcaInversor: "SMA",
        unidade: "UN",
        tensao: 220,
        fase: 1,
        tipoInv: 1,
        fotoUrl: "https://example.com/inversor.jpg"
      },
      {
        idProduto: 3,
        codErp: "ESTR-CERAMICA",
        descricao: "Estrutura para Telhado Cerâmico",
        precoVenda: 150,
        marca: "Estrutura Solar",
        modelo: "ES-CER-001",
        idAgrupamento: 3,
        agrupamento: "ESTRUTURA",
        estoque: 200,
        estrutura: "Estrutura para telhado cerâmico",
        fornecedorEstrutura: "Estrutura Solar",
        fotoUrl: "https://example.com/estrutura.jpg"
      }
    ];
  }

  /**
   * Dados mock para filtros
   */
  getMockFiltros() {
    return {
      marcasPaineis: [
        { idMarca: 1, descricao: "Canadian Solar" },
        { idMarca: 2, descricao: "Trina Solar" },
        { idMarca: 3, descricao: "JinkoSolar" }
      ],
      marcasInversores: [
        { idMarca: 1, descricao: "SMA" },
        { idMarca: 2, descricao: "Fronius" },
        { idMarca: 3, descricao: "Huawei" }
      ],
      tiposTelhados: [
        { id: 0, descricao: "Cerâmico" },
        { id: 1, descricao: "Metálico" },
        { id: 2, descricao: "Fibrocimento" },
        { id: 3, descricao: "Laje" },
        { id: 4, descricao: "Solo" }
      ],
      potenciasPaineis: [
        { potencia: 400 },
        { potencia: 450 },
        { potencia: 500 },
        { potencia: 550 }
      ]
    };
  }

  getMockInstallationCosts(data) {
    const potencia = data.potencia_kw || 5;
    const basePrice = potencia * SOLARYUM_CONFIG.FALLBACK.INSTALLATION_PRICE_PER_KW;

    return {
      mao_obra: {
        dias: Math.ceil(potencia / 2),
        valor_dia: 300,
        total: Math.ceil(potencia / 2) * 300
      },
      equipamentos_instalacao: {
        total: potencia * 300
      },
      transporte: {
        total: potencia * 100
      },
      outros: {
        total: potencia * 200
      },
      total: basePrice
    };
  }

  getMockEquipmentCosts(data) {
    const potencia = data.potencia_kw || 5;
    
    // Cálculos baseados na potência
    const quantidadePaineis = Math.ceil((potencia * 1000) / 400); // 400W por painel
    const quantidadeInversores = Math.ceil(potencia / 5); // 1 inversor para cada 5kW
    
    return {
      paineis: {
        quantidade: quantidadePaineis,
        preco_unitario: 800,
        total: quantidadePaineis * 800,
        produto: {
          marca: "Canadian Solar",
          modelo: "CS3K-400MS",
          potencia: 400
        }
      },
      inversores: {
        quantidade: quantidadeInversores,
        preco_unitario: 2500,
        total: quantidadeInversores * 2500,
        produto: {
          marca: "SMA",
          modelo: "STP 5000TL-20",
          potencia: 5000
        }
      },
      estruturas: {
        quantidade: quantidadePaineis,
        preco_unitario: 150,
        total: quantidadePaineis * 150,
        produto: {
          marca: "Estrutura Solar",
          modelo: "ES-CER-001"
        }
      },
      outros: {
        produtos: [],
        total: 0
      },
      total: (quantidadePaineis * 800) + (quantidadeInversores * 2500) + (quantidadePaineis * 150)
    };
  }

  getMockProjectCosts(data) {
    const equipmentCosts = this.getMockEquipmentCosts(data);
    const installationCosts = this.getMockInstallationCosts(data);
    
    return {
      equipamentos: equipmentCosts,
      instalacao: installationCosts,
      total: this.calculateTotalCost(equipmentCosts, installationCosts)
    };
  }

  /**
   * Valida se a API está disponível
   */
  async checkApiHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      console.warn('API Solaryum não disponível, usando dados mock:', error.message);
      return false;
    }
  }
}

// Instância singleton do serviço
const solaryumApi = new SolaryumApiService();

// Função global para teste de IPs (disponível no console do browser)
if (typeof window !== 'undefined') {
  window.testarIPsPermitidos = () => solaryumApi.testarIPsPermitidos();
  window.testarTodosTiposTelhado = () => solaryumApi.testarTodosTiposTelhado();
}

export default solaryumApi;
