import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { saveAs } from "file-saver";
import { baixarPdfPuppeteer } from "@/services/pdfService.js";
import { propostaService } from '../../services/propostaService';
import { Maximize2, Minimize2, Share2, Link, FileText, ChevronDown } from 'lucide-react';
import { useToast } from "@/hooks/useToast";

// Importar entities de forma lazy para evitar problemas de inicialização circular
let _Projeto = null;
let _Configuracao = null;

const getEntities = async () => {
  if (!_Projeto || !_Configuracao) {
    try {
      const entities = await import('../../entities');
      _Projeto = entities.Projeto;
      _Configuracao = entities.Configuracao;
    } catch (e) {
      console.error('Erro ao carregar entities:', e);
    }
  }
  return { Projeto: _Projeto, Configuracao: _Configuracao };
};

export default function DimensionamentoResults({ resultados, formData, onSave, loading, projecoesFinanceiras, kitSelecionado, clientes = [], configs = {}, autoGenerateProposta = false, onAutoGenerateComplete, user = null, usuarios = [], costs = null }) {
  const { toast } = useToast();
  
  // Calcular custos localmente se não foram passados
  // Isso garante que sempre temos valores para salvar na proposta
  const calcularCustosLocais = () => {
    const propostaCfg = configs?.proposta_configs || {};
    const quantidadePlacas = Number(resultados?.quantidade_placas || kitSelecionado?.quantidade_placas || 0);
    const potenciaKwp = Number(formData?.potencia_kw || resultados?.potencia_sistema_kwp || 0);
    const custoEquipamentos = Number(kitSelecionado?.precoTotal || 0);
    
    // Cálculo de instalação por placa
    const baseInstalacao = Number(propostaCfg?.instalacao_base_por_placa ?? 40) || 40;
    const percentualSeguranca = Number(propostaCfg?.instalacao_percentual_seguranca ?? 10) || 10;
    const instalacaoPorPlaca = baseInstalacao * (1 + percentualSeguranca / 100);
    const instalacao = quantidadePlacas * instalacaoPorPlaca;
    
    // Outros custos
    const caAterramento = quantidadePlacas * (Number(propostaCfg?.custo_ca_aterramento_por_placa ?? 100) || 100);
    
    // Homologação baseada na potência
    let homologacao = 800; // base
    if (potenciaKwp > 75) homologacao = 1800;
    else if (potenciaKwp > 25) homologacao = 1200;
    else if (potenciaKwp > 10) homologacao = 1000;
    
    const placasSinalizacao = Number(propostaCfg?.custo_placas_sinalizacao ?? 60) || 60;
    const despesasGeraisPct = Number(propostaCfg?.percentual_despesas_gerais ?? 10) || 10;
    const despesasGerais = instalacao * (despesasGeraisPct / 100);
    const transportePct = Number(propostaCfg?.percentual_transporte ?? 5) || 5;
    const transporte = custoEquipamentos * (transportePct / 100);
    
    const total = custoEquipamentos + transporte + instalacao + caAterramento + homologacao + placasSinalizacao + despesasGerais;
    
    return {
      equipamentos: custoEquipamentos,
      transporte,
      instalacao,
      caAterramento,
      homologacao,
      placasSinalizacao,
      despesasGerais,
      total
    };
  };
  
  // Usar costs passado ou calcular localmente
  const custosEfetivos = costs && costs.total > 0 ? costs : calcularCustosLocais();
  
  
  // Dados do vendedor: usar o RESPONSÁVEL pelo cliente (created_by), não o usuário logado
  const clienteInfo = clientes.find(c => c.id === formData?.cliente_id);
  
  // Buscar dados do vendedor responsável pelo cliente
  // PRIORIDADE: Responsável ATUAL do cliente (created_by_email após transferência)
  
  // Função auxiliar para verificar se o nome é real ou apenas derivado do email
  const isNomeReal = (nome, email) => {
    if (!nome) return false;
    // Se o nome é igual à parte antes do @ do email, não é um nome real
    const emailPrefix = (email || '').split('@')[0]?.toLowerCase() || '';
    const nomeNormalizado = (nome || '').toLowerCase().replace(/[.\s]/g, '');
    const emailPrefixNormalizado = emailPrefix.replace(/[.\s]/g, '');
    return nomeNormalizado !== emailPrefixNormalizado;
  };
  
  // Função para formatar nome a partir do email (capitaliza e substitui pontos por espaços)
  const formatarNomeDoEmail = (email) => {
    if (!email) return 'Consultor';
    const prefix = email.split('@')[0] || '';
    return prefix
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  };
  
  const getVendedorResponsavel = () => {
    // 1. Se há cliente vinculado, usar o responsável atual do cliente (pode ter sido transferido)
    if (clienteInfo) {
      const responsavelEmail = (clienteInfo.created_by_email || clienteInfo.created_by || '').toLowerCase();
      const responsavelUid = clienteInfo.created_by || '';
      
      // 1a. Se o responsável é o usuário logado, usar dados completos do usuário logado
      if (user && (user.email?.toLowerCase() === responsavelEmail || user.uid === responsavelUid)) {
        const nomeExibicao = isNomeReal(user.nome, user.email) 
          ? user.nome 
          : (user.full_name || user.name || user.displayName || formatarNomeDoEmail(user.email));
        return {
          nome: nomeExibicao,
          cargo: user.cargo || 'Consultor de Energia Solar',
          email: user.email || '',
          telefone: user.telefone || user.phone || ''
        };
      }

      // 1b. Tentar encontrar o responsável na lista de usuários
      const responsavel = usuarios.find(u => 
        (u.email && u.email.toLowerCase() === responsavelEmail) || 
        (u.uid && u.uid === responsavelUid)
      );
      
      if (responsavel) {
        const nomeExibicao = isNomeReal(responsavel.nome, responsavel.email)
          ? responsavel.nome
          : (responsavel.full_name || formatarNomeDoEmail(responsavel.email));
        return {
          nome: nomeExibicao,
          cargo: responsavel.cargo || 'Consultor de Energia Solar',
          email: responsavel.email || '',
          telefone: responsavel.telefone || responsavel.phone || ''
        };
      }
      
      // 1c. Se não encontrou o usuário na lista, usar o email formatado como nome
      if (responsavelEmail && responsavelEmail.includes('@')) {
        return {
          nome: formatarNomeDoEmail(responsavelEmail),
          cargo: 'Consultor de Energia Solar',
          email: responsavelEmail,
          telefone: ''
        };
      }
    }
    
    // 2. Sem cliente vinculado ou responsável não encontrado: usar usuário logado
    const nomeExibicao = isNomeReal(user?.nome, user?.email)
      ? user?.nome
      : (user?.full_name || user?.name || user?.displayName || formatarNomeDoEmail(user?.email) || 'Consultor');
    return {
      nome: nomeExibicao,
      cargo: user?.cargo || 'Consultor de Energia Solar',
      email: user?.email || '',
      telefone: user?.telefone || user?.phone || ''
    };
  };
  
  const vendedorDados = getVendedorResponsavel();
  const [propostaSalva, setPropostaSalva] = useState(false);
  const [propostaId, setPropostaId] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [templateContent, setTemplateContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [propostaData, setPropostaData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const pdfRef = useRef(null);
  const shareMenuRef = useRef(null);
  const iframeContainerRef = useRef(null);
  const autoTimerRef = useRef(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (iframeContainerRef.current) {
        iframeContainerRef.current.requestFullscreen().catch(err => {
          console.error(`Erro ao tentar entrar em tela cheia: ${err.message}`);
        });
      }
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Fechar menu de compartilhar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Função para obter dados seguros com fallbacks
  // Funções auxiliares para calcular valores financeiros
  const formatEnderecoResumido = useCallback((enderecoRaw = '', cidade = '') => {
    try {
      if (!enderecoRaw && !cidade) return 'Endereço não informado';
      const parts = enderecoRaw.split(',').map(p => (p || '').trim()).filter(Boolean);
      const rua = parts[0] || '';
      let numero = '';
      if (parts.length > 1) {
        for (const p of parts.slice(1, 3)) {
          if (/\d/.test(p)) { numero = p.trim(); break; }
        }
        if (!numero) numero = parts[1].trim();
      }
      const city = cidade || parts.slice(-1)[0] || '';
      if (rua && numero && city) return `${rua}, ${numero} - ${city}`;
      if (rua && city) return `${rua} - ${city}`;
      return enderecoRaw || city || 'Endereço não informado';
    } catch {
      return enderecoRaw || 'Endereço não informado';
    }
  }, []);
  // Calcula conta anual atual do cliente
  const calcularContaAtualAnual = useCallback(() => {
    const consumoReais = Number(formData?.consumo_mensal_reais) || 0;
    if (consumoReais > 0) return consumoReais * 12;
    
    const consumoKwh = Number(formData?.consumo_mensal_kwh) || 0;
    const tarifa = Number(formData?.tarifa_energia) || 0.75;
    if (consumoKwh > 0) return consumoKwh * tarifa * 12;
    
    return 0;
  }, [formData]);

  // Obtém dados seguros com fallbacks apropriados
  const getDadosSeguros = useCallback(() => {
    const contaAtualAnual = calcularContaAtualAnual();
    const dadosBase = resultados || {};
    const kit = kitSelecionado || {};
    const projecoes = projecoesFinanceiras || {};

    // Calcular quantidade de placas e potência da placa
    // Os componentes do kit usam 'agrupamento' = 'Painel' (não 'tipo')
    let quantidade_placas = 0;
    let potencia_placa_w = 0;
    
    // Tentar encontrar nos componentes do kit
    const componentes = kit.componentes || kit.composicao || [];
    if (Array.isArray(componentes)) {
      // Filtrar todos os painéis e somar quantidades
      const paineis = componentes.filter(item => 
        item.agrupamento === 'Painel' || item.tipo === 'painel' || item.tipo === 'Painel'
      );
      paineis.forEach(painel => {
        quantidade_placas += Number(painel.quantidade || painel.qtd || 0);
        // Potência: pegar do primeiro painel que tiver
        if (!potencia_placa_w && painel.potencia) {
          potencia_placa_w = Number(painel.potencia) || 0;
        }
      });
    }
    
    console.log('📊 getDadosSeguros - Kit:', kit);
    console.log('📊 getDadosSeguros - Componentes:', componentes);
    console.log('📊 getDadosSeguros - Quantidade placas:', quantidade_placas, 'Potência:', potencia_placa_w);

    // Calcular economia mensal estimada alinhada com a aba de Custos
    const tarifaKwhCalc = (Number(formData?.tarifa_energia) > 0 && Number(formData?.tarifa_energia) <= 10)
      ? Number(formData.tarifa_energia)
      : 0;
    const consumoMensalKwhBase = (() => {
      const kwh = Number(formData?.consumo_mensal_kwh) || 0;
      if (kwh > 0) return kwh;
      const reais = Number(formData?.consumo_mensal_reais) || 0;
      return (reais > 0 && tarifaKwhCalc > 0) ? (reais / tarifaKwhCalc) : 0;
    })();
    const prodMensalEst = (() => {
      const a = Number(projecoes?.geracao_mensal_estimada || projecoes?.geracao_media_mensal || 0);
      if (a > 0) return a;
      const b = Number(resultados?.geracao_media_mensal || 0);
      if (b > 0) return b;
      const pot = Number(dadosBase?.potencia_sistema_kwp || kit?.potencia || 0);
      const irr = Number(formData?.irradiacao_media || 5.15) || 5.15;
      const pr = 0.85;
      return pot > 0 ? pot * irr * 30.4 * pr : 0;
    })();
    const economiaMensalEstCalc = (tarifaKwhCalc > 0)
      ? Math.min(Math.max(consumoMensalKwhBase, 0), Math.max(prodMensalEst, 0)) * tarifaKwhCalc
      : 0;

    const dadosSeguros = {
      // Potência: priorizar a que está no formulário (dimensionamento atual)
      potencia_sistema_kwp: (Number(formData?.potencia_kw) || 0) > 0
        ? Number(formData.potencia_kw)
        : (dadosBase.potencia_sistema_kwp || kit.potencia || 0),
      quantidade_placas: quantidade_placas,
      potencia_placa_w: potencia_placa_w,
      // Prioriza o preço de venda calculado e salvo no form
      preco_final: formData?.preco_venda || (dadosBase.preco_final ?? dadosBase.preco_venda) || kit.precoTotal || 0,
      economia_mensal_estimada: economiaMensalEstCalc || projecoes.economia_mensal_estimada || 0,
      payback_meses: projecoes.payback_meses || 0,
      economia_total_25_anos: projecoes.economia_total_25_anos || 0,
      consumo_mensal_kwh: formData?.consumo_mensal_kwh || consumoMensalKwhBase || 0,
      irradiacao_media: formData?.irradiancia_media || formData?.irradiacao_media || 5.15,
      geracao_media_mensal: prodMensalEst || projecoes.geracao_media_mensal || 0,
      creditos_anuais: projecoes.creditos_anuais || 0,
      area_necessaria: Math.round((quantidade_placas || 0) * 2.5) || kit.area || 0, // Usar área do kit se disponível
      custo_total_projeto: projecoes.custo_total_projeto || kit.precoTotal || 0,
      custo_equipamentos: projecoes.custo_equipamentos || kit.precoTotal || 0,  // Fallback para preço do kit
      custo_instalacao: projecoes.custo_instalacao || 0,
      custo_homologacao: projecoes.custo_homologacao || 0,
      custo_outros: projecoes.custo_outros || 0,
      margem_lucro: projecoes.margem_lucro || 0,
      // Tarifa: não derive com divisão por 1; use apenas o valor válido do formulário
      tarifa_energia: (Number(formData?.tarifa_energia) > 0 && Number(formData?.tarifa_energia) <= 10)
        ? Number(formData.tarifa_energia)
        : 0,
    };

    return dadosSeguros;
  }, [resultados, formData, projecoesFinanceiras, kitSelecionado, calcularContaAtualAnual]);

  const dadosSeguros = getDadosSeguros();

  // Função para converter imagem para base64
  const convertImageToBase64 = async (imagePath) => {
    try {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Erro ao converter imagem para base64:', error);
      return null;
    }
  };

  // Nota: o PDF deve usar SEMPRE o HTML processado pelo backend (com variáveis + imagens + gráficos).
  // Evitamos carregar o template cru do /public aqui para não sobrescrever o HTML do servidor.

  const salvarProposta = async () => {
    if (isGeneratingPDF || propostaSalva) return;
    setIsGeneratingPDF(true);

    try {

      // Obter tarifa - DEVE ser um valor exato, sem fallbacks
      let tarifaParaEnvio = (Number(formData?.tarifa_energia) > 0 && Number(formData?.tarifa_energia) <= 10)
        ? Number(formData.tarifa_energia)
        : 0;
      
      // Se não tiver tarifa válida, tentar buscar pela concessionária
      if ((!tarifaParaEnvio || tarifaParaEnvio <= 0 || tarifaParaEnvio > 10) && formData?.concessionaria) {
        try {
          // Carregar entities de forma segura (lazy)
          const { Configuracao } = await getEntities();
          if (Configuracao && typeof Configuracao.getTarifaByConcessionaria === 'function') {
            const t = await Configuracao.getTarifaByConcessionaria(formData.concessionaria);
            if (t && t > 0 && t <= 10) {
              tarifaParaEnvio = t;
            }
          }
        } catch (tarifaErr) {
          console.error('Erro ao buscar tarifa da concessionária:', tarifaErr);
          // NÃO usar fallback - propagar o erro
        }
      }
      
      // Validar tarifa - é obrigatório ter um valor exato
      if (!tarifaParaEnvio || tarifaParaEnvio <= 0) {
        throw new Error('Tarifa de energia não informada. Selecione a concessionária ou informe a tarifa manualmente.');
      }
      // Derivar consumo kWh:
      // 1) Preferir média a partir do vetor mês a mês se existir
      let consumoKwhParaEnvio = 0;
      if (Array.isArray(formData?.consumo_mes_a_mes) && formData.consumo_mes_a_mes.length > 0) {
        try {
          const soma = formData.consumo_mes_a_mes.reduce((acc, item) => {
            const v = Number((item && item.kwh) || 0);
            return acc + (isFinite(v) ? v : 0);
          }, 0);
          const media = soma / 12;
          if (media > 0) consumoKwhParaEnvio = media;
        } catch (_) {}
      }
      // 2) Senão, usar o campo direto de kWh mensal
      if (consumoKwhParaEnvio <= 0) {
        consumoKwhParaEnvio = Number(formData?.consumo_mensal_kwh) || 0;
      }
      // 3) Senão, derivar de R$ / tarifa
      if ((consumoKwhParaEnvio <= 0) && Number(formData?.consumo_mensal_reais) > 0 && tarifaParaEnvio > 0) {
        consumoKwhParaEnvio = Number(formData.consumo_mensal_reais) / tarifaParaEnvio;
      }

      // Preparar dados da proposta para o servidor
      const clienteInfo = clientes.find(c => c.id === formData?.cliente_id);
      
      // IMPORTANTE: Reutilizar o ID existente para evitar duplicatas
      // Prioridade: propostaId do estado > projeto_id da URL > formData.proposta_id
      let projetoIdUrl = null;
      try {
        const urlParams = new URLSearchParams(window.location.search);
        projetoIdUrl = urlParams.get('projeto_id');
      } catch (e) {
        console.warn('Erro ao ler URL params:', e);
      }
      const idExistente = propostaId || projetoIdUrl || formData?.proposta_id || formData?.id || null;
      
      const propostaData = {
        // ID existente para fazer update em vez de criar nova proposta
        ...(idExistente ? { id: idExistente, proposta_id: idExistente, projeto_id: idExistente } : {}),
        // Identificação do criador (para filtros por usuário)
        created_by: user?.uid || null,
        created_by_email: user?.email || null,
        // Campos do CRM (para reabrir em "Editar proposta" com tudo preenchido)
        nome_projeto: formData?.nome_projeto || formData?.nome || null,
        cep: formData?.cep || clienteInfo?.cep || null,
        logradouro: formData?.logradouro || null,
        numero: formData?.numero || null,
        complemento: formData?.complemento || null,
        bairro: formData?.bairro || null,
        estado: formData?.estado || formData?.uf || null,
        tipo_telhado: formData?.tipo_telhado || null,
        tensao: formData?.tensao || null,
        cliente_id: formData?.cliente_id,
        cliente_nome: clienteInfo?.nome,
        // Endereço deve vir da aba Dados Básicos (formData.endereco_completo)
        cliente_endereco: formData?.endereco_completo || clienteInfo?.endereco_completo,
        cliente_telefone: clienteInfo?.telefone,
        potencia_sistema: (Number(formData?.potencia_kw) || 0) > 0
          ? Number(formData.potencia_kw)
          : dadosSeguros.potencia_sistema_kwp,
        // A proposta deve usar o preço de venda; enviamos explicitamente
        // Importante: formData.preco_venda às vezes vem como string "892.857" (milhar BR).
        // Number("892.857") => 892.857 (errado). Normalizar antes.
        preco_venda: (() => {
          const v = formData?.preco_venda ?? dadosSeguros?.preco_final;
          if (v === undefined || v === null) return undefined;
          if (typeof v === 'number') return v;
          const s = String(v).replace(/\s+/g, '').replace('R$', '');
          // "10.495,50" -> "10495.50"; "892.857" -> "892857"
          const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
          const n = Number(normalized);
          return Number.isFinite(n) ? n : undefined;
        })(),
        preco_final: (() => {
          const v = formData?.preco_venda ?? dadosSeguros?.preco_final;
          if (v === undefined || v === null) return undefined;
          if (typeof v === 'number') return v;
          const s = String(v).replace(/\s+/g, '').replace('R$', '');
          const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
          const n = Number(normalized);
          return Number.isFinite(n) ? n : undefined;
        })(),
        concessionaria: formData?.concessionaria,
        cidade: formData?.cidade,
        vendedor_nome: vendedorDados.nome,
        vendedor_cargo: vendedorDados.cargo,
        vendedor_telefone: vendedorDados.telefone,
        vendedor_email: vendedorDados.email,
        // Dados financeiros (serão calculados pelo backend)
        consumo_mensal_kwh: consumoKwhParaEnvio,
        consumo_mes_a_mes: Array.isArray(formData?.consumo_mes_a_mes) ? formData.consumo_mes_a_mes : undefined,
        tarifa_energia: tarifaParaEnvio,
        // Dados do kit
        quantidade_placas: dadosSeguros.quantidade_placas,
        potencia_placa_w: dadosSeguros.potencia_placa_w,
        area_necessaria: dadosSeguros.area_necessaria,
        irradiacao_media: dadosSeguros.irradiacao_media,
        geracao_media_mensal: dadosSeguros.geracao_media_mensal,
        creditos_anuais: dadosSeguros.creditos_anuais,
        economia_total_25_anos: dadosSeguros.economia_total_25_anos,
        // Custos gerais (campos individuais para colunas do banco)
        custo_total_projeto: dadosSeguros.custo_total_projeto,
        custo_equipamentos: dadosSeguros.custo_equipamentos || custosEfetivos?.equipamentos || 0,
        custo_instalacao: dadosSeguros.custo_instalacao || custosEfetivos?.instalacao || 0,
        custo_homologacao: dadosSeguros.custo_homologacao || custosEfetivos?.homologacao || 0,
        custo_outros: dadosSeguros.custo_outros,
        margem_lucro: dadosSeguros.margem_lucro,
        // Custos detalhados como campos individuais (para colunas do banco)
        custo_transporte: custosEfetivos?.transporte || 0,
        custo_ca_aterramento: custosEfetivos?.caAterramento || 0,
        custo_placas_sinalizacao: custosEfetivos?.placasSinalizacao || 0,
        custo_despesas_gerais: custosEfetivos?.despesasGerais || 0,
        custo_operacional: custosEfetivos?.total || 0,
        
        // Custos DETALHADOS (objeto para compatibilidade)
        custos_detalhados: {
          kit_fotovoltaico: custosEfetivos?.equipamentos || 0,
          transporte: custosEfetivos?.transporte || 0,
          instalacao: custosEfetivos?.instalacao || 0,
          ca_aterramento: custosEfetivos?.caAterramento || 0,
          homologacao: custosEfetivos?.homologacao || 0,
          placas_sinalizacao: custosEfetivos?.placasSinalizacao || 0,
          despesas_gerais: custosEfetivos?.despesasGerais || 0,
          custo_operacional: custosEfetivos?.total || 0,
        },
        
        // DRE do Projeto (valores calculados e salvos permanentemente)
        // Normalizar preço de venda para evitar problemas com strings mal formatadas
        valor_comissao: (() => {
          // Função auxiliar para normalizar o preço (mesma lógica de preco_venda acima)
          const normalizarPreco = (v) => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const s = String(v).replace(/\s+/g, '').replace('R$', '');
            const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
            const n = Number(normalized);
            return Number.isFinite(n) ? n : 0;
          };
          const pv = normalizarPreco(formData?.preco_venda) || normalizarPreco(dadosSeguros?.preco_final) || 0;
          const pct = Number(formData?.comissao_vendedor || 6);
          return pv * (pct / 100);
        })(),
        despesas_obra: (custosEfetivos?.instalacao || 0) + (custosEfetivos?.caAterramento || 0),
        despesas_diretoria: (() => {
          const normalizarPreco = (v) => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const s = String(v).replace(/\s+/g, '').replace('R$', '');
            const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
            const n = Number(normalized);
            return Number.isFinite(n) ? n : 0;
          };
          const pv = normalizarPreco(formData?.preco_venda) || normalizarPreco(dadosSeguros?.preco_final) || 0;
          return pv * 0.01; // 1%
        })(),
        impostos: (() => {
          const normalizarPreco = (v) => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const s = String(v).replace(/\s+/g, '').replace('R$', '');
            const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
            const n = Number(normalized);
            return Number.isFinite(n) ? n : 0;
          };
          const pv = normalizarPreco(formData?.preco_venda) || normalizarPreco(dadosSeguros?.preco_final) || 0;
          return pv * 0.033; // 3.3%
        })(),
        lldi: (() => {
          const normalizarPreco = (v) => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const s = String(v).replace(/\s+/g, '').replace('R$', '');
            const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
            const n = Number(normalized);
            return Number.isFinite(n) ? n : 0;
          };
          const pv = normalizarPreco(formData?.preco_venda) || normalizarPreco(dadosSeguros?.preco_final) || 0;
          const custoOp = custosEfetivos?.total || 0;
          const pct = Number(formData?.comissao_vendedor || 6);
          const comissao = pv * (pct / 100);
          const despDir = pv * 0.01;
          const imp = pv * 0.033;
          return pv - custoOp - comissao - despDir - imp;
        })(),
        divisao_lucro: (() => {
          const normalizarPreco = (v) => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const s = String(v).replace(/\s+/g, '').replace('R$', '');
            const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
            const n = Number(normalized);
            return Number.isFinite(n) ? n : 0;
          };
          const pv = normalizarPreco(formData?.preco_venda) || normalizarPreco(dadosSeguros?.preco_final) || 0;
          const custoOp = custosEfetivos?.total || 0;
          const pct = Number(formData?.comissao_vendedor || 6);
          const comissao = pv * (pct / 100);
          const despDir = pv * 0.01;
          const imp = pv * 0.033;
          const lldi = pv - custoOp - comissao - despDir - imp;
          return lldi * 0.4; // 40%
        })(),
        fundo_caixa: (() => {
          const normalizarPreco = (v) => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const s = String(v).replace(/\s+/g, '').replace('R$', '');
            const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
            const n = Number(normalized);
            return Number.isFinite(n) ? n : 0;
          };
          const pv = normalizarPreco(formData?.preco_venda) || normalizarPreco(dadosSeguros?.preco_final) || 0;
          const custoOp = custosEfetivos?.total || 0;
          const pct = Number(formData?.comissao_vendedor || 6);
          const comissao = pv * (pct / 100);
          const despDir = pv * 0.01;
          const imp = pv * 0.033;
          const lldi = pv - custoOp - comissao - despDir - imp;
          return lldi * 0.2; // 20%
        })(),
        
        // Formas de Pagamento (valores calculados e salvos permanentemente)
        preco_avista: (() => {
          const normalizarPreco = (v) => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const s = String(v).replace(/\s+/g, '').replace('R$', '');
            const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
            const n = Number(normalized);
            return Number.isFinite(n) ? n : 0;
          };
          const pv = normalizarPreco(formData?.preco_venda) || normalizarPreco(dadosSeguros?.preco_final) || 0;
          return pv * 0.95; // 5% de desconto
        })(),
        desconto_avista: 5,
        parcelas_json: (() => {
          const normalizarPreco = (v) => {
            if (v === undefined || v === null || v === '') return 0;
            if (typeof v === 'number') return v;
            const s = String(v).replace(/\s+/g, '').replace('R$', '');
            const normalized = (s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
            const n = Number(normalized);
            return Number.isFinite(n) ? n : 0;
          };
          const pv = normalizarPreco(formData?.preco_venda) || normalizarPreco(dadosSeguros?.preco_final) || 0;
          const taxaFin = 0.0149; // 1.49% a.m.
          const cartao = [3, 6, 10, 12].map(n => ({ qtd: n, valor: pv / n, tipo: 'cartao' }));
          const financiamento = [36, 48, 60, 72].map(n => {
            const pmt = pv * (taxaFin * Math.pow(1 + taxaFin, n)) / (Math.pow(1 + taxaFin, n) - 1);
            return { qtd: n, valor: pmt, tipo: 'financiamento' };
          });
          return [...cartao, ...financiamento];
        })(),
        
        // Comissão do vendedor (vem da aba de custos)
        comissao_vendedor: formData?.comissao_vendedor,
        // Margem/produção adicional (%, R$ ou kWh)
        margem_adicional_percentual: formData?.margem_adicional_percentual,
        margem_adicional_kwh: formData?.margem_adicional_kwh,
        margem_adicional_reais: formData?.margem_adicional_reais,
        // Potência (para persistir o valor calculado)
        potencia_kw: formData?.potencia_kw || dadosSeguros.potencia_sistema_kwp,
        // Consumo mensal em R$ (recalculado com tarifa atual para consistência)
        consumo_mensal_reais: (consumoKwhParaEnvio > 0 && tarifaParaEnvio > 0) 
          ? consumoKwhParaEnvio * tarifaParaEnvio 
          : formData?.consumo_mensal_reais
      };

      // Extrair equipamentos do kit (marca/modelo/tipo) para proposta
      try {
        const kit = kitSelecionado || {};
        const comps = Array.isArray(kit.componentes)
          ? kit.componentes
          : (Array.isArray(kit.composicao) ? kit.composicao : []);

        const pickFirst = (group) => comps.find(c => (c?.agrupamento || c?.tipo || '').toString().toLowerCase() === group);

        // Painel: no NovoProjeto vem como agrupamento "Painel"
        const painel = comps.find(c => (c?.agrupamento || '').toString().toLowerCase() === 'painel')
          || pickFirst('painel');
        // Inversor: no NovoProjeto vem como agrupamento "Inversor"
        const inversor = comps.find(c => (c?.agrupamento || '').toString().toLowerCase() === 'inversor')
          || pickFirst('inversor');

        const norm = (v) => (v == null ? '' : String(v).trim());
        const descPainel = norm(painel?.descricao || painel?.nome || '');
        const descInversor = norm(inversor?.descricao || inversor?.nome || '');

        propostaData.modulo_marca = norm(painel?.marca || '');
        propostaData.modulo_modelo = norm(painel?.modelo || descPainel);

        propostaData.inversor_marca = norm(inversor?.marca || '');
        propostaData.inversor_modelo = norm(inversor?.modelo || descInversor);

        const d = (descInversor || '').toLowerCase();
        if (d.includes('micro')) propostaData.tipo_inversor = 'Microinversor';
        else if (d.includes('híbrido') || d.includes('hibrido')) propostaData.tipo_inversor = 'Híbrido';
        else if (descInversor) propostaData.tipo_inversor = 'String';
      } catch (_) {}

      // 1) Geração dos gráficos antes de salvar (analise financeira)
      try {
        // SEMPRE recalcular consumo em R$ usando a tarifa atual da concessionária
        // O valor informado pelo usuário pode ser de uma conta antiga com tarifa diferente
        let consumoReaisParaEnvio = 0;
        if (consumoKwhParaEnvio > 0 && tarifaParaEnvio > 0) {
          consumoReaisParaEnvio = consumoKwhParaEnvio * tarifaParaEnvio;
        } else {
          // Fallback: usar valor informado apenas se não tiver kWh
          consumoReaisParaEnvio = Number(formData?.consumo_mensal_reais) || 0;
        }

        const graficosPayload = {
          consumo_mensal_kwh: consumoKwhParaEnvio || undefined,
          consumo_mensal_reais: consumoReaisParaEnvio > 0 ? consumoReaisParaEnvio : undefined,
          tarifa_energia: tarifaParaEnvio || 0,
          potencia_sistema: propostaData.potencia_sistema,
          preco_venda: propostaData.preco_venda,
          irradiacao_media: propostaData.irradiacao_media,
          irradiancia_mensal_kwh_m2_dia: formData?.irradiancia_mensal_kwh_m2_dia || undefined,
        };
        // Enviar vetor de consumo mês a mês quando informado (o backend aceita diversas chaves)
        if (Array.isArray(formData?.consumo_mes_a_mes) && formData.consumo_mes_a_mes.length > 0) {
          const arrKwh = formData.consumo_mes_a_mes.map(m => Number((m && m.kwh) || 0));
          graficosPayload.consumo_mensal_kwh_meses = arrKwh;
          graficosPayload.consumo_mes_a_mes_kwh = arrKwh;
          graficosPayload.consumo_kwh_mensal = arrKwh;
        }
        const graficosResp = await propostaService.gerarGraficos(graficosPayload);
        if (graficosResp?.graficos_base64) {
          propostaData.graficos_base64 = graficosResp.graficos_base64;
        }
        // Sempre usar as métricas do backend como fonte única
        const m = graficosResp?.metrics || {};
        if (typeof m.economia_mensal_estimada === 'number') {
          propostaData.economia_mensal_estimada = m.economia_mensal_estimada;
        }
        // Preferir SEMPRE o payback do fluxo: anos_payback_fluxo -> anos_payback
        let preferPaybackAnos = 0;
        if (typeof m.anos_payback_fluxo === 'number' && m.anos_payback_fluxo >= 0) {
          preferPaybackAnos = m.anos_payback_fluxo;
        } else if (typeof m.anos_payback === 'number' && m.anos_payback >= 0) {
          preferPaybackAnos = m.anos_payback;
        } else if (typeof m.payback_anos_excel === 'number' && m.payback_anos_excel > 0) {
          preferPaybackAnos = m.payback_anos_excel;
        } else if (typeof m.anos_payback_formula === 'number' && m.anos_payback_formula > 0) {
          preferPaybackAnos = m.anos_payback_formula;
        }
        if (preferPaybackAnos > 0) {
          propostaData.anos_payback = preferPaybackAnos;
          propostaData.payback_anos = preferPaybackAnos;
          // Meses: preferir payback_meses (excel) → senão derivar
          const preferPaybackMeses = (typeof m.payback_meses_fluxo === 'number' && m.payback_meses_fluxo > 0)
            ? Math.round(m.payback_meses_fluxo)
            : (typeof m.payback_meses === 'number' && m.payback_meses > 0)
            ? Math.round(m.payback_meses)
            : (typeof m.payback_meses_excel === 'number' && m.payback_meses_excel > 0
              ? Math.round(m.payback_meses_excel)
              : Math.round(preferPaybackAnos * 12));
          propostaData.payback_meses = preferPaybackMeses;
        }
        if (typeof m.conta_atual_anual === 'number') {
          propostaData.conta_atual_anual = m.conta_atual_anual;
        }
        if (typeof m.gasto_acumulado_payback === 'number') {
          propostaData.gasto_acumulado_payback = m.gasto_acumulado_payback;
        } else if (propostaData.conta_atual_anual > 0 && propostaData.anos_payback > 0) {
          propostaData.gasto_acumulado_payback = propostaData.conta_atual_anual * propostaData.anos_payback;
        }
        // Persistir as métricas no payload
        propostaData.metrics = m;
      } catch (e) {
        // Erro não crítico ao gerar gráficos
      }

      // Salvar no servidor e gerar HTML usando o mesmo ID
      const htmlResult = await propostaService.salvarEGerarHTML(propostaData);
      
      if (!htmlResult.success) {
        throw new Error(htmlResult.message);
      }

      const propostaId = htmlResult.proposta_id;

      // Atualizar projeto: status e vínculo ao cliente
      try {
        let projetoId = null;
        try {
          const urlParams = new URLSearchParams(window.location.search);
          projetoId = urlParams.get('projeto_id');
        } catch (urlErr) {
          console.warn('Erro ao ler URL params:', urlErr);
        }
        
        if (projetoId) {
          // Carregar Projeto de forma segura (lazy)
          const { Projeto } = await getEntities();
          if (Projeto && typeof Projeto.update === 'function') {
            const clienteNome = (clientes.find(c => c.id === formData?.cliente_id)?.nome) || formData?.cliente_nome || null;
            // Não bloquear a geração/preview da proposta por falhas ou travas no Supabase.
            // (quando o Supabase entra em loop de refresh_token, esse await pode "pendurar" e deixar a UI em "Gerando...")
            Promise.race([
              Projeto.update(projetoId, {
                ...formData,
                status: 'dimensionamento',
                cliente_id: formData?.cliente_id || null,
                cliente_nome: clienteNome || undefined,
                preco_final: propostaData.preco_venda || propostaData.preco_final || dadosSeguros?.preco_final || undefined,
                preco_venda: propostaData.preco_venda || propostaData.preco_final || dadosSeguros?.preco_final || undefined,
                potencia_kw: propostaData.potencia_sistema || formData?.potencia_kw || undefined,
                potencia_sistema: propostaData.potencia_sistema || formData?.potencia_kw || undefined,
                consumo_mensal_kwh: propostaData.consumo_mensal_kwh || formData?.consumo_mensal_kwh || undefined,
                consumo_mes_a_mes: propostaData.consumo_mes_a_mes || formData?.consumo_mes_a_mes || [],
                tarifa_energia: propostaData.tarifa_energia || formData?.tarifa_energia || undefined,
                margem_adicional_percentual: formData?.margem_adicional_percentual || '',
                margem_adicional_kwh: formData?.margem_adicional_kwh || '',
                margem_adicional_reais: formData?.margem_adicional_reais || '',
                proposta_id: propostaId,
                url_proposta: propostaService.getPropostaURL(propostaId),
                custo_equipamentos: propostaData.custo_equipamentos || propostaData.custos_detalhados?.kit_fotovoltaico || 0,
                custo_transporte: propostaData.custos_detalhados?.transporte || 0,
                custo_instalacao: propostaData.custo_instalacao || propostaData.custos_detalhados?.instalacao || 0,
                custo_ca_aterramento: propostaData.custos_detalhados?.ca_aterramento || 0,
                custo_homologacao: propostaData.custo_homologacao || propostaData.custos_detalhados?.homologacao || 0,
                custo_placas_sinalizacao: propostaData.custos_detalhados?.placas_sinalizacao || 0,
                custo_despesas_gerais: propostaData.custos_detalhados?.despesas_gerais || 0,
                custo_operacional: propostaData.custos_detalhados?.custo_operacional || 0,
                custos_detalhados: propostaData.custos_detalhados,
                comissao_vendedor: propostaData.comissao_vendedor || formData?.comissao_vendedor || 6,
                margem_lucro: dadosSeguros?.margem_lucro || 0,
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar projeto')), 3500)),
            ]).catch(() => {});
          }
        }
      } catch (e) {
        // Erro não crítico
      }

      // Salvar dados para preview
      setPropostaData(propostaData);
      setPropostaId(propostaId);
      setPropostaSalva(true);
      setShowPreview(true);
      
      // Buscar o HTML processado para permitir a geração do PDF via cliente
      try {
        const htmlData = await propostaService.gerarPropostaHTML(propostaId);
        if (htmlData && htmlData.html_content) {
          setTemplateContent(htmlData.html_content);
        }
      } catch (errHtml) {
        // Erro não crítico
      }
      
    } catch (error) {
      toast({ title: "Erro", description: 'Erro ao salvar proposta: ' + error.message, variant: "destructive" });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // useEffect para auto-geração da proposta
  // IMPORTANTE: Não gerar nova proposta se já existe uma salva (evita duplicatas)
  useEffect(() => {
    // Verificar se já existe uma proposta salva (pelo estado ou pela URL)
    let projetoIdUrl = null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      projetoIdUrl = urlParams.get('projeto_id');
    } catch (e) {
      console.warn('Erro ao ler URL params:', e);
    }
    const jaTemProposta = propostaSalva || propostaId || projetoIdUrl;
    
    if (autoGenerateProposta && formData && !showPreview && !jaTemProposta && !isGeneratingPDF) {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
      }
      autoTimerRef.current = setTimeout(() => {
        salvarProposta();
        autoTimerRef.current = null;
      }, 800);
    }
    
    // Se já tem proposta e o usuário clicou em "Gerar e Continuar" novamente, apenas mostrar preview
    if (autoGenerateProposta && jaTemProposta && !showPreview && !isGeneratingPDF) {
      setShowPreview(true);
    }
  }, [autoGenerateProposta, formData, showPreview, kitSelecionado, projecoesFinanceiras, propostaSalva, propostaId, isGeneratingPDF]);

  // useEffect para notificar quando a auto-geração for concluída
  useEffect(() => {
    if (showPreview && autoGenerateProposta && onAutoGenerateComplete) {
      onAutoGenerateComplete();
    }
  }, [showPreview, autoGenerateProposta, onAutoGenerateComplete]);

  // Função para carregar template para preview
  const loadTemplateForPreview = async (proposta) => {
    try {
      // Usar o HTML já processado pelo servidor Python (que substitui todas as 109 variáveis)
      // Em vez de fazer substituições locais limitadas
      // O templateContent já foi definido pelo servidor Python com todas as variáveis substituídas
      
    } catch (error) {
      // Erro ao carregar template
    }
  };

  // Função para gerar PDF (somente Puppeteer backend: idêntico ao template.html)
  const gerarPDF = async () => {
    if (!propostaId) {
      toast({ title: "Atenção", description: "Proposta não salva. Gere a proposta primeiro.", variant: "warning" });
      return;
    }
    setIsGeneratingPDF(true);
    try {
      const blob = await baixarPdfPuppeteer(propostaId);
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yy = String(now.getFullYear()).slice(-2);
        const clienteNomeRaw = (propostaData?.cliente_nome || "CLIENTE").trim();
        const clienteNomeSafe = clienteNomeRaw
          .replace(/[\\/:*?"<>|]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        // Obs: "/" não é permitido em nome de arquivo -> usamos DD-MM-YY
        const fileName = `${clienteNomeSafe} - ${dd}-${mm}-${yy} - FOHAT ENERGIA SOLAR.pdf`;
      saveAs(blob, fileName);
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao gerar PDF: " + (e?.message || e), variant: "destructive" });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <motion.div
      ref={pdfRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 bg-white p-6"
    >
      {/* Header com botões de ação */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Proposta Comercial</h1>
        <div className="flex gap-4">
        {!showPreview ? (
          <Button onClick={salvarProposta} disabled={isGeneratingPDF} className="bg-primary hover:bg-primary-dark text-white">
            {isGeneratingPDF ? 'Gerando...' : 'Gerar Proposta'}
          </Button>
        ) : (
            <>
              <Button onClick={toggleFullscreen} variant="outline" title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button onClick={gerarPDF} disabled={isGeneratingPDF} className="bg-green-600 hover:bg-green-700 text-white">
                {isGeneratingPDF ? 'Gerando PDF...' : 'Download PDF'}
              </Button>
              <Button onClick={() => window.location.href = '/'} className="bg-slate-600 hover:bg-slate-700 text-white">
                Salvar e Sair
              </Button>
              <div className="relative" ref={shareMenuRef}>
                <Button 
                  variant="outline" 
                  onClick={() => setShowShareMenu(!showShareMenu)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Compartilhar
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
                {showShareMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      onClick={() => {
                        const url = propostaService.getPropostaURL(propostaId);
                        navigator.clipboard.writeText(url).then(() => {
                          toast({ title: "Sucesso", description: "Link copiado!", variant: "success" });
                        }).catch(() => {
                          // Fallback: usar prompt para copiar manualmente
                          prompt('Copie o link abaixo:', url);
                        });
                        setShowShareMenu(false);
                      }}
                    >
                      <Link className="w-4 h-4" />
                      Copiar Link
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      onClick={() => {
                        const url = propostaService.getPropostaURL(propostaId);
                        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent('Confira esta proposta de energia solar: ' + url)}`;
                        window.open(whatsappUrl, '_blank');
                        setShowShareMenu(false);
                      }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Enviar por WhatsApp
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      onClick={async () => {
                        setShowShareMenu(false);
                        await gerarPDF();
                      }}
                    >
                      <FileText className="w-4 h-4" />
                      Compartilhar PDF
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview da proposta (Iframe) */}
      {showPreview && propostaId ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Proposta gerada com sucesso!</span>
            </div>
          </div>
          
          <div 
            ref={iframeContainerRef}
            className={`w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-100 shadow-inner ${isFullscreen ? 'h-screen' : 'h-[800px]'}`}
          >
            <iframe 
              src={propostaService.getPropostaURL(propostaId)}
              className="w-full h-full border-0"
              title="Proposta Comercial"
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">Proposta Comercial</h3>
            <p className="text-gray-600 mb-6">Clique em "Gerar Proposta" para criar e visualizar sua proposta comercial personalizada.</p>
            <Button onClick={salvarProposta} disabled={isGeneratingPDF} className="bg-primary hover:bg-primary-dark text-white">
              {isGeneratingPDF ? 'Gerando...' : 'Gerar Proposta'}
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}