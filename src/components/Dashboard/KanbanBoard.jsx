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
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  TrendingUp,
  Trash2,
  Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDateBR } from "@/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGesture } from "@use-gesture/react";
import { getBackendUrl } from "@/services/backendUrl.js";

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

export default function KanbanBoard({ clientes = [], projetos = [], onUpdate, user = null, onViewMetrics, onViewCustos }) {
  const [draggedProject, setDraggedProject] = useState(null);
  const [projetosState, setProjetosState] = useState(projetos);
  const [viewMode, setViewMode] = useState("kanban");
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const kanbanScrollRef = useRef(null);

  // Sincroniza quando o pai trouxer novos dados
  React.useEffect(() => {
    setProjetosState(projetos);
    // Pequeno delay para garantir renderização antes de checar scroll
    setTimeout(checkScroll, 100);
  }, [projetos]);

  const checkScroll = () => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 10);
    // Verifica se tem espaço para scrollar (com margem de erro de 10px)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  React.useEffect(() => {
    const el = kanbanScrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      checkScroll();
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [viewMode]); // Re-attach quando mudar viewMode

  const scroll = (direction) => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    const scrollAmount = 340; // Largura aproximada da coluna + gap
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

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
        <div className="relative group h-full">
          {/* Seta Esquerda */}
          <AnimatePresence>
            {showLeftArrow && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute left-0 top-0 bottom-6 z-20 flex items-center justify-center w-12 bg-gradient-to-r from-gray-50/90 to-transparent pointer-events-none"
              >
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full shadow-lg bg-white border-gray-200 pointer-events-auto hover:bg-gray-50 text-gray-700 hover:scale-110 transition-transform duration-200"
                  onClick={() => scroll('left')}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Seta Direita */}
          <AnimatePresence>
            {showRightArrow && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute right-0 top-0 bottom-6 z-20 flex items-center justify-center w-12 bg-gradient-to-l from-gray-50/90 to-transparent pointer-events-none"
              >
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full shadow-lg bg-white border-gray-200 pointer-events-auto hover:bg-gray-50 text-gray-700 hover:scale-110 transition-transform duration-200"
                  onClick={() => scroll('right')}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <div 
            ref={kanbanScrollRef}
            {...bindKanbanDragScroll()}
            style={{ 
              touchAction: "pan-y",
              scrollbarWidth: 'none',  /* Firefox */
              msOverflowStyle: 'none'  /* IE and Edge */
            }}
            className="flex gap-4 lg:gap-6 pb-6 overflow-x-auto overflow-y-hidden w-full h-full cursor-grab active:cursor-grabbing px-1 [&::-webkit-scrollbar]:hidden" 
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
                className="flex-shrink-0 w-80 flex flex-col h-full max-h-[calc(100vh-220px)]"
              >
                {/* Header da Coluna */}
                <div className={`flex items-center justify-between mb-3 p-3 rounded-xl border ${config.color.replace('text-', 'border-').replace('bg-', 'bg-opacity-50 bg-')} bg-white shadow-sm`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${config.color} bg-opacity-20`}>
                      <Icon className={`w-4 h-4 ${config.textColor}`} />
                    </div>
                    <span className="font-semibold text-sm text-gray-700">{config.label}</span>
                  </div>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-0 font-medium px-2 py-0.5 h-5 text-xs">
                    {projetosStatus.length}
                  </Badge>
                </div>
                
                {/* Área dos Cards - toda a área é droppable */}
                <div 
                  className={`flex-1 p-2 rounded-xl ${config.bgColor} border-2 transition-colors duration-200 ${draggedProject ? 'border-dashed border-gray-400 bg-gray-100/50' : 'border-transparent'} overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pr-1`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  <div className="space-y-3 min-h-full">
                    <AnimatePresence mode="popLayout">
                      {projetosStatus.map((projeto) => (
                        <motion.div
                          key={projeto.id}
                          layoutId={projeto.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, projeto)}
                          className="group/card relative"
                        >
                          <Card className="cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border-gray-200/60 bg-white">
                            <CardContent className="p-3.5">
                              {/* Barra lateral de cor de prioridade se existir, ou padrão */}
                              <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${projeto.prioridade === 'Alta' ? 'bg-red-500' : projeto.prioridade === 'Média' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                              
                              <div className="pl-2.5 space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug" title={projeto.nome_projeto || projeto.nome}>
                                    {projeto.nome_projeto || projeto.nome || 'Projeto sem nome'}
                                  </h4>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 -mr-2 -mt-1 text-gray-400 hover:text-gray-700 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        draggable={false}
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52">
                                      <DropdownMenuItem asChild>
                                        <Link to={getProjetoPath(projeto.id)} className="w-full cursor-pointer">
                                          <Eye className="w-4 h-4 mr-2" /> Ver Detalhes
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => window.open(projeto.url_proposta || `${getBackendUrl()}/proposta/${projeto.proposta_id || projeto.id}`, '_blank')}>
                                        <ExternalLink className="w-4 h-4 mr-2" /> Ver Proposta Online
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => window.open(`${getBackendUrl()}/proposta/${projeto.id}/ver-pdf`, '_blank')}>
                                        <FileSearch className="w-4 h-4 mr-2" /> Ver PDF
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => window.open(`${getBackendUrl()}/proposta/${projeto.id}/ver-pdf?download=true`, '_blank')}>
                                        <Download className="w-4 h-4 mr-2" /> Baixar PDF
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem asChild>
                                        <Link to={`${createPageUrl("NovoProjeto")}?clone_from=${projeto.id}`} className="w-full cursor-pointer">
                                          <Copy className="w-4 h-4 mr-2" /> Criar nova a partir desta
                                        </Link>
                                      </DropdownMenuItem>
                                      {onViewMetrics && (
                                        <DropdownMenuItem onClick={() => onViewMetrics(projeto)}>
                                          <TrendingUp className="w-4 h-4 mr-2" /> Ver Métricas
                                        </DropdownMenuItem>
                                      )}
                                      {user?.role === 'admin' && onViewCustos && (
                                        <DropdownMenuItem onClick={() => onViewCustos(projeto)}>
                                          <DollarSign className="w-4 h-4 mr-2" /> Ver Custos
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-red-600 focus:text-red-600 focus:bg-red-50" 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (confirm('Tem certeza que deseja excluir este projeto?')) {
                                            await Projeto.delete(projeto.id);
                                            if (onUpdate) onUpdate();
                                          }
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 text-xs text-gray-500" title="Cliente">
                                    <User className="w-3.5 h-3.5" />
                                    <span className="truncate max-w-[180px]">{getClienteNome(projeto)}</span>
                                  </div>
                                  <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-2">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-50 px-2 py-1 rounded-md">
                                      <DollarSign className="w-3.5 h-3.5 text-green-600" />
                                      {formatCurrency(getValorProjeto(projeto))}
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-medium">
                                      {formatDate(projeto.created_date)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    {projetosStatus.length === 0 && (
                      <div className={`flex flex-col items-center justify-center min-h-[200px] h-full text-gray-400 border-2 border-dashed rounded-lg transition-colors ${draggedProject ? 'border-gray-400 bg-gray-100/80' : 'border-gray-200 bg-gray-50/50'}`}>
                        <Icon className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs font-medium opacity-60">
                          {draggedProject ? 'Solte aqui' : 'Vazio'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          </div>
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
                        <div className="flex justify-end items-center gap-1">
                          <Link to={`${createPageUrl("NovoProjeto")}?projeto_id=${projeto.id}`}>
                            <Button variant="ghost" size="sm" className="text-fohat-blue hover:bg-fohat-light h-8 px-2">
                              <Eye className="w-4 h-4 mr-1" /> Abrir
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => window.open(projeto.url_proposta || `${getBackendUrl()}/proposta/${projeto.proposta_id || projeto.id}`, '_blank')}>
                                <ExternalLink className="w-4 h-4 mr-2" /> Ver Proposta Online
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`${getBackendUrl()}/proposta/${projeto.id}/ver-pdf`, '_blank')}>
                                <FileSearch className="w-4 h-4 mr-2" /> Ver PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`${getBackendUrl()}/proposta/${projeto.id}/ver-pdf?download=true`, '_blank')}>
                                <Download className="w-4 h-4 mr-2" /> Baixar PDF
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link to={`${createPageUrl("NovoProjeto")}?clone_from=${projeto.id}`} className="w-full cursor-pointer">
                                  <Copy className="w-4 h-4 mr-2" /> Criar nova a partir desta
                                </Link>
                              </DropdownMenuItem>
                              {onViewMetrics && (
                                <DropdownMenuItem onClick={() => onViewMetrics(projeto)}>
                                  <TrendingUp className="w-4 h-4 mr-2" /> Ver Métricas
                                </DropdownMenuItem>
                              )}
                              {user?.role === 'admin' && onViewCustos && (
                                <DropdownMenuItem onClick={() => onViewCustos(projeto)}>
                                  <DollarSign className="w-4 h-4 mr-2" /> Ver Custos
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600 focus:bg-red-50" 
                                onClick={async () => {
                                  if (confirm('Tem certeza que deseja excluir este projeto?')) {
                                    await Projeto.delete(projeto.id);
                                    if (onUpdate) onUpdate();
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
