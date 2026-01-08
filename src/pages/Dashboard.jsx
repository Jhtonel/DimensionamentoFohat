import React, { useState, useEffect, useMemo } from "react";
import { Cliente, Projeto } from "@/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Users, 
  FolderKanban, 
  TrendingUp, 
  DollarSign,
  Plus,
  Target,
  Zap,
  Clock,
  Award,
  BarChart3,
  PieChart,
  Calendar,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";

import StatsCard from "../components/Dashboard/StatsCard.jsx";
import authService, { useAuth } from "@/services/authService.jsx";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { systemConfig } from "@/config/systemConfig.js";
import { getBackendUrl } from "@/services/backendUrl.js";
import StageBarChart from "@/components/Dashboard/Charts/StageBarChart.jsx";
import ConversionDoughnut from "@/components/Dashboard/Charts/ConversionDoughnut.jsx";
import DateRangeSelect from "@/components/Dashboard/Filters/DateRangeSelect.jsx";
import { getDateRangePreset, isWithinRange } from "@/utils";

export default function Dashboard() {
  const [clientes, setClientes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const { user } = useAuth();
  const [selectedUserEmail, setSelectedUserEmail] = useState(
    () => localStorage.getItem('admin_filter_user_email') || 'todos'
  );
  const [datePreset, setDatePreset] = useState(
    () => localStorage.getItem("dashboard_date_preset") || "all"
  );

  useEffect(() => {
    loadData();
    loadUsers();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [clientesData, projetosData] = await Promise.all([
      Cliente.list("-created_date"),
      Projeto.list("-created_date")
    ]);
    setClientes(clientesData);
    setProjetos(projetosData);
    setLoading(false);
  };
  
  const loadUsers = async () => {
    try {
      const serverUrl = getBackendUrl();
      const resp = await fetch(`${serverUrl}/admin/users?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${(await authService.getAuthToken()) || ""}`,
        },
      });
      let items = [];
      if (resp.ok) {
        const json = await resp.json();
        const users =
          Array.isArray(json?.items) ? json.items :
          Array.isArray(json?.users) ? json.users :
          Array.isArray(json) ? json :
          [];
        items = users.map((u) => ({
          uid: u.uid,
          email: u.email || "",
          nome: u.nome || (u.email ? u.email.split("@")[0] : "Usuário"),
        }));
      }
      setUsuarios(items);
    } catch (_) {
      setUsuarios([]);
    }
  };
  
  const setUserFilter = (value) => {
    setSelectedUserEmail(value);
    localStorage.setItem('admin_filter_user_email', value);
  };
  const setDateFilter = (value) => {
    setDatePreset(value);
    localStorage.setItem("dashboard_date_preset", value);
  };

  // Helpers
  const normalizeNumber = (v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v.replace?.(/\./g, '')?.replace?.(',', '.') ?? v);
      return Number.isNaN(n) ? 0 : n;
    }
    return 0;
  };

  const getValorProjeto = (p) => {
    return normalizeNumber(
      p?.preco_final ?? p?.preco_venda ?? p?.custo_total_projeto ??
      p?.payload?.preco_final ?? p?.payload?.preco_venda ?? p?.payload?.custo_total_projeto ?? 0
    );
  };

  const getPotenciaProjeto = (p) => {
    return normalizeNumber(
      p?.potencia_sistema ?? p?.potencia_kw ?? p?.payload?.potencia_sistema ?? p?.payload?.potencia_kw ?? 0
    );
  };

  const getVendedorEmail = (p) => {
    return (p?.vendedor_email || p?.payload?.vendedor_email || p?.created_by_email || '').toLowerCase();
  };

  const statusOrder = ['dimensionamento', 'orcamento_enviado', 'negociacao', 'fechado', 'instalacao', 'concluido', 'perdido'];
  const statusLabels = {
    dimensionamento: 'Dimensionamento',
    orcamento_enviado: 'Orçamento Enviado',
    negociacao: 'Negociação',
    fechado: 'Fechado',
    instalacao: 'Instalação',
    concluido: 'Concluído',
    perdido: 'Perdido',
  };
  const statusColors = {
    dimensionamento: 'bg-blue-500',
    orcamento_enviado: 'bg-indigo-500',
    negociacao: 'bg-amber-500',
    fechado: 'bg-green-500',
    instalacao: 'bg-emerald-500',
    concluido: 'bg-teal-500',
    perdido: 'bg-red-500',
  };

  // Função de match flexível (igual à usada em Clientes.jsx)
  const createMatcher = (selectedEmail) => {
    const raw = String(selectedEmail || '').toLowerCase().trim();
    const email = raw;
    const emailPrefix = raw.includes('@') ? raw.split('@')[0] : raw;
    
    return (value) => {
      const v = String(value || '').toLowerCase().trim();
      if (!v) return false;
      if (v === email) return true;
      const vPrefix = v.includes('@') ? v.split('@')[0] : v;
      return vPrefix === emailPrefix;
    };
  };

  // Primeiro, identificamos os clientes do usuário (para usar na filtragem de projetos)
  const clientesDoUsuario = useMemo(() => {
    if (!selectedUserEmail || selectedUserEmail === 'todos') return new Set(clientes.map(c => c.id));
    
    const matchKey = createMatcher(selectedUserEmail);
    
    // Buscar UID do usuário selecionado
    const usuarioSelecionado = usuarios.find(u => {
      const uEmail = String(u.email || '').toLowerCase();
      return matchKey(uEmail) || matchKey(u.nome);
    });
    const uidSelecionado = usuarioSelecionado?.uid;
    
    const idsClientes = new Set();
    (clientes || []).forEach(c => {
      // Cliente foi criado pelo usuário (por UID)
      if (uidSelecionado && c.created_by === uidSelecionado) {
        idsClientes.add(c.id);
        return;
      }
      // Cliente foi criado pelo usuário (por email)
      if (matchKey(c.created_by_email)) {
        idsClientes.add(c.id);
        return;
      }
      // Dados legados (created_by pode ser email)
      if (matchKey(c.created_by)) {
        idsClientes.add(c.id);
      }
    });
    
    return idsClientes;
  }, [clientes, selectedUserEmail, usuarios]);

  // Filtragem de projetos - inclui projetos vinculados a clientes do usuário
  const projetosFiltrados = useMemo(() => {
    const range = getDateRangePreset(datePreset);
    const matchDate = (p) => {
      const dt = p?.created_date || p?.created_at || p?.data_criacao || null;
      return isWithinRange(dt, range);
    };

    // 1) Sem filtro de usuário: aplica apenas filtro de data
    if (!selectedUserEmail || selectedUserEmail === 'todos') {
      return (projetos || []).filter(matchDate);
    }

    const matchKey = createMatcher(selectedUserEmail);

    // 2) Com filtro de usuário: aplica regras atuais + filtro de data
    return (projetos || []).filter(p => {
      // 1. Projeto tem vendedor_email ou created_by_email do usuário
      const candidates = [
        p?.vendedor_email,
        p?.payload?.vendedor_email,
        p?.created_by_email,
        p?.payload?.created_by_email,
      ];
      if (candidates.some(matchKey)) return matchDate(p);
      
      // 2. Projeto está vinculado a um cliente do usuário
      if (p.cliente_id && clientesDoUsuario.has(p.cliente_id)) return matchDate(p);
      
      // 3. Projeto tem nome de cliente que corresponde a um cliente do usuário (legado)
      if (p.cliente_nome) {
        const clienteMatch = clientes.find(c => 
          c.nome?.toLowerCase() === p.cliente_nome?.toLowerCase() && 
          clientesDoUsuario.has(c.id)
        );
        if (clienteMatch) return matchDate(p);
      }
      
      return false;
    });
  }, [projetos, selectedUserEmail, clientesDoUsuario, clientes, datePreset]);

  // Clientes filtrados (retorna os clientes do usuário + clientes com projetos do usuário)
  const clientesFiltrados = useMemo(() => {
    if (!selectedUserEmail || selectedUserEmail === 'todos') return clientes;
    
    // IDs de clientes que têm projetos do usuário (para casos onde o projeto foi criado primeiro)
    const idsClientesComProjetos = new Set(
      (projetosFiltrados || []).map(p => p.cliente_id).filter(Boolean)
    );
    
    return (clientes || []).filter(c => 
      clientesDoUsuario.has(c.id) || idsClientesComProjetos.has(c.id)
    );
  }, [clientes, projetosFiltrados, selectedUserEmail, clientesDoUsuario]);

  // Métricas calculadas com dados FILTRADOS
  const metricas = useMemo(() => {
    const projs = projetosFiltrados;
    const clis = clientesFiltrados;

    // Agrupamentos por status
    const grupos = statusOrder.reduce((acc, s) => {
      acc[s] = projs.filter(p => p.status === s);
      return acc;
    }, {});

    // Totais
    const totalClientes = clis.length;
    const totalProjetos = projs.length;
    
    // Projetos fechados/concluídos
    const projetosFechados = [...(grupos['fechado'] || []), ...(grupos['concluido'] || [])];
    const qtdFechados = projetosFechados.length;
    
    // Valor total fechado
    const valorFechado = projetosFechados.reduce((sum, p) => sum + getValorProjeto(p), 0);
    
    // Taxa de conversão (fechados + concluídos / total - sem perdidos)
    const totalConversao = totalProjetos - (grupos['perdido']?.length || 0);
    const taxaConversao = totalConversao > 0 ? (qtdFechados / totalConversao * 100) : 0;
    
    // Propostas enviadas (orçamento_enviado + negociacao)
    const propostasEnviadas = (grupos['orcamento_enviado']?.length || 0) + (grupos['negociacao']?.length || 0);
    
    // Valor em negociação
    const valorNegociacao = (grupos['negociacao'] || []).reduce((sum, p) => sum + getValorProjeto(p), 0);
    
    // Pipeline aberto (dimensionamento + orcamento_enviado + negociacao)
    const pipelineAberto = ['dimensionamento', 'orcamento_enviado', 'negociacao']
      .flatMap(s => grupos[s] || []);
    const valorPipeline = pipelineAberto.reduce((sum, p) => sum + getValorProjeto(p), 0);
    
    // Leads (clientes sem projeto)
    const clientesComProjeto = new Set(projs.map(p => p.cliente_id).filter(Boolean));
    const leads = clis.filter(c => !clientesComProjeto.has(c.id)).length;
    
    // Projetos perdidos
    const projetosPerdidos = grupos['perdido']?.length || 0;
    const valorPerdido = (grupos['perdido'] || []).reduce((sum, p) => sum + getValorProjeto(p), 0);
    
    // Ticket médio (fechados)
    const ticketMedio = qtdFechados > 0 ? valorFechado / qtdFechados : 0;
    
    // Potência total instalada (fechados + concluídos + instalação)
    const projetosInstalados = [...projetosFechados, ...(grupos['instalacao'] || [])];
    const potenciaTotal = projetosInstalados.reduce((sum, p) => sum + getPotenciaProjeto(p), 0);
    
    // Taxa de perda
    const taxaPerda = totalProjetos > 0 ? (projetosPerdidos / totalProjetos * 100) : 0;

    // Projetos por mês (últimos 6 meses)
    const agora = new Date();
    const mesesData = [];
    for (let i = 5; i >= 0; i--) {
      const mesDate = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mes = mesDate.toLocaleDateString('pt-BR', { month: 'short' });
      const ano = mesDate.getFullYear();
      const projetosMes = projs.filter(p => {
        const criado = new Date(p.created_date || p.created_at || p.data_criacao || 0);
        return criado.getMonth() === mesDate.getMonth() && criado.getFullYear() === ano;
      });
      const fechadosMes = projetosMes.filter(p => p.status === 'fechado' || p.status === 'concluido');
      mesesData.push({
        mes: `${mes}/${ano.toString().slice(-2)}`,
        total: projetosMes.length,
        fechados: fechadosMes.length,
        valor: fechadosMes.reduce((sum, p) => sum + getValorProjeto(p), 0)
      });
    }

    // Ranking de vendedores (quando filtro é "todos")
    const rankingVendedores = [];
    if (selectedUserEmail === 'todos' && usuarios.length > 0) {
      usuarios.forEach(u => {
        const projsVendedor = projetos.filter(p => getVendedorEmail(p) === u.email.toLowerCase());
        const fechadosVendedor = projsVendedor.filter(p => p.status === 'fechado' || p.status === 'concluido');
        const valorVendedor = fechadosVendedor.reduce((sum, p) => sum + getValorProjeto(p), 0);
        if (projsVendedor.length > 0) {
          rankingVendedores.push({
            nome: u.nome || u.email.split('@')[0],
            email: u.email,
            totalProjetos: projsVendedor.length,
            fechados: fechadosVendedor.length,
            valor: valorVendedor,
            conversao: projsVendedor.length > 0 ? (fechadosVendedor.length / projsVendedor.length * 100) : 0
          });
        }
      });
      rankingVendedores.sort((a, b) => b.valor - a.valor);
    }

    return {
      totalClientes,
      totalProjetos,
      valorFechado,
      taxaConversao,
      propostasEnviadas,
      valorNegociacao,
      valorPipeline,
      leads,
      projetosPerdidos,
      valorPerdido,
      ticketMedio,
      potenciaTotal,
      taxaPerda,
      qtdFechados,
      grupos,
      mesesData,
      rankingVendedores,
      pipelineAberto
    };
  }, [projetosFiltrados, clientesFiltrados, projetos, usuarios, selectedUserEmail]);

  const maxQtdGrupo = Math.max(1, ...statusOrder.map(s => metricas.grupos[s]?.length || 0));

  const selectedUserName = useMemo(() => {
    if (selectedUserEmail === 'todos') return 'Todos os Usuários';
    const u = usuarios.find(u => u.email === selectedUserEmail);
    return u?.nome || selectedUserEmail;
  }, [selectedUserEmail, usuarios]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fohat-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100vh] p-2 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden min-w-0 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full space-y-4 sm:space-y-6 min-w-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-fohat-blue">
              Dashboard de Vendas
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
              Relatório completo do pipeline • <span className="font-medium text-fohat-blue">{selectedUserName}</span>
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto items-end">
            <div className="flex-1 sm:flex-none">
              <label className="text-xs text-gray-500 block mb-1">Período</label>
              <DateRangeSelect value={datePreset} onChange={setDateFilter} />
            </div>
            {user?.role === 'admin' && (
              <div className="flex-1 sm:flex-none">
                <label className="text-xs text-gray-500 block mb-1">Filtrar por Vendedor</label>
                <Select value={selectedUserEmail} onValueChange={setUserFilter}>
                  <SelectTrigger className="h-10 w-full sm:w-64 border-gray-200 focus:ring-fohat-blue bg-white">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">👥 Todos os Vendedores</SelectItem>
                    {usuarios.map(u => (
                      <SelectItem key={u.uid} value={u.email || ''}>
                        {(u.nome || u.email || '').toString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Link to={createPageUrl("NovoProjeto")} className="hidden sm:block">
              <Button className="bg-fohat-blue hover:bg-fohat-dark text-white shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Novo Projeto
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* KPIs Principais - Linha 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatsCard
            title="Total de Clientes"
            value={metricas.totalClientes}
            icon={Users}
            gradient="from-fohat-blue to-blue-700"
          />
          <StatsCard
            title="Projetos Ativos"
            value={metricas.totalProjetos}
            icon={FolderKanban}
            gradient="from-fohat-orange to-orange-600"
          />
          <StatsCard
            title="Valor Total Fechado"
            value={`R$ ${metricas.valorFechado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            gradient="from-green-500 to-emerald-600"
          />
          <StatsCard
            title="Taxa de Conversão"
            value={`${metricas.taxaConversao.toFixed(1)}%`}
            icon={Target}
            gradient="from-purple-500 to-pink-600"
          />
        </div>

        {/* KPIs Secundários - Linha 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatsCard
            title="Propostas Enviadas"
            value={metricas.propostasEnviadas}
            icon={BarChart3}
            gradient="from-indigo-500 to-blue-600"
          />
          <StatsCard
            title="Valor em Negociação"
            value={`R$ ${metricas.valorNegociacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            gradient="from-amber-500 to-orange-600"
          />
          <StatsCard
            title="Ticket Médio"
            value={`R$ ${metricas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={TrendingUp}
            gradient="from-cyan-500 to-teal-600"
          />
          <StatsCard
            title="Potência Instalada"
            value={`${metricas.potenciaTotal.toFixed(2)} kWp`}
            icon={Zap}
            gradient="from-yellow-500 to-amber-600"
          />
        </div>

        {/* KPIs Terciários - Linha 3 */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatsCard
            title="Leads Cadastrados"
            value={metricas.leads}
            icon={Users}
            gradient="from-gray-500 to-slate-600"
          />
          <StatsCard
            title="Valor no Pipeline"
            value={`R$ ${metricas.valorPipeline.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={PieChart}
            gradient="from-blue-500 to-indigo-600"
          />
          <StatsCard
            title="Projetos Perdidos"
            value={metricas.projetosPerdidos}
            icon={XCircle}
            gradient="from-red-500 to-rose-600"
          />
          <StatsCard
            title="Taxa de Perda"
            value={`${metricas.taxaPerda.toFixed(1)}%`}
            icon={TrendingDown}
            gradient="from-red-400 to-red-600"
          />
        </div>

        {/* Gráficos e Análises */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Gráfico de barras por estágio */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-gray-100 shadow-lg rounded-2xl p-5 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-fohat-blue" />
                Projetos por Estágio
              </h3>
              <span className="text-sm text-gray-500">{metricas.totalProjetos} projetos</span>
            </div>
            <StageBarChart
              labels={statusOrder.map((s) => statusLabels[s])}
              values={statusOrder.map((s) => metricas.grupos[s]?.length || 0)}
              metaValues={statusOrder.map((s) =>
                (metricas.grupos[s] || []).reduce((sum, p) => sum + getValorProjeto(p), 0)
              )}
              height={224}
            />
          </motion.div>

          {/* Donut de conversão */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-gray-100 shadow-lg rounded-2xl p-5"
          >
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-green-500" />
              Conversão
            </h3>
            <div className="flex flex-col items-center">
              <div className="w-full max-w-[260px]">
                <ConversionDoughnut valuePct={metricas.taxaConversao} label="Conversão" height={200} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 w-full">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-lg font-bold text-green-700">{metricas.qtdFechados}</span>
                  </div>
                  <span className="text-xs text-green-600">Fechados</span>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-lg font-bold text-red-700">{metricas.projetosPerdidos}</span>
                  </div>
                  <span className="text-xs text-red-600">Perdidos</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Evolução Mensal e Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Evolução Mensal */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border border-gray-100 shadow-lg rounded-2xl p-5"
          >
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-fohat-blue" />
              Evolução Mensal (Últimos 6 meses)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 px-2 font-medium">Mês</th>
                    <th className="py-2 px-2 font-medium text-center">Total</th>
                    <th className="py-2 px-2 font-medium text-center">Fechados</th>
                    <th className="py-2 px-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {metricas.mesesData.map((m, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium text-gray-700">{m.mes}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                          {m.total}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                          {m.fechados}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-gray-800">
                        R$ {m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td className="py-3 px-2">Total</td>
                    <td className="py-3 px-2 text-center">
                      {metricas.mesesData.reduce((s, m) => s + m.total, 0)}
                    </td>
                    <td className="py-3 px-2 text-center text-green-700">
                      {metricas.mesesData.reduce((s, m) => s + m.fechados, 0)}
                    </td>
                    <td className="py-3 px-2 text-right text-green-700">
                      R$ {metricas.mesesData.reduce((s, m) => s + m.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>

          {/* Ranking de Vendedores ou Pipeline Detalhado */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white border border-gray-100 shadow-lg rounded-2xl p-5"
          >
            {selectedUserEmail === 'todos' && metricas.rankingVendedores.length > 0 ? (
              <>
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-yellow-500" />
                  Ranking de Vendedores
                </h3>
                <div className="space-y-3">
                  {metricas.rankingVendedores.slice(0, 5).map((v, idx) => (
                    <div 
                      key={v.email} 
                      className={`flex items-center justify-between p-3 rounded-xl ${idx === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          idx === 0 ? 'bg-yellow-500 text-white' : 
                          idx === 1 ? 'bg-gray-400 text-white' : 
                          idx === 2 ? 'bg-amber-600 text-white' : 
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{v.nome}</div>
                          <div className="text-xs text-gray-500">{v.totalProjetos} projetos • {v.conversao.toFixed(0)}% conversão</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">
                          R$ {v.valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs text-gray-500">{v.fechados} fechados</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Pipeline em Aberto
                </h3>
                <div className="space-y-3">
                  {metricas.pipelineAberto.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <div className="font-medium text-gray-800">{p.cliente_nome || p.nome_projeto || 'Projeto'}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            p.status === 'negociacao' ? 'bg-amber-100 text-amber-700' :
                            p.status === 'orcamento_enviado' ? 'bg-indigo-100 text-indigo-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {statusLabels[p.status] || p.status}
                          </span>
                          <span className="text-xs text-gray-500">{getPotenciaProjeto(p).toFixed(2)} kWp</span>
                        </div>
                      </div>
                      <div className="font-bold text-gray-800">
                        R$ {getValorProjeto(p).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  ))}
                  {metricas.pipelineAberto.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      Nenhum projeto em aberto
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Relatório Detalhado por Estágio */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5"
        >
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-fohat-blue" />
            Relatório Detalhado por Estágio
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b-2 border-gray-100">
                  <th className="py-3 px-3 font-semibold">Estágio</th>
                  <th className="py-3 px-3 font-semibold text-center">Quantidade</th>
                  <th className="py-3 px-3 font-semibold text-center">% do Total</th>
                  <th className="py-3 px-3 font-semibold text-right">Valor Total</th>
                  <th className="py-3 px-3 font-semibold text-right">Potência (kWp)</th>
                  <th className="py-3 px-3 font-semibold text-right">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {statusOrder.map((s) => {
                  const lista = metricas.grupos[s] || [];
                  const qtd = lista.length;
                  const valor = lista.reduce((sum, p) => sum + getValorProjeto(p), 0);
                  const potencia = lista.reduce((sum, p) => sum + getPotenciaProjeto(p), 0);
                  const percent = metricas.totalProjetos > 0 ? (qtd / metricas.totalProjetos * 100) : 0;
                  const ticket = qtd > 0 ? valor / qtd : 0;
                  return (
                    <tr key={s} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${statusColors[s]}`}></div>
                          <span className="font-medium text-gray-700">{statusLabels[s]}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-medium">{qtd}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${statusColors[s]} rounded-full`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                          <span className="text-gray-600 text-xs">{percent.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-gray-800">
                        R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600">
                        {potencia.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600">
                        R$ {ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-fohat-blue/5 font-bold text-fohat-blue">
                  <td className="py-3 px-3">TOTAL</td>
                  <td className="py-3 px-3 text-center">{metricas.totalProjetos}</td>
                  <td className="py-3 px-3 text-center">100%</td>
                  <td className="py-3 px-3 text-right">
                    R$ {statusOrder.reduce((s, st) => s + (metricas.grupos[st] || []).reduce((a, p) => a + getValorProjeto(p), 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {statusOrder.reduce((s, st) => s + (metricas.grupos[st] || []).reduce((a, p) => a + getPotenciaProjeto(p), 0), 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    R$ {metricas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
