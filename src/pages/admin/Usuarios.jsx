import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Usuario } from "@/entities";
import { systemConfig } from "@/config/firebase.js";
import { getBackendUrl } from "@/services/backendUrl.js";
import { useAuth } from "@/services/authService.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, GripVertical, User, Shield, Briefcase, Wrench, Settings, X, Check, Users, FileText, Target, Lock, BarChart3, Download, UserPlus, UserMinus, Save } from "lucide-react";

// Configuração visual das roles
const ROLE_CONFIG = {
  admin: {
    label: "Admin",
    icon: Shield,
    color: "bg-red-50 border-red-200",
    headerColor: "bg-red-100 border-red-300",
    iconColor: "text-red-600",
    description: "Acesso total ao sistema"
  },
  gestor: {
    label: "Gestor",
    icon: Briefcase,
    color: "bg-blue-50 border-blue-200",
    headerColor: "bg-blue-100 border-blue-300",
    iconColor: "text-blue-600",
    description: "Gerencia equipe e relatórios"
  },
  vendedor: {
    label: "Vendedor",
    icon: User,
    color: "bg-green-50 border-green-200",
    headerColor: "bg-green-100 border-green-300",
    iconColor: "text-green-600",
    description: "Cria propostas e projetos"
  },
  instalador: {
    label: "Instalador",
    icon: Wrench,
    color: "bg-orange-50 border-orange-200",
    headerColor: "bg-orange-100 border-orange-300",
    iconColor: "text-orange-600",
    description: "Executa instalações"
  }
};

// Definição completa de permissões do CRM
const PERMISSIONS_SCHEMA = {
  clientes: {
    label: "Clientes",
    icon: Users,
    permissions: {
      visualizar: { label: "Visualizar clientes", options: ["nenhum", "proprios", "equipe", "todos"] },
      criar: { label: "Criar clientes", type: "boolean" },
      editar: { label: "Editar clientes", options: ["nenhum", "proprios", "equipe", "todos"] },
      excluir: { label: "Excluir clientes", options: ["nenhum", "proprios", "equipe", "todos"] },
      exportar: { label: "Exportar lista de clientes", type: "boolean" }
    }
  },
  propostas: {
    label: "Propostas",
    icon: FileText,
    permissions: {
      visualizar: { label: "Visualizar propostas", options: ["nenhum", "proprios", "equipe", "todos"] },
      criar: { label: "Criar propostas", type: "boolean" },
      editar: { label: "Editar propostas", options: ["nenhum", "proprios", "equipe", "todos"] },
      excluir: { label: "Excluir propostas", options: ["nenhum", "proprios", "equipe", "todos"] },
      aprovar: { label: "Aprovar/reprovar propostas", type: "boolean" },
      compartilhar: { label: "Compartilhar propostas", type: "boolean" },
      ver_metricas: { label: "Ver métricas de visualização", options: ["nenhum", "proprios", "equipe", "todos"] }
    }
  },
  projetos: {
    label: "Projetos",
    icon: Target,
    permissions: {
      visualizar: { label: "Visualizar projetos", options: ["nenhum", "proprios", "equipe", "todos"] },
      criar: { label: "Criar projetos", type: "boolean" },
      editar: { label: "Editar projetos", options: ["nenhum", "proprios", "equipe", "todos"] },
      excluir: { label: "Excluir projetos", options: ["nenhum", "proprios", "equipe", "todos"] },
      alterar_status: { label: "Alterar status do projeto", options: ["nenhum", "proprios", "equipe", "todos"] }
    }
  },
  dashboard: {
    label: "Dashboard",
    icon: BarChart3,
    permissions: {
      ver_dashboard: { label: "Acessar Dashboard", type: "boolean" },
      ver_metricas_equipe: { label: "Ver métricas da equipe", type: "boolean" },
      ver_metricas_empresa: { label: "Ver métricas da empresa", type: "boolean" },
      exportar_relatorios: { label: "Exportar relatórios", type: "boolean" },
      definir_metas: { label: "Definir metas", type: "boolean" }
    }
  },
  financeiro: {
    label: "Financeiro",
    icon: Download,
    permissions: {
      ver_valores: { label: "Ver valores de propostas", type: "boolean" },
      ver_comissoes: { label: "Ver comissões", options: ["nenhum", "proprios", "equipe", "todos"] },
      ver_custos: { label: "Ver custos de projetos", type: "boolean" },
      ver_margem: { label: "Ver margem de lucro", type: "boolean" }
    }
  },
  sistema: {
    label: "Sistema",
    icon: Lock,
    permissions: {
      configuracoes: { label: "Acessar Configurações", type: "boolean" },
      gerenciar_usuarios: { label: "Gerenciar Usuários", type: "boolean" },
      gerenciar_permissoes: { label: "Gerenciar Permissões", type: "boolean" },
      ver_logs: { label: "Ver logs de atividade", type: "boolean" },
      backup: { label: "Realizar backup", type: "boolean" }
    }
  }
};

// Permissões padrão por role
const DEFAULT_PERMISSIONS = {
  admin: {
    clientes: { visualizar: "todos", criar: true, editar: "todos", excluir: "todos", exportar: true },
    propostas: { visualizar: "todos", criar: true, editar: "todos", excluir: "todos", aprovar: true, compartilhar: true, ver_metricas: "todos" },
    projetos: { visualizar: "todos", criar: true, editar: "todos", excluir: "todos", alterar_status: "todos" },
    dashboard: { ver_dashboard: true, ver_metricas_equipe: true, ver_metricas_empresa: true, exportar_relatorios: true, definir_metas: true },
    financeiro: { ver_valores: true, ver_comissoes: "todos", ver_custos: true, ver_margem: true },
    sistema: { configuracoes: true, gerenciar_usuarios: true, gerenciar_permissoes: true, ver_logs: true, backup: true }
  },
  gestor: {
    clientes: { visualizar: "equipe", criar: true, editar: "equipe", excluir: "proprios", exportar: true },
    propostas: { visualizar: "equipe", criar: true, editar: "equipe", excluir: "proprios", aprovar: true, compartilhar: true, ver_metricas: "equipe" },
    projetos: { visualizar: "equipe", criar: true, editar: "equipe", excluir: "proprios", alterar_status: "equipe" },
    dashboard: { ver_dashboard: true, ver_metricas_equipe: true, ver_metricas_empresa: false, exportar_relatorios: true, definir_metas: true },
    financeiro: { ver_valores: true, ver_comissoes: "equipe", ver_custos: true, ver_margem: false },
    sistema: { configuracoes: false, gerenciar_usuarios: false, gerenciar_permissoes: false, ver_logs: false, backup: false }
  },
  vendedor: {
    clientes: { visualizar: "proprios", criar: true, editar: "proprios", excluir: "nenhum", exportar: false },
    propostas: { visualizar: "proprios", criar: true, editar: "proprios", excluir: "nenhum", aprovar: false, compartilhar: true, ver_metricas: "proprios" },
    projetos: { visualizar: "proprios", criar: true, editar: "proprios", excluir: "nenhum", alterar_status: "proprios" },
    dashboard: { ver_dashboard: true, ver_metricas_equipe: false, ver_metricas_empresa: false, exportar_relatorios: false, definir_metas: false },
    financeiro: { ver_valores: true, ver_comissoes: "proprios", ver_custos: false, ver_margem: false },
    sistema: { configuracoes: false, gerenciar_usuarios: false, gerenciar_permissoes: false, ver_logs: false, backup: false }
  },
  instalador: {
    clientes: { visualizar: "proprios", criar: false, editar: "nenhum", excluir: "nenhum", exportar: false },
    propostas: { visualizar: "proprios", criar: false, editar: "nenhum", excluir: "nenhum", aprovar: false, compartilhar: false, ver_metricas: "nenhum" },
    projetos: { visualizar: "proprios", criar: false, editar: "proprios", excluir: "nenhum", alterar_status: "proprios" },
    dashboard: { ver_dashboard: false, ver_metricas_equipe: false, ver_metricas_empresa: false, exportar_relatorios: false, definir_metas: false },
    financeiro: { ver_valores: false, ver_comissoes: "proprios", ver_custos: false, ver_margem: false },
    sistema: { configuracoes: false, gerenciar_usuarios: false, gerenciar_permissoes: false, ver_logs: false, backup: false }
  }
};

const OPTION_LABELS = {
  nenhum: "Nenhum",
  proprios: "Apenas próprios",
  equipe: "Da equipe",
  todos: "Todos"
};

// ============================================================================
// Modal de Configuração de Permissões e Equipe
// ============================================================================
function PermissionsModal({ role, isOpen, onClose, permissions, onSave, usuarios = [], equipes = {}, onSaveEquipe }) {
  // TODOS os hooks devem estar ANTES de qualquer return condicional
  const [localPermissions, setLocalPermissions] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('permissoes');
  const [localEquipes, setLocalEquipes] = useState({});
  const [activePermTab, setActivePermTab] = useState('clientes');

  useEffect(() => {
    if (role && isOpen && DEFAULT_PERMISSIONS[role]) {
      setLocalPermissions(permissions || DEFAULT_PERMISSIONS[role]);
      setLocalEquipes(equipes || {});
    }
  }, [permissions, role, isOpen, equipes]);

  // Return condicional DEPOIS de todos os hooks
  if (!isOpen || !role || !ROLE_CONFIG[role]) return null;
  
  const config = ROLE_CONFIG[role];
  const categories = Object.entries(PERMISSIONS_SCHEMA);
  const currentCategory = PERMISSIONS_SCHEMA[activePermTab];

  const handlePermissionChange = (category, permission, value) => {
    setLocalPermissions(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] || {}),
        [permission]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(role, localPermissions);
      if ((role === 'gestor' || role === 'admin') && onSaveEquipe) {
        await onSaveEquipe(localEquipes);
      }
    } finally {
      setSaving(false);
      onClose();
    }
  };

  // Gestores e admins disponíveis para supervisionar
  const gestoresDisponiveis = (usuarios || []).filter(u => u.role === 'gestor' || u.role === 'admin');
  
  // Usuários que podem ser supervisionados (vendedores e instaladores)
  const subordinadosDisponiveis = (usuarios || []).filter(u => u.role === 'vendedor' || u.role === 'instalador');

  // Adicionar membro à equipe de um gestor
  const adicionarMembro = (gestorEmail, membroEmail) => {
    setLocalEquipes(prev => {
      const equipeAtual = prev[gestorEmail] || [];
      if (!equipeAtual.includes(membroEmail)) {
        return { ...prev, [gestorEmail]: [...equipeAtual, membroEmail] };
      }
      return prev;
    });
  };

  // Remover membro da equipe
  const removerMembro = (gestorEmail, membroEmail) => {
    setLocalEquipes(prev => {
      const equipeAtual = prev[gestorEmail] || [];
      return { ...prev, [gestorEmail]: equipeAtual.filter(e => e !== membroEmail) };
    });
  };

  // Verificar se um membro já está em alguma equipe
  const getGestorDoMembro = (membroEmail) => {
    for (const [gestorEmail, membros] of Object.entries(localEquipes || {})) {
      if (Array.isArray(membros) && membros.includes(membroEmail)) {
        const gestor = (usuarios || []).find(u => u.email === gestorEmail);
        return gestor?.nome || gestorEmail;
      }
    }
    return null;
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl m-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 rounded-t-xl ${config.headerColor} flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            {React.createElement(config.icon, { className: `w-6 h-6 ${config.iconColor}` })}
            <div>
              <h2 className="text-xl font-bold text-gray-900">Configurar: {config.label}</h2>
              <p className="text-sm text-gray-600">{config.description}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs principais */}
        <div className="border-b bg-gray-100 px-6 flex-shrink-0">
          <div className="flex gap-2 py-2">
            <button
              onClick={() => setActiveTab('permissoes')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'permissoes' 
                  ? 'bg-white shadow text-sky-700' 
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Lock className="w-4 h-4 inline mr-2" />
              Permissões
            </button>
            {(role === 'gestor' || role === 'admin') && (
              <button
                onClick={() => setActiveTab('equipe')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'equipe' 
                    ? 'bg-white shadow text-sky-700' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Gestão de Equipes
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'permissoes' && (
            <div className="p-6">
              {/* Sub-tabs de permissões */}
              <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
                {categories.map(([key, schema]) => (
                  <button
                    key={key}
                    onClick={() => setActivePermTab(key)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${
                      activePermTab === key 
                        ? 'bg-sky-100 text-sky-700' 
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {React.createElement(schema.icon, { className: "w-3 h-3" })}
                    {schema.label}
                  </button>
                ))}
              </div>

              {/* Permissões da categoria */}
              {currentCategory && (
                <div className="space-y-2">
                  {Object.entries(currentCategory.permissions).map(([permKey, perm]) => {
                    const currentValue = localPermissions[activePermTab]?.[permKey];
                    
                    return (
                      <div 
                        key={permKey} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <span className="text-sm text-gray-700">{perm.label}</span>
                        
                        <div className="w-40">
                          {perm.type === 'boolean' ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handlePermissionChange(activePermTab, permKey, false)}
                                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium
                                  ${currentValue === false 
                                    ? 'bg-red-100 text-red-700 ring-1 ring-red-300' 
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                              >
                                <X className="w-3 h-3" /> Não
                              </button>
                              <button
                                onClick={() => handlePermissionChange(activePermTab, permKey, true)}
                                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium
                                  ${currentValue === true 
                                    ? 'bg-green-100 text-green-700 ring-1 ring-green-300' 
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                              >
                                <Check className="w-3 h-3" /> Sim
                              </button>
                            </div>
                          ) : (
                            <select
                              value={currentValue || 'nenhum'}
                              onChange={(e) => handlePermissionChange(activePermTab, permKey, e.target.value)}
                              className="w-full px-2 py-1 text-xs border rounded bg-white"
                            >
                              {perm.options?.map(opt => (
                                <option key={opt} value={opt}>{OPTION_LABELS[opt]}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'equipe' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  <Users className="w-5 h-5 inline mr-2" />
                  Configuração de Equipes
                </h3>
                <p className="text-sm text-gray-600">
                  Defina quais vendedores e instaladores fazem parte da equipe de cada gestor.
                  Membros da equipe terão seus dados visíveis para o gestor responsável.
                </p>
              </div>

              {/* Lista de gestores e suas equipes */}
              <div className="space-y-6">
                {gestoresDisponiveis.map(gestor => {
                  const membrosDaEquipe = localEquipes[gestor.email] || [];
                  const membrosDisponiveis = subordinadosDisponiveis.filter(
                    s => !membrosDaEquipe.includes(s.email)
                  );

                  return (
                    <div key={gestor.id} className="border rounded-lg overflow-hidden">
                      {/* Header do gestor */}
                      <div className={`px-4 py-3 ${gestor.role === 'admin' ? 'bg-red-50' : 'bg-blue-50'} border-b`}>
                        <div className="flex items-center gap-2">
                          {gestor.role === 'admin' ? (
                            <Shield className="w-5 h-5 text-red-600" />
                          ) : (
                            <Briefcase className="w-5 h-5 text-blue-600" />
                          )}
                          <div>
                            <span className="font-semibold text-gray-800">{gestor.nome}</span>
                            <span className="text-xs text-gray-500 ml-2">({gestor.email})</span>
                          </div>
                          <span className={`ml-auto text-xs px-2 py-1 rounded-full ${
                            gestor.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {ROLE_CONFIG[gestor.role].label}
                          </span>
                        </div>
                      </div>

                      {/* Membros da equipe */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            Membros da equipe ({membrosDaEquipe.length})
                          </span>
                          
                          {/* Adicionar membro */}
                          {membrosDisponiveis.length > 0 && (
                            <div className="flex items-center gap-2">
                              <select
                                className="text-sm border rounded px-2 py-1"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    adicionarMembro(gestor.email, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                defaultValue=""
                              >
                                <option value="">+ Adicionar membro...</option>
                                {membrosDisponiveis.map(m => (
                                  <option key={m.id} value={m.email}>
                                    {m.nome} ({ROLE_CONFIG[m.role]?.label})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {membrosDaEquipe.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {membrosDaEquipe.map(email => {
                              const membro = usuarios.find(u => u.email === email);
                              if (!membro) return null;
                              return (
                                <div 
                                  key={email}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                                    membro.role === 'vendedor' 
                                      ? 'bg-green-50 border border-green-200' 
                                      : 'bg-orange-50 border border-orange-200'
                                  }`}
                                >
                                  {membro.role === 'vendedor' ? (
                                    <User className="w-3 h-3 text-green-600" />
                                  ) : (
                                    <Wrench className="w-3 h-3 text-orange-600" />
                                  )}
                                  <span>{membro.nome}</span>
                                  <button
                                    onClick={() => removerMembro(gestor.email, email)}
                                    className="hover:bg-red-100 rounded-full p-0.5"
                                    title="Remover da equipe"
                                  >
                                    <X className="w-3 h-3 text-red-500" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed rounded-lg">
                            Nenhum membro na equipe. Adicione vendedores ou instaladores.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {gestoresDisponiveis.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum gestor ou admin cadastrado para configurar equipes.
                  </div>
                )}
              </div>

              {/* Subordinados sem equipe */}
              {subordinadosDisponiveis.length > 0 && (
                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2">
                    Usuários sem equipe definida
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {subordinadosDisponiveis.filter(s => !getGestorDoMembro(s.email)).map(user => (
                      <span 
                        key={user.id}
                        className={`px-3 py-1 rounded-full text-xs ${
                          user.role === 'vendedor' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {user.nome}
                      </span>
                    ))}
                    {subordinadosDisponiveis.filter(s => !getGestorDoMembro(s.email)).length === 0 && (
                      <span className="text-sm text-yellow-600">Todos os usuários estão em equipes!</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-b-xl">
          <button 
            onClick={() => {
              setLocalPermissions(DEFAULT_PERMISSIONS[role] || {});
            }}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Restaurar Padrão
          </button>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Card de usuário com drag & drop
// ============================================================================
const UserCard = React.memo(({ user, onRemove, gestorNome, onFieldChange, editedData }) => {
  const [isDragging, setIsDragging] = useState(false);
  
  // Usar dados editados ou originais
  const nome = editedData?.nome ?? user.nome ?? '';
  const cargo = editedData?.cargo ?? user.cargo ?? '';
  const hasChanges = editedData && (editedData.nome !== user.nome || editedData.cargo !== user.cargo);

  const handleDragStart = (e) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ userId: user.id, email: user.email }));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        bg-white rounded-lg border shadow-sm transition-all duration-200
        ${isDragging ? 'opacity-50 scale-95 rotate-2' : 'opacity-100'}
        ${hasChanges ? 'ring-2 ring-amber-300 border-amber-300' : ''}
        hover:shadow-md cursor-grab active:cursor-grabbing
      `}
    >
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <Input
            value={nome}
            onChange={(e) => onFieldChange(user.id, 'nome', e.target.value)}
            placeholder="Nome do usuário"
            className="flex-1 h-8 text-sm font-medium"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(user.id); }}
            className="text-red-500 hover:bg-red-50 h-8 w-8 rounded flex items-center justify-center"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        
        <div className="text-xs text-gray-500 truncate pl-6">{user.email}</div>
        
        {/* Mostrar gestor responsável */}
        {gestorNome && (
          <div className="text-xs text-blue-600 pl-6 flex items-center gap-1">
            <Briefcase className="w-3 h-3" />
            Equipe: {gestorNome}
          </div>
        )}
        
        <div className="pl-6">
          <Input
            value={cargo}
            onChange={(e) => onFieldChange(user.id, 'cargo', e.target.value)}
            placeholder="Cargo personalizado"
            className="h-7 text-xs"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Coluna do Kanban
// ============================================================================
const KanbanColumn = ({ role, users, onRemoveUser, onDropUser, onOpenSettings, permissions, equipes, onFieldChange, editedUsers }) => {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data?.userId) onDropUser(data.userId, role);
    } catch (err) {}
  };

  // Encontrar o gestor de cada usuário
  const getGestorDoUsuario = (userEmail) => {
    for (const [gestorEmail, membros] of Object.entries(equipes || {})) {
      if (membros.includes(userEmail)) {
        return gestorEmail;
      }
    }
    return null;
  };

  // Contar permissões ativas
  const permissionCount = useMemo(() => {
    if (!permissions) return 0;
    let count = 0;
    Object.values(permissions).forEach(category => {
      Object.values(category).forEach(value => {
        if (value === true || (value !== 'nenhum' && value !== false)) count++;
      });
    });
    return count;
  }, [permissions]);

  return (
    <div
      className={`flex flex-col rounded-xl border-2 transition-all duration-200 h-full
        ${isDragOver ? 'border-dashed border-sky-400 bg-sky-50 scale-[1.02]' : config.color}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className={`px-4 py-3 rounded-t-lg ${config.headerColor} flex-shrink-0`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
            <h3 className="font-bold text-gray-800">{config.label}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full
              ${users.length > 0 ? 'bg-white text-gray-700' : 'bg-gray-200 text-gray-500'}`}>
              {users.length}
            </span>
            <button
              onClick={() => onOpenSettings(role)}
              className="h-8 w-8 flex items-center justify-center hover:bg-white/50 rounded-lg"
              title="Configurar permissões e equipe"
            >
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-600">{config.description}</p>
          <span className="text-xs text-gray-500">{permissionCount} permissões</span>
        </div>
      </div>

      {/* Lista de usuários */}
      <div className="p-3 space-y-2 overflow-y-auto flex-1 min-h-[200px]">
        {users.map((user) => {
          const gestorEmail = getGestorDoUsuario(user.email);
          const gestorNome = gestorEmail 
            ? users.find(u => u.email === gestorEmail)?.nome || gestorEmail.split('@')[0]
            : null;
          
          return (
            <UserCard
              key={user.id}
              user={user}
              onRemove={onRemoveUser}
              gestorNome={(role === 'vendedor' || role === 'instalador') ? gestorNome : null}
              onFieldChange={onFieldChange}
              editedData={editedUsers?.[user.id]}
            />
          );
        })}
        
        {users.length === 0 && (
          <div className={`text-center py-8 rounded-lg border-2 border-dashed
            ${isDragOver ? 'border-sky-300 bg-sky-100' : 'border-gray-200'}`}>
            <Icon className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? 'text-sky-500' : 'text-gray-300'}`} />
            <p className={`text-sm ${isDragOver ? 'text-sky-600 font-medium' : 'text-gray-400'}`}>
              {isDragOver ? 'Solte aqui!' : 'Arraste usuários para cá'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Componente Principal
// ============================================================================
export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [onlyNoName, setOnlyNoName] = useState(false);
  const [settingsModal, setSettingsModal] = useState({ open: false, role: null });
  const { user: authUser, loading: authLoading, getAuthToken } = useAuth();
  const [rolePermissions, setRolePermissions] = useState({
    admin: DEFAULT_PERMISSIONS.admin,
    gestor: DEFAULT_PERMISSIONS.gestor,
    vendedor: DEFAULT_PERMISSIONS.vendedor,
    instalador: DEFAULT_PERMISSIONS.instalador
  });
  const [equipes, setEquipes] = useState({}); // { gestorEmail: [membroEmail1, membroEmail2, ...] }
  const [editedUsers, setEditedUsers] = useState({}); // { [userId]: { nome, cargo } }
  
  // Contar alterações pendentes
  const pendingChangesCount = Object.keys(editedUsers).filter(id => {
    const user = usuarios.find(u => u.id === id);
    const edited = editedUsers[id];
    return user && edited && (edited.nome !== user.nome || edited.cargo !== user.cargo);
  }).length;

  // Função para atualizar campo de um usuário
  const handleFieldChange = (userId, field, value) => {
    const user = usuarios.find(u => u.id === userId);
    setEditedUsers(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || { nome: user?.nome || '', cargo: user?.cargo || '' }),
        [field]: value
      }
    }));
  };

  // Salvar todas as alterações
  const handleSaveAll = async () => {
    setSaving(true);
    const serverUrl = getServerUrl();
    const changes = Object.entries(editedUsers).filter(([id, data]) => {
      const user = usuarios.find(u => u.id === id);
      return user && (data.nome !== user.nome || data.cargo !== user.cargo);
    });

    try {
      const token = await getAuthToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      for (const [userId, data] of changes) {
        const user = usuarios.find(u => u.id === userId);
        if (!user) continue;
        
        await fetch(`${serverUrl}/auth/roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            email: user.email,
            role: user.role,
            nome: data.nome,
            cargo: data.cargo
          })
        });
      }
      
      // Atualizar estado local
      setUsuarios(prev => prev.map(u => {
        const edited = editedUsers[u.id];
        if (edited) {
          return { ...u, nome: edited.nome, cargo: edited.cargo };
        }
        return u;
      }));
      
      setEditedUsers({});
      alert('Alterações salvas com sucesso!');
    } catch (e) {
      alert('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    // Importante: em prod precisamos aguardar o Firebase Auth hidratar o usuário/token,
    // senão as chamadas protegidas retornam vazio/403 e a tela fica sem usuários.
    if (authLoading) return;
    if (!authUser) {
      setUsuarios([]);
      return;
    }
    load();
    loadPermissions();
    loadEquipes();
  }, [authLoading, authUser]);

  const getServerUrl = () => {
    return (systemConfig?.apiUrl && systemConfig.apiUrl.length > 0)
      ? systemConfig.apiUrl
      : getBackendUrl();
  };

  const loadPermissions = async () => {
    try {
      const resp = await fetch(`${getServerUrl()}/config/role-permissions?t=${Date.now()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.permissions) {
          setRolePermissions(prev => ({ ...prev, ...data.permissions }));
        }
      }
    } catch (e) {}
  };

  const loadEquipes = async () => {
    try {
      const resp = await fetch(`${getServerUrl()}/config/equipes?t=${Date.now()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.equipes) {
          setEquipes(data.equipes);
        }
      }
    } catch (e) {}
  };

  const savePermissions = async (role, permissions) => {
    try {
      const token = await getAuthToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      await fetch(`${getServerUrl()}/config/role-permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ role, permissions })
      });
      setRolePermissions(prev => ({ ...prev, [role]: permissions }));
    } catch (e) {
      alert('Erro ao salvar permissões');
    }
  };

  const saveEquipes = async (novasEquipes) => {
    try {
      const token = await getAuthToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      await fetch(`${getServerUrl()}/config/equipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ equipes: novasEquipes })
      });
      setEquipes(novasEquipes);
    } catch (e) {
      alert('Erro ao salvar equipes');
    }
  };

  const load = async () => {
    try {
      const serverUrl = getServerUrl();
      const token = await getAuthToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await fetch(`${serverUrl}/admin/firebase/list-users?t=${Date.now()}`, {
        headers: authHeaders
      });
      let fbUsers = [];
      if (resp.ok) {
        const json = await resp.json();
        if (json?.success && Array.isArray(json.users)) {
          fbUsers = json.users;
        }
      }
      
      let roleByEmail = {};
      try {
        const rolesResp = await fetch(`${serverUrl}/auth/roles?t=${Date.now()}`, { headers: authHeaders });
        if (rolesResp.ok) {
          const rolesJson = await rolesResp.json();
          const items = Array.isArray(rolesJson?.items) ? rolesJson.items : [];
          items.forEach((it) => {
            if (it?.email && it?.role) roleByEmail[it.email.toLowerCase()] = { role: it.role, nome: it?.nome, cargo: it?.cargo };
          });
        }
      } catch (_) {}

      // Fallback: quando o Firebase Admin não está disponível em produção,
      // /admin/firebase/list-users pode retornar vazio. Nesse caso, ainda queremos
      // exibir os usuários conhecidos pelo mapeamento de roles (Postgres).
      if ((!fbUsers || fbUsers.length === 0) && roleByEmail && Object.keys(roleByEmail).length > 0) {
        fbUsers = Object.entries(roleByEmail).map(([email, info]) => ({
          uid: `role_${email}`,
          email,
          display_name: info?.nome || (email ? email.split('@')[0] : ''),
          phone_number: '',
          metadata: {}
        }));
      }
      
      const merged = fbUsers.map(u => {
        const info = roleByEmail[(u.email || '').toLowerCase()] || {};
        let nomeDisplay = info?.nome || u.display_name;
        if (!nomeDisplay && u.email) {
          nomeDisplay = u.email.split('@')[0];
        }
        
        return {
          id: u.uid,
          uid: u.uid,
          nome: nomeDisplay || 'Usuário sem nome',
          email: u.email || '',
          telefone: u.phone_number || '',
          role: info.role || 'vendedor',
          cargo: info.cargo || '',
          metadata: u.metadata
        };
      });
      
      setUsuarios(merged);
    } catch (e) {
      console.error('Falha ao listar usuários:', e);
      setUsuarios([]);
    }
  };

  const atualizarUsuario = useCallback(async (id, data) => {
    setLoading(true);
    try {
      const target = usuarios.find(u => u.id === id);
      if (!target) return;
      const token = await getAuthToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      await fetch(`${getServerUrl()}/auth/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ 
          email: target.email, 
          role: data.role || target.role || 'vendedor', 
          nome: data?.nome,
          cargo: data?.cargo
        })
      });
      await load();
    } finally {
      setLoading(false);
    }
  }, [usuarios, getAuthToken]);

  const removerUsuario = useCallback(async (id) => {
    const target = usuarios.find(u => u.id === id);
    if (!target) return;
    if (!confirm("Remover as permissões deste usuário?")) return;
    setLoading(true);
    try {
      const serverUrl = getServerUrl();
      const token = await getAuthToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        await fetch(`${serverUrl}/admin/firebase/delete-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ uid: target.uid || id })
        });
      } catch (_) {}
      await fetch(`${serverUrl}/auth/roles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ email: target.email })
      });
      await load();
    } finally {
      setLoading(false);
    }
  }, [usuarios, getAuthToken]);

  const moverUsuarioParaRole = useCallback(async (userId, newRole) => {
    const user = usuarios.find(u => u.id === userId);
    if (!user || user.role === newRole) return;
    
    setUsuarios(prev => prev.map(u => 
      u.id === userId ? { ...u, role: newRole } : u
    ));
    
    await atualizarUsuario(userId, { 
      nome: user.nome, 
      cargo: user.cargo, 
      role: newRole 
    });
  }, [usuarios, atualizarUsuario]);

  const agrupados = useMemo(() => {
    const base = { admin: [], gestor: [], vendedor: [], instalador: [] };
    (usuarios || []).forEach(u => {
      const role = Usuario.roles.includes(u.role) ? u.role : "vendedor";
      if (!base[role]) base[role] = [];
      base[role].push(u);
    });
    
    const filtroTexto = (u) =>
      String(u.nome || "").toLowerCase().includes(search.toLowerCase()) ||
      String(u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      String(u.telefone || "").toLowerCase().includes(search.toLowerCase());
    const filtroNome = (u) => (!onlyNoName ? true : !u.nome || u.nome.trim().length === 0 || u.nome === u.email);
    const filtrarArr = (arr) => arr.filter(u => filtroTexto(u) && filtroNome(u));
    let result = Object.fromEntries(Object.entries(base).map(([k, arr]) => [k, filtrarArr(arr)]));
    
    if (roleFilter && roleFilter !== 'todos') {
      result = Object.fromEntries(Object.entries(result).map(([k, arr]) => [k, k === roleFilter ? arr : []]));
    }
    return result;
  }, [usuarios, search, roleFilter, onlyNoName]);

  return (
    <div className="h-full w-full p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Usuários & Equipes</h1>
          <p className="text-gray-600">Arraste usuários entre colunas. Clique em ⚙️ para configurar permissões e equipes.</p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-40">
            <Label className="text-xs text-gray-500">Filtrar</Label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full h-9 px-3 border rounded-lg bg-white text-sm"
            >
              <option value="todos">Todos</option>
              {Object.entries(ROLE_CONFIG).map(([r, c]) => (
                <option key={r} value={r}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border h-9">
            <input
              id="only-noname"
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={onlyNoName}
              onChange={(e) => setOnlyNoName(e.target.checked)}
            />
            <Label htmlFor="only-noname" className="text-xs text-gray-600 cursor-pointer">Sem nome</Label>
          </div>
          <div className="w-56">
            <Label className="text-xs text-gray-500">Buscar</Label>
            <Input
              placeholder="Nome, e-mail ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white h-9"
            />
          </div>
          
          {/* Botão Salvar */}
          <Button
            onClick={handleSaveAll}
            disabled={saving || pendingChangesCount === 0}
            className={`h-9 px-4 ${
              pendingChangesCount > 0 
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : pendingChangesCount > 0 ? `Salvar (${pendingChangesCount})` : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {['admin', 'gestor', 'vendedor', 'instalador'].map(role => (
          <KanbanColumn
            key={role}
            role={role}
            users={agrupados[role]}
            onRemoveUser={removerUsuario}
            onDropUser={moverUsuarioParaRole}
            onOpenSettings={(r) => setSettingsModal({ open: true, role: r })}
            permissions={rolePermissions[role]}
            equipes={equipes}
            onFieldChange={handleFieldChange}
            editedUsers={editedUsers}
          />
        ))}
      </div>

      {/* Modal de Configurações */}
      <PermissionsModal
        role={settingsModal.role}
        isOpen={settingsModal.open}
        onClose={() => setSettingsModal({ open: false, role: null })}
        permissions={rolePermissions[settingsModal.role]}
        onSave={savePermissions}
        usuarios={usuarios}
        equipes={equipes}
        onSaveEquipe={saveEquipes}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-6 py-4 shadow-xl">
            <p className="text-gray-700">Atualizando...</p>
          </div>
        </div>
      )}
    </div>
  );
}
