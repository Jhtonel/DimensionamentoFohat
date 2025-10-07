import React from "react";
import { Projeto } from "@/entities";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  FileText, 
  Send, 
  MessageCircle, 
  CheckCircle, 
  Hammer, 
  Trophy,
  XCircle
} from "lucide-react";
import { motion } from "framer-motion";
const statusConfig = {
  lead: { label: "Lead", icon: Sparkles, color: "bg-gray-100 text-gray-700 border-gray-200" },
  dimensionamento: { label: "Dimensionamento", icon: FileText, color: "bg-blue-100 text-blue-700 border-blue-200" },
  orcamento_enviado: { label: "Orçamento Enviado", icon: Send, color: "bg-purple-100 text-purple-700 border-purple-200" },
  negociacao: { label: "Negociação", icon: MessageCircle, color: "bg-orange-100 text-orange-700 border-orange-200" },
  fechado: { label: "Fechado", icon: CheckCircle, color: "bg-green-100 text-green-700 border-green-200" },
  instalacao: { label: "Instalação", icon: Hammer, color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  concluido: { label: "Concluído", icon: Trophy, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  perdido: { label: "Perdido", icon: XCircle, color: "bg-red-100 text-red-700 border-red-200" }
};
export default function PipelineBoard({ projetos, onUpdate }) {
  const groupByStatus = () => {
    const groups = {};
    Object.keys(statusConfig).forEach(status => {
      groups[status] = projetos.filter(p => p.status === status);
    });
    return groups;
  };
  const grouped = groupByStatus();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([status, config]) => {
          const Icon = config.icon;
          const projetosStatus = grouped[status] || [];
          
          return (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{config.label}</h3>
                  <p className="text-sm text-gray-500">{projetosStatus.length} projetos</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {projetosStatus.slice(0, 3).map((projeto) => (
                  <div
                    key={projeto.id}
                    className="p-2 bg-gray-50 rounded-lg text-sm"
                  >
                    <p className="font-medium text-gray-900 truncate">
                      {projeto.nome_projeto}
                    </p>
                    <p className="text-gray-500 text-xs">
                      R$ {projeto.preco_final?.toLocaleString('pt-BR') || 'N/A'}
                    </p>
                  </div>
                ))}
                
                {projetosStatus.length > 3 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{projetosStatus.length - 3} mais
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
