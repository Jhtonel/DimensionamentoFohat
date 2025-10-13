import React, { useState, useEffect } from "react";
import { Projeto, Cliente, Configuracao, IrradiacaoSolar } from "@/entities";
import { InvokeLLM } from "@/integrations/Core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calculator, Save, DollarSign, TrendingUp, MapPin, Search, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import cepService from "../services/cepService";
import solaryumApi from "../services/solaryumApi";
import { getIrradianciaByCity } from "../utils/irradianciaUtils";
import { useProjectCosts } from "../hooks/useProjectCosts";

import DimensionamentoResults from "../components/projetos/DimensionamentoResults.jsx";
import ConsumoMesAMes from "../components/projetos/ConsumoMesAMes.jsx";

export default function NovoProjeto() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [activeTab, setActiveTab] = useState("basico");
  const [tipoConsumo, setTipoConsumo] = useState("medio");
  
  // Hook para gerenciar custos via API Solaryum
  const {
    costs,
    loading: costsLoading,
    error: costsError,
    apiAvailable,
    calculateRealTimeCosts,
    formatCurrency,
    calculateMonthlySavings
  } = useProjectCosts();
  
  const [formData, setFormData] = useState({
    cliente_id: "",
    nome_projeto: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    ibge: "", // Código IBGE da cidade
    endereco_completo: "",
    tipo_telhado: "ceramico",
    tensao: "220", // Tensão padrão: 220V
    concessionaria: "",
    consumo_mensal_reais: "",
    consumo_mensal_kwh: "",
    consumo_mes_a_mes: [],
    percentual_margem_lucro: 30,
    status: "dimensionamento"
  });

  const [resultados, setResultados] = useState(null);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);
  const [todosOsKits, setTodosOsKits] = useState([]); // Todos os kits recebidos da API
  const [kitsFiltrados, setKitsFiltrados] = useState([]); // Kits após aplicar filtros locais
  const [kitSelecionado, setKitSelecionado] = useState(null);
  const [filtrosDisponiveis, setFiltrosDisponiveis] = useState({
    marcasPaineis: [],
    marcasInversores: [],
    tiposTelhados: [],
    potenciasPaineis: []
  });
  const [filtrosSelecionados, setFiltrosSelecionados] = useState({
    marcaPainel: null,
    marcaInversor: null,
    potenciaPainel: null,
    tipoInversor: null,
    ordenacao: null
  });
  const [produtosSelecionados, setProdutosSelecionados] = useState({
    paineis: null,
    inversores: null,
    estruturas: null,
    acessorios: []
  });
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [loadingFiltros, setLoadingFiltros] = useState(false);
  const [quantidadesCalculadas, setQuantidadesCalculadas] = useState({ paineis: 0, inversores: 0, estruturas: 0, acessorios: 0 });

  useEffect(() => {
    loadData();
  }, []);

  // Calcula custos em tempo real quando os dados do formulário mudam
  useEffect(() => {
    const calculateCosts = async () => {
      if (formData.potencia_kw && formData.potencia_kw > 0) {
        await calculateRealTimeCosts(formData);
      }
    };

    calculateCosts();
  }, [formData.potencia_kw, formData.tipo_instalacao, formData.regiao, formData.tipo_telhado, calculateRealTimeCosts]);

  const loadData = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projetoId = urlParams.get('projeto_id');
    
    const [clientesData, configsData] = await Promise.all([
      Cliente.list(),
      Configuracao.list()
    ]);
    
    setClientes(clientesData);
    
    const configsMap = {};
    configsData.forEach(config => {
      configsMap[config.chave] = config;
    });
    setConfigs(configsMap);

    if (projetoId) {
      const projeto = await Projeto.list();
      const projetoEdit = projeto.find(p => p.id === projetoId);
      if (projetoEdit) {
        setFormData(projetoEdit);
        if (projetoEdit.consumo_mes_a_mes && projetoEdit.consumo_mes_a_mes.length > 0) {
          setTipoConsumo("mes_a_mes");
        }
        if (projetoEdit.potencia_sistema_kwp) {
          setResultados({
            potencia_sistema_kwp: projetoEdit.potencia_sistema_kwp,
            quantidade_placas: projetoEdit.quantidade_placas,
            custo_total: projetoEdit.custo_total,
            preco_final: projetoEdit.preco_final,
            economia_mensal_estimada: projetoEdit.economia_mensal_estimada,
            payback_meses: projetoEdit.payback_meses,
            custo_equipamentos: projetoEdit.custo_equipamentos,
            custo_instalacao: projetoEdit.custo_instalacao,
            custo_homologacao: projetoEdit.custo_homologacao,
            custo_ca: projetoEdit.custo_ca,
            custo_plaquinhas: projetoEdit.custo_plaquinhas,
            custo_obra: projetoEdit.custo_obra
          });
        }
      }
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Atualiza endereço completo automaticamente
      if (['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep'].includes(field)) {
        const partes = [];
        if (newData.logradouro) partes.push(newData.logradouro);
        if (newData.numero) partes.push(newData.numero);
        if (newData.complemento) partes.push(newData.complemento);
        if (newData.bairro) partes.push(newData.bairro);
        if (newData.cidade) partes.push(newData.cidade);
        if (newData.estado) partes.push(newData.estado);
        if (newData.cep) partes.push(newData.cep);
        
        newData.endereco_completo = partes.join(', ');
      }
      
      return newData;
    });
  };

  // Função auxiliar para mapear agrupamentos
  const getAgrupamentoId = (agrupamento) => {
    const mapeamento = {
      'Painel': 1,
      'Inversor': 2,
      'Estrutura': 3,
      'Outros': 4,
      'ACESSORIO': 4
    };
    return mapeamento[agrupamento] || 4;
  };

  // Função para aplicar filtros locais aos kits
  const aplicarFiltrosLocais = (kits, filtros) => {
    if (!kits || kits.length === 0) return [];

    return kits.filter(kit => {
      // Filtro por marca de painel
      if (filtros.marcaPainel) {
        // Busca a marca pelo ID nos filtros disponíveis
        const marcaInfo = filtrosDisponiveis.marcasPaineis.find(m => m.idMarca.toString() === filtros.marcaPainel);
        const nomeMarca = marcaInfo ? marcaInfo.descricao : filtros.marcaPainel;
        
        console.log(`🔍 Filtrando por marca de painel: ID=${filtros.marcaPainel}, Nome=${nomeMarca}`);
        
        const temPainelComMarca = kit.componentes.some(componente => {
          if (componente.agrupamento === 'Painel' && componente.marca) {
            console.log(`  📋 Painel encontrado: ${componente.marca} (${componente.descricao})`);
            return componente.marca.toLowerCase() === nomeMarca.toLowerCase();
          }
          return false;
        });
        
        if (!temPainelComMarca) {
          console.log(`  ❌ Kit não tem painel da marca ${nomeMarca}`);
          return false;
        }
        console.log(`  ✅ Kit tem painel da marca ${nomeMarca}`);
      }

      // Filtro por marca de inversor
      if (filtros.marcaInversor) {
        // Busca a marca pelo ID nos filtros disponíveis
        const marcaInfo = filtrosDisponiveis.marcasInversores.find(m => m.idMarca.toString() === filtros.marcaInversor);
        const nomeMarca = marcaInfo ? marcaInfo.descricao : filtros.marcaInversor;
        
        console.log(`🔍 Filtrando por marca de inversor: ID=${filtros.marcaInversor}, Nome=${nomeMarca}`);
        
        const temInversorComMarca = kit.componentes.some(componente => {
          if (componente.agrupamento === 'Inversor' && componente.marca) {
            console.log(`  📋 Inversor encontrado: ${componente.marca} (${componente.descricao})`);
            return componente.marca.toLowerCase() === nomeMarca.toLowerCase();
          }
          return false;
        });
        
        if (!temInversorComMarca) {
          console.log(`  ❌ Kit não tem inversor da marca ${nomeMarca}`);
          return false;
        }
        console.log(`  ✅ Kit tem inversor da marca ${nomeMarca}`);
      }

      // Filtro por potência do painel
      if (filtros.potenciaPainel) {
        const temPainelComPotencia = kit.componentes.some(componente => 
          componente.agrupamento === 'Painel' && 
          componente.potencia && 
          componente.potencia.toString() === filtros.potenciaPainel.toString()
        );
        if (!temPainelComPotencia) return false;
      }

      // Filtro por tipo de inversor (micro vs string vs híbrido)
      if (filtros.tipoInversor) {
        const temInversorComTipo = kit.componentes.some(componente => {
          if (componente.agrupamento !== 'Inversor') return false;
          
          const descricao = componente.descricao?.toLowerCase() || '';
          const marca = componente.marca?.toLowerCase() || '';
          
          if (filtros.tipoInversor === 'micro') {
            return descricao.includes('micro') || marca.includes('micro');
          } else if (filtros.tipoInversor === 'string') {
            return !descricao.includes('micro') && !marca.includes('micro') && !descricao.includes('híbrido') && !descricao.includes('hibrido');
          } else if (filtros.tipoInversor === 'hibrido') {
            return descricao.includes('híbrido') || descricao.includes('hibrido') || marca.includes('híbrido') || marca.includes('hibrido');
          }
          
          return false;
        });
        if (!temInversorComTipo) return false;
      }

      return true;
    });
  };

  // Função para verificar se há filtros ativos
  const temFiltrosAtivos = () => {
    return filtrosSelecionados.marcaPainel || 
           filtrosSelecionados.marcaInversor || 
           filtrosSelecionados.potenciaPainel || 
           filtrosSelecionados.tipoInversor ||
           filtrosSelecionados.ordenacao;
  };

  // Função para aplicar ordenação aos kits
  const aplicarOrdenacao = (kits, tipoOrdenacao) => {
    if (!tipoOrdenacao || tipoOrdenacao === 'padrao') {
      return [...kits]; // Retorna cópia sem ordenação
    }

    return [...kits].sort((a, b) => {
      const precoA = a.precoTotal || 0;
      const precoB = b.precoTotal || 0;

      if (tipoOrdenacao === 'preco_menor_maior') {
        return precoA - precoB;
      } else if (tipoOrdenacao === 'preco_maior_menor') {
        return precoB - precoA;
      }

      return 0;
    });
  };

  // Função para aplicar filtros em tempo real
  const aplicarFiltrosTempoReal = (novosFiltros) => {
    const filtrosAtualizados = { ...filtrosSelecionados, ...novosFiltros };
    setFiltrosSelecionados(filtrosAtualizados);
    
    console.log('🔍 Aplicando filtros em tempo real...');
    console.log('📊 Filtros anteriores:', filtrosSelecionados);
    console.log('📊 Novos filtros:', novosFiltros);
    console.log('📊 Filtros atualizados:', filtrosAtualizados);
    console.log('📊 Total de kits disponíveis:', todosOsKits.length);
    console.log('📊 Filtros disponíveis:', filtrosDisponiveis);
    
    // Aplica filtros aos kits já carregados
    const kitsFiltrados = aplicarFiltrosLocais(todosOsKits, filtrosAtualizados);
    
    // Aplica ordenação aos kits filtrados
    const kitsOrdenados = aplicarOrdenacao(kitsFiltrados, filtrosAtualizados.ordenacao);
    
    setKitsFiltrados(kitsOrdenados);
    setProdutosDisponiveis(kitsOrdenados);
    
    console.log('📊 Kits após filtros:', kitsFiltrados.length);
    console.log('📊 Kits após ordenação:', kitsOrdenados.length);
    console.log('✅ Filtros aplicados com sucesso');
  };

  // Função para limpar todos os filtros
  const limparTodosFiltros = () => {
    const filtrosLimpos = {
      marcaPainel: null,
      marcaInversor: null,
      potenciaPainel: null,
      tipoInversor: null,
      ordenacao: null
    };
    
    setFiltrosSelecionados(filtrosLimpos);
    
    // Mostra todos os kits novamente (sem ordenação)
    setKitsFiltrados(todosOsKits);
    setProdutosDisponiveis(todosOsKits);
    
    console.log('🧹 Todos os filtros foram limpos');
    console.log('📊 Mostrando todos os kits:', todosOsKits.length);
  };

  // Função para buscar filtros disponíveis
  const buscarFiltrosDisponiveis = async () => {
    setLoadingFiltros(true);
    
    try {
      console.log('🔍 Buscando filtros disponíveis...');
      const filtros = await solaryumApi.buscarFiltros();
      
      console.log('📋 Filtros recebidos:', filtros);
      setFiltrosDisponiveis(filtros);
      
    } catch (error) {
      console.error('❌ Erro ao buscar filtros:', error);
      alert('Erro ao buscar filtros disponíveis. Tente novamente.');
    } finally {
      setLoadingFiltros(false);
    }
  };

  const buscarProdutosDisponiveis = async () => {
    if (!temConsumoPreenchido()) {
      alert('Por favor, preencha pelo menos um tipo de consumo (valor em R$, kWh/mês ou consumo mês a mês)');
      return;
    }

    // Valida se o CEP foi preenchido (necessário para obter o código IBGE)
    if (!formData.cep || !formData.ibge) {
      alert('Por favor, preencha o CEP e clique em "Buscar CEP" para obter o código IBGE necessário para a consulta de equipamentos.');
      return;
    }

    setLoadingProdutos(true);
    
    try {
      // Primeiro busca os filtros disponíveis
      console.log('🔍 Buscando filtros disponíveis...');
      const filtros = await solaryumApi.buscarFiltros();
      setFiltrosDisponiveis(filtros);
      
      console.log('📋 Filtros recebidos:', filtros);
      
      // Calcula a potência se ainda não foi calculada
      let potenciaCalculada = formData.potencia_kw || await calcularPotenciaSistema(formData.consumo_mensal_kwh, formData.cidade);
      
      // Garante potência mínima de 3kW para evitar erro na API
      if (!potenciaCalculada || potenciaCalculada <= 0) {
        potenciaCalculada = 3.0;
        console.log('⚠️ Potência inválida, usando padrão de 3kW');
      }

      // Prepara dados base para montagem dos kits
      const dadosBase = {
        potencia_kw: potenciaCalculada,
        tipo_telhado: formData.tipo_telhado || 'ceramico',
        tensao: formData.tensao || '220',
        fase: formData.fase || 'monofasico',
        tipo_instalacao: formData.tipo_instalacao || 'residencial',
        regiao: formData.regiao || 'sudeste',
        complexidade: formData.complexidade || 'media',
        ibge: formData.ibge
      };

      console.log('🔍 Dados base para busca:', dadosBase);

      // Busca kits para cada potência de painel E cada tipo de inversor
      const todasPotencias = filtros.potenciasPaineis || [];
      const tiposInversor = [0, 1, 2]; // Tipos de inversor: 0, 1, 2
      
      console.log('⚡ Potências de painéis encontradas:', todasPotencias);
      console.log('🔌 Tipos de inversor a buscar:', tiposInversor);

      const todosOsKits = [];
      
      // Se não há potências específicas, faz uma busca geral para cada tipo de inversor
      if (todasPotencias.length === 0) {
        console.log('⚠️ Nenhuma potência específica encontrada, fazendo busca geral para cada tipo de inversor...');
        
        // Cria todas as requisições em paralelo
        const requisicoes = tiposInversor.map(async (tipoInv) => {
          console.log(`🔍 Preparando requisição para tipo de inversor ${tipoInv}...`);
          
          const dadosComTipoInv = {
            ...dadosBase,
            tipoInv: tipoInv.toString()
          };
          
          try {
            const kitCustomizado = await solaryumApi.montarKitCustomizado(dadosComTipoInv);
            console.log(`✅ Encontrados ${Array.isArray(kitCustomizado) ? kitCustomizado.length : 0} kits para tipo de inversor ${tipoInv}`);
            return Array.isArray(kitCustomizado) ? kitCustomizado : [];
          } catch (error) {
            console.error(`❌ Erro ao buscar kits para tipo de inversor ${tipoInv}:`, error);
            return [];
          }
        });
        
        // Executa todas as requisições em paralelo
        console.log('🚀 Executando todas as requisições em paralelo...');
        const resultados = await Promise.all(requisicoes);
        
        // Combina todos os resultados
        resultados.forEach((kits, index) => {
          todosOsKits.push(...kits);
          console.log(`📦 Tipo ${tiposInversor[index]}: ${kits.length} kits adicionados`);
        });
        
      } else {
        // Faz uma requisição para cada combinação de potência de painel E tipo de inversor
        console.log('🔍 Preparando requisições para todas as combinações...');
        
        // Cria todas as requisições em paralelo
        const requisicoes = [];
        
        for (const potenciaInfo of todasPotencias) {
          const potenciaPainel = potenciaInfo.potencia;
          
          for (const tipoInv of tiposInversor) {
            console.log(`🔍 Preparando requisição para ${potenciaPainel}W + tipo ${tipoInv}...`);
            
            const dadosComFiltros = {
              ...dadosBase,
              potenciaPainel: potenciaPainel.toString(),
              tipoInv: tipoInv.toString()
            };
            
            requisicoes.push(
              solaryumApi.montarKitCustomizado(dadosComFiltros)
                .then(kitCustomizado => {
                  const kits = Array.isArray(kitCustomizado) ? kitCustomizado : [];
                  console.log(`✅ Encontrados ${kits.length} kits para ${potenciaPainel}W + tipo ${tipoInv}`);
                  return { potenciaPainel, tipoInv, kits };
                })
                .catch(error => {
                  console.error(`❌ Erro ao buscar kits para ${potenciaPainel}W + tipo ${tipoInv}:`, error);
                  return { potenciaPainel, tipoInv, kits: [] };
                })
            );
          }
        }
        
        // Executa todas as requisições em paralelo
        console.log(`🚀 Executando ${requisicoes.length} requisições em paralelo...`);
        const resultados = await Promise.all(requisicoes);
        
        // Combina todos os resultados
        resultados.forEach(({ potenciaPainel, tipoInv, kits }) => {
          todosOsKits.push(...kits);
          console.log(`📦 ${potenciaPainel}W + tipo ${tipoInv}: ${kits.length} kits adicionados`);
        });
      }

      console.log(`📦 Total de kits encontrados: ${todosOsKits.length}`);
      
      // Processa todos os kits encontrados
      const kitsDisponiveis = [];
      
      if (todosOsKits.length > 0) {
        console.log('🔧 Processando todos os kits encontrados...');
        
        // Processa cada kit como uma opção completa
        todosOsKits.forEach((kit, index) => {
          const kitProcessado = {
            id: kit.idProduto || `kit-${index}`,
            nome: `Kit Solar ${kit.potencia}kW`,
            potencia: kit.potencia || 0,
            area: kit.area || 0,
            precoTotal: kit.precoVenda || 0,
            componentes: [],
            disponibilidade: null,
            fotoPrincipal: null
          };
          
          // Processa os componentes do kit
          let fotoPainel = null;
          let fotoInversor = null;
          
          if (kit.composicao && Array.isArray(kit.composicao)) {
            kit.composicao.forEach((componente) => {
              const componenteProcessado = {
                id: componente.idProduto,
                descricao: componente.descricao,
                marca: componente.marca,
                quantidade: componente.qtd,
                potencia: componente.potencia,
                agrupamento: componente.agrupamento,
                fotoUrl: componente.fotoUrl,
                dtDisponibilidade: componente.dtDisponibilidade
              };
              
              kitProcessado.componentes.push(componenteProcessado);
              
              // Coleta fotos do painel e inversor
              if (componente.agrupamento === 'Painel' && componente.fotoUrl && !fotoPainel) {
                fotoPainel = componente.fotoUrl;
              }
              if (componente.agrupamento === 'Inversor' && componente.fotoUrl && !fotoInversor) {
                fotoInversor = componente.fotoUrl;
              }
              
              // Define disponibilidade (data mais próxima)
              if (componente.dtDisponibilidade) {
                const dataComponente = new Date(componente.dtDisponibilidade);
                if (!kitProcessado.disponibilidade || dataComponente < new Date(kitProcessado.disponibilidade)) {
                  kitProcessado.disponibilidade = componente.dtDisponibilidade;
                }
              }
            });
          }
          
          // Define fotos principais (painel e inversor)
          kitProcessado.fotoPainel = fotoPainel;
          kitProcessado.fotoInversor = fotoInversor;
          
          kitsDisponiveis.push(kitProcessado);
        });
        
        console.log(`✅ ${kitsDisponiveis.length} kits processados com sucesso`);
      } else {
        console.log('⚠️ Nenhum kit encontrado para as potências disponíveis');
      }

        console.log('📋 Total de kits processados:', kitsDisponiveis.length);
        console.log('📋 Kits finais:', kitsDisponiveis);

        // Armazena todos os kits recebidos da API
        setTodosOsKits(kitsDisponiveis);
        
        // Aplica filtros locais aos kits
        const kitsComFiltros = aplicarFiltrosLocais(kitsDisponiveis, filtrosSelecionados);
        
        // Aplica ordenação aos kits filtrados
        const kitsOrdenados = aplicarOrdenacao(kitsComFiltros, filtrosSelecionados.ordenacao);
        
        setKitsFiltrados(kitsOrdenados);
        setProdutosDisponiveis(kitsOrdenados);
        
        console.log('🔍 Kits após filtros locais:', kitsComFiltros.length);
        console.log('🔍 Kits após ordenação:', kitsOrdenados.length);
      
      // Limpa seleções anteriores
        setKitSelecionado(null);
      setProdutosSelecionados({
        paineis: null,
        inversores: null,
        estruturas: null,
        acessorios: []
      });

      // Ativa a aba de equipamentos
      setActiveTab('equipamentos');
      
    } catch (error) {
      console.error('❌ Erro ao buscar kit customizado:', error);
      console.log('📋 Response completa do erro:', error);
      
      // Não usa dados mock - mostra erro completo
      setProdutosDisponiveis([]);
      
      // Mostra erro detalhado baseado no tipo
      let errorMessage = 'Erro desconhecido';
      let errorDetails = '';
      let errorBody = '';
      
      if (error.errorType === 'NETWORK_ERROR') {
        errorMessage = 'Erro de conectividade';
        errorDetails = `Possíveis causas:\n${error.possibleCauses?.join('\n') || 'CORS, DNS ou conectividade'}`;
        errorBody = `Mensagem: ${error.message}`;
      } else if (error.errorType === 'HTTP_ERROR') {
        if (error.status === 400 && error.body?.includes('Acesso negado')) {
          errorMessage = 'Erro de Autenticação';
          errorDetails = 'A chave da API não está sendo aceita';
          errorBody = `Resposta: ${error.body}`;
        } else {
          errorMessage = `Erro HTTP ${error.status}`;
          errorDetails = `Status: ${error.status} - ${error.statusText}`;
          errorBody = error.body ? `Resposta: ${error.body}` : '';
        }
      } else {
        errorMessage = error.message || 'Erro desconhecido';
        errorDetails = error.status ? `Status: ${error.status} - ${error.statusText}` : '';
        errorBody = error.body ? `Body: ${error.body}` : '';
      }
      
      const diagnosticTip = error.status === 400 && error.body?.includes('Acesso negado') 
        ? "💡 Dica: Execute 'testAuthentication()' no console para testar diferentes formatos de autenticação."
        : "💡 Dica: Execute 'testConnectivity()' no console para diagnosticar o problema. Verifique se está acessando http://192.168.1.9:3002";
      
      alert(`❌ Erro ao buscar equipamentos:\n\n${errorMessage}\n\n${errorDetails}\n\n${errorBody}\n\n${diagnosticTip}`);
    } finally {
      setLoadingProdutos(false);
    }
  };

  const buscarCEP = async () => {
    if (!formData.cep || formData.cep.length < 8) {
      alert('Por favor, digite um CEP válido');
      return;
    }
    
    setLoading(true);
    
    try {
      const dadosCEP = await cepService.buscarCEP(formData.cep);
      
      // Atualiza os campos do formulário com os dados do CEP
      setFormData(prev => ({
        ...prev,
        cep: cepService.formatarCEP(dadosCEP.cep),
        logradouro: dadosCEP.logradouro || '',
        bairro: dadosCEP.bairro || '',
        cidade: dadosCEP.localidade || '',
        estado: dadosCEP.uf || '',
        ibge: dadosCEP.ibge || '', // Salva o código IBGE
        endereco_completo: cepService.montarEnderecoCompleto(dadosCEP)
      }));
      
      // Mostra mensagem de sucesso
      console.log('CEP encontrado:', dadosCEP);
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      alert(`Erro ao buscar CEP: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const atualizarCustosComProdutosSelecionados = async () => {
    console.log('=== INÍCIO atualizarCustosComProdutosSelecionados ===');
    console.log('produtosSelecionados:', produtosSelecionados);
    
    if (!produtosSelecionados.paineis || !produtosSelecionados.inversores) {
      console.log('❌ Produtos não selecionados:', { 
        paineis: produtosSelecionados.paineis, 
        inversores: produtosSelecionados.inversores 
      });
      return;
    }

    try {
      console.log('✅ Produtos selecionados, iniciando cálculo...');
      console.log('formData atual:', formData);
      
      // Calcula a potência se ainda não foi calculada
      const potenciaCalculada = formData.potencia_kw || await calcularPotenciaSistema(formData.consumo_mensal_kwh, formData.cidade);
      console.log('Potência calculada:', potenciaCalculada);
      
      // Atualiza a potência no formData
      if (!formData.potencia_kw) {
        console.log('Atualizando formData.potencia_kw para:', potenciaCalculada);
        handleChange("potencia_kw", potenciaCalculada);
      }
      
      // Prepara dados para o cálculo
      const dadosParaCalculo = {
        ...formData,
        potencia_kw: potenciaCalculada
      };
      console.log('Dados para cálculo:', dadosParaCalculo);
      
      // Calcula custos baseado nos produtos selecionados
      console.log('🔄 Chamando calculateRealTimeCosts...');
      const resultado = await calculateRealTimeCosts(dadosParaCalculo);
      console.log('📊 Resultado do cálculo de custos:', resultado);
      
      if (resultado) {
        console.log('✅ Custos calculados com sucesso:', resultado);
        console.log('💰 Total dos custos:', resultado.total);
      } else {
        console.log('❌ Nenhum resultado retornado do cálculo de custos');
      }
    } catch (error) {
      console.error('💥 Erro ao atualizar custos:', error);
      console.error('Stack trace:', error.stack);
    }
    
    console.log('=== FIM atualizarCustosComProdutosSelecionados ===');
  };

  // Atualiza custos quando produtos selecionados mudam
  useEffect(() => {
    console.log('useEffect produtosSelecionados:', {
      paineis: !!produtosSelecionados.paineis,
      inversores: !!produtosSelecionados.inversores,
      estruturas: !!produtosSelecionados.estruturas
    });
    
    if (produtosSelecionados.paineis && produtosSelecionados.inversores) {
      console.log('Equipamentos selecionados, calculando custos...');
      atualizarCustosComProdutosSelecionados();
    }
  }, [produtosSelecionados.paineis, produtosSelecionados.inversores, produtosSelecionados.estruturas]);

  // Calcula automaticamente a potência do sistema baseada no consumo
  useEffect(() => {
    const calcularPotenciaAutomatica = async () => {
    const consumoMensal = parseFloat(formData.consumo_mensal_kwh) || 0;
      const cidade = formData.cidade || 'São José dos Campos';
      
      // Só calcula se há consumo válido e se a potência ainda não foi calculada
      if (consumoMensal > 0 && !formData.potencia_kw) {
        try {
          console.log('🔄 Calculando potência automaticamente...');
          const potenciaCalculada = await calcularPotenciaSistema(consumoMensal, cidade);
      if (potenciaCalculada !== formData.potencia_kw) {
        handleChange("potencia_kw", potenciaCalculada);
      }
        } catch (error) {
          console.error('❌ Erro ao calcular potência automaticamente:', error);
        }
      }
    };

    // Debounce para evitar múltiplas chamadas
    const timeoutId = setTimeout(calcularPotenciaAutomatica, 500);
    
    return () => clearTimeout(timeoutId);
  }, [formData.consumo_mensal_kwh, formData.cidade]);

  // Calcula quantidades automaticamente quando os dados mudam
  useEffect(() => {
    const calcularQuantidadesAutomaticas = async () => {
      // Só calcula se há dados suficientes E se já há uma potência calculada
      const consumoKwh = parseFloat(formData.consumo_mensal_kwh) || 0;
      const consumoReais = parseFloat(formData.consumo_mensal_reais) || 0;
      const potenciaKw = parseFloat(formData.potencia_kw) || 0;
      
      if ((consumoKwh > 0 || consumoReais > 0) && potenciaKw > 0) {
        try {
          console.log('🔄 Calculando quantidades automaticamente...');
          const quantidades = await calcularQuantidades();
          setQuantidadesCalculadas(quantidades);
        } catch (error) {
          console.error('❌ Erro ao calcular quantidades automaticamente:', error);
        }
      }
    };

    // Debounce para evitar múltiplas chamadas
    const timeoutId = setTimeout(calcularQuantidadesAutomaticas, 500);
    
    return () => clearTimeout(timeoutId);
  }, [formData.consumo_mensal_kwh, formData.consumo_mensal_reais, formData.potencia_kw, formData.cidade]);

  // Verifica se algum tipo de consumo foi preenchido
  const temConsumoPreenchido = () => {
    const consumoMensalKwh = parseFloat(formData.consumo_mensal_kwh) || 0;
    const consumoMensalReais = parseFloat(formData.consumo_mensal_reais) || 0;
    const consumosMesAMes = formData.consumo_mes_a_mes || [];
    const temConsumoMesAMes = consumosMesAMes.some(consumo => parseFloat(consumo.valor) > 0);
    
    return consumoMensalKwh > 0 || consumoMensalReais > 0 || temConsumoMesAMes;
  };

  // Função auxiliar para calcular quantidades de forma robusta
  const calcularQuantidades = async () => {
    // Tenta obter consumo de diferentes campos
    const consumoKwh = parseFloat(formData.consumo_mensal_kwh) || 0;
    const consumoReais = parseFloat(formData.consumo_mensal_reais) || 0;
    
    console.log('Dados de consumo:', {
      consumo_mensal_kwh: formData.consumo_mensal_kwh,
      consumo_mensal_reais: formData.consumo_mensal_reais,
      consumoKwh,
      consumoReais
    });
    
    // Se não tem consumo em kWh mas tem em reais, estima baseado no custo médio
    let consumoParaCalculo = consumoKwh;
    if (consumoParaCalculo <= 0 && consumoReais > 0) {
      // Estimativa: R$ 0,80 por kWh (tarifa média)
      consumoParaCalculo = consumoReais / 0.80;
      console.log('Consumo estimado a partir do valor em reais:', consumoParaCalculo, 'kWh');
    }
    
    // Usa a potência já calculada ou calcula uma nova se necessário
    let potenciaKw = formData.potencia_kw;
    
    // Só calcula nova potência se não houver uma já definida
    if (!potenciaKw || potenciaKw <= 0) {
      potenciaKw = await calcularPotenciaSistema(consumoParaCalculo, formData.cidade) || 3.0;
    }
    
    console.log('Calculando quantidades para potência:', potenciaKw, 'kW');
    
    const quantidades = {
      paineis: 0,
      inversores: 0,
      estruturas: 0,
      potenciaTotal: 0
    };
    
    if (produtosSelecionados.paineis) {
      quantidades.paineis = Math.ceil((potenciaKw * 1000) / produtosSelecionados.paineis.potencia);
      quantidades.potenciaTotal = quantidades.paineis * produtosSelecionados.paineis.potencia / 1000;
      console.log('Quantidade de painéis:', quantidades.paineis);
    }
    
    if (produtosSelecionados.inversores) {
      quantidades.inversores = Math.ceil(potenciaKw / (produtosSelecionados.inversores.potencia / 1000));
      console.log('Quantidade de inversores:', quantidades.inversores);
    }
    
    if (produtosSelecionados.estruturas) {
      quantidades.estruturas = quantidades.paineis || Math.ceil((potenciaKw * 1000) / 400); // 400W padrão
      console.log('Quantidade de estruturas:', quantidades.estruturas);
    }
    
    return quantidades;
  };

  const calcularPotenciaSistema = async (consumoMensalKwh, cidade = 'São José dos Campos') => {
    try {
      // Busca dados reais de irradiância da cidade
      const irradianciaData = await getIrradianciaByCity(cidade);
      
      if (!irradianciaData) {
        console.warn('⚠️ Cidade não encontrada nos dados de irradiância:', cidade);
        // Fallback para valores padrão
        const irradianciaMedia = 5.0;
        const eficienciaSistema = 0.80;
        const fatorCorrecao = 1.03;
        const potenciaNecessariaKw = (consumoMensalKwh / ((irradianciaMedia * eficienciaSistema) * 30.4)) * fatorCorrecao;
        const resultado = Math.ceil(potenciaNecessariaKw * 10) / 10;
        return Math.max(resultado, 3.0);
      }
      
      // A irradiância está em Wh/m²/dia, convertemos para kWh/m²/dia
      // Dividimos por 1000 para converter Wh para kWh
      const irradianciaDiaria = irradianciaData.annual / 1000;
    
    // Eficiência do sistema (80%)
    const eficienciaSistema = 0.80;
    
      // Fator de correção adicional (perdas do sistema)
      const fatorCorrecao = 1.05; // 5% de perdas adicionais
      
      // Fórmula: (Consumo do cliente em kWh/mês)/((irradiancia da região*eficiencia de 80%)*30,4) * fatorCorrecao
      const potenciaNecessariaKw = (consumoMensalKwh / ((irradianciaDiaria * eficienciaSistema) * 30.4)) * fatorCorrecao;
    
    const resultado = Math.ceil(potenciaNecessariaKw * 10) / 10; // Arredonda para 1 casa decimal
      console.log('🔢 Potência calculada:', resultado, 'kW');
      console.log('📊 Cidade:', cidade, '- Irradiancia anual:', irradianciaData.annual, 'kWh/m²/ano');
      console.log('📊 Irradiancia diária:', irradianciaDiaria.toFixed(2), 'kWh/m²/dia');
      console.log('📊 Fórmula aplicada: ', consumoMensalKwh, 'kWh/mês ÷ ((', irradianciaDiaria.toFixed(2), 'kWh/m²/dia × ', eficienciaSistema, ') × 30,4) ×', fatorCorrecao, '=', resultado, 'kW');
      console.log('📊 Cálculo detalhado: ', consumoMensalKwh, '÷ ((', irradianciaDiaria.toFixed(2), '×', eficienciaSistema, ') × 30,4) ×', fatorCorrecao, '=', consumoMensalKwh, '÷ (', (irradianciaDiaria * eficienciaSistema).toFixed(2), '× 30,4) ×', fatorCorrecao, '=', consumoMensalKwh, '÷', ((irradianciaDiaria * eficienciaSistema) * 30.4).toFixed(2), '×', fatorCorrecao, '=', potenciaNecessariaKw.toFixed(2));
    
    // Garantir potência mínima de 3 kW
    const potenciaFinal = Math.max(resultado, 3.0);
      console.log('🔢 Potência final (mínimo 3kW):', potenciaFinal, 'kW');
    
    return potenciaFinal;
    } catch (error) {
      console.error('❌ Erro ao calcular potência:', error);
      // Fallback para valores padrão em caso de erro
      const irradianciaMedia = 5.0;
      const eficienciaSistema = 0.80;
      const fatorCorrecao = 1.03;
      const potenciaNecessariaKw = (consumoMensalKwh / ((irradianciaMedia * eficienciaSistema) * 30.4)) * fatorCorrecao;
      const resultado = Math.ceil(potenciaNecessariaKw * 10) / 10;
      return Math.max(resultado, 3.0);
    }
  };

  const calcularCustoHomologacao = (potenciaKwp) => {
    if (potenciaKwp <= 5) return 465;
    if (potenciaKwp <= 10) return 565;
    if (potenciaKwp <= 20) return 765;
    if (potenciaKwp <= 50) return 865;
    if (potenciaKwp <= 75) return 1065;
    return 1265;
  };

  const calcularDimensionamento = async () => {
    setCalculando(true);
    
    let consumoKwh = 0;
    
    if (tipoConsumo === "mes_a_mes" && formData.consumo_mes_a_mes && formData.consumo_mes_a_mes.length > 0) {
      const totalAnual = formData.consumo_mes_a_mes.reduce((sum, item) => sum + (parseFloat(item.kwh) || 0), 0);
      consumoKwh = totalAnual / 12;
    } else if (formData.consumo_mensal_kwh) {
      consumoKwh = parseFloat(formData.consumo_mensal_kwh);
    } else if (formData.consumo_mensal_reais && formData.concessionaria) {
      const tarifaConfig = Object.values(configs).find(
        c => c.tipo === "tarifa" && c.concessionaria === formData.concessionaria
      );
      const tarifaKwh = tarifaConfig?.tarifa_kwh || 0.75;
      consumoKwh = parseFloat(formData.consumo_mensal_reais) / tarifaKwh;
    }

    const irradiacoes = await IrradiacaoSolar.list();
    const irradiacaoLocal = irradiacoes.find(
      i => i.cidade?.toLowerCase() === formData.cidade?.toLowerCase() && 
           i.estado?.toLowerCase() === formData.estado?.toLowerCase()
    );
    
    const irradiacaoMedia = irradiacaoLocal?.irradiacao_anual || 5.0;
    const eficienciaSistema = configs['eficiencia_sistema']?.eficiencia_sistema || 0.80;
    const potenciaPlaca = configs['potencia_placa']?.potencia_placa_padrao_w || 600;

    const geracaoAnual = consumoKwh * 12;
    const geracaoDiariaMedia = geracaoAnual / 365;
    const potenciaNecessariaKw = geracaoDiariaMedia / (irradiacaoMedia * eficienciaSistema);
    const potenciaSistemaKwp = potenciaNecessariaKw;
    const quantidadePlacas = Math.ceil((potenciaSistemaKwp * 1000) / potenciaPlaca);

    const custoInstalacao = quantidadePlacas * 200;
    const custoHomologacao = calcularCustoHomologacao(potenciaSistemaKwp);
    const custoCA = quantidadePlacas * 100;
    const custoPlaquinhas = 60;
    const custoObra = custoInstalacao * 0.1;

    const custoEquipamentos = 15000;

    const custoTotal = custoEquipamentos + custoInstalacao + custoHomologacao + 
                      custoCA + custoPlaquinhas + custoObra;

    const custoComComissao = custoTotal * (1 + formData.percentual_comissao / 100);
    const precoFinal = custoComComissao * (1 + formData.percentual_margem_lucro / 100);

    const tarifaConfig = Object.values(configs).find(
      c => c.tipo === "tarifa" && c.concessionaria === formData.concessionaria
    );
    const tarifaKwh = tarifaConfig?.tarifa_kwh || 0.75;
    const economiaMensal = consumoKwh * tarifaKwh * 0.95;
    const paybackMeses = Math.ceil(precoFinal / economiaMensal);

    const results = {
      potencia_sistema_kwp: potenciaSistemaKwp,
      quantidade_placas: quantidadePlacas,
      potencia_placa_w: potenciaPlaca,
      custo_equipamentos: custoEquipamentos,
      custo_instalacao: custoInstalacao,
      custo_homologacao: custoHomologacao,
      custo_ca: custoCA,
      custo_plaquinhas: custoPlaquinhas,
      custo_obra: custoObra,
      custo_total: custoTotal,
      preco_final: precoFinal,
      economia_mensal_estimada: economiaMensal,
      payback_meses: paybackMeses,
      irradiacao_media: irradiacaoMedia,
      consumo_mensal_kwh: consumoKwh
    };

    setResultados(results);
    setFormData(prev => ({ ...prev, ...results }));
    setCalculando(false);
    setActiveTab("resultados");
  };

  const handleSave = async () => {
    setLoading(true);
    
    const urlParams = new URLSearchParams(window.location.search);
    const projetoId = urlParams.get('projeto_id');
    
    if (projetoId) {
      await Projeto.update(projetoId, formData);
    } else {
      await Projeto.create(formData);
    }
    
    setLoading(false);
    navigate(createPageUrl("Projetos"));
  };

  const concessionarias = Object.values(configs)
    .filter(c => c.tipo === "tarifa")
    .map(c => c.concessionaria);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="w-full space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Link to={createPageUrl("Projetos")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-600 to-orange-500 bg-clip-text text-transparent">
              Novo Projeto
            </h1>
            <p className="text-gray-600 mt-2">Dimensione e crie uma proposta personalizada</p>
          </div>
        </motion.div>

        <Card className="glass-card border-0 shadow-2xl">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="basico">Dados Básicos</TabsTrigger>
                <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
                <TabsTrigger value="custos">Custos</TabsTrigger>
                <TabsTrigger value="resultados" disabled={!resultados}>Resultados</TabsTrigger>
              </TabsList>

              <TabsContent value="basico" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Cliente *</Label>
                    <Select value={formData.cliente_id} onValueChange={(v) => handleChange("cliente_id", v)}>
                      <SelectTrigger className="bg-white/50 border-sky-200">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map(cliente => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Nome do Projeto *</Label>
                    <Input
                      value={formData.nome_projeto}
                      onChange={(e) => handleChange("nome_projeto", e.target.value)}
                      placeholder="Ex: Sistema Residencial 10kWp"
                      className="bg-white/50 border-sky-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>CEP *</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.cep}
                        onChange={(e) => handleChange("cep", e.target.value)}
                        placeholder="00000-000"
                        className="bg-white/50 border-sky-200"
                      />
                      <Button type="button" onClick={buscarCEP} disabled={loading} className="flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Buscar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Logradouro</Label>
                    <Input
                      value={formData.logradouro}
                      onChange={(e) => handleChange("logradouro", e.target.value)}
                      placeholder="Rua, Avenida, etc."
                      className="bg-white/50 border-sky-200"
                      readOnly={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={formData.numero}
                      onChange={(e) => handleChange("numero", e.target.value)}
                      placeholder="123"
                      className="bg-white/50 border-sky-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      value={formData.complemento}
                      onChange={(e) => handleChange("complemento", e.target.value)}
                      placeholder="Apto, Casa, etc."
                      className="bg-white/50 border-sky-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={formData.bairro}
                      onChange={(e) => handleChange("bairro", e.target.value)}
                      className="bg-white/50 border-sky-200"
                      readOnly={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Telhado *</Label>
                    <Select value={formData.tipo_telhado} onValueChange={(v) => handleChange("tipo_telhado", v)}>
                      <SelectTrigger className="bg-white/50 border-sky-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ceramico">Cerâmico</SelectItem>
                        <SelectItem value="metalico">Metálico</SelectItem>
                        <SelectItem value="fibrocimento">Fibrocimento</SelectItem>
                        <SelectItem value="laje">Laje</SelectItem>
                        <SelectItem value="solo">Solo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tensão *</Label>
                    <Select value={formData.tensao} onValueChange={(v) => handleChange("tensao", v)}>
                      <SelectTrigger className="bg-white/50 border-sky-200">
                        <SelectValue placeholder="Selecione a tensão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="220">220V</SelectItem>
                        <SelectItem value="380">380V</SelectItem>
                        <SelectItem value="+380">+380V</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.cidade}
                      onChange={(e) => handleChange("cidade", e.target.value)}
                      className="bg-white/50 border-sky-200"
                      readOnly={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Estado (UF)</Label>
                    <Input
                      value={formData.estado}
                      onChange={(e) => handleChange("estado", e.target.value)}
                      className="bg-white/50 border-sky-200"
                      maxLength={2}
                      readOnly={loading}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Endereço Completo</Label>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">
                          {formData.endereco_completo || 'Preencha o CEP para ver o endereço completo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Concessionária *</Label>
                    <Select value={formData.concessionaria} onValueChange={(v) => handleChange("concessionaria", v)}>
                      <SelectTrigger className="bg-white/50 border-sky-200">
                        <SelectValue placeholder="Selecione a concessionária" />
                      </SelectTrigger>
                      <SelectContent>
                        {concessionarias.map(conc => (
                          <SelectItem key={conc} value={conc}>{conc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-700">Informações de Consumo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup value={tipoConsumo} onValueChange={setTipoConsumo}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="medio" id="medio" />
                        <Label htmlFor="medio">Valor médio mensal (R$ ou kWh)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mes_a_mes" id="mes_a_mes" />
                        <Label htmlFor="mes_a_mes">Consumo mês a mês (kWh)</Label>
                      </div>
                    </RadioGroup>

                    {tipoConsumo === "medio" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label>Consumo Mensal (R$)</Label>
                          <Input
                            type="number"
                            value={formData.consumo_mensal_reais}
                            onChange={(e) => handleChange("consumo_mensal_reais", e.target.value)}
                            placeholder="Valor da conta de luz"
                            className="bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>OU Consumo Mensal (kWh)</Label>
                          <Input
                            type="number"
                            value={formData.consumo_mensal_kwh}
                            onChange={(e) => handleChange("consumo_mensal_kwh", e.target.value)}
                            placeholder="Consumo médio em kWh"
                            className="bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {tipoConsumo === "mes_a_mes" && (
                      <ConsumoMesAMes
                        consumos={formData.consumo_mes_a_mes}
                        onChange={(consumos) => handleChange("consumo_mes_a_mes", consumos)}
                      />
                    )}
                  </CardContent>
                </Card>


                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    onClick={buscarProdutosDisponiveis}
                    disabled={loadingProdutos || !temConsumoPreenchido()}
                    variant="outline"
                    className="border-sky-200 text-sky-600 hover:bg-sky-50"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    {loadingProdutos ? "Buscando..." : "Buscar Equipamentos"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="equipamentos" className="space-y-6">
                {loadingProdutos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                    <span className="ml-2 text-gray-600">Buscando kits disponíveis...</span>
                  </div>
                ) : produtosDisponiveis.length === 0 && todosOsKits.length === 0 ? (
                  <div className="text-center py-8">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Clique em "Buscar Equipamentos" para ver os kits disponíveis</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Kits Solares Disponíveis</h3>
                        <p className="text-sm text-gray-600">Selecione um kit completo para o projeto</p>
                      </div>
                      <div className="flex gap-2">
                      <Badge variant="outline" className="text-sky-600 border-sky-200">
                          {produtosDisponiveis.length} kits filtrados
                      </Badge>
                        {todosOsKits.length > 0 && (
                          <Badge variant="secondary" className="text-gray-600">
                            {todosOsKits.length} total disponível
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Filtros */}
                    {filtrosDisponiveis.marcasPaineis.length > 0 && (
                      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-700">Filtros Disponíveis</h4>
                          {temFiltrosAtivos() && (
                            <Button
                              onClick={limparTodosFiltros}
                              variant="outline"
                              size="sm"
                              className="text-xs h-6 px-2"
                            >
                              Limpar Filtros
                            </Button>
                          )}
                          </div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          {/* Filtro por Marca de Painel */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Marca do Painel
                            </label>
                            <Select
                              value={filtrosSelecionados.marcaPainel || ""}
                              onValueChange={(value) => aplicarFiltrosTempoReal({
                                marcaPainel: value === "todos" ? null : value
                              })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Todas as marcas" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todos">Todas as marcas</SelectItem>
                                {filtrosDisponiveis.marcasPaineis.map((marca) => (
                                  <SelectItem key={marca.idMarca} value={marca.idMarca.toString()}>
                                    {marca.descricao}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                              </div>

                          {/* Filtro por Marca de Inversor */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Marca do Inversor
                            </label>
                            <Select
                              value={filtrosSelecionados.marcaInversor || ""}
                              onValueChange={(value) => aplicarFiltrosTempoReal({
                                marcaInversor: value === "todos" ? null : value
                              })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Todas as marcas" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todos">Todas as marcas</SelectItem>
                                {filtrosDisponiveis.marcasInversores.map((marca) => (
                                  <SelectItem key={marca.idMarca} value={marca.idMarca.toString()}>
                                    {marca.descricao}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                              </div>

                          {/* Filtro por Potência do Painel */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Potência do Painel
                            </label>
                            <Select
                              value={filtrosSelecionados.potenciaPainel || ""}
                              onValueChange={(value) => aplicarFiltrosTempoReal({
                                potenciaPainel: value === "todas" ? null : value
                              })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Todas as potências" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todas">Todas as potências</SelectItem>
                                {filtrosDisponiveis.potenciasPaineis.map((potencia) => (
                                  <SelectItem key={potencia.potencia} value={potencia.potencia.toString()}>
                                    {potencia.potencia}W
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                        </div>

                          {/* Filtro por Tipo de Inversor */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Tipo de Inversor
                            </label>
                            <Select
                              value={filtrosSelecionados.tipoInversor || ""}
                              onValueChange={(value) => aplicarFiltrosTempoReal({
                                tipoInversor: value === "todos" ? null : value
                              })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Todos os tipos" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todos">Todos os tipos</SelectItem>
                                <SelectItem value="micro">Micro Inversor</SelectItem>
                                <SelectItem value="string">String Inversor</SelectItem>
                                <SelectItem value="hibrido">Híbrido</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Filtro por Ordenação */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Ordenar por Preço
                            </label>
                            <Select
                              value={filtrosSelecionados.ordenacao || ""}
                              onValueChange={(value) => aplicarFiltrosTempoReal({
                                ordenacao: value === "padrao" ? null : value
                              })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Ordenação padrão" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="padrao">Ordenação padrão</SelectItem>
                                <SelectItem value="preco_menor_maior">Menor para Maior</SelectItem>
                                <SelectItem value="preco_maior_menor">Maior para Menor</SelectItem>
                              </SelectContent>
                            </Select>
                              </div>
                            </div>
                        </div>
                    )}

                    {/* Seletor de Kits */}
                    {produtosDisponiveis.length === 0 && todosOsKits.length > 0 ? (
                      <div className="text-center py-8">
                        <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum kit encontrado</h3>
                        <p className="text-gray-600 mb-4">
                          Não há kits que correspondam aos filtros selecionados.
                        </p>
                        <Button
                          onClick={limparTodosFiltros}
                          variant="outline"
                          className="border-sky-200 text-sky-600 hover:bg-sky-50"
                        >
                          Limpar Filtros
                        </Button>
                          </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {produtosDisponiveis.map((kit) => (
                        <Card 
                          key={kit.id}
                          className={`cursor-pointer transition-all ${
                            kitSelecionado?.id === kit.id
                              ? 'border-blue-500 bg-blue-50 shadow-lg'
                              : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }`}
                          onClick={() => setKitSelecionado(kit)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{kit.nome}</CardTitle>
                              {kitSelecionado?.id === kit.id && (
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Check className="w-4 h-4 text-white" />
                              </div>
                              )}
                              </div>
                            {/* Fotos do Painel e Inversor */}
                            {(kit.fotoPainel || kit.fotoInversor) && (
                              <div className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden relative">
                                {/* Foto do Painel - fundo completo */}
                                {kit.fotoPainel && (
                                  <img 
                                    src={kit.fotoPainel} 
                                    alt="Painel Solar"
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                
                                {/* Foto do Inversor - sobreposta no canto inferior direito */}
                                {kit.fotoInversor && (
                                  <div className="absolute bottom-2 right-4 w-28">
                                    <img 
                                      src={kit.fotoInversor} 
                                      alt="Inversor"
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                )}
                                
                                {/* Label do Painel */}
                                {kit.fotoPainel && (
                                  <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                                    Painel
                                  </div>
                                )}
                                
                                {/* Label do Inversor */}
                                {kit.fotoInversor && (
                                  <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                                    Inversor
                                  </div>
                                )}
                                
                                {/* Fallback se não tiver foto do painel */}
                                {!kit.fotoPainel && kit.fotoInversor && (
                                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <span className="text-gray-500 text-sm">Sem foto do painel</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Potência:</span>
                              <span className="font-semibold">{kit.potencia}kW</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Área:</span>
                              <span className="font-semibold">{kit.area}m²</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Preço Total:</span>
                              <span className="font-bold text-green-600">{formatCurrency(kit.precoTotal)}</span>
                            </div>
                            {kit.disponibilidade && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Disponível:</span>
                                <span className="text-sm text-orange-600">
                                  {new Date(kit.disponibilidade).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            )}
                            
                            {/* Componentes do Kit */}
                            <div className="pt-3 border-t">
                              <p className="text-sm font-medium text-gray-700 mb-2">Componentes:</p>
                              <div className="space-y-1">
                                {kit.componentes.map((componente, index) => (
                                  <div key={index} className="flex justify-between text-xs">
                                    <span className="text-gray-600">
                                      {componente.agrupamento}: {componente.descricao}
                                    </span>
                                    <span className="text-gray-500">x{componente.quantidade}</span>
                            </div>
                          ))}
                              </div>
                        </div>
                      </CardContent>
                    </Card>
                      ))}
                    </div>
                    )}

                    {/* Botão flutuante para avançar para a aba de custos */}
                    {produtosDisponiveis.length > 0 && (
                      <div className="fixed bottom-6 right-6 z-50">
                        <Button 
                          onClick={() => setActiveTab('custos')}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-300 rounded-full"
                        >
                          Avançar para Custos
                        </Button>
                      </div>
                    )}

                    {/* Resumo da Montagem do Kit */}
                    {(produtosSelecionados.paineis || produtosSelecionados.inversores || produtosSelecionados.estruturas) && (
                      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                        <CardHeader>
                          <CardTitle className="text-blue-700">Kit Montado pelo Vendedor</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">Equipamentos Selecionados:</h4>
                              <div className="space-y-1 text-sm">
                                {(() => {
                                  return (
                                    <>
                                      {produtosSelecionados.paineis && (
                                        <div>
                                          <p className="font-medium">• {produtosSelecionados.paineis.descricao} - {produtosSelecionados.paineis.modelo}</p>
                                          <p className="text-xs text-gray-500 ml-2">
                                            Quantidade: {quantidadesCalculadas.paineis} módulos
                                          </p>
                                          <p className="text-xs text-gray-500 ml-2">
                                            Potência total: {quantidadesCalculadas.potenciaTotal?.toFixed(1) || '0.0'} kW
                                          </p>
                                        </div>
                                      )}
                                      {produtosSelecionados.inversores && (
                                        <div>
                                          <p className="font-medium">• {produtosSelecionados.inversores.descricao} - {produtosSelecionados.inversores.modelo}</p>
                                          <p className="text-xs text-gray-500 ml-2">
                                            Quantidade: {quantidadesCalculadas.inversores} inversor(es)
                                          </p>
                                        </div>
                                      )}
                                      {produtosSelecionados.estruturas && (
                                        <div>
                                          <p className="font-medium">• {produtosSelecionados.estruturas.descricao} - {produtosSelecionados.estruturas.modelo}</p>
                                          <p className="text-xs text-gray-500 ml-2">
                                            Quantidade: {quantidadesCalculadas.estruturas} estruturas
                                          </p>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="text-right">
                              <Button
                                onClick={async () => {
                                  console.log('Botão Ver Custos clicado');
                                  await atualizarCustosComProdutosSelecionados();
                                  setActiveTab('custos');
                                }}
                                disabled={!produtosSelecionados.paineis || !produtosSelecionados.inversores}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Ver Custos Atualizados
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custos" className="space-y-6">
                {(() => {
                  console.log('Renderizando aba de custos:', {
                    costsLoading,
                    costsError,
                    costs,
                    apiAvailable,
                    temConsumoPreenchido: temConsumoPreenchido(),
                    produtosSelecionados: {
                      paineis: !!produtosSelecionados.paineis,
                      inversores: !!produtosSelecionados.inversores
                    }
                  });
                  return null;
                })()}
                {costsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                    <span className="ml-2 text-gray-600">Calculando custos...</span>
                  </div>
                ) : costsError ? (
                  <div className="text-center py-8">
                    <div className="text-red-500 mb-2">⚠️ Erro ao buscar custos</div>
                    <p className="text-gray-600">{costsError}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {apiAvailable ? 'Usando dados da API Solaryum' : 'Usando dados estimados'}
                    </p>
                  </div>
                ) : costs ? (
                  <div className="space-y-6">
                    {/* Status da API */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {apiAvailable ? (
                          <>
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-700">API Solaryum conectada</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-yellow-700">Usando dados estimados</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Potência: {formData.potencia_kw || 0} kW
                      </div>
                    </div>

                    {/* Resumo de Custos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-green-200 bg-green-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            Custos do Projeto
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Equipamentos:</span>
                            <span className="font-semibold">{formatCurrency(costs.total.equipamentos)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Instalação:</span>
                            <span className="font-semibold">{formatCurrency(costs.total.instalacao)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold">{formatCurrency(costs.total.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Impostos (18%):</span>
                            <span className="font-semibold">{formatCurrency(costs.total.impostos)}</span>
                          </div>
                          <hr className="border-gray-300" />
                          <div className="flex justify-between text-lg font-bold text-green-700">
                            <span>Total:</span>
                            <span>{formatCurrency(costs.total.total)}</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-blue-200 bg-blue-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            Economia Estimada
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {(() => {
                            const savings = calculateMonthlySavings(costs.total.total, parseFloat(formData.consumo_mensal_kwh) || 0);
                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Economia Mensal:</span>
                                  <span className="font-semibold text-green-600">{formatCurrency(savings?.economiaMensal || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Economia Anual:</span>
                                  <span className="font-semibold text-green-600">{formatCurrency(savings?.economiaAnual || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Payback:</span>
                                  <span className="font-semibold">{(savings?.paybackAnos || 0).toFixed(1)} anos</span>
                                </div>
                              </>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detalhamento de Equipamentos */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Detalhamento de Equipamentos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700">Painéis Solares</h4>
                            <div className="text-sm text-gray-600">
                              <p>Quantidade: {costs.equipamentos.paineis?.quantidade || 0}</p>
                              <p>Preço unitário: {formatCurrency(costs.equipamentos.paineis?.preco_unitario || 0)}</p>
                              <p className="font-semibold">Total: {formatCurrency(costs.equipamentos.paineis?.total || 0)}</p>
                              {costs.equipamentos.paineis?.produto && (
                                <p className="text-xs text-blue-600 mt-1">
                                  {costs.equipamentos.paineis.produto.descricao} - {costs.equipamentos.paineis.produto.modelo}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700">Inversores</h4>
                            <div className="text-sm text-gray-600">
                              <p>Quantidade: {costs.equipamentos.inversores?.quantidade || 0}</p>
                              <p>Preço unitário: {formatCurrency(costs.equipamentos.inversores?.preco_unitario || 0)}</p>
                              <p className="font-semibold">Total: {formatCurrency(costs.equipamentos.inversores?.total || 0)}</p>
                              {costs.equipamentos.inversores?.produto && (
                                <p className="text-xs text-blue-600 mt-1">
                                  {costs.equipamentos.inversores.produto.descricao} - {costs.equipamentos.inversores.produto.modelo}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700">Estruturas</h4>
                            <div className="text-sm text-gray-600">
                              <p>Quantidade: {costs.equipamentos.estruturas?.quantidade || 0}</p>
                              <p>Preço unitário: {formatCurrency(costs.equipamentos.estruturas?.preco_unitario || 0)}</p>
                              <p className="font-semibold">Total: {formatCurrency(costs.equipamentos.estruturas?.total || 0)}</p>
                              {costs.equipamentos.estruturas?.produto && (
                                <p className="text-xs text-blue-600 mt-1">
                                  {costs.equipamentos.estruturas.produto.descricao} - {costs.equipamentos.estruturas.produto.modelo}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700">Outros Equipamentos</h4>
                            <div className="text-sm text-gray-600">
                              <p className="font-semibold">Total: {formatCurrency(costs.equipamentos.outros?.total || 0)}</p>
                              {costs.equipamentos.outros?.produtos && costs.equipamentos.outros.produtos.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {costs.equipamentos.outros.produtos.map((produto, index) => (
                                    <p key={index} className="text-xs text-blue-600">
                                      {produto.descricao} - {formatCurrency(produto.precoVenda)}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Detalhamento de Instalação */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Detalhamento de Instalação</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700">Mão de Obra</h4>
                            <div className="text-sm text-gray-600">
                              <p>Dias: {costs.instalacao.mao_obra?.dias || 0}</p>
                              <p>Valor por dia: {formatCurrency(costs.instalacao.mao_obra?.valor_dia || 0)}</p>
                              <p className="font-semibold">Total: {formatCurrency(costs.instalacao.mao_obra?.total || 0)}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700">Equipamentos de Instalação</h4>
                            <div className="text-sm text-gray-600">
                              <p className="font-semibold">Total: {formatCurrency(costs.instalacao.equipamentos_instalacao?.total || 0)}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700">Transporte</h4>
                            <div className="text-sm text-gray-600">
                              <p className="font-semibold">Total: {formatCurrency(costs.instalacao.transporte?.total || 0)}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700">Outros</h4>
                            <div className="text-sm text-gray-600">
                              <p className="font-semibold">Total: {formatCurrency(costs.instalacao.outros?.total || 0)}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : kitSelecionado ? (
                  <div className="space-y-6">
                    {/* Kit Selecionado */}
                    <Card className="border-blue-200 bg-blue-50">
                      <CardHeader>
                        <CardTitle className="text-blue-700 flex items-center gap-2">
                          <Check className="w-5 h-5" />
                          Kit Selecionado
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">{kitSelecionado.nome}</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Potência:</span>
                                <span className="font-semibold">{kitSelecionado.potencia}kW</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Área:</span>
                                <span className="font-semibold">{kitSelecionado.area}m²</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Preço do Kit:</span>
                                <span className="font-bold text-green-600">{formatCurrency(kitSelecionado.precoTotal)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-semibold text-gray-700 mb-2">Componentes:</h5>
                            <div className="space-y-1 text-sm">
                              {kitSelecionado.componentes.map((componente, index) => (
                                <div key={index} className="flex justify-between">
                                  <span className="text-gray-600">
                                    {componente.agrupamento}: {componente.descricao}
                                  </span>
                                  <span className="text-gray-500">x{componente.quantidade}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Cálculo de Custos do Kit */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-green-200 bg-green-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            Custos do Projeto
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Equipamentos:</span>
                            <span className="font-semibold">{formatCurrency(kitSelecionado.precoTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Instalação:</span>
                            <span className="font-semibold">{formatCurrency(kitSelecionado.precoTotal * 0.15)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold">{formatCurrency(kitSelecionado.precoTotal * 1.15)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Impostos (18%):</span>
                            <span className="font-semibold">{formatCurrency(kitSelecionado.precoTotal * 1.15 * 0.18)}</span>
                          </div>
                          <hr className="border-gray-300" />
                          <div className="flex justify-between text-lg font-bold text-green-700">
                            <span>Total:</span>
                            <span>{formatCurrency(kitSelecionado.precoTotal * 1.15 * 1.18)}</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-blue-200 bg-blue-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            Economia Estimada
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {(() => {
                            const totalProjeto = kitSelecionado.precoTotal * 1.15 * 1.18;
                            const consumoMensal = parseFloat(formData.consumo_mensal_kwh) || 0;
                            const tarifaKwh = 0.75; // Tarifa média
                            const economiaMensal = consumoMensal * tarifaKwh * 0.95;
                            const economiaAnual = economiaMensal * 12;
                            const paybackAnos = totalProjeto / economiaAnual;
                            
                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Economia Mensal:</span>
                                  <span className="font-semibold text-green-600">{formatCurrency(economiaMensal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Economia Anual:</span>
                                  <span className="font-semibold text-green-600">{formatCurrency(economiaAnual)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Payback:</span>
                                  <span className="font-semibold">{paybackAnos.toFixed(1)} anos</span>
                                </div>
                              </>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detalhamento dos Componentes */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Detalhamento dos Componentes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {kitSelecionado.componentes.map((componente, index) => (
                            <div key={index} className="p-4 border rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-sm">{componente.descricao}</h4>
                                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                  {componente.agrupamento}
                                </span>
                              </div>
                              <div className="space-y-1 text-sm text-gray-600">
                                <p><strong>Marca:</strong> {componente.marca}</p>
                                <p><strong>Quantidade:</strong> {componente.quantidade}</p>
                                {componente.potencia && (
                                  <p><strong>Potência:</strong> {componente.potencia}W</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : temConsumoPreenchido() ? (
                  <div className="text-center py-8">
                    <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Selecione um kit para calcular os custos</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Preencha os dados básicos para calcular os custos</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="resultados">
                {resultados && (
                  <DimensionamentoResults 
                    resultados={resultados}
                    formData={formData}
                    onSave={handleSave}
                    loading={loading}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}