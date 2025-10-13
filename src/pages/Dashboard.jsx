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

import KanbanBoard from "../components/Dashboard/KanbanBoard.jsx";
import StatsCard from "../components/Dashboard/StatsCard.jsx";

export default function Dashboard() {
  const [clientes, setClientes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
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

  const stats = calcularStats();

  return (
    <div className="h-full max-h-full p-2 sm:p-4 md:p-6 lg:p-8 overflow-auto min-w-0">
      <div className="w-full space-y-4 sm:space-y-6 min-w-0">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-sky-600 to-orange-500 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Visão geral do seu pipeline de vendas</p>
          </div>
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            <Link to={createPageUrl("Clientes")} className="flex-1 sm:flex-none">
              <Button className="w-full bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-lg shadow-sky-500/30 text-xs sm:text-sm">
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
            gradient="from-sky-500 to-blue-600"
            trend="+12% este mês"
          />
          <StatsCard
            title="Projetos Ativos"
            value={stats.totalProjetos}
            icon={FolderKanban}
            gradient="from-orange-500 to-red-600"
            trend="+8 novos"
          />
          <StatsCard
            title="Valor Total Fechado"
            value={`R$ ${stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            gradient="from-green-500 to-emerald-600"
            trend="+18% este mês"
          />
          <StatsCard
            title="Taxa de Conversão"
            value={`${stats.taxaConversao}%`}
            icon={TrendingUp}
            gradient="from-purple-500 to-pink-600"
            trend="Acima da média"
          />
        </div>

        <div className="glass-card border-0 shadow-2xl rounded-xl p-2 sm:p-4 lg:p-6 max-h-[calc(100vh-300px)] sm:max-h-[calc(100vh-350px)] lg:max-h-[calc(100vh-400px)] overflow-hidden min-w-0">
          <KanbanBoard projetos={projetos} onUpdate={loadData} />
        </div>
      </div>
    </div>
  );
}