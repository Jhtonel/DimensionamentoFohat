import React, { useState, useRef } from "react";
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
  User,
  LayoutGrid,
  List,
  Copy,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDateBR } from "@/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGesture } from "@use-gesture/react";

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
  'dimensionamento', 'orcamento_enviado', 'negociacao', 
  'fechado', 'instalacao', 'concluido', 'perdido'
];

export default function KanbanBoard({ clientes = [], projetos = [], onUpdate }) {
  const [draggedProject, setDraggedProject] = useState(null);
  const [projetosState, setProjetosState] = useState(projetos);
  const [viewMode, setViewMode] = useState("kanban");
  const kanbanScrollRef = useRef(null);

  // Sincroniza quando o pai trouxer novos dados
  React.useEffect(() => {
    setProjetosState(projetos);
  }, [projetos]);

  const groupByStatus = () => {
    const groups = {};
    statusOrder.forEach(status => {
      groups[status] = (projetosState || []).filter(p => p.status === status);
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
        // Atualização otimista local
        setProjetosState(prev =>
          (prev || []).map(p => p.id === draggedProject.id ? { ...p, status: newStatus } : p)
        );
        // 1) Tenta persistir no backend Python (fonte de verdade do Dashboard)
        try {
          const url = `${Projeto.getServerUrl?.() || ''}/projetos/status`;
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: draggedProject.id, status: newStatus })
          }).catch(() => {});
        } catch (_) {}
        // 2) Persistir também no Supabase/cache local
        await Projeto.update(draggedProject.id, { status: newStatus });
        // 3) Manter cache local consistente
        try {
          const stored = JSON.parse(localStorage.getItem('projetos_local') || '[]');
          const idx = stored.findIndex(p => p.id === draggedProject.id);
          if (idx !== -1) {
            stored[idx] = { ...stored[idx], status: newStatus };
            localStorage.setItem('projetos_local', JSON.stringify(stored));
          }
        } catch (_) {}
        // 4) Atualização de tela
        if (typeof onUpdate === 'function') onUpdate();
      } catch (error) {
        console.error('Erro ao atualizar status:', error);
      }
    }
    setDraggedProject(null);
  };

  const formatDate = (dateString) => formatDateBR(dateString);

  const getProjetoPath = (id) => `${createPageUrl("NovoProjeto")}?projeto_id=${id}`;
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // fallback simples
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  };

  const bindKanbanDragScroll = useGesture(
    {
      onDrag: ({ event, delta: [dx], pointerType }) => {
        // Só aplica em touch/pen para não brigar com DnD do mouse
        if (pointerType !== "touch" && pointerType !== "pen") return;
        if (event?.target?.closest?.('[draggable="true"]')) return;
        const el = kanbanScrollRef.current;
        if (!el) return;
        event?.preventDefault?.();
        el.scrollLeft -= dx;
      },
    },
    {
      drag: { axis: "x", filterTaps: true },
    }
  );

  const normalizeNumber = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v.replace?.(/\./g, '')?.replace?.(',', '.') ?? v);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  };
  const formatCurrency = (value) => {
    const n = normalizeNumber(value);
    if (n === null) return 'N/A';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  const getClienteNome = (p) => (p?.cliente?.nome || p?.cliente_nome || p?.payload?.cliente_nome || 'Cliente não definido');
  const getValorProjeto = (p) => {
    const v = p?.preco_final ?? p?.preco_venda ?? p?.custo_total_projeto ?? p?.payload?.preco_final ?? p?.payload?.preco_venda ?? p?.payload?.custo_total_projeto ?? null;
    return normalizeNumber(v);
  };

  return (
    <div className="space-y-4 h-full w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Pipeline de Vendas</h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Gerencie seus projetos por estágio</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex bg-white border border-gray-200 rounded-lg p-1 gap-1 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("kanban")}
              className={`h-8 w-8 p-0 ${viewMode === "kanban" ? "bg-fohat-light text-fohat-blue" : "text-gray-500 hover:text-gray-700"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={`h-8 w-8 p-0 ${viewMode === "list" ? "bg-fohat-light text-fohat-blue" : "text-gray-500 hover:text-gray-700"}`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Link to={createPageUrl("NovoProjeto")} className="flex-shrink-0">
            <Button className="bg-fohat-blue hover:bg-fohat-dark text-white shadow-lg shadow-blue-900/20 transition-colors duration-300 text-xs sm:text-sm">
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Novo Projeto</span>
              <span className="xs:hidden">Novo</span>
            </Button>
          </Link>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div 
          ref={kanbanScrollRef}
          {...bindKanbanDragScroll()}
          style={{ touchAction: "pan-y" }}
          className="kanban-scroll flex gap-3 sm:gap-4 lg:gap-6 pb-6 overflow-x-auto overflow-y-hidden w-full cursor-grab active:cursor-grabbing scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-500" 
        >
        {statusOrder.map((status) => {
          const config = statusConfig[status];
          const Icon = config.icon;
          const projetosStatus = grouped[status] || [];
          
          return (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex-shrink-0 w-72 sm:w-80 ${config.bgColor} rounded-xl p-3 sm:p-4 border border-gray-200 flex flex-col`}
              style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '400px' }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className={`p-1.5 sm:p-2 rounded-lg ${config.color} flex-shrink-0`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-sm sm:text-base ${config.textColor} truncate`}>{config.label}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{projetosStatus.length} projetos</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-8 sm:w-8 p-0 flex-shrink-0">
                  <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
              
              <div className="space-y-3 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
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
                        <CardContent className="p-3 sm:p-4">
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-gray-900 text-xs sm:text-sm line-clamp-2 flex-1 min-w-0">
                                {projeto.nome_projeto || projeto.nome || 'Projeto sem nome'}
                              </h4>
                              <div className="flex items-center gap-1 flex-shrink-0">
                              {(projeto.prioridade && projeto.prioridade !== 'Normal') && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {projeto.prioridade}
                                </Badge>
                              )}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-gray-500 hover:text-gray-800"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    align="end"
                                    className="w-56"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                  >
                                    <div className="space-y-1">
                                      <Link
                                        to={getProjetoPath(projeto.id)}
                                        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-50"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="w-4 h-4 text-fohat-blue" />
                                        Abrir projeto
                                      </Link>
                                      <button
                                        type="button"
                                        className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-50 text-left"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const origin = typeof window !== "undefined" ? window.location.origin : "";
                                          copyToClipboard(`${origin}${getProjetoPath(projeto.id)}`);
                                        }}
                                      >
                                        <Copy className="w-4 h-4 text-gray-600" />
                                        Copiar link
                                      </button>
                                      <button
                                        type="button"
                                        className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-50 text-left"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyToClipboard(projeto.nome_projeto || projeto.nome || "");
                                        }}
                                      >
                                        <Copy className="w-4 h-4 text-gray-600" />
                                        Copiar nome
                                      </button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                            
                            <div className="space-y-1.5 sm:space-y-2 text-xs text-gray-600">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <User className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">
                                  {getClienteNome(projeto)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <DollarSign className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{formatCurrency(getValorProjeto(projeto))}</span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <Calendar className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{formatDate(projeto.created_date)}</span>
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
                  <div className="text-center py-4 sm:py-6 lg:py-8 text-gray-400">
                    <Icon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs sm:text-sm">Nenhum projeto neste estágio</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      ) : (
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-180px)]">
          <div className="overflow-auto flex-1">
            <table className="w-full relative">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Projeto</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Valor</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Criado em</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projetosState.map((projeto) => {
                  const config = statusConfig[projeto.status] || statusConfig['lead'];
                  return (
                    <tr key={projeto.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {projeto.nome_projeto || projeto.nome || 'Projeto sem nome'}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {getClienteNome(projeto)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${config.color} border whitespace-nowrap`}>
                          {config.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {formatCurrency(getValorProjeto(projeto))}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {formatDate(projeto.created_date)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link to={`${createPageUrl("NovoProjeto")}?projeto_id=${projeto.id}`}>
                          <Button variant="ghost" size="sm" className="text-fohat-blue hover:bg-fohat-light h-8 px-2">
                            Abrir
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {projetosState.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-gray-500">
                      Nenhum projeto encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
