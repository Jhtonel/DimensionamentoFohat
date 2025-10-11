import React, { useState } from "react";
import { Projeto } from "@/entities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Sparkles, 
  FileText, 
  Send, 
  MessageCircle, 
  CheckCircle, 
  Hammer, 
  Trophy,
  XCircle,
  Plus,
  MoreVertical,
  Calendar,
  DollarSign,
  User
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusConfig = {
  lead: { 
    label: "Lead", 
    icon: Sparkles, 
    color: "bg-gray-100 text-gray-700 border-gray-200",
    bgColor: "bg-gray-50",
    textColor: "text-gray-700"
  },
  dimensionamento: { 
    label: "Dimensionamento", 
    icon: FileText, 
    color: "bg-blue-100 text-blue-700 border-blue-200",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700"
  },
  orcamento_enviado: { 
    label: "Orçamento Enviado", 
    icon: Send, 
    color: "bg-purple-100 text-purple-700 border-purple-200",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700"
  },
  negociacao: { 
    label: "Negociação", 
    icon: MessageCircle, 
    color: "bg-orange-100 text-orange-700 border-orange-200",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700"
  },
  fechado: { 
    label: "Fechado", 
    icon: CheckCircle, 
    color: "bg-green-100 text-green-700 border-green-200",
    bgColor: "bg-green-50",
    textColor: "text-green-700"
  },
  instalacao: { 
    label: "Instalação", 
    icon: Hammer, 
    color: "bg-cyan-100 text-cyan-700 border-cyan-200",
    bgColor: "bg-cyan-50",
    textColor: "text-cyan-700"
  },
  concluido: { 
    label: "Concluído", 
    icon: Trophy, 
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700"
  },
  perdido: { 
    label: "Perdido", 
    icon: XCircle, 
    color: "bg-red-100 text-red-700 border-red-200",
    bgColor: "bg-red-50",
    textColor: "text-red-700"
  }
};

const statusOrder = [
  'lead', 'dimensionamento', 'orcamento_enviado', 'negociacao', 
  'fechado', 'instalacao', 'concluido', 'perdido'
];

export default function KanbanBoard({ projetos, onUpdate }) {
  const [draggedProject, setDraggedProject] = useState(null);

  const groupByStatus = () => {
    const groups = {};
    statusOrder.forEach(status => {
      groups[status] = projetos.filter(p => p.status === status);
    });
    return groups;
  };

  const grouped = groupByStatus();

  const handleDragStart = (e, projeto) => {
    setDraggedProject(projeto);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    if (draggedProject && draggedProject.status !== newStatus) {
      try {
        await Projeto.update(draggedProject.id, { status: newStatus });
        onUpdate();
      } catch (error) {
        console.error('Erro ao atualizar status:', error);
      }
    }
    setDraggedProject(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pipeline de Vendas</h2>
          <p className="text-gray-600 mt-1">Gerencie seus projetos por estágio</p>
        </div>
        <Link to={createPageUrl("NovoProjeto")}>
          <Button className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-lg shadow-sky-500/30">
            <Plus className="w-4 h-4 mr-2" />
            Novo Projeto
          </Button>
        </Link>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {statusOrder.map((status) => {
          const config = statusConfig[status];
          const Icon = config.icon;
          const projetosStatus = grouped[status] || [];
          
          return (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex-shrink-0 w-80 ${config.bgColor} rounded-xl p-4 border border-gray-200`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
                    <p className="text-sm text-gray-500">{projetosStatus.length} projetos</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-3">
                <AnimatePresence>
                  {projetosStatus.map((projeto) => (
                    <motion.div
                      key={projeto.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, projeto)}
                      className="cursor-move"
                    >
                      <Card className="hover:shadow-md transition-shadow duration-200 bg-white/80 backdrop-blur-sm">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">
                                {projeto.nome_projeto || 'Projeto sem nome'}
                              </h4>
                              <Badge variant="outline" className="text-xs">
                                {projeto.prioridade || 'Normal'}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2 text-xs text-gray-600">
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3" />
                                <span className="truncate">
                                  {projeto.cliente?.nome || 'Cliente não definido'}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-3 h-3" />
                                <span>{formatCurrency(projeto.preco_final)}</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDate(projeto.created_date)}</span>
                              </div>
                            </div>

                            {projeto.observacoes && (
                              <p className="text-xs text-gray-500 line-clamp-2">
                                {projeto.observacoes}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {projetosStatus.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Icon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum projeto neste estágio</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
