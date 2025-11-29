import React, { useState, useEffect } from "react";
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
  ArrowRight,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";

import StatsCard from "../components/Dashboard/StatsCard.jsx";
import { useAuth } from "@/services/authService.jsx";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { systemConfig } from "@/config/firebase.js";

export default function Dashboard() {
  const [clientes, setClientes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const { user } = useAuth();
  const [selectedUserEmail, setSelectedUserEmail] = useState(
    () => localStorage.getItem('admin_filter_user_email') || 'todos'
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
      const serverUrl = (systemConfig?.apiUrl && systemConfig.apiUrl.length > 0)
        ? systemConfig.apiUrl
        : (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://localhost:8000');
      const resp = await fetch(`${serverUrl}/admin/firebase/list-users?t=${Date.now()}`);
      let items = [];
      if (resp.ok) {
        const json = await resp.json();
        if (json?.success && Array.isArray(json.users)) {
          items = json.users.map(u => ({
            uid: u.uid,
            email: u.email || '',
            nome: u.display_name || (u.email ? u.email.split('@')[0] : 'Usuário')
          }));
        }
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
  

  const calcularStats = () => {
    const totalClientes = clientes.length;
    const totalProjetos = projetos.length;
    const projetosFechados = projetos.filter(p => p.status === "fechado").length;
    const valorTotal = projetos
      .filter(p => p.status === "fechado" || p.status === "concluido")
      .reduce((sum, p) => sum + (p.preco_final || 0), 0);
    const taxaConversao = totalProjetos > 0 ? (projetosFechados / totalProjetos * 100).toFixed(1) : 0;

    return {
      totalClientes,
      totalProjetos,
      valorTotal,
      taxaConversao
    };
  };

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

  const stats = calcularStats();
  // Filtragem por usuário (admin)
  const projetosFiltrados = React.useMemo(() => {
    if (!selectedUserEmail || selectedUserEmail === 'todos') return projetos;
    const email = selectedUserEmail.toLowerCase();
    const belongs = (p) => {
      const cand = [
        p?.vendedor_email,
        p?.payload?.vendedor_email,
        p?.created_by_email,
        p?.cliente?.email, // alguns backends salvam aqui
      ].map(v => (v || '').toLowerCase());
      return cand.includes(email);
    };
    return (projetos || []).filter(belongs);
  }, [projetos, selectedUserEmail]);
  const clientesFiltrados = React.useMemo(() => {
    if (!selectedUserEmail || selectedUserEmail === 'todos') return clientes;
    // Filtra clientes pelos projetos pertencentes ao usuário
    const ids = new Set((projetosFiltrados || []).map(p => p.cliente_id).filter(Boolean));
    return (clientes || []).filter(c => ids.has(c.id));
  }, [clientes, projetosFiltrados, selectedUserEmail]);

  const grupos = statusOrder.reduce((acc, s) => {
    acc[s] = projetosFiltrados.filter(p => p.status === s);
    return acc;
  }, {});
  const maxQtd = Math.max(1, ...statusOrder.map(s => grupos[s].length));
  const propostasEnviadas = grupos['orcamento_enviado']?.length || 0;
  const valorNegociacao = grupos['negociacao']?.reduce((sum, p) => sum + getValorProjeto(p), 0) || 0;
  const clientesComProjeto = new Set(projetosFiltrados.map(p => p.cliente_id).filter(Boolean));
  const nomesComProjeto = new Set(projetosFiltrados.map(p => p.cliente_nome).filter(Boolean));
  const leadsCadastrados = clientesFiltrados.filter(c => !clientesComProjeto.has(c.id) && !nomesComProjeto.has(c.nome)).length;
  const valorPipelineAberto = ['dimensionamento','orcamento_enviado','negociacao']
    .flatMap(s => grupos[s] || [])
    .reduce((sum, p) => sum + getValorProjeto(p), 0);

  return (
    <div className="min-h-[100vh] p-2 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden min-w-0">
      <div className="w-full space-y-4 sm:space-y-6 min-w-0">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-fohat-blue">
              Dashboard
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Visão geral do seu pipeline de vendas</p>
          </div>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto items-end">
            {user?.role === 'admin' && (
              <div className="hidden sm:block">
                <label className="text-xs text-gray-500 block mb-1">Usuário</label>
                <Select value={selectedUserEmail} onValueChange={setUserFilter}>
                  <SelectTrigger className="h-9 w-56 border-gray-200 focus:ring-fohat-blue">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {usuarios.map(u => (
                      <SelectItem key={u.uid} value={u.email || ''}>
                        {(u.nome || u.email || '').toString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Link to={createPageUrl("Clientes")} className="flex-1 sm:flex-none">
              <Button className="w-full bg-fohat-blue hover:bg-fohat-dark text-white shadow-lg shadow-blue-900/20 transition-colors duration-300 text-xs sm:text-sm">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Novo Cliente</span>
                <span className="xs:hidden">Novo</span>
              </Button>
            </Link>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <StatsCard
            title="Total de Clientes"
            value={stats.totalClientes}
            icon={Users}
            gradient="from-fohat-blue to-blue-700"
          />
          <StatsCard
            title="Projetos Ativos"
            value={stats.totalProjetos}
            icon={FolderKanban}
            gradient="from-fohat-orange to-orange-600"
          />
          <StatsCard
            title="Valor Total Fechado"
            value={`R$ ${stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            gradient="from-green-500 to-emerald-600"
          />
          <StatsCard
            title="Taxa de Conversão"
            value={`${stats.taxaConversao}%`}
            icon={TrendingUp}
            gradient="from-purple-500 to-pink-600"
          />
          <StatsCard
            title="Propostas Enviadas"
            value={propostasEnviadas}
            icon={FolderKanban}
            gradient="from-indigo-500 to-blue-600"
          />
          <StatsCard
            title="Valor em Negociação"
            value={`R$ ${valorNegociacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            gradient="from-amber-500 to-orange-600"
          />
          <StatsCard
            title="Leads Cadastrados"
            value={leadsCadastrados}
            icon={Users}
            gradient="from-gray-500 to-slate-600"
          />
          <StatsCard
            title="Valor no Pipeline (Aberto)"
            value={`R$ ${valorPipelineAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            gradient="from-cyan-500 to-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
          {/* Gráfico de barras simples por estágio */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 overflow-hidden min-w-0 lg:col-span-2">
            <h3 className="font-semibold text-gray-800 text-base sm:text-lg">Projetos por estágio</h3>
            <div className="mt-3 h-48 flex items-end gap-2 md:gap-3 w-full min-w-0">
              {statusOrder.map((s) => {
                const qtd = grupos[s].length;
                const h = Math.round((qtd / maxQtd) * 100);
                return (
                  <div key={s} className="flex-1 basis-0 min-w-0 flex flex-col items-center h-full">
                    <div className="w-full h-full rounded-md overflow-hidden flex items-end">
                      {(() => {
                        const ratio = maxQtd ? (qtd / maxQtd) : 0;
                        const opacity = 0.25 + (0.75 * ratio);
                        return (
                          <div
                            className="w-full bg-fohat-blue rounded-t-md shadow-sm transition-all duration-500"
                            style={{ height: `${h}%`, opacity }}
                          />
                        );
                      })()}
                    </div>
                    <span className="mt-1 text-[11px] sm:text-xs text-gray-700 text-center truncate w-full">
                      {statusLabels[s]}
                    </span>
                    <span className="text-[10px] text-gray-500">{qtd}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Donut simples de conversão */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 lg:col-span-1">
            <h3 className="font-semibold text-gray-800 text-base sm:text-lg">Conversão</h3>
            <div className="mt-3 flex items-center gap-6">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32">
                <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#22c55e ${stats.taxaConversao}%, #e5e7eb 0)` }} />
                <div className="absolute inset-3 sm:inset-4 rounded-full bg-white flex items-center justify-center shadow-inner">
                  <span className="text-sm sm:text-base font-bold text-gray-800">{stats.taxaConversao}%</span>
                </div>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>Fechados: {grupos['fechado']?.length || 0}</li>
                <li>Concluídos: {grupos['concluido']?.length || 0}</li>
                <li>Total de projetos: {stats.totalProjetos}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Relatório rápido por estágio */}
        <div className="mt-4 sm:mt-6 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Relatório rápido</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Estágio</th>
                  <th className="py-2 pr-4">Qtd</th>
                  <th className="py-2 pr-4">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {statusOrder.map((s) => {
                  const qtd = grupos[s].length;
                  const valor = grupos[s].reduce((sum, p) => sum + getValorProjeto(p), 0);
                  return (
                    <tr key={s} className="border-t border-gray-100">
                      <td className="py-2 pr-4">{statusLabels[s]}</td>
                      <td className="py-2 pr-4">{qtd}</td>
                      <td className="py-2 pr-4">{valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}