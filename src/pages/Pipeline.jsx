import React, { useEffect, useState } from "react";
import { Cliente, Projeto } from "@/entities";
import KanbanBoard from "../components/Dashboard/KanbanBoard.jsx";

export default function Pipeline() {
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
      Projeto.list("-created_date"),
    ]);
    setClientes(clientesData);
    setProjetos(projetosData);
    setLoading(false);
  };

  return (
    <div className="h-[100vh] p-2 sm:p-4 md:p-6 lg:p-8 overflow-hidden min-w-0">
      <div className="pt-2 sm:pt-4 lg:pt-6 min-w-0 max-w-[90vw] w-full mx-auto">
        <KanbanBoard clientes={clientes} projetos={projetos} onUpdate={loadData} />
      </div>
    </div>
  );
}

