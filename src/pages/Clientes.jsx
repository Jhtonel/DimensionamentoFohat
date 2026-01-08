
import React, { useState, useEffect } from "react";
import { Cliente, Projeto } from "@/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Mail,
  FolderKanban,
  Trash2,
  Edit,
  LayoutGrid,
  List,
  X,
  Calendar,
  FileText,
  ExternalLink,
  DollarSign,
  Zap,
  Eye,
  Sun,
  TrendingUp,
  Clock,
  User,
  Home
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

import ClienteForm from "../components/clientes/ClienteForm.jsx";
import { useAuth } from "@/services/authService.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { systemConfig } from "@/config/firebase.js";
import { getBackendUrl } from "@/services/backendUrl.js";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const { user } = useAuth();
  const [selectedUserEmail, setSelectedUserEmail] = useState(
    () => localStorage.getItem('admin_filter_user_email') || 'todos'
  );
  const [viewMode, setViewMode] = useState("grid");
  const [selectedCliente, setSelectedCliente] = useState(null); // Para o modal de detalhes
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [metricsData, setMetricsData] = useState(null);
  const [selectedProjeto, setSelectedProjeto] = useState(null); // Para o modal de detalhes do projeto
  const [projetoViews, setProjetoViews] = useState(null);

  useEffect(() => {
    loadData();
  }, []); // Dependência vazia para carregar dados apenas uma vez

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // A lógica de filtragem agora está diretamente neste useEffect
    if (!searchTerm) {
      // Filtro por usuário (admin)
      if (user?.role === 'admin' && selectedUserEmail && selectedUserEmail !== 'todos') {
        // selectedUserEmail pode ser email completo ou apenas o nome (displayName/prefixo)
        const raw = String(selectedUserEmail || '').toLowerCase().trim();
        const email = raw;
        const emailPrefix = raw.includes('@') ? raw.split('@')[0] : raw;

        const matchKey = (value) => {
          const v = String(value || '').toLowerCase().trim();
          if (!v) return false;
          if (v === email) return true;
          const vPrefix = v.includes('@') ? v.split('@')[0] : v;
          return vPrefix === emailPrefix;
        };

        const projetosDoUsuario = new Set(
          (projetos || [])
            .filter(p => {
              const candidates = [
                p?.vendedor_email,
                p?.payload?.vendedor_email,
                p?.created_by_email,
                p?.cliente?.email
              ];
              return candidates.some(matchKey);
            })
            .map(p => p.cliente_id)
        );
        // UID do usuário selecionado (quando backend listar do Firebase)
        const usuarioSelecionado = usuarios.find(u => {
          const uEmail = String(u.email || '').toLowerCase();
          const uPrefix = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
          return uEmail === email || uPrefix === emailPrefix || String(u.nome || '').toLowerCase() === emailPrefix;
        });
        const uidSelecionado = usuarioSelecionado?.uid;
        const filtered = clientes.filter(c => {
          if (projetosDoUsuario.has(c.id)) return true;
          if (uidSelecionado && c.created_by === uidSelecionado) return true;
          if (matchKey(c.created_by_email)) return true;
          if (matchKey(c.created_by)) return true; // dados legados (pode ser email)
          return false;
        });
        setFilteredClientes(filtered);
      } else {
        setFilteredClientes(clientes);
      }
      return;
    }
    
    const base = (() => {
      // 1. Admin
      if (user?.role === 'admin') {
        if (selectedUserEmail && selectedUserEmail !== 'todos') {
          const raw = String(selectedUserEmail || '').toLowerCase().trim();
          const email = raw;
          const emailPrefix = raw.includes('@') ? raw.split('@')[0] : raw;

          const matchKey = (value) => {
            const v = String(value || '').toLowerCase().trim();
            if (!v) return false;
            if (v === email) return true;
            const vPrefix = v.includes('@') ? v.split('@')[0] : v;
            return vPrefix === emailPrefix;
          };
          
          const projetosDoUsuario = new Set(
            (projetos || [])
              .filter(p => {
                const candidates = [
                  p?.vendedor_email,
                  p?.payload?.vendedor_email,
                  p?.created_by_email,
                  p?.cliente?.email
                ];
                return candidates.some(matchKey);
              })
              .map(p => p.cliente_id)
          );

          const usuarioSelecionado = usuarios.find(u => {
            const uEmail = String(u.email || '').toLowerCase();
            const uPrefix = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
            return uEmail === email || uPrefix === emailPrefix || String(u.nome || '').toLowerCase() === emailPrefix;
          });
          const uidSelecionado = usuarioSelecionado?.uid;

          return clientes.filter(c => {
            if (projetosDoUsuario.has(c.id)) return true;
            if (uidSelecionado && c.created_by === uidSelecionado) return true;
            if (matchKey(c.created_by_email)) return true;
            if (matchKey(c.created_by)) return true; // legado
            return false;
          });
        }
        // Admin vê tudo se não filtrar
        return clientes;
      }

      // 2. Vendedor (vê apenas seus clientes ou clientes vinculados a seus projetos)
      if (user && (user.uid || user.email)) {
        const meusProjetos = projetos.filter(p => 
            (p.vendedor_email && p.vendedor_email.toLowerCase() === user.email.toLowerCase()) || 
            p.created_by === user.uid ||
            (p.payload?.vendedor_email && p.payload.vendedor_email.toLowerCase() === user.email.toLowerCase())
        ).map(p => p.cliente_id);
        
        return clientes.filter(c => {
          if (c.created_by === user.uid) return true;
          const cEmail = (c.created_by_email || '').toLowerCase();
          if (user.email && cEmail === user.email.toLowerCase()) return true;
          if (user.email && (String(c.created_by || '')).toLowerCase() === user.email.toLowerCase()) return true;
          return meusProjetos.includes(c.id);
        });
      }

      return []; // Segurança: não logado ou sem role não vê nada
    })();

    const filtered = base.filter(c => 
      c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telefone?.includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredClientes(filtered);
  }, [searchTerm, clientes, projetos, selectedUserEmail, user]); // Depende de searchTerm e clientes

  const loadData = async () => {
    setLoading(true);
    const [clientesData, projetosData] = await Promise.all([
      Cliente.list("-created_date"),
      Projeto.list()
    ]);
    setClientes(clientesData);
    setProjetos(projetosData);
    // setFilteredClientes(clientesData); // Esta linha será redundantemente atualizada pelo useEffect de filtragem
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const serverUrl = getBackendUrl();
      const token = localStorage.getItem('app_jwt_token');
      const resp = await fetch(`${serverUrl}/admin/users?t=${Date.now()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      let items = [];
      if (resp.ok) {
        const json = await resp.json();
        if (json?.success && Array.isArray(json.items)) {
          items = json.items.map(u => ({
            uid: u.uid,
            email: u.email || '',
            nome: u.nome || (u.email ? u.email.split('@')[0] : 'Usuário')
          }));
        }
      }
      setUsuarios(items);
    } catch (_) {
      setUsuarios([]);
    }
  };

  const setUserFilter = (v) => {
    setSelectedUserEmail(v);
    localStorage.setItem('admin_filter_user_email', v);
  };

  const handleSave = async (data) => {
    const payload = { 
        ...data, 
        // owner é atribuído no backend (JWT). Mantemos payload limpo aqui.
    };
    if (editingCliente) {
      await Cliente.update(editingCliente.id, payload);
    } else {
      await Cliente.create(payload);
    }
    setShowForm(false);
    setEditingCliente(null);
    loadData(); // Recarrega os dados após salvar
  };

  const handleEdit = (cliente) => {
    setEditingCliente(cliente);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este cliente?")) {
      await Cliente.delete(id);
      loadData(); // Recarrega os dados após excluir
    }
  };

  const handleViewMetrics = async (projeto) => {
    setMetricsData(null);
    setShowMetricsModal(true);
    
    try {
      const response = await fetch(`${getBackendUrl()}/proposta/${projeto.id}/views`);
      if (response.ok) {
        const views = await response.json();
        setMetricsData({ ...views, projeto_nome: projeto.nome_projeto || projeto.cliente_nome });
      }
    } catch (error) {
      console.log('Erro ao carregar métricas:', error);
      setMetricsData({ error: true });
    }
  };

  const handleViewProjetoDetails = async (projeto) => {
    setSelectedProjeto(projeto);
    setProjetoViews(null);
    
    // Carregar métricas de visualização
    try {
      const response = await fetch(`${getBackendUrl()}/proposta/${projeto.id}/views`);
      if (response.ok) {
        const views = await response.json();
        setProjetoViews(views);
      }
    } catch (error) {
      console.log('Erro ao carregar métricas de visualização:', error);
    }
  };

  const getProjetosCount = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return 0;

    return projetos.filter(p => {
      // 1. Se o projeto TEM ID de cliente, match exato de ID é obrigatório
      if (p.cliente_id) {
        return String(p.cliente_id) === String(clienteId);
      }

      // 2. Fallback para projetos sem ID (legado/importado)
      // Lógica estrita: O NOME deve bater para evitar agrupar clientes "clones" (mesmo telefone/email)
      
      const normalize = (s) => String(s || '').toLowerCase().trim();
      const cNome = normalize(cliente.nome);
      const pNome = normalize(p.cliente?.nome || p.cliente_nome || p.payload?.cliente_nome);

      // Se não tiver nome no projeto ou no cliente, não dá pra vincular sem ID
      if (!pNome || !cNome) return false;

      // Se os nomes forem claramente diferentes, ignora (mesmo que telefone bata)
      // Ex: "Cliente A" vs "Cliente B" com mesmo telefone
      if (cNome !== pNome && !cNome.includes(pNome) && !pNome.includes(cNome)) {
        return false;
      }

      // Se o nome bate (ou é muito parecido), verificamos outros dados para confirmar
      // ou aceitamos se for match exato de nome
      if (cNome === pNome) return true;

      // Se nome é parcial, exige match de telefone ou email
      const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');
      const pPhone = normalizePhone(p.cliente?.telefone || p.payload?.cliente_telefone || p.cliente_telefone);
      const cPhone = normalizePhone(cliente.telefone);
      
      if (pPhone && cPhone && pPhone === cPhone && pPhone.length > 8) return true;

      const normalizeEmail = (email) => String(email || '').toLowerCase().trim();
      const pEmail = normalizeEmail(p.cliente?.email || p.payload?.cliente_email || p.cliente_email);
      const cEmail = normalizeEmail(cliente.email);
      
      if (pEmail && cEmail && pEmail === cEmail && pEmail.length > 5) return true;

      return false;
    }).length;
  };

  // Retorna a lista de projetos vinculados ao cliente
  const getProjetosDoCliente = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) return [];

    return projetos.filter(p => {
      if (p.cliente_id) {
        return String(p.cliente_id) === String(clienteId);
      }
      const normalize = (s) => String(s || '').toLowerCase().trim();
      const cNome = normalize(cliente.nome);
      const pNome = normalize(p.cliente?.nome || p.cliente_nome || p.payload?.cliente_nome);
      if (!pNome || !cNome) return false;
      if (cNome !== pNome && !cNome.includes(pNome) && !pNome.includes(cNome)) return false;
      if (cNome === pNome) return true;
      const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');
      const pPhone = normalizePhone(p.cliente?.telefone || p.payload?.cliente_telefone || p.cliente_telefone);
      const cPhone = normalizePhone(cliente.telefone);
      if (pPhone && cPhone && pPhone === cPhone && pPhone.length > 8) return true;
      return false;
    });
  };

  // Modal de detalhes do cliente
  const ClienteDetailsModal = ({ cliente, onClose }) => {
    if (!cliente) return null;
    const projetosCliente = getProjetosDoCliente(cliente.id);
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-fohat-blue to-blue-700 p-6 text-white">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold">{cliente.nome?.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{cliente.nome}</h2>
                  <p className="text-blue-100 text-sm uppercase tracking-wide">{cliente.tipo || 'Cliente'}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Dados do Cliente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {cliente.telefone && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-fohat-blue" />
                  <div>
                    <p className="text-xs text-gray-500">Telefone</p>
                    <p className="font-medium">{cliente.telefone}</p>
                  </div>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-fohat-blue" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium">{cliente.email}</p>
                  </div>
                </div>
              )}
              {cliente.endereco_completo && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg md:col-span-2">
                  <MapPin className="w-5 h-5 text-fohat-orange" />
                  <div>
                    <p className="text-xs text-gray-500">Endereço</p>
                    <p className="font-medium">{cliente.endereco_completo}</p>
                  </div>
                </div>
              )}
              {cliente.observacoes && (
                <div className="p-3 bg-gray-50 rounded-lg md:col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Observações</p>
                  <p className="text-sm text-gray-700">{cliente.observacoes}</p>
                </div>
              )}
            </div>

            {/* Lista de Projetos */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-fohat-blue" />
                  Projetos ({projetosCliente.length})
                </h3>
                <Link to={`${createPageUrl("NovoProjeto")}?cliente_id=${cliente.id}`}>
                  <Button size="sm" className="bg-fohat-blue hover:bg-fohat-dark text-white">
                    <Plus className="w-4 h-4 mr-1" />
                    Novo Projeto
                  </Button>
                </Link>
              </div>

              {projetosCliente.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhum projeto encontrado</p>
                  <p className="text-sm text-gray-400">Clique em "Novo Projeto" para criar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projetosCliente.map((projeto) => (
                    <div
                      key={projeto.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-fohat-blue hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900">{projeto.nome_projeto}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {projeto.status?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            {projeto.cidade && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {projeto.cidade}
                              </span>
                            )}
                            {projeto.preco_final > 0 && (
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <DollarSign className="w-3 h-3" />
                                R$ {Number(projeto.preco_final).toLocaleString('pt-BR')}
                              </span>
                            )}
                            {projeto.created_date && (
                              <span className="flex items-center gap-1 text-gray-400">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(projeto.created_date), "dd/MM/yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {projeto.url_proposta && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(projeto.url_proposta, '_blank')}
                              className="text-green-600 hover:bg-green-50 h-8 w-8"
                              title="Ver Proposta"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewProjetoDetails(projeto)}
                            className="text-blue-600 hover:bg-blue-50 h-8 w-8"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Link to={`${createPageUrl("NovoProjeto")}?projeto_id=${projeto.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-fohat-blue hover:bg-fohat-light h-8 w-8"
                              title="Editar Projeto"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-4 bg-gray-50 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                handleEdit(cliente);
                onClose();
              }}
              className="bg-fohat-blue hover:bg-fohat-dark text-white"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar Cliente
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="w-full space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-4xl font-bold text-fohat-blue">
              Clientes
            </h1>
            <p className="text-gray-600 mt-2">Gerencie sua base de clientes</p>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex bg-white border border-gray-200 rounded-lg p-1 gap-1 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("grid")}
                className={`h-8 w-8 p-0 ${viewMode === "grid" ? "bg-fohat-light text-fohat-blue" : "text-gray-500 hover:text-gray-700"}`}
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
          <Button
            onClick={() => {
              setEditingCliente(null);
              setShowForm(true);
            }}
            className="bg-fohat-blue hover:bg-fohat-dark text-white shadow-lg shadow-blue-900/20 transition-colors duration-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
          </div>
        </motion.div>

        <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-center min-h-[60px]">
            <div className="relative w-full flex items-center">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 focus:border-fohat-blue focus:ring-fohat-blue"
              />
            </div>
          </CardContent>
        </Card>

        <AnimatePresence>
          {showForm && (
            <ClienteForm
              cliente={editingCliente}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingCliente(null);
              }}
            />
          )}
        </AnimatePresence>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
            {filteredClientes.map((cliente) => (
              <motion.div
                key={cliente.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="h-full"
              >
              <Card className="bg-white border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group h-full flex flex-col">
                <CardContent className="p-6 relative flex flex-col h-full flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 w-full min-w-0">
                      <div className="w-12 h-12 bg-fohat-blue rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                        <span className="text-white font-bold text-lg">
                          {cliente.nome?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-lg text-gray-900 truncate pr-2" title={cliente.nome}>{cliente.nome}</h3>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{cliente.tipo}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6 flex-grow">
                    {cliente.telefone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-fohat-orange flex-shrink-0" />
                        <span className="truncate">{cliente.telefone}</span>
                      </div>
                    )}
                    {cliente.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-fohat-orange flex-shrink-0" />
                        <span className="truncate" title={cliente.email}>{cliente.email}</span>
                      </div>
                    )}
                    {cliente.endereco_completo && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-fohat-orange flex-shrink-0" />
                        <span className="truncate" title={cliente.endereco_completo}>{cliente.endereco_completo}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <div className="px-3 py-1.5 bg-fohat-light rounded-lg flex items-center gap-2 w-fit">
                        <FolderKanban className="w-4 h-4 text-fohat-blue" />
                        <span className="text-sm font-medium text-gray-700">
                          {getProjetosCount(cliente.id)} projeto(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
                    <Button 
                      variant="outline" 
                      className="flex-1 border-fohat-light text-fohat-blue hover:bg-fohat-light"
                      onClick={() => setSelectedCliente(cliente)}
                    >
                      Ver Mais
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(cliente)}
                      className="text-gray-600 hover:text-fohat-blue hover:bg-fohat-light shrink-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cliente.id)}
                      className="text-gray-600 hover:text-red-600 hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass-card border-0 shadow-xl rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Nome</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Contato</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Endereço</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Projetos</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-fohat-blue rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                            <span className="text-white font-bold text-xs">
                              {cliente.nome?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{cliente.nome}</p>
                            <p className="text-xs text-gray-500">{cliente.tipo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {cliente.telefone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="w-3 h-3 text-fohat-orange" />
                              {cliente.telefone}
                            </div>
                          )}
                          {cliente.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="w-3 h-3 text-fohat-orange" />
                              {cliente.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {cliente.endereco_completo ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600 max-w-[200px] truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0 text-fohat-orange" />
                            <span className="truncate" title={cliente.endereco_completo}>
                              {cliente.endereco_completo}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <Badge variant="secondary" className="bg-fohat-light text-fohat-blue hover:bg-blue-100">
                          {getProjetosCount(cliente.id)} projeto(s)
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-fohat-blue hover:bg-fohat-light h-8 px-2"
                            onClick={() => setSelectedCliente(cliente)}
                          >
                            Ver Mais
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(cliente)}
                            className="text-gray-600 hover:text-fohat-blue hover:bg-fohat-light h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cliente.id)}
                            className="text-gray-600 hover:text-red-600 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredClientes.length === 0 && !loading && (
          <Card className="glass-card border-0 shadow-xl">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg">Nenhum cliente encontrado</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Detalhes do Cliente */}
      <AnimatePresence>
        {selectedCliente && (
          <ClienteDetailsModal
            cliente={selectedCliente}
            onClose={() => setSelectedCliente(null)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Métricas de Visualização */}
      <AnimatePresence>
        {showMetricsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
            onClick={() => setShowMetricsModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-5 text-white relative">
                <button 
                  onClick={() => setShowMetricsModal(false)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <Eye className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Métricas de Visualização</h2>
                    <p className="text-white/80 text-sm truncate max-w-[250px]">{metricsData?.projeto_nome || 'Proposta'}</p>
                  </div>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="p-5">
                {metricsData && !metricsData.error ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-xl p-4 text-center">
                        <p className="text-4xl font-bold text-blue-600">{metricsData.total_views || 0}</p>
                        <p className="text-xs text-gray-500 uppercase mt-1">Visualizações</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4 text-center">
                        <p className="text-4xl font-bold text-green-600">{metricsData.unique_views || 0}</p>
                        <p className="text-xs text-gray-500 uppercase mt-1">Visitantes Únicos</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-sm font-medium text-gray-700">
                          {metricsData.first_view 
                            ? new Date(metricsData.first_view).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </p>
                        <p className="text-xs text-gray-500 uppercase mt-1">Primeira Visualização</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-sm font-medium text-gray-700">
                          {metricsData.last_view 
                            ? new Date(metricsData.last_view).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </p>
                        <p className="text-xs text-gray-500 uppercase mt-1">Última Visualização</p>
                      </div>
                    </div>

                    {/* Histórico recente */}
                    {metricsData.views_history && metricsData.views_history.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Últimas Visualizações</p>
                        <div className="bg-gray-50 rounded-xl p-3 max-h-40 overflow-y-auto">
                          {metricsData.views_history.slice(-5).reverse().map((view, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 text-xs">
                              <span className="text-gray-600">
                                {new Date(view.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-gray-400 truncate max-w-[120px]" title={view.user_agent}>
                                {view.user_agent?.includes('Mobile') ? '📱' : '💻'} {view.ip}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : metricsData?.error ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Erro ao carregar métricas</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Carregando métricas...</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 p-4 flex justify-end">
                <Button variant="outline" onClick={() => setShowMetricsModal(false)}>
                  Fechar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes do Projeto */}
      <AnimatePresence>
        {selectedProjeto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
            onClick={() => setSelectedProjeto(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header com gradiente */}
              <div className="bg-gradient-to-r from-fohat-blue to-blue-700 p-6 text-white relative">
                <button 
                  onClick={() => setSelectedProjeto(null)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold pr-8">{selectedProjeto.nome_projeto}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className="bg-white/20 border-0 text-white">
                    {selectedProjeto.status?.replace(/_/g, ' ')}
                  </Badge>
                  {selectedProjeto.created_date && (
                    <span className="text-white/80 text-sm flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(selectedProjeto.created_date), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
              </div>

              {/* Conteúdo */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Dados do Cliente */}
                {selectedCliente && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <User className="w-5 h-5 text-fohat-blue" />
                      Dados do Cliente
                    </h3>
                    <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Nome</p>
                        <p className="font-medium text-gray-800">{selectedCliente.nome}</p>
                      </div>
                      {selectedCliente.telefone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-fohat-blue" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Telefone</p>
                            <p className="font-medium text-gray-800">{selectedCliente.telefone}</p>
                          </div>
                        </div>
                      )}
                      {selectedCliente.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-fohat-blue" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                            <p className="font-medium text-gray-800">{selectedCliente.email}</p>
                          </div>
                        </div>
                      )}
                      {selectedCliente.endereco_completo && (
                        <div className="flex items-center gap-2 md:col-span-2">
                          <Home className="w-4 h-4 text-fohat-orange" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Endereço</p>
                            <p className="font-medium text-gray-800">{selectedCliente.endereco_completo}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dados Técnicos */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Dados Técnicos
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <Sun className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 uppercase">Potência</p>
                      <p className="text-xl font-bold text-gray-800">
                        {(selectedProjeto.potencia_sistema_kwp || selectedProjeto.potencia_sistema || 0).toFixed(2)} kWp
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 uppercase">Valor</p>
                      <p className="text-xl font-bold text-gray-800">
                        R$ {(selectedProjeto.preco_final || selectedProjeto.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                      <TrendingUp className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 uppercase">Economia Mensal</p>
                      <p className="text-xl font-bold text-gray-800">
                        R$ {(selectedProjeto.economia_mensal_estimada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4 text-center">
                      <Clock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 uppercase">Payback</p>
                      <p className="text-xl font-bold text-gray-800">
                        {(selectedProjeto.anos_payback || 0).toFixed(1)} anos
                      </p>
                    </div>
                  </div>
                </div>

                {/* Localização */}
                {(selectedProjeto.cidade || selectedProjeto.endereco_completo) && (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-fohat-orange" />
                      Localização
                    </h3>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-medium text-gray-800">
                        {selectedProjeto.endereco_completo || `${selectedProjeto.cidade || ''}, ${selectedProjeto.estado || ''}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Detalhes do Projeto */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Detalhes do Projeto</h3>
                  <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Consumo Mensal</p>
                      <p className="font-medium text-gray-800">{(selectedProjeto.consumo_mensal_kwh || 0).toFixed(0)} kWh</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Concessionária</p>
                      <p className="font-medium text-gray-800">{selectedProjeto.concessionaria || 'Não informada'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Conta Atual Anual</p>
                      <p className="font-medium text-gray-800">R$ {(selectedProjeto.conta_atual_anual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Área Necessária</p>
                      <p className="font-medium text-gray-800">{(selectedProjeto.area_necessaria || 0).toFixed(2)} m²</p>
                    </div>
                  </div>
                </div>

                {/* Métricas de Visualização */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-500" />
                    Métricas de Visualização
                  </h3>
                  {projetoViews ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                          <p className="text-3xl font-bold text-blue-600">{projetoViews.total_views || 0}</p>
                          <p className="text-xs text-gray-500 uppercase mt-1">Visualizações Totais</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 text-center">
                          <p className="text-3xl font-bold text-green-600">{projetoViews.unique_views || 0}</p>
                          <p className="text-xs text-gray-500 uppercase mt-1">Visitantes Únicos</p>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-4 text-center">
                          <p className="text-sm font-medium text-purple-600">
                            {projetoViews.first_view 
                              ? new Date(projetoViews.first_view).toLocaleDateString('pt-BR')
                              : '-'}
                          </p>
                          <p className="text-xs text-gray-500 uppercase mt-1">Primeira Visualização</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-4 text-center">
                          <p className="text-sm font-medium text-amber-600">
                            {projetoViews.last_view 
                              ? new Date(projetoViews.last_view).toLocaleDateString('pt-BR')
                              : '-'}
                          </p>
                          <p className="text-xs text-gray-500 uppercase mt-1">Última Visualização</p>
                        </div>
                      </div>

                      {/* Logs de Visualização */}
                      {projetoViews.views_history && projetoViews.views_history.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Histórico de Acessos</p>
                          <div className="bg-gray-50 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Data/Hora</th>
                                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">IP</th>
                                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Dispositivo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {projetoViews.views_history.slice().reverse().map((view, i) => {
                                  // Detectar tipo de dispositivo pelo user agent
                                  const ua = (view.user_agent || '').toLowerCase();
                                  let device = { icon: '💻', name: 'Desktop' };
                                  if (ua.includes('iphone')) device = { icon: '📱', name: 'iPhone' };
                                  else if (ua.includes('ipad')) device = { icon: '📱', name: 'iPad' };
                                  else if (ua.includes('android') && ua.includes('mobile')) device = { icon: '📱', name: 'Android' };
                                  else if (ua.includes('android')) device = { icon: '📱', name: 'Android Tablet' };
                                  else if (ua.includes('macintosh') || ua.includes('mac os')) device = { icon: '🖥️', name: 'Mac' };
                                  else if (ua.includes('windows')) device = { icon: '🖥️', name: 'Windows' };
                                  else if (ua.includes('linux')) device = { icon: '🖥️', name: 'Linux' };
                                  else if (ua.includes('curl')) device = { icon: '🤖', name: 'Bot/API' };
                                  
                                  return (
                                    <tr key={i} className="border-t border-gray-100">
                                      <td className="py-2 px-3 text-gray-600">
                                        {new Date(view.timestamp).toLocaleDateString('pt-BR', { 
                                          day: '2-digit', 
                                          month: '2-digit', 
                                          year: '2-digit',
                                          hour: '2-digit', 
                                          minute: '2-digit' 
                                        })}
                                      </td>
                                      <td className="py-2 px-3 text-gray-500 font-mono text-xs">{view.ip}</td>
                                      <td className="py-2 px-3">
                                        <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded text-xs">
                                          <span>{device.icon}</span>
                                          <span className="text-gray-700">{device.name}</span>
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-500">
                      <p>Carregando métricas...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer com ações */}
              <div className="border-t border-gray-100 p-4 flex justify-end gap-3">
                {selectedProjeto.url_proposta && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedProjeto.url_proposta, '_blank')}
                    className="border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver Proposta
                  </Button>
                )}
                <Link to={`${createPageUrl("NovoProjeto")}?projeto_id=${selectedProjeto.id}`}>
                  <Button className="bg-fohat-blue hover:bg-fohat-dark text-white">
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Projeto
                  </Button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
