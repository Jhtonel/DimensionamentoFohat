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

import PipelineBoard from "../components/Dashboard/PiplineBoard.jsx";
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
    <div className="min-h-screen p-4 md:p-8">
      <div className="w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-600 to-orange-500 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Visão geral do seu pipeline de vendas</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Link to={createPageUrl("Clientes")} className="flex-1 md:flex-none">
              <Button className="w-full bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-lg shadow-sky-500/30">
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </Link>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

        <Card className="glass-card border-0 shadow-2xl">
          <CardHeader className="border-b border-sky-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Zap className="w-6 h-6 text-orange-500" />
                Pipeline de Vendas
              </CardTitle>
              <Link to={createPageUrl("Projetos")}>
                <Button variant="ghost" className="text-sky-600 hover:text-sky-700 hover:bg-sky-50">
                  Ver todos
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <PipelineBoard projetos={projetos} onUpdate={loadData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}