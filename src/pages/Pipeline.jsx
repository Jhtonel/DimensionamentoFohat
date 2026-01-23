import React, { useEffect, useState } from "react";
import { Cliente, Projeto } from "@/entities";
import KanbanBoard from "../components/Dashboard/KanbanBoard.jsx";
import { useAuth } from "@/services/authService";

export default function Pipeline() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metricasModal, setMetricasModal] = useState({ open: false, projeto: null });
  const [custosModal, setCustosModal] = useState({ open: false, projeto: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [clientesData, projetosData] = await Promise.all([
      Cliente.list("-created_date"),
      Projeto.list("-created_date"),
    ]);
    setClientes(clientesData);
    setProjetos(projetosData);
    setLoading(false);
  };

  const handleViewMetrics = (projeto) => {
    setMetricasModal({ open: true, projeto });
  };

  const handleViewCustos = (projeto) => {
    setCustosModal({ open: true, projeto });
  };

  return (
    <div className="h-[100vh] p-2 sm:p-4 md:p-6 lg:p-8 overflow-hidden min-w-0">
      <div className="pt-2 sm:pt-4 lg:pt-6 min-w-0 max-w-[90vw] w-full mx-auto">
        <KanbanBoard 
          clientes={clientes} 
          projetos={projetos} 
          onUpdate={loadData}
          user={user}
          onViewMetrics={handleViewMetrics}
          onViewCustos={handleViewCustos}
        />
      </div>
      
      {/* TODO: Adicionar modais de métricas e custos se necessário */}
    </div>
  );
}

