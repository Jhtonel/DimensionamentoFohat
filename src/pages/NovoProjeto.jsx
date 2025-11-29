import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { propostaService } from "../services/propostaService";
import { getIrradianciaByCity } from "../utils/irradianciaUtils";
import { useProjectCosts } from "../hooks/useProjectCosts";
import { buscarConcessionaria, calcularTarifaTotal } from "../data/concessionariasSP";

import DimensionamentoResults from "../components/projetos/DimensionamentoResults.jsx";
import ConsumoMesAMes from "../components/projetos/ConsumoMesAMes.jsx";
import CostsDetailed from "../components/projetos/CostsDetailed.jsx";
import { useAuth } from "@/services/authService.jsx";

export default function NovoProjeto() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [activeTab, setActiveTab] = useState("basico");
  const [autoGenerateProposta, setAutoGenerateProposta] = useState(false);
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

  // Cria um rascunho de projeto ao entrar na tela (se não existir)
  useEffect(() => {
    const ensureDraft = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const projetoId = urlParams.get('projeto_id');
      if (!projetoId) {
        try {
          const clienteNomeDraft = clientes.find(c => c.id === (formData?.cliente_id || ''))?.nome || formData?.cliente_nome || null;
          const draft = await Projeto.create({
            ...formData,
            status: 'rascunho',
            nome_projeto: formData?.nome_projeto || 'Novo Projeto',
            cliente_id: formData?.cliente_id || null,
            cliente_nome: clienteNomeDraft || undefined,
            descricao: 'Rascunho automático',
            created_by: user?.uid || null,
            vendedor_email: user?.email || null
          });
          const search = new URLSearchParams(window.location.search);
          search.set('projeto_id', draft.id);
          navigate(`${window.location.pathname}?${search.toString()}`, { replace: true });
        } catch (e) {
          console.warn('⚠️ Falha ao criar rascunho automático:', e);
        }
      }
    };
    // Só executa se tiver user carregado ou se user for null (não logado)
    if (user !== undefined) ensureDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save do rascunho a cada alteração do formulário (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const projetoId = urlParams.get('projeto_id');
        if (projetoId) {
          const clienteNome = clientes.find(c => c.id === (formData?.cliente_id || ''))?.nome || formData?.cliente_nome || null;
          await Projeto.update(projetoId, { ...formData, cliente_nome: clienteNome || undefined, status: 'rascunho' });
        }
      } catch (e) {
        console.warn('⚠️ Auto-save falhou:', e);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [formData]);

  const [resultados, setResultados] = useState(null);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);
  const [todosOsKits, setTodosOsKits] = useState([]); // Todos os kits recebidos da API
  const [kitsFiltrados, setKitsFiltrados] = useState([]); // Kits após aplicar filtros locais
  const [kitSelecionado, setKitSelecionado] = useState(null);
  const [kitSelecionadoJson, setKitSelecionadoJson] = useState(null);
  const [selecionandoKit, setSelecionandoKit] = useState(false);
  const [projecoesFinanceiras, setProjecoesFinanceiras] = useState(null);
  const [analiseMetrics, setAnaliseMetrics] = useState(null);
  const [irradianciaData, setIrradianciaData] = useState(null); // JSON completo do kit
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
  // Popup de progresso (Dados Básicos)
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Preparando...');

  useEffect(() => {
    loadData();
  }, []);

  // Calcula custos em tempo real quando os dados do formulário mudam
  useEffect(() => {
    const calculateCosts = async () => {
      console.log('🔄 useEffect calculateCosts executado');
      console.log('  - formData.potencia_kw:', formData.potencia_kw, typeof formData.potencia_kw);
      console.log('  - formData completo:', formData);
      
      if (formData.potencia_kw && formData.potencia_kw > 0) {
        console.log('✅ Potência válida, chamando calculateRealTimeCosts...');
        try {
          const resultado = await calculateRealTimeCosts(formData);
          console.log('📊 Resultado do calculateRealTimeCosts:', resultado);
        } catch (error) {
          console.error('❌ Erro no calculateRealTimeCosts:', error);
        }
      } else {
        console.log('❌ Potência inválida ou não definida');
      }
    };

    calculateCosts();
  }, [formData.potencia_kw, formData.tipo_instalacao, formData.regiao, formData.tipo_telhado, calculateRealTimeCosts]);

  // Buscar métricas financeiras no backend para alimentar a aba de Custos
  useEffect(() => {
    let timer;
    const run = async () => {
      try {
        // Tarifa válida
        let tarifaParaEnvio = (Number(formData?.tarifa_energia) > 0 && Number(formData?.tarifa_energia) <= 10)
          ? Number(formData.tarifa_energia)
          : 0;
        if ((!tarifaParaEnvio || tarifaParaEnvio <= 0 || tarifaParaEnvio > 10) && formData?.concessionaria) {
          try {
            const t = await Configuracao.getTarifaByConcessionaria(formData.concessionaria);
            if (t && t > 0 && t <= 10) {
              tarifaParaEnvio = t;
            }
          } catch (_) {}
        }
        // Sincronizar tarifa resolvida no form (mantém fonte única para outras abas)
        try {
          if (Number(formData?.tarifa_energia || 0) !== Number(tarifaParaEnvio || 0)) {
            setFormData(prev => ({ ...prev, tarifa_energia: tarifaParaEnvio || 0 }));
          }
        } catch (_) {}
        // Consumo kWh derivado se necessário
        let consumoKwhParaEnvio = Number(formData?.consumo_mensal_kwh) || 0;
        if ((consumoKwhParaEnvio <= 0) && Number(formData?.consumo_mensal_reais) > 0 && tarifaParaEnvio > 0) {
          consumoKwhParaEnvio = Number(formData.consumo_mensal_reais) / tarifaParaEnvio;
        }
        // Potência e preço de venda
        const potenciaKwp = Number(formData?.potencia_kw) || Number(kitSelecionado?.potencia) || 0;
        const quantidadePlacas = Number(quantidadesCalculadas?.paineis) || 0;
        const custoEquipamentos = kitSelecionado?.precoTotal || costs?.equipamentos?.total || 0;
        const custoOp = calcularCustoOperacional(quantidadePlacas, potenciaKwp, custoEquipamentos);
        const comissaoVendedor = Number(formData?.comissao_vendedor || 5);
        // Preço de venda deve refletir exatamente o mostrado na aba de custos
        const precoVenda = calcularPrecoVenda(custoOp.total, comissaoVendedor) || 0;
        // Preparar payload
        const payload = {
          consumo_mensal_kwh: consumoKwhParaEnvio || undefined,
          consumo_mensal_reais: Number(formData?.consumo_mensal_reais) || undefined,
          tarifa_energia: tarifaParaEnvio || 0,
          potencia_sistema: potenciaKwp,
          preco_venda: precoVenda,
          irradiacao_media: Number(formData?.irradiacao_media) || 5.15,
          irradiancia_mensal_kwh_m2_dia: formData?.irradiancia_mensal_kwh_m2_dia || undefined,
        };
        // Estratégia paralela para garantir KPIs do núcleo (com payback de fluxo):
        // - Preferimos SEMPRE as métricas do núcleo (pois centralizam regras)
        // - Também chamamos /analise/gerar-graficos quando possível
        const temConsumo = (consumoKwhParaEnvio > 0) || (Number(formData?.consumo_mensal_reais) > 0);
        let metrics = null;
        const promessas = [];
        if (precoVenda > 0 && temConsumo) {
          promessas.push(
            propostaService.calcularNucleo(payload).catch(() => null)
          );
        }
        if (precoVenda > 0 && temConsumo && tarifaParaEnvio > 0 && potenciaKwp > 0) {
          promessas.push(
            propostaService.gerarGraficos(payload).catch(() => null)
          );
        }
        const [nucleoResp, graficosResp] = await Promise.all(promessas);
        // 1) Núcleo
        if (nucleoResp?.success && nucleoResp?.resultado?.metrics) {
          metrics = nucleoResp.resultado.metrics;
        }
        // 2) Gráficos (apenas se núcleo não retornou)
        if (!metrics && graficosResp?.success) {
          metrics = graficosResp.metrics || null;
        }
        setAnaliseMetrics(metrics);
        // Sincronizar preço no formData para que a proposta use o mesmo valor exibido
        try {
          setFormData(prev => {
            const novo = { ...prev };
            if (Number(prev?.preco_venda || 0) !== Number(precoVenda)) {
              novo.preco_venda = precoVenda;
              novo.preco_final = precoVenda;
            }
            return novo;
          });
        } catch (_) {}
      } catch (e) {
        console.warn('⚠️ Falha ao obter métricas financeiras do backend:', e?.message || e);
        // Fallback seguro: calcular direto no núcleo, que não exige potência para KPIs básicos
        try {
          const nucleo = await propostaService.calcularNucleo({
            consumo_mensal_kwh: consumoKwhParaEnvio || undefined,
            consumo_mensal_reais: Number(formData?.consumo_mensal_reais) || undefined,
            tarifa_energia: tarifaParaEnvio || 0,
            potencia_sistema: potenciaKwp,
            preco_venda: precoVenda,
            irradiacao_media: Number(formData?.irradiacao_media) || 5.15,
            irradiancia_mensal_kwh_m2_dia: formData?.irradiancia_mensal_kwh_m2_dia || undefined,
          });
          if (nucleo?.success && nucleo?.resultado?.metrics) {
            setAnaliseMetrics(nucleo.resultado.metrics);
          } else {
            setAnaliseMetrics(null);
          }
        } catch (_) {
          setAnaliseMetrics(null);
        }
      }
    };
    // Debounce leve
    timer = setTimeout(run, 600);
    return () => clearTimeout(timer);
  }, [
    formData?.consumo_mensal_kwh,
    formData?.consumo_mensal_reais,
    formData?.tarifa_energia,
    formData?.potencia_kw,
    formData?.preco_venda,
    formData?.irradiacao_media,
    formData?.concessionaria,
    kitSelecionado,
    quantidadesCalculadas?.paineis,
    costs?.equipamentos?.total
  ]);

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
      // Regra global: mínimo de 4 placas
      try {
        const qtdPaineis = (kit.componentes || [])
          .filter(c => c.agrupamento === 'Painel')
          .reduce((acc, c) => acc + (Number(c.quantidade) || 0), 0);
        if (qtdPaineis < 4) return false;
      } catch (_) {}

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

    // Validação específica para consumo mês a mês: nenhum mês pode ficar em branco
    if (tipoConsumo === 'mes_a_mes') {
      const consumos = formData.consumo_mes_a_mes || [];
      const mesesEmBranco = consumos
        .map((c, i) => ({ i, vazio: c == null || c.kwh === '' || c.kwh == null }))
        .filter(x => x.vazio)
        .map(x => x.i + 1);
      if (mesesEmBranco.length > 0) {
        alert('Preencha todos os meses do consumo (kWh). Existem meses em branco.');
        return;
      }
    }

    // Valida se o CEP foi preenchido (necessário para obter o código IBGE)
    if (!formData.cep || !formData.ibge) {
      alert('Por favor, preencha o CEP e clique em "Buscar CEP" para obter o código IBGE necessário para a consulta de equipamentos.');
      return;
    }

    setLoadingProdutos(true);
    // Mostrar popup de progresso na aba Dados Básicos
    setProgressOpen(true);
    setProgressValue(5);
    setProgressLabel('Validando informações...');
    
    try {
      // Primeiro busca os filtros disponíveis
      console.log('🔍 Buscando filtros disponíveis...');
      setProgressValue(15);
      setProgressLabel('Carregando filtros de equipamentos...');
      const filtros = await solaryumApi.buscarFiltros();
      setFiltrosDisponiveis(filtros);
      
      console.log('📋 Filtros recebidos:', filtros);
      console.log('📊 Potências de painéis nos filtros:', filtros.potenciasPaineis);
      
      // Calcula a potência se ainda não foi calculada
      const margemAdicional = {
        percentual: parseFloat(formData.margem_adicional_percentual) || 0,
        kwh: parseFloat(formData.margem_adicional_kwh) || 0
      };
      // Se consumo mês a mês foi informado, calcula a média com margem
      let consumoParaCalculo = parseFloat(formData.consumo_mensal_kwh) || 0;
      if ((tipoConsumo === 'mes_a_mes') && Array.isArray(formData.consumo_mes_a_mes) && formData.consumo_mes_a_mes.length > 0) {
        const totalAnual = formData.consumo_mes_a_mes.reduce((sum, item) => sum + (parseFloat(item.kwh) || 0), 0);
        const mediaMensal = totalAnual / 12;
        consumoParaCalculo = margemAdicional.percentual > 0
          ? mediaMensal * (1 + margemAdicional.percentual / 100)
          : (margemAdicional.kwh > 0 ? mediaMensal + margemAdicional.kwh : mediaMensal);
      }
      // Se não houver kWh, mas houver consumo em R$, converter usando a tarifa
      if (consumoParaCalculo <= 0) {
        const consumoReais = parseFloat(formData.consumo_mensal_reais) || 0;
        if (consumoReais > 0) {
          let tarifa = parseFloat(formData.tarifa_energia) || 0;
          if ((!tarifa || tarifa <= 0 || tarifa > 10) && formData?.concessionaria) {
            try {
              const t = await Configuracao.getTarifaByConcessionaria(formData.concessionaria);
              if (t && t > 0 && t <= 10) tarifa = t;
            } catch (_) {}
          }
          if (tarifa > 0) {
            consumoParaCalculo = consumoReais / tarifa;
          }
        }
      }

      setProgressValue(35);
      setProgressLabel('Calculando potência do sistema...');
      let potenciaCalculada = formData.potencia_kw || await calcularPotenciaSistema(consumoParaCalculo, formData.cidade, margemAdicional);
      
      console.log('🔍 Debug da potência:');
      console.log('  - formData.potencia_kw:', formData.potencia_kw, typeof formData.potencia_kw);
      console.log('  - potenciaCalculada:', potenciaCalculada, typeof potenciaCalculada);
      console.log('  - Consumo mensal:', formData.consumo_mensal_kwh);
      console.log('  - Cidade:', formData.cidade);
      console.log('  - Margem adicional:', margemAdicional);
      
      // Força recálculo se potenciaCalculada for muito baixa
      if (potenciaCalculada < 1.0) {
        console.warn('⚠️ Potência muito baixa, forçando recálculo...');
        potenciaCalculada = await calcularPotenciaSistema(consumoParaCalculo, formData.cidade, margemAdicional);
        console.log('🔍 Potência recalculada:', potenciaCalculada);
      }
      
      // Garante potência válida para evitar erro na API
      if (!potenciaCalculada || potenciaCalculada <= 0) {
        potenciaCalculada = 1.0; // Potência mínima reduzida para 1kW
        console.log('⚠️ Potência inválida, usando padrão de 1kW');
      }

      // Prepara dados base para montagem dos kits
      console.log('🔢 Potência calculada para dadosBase:', potenciaCalculada, typeof potenciaCalculada);
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

      // Dispara uma chamada inicial ao MontarKits para garantir requisição visível
      const todosOsKits = [];
      try {
        setProgressValue(45);
        setProgressLabel('Buscando kits iniciais...');
        console.log('🚀 Disparando chamada inicial MontarKits (tipoInv=0)...');
        const kitInicial = await solaryumApi.montarKitCustomizado({ ...dadosBase, tipoInv: '0' });
        if (Array.isArray(kitInicial) && kitInicial.length > 0) {
          todosOsKits.push(...kitInicial);
          console.log(`✅ Chamada inicial retornou ${kitInicial.length} kits`);
        } else {
          console.log('⚠️ Chamada inicial retornou vazia');
        }
      } catch (e) {
        console.warn('⚠️ Falha na chamada inicial MontarKits:', e);
      }

      // Busca kits para cada potência de painel E cada tipo de inversor
      const todasPotencias = Array.isArray(filtros.potenciasPaineis) ? filtros.potenciasPaineis : [];
      const tiposInversor = [0, 1, 2]; // Tipos de inversor: 0, 1, 2
      
      console.log('⚡ Potências de painéis encontradas:', todasPotencias);
      console.log('🔌 Tipos de inversor a buscar:', tiposInversor);
      
      // Se não há potências específicas, faz uma busca geral para cada tipo de inversor
      if (!Array.isArray(todasPotencias) || todasPotencias.length === 0) {
        console.log('⚠️ Nenhuma potência específica encontrada, fazendo busca geral para cada tipo de inversor...');
        
        // Cria todas as requisições em paralelo com progresso granular (60% → 85%)
        const startPct = 60;
        const endPct = 85;
        const totalReq = tiposInversor.length;
        let doneReq = 0;
        const updateBatchProgress = () => {
          const pct = startPct + (doneReq / Math.max(1, totalReq)) * (endPct - startPct);
          setProgressValue(pct);
          setProgressLabel(`Buscando kits (combinações de inversores) ${doneReq}/${totalReq}...`);
        };
        updateBatchProgress();
        const requisicoes = tiposInversor.map(async (tipoInv) => {
          console.log(`🔍 Preparando requisição para tipo de inversor ${tipoInv}...`);
          
          const dadosComTipoInv = {
            ...dadosBase,
            tipoInv: tipoInv.toString()
          };
          
          try {
            const kitCustomizado = await solaryumApi.montarKitCustomizado(dadosComTipoInv);
            console.log(`✅ Encontrados ${Array.isArray(kitCustomizado) ? kitCustomizado.length : 0} kits para tipo de inversor ${tipoInv}`);
            doneReq += 1;
            updateBatchProgress();
            return Array.isArray(kitCustomizado) ? kitCustomizado : [];
          } catch (error) {
            console.error(`❌ Erro ao buscar kits para tipo de inversor ${tipoInv}:`, error);
            doneReq += 1;
            updateBatchProgress();
            return [];
          }
        });
        
        // Executa todas as requisições em paralelo
        setProgressValue(60);
        setProgressLabel('Buscando kits (combinações de inversores)...');
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
        setProgressValue(60);
        setProgressLabel('Buscando kits (todas as combinações)...');
        
        // Cria todas as requisições em paralelo com progresso granular (60% → 85%)
        const startPct = 60;
        const endPct = 85;
        const totalReq = (Array.isArray(todasPotencias) ? todasPotencias.length : 0) * tiposInversor.length;
        let doneReq = 0;
        const updateBatchProgress = () => {
          const pct = startPct + (doneReq / Math.max(1, totalReq)) * (endPct - startPct);
          setProgressValue(pct);
          setProgressLabel(`Buscando kits (todas as combinações) ${doneReq}/${totalReq}...`);
        };
        updateBatchProgress();
        const requisicoes = [];
        
        for (const potenciaInfo of (Array.isArray(todasPotencias) ? todasPotencias : [])) {
          const potenciaPainel = potenciaInfo.potencia;
          
          for (const tipoInv of tiposInversor) {
            console.log(`🔍 Preparando requisição para ${potenciaPainel}W + tipo ${tipoInv}...`);
            console.log(`📊 Valor original da potência:`, potenciaPainel, typeof potenciaPainel);
            
            const dadosComFiltros = {
              ...dadosBase,
              potenciaPainel: parseFloat(potenciaPainel),
              tipoInv: tipoInv.toString()
            };
            
            console.log(`📤 Dados enviados para API:`, dadosComFiltros);
            
            requisicoes.push(
              solaryumApi.montarKitCustomizado(dadosComFiltros)
                .then(kitCustomizado => {
                  const kits = Array.isArray(kitCustomizado) ? kitCustomizado : [];
                  console.log(`✅ Encontrados ${kits.length} kits para ${potenciaPainel}W + tipo ${tipoInv}`);
                  doneReq += 1;
                  updateBatchProgress();
                  return { potenciaPainel, tipoInv, kits };
                })
                .catch(error => {
                  console.error(`❌ Erro ao buscar kits para ${potenciaPainel}W + tipo ${tipoInv}:`, error);
                  doneReq += 1;
                  updateBatchProgress();
                  return { potenciaPainel, tipoInv, kits: [] };
                })
            );
          }
        }
        
        // Executa todas as requisições em paralelo
        console.log(`🚀 Executando ${requisicoes.length} requisições em paralelo...`);
        setProgressValue(70);
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
        setProgressValue(85);
        setProgressLabel('Processando kits encontrados...');
        
        // Processa cada kit como uma opção completa
        todosOsKits.forEach((kit, index) => {
          // Função para gerar o título do kit no novo formato
          const gerarTituloKit = (composicao) => {
            if (!composicao || !Array.isArray(composicao)) return `Kit Solar ${kit.potencia}kWp`;
            
            let marcaPainel = '';
            let marcaInversor = '';
            
            composicao.forEach(componente => {
              if (componente.agrupamento === 'Painel') {
                marcaPainel = componente.marca || 'N/A';
              }
              if (componente.agrupamento === 'Inversor') {
                marcaInversor = componente.marca || 'N/A';
              }
            });
            
            if (marcaPainel && marcaInversor) {
              return `Kit Solar ${kit.potencia}kWp: ${marcaPainel} - ${marcaInversor}`;
            } else if (marcaPainel) {
              return `Kit Solar ${kit.potencia}kWp: ${marcaPainel}`;
            } else if (marcaInversor) {
              return `Kit Solar ${kit.potencia}kWp: ${marcaInversor}`;
            }
            
            return `Kit Solar ${kit.potencia}kWp`;
          };

          const kitProcessado = {
            id: kit.idProduto || `kit-${index}`,
            nome: gerarTituloKit(kit.composicao),
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
      setProgressValue(100);
      setProgressLabel('Concluído!');
      setTimeout(() => setProgressOpen(false), 500);
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
      // Se ocorrer erro, garantir fechar popup
      setTimeout(() => setProgressOpen(false), 300);
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
      const margemAdicional = {
        percentual: parseFloat(formData.margem_adicional_percentual) || 0,
        kwh: parseFloat(formData.margem_adicional_kwh) || 0
      };
      const potenciaCalculada = formData.potencia_kw || await calcularPotenciaSistema(formData.consumo_mensal_kwh, formData.cidade, margemAdicional);
      console.log('🔍 Debug calculateRealTimeCosts:');
      console.log('  - formData.potencia_kw:', formData.potencia_kw, typeof formData.potencia_kw);
      console.log('  - potenciaCalculada:', potenciaCalculada, typeof potenciaCalculada);
      
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
      // Derivar consumo mensal em kWh: prioriza kWh; se zerado, converte R$ -> kWh usando tarifa
      let consumoMensal = parseFloat(formData.consumo_mensal_kwh) || 0;
      if (consumoMensal <= 0) {
        const consumoReais = parseFloat(formData.consumo_mensal_reais) || 0;
        if (consumoReais > 0) {
          let tarifa = parseFloat(formData.tarifa_energia) || 0;
          if ((!tarifa || tarifa <= 0 || tarifa > 10) && formData?.concessionaria) {
            try {
              const t = await Configuracao.getTarifaByConcessionaria(formData.concessionaria);
              if (t && t > 0 && t <= 10) tarifa = t;
            } catch (_) {}
          }
          if (tarifa > 0) {
            consumoMensal = consumoReais / tarifa;
          }
        }
      }
      const cidade = formData.cidade || 'São José dos Campos';
      
      // Calcula sempre que houver consumo válido
      if (consumoMensal > 0) {
        try {
          console.log('🔄 Calculando potência automaticamente...');
          const margemAdicional = {
            percentual: parseFloat(formData.margem_adicional_percentual) || 0,
            kwh: parseFloat(formData.margem_adicional_kwh) || 0
          };
          const potenciaCalculada = await calcularPotenciaSistema(consumoMensal, cidade, margemAdicional);
          console.log('🔄 Potência calculada automaticamente:', potenciaCalculada, typeof potenciaCalculada);
          console.log('🔄 Valor atual do formData.potencia_kw:', formData.potencia_kw, typeof formData.potencia_kw);
      if (potenciaCalculada !== formData.potencia_kw) {
        console.log('🔄 Atualizando formData.potencia_kw de', formData.potencia_kw, 'para', potenciaCalculada);
        handleChange("potencia_kw", potenciaCalculada);
      } else {
        console.log('🔄 Potência já está atualizada, não precisa alterar');
      }
        } catch (error) {
          console.error('❌ Erro ao calcular potência automaticamente:', error);
        }
      }
    };

    // Debounce para evitar múltiplas chamadas
    const timeoutId = setTimeout(calcularPotenciaAutomatica, 500);
    
    return () => clearTimeout(timeoutId);
  }, [formData.consumo_mensal_kwh, formData.consumo_mensal_reais, formData.tarifa_energia, formData.concessionaria, formData.cidade, formData.margem_adicional_percentual, formData.margem_adicional_kwh]);

  // Monitora mudanças no JSON do kit selecionado
  useEffect(() => {
    if (kitSelecionadoJson) {
      console.log('💾 JSON do kit selecionado foi salvo:', kitSelecionadoJson);
    }
  }, [kitSelecionadoJson]);

  // Monitora mudanças nas quantidades calculadas
  useEffect(() => {
    console.log('🔄 quantidadesCalculadas mudou:', quantidadesCalculadas);
  }, [quantidadesCalculadas]);

  // Calcula quantidades automaticamente quando os dados mudam
  useEffect(() => {
    const calcularQuantidadesAutomaticas = async () => {
      // Só calcula se há dados suficientes E se já há uma potência calculada
      const consumoKwh = parseFloat(formData.consumo_mensal_kwh) || 0;
      const consumoReais = parseFloat(formData.consumo_mensal_reais) || 0;
      const potenciaKw = parseFloat(formData.potencia_kw) || 0;
      
      console.log('🔄 Verificando se deve calcular quantidades automaticamente:', {
        consumoKwh,
        consumoReais,
        potenciaKw,
        kitSelecionado: !!kitSelecionado,
        quantidadesAtuais: quantidadesCalculadas
      });
      
      if ((consumoKwh > 0 || consumoReais > 0) && potenciaKw > 0 && !kitSelecionado) {
        try {
          console.log('🔄 Calculando quantidades automaticamente...');
          const quantidades = await calcularQuantidades();
          console.log('📊 Quantidades calculadas automaticamente:', quantidades);
          setQuantidadesCalculadas(quantidades);
        } catch (error) {
          console.error('❌ Erro ao calcular quantidades automaticamente:', error);
        }
      } else if (kitSelecionado) {
        console.log('⚠️ Kit selecionado, mantendo quantidades do kit:', quantidadesCalculadas);
      }
    };

    // Debounce para evitar múltiplas chamadas
    const timeoutId = setTimeout(calcularQuantidadesAutomaticas, 500);
    
    return () => clearTimeout(timeoutId);
  }, [formData.consumo_mensal_kwh, formData.consumo_mensal_reais, formData.potencia_kw, formData.cidade, kitSelecionado]);

  // Verifica se algum tipo de consumo foi preenchido
  const temConsumoPreenchido = () => {
    const consumoMensalKwh = parseFloat(formData.consumo_mensal_kwh) || 0;
    const consumoMensalReais = parseFloat(formData.consumo_mensal_reais) || 0;
    const consumosMesAMes = formData.consumo_mes_a_mes || [];
    const temConsumoMesAMes = consumosMesAMes.some(consumo => parseFloat(consumo?.kwh) > 0);
    
    return consumoMensalKwh > 0 || consumoMensalReais > 0 || temConsumoMesAMes;
  };

  // Função auxiliar para calcular quantidades de forma robusta
  const calcularQuantidades = async () => {
    // Se já há um kit selecionado, não recalcular quantidades automaticamente
    if (kitSelecionado) {
      console.log('⚠️ Kit já selecionado, não recalculando quantidades automaticamente');
      return quantidadesCalculadas;
    }

    // Tenta obter consumo de diferentes campos
    const consumoKwh = parseFloat(formData.consumo_mensal_kwh) || 0;
    const consumoReais = parseFloat(formData.consumo_mensal_reais) || 0;
    
    console.log('Dados de consumo:', {
      consumo_mensal_kwh: formData.consumo_mensal_kwh,
      consumo_mensal_reais: formData.consumo_mensal_reais,
      consumoKwh,
      consumoReais
    });
    
    // Se não tem consumo em kWh mas tem em reais, não é possível estimar sem tarifa específica
    let consumoParaCalculo = consumoKwh;
    if (consumoParaCalculo <= 0 && consumoReais > 0) {
      throw new Error('Consumo em kWh não informado - Não é possível estimar sem tarifa específica');
    }
    
    // Usa a potência já calculada ou calcula uma nova se necessário
    let potenciaKw = formData.potencia_kw;
    
    // Garantir potência mínima para a API (2kW)
    if (potenciaKw < 2.0) {
      console.log('⚠️ Potência muito baixa para API, ajustando para 2kW');
      potenciaKw = 2.0;
    }
    
    // Só calcula nova potência se não houver uma já definida
    if (!potenciaKw || potenciaKw <= 0) {
      const margemAdicional = {
        percentual: parseFloat(formData.margem_adicional_percentual) || 0,
        kwh: parseFloat(formData.margem_adicional_kwh) || 0
      };
      potenciaKw = await calcularPotenciaSistema(consumoParaCalculo, formData.cidade, margemAdicional) || 1.0;
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

  // Função para calcular quantidades baseadas no kit selecionado
  const calcularQuantidadesDoKit = useCallback((kit) => {
    console.log('🔍 calcularQuantidadesDoKit chamada com:', kit);
    console.log('🔍 Kit completo:', JSON.stringify(kit, null, 2));

    if (!kit) {
      console.log('❌ Kit inválido');
      return { paineis: 0, inversores: 0, estruturas: 0, potenciaTotal: 0 };
    }

    // Tenta diferentes estruturas possíveis para os componentes
    let componentes = kit.composicao || kit.componentes || kit.itens || [];

    if (!componentes || !Array.isArray(componentes)) {
      console.log('❌ Componentes não encontrados ou não é array:', componentes);
      return { paineis: 0, inversores: 0, estruturas: 0, potenciaTotal: 0 };
    }

    let paineis = 0;
    let inversores = 0;
    let estruturas = 0;

    console.log('📋 Analisando componentes do kit:', componentes.length, 'componentes encontrados');
    componentes.forEach((componente, index) => {
      console.log(`  ${index + 1}. Agrupamento: "${componente.agrupamento}" | Descrição: "${componente.descricao}" | Qtd: ${componente.qtd || componente.quantidade || 0}`);

      const quantidade = componente.qtd || componente.quantidade || 0;

      if (componente.agrupamento === 'Painel') {
        paineis += quantidade;
        console.log(`    ✅ Adicionado ${quantidade} painéis. Total: ${paineis}`);
      } else if (componente.agrupamento === 'Inversor') {
        inversores += quantidade;
        console.log(`    ✅ Adicionado ${quantidade} inversores. Total: ${inversores}`);
      } else if (componente.agrupamento === 'Estrutura') {
        estruturas += quantidade;
        console.log(`    ✅ Adicionado ${quantidade} estruturas. Total: ${estruturas}`);
      }
    });

    const resultado = {
      paineis,
      inversores,
      estruturas,
      potenciaTotal: kit.potencia || 0
    };

    console.log('📊 Resultado final das quantidades:', resultado);
    return resultado;
  }, []);

  // Função para selecionar kit de forma robusta
  const selecionarKit = useCallback(async (kit) => {
    console.log('🔍 Selecionando kit:', kit.id, kit.nome);
    
    // Evitar múltiplas seleções simultâneas
    if (selecionandoKit) {
      console.log('⚠️ Já selecionando um kit, ignorando...');
      return;
    }
    
    setSelecionandoKit(true);
    
    try {
      // Salva o JSON completo do kit para uso futuro
      const kitJsonCompleto = JSON.stringify(kit, null, 2);
      setKitSelecionadoJson(kitJsonCompleto);
      
      // Calcula quantidades imediatamente
      const quantidades = calcularQuantidadesDoKit(kit);
      console.log('📊 Quantidades calculadas:', quantidades);
      
      // Atualiza todos os estados de uma vez usando função de atualização
      setKitSelecionado(kit);
      setQuantidadesCalculadas(quantidades);
      
      // Atualiza a potência baseada no kit
      if (kit.potencia && kit.potencia !== formData.potencia_kw) {
        console.log('🔄 Atualizando potência de', formData.potencia_kw, 'para', kit.potencia);
        handleChange("potencia_kw", kit.potencia);
      }
      
      console.log('✅ Kit selecionado com sucesso!');
      
      // Pequeno delay para garantir que o estado foi atualizado
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('❌ Erro ao selecionar kit:', error);
    } finally {
      setSelecionandoKit(false);
    }
  }, [calcularQuantidadesDoKit, formData.potencia_kw, handleChange, selecionandoKit]);


  const calcularPotenciaSistema = async (consumoMensalKwh, cidade = 'São José dos Campos', margemAdicional = {}) => {
    try {
      console.log('🔢 Calculando potência do sistema...');
      console.log('📊 Consumo mensal:', consumoMensalKwh, 'kWh');
      console.log('📊 Cidade:', cidade);
      console.log('📊 Margem adicional:', margemAdicional);
      
      if (!consumoMensalKwh || consumoMensalKwh <= 0) {
        console.log('❌ Consumo inválido:', consumoMensalKwh);
        return null;
      }

      // Aplica margem adicional ao consumo
      let consumoComMargem = consumoMensalKwh;
      if (margemAdicional.percentual && margemAdicional.percentual > 0) {
        consumoComMargem = consumoMensalKwh * (1 + margemAdicional.percentual / 100);
        console.log('📊 Aplicando margem percentual:', margemAdicional.percentual + '%');
      } else if (margemAdicional.kwh && margemAdicional.kwh > 0) {
        consumoComMargem = consumoMensalKwh + margemAdicional.kwh;
        console.log('📊 Aplicando margem em kWh:', margemAdicional.kwh + ' kWh/mês');
      }
      
      console.log('📊 Consumo com margem:', consumoComMargem, 'kWh/mês');
      console.log('📊 Consumo original:', consumoMensalKwh, 'kWh/mês');

      // Busca dados reais de irradiância da cidade
      const irradianciaDataLocal = await getIrradianciaByCity(cidade);
      
      if (!irradianciaDataLocal) {
        console.warn('⚠️ Cidade não encontrada nos dados de irradiância:', cidade);
        // Fallback para valores padrão
        const irradianciaMedia = 5.0;
        const eficienciaSistema = 0.80;
        const fatorCorrecao = 1.066; // Ajustado para corresponder à planilha
        const potenciaNecessariaKw = (consumoComMargem / ((irradianciaMedia * eficienciaSistema) * 30.4)) * fatorCorrecao;
        const resultado = Math.round(potenciaNecessariaKw * 100) / 100;
        return Math.max(resultado, 1.0);
      }
      
      // Salvar dados de irradiância no estado para uso posterior
      setIrradianciaData(irradianciaDataLocal);
      
      // A irradiância anual está em Wh/m²/dia (média diária anual)
      // Convertemos para kWh/m²/dia dividindo por 1000
      const irradianciaDiaria = irradianciaDataLocal.annual / 1000;
    
      // Eficiência do sistema (80%)
      const eficienciaSistema = 0.80;
      
      // Fator de correção adicional (perdas do sistema)
      const fatorCorrecao = 1.066; // Ajustado para corresponder à planilha (2.92kWp)
      
      // Fórmula: (Consumo do cliente em kWh/mês)/((irradiancia da região*eficiencia de 80%)*30,4) * fatorCorrecao
      const potenciaNecessariaKw = (consumoComMargem / ((irradianciaDiaria * eficienciaSistema) * 30.4)) * fatorCorrecao;
      
      console.log('🔢 Cálculo detalhado da potência:');
      console.log('  - Consumo com margem:', consumoComMargem, 'kWh/mês');
      console.log('  - Irradiancia diária:', irradianciaDiaria, 'kWh/m²/dia');
      console.log('  - Eficiência sistema:', eficienciaSistema);
      console.log('  - Fator correção:', fatorCorrecao);
      console.log('  - Potência necessária (antes do arredondamento):', potenciaNecessariaKw, 'kW');
    
      const resultado = Math.round(potenciaNecessariaKw * 100) / 100; // Arredonda para 2 casas decimais
      console.log('🔢 Potência calculada:', resultado, 'kW');
      console.log('📊 Cidade:', cidade, '- Irradiancia anual:', irradianciaDataLocal.annual, 'kWh/m²/ano');
      console.log('📊 Irradiancia diária:', irradianciaDiaria.toFixed(2), 'kWh/m²/dia');
      console.log('📊 Fórmula aplicada: ', consumoComMargem, 'kWh/mês ÷ ((', irradianciaDiaria.toFixed(2), 'kWh/m²/dia × ', eficienciaSistema, ') × 30,4) ×', fatorCorrecao, '=', resultado, 'kW');
      console.log('📊 Cálculo detalhado: ', consumoComMargem, '÷ ((', irradianciaDiaria.toFixed(2), '×', eficienciaSistema, ') × 30,4) ×', fatorCorrecao, '=', consumoComMargem, '÷ (', (irradianciaDiaria * eficienciaSistema).toFixed(2), '× 30,4) ×', fatorCorrecao, '=', consumoComMargem, '÷', ((irradianciaDiaria * eficienciaSistema) * 30.4).toFixed(2), '×', fatorCorrecao, '=', potenciaNecessariaKw.toFixed(2));
    
      // Retorna a potência calculada sem restrição mínima
      return resultado;
      
    } catch (error) {
      console.error('❌ Erro ao calcular potência do sistema:', error);
      return 1.0; // Fallback para evitar erro na API
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

  // Nova função para calcular custo operacional com os valores atualizados
  const calcularCustoOperacional = (quantidadePlacas, potenciaKwp, custoEquipamentos) => {
    const instalacao = quantidadePlacas * 200; // R$200/placa
    const caAterramento = quantidadePlacas * 100; // R$100/placa
    const homologacao = calcularCustoHomologacao(potenciaKwp);
    const placasSinalizacao = 60; // R$60/projeto
    const despesasGerais = instalacao * 0.1; // 10% da instalação

    return {
      equipamentos: custoEquipamentos,
      instalacao,
      caAterramento,
      homologacao,
      placasSinalizacao,
      despesasGerais,
      total: custoEquipamentos + instalacao + caAterramento + homologacao + placasSinalizacao + despesasGerais
    };
  };

  // Função para calcular preço de venda
  const calcularPrecoVenda = (custoOperacional, comissaoVendedor = 5) => {
    const margemDesejada = (25 + comissaoVendedor) / 100; // 25% + comissão
    return custoOperacional / (1 - margemDesejada);
  };

  // Resumo (memo) para evitar recalcular várias vezes
  const resumoCalculos = useMemo(() => {
    const quantidadePlacas = quantidadesCalculadas.paineis || 0;
    const potenciaKwp = formData.potencia_kw || 0;
    const tarifaKwh = parseFloat(formData.tarifa_energia || 0.75) || 0.75;
    const custoEquipamentos = kitSelecionado?.precoTotal || costs?.equipamentos?.total || 0;
    const custoOp = calcularCustoOperacional(quantidadePlacas, potenciaKwp, custoEquipamentos);
    const comissaoVendedor = formData.comissao_vendedor || 5;
    const precoVenda = calcularPrecoVenda(custoOp.total, comissaoVendedor);
    // Consumo mensal em kWh (favor kWh; se não, converte de R$)
    const consumoMensalKwhBase = (() => {
      const kwh = parseFloat(formData.consumo_mensal_kwh || 0);
      if (kwh > 0) return kwh;
      const reais = parseFloat(formData.consumo_mensal_reais || 0);
      return reais > 0 ? reais / tarifaKwh : 0;
    })();
    // Produção mensal estimada (fallback quando não temos projeções)
    const prodMensalEst =
      (projecoesFinanceiras?.geracao_media_mensal || resultados?.geracao_media_mensal) ??
      (() => {
        const pot = potenciaKwp || (kitSelecionado?.potencia || 0);
        const irr = parseFloat(formData.irradiacao_media || 5.15) || 5.15;
        const eficiencia = 0.85; // heurística próxima do backend
        return pot > 0 ? pot * irr * 30.4 * eficiencia : 0;
      })();
    // Economia mensal / anual
    const energiaAproveitada = Math.min(consumoMensalKwhBase, prodMensalEst);
    const economiaMensalEst = energiaAproveitada * tarifaKwh;
    const economiaAnualEst = economiaMensalEst * 12;
    // Conta anual atual (estimada)
    const contaAnualEst = consumoMensalKwhBase * tarifaKwh * 12;
    // Payback e gasto acumulado não são mais calculados no frontend
    // R$/kWp e R$/Placa
    const rPorKwp = potenciaKwp > 0 ? (precoVenda / potenciaKwp) : 0;
    const rPorPlaca = quantidadePlacas > 0 ? (precoVenda / quantidadePlacas) : 0;
    return {
      quantidadePlacas,
      potenciaKwp,
      tarifaKwh,
      custoEquipamentos,
      custoOp,
      comissaoVendedor,
      precoVenda,
      consumoMensalKwhBase,
      prodMensalEst,
      economiaMensalEst,
      economiaAnualEst,
      contaAnualEst,
      rPorKwp,
      rPorPlaca
    };
  }, [quantidadesCalculadas.paineis, formData.potencia_kw, formData.consumo_mensal_kwh, formData.consumo_mensal_reais, formData.tarifa_energia, formData.irradiacao_media, formData.comissao_vendedor, kitSelecionado, costs, projecoesFinanceiras, resultados]);

  // ============================
  // Projeções de 25 anos (gráficos e proposta)
  // ============================
  const acumularArray = (arr) => {
    const out = [];
    arr.reduce((acc, v) => {
      const nv = acc + v;
      out.push(nv);
      return nv;
    }, 0);
    return out;
  };

  const buildProjecoesEnergia = ({
    consumoMensalKwhAtual = 0,
    tarifaInicial = 0.75,
    inflacaoAnual = 0.0484,
    crescimentoConsumo = 0.035,
    degradacaoAnual = 0.008,
    producaoAnualKwhAno1 = 0,
    taxaDistribuicaoMensalInicial = 0,
    investimentoInicial = 0
  }) => {
    const ANOS = Array.from({ length: 25 }, (_, i) => i + 1);

    // Consumo mensal e anual
    const consumoMensalKwh = ANOS.map((_, i) => consumoMensalKwhAtual * Math.pow(1 + crescimentoConsumo, i));
    const consumoAnualKwh = consumoMensalKwh.map(m => m * 12);

    // Tarifa por kWh (corrigida pela inflação)
    const tarifaR$kWh = ANOS.map((_, i) => tarifaInicial * Math.pow(1 + inflacaoAnual, i));

    // Sem energia solar
    const custoSemSolarAnual = ANOS.map((_, i) => consumoAnualKwh[i] * tarifaR$kWh[i]);
    const custoSemSolarAcum = acumularArray(custoSemSolarAnual);

    // Produção com degradação e receita
    const producaoAnualKwh = ANOS.map((_, i) => producaoAnualKwhAno1 * Math.pow(1 - degradacaoAnual, i));
    const producaoAnualR$ = ANOS.map((_, i) => producaoAnualKwh[i] * tarifaR$kWh[i]);

    // Com energia solar: apenas taxa de distribuição corrigida pela inflação
    // Se não houver taxa informada, usar fallback seguro: 50 kWh × tarifa do ano 1
    const taxaBase = (typeof taxaDistribuicaoMensalInicial === 'number' && taxaDistribuicaoMensalInicial > 0)
      ? taxaDistribuicaoMensalInicial
      : (50 * tarifaInicial);
    const taxaDistribuicaoMensal = ANOS.map((_, i) => taxaBase * Math.pow(1 + inflacaoAnual, i));
    const custoComSolarAnual = taxaDistribuicaoMensal.map(v => v * 12);
    const custoComSolarAcum = acumularArray(custoComSolarAnual);

    // Economia
    const economiaAnual = ANOS.map((_, i) => custoSemSolarAnual[i] - custoComSolarAnual[i]);
    const economiaAcum = acumularArray(economiaAnual);

    // Fluxo de caixa: investimento no ano 1
    const fluxoCaixaAnual = ANOS.map((_, i) => {
      const base = producaoAnualR$[i] - custoComSolarAnual[i];
      return i === 0 ? base - investimentoInicial : base;
    });
    const fluxoCaixaAcum = acumularArray(fluxoCaixaAnual);

    return {
      anos: ANOS,
      consumoMensalKwh,
      consumoAnualKwh,
      tarifaR$kWh,
      custoSemSolarAnual,
      custoSemSolarAcum,
      producaoAnualKwh,
      producaoAnualR$,
      taxaDistribuicaoMensal,
      custoComSolarAnual,
      custoComSolarAcum,
      economiaAnual,
      economiaAcum,
      fluxoCaixaAnual,
      fluxoCaixaAcum
    };
  };

  // Tenta obter taxa de distribuição mensal informada por concessionária/tipo ligação
  const [taxasDistribuicao, setTaxasDistribuicao] = useState(null);
  useEffect(() => {
    // Carregar mapa de taxas do backend (se disponível)
    const getServerUrl = () => {
      if (import.meta?.env?.VITE_PROPOSAL_SERVER_URL) return import.meta.env.VITE_PROPOSAL_SERVER_URL;
      try {
        const { systemConfig } = require('../config/firebase.js');
        if (systemConfig?.apiUrl) return systemConfig.apiUrl;
      } catch (_) {}
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const port = '8000';
      if (hostname === 'localhost' || hostname === '127.0.0.1') return `http://localhost:${port}`;
      return `http://${hostname}:${port}`;
    };
    const url = `${getServerUrl()}/config/taxas-distribuicao`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => {
        if (j?.success && j?.items) setTaxasDistribuicao(j.items);
      })
      .catch(() => {});
  }, []);

  const obterTaxaDistribuicaoMensal = useCallback(() => {
    // 1) valores explícitos no form
    const explicita =
      parseFloat(formData.taxa_distribuicao_mensal || formData.taxa_distribuicao) || 0;
    if (explicita > 0) return explicita;
    // 1.1) backend Admin > Taxas (quando disponível)
    try {
      if (taxasDistribuicao && formData.concessionaria) {
        const slug = (formData.concessionaria || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const tipo = (formData.tipo_ligacao || 'monofasica').toLowerCase();
        const registro = taxasDistribuicao[slug];
        const valor = registro ? Number(registro[tipo] || 0) : 0;
        if (!isNaN(valor) && valor > 0) return valor;
      }
    } catch (_) {}
    // 2) tentar buscar em configs por chave padronizada: taxa_{concessionaria}_{tipo}
    try {
      const conc = (formData.concessionaria || '').toLowerCase().replace(/\s+/g, '_');
      const tipo = (formData.tipo_ligacao || 'monofasica').toLowerCase();
      const chave1 = `taxa_${conc}_${tipo}`;
      const cfg1 = configs[chave1];
      if (cfg1 && (cfg1.valor || cfg1.data)) {
        const v = parseFloat(cfg1.valor ?? cfg1.data ?? 0);
        if (!isNaN(v) && v > 0) return v;
      }
      // 3) chave genérica taxa_distribuicao_mensal
      const cfg2 = configs['taxa_distribuicao_mensal'];
      if (cfg2 && (cfg2.valor || cfg2.data)) {
        const v = parseFloat(cfg2.valor ?? cfg2.data ?? 0);
        if (!isNaN(v) && v > 0) return v;
      }
    } catch (_) {}
    // 4) fallback seguro: estimar taxa como demanda mínima (50 kWh) * tarifa atual
    const tarifaBase = parseFloat(formData.tarifa_energia || 0);
    if (tarifaBase > 0) {
      return 50 * tarifaBase; // aproximação padrão
    }
    return 0;
  }, [formData.taxa_distribuicao_mensal, formData.taxa_distribuicao, formData.concessionaria, formData.tipo_ligacao, configs, taxasDistribuicao]);

  const calcularDimensionamento = async () => {
    setCalculando(true);
    
    let consumoKwh = 0;
    
    if (tipoConsumo === "mes_a_mes" && formData.consumo_mes_a_mes && formData.consumo_mes_a_mes.length > 0) {
      const totalAnual = formData.consumo_mes_a_mes.reduce((sum, item) => sum + (parseFloat(item.kwh) || 0), 0);
      const mediaMensal = totalAnual / 12;
      // Aplicar margem adicional também para mês a mês
      const margemPercentual = parseFloat(formData.margem_adicional_percentual) || 0;
      const margemKwh = parseFloat(formData.margem_adicional_kwh) || 0;
      if (margemPercentual > 0) {
        consumoKwh = mediaMensal * (1 + margemPercentual / 100);
      } else if (margemKwh > 0) {
        consumoKwh = mediaMensal + margemKwh;
      } else {
        consumoKwh = mediaMensal;
      }
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
    // payback_meses não é mais calculado no frontend; será definido pelas métricas do backend
    const paybackMeses = 0;

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
      preco_venda: precoFinal,
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
      await Projeto.create({
        ...formData,
        created_by: user?.uid || null,
        vendedor_email: user?.email || null
      });
    }
    
    setLoading(false);
    navigate(createPageUrl("Projetos"));
  };

  const concessionarias = Object.values(configs)
    .filter(c => c.tipo === "tarifa")
    .map(c => c.concessionaria);

  // ===== FUNÇÕES DE CÁLCULO FINANCEIRO (chamadas apenas ao final do processo) =====
  
  // Função para calcular geração mensal
  const calcularGeracaoMensal = (potenciaKw, irradianciaMensal, eficiencia = 0.85, fatorCorrecao = 1.066) => {
    // Geração mensal = Potência (kW) × Irradiação mensal (kWh/m²) × Eficiência × Fator de correção
    return potenciaKw * irradianciaMensal * eficiencia * fatorCorrecao;
  };

  // Função para calcular projeções financeiras de 25 anos
  const calcularProjecoesFinanceiras = (consumoMensalKwh, tarifaAtual, potenciaKw, irradianciaMensal) => {
    const anos = 25;
    const aumentoTarifaAnual = 0.0034; // 0.34% ao ano
    const perdaEficienciaAnual = 0.008; // 0.8% ao ano
    const eficienciaInicial = 0.85;
    const fatorCorrecao = 1.066;

    const projecoes = {
      geracaoMensal: [],
      geracaoAnual: [],
      consumoMensal: [],
      consumoAnual: [],
      tarifaMensal: [],
      contaMensal: [],
      contaAnual: [],
      economiaMensal: [],
      economiaAnual: [],
      economiaAcumulada: [],
      fluxoCaixa: [],
      fluxoCaixaAcumulado: [],
      payback: null,
      payback_meses: null,
      economia_mensal_estimada: 0,
      economia_total_25_anos: 0,
      geracao_media_mensal: 0,
      creditos_anuais: 0,
      custo_total_projeto: 0,
      custo_equipamentos: 0,
      custo_instalacao: 0,
      custo_homologacao: 0,
      custo_outros: 0,
      margem_lucro: 0
    };

    let economiaAcumulada = 0;
    let fluxoCaixaAcumulado = 0;
    let paybackEncontrado = false;

    for (let ano = 1; ano <= anos; ano++) {
      // Calcular eficiência atual (perda de 0.8% ao ano)
      const eficienciaAtual = ano === 1 ? eficienciaInicial : eficienciaInicial * Math.pow(1 - perdaEficienciaAnual, ano - 1);
      
      // Calcular tarifa atual (aumento de 0.34% ao ano)
      const tarifaAtualAno = ano === 1 ? tarifaAtual : tarifaAtual * Math.pow(1 + aumentoTarifaAnual, ano - 1);
      
      // Calcular consumo mensal (aumento de 0.34% ao ano)
      const consumoMensalAtual = ano === 1 ? consumoMensalKwh : consumoMensalKwh * Math.pow(1 + aumentoTarifaAnual, ano - 1);

      // Calcular geração mensal
      const geracaoMensalAtual = calcularGeracaoMensal(potenciaKw, irradianciaMensal, eficienciaAtual, fatorCorrecao);
      
      // Calcular valores anuais
      const geracaoAnualAtual = geracaoMensalAtual * 12;
      const consumoAnualAtual = consumoMensalAtual * 12;
      
      // Calcular conta mensal sem solar
      const contaMensalSemSolar = consumoMensalAtual * tarifaAtualAno;
      const contaAnualSemSolar = contaMensalSemSolar * 12;
      
      // Calcular economia mensal e anual
      // Economia = menor valor entre geração e consumo, multiplicado pela tarifa
      const economiaMensalAtual = Math.min(geracaoMensalAtual, consumoMensalAtual) * tarifaAtualAno;
      const economiaAnualAtual = economiaMensalAtual * 12;
      
      // Calcular fluxo de caixa (economia - custos de distribuição)
      const custoDistribuicao = contaMensalSemSolar * 0.1; // Estimativa: 10% da conta como taxa de distribuição
      const fluxoCaixaMensal = economiaMensalAtual - custoDistribuicao;
      const fluxoCaixaAnual = fluxoCaixaMensal * 12;
      
      // Acumular valores
      economiaAcumulada += economiaAnualAtual;
      fluxoCaixaAcumulado += fluxoCaixaAnual;
      
      // Verificar payback (quando fluxo acumulado fica positivo)
      if (!paybackEncontrado && fluxoCaixaAcumulado > 0) {
        projecoes.payback = ano;
        projecoes.payback_meses = ano * 12; // Converter para meses
        paybackEncontrado = true;
      }

      // Armazenar dados do ano
      projecoes.geracaoMensal.push(geracaoMensalAtual);
      projecoes.geracaoAnual.push(geracaoAnualAtual);
      projecoes.consumoMensal.push(consumoMensalAtual);
      projecoes.consumoAnual.push(consumoAnualAtual);
      projecoes.tarifaMensal.push(tarifaAtualAno);
      projecoes.contaMensal.push(contaMensalSemSolar);
      projecoes.contaAnual.push(contaAnualSemSolar);
      projecoes.economiaMensal.push(economiaMensalAtual);
      projecoes.economiaAnual.push(economiaAnualAtual);
      projecoes.economiaAcumulada.push(economiaAcumulada);
      projecoes.fluxoCaixa.push(fluxoCaixaAnual);
      projecoes.fluxoCaixaAcumulado.push(fluxoCaixaAcumulado);
    }

    // Calcular valores finais
    projecoes.economia_mensal_estimada = projecoes.economiaMensal[0] || 0;
    projecoes.economia_total_25_anos = economiaAcumulada;
    projecoes.geracao_media_mensal = projecoes.geracaoMensal[0] || 0;
    projecoes.creditos_anuais = projecoes.geracaoAnual[0] || 0;
    
    // Se não encontrou payback, usar cálculo simples baseado na economia mensal
    if (!projecoes.payback_meses) {
      const economiaMensal = projecoes.economia_mensal_estimada;
      if (economiaMensal > 0) {
        // Estimativa de custo baseada na potência (R$ 3.000 por kWp)
        const custoEstimado = potenciaKw * 3000;
        projecoes.payback_meses = Math.ceil(custoEstimado / economiaMensal);
        projecoes.payback = Math.ceil(projecoes.payback_meses / 12);
      }
    }

    return projecoes;
  };

  // Função para calcular todas as variáveis necessárias para a proposta
  const calcularTodasAsVariaveis = async () => {
    const temConsumoKwh = formData.consumo_mensal_kwh && parseFloat(formData.consumo_mensal_kwh) > 0;
    const temConsumoReais = formData.consumo_mensal_reais && parseFloat(formData.consumo_mensal_reais) > 0;
    
    if (!kitSelecionado || (!temConsumoKwh && !temConsumoReais)) {
      console.log('⚠️ Dados insuficientes para calcular variáveis');
      console.log('📊 Kit selecionado:', !!kitSelecionado);
      console.log('📊 Consumo mensal kWh:', formData.consumo_mensal_kwh);
      console.log('📊 Consumo mensal Reais:', formData.consumo_mensal_reais);
      console.log('📊 Tem consumo kWh:', temConsumoKwh);
      console.log('📊 Tem consumo Reais:', temConsumoReais);
      return null;
    }

    console.log('💰 Calculando todas as variáveis para a proposta...');
    
    const potenciaKw = kitSelecionado.potencia || formData.potencia_kw || 0;
    
    // Calcular consumo em kWh se necessário
    let consumoMensalKwh = parseFloat(formData.consumo_mensal_kwh) || 0;
    if (consumoMensalKwh <= 0 && temConsumoReais) {
      // Se não tem kWh mas tem reais, calcular baseado na tarifa
      const consumoReais = parseFloat(formData.consumo_mensal_reais);
      // Não chute tarifa aqui; será definida a partir da concessionária abaixo.
      // Mantemos temporariamente 0 até obter a tarifa real.
      consumoMensalKwh = 0;
      console.log('📊 Consumo kWh calculado a partir do valor em reais:', consumoMensalKwh);
    }
    
    // Obter tarifa da concessionária selecionada
    let tarifaAtual = null;
    
    console.log('🔍 DEBUG tarifa - formData.concessionaria:', formData.concessionaria);
    console.log('🔍 DEBUG tarifa - concessionarias disponíveis:', concessionarias);
    
    if (formData.concessionaria) {
      try {
        const concessionariaData = buscarConcessionaria(formData.concessionaria);
        console.log('🔍 DEBUG tarifa - concessionariaData encontrada:', concessionariaData);
        if (concessionariaData) {
          tarifaAtual = calcularTarifaTotal(concessionariaData, 'residencial', 'verde');
          console.log('📊 Tarifa obtida da concessionária:', formData.concessionaria, '=', tarifaAtual);
          // Propagar para o formulário para uso posterior (salvar proposta)
          handleChange('tarifa_energia', tarifaAtual);
        } else {
          console.log('❌ Concessionária não encontrada nos dados:', formData.concessionaria);
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar tarifa da concessionária:', error);
      }
    } else {
      console.log('❌ Nenhuma concessionária selecionada no formData');
    }
    
    // Se não conseguiu obter da concessionária, calcular automaticamente
    if (!tarifaAtual && temConsumoReais && consumoMensalKwh > 0) {
      const consumoReais = parseFloat(formData.consumo_mensal_reais);
      tarifaAtual = consumoReais / consumoMensalKwh;
      console.log('📊 Tarifa calculada automaticamente:', tarifaAtual);
      handleChange('tarifa_energia', tarifaAtual);
    }
    
    // Se ainda não tem tarifa, usar fallback das configurações
    if (!tarifaAtual) {
      const tarifaConfig = Object.values(configs).find(
        c => c.tipo === "tarifa" && c.concessionaria === formData.concessionaria
      );
      tarifaAtual = tarifaConfig?.tarifa_kwh || 0.75;
      console.log('📊 Tarifa obtida das configurações:', tarifaAtual);
      handleChange('tarifa_energia', tarifaAtual);
    }
    
    if (!tarifaAtual || tarifaAtual <= 0) {
      throw new Error('Tarifa de energia não informada - Não é possível calcular projeções financeiras');
    }

    // Se consumo em kWh ainda não foi definido e temos valor em R$, derive agora usando a tarifa válida
    if (consumoMensalKwh <= 0 && temConsumoReais) {
      const consumoReais = parseFloat(formData.consumo_mensal_reais);
      consumoMensalKwh = consumoReais / tarifaAtual;
      handleChange('consumo_mensal_kwh', consumoMensalKwh);
      console.log('📊 Consumo kWh derivado com tarifa válida:', consumoMensalKwh);
    }
    
    // Buscar dados de irradiância se não estiverem disponíveis
    let irradianciaDataLocal = irradianciaData;
    if (!irradianciaDataLocal) {
      console.log('📊 Buscando dados de irradiância...');
      irradianciaDataLocal = await getIrradianciaByCity(formData.cidade || 'São José dos Campos');
      if (irradianciaDataLocal) {
        setIrradianciaData(irradianciaDataLocal);
      }
    }
    
    if (!irradianciaDataLocal) {
      throw new Error(`Dados de irradiação solar não encontrados para a cidade "${formData.cidade || 'não informada'}"`);
    }
    
    const irradianciaMensal = irradianciaDataLocal.annual / 12; // Irradiação média mensal
    
    console.log('📊 Dados para cálculo:', {
      potenciaKw,
      consumoMensalKwh,
      tarifaAtual,
      irradianciaMensal
    });
    
    const projecoes = calcularProjecoesFinanceiras(consumoMensalKwh, tarifaAtual, potenciaKw, irradianciaMensal);
    
    // Adicionar dados do kit às projeções (sem valores estimados)
    projecoes.custo_total_projeto = kitSelecionado?.precoTotal || 0;
    projecoes.custo_equipamentos = 0; // Deve ser calculado pela API real
    projecoes.custo_instalacao = 0; // Deve ser calculado pela API real
    projecoes.custo_homologacao = 0; // Deve ser calculado pela API real
    projecoes.custo_outros = 0; // Deve ser calculado pela API real
    projecoes.margem_lucro = kitSelecionado?.precoTotal * 0.3 || 0; // 30% de margem
    
    setProjecoesFinanceiras(projecoes);
    
    console.log('✅ Todas as variáveis calculadas:', projecoes);
    console.log('💰 Valores financeiros calculados:', {
      economia_mensal_estimada: projecoes.economia_mensal_estimada,
      payback_meses: projecoes.payback_meses,
      economia_total_25_anos: projecoes.economia_total_25_anos,
      custo_total_projeto: projecoes.custo_total_projeto
    });
    return projecoes;
  };

  // Função para gerar proposta e avançar para resultados
  const gerarPropostaEAvançar = async () => {
    try {
      console.log('🎯 Gerando proposta e avançando para resultados...');
      // Não executar cálculos locais; os KPIs serão obtidos no backend ao salvar
      // Ativar auto-geração da proposta
      setAutoGenerateProposta(true);
      
      // Avançar para a aba de resultados
      setActiveTab('resultados');
      
      console.log('✅ Navegação para resultados concluída!');
      
    } catch (error) {
      console.error('❌ Erro ao gerar proposta e avançar:', error);
      alert('Erro ao gerar proposta: ' + error.message);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      {progressOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[90%] max-w-md border border-sky-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Processando...</h3>
            <p className="text-sm text-gray-600 mb-4">{progressLabel}</p>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-sky-600 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progressValue))}%` }}
              />
            </div>
            <div className="text-right text-sm mt-2 text-gray-700">{Math.round(progressValue)}%</div>
          </div>
        </div>
      )}
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
                {/* Não desabilitar a aba de resultados: ela precisa abrir para auto-geração */}
                <TabsTrigger value="resultados">Resultados</TabsTrigger>
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
                      <div className="space-y-4 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                        {/* Campo de Margem Adicional */}
                        <div className="border-t border-blue-200 pt-4">
                          <div className="space-y-3">
                            <Label className="text-blue-700 font-semibold">Margem Adicional</Label>
                            <p className="text-sm text-gray-600">
                              Adicione uma margem de segurança para crescimento futuro ou variações de consumo
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Margem em %</Label>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={formData.margem_adicional_percentual || ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      handleChange("margem_adicional_percentual", value);
                                      // Limpa o campo de kWh quando % é preenchido
                                      if (value) {
                                        handleChange("margem_adicional_kwh", '');
                                      }
                                    }}
                                    placeholder="Ex: 20"
                                    className="bg-white"
                                  />
                                  <span className="text-sm text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Ex: 20% = sistema 20% maior que o consumo atual
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label>OU Margem em kWh</Label>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={formData.margem_adicional_kwh || ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      handleChange("margem_adicional_kwh", value);
                                      // Limpa o campo de % quando kWh é preenchido
                                      if (value) {
                                        handleChange("margem_adicional_percentual", '');
                                      }
                                    }}
                                    placeholder="Ex: 50"
                                    className="bg-white"
                                  />
                                  <span className="text-sm text-gray-500">kWh/mês</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Ex: 50 kWh/mês = sistema gera 50 kWh/mês a mais
                                </p>
                              </div>
                            </div>

                            {/* Resumo da Margem (funciona para consumo unitário e mês a mês) */}
                            {(() => {
                              let consumoAtual = parseFloat(formData.consumo_mensal_kwh) || 0;
                              // Se houver série mês a mês e nenhum consumo unitário, usar média mensal
                              if ((!consumoAtual || consumoAtual <= 0) && Array.isArray(formData.consumo_mes_a_mes) && formData.consumo_mes_a_mes.length > 0) {
                                const totalAnual = formData.consumo_mes_a_mes.reduce((sum, item) => sum + (parseFloat(item.kwh) || 0), 0);
                                consumoAtual = totalAnual / 12;
                              }
                              const margemPercentual = parseFloat(formData.margem_adicional_percentual) || 0;
                              const margemKwh = parseFloat(formData.margem_adicional_kwh) || 0;
                              
                              if (consumoAtual > 0 && (margemPercentual > 0 || margemKwh > 0)) {
                                const consumoComMargem = margemPercentual > 0 
                                  ? consumoAtual * (1 + margemPercentual / 100)
                                  : consumoAtual + margemKwh;
                                
                                return (
                                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    <div className="text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Consumo atual:</span>
                                        <span className="font-semibold">{consumoAtual.toFixed(1)} kWh/mês</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Consumo com margem:</span>
                                        <span className="font-semibold text-blue-700">{consumoComMargem.toFixed(1)} kWh/mês</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Margem aplicada:</span>
                                        <span className="font-semibold text-green-600">
                                          {margemPercentual > 0 
                                            ? `+${margemPercentual}%` 
                                            : `+${margemKwh} kWh/mês`
                                          }
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
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
                          className={`cursor-pointer transition-all duration-200 ${
                            kitSelecionado?.id === kit.id
                              ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200'
                              : selecionandoKit
                              ? 'border-yellow-400 bg-yellow-50 shadow-md ring-1 ring-yellow-200'
                              : 'border-gray-200 hover:border-gray-300 hover:shadow-md hover:bg-gray-50'
                          }`}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Evitar seleção duplicada
                            if (kitSelecionado?.id === kit.id) {
                              console.log('⚠️ Kit já selecionado, ignorando clique');
                              return;
                            }
                            
                            // Usar função robusta para seleção
                            await selecionarKit(kit);
                          }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">
                                {kit.nome}
                                {selecionandoKit && kitSelecionado?.id === kit.id && (
                                  <span className="ml-2 text-yellow-600 text-sm">⏳ Selecionando...</span>
                                )}
                              </CardTitle>
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
                      <div className="sticky bottom-6 right-6 z-50 float-right">
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
                    quantidadesCalculadas,
                    kitSelecionado: kitSelecionado?.id,
                    produtosSelecionados: {
                      paineis: !!produtosSelecionados.paineis,
                      inversores: !!produtosSelecionados.inversores
                    }
                  });
                  return null;
                })()}

                {/* Seletor de Comissão do Vendedor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      Configurações de Venda
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="comissao-vendedor">Comissão do Vendedor</Label>
                          <div className="flex items-center space-x-2">
                            <input
                              id="comissao-vendedor"
                              type="range"
                              min="1"
                              max="10"
                              step="0.5"
                              value={formData.comissao_vendedor || 5}
                              onChange={(e) => handleChange("comissao_vendedor", parseFloat(e.target.value))}
                              className="flex-1"
                            />
                            <span className="text-sm font-semibold w-12 text-center">
                              {formData.comissao_vendedor || 5}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Margem desejada: {25 + (formData.comissao_vendedor || 5)}% (25% + comissão)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Resumo da Margem</Label>
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="flex justify-between text-sm">
                              <span>Margem base:</span>
                              <span className="font-semibold">25%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Comissão vendedor:</span>
                              <span className="font-semibold">{formData.comissao_vendedor || 5}%</span>
                            </div>
                            <hr className="my-1" />
                            <div className="flex justify-between font-semibold text-blue-700">
                              <span>Margem total:</span>
                              <span>{25 + (formData.comissao_vendedor || 5)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                ) : costs || kitSelecionado ? (
                  <div className="space-y-6">
                    
                    {/* Informação do Kit Selecionado */}
                    {kitSelecionado && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Check className="w-5 h-5 text-blue-600" />
                          <h4 className="font-semibold text-blue-800">Kit Selecionado</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Nome:</span>
                            <span className="font-semibold ml-2">{kitSelecionado.nome}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Potência:</span>
                            <span className="font-semibold ml-2">{kitSelecionado.potencia}kW</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Preço:</span>
                            <span className="font-semibold ml-2 text-green-600">{formatCurrency(kitSelecionado.precoTotal)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Definição de Valores */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-green-600">💰</span>
                          Definição de Valores
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {(() => {
                            const quantidadePlacas = quantidadesCalculadas.paineis || 0;
                            const potenciaKwp = formData.potencia_kw || 0;
                            // Usa preço do kit selecionado se disponível, senão usa da API
                            const custoEquipamentos = kitSelecionado?.precoTotal || costs?.equipamentos?.total || 0;
                            const custoOp = calcularCustoOperacional(quantidadePlacas, potenciaKwp, custoEquipamentos);
                            
                            return (
                              <>
                                <div className="grid grid-cols-4 gap-4 text-sm font-semibold border-b pb-2">
                                  <div>Produto/Serviço</div>
                                  <div className="text-right">Custo Unitário</div>
                                  <div className="text-right">Quantidade</div>
                                  <div className="text-right">Custo Total</div>
                                </div>
                                
                                <div className="grid grid-cols-4 gap-4 text-sm py-1">
                                  <div>Equipamentos</div>
                                  <div className="text-right">{formatCurrency(custoEquipamentos)}</div>
                                  <div className="text-right">1,00</div>
                                  <div className="text-right font-semibold">{formatCurrency(custoEquipamentos)}</div>
                                </div>
                                
                                <div className="grid grid-cols-4 gap-4 text-sm py-1">
                                  <div>Instalação</div>
                                  <div className="text-right">R$ 200,00</div>
                                  <div className="text-right">{quantidadePlacas},00</div>
                                  <div className="text-right font-semibold">{formatCurrency(custoOp.instalacao)}</div>
                                </div>
                                
                                <div className="grid grid-cols-4 gap-4 text-sm py-1">
                                  <div>CA e Aterramento</div>
                                  <div className="text-right">R$ 100,00</div>
                                  <div className="text-right">{quantidadePlacas},00</div>
                                  <div className="text-right font-semibold">{formatCurrency(custoOp.caAterramento)}</div>
                                </div>
                                
                                <div className="grid grid-cols-4 gap-4 text-sm py-1">
                                  <div>Homologação</div>
                                  <div className="text-right">{formatCurrency(custoOp.homologacao)}</div>
                                  <div className="text-right">1,00</div>
                                  <div className="text-right font-semibold">{formatCurrency(custoOp.homologacao)}</div>
                                </div>
                                
                                <div className="grid grid-cols-4 gap-4 text-sm py-1">
                                  <div>Placas Sinalização</div>
                                  <div className="text-right">R$ 20,00</div>
                                  <div className="text-right">3,00</div>
                                  <div className="text-right font-semibold">{formatCurrency(custoOp.placasSinalizacao)}</div>
                                </div>
                                
                                <div className="grid grid-cols-4 gap-4 text-sm py-1">
                                  <div>Despesas gerais instalação</div>
                                  <div className="text-right">-</div>
                                  <div className="text-right">-</div>
                                  <div className="text-right font-semibold">{formatCurrency(custoOp.despesasGerais)}</div>
                                </div>
                                
                                <div className="grid grid-cols-4 gap-4 text-sm font-bold text-green-600 border-t pt-2">
                                  <div>Custo Operacional</div>
                                  <div className="text-right">-</div>
                                  <div className="text-right">-</div>
                                  <div className="text-right">{formatCurrency(custoOp.total)}</div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Performance - DRE do Projeto */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-blue-600">📊</span>
                          Performance - DRE do Projeto
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {(() => {
                            const quantidadePlacas = quantidadesCalculadas.paineis || 0;
                            const potenciaKwp = formData.potencia_kw || 0;
                            // Usa preço do kit selecionado se disponível, senão usa da API
                            const custoEquipamentos = kitSelecionado?.precoTotal || costs?.equipamentos?.total || 0;
                            const custoOp = calcularCustoOperacional(quantidadePlacas, potenciaKwp, custoEquipamentos);
                            const comissaoVendedor = formData.comissao_vendedor || 5;
                            const precoVenda = calcularPrecoVenda(custoOp.total, comissaoVendedor);
                            
                            // Cálculos baseados no Excel
                            const kitFotovoltaico = custoEquipamentos;
                            const comissao = precoVenda * (comissaoVendedor / 100);
                            const recebido = precoVenda - kitFotovoltaico - comissao;
                            const despesasObra = custoOp.instalacao + custoOp.caAterramento + custoOp.despesasGerais;
                            const despesasDiretoria = precoVenda * 0.01; // 1%
                            const impostos = precoVenda * 0.033; // 3.3%
                            const lldi = recebido - despesasObra - despesasDiretoria - impostos;
                            const divisaoLucro = lldi * 0.4; // 40%
                            const fundoCaixa = lldi * 0.2; // 20%
                            
                            return (
                              <>
                                <div className="grid grid-cols-3 gap-4 text-sm font-semibold border-b pb-2">
                                  <div>Descrição</div>
                                  <div className="text-right">Valor</div>
                                  <div className="text-right">%</div>
                      </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm py-1">
                                  <div>Preço de venda</div>
                                  <div className="text-right font-semibold text-green-600">{formatCurrency(precoVenda)}</div>
                                  <div className="text-right font-semibold">100,0%</div>
                      </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm py-1">
                                  <div>Kit Fotovoltaico</div>
                                  <div className="text-right">{formatCurrency(kitFotovoltaico)}</div>
                                  <div className="text-right">{((kitFotovoltaico / precoVenda) * 100).toFixed(1)}%</div>
                    </div>

                                <div className="grid grid-cols-3 gap-4 text-sm py-1">
                                  <div>Comissão</div>
                                  <div className="text-right">{formatCurrency(comissao)}</div>
                                  <div className="text-right">{((comissao / precoVenda) * 100).toFixed(1)}%</div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm py-1">
                                  <div>Recebido</div>
                                  <div className="text-right">{formatCurrency(recebido)}</div>
                                  <div className="text-right">{((recebido / precoVenda) * 100).toFixed(1)}%</div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm py-1">
                                  <div>Despesas Obra</div>
                                  <div className="text-right">{formatCurrency(despesasObra)}</div>
                                  <div className="text-right">{((despesasObra / precoVenda) * 100).toFixed(1)}%</div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm py-1">
                                  <div>Despesas Diretoria</div>
                                  <div className="text-right">{formatCurrency(despesasDiretoria)}</div>
                                  <div className="text-right">{((despesasDiretoria / precoVenda) * 100).toFixed(1)}%</div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm py-1">
                                  <div>Impostos</div>
                                  <div className="text-right">{formatCurrency(impostos)}</div>
                                  <div className="text-right">{((impostos / precoVenda) * 100).toFixed(1)}%</div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm font-bold text-blue-600 border-t pt-2">
                                  <div>LLDI</div>
                                  <div className="text-right">{formatCurrency(lldi)}</div>
                                  <div className="text-right">{((lldi / precoVenda) * 100).toFixed(1)}%</div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm py-1">
                                  <div>Divisão de Lucro</div>
                                  <div className="text-right">{formatCurrency(divisaoLucro)}</div>
                                  <div className="text-right">-</div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4 text-sm py-1">
                                  <div>Fundo Caixa</div>
                                  <div className="text-right">{formatCurrency(fundoCaixa)}</div>
                                  <div className="text-right">-</div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Parâmetros */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-purple-600">⚙️</span>
                          Parâmetros
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {(() => {
                            const quantidadePlacas = quantidadesCalculadas.paineis || 0;
                            const potenciaKwp = formData.potencia_kw || 0;
                            // Usa preço do kit selecionado se disponível, senão usa da API
                            const custoEquipamentos = kitSelecionado?.precoTotal || costs?.equipamentos?.total || 0;
                            const custoOp = calcularCustoOperacional(quantidadePlacas, potenciaKwp, custoEquipamentos);
                            const comissaoVendedor = formData.comissao_vendedor || 5;
                            const precoVenda = calcularPrecoVenda(custoOp.total, comissaoVendedor);
                            // Consumo mensal em kWh (usa kWh; se não houver, converte a partir de R$ e tarifa)
                            const tarifaKwh = parseFloat(formData.tarifa_energia || 0.75) || 0.75;
                            const consumoMensalKwhBase = (() => {
                              const kwh = parseFloat(formData.consumo_mensal_kwh || 0);
                              if (kwh > 0) return kwh;
                              const reais = parseFloat(formData.consumo_mensal_reais || 0);
                              return reais > 0 ? reais / tarifaKwh : 0;
                            })();
                            // Valores financeiros: usar SEMPRE metrics do backend (sem fallback local)
                            const contaAnualEst = Number(analiseMetrics?.conta_atual_anual || 0);
                            const economiaMensalEst = Number(analiseMetrics?.economia_mensal_estimada || 0);
                            const economiaAnualEst = Number(analiseMetrics?.economia_anual_estimada || 0);
                            // Payback: SEMPRE usar o do fluxo de caixa (backend já o define em anos_payback)
                            const paybackAnos =
                              (typeof analiseMetrics?.anos_payback_fluxo === 'number' && analiseMetrics.anos_payback_fluxo >= 0)
                                ? Number(analiseMetrics.anos_payback_fluxo)
                                : (typeof analiseMetrics?.anos_payback === 'number' && analiseMetrics.anos_payback >= 0)
                                  ? Number(analiseMetrics.anos_payback)
                                  : 0;
                            const gastoAcumPayback = Number(analiseMetrics?.gasto_acumulado_payback || 0);
                            // A proposta deve usar o preço de venda
                            const precoBaseProposta = precoVenda;
                            const paybackProposta = paybackAnos;
                            const rPorKwp = potenciaKwp > 0 ? (precoVenda / potenciaKwp) : 0;
                            const rPorPlaca = quantidadePlacas > 0 ? (precoVenda / quantidadePlacas) : 0;
                            
                            return (
                              <>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="font-semibold">R$/kWp:</div>
                                  <div className="text-right font-semibold">{formatCurrency(rPorKwp)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="font-semibold">R$/Placa:</div>
                                  <div className="text-right font-semibold">{formatCurrency(rPorPlaca)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="font-semibold">Conta anual atual (estimada):</div>
                                  <div className="text-right font-semibold">{formatCurrency(contaAnualEst)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="font-semibold">Economia mensal estimada:</div>
                                  <div className="text-right font-semibold text-green-600">{formatCurrency(economiaMensalEst)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="font-semibold">Economia anual estimada:</div>
                                  <div className="text-right font-semibold text-green-600">{formatCurrency(economiaAnualEst)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="font-semibold">Preço de venda:</div>
                                  <div className="text-right font-semibold">{formatCurrency(precoVenda)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="font-semibold">Payback:</div>
                                  <div className="text-right font-semibold">{paybackProposta.toFixed(1)} anos</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="font-semibold">Gasto acumulado até o payback:</div>
                                  <div className="text-right font-semibold">{formatCurrency(gastoAcumPayback)}</div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Resumo - Variáveis Calculadas */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-indigo-600">🧮</span>
                          Resumo (custos e DRE)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {(() => {
                            const {
                              custoEquipamentos: custoEquip,
                              custoOp: op,
                              comissaoVendedor: comissaoPct,
                              precoVenda
                            } = resumoCalculos;
                            const margemDesejada = 25 + (comissaoPct || 0);
                            const valorComissao = precoVenda * ((comissaoPct || 0) / 100);
                            return (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Custo equipamentos:</span>
                                  <span className="font-semibold">{formatCurrency(op.equipamentos)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Custo instalação:</span>
                                  <span className="font-semibold">{formatCurrency(op.instalacao)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Custo CA/aterramento:</span>
                                  <span className="font-semibold">{formatCurrency(op.caAterramento)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Custo homologação:</span>
                                  <span className="font-semibold">{formatCurrency(op.homologacao)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Placas de sinalização:</span>
                                  <span className="font-semibold">{formatCurrency(op.placasSinalizacao)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Despesas de obra (10%):</span>
                                  <span className="font-semibold">{formatCurrency(op.despesasGerais)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Custo total (operacional):</span>
                                  <span className="font-bold">{formatCurrency(op.total)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Preço de venda:</span>
                                  <span className="font-bold text-blue-700">{formatCurrency(precoVenda)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Comissão vendedor:</span>
                                  <span className="font-semibold">{comissaoPct}% ({formatCurrency(valorComissao)})</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Margem desejada (total):</span>
                                  <span className="font-semibold">{margemDesejada}%</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Detalhamento completo – sem cálculos locais */}
                    <CostsDetailed
                      formData={formData}
                      resumoCalculos={resumoCalculos}
                      quantidadesCalculadas={quantidadesCalculadas}
                      kitSelecionado={kitSelecionado}
                    />

                    {/* Cálculos replicados removidos – os números exibidos vêm do backend (analise_metrics). */}
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
                            Custo Operacional
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {(() => {
                            const quantidadePlacas = quantidadesCalculadas.paineis || 0;
                            const potenciaKwp = formData.potencia_kw || 0;
                            const custoEquipamentos = kitSelecionado.precoTotal || 0;
                            const custoOp = calcularCustoOperacional(quantidadePlacas, potenciaKwp, custoEquipamentos);
                            
                            return (
                              <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Equipamentos:</span>
                                  <span className="font-semibold">{formatCurrency(custoOp.equipamentos)}</span>
                          </div>
                          <div className="flex justify-between">
                                  <span className="text-gray-600">Instalação (R$200/placa):</span>
                                  <span className="font-semibold">{formatCurrency(custoOp.instalacao)}</span>
                          </div>
                          <div className="flex justify-between">
                                  <span className="text-gray-600">CA e Aterramento (R$100/placa):</span>
                                  <span className="font-semibold">{formatCurrency(custoOp.caAterramento)}</span>
                          </div>
                          <div className="flex justify-between">
                                  <span className="text-gray-600">Homologação:</span>
                                  <span className="font-semibold">{formatCurrency(custoOp.homologacao)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Placas de Sinalização:</span>
                                  <span className="font-semibold">{formatCurrency(custoOp.placasSinalizacao)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Despesas Gerais (10%):</span>
                                  <span className="font-semibold">{formatCurrency(custoOp.despesasGerais)}</span>
                          </div>
                          <hr className="border-gray-300" />
                          <div className="flex justify-between text-lg font-bold text-green-700">
                                  <span>Custo Operacional:</span>
                                  <span>{formatCurrency(custoOp.total)}</span>
                          </div>
                              </>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      <Card className="border-blue-200 bg-blue-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            Preço de Venda
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {(() => {
                            const quantidadePlacas = quantidadesCalculadas.paineis || 0;
                            const potenciaKwp = formData.potencia_kw || 0;
                            const custoEquipamentos = kitSelecionado.precoTotal || 0;
                            const custoOp = calcularCustoOperacional(quantidadePlacas, potenciaKwp, custoEquipamentos);
                            const comissaoVendedor = formData.comissao_vendedor || 5;
                            const precoVenda = calcularPrecoVenda(custoOp.total, comissaoVendedor);
                            const margemDesejada = 25 + comissaoVendedor;
                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Custo Operacional:</span>
                                  <span className="font-semibold">{formatCurrency(custoOp.total)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Margem Desejada:</span>
                                  <span className="font-semibold">{margemDesejada}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Comissão Vendedor:</span>
                                  <span className="font-semibold">{comissaoVendedor}%</span>
                                </div>
                                <hr className="border-gray-300" />
                                <div className="flex justify-between text-lg font-bold text-blue-700">
                                  <span>Preço de Venda:</span>
                                  <span>{formatCurrency(precoVenda)}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                  Fórmula: Custo Operacional ÷ (1 - {margemDesejada/100})
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                  KPIs (economia/payback) são calculados no backend e exibidos nos Parâmetros.
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

                {/* Botão flutuante para gerar proposta e avançar para resultados */}
                {(costs || kitSelecionado) && (
                  <div className="sticky bottom-6 right-6 z-50 float-right">
                    <Button 
                      onClick={gerarPropostaEAvançar}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-300 rounded-full"
                    >
                      Gerar Proposta e Avançar
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="resultados">
                <DimensionamentoResults 
                  resultados={resultados}
                  formData={formData}
                  onSave={handleSave}
                  loading={loading}
                  projecoesFinanceiras={projecoesFinanceiras}
                  kitSelecionado={kitSelecionado}
                  clientes={clientes}
                  configs={configs}
                  autoGenerateProposta={autoGenerateProposta}
                  onAutoGenerateComplete={() => setAutoGenerateProposta(false)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}