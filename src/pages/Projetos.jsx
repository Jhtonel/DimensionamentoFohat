
import React, { useState, useEffect } from "react";
import { Projeto, Cliente } from "@/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Zap,
  DollarSign,
  Calendar,
  MapPin,
  Edit,
  Trash2,
  FileText,
  LayoutGrid,
  List,
  Eye,
  X,
  Phone,
  Mail,
  User,
  Home,
  Sun,
  TrendingUp,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import authService, { useAuth } from "@/services/authService.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { systemConfig } from "@/config/systemConfig.js";
import { getBackendUrl } from "@/services/backendUrl.js";

const statusColors = {
  lead: "bg-gray-100 text-gray-700",
  dimensionamento: "bg-blue-100 text-blue-700",
  orcamento_enviado: "bg-purple-100 text-purple-700",
  negociacao: "bg-orange-100 text-orange-700",
  fechado: "bg-green-100 text-green-700",
  instalacao: "bg-cyan-100 text-cyan-700",
  concluido: "bg-emerald-100 text-emerald-700",
  perdido: "bg-red-100 text-red-700"
};

export default function Projetos() {
  const [projetos, setProjetos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [filteredProjetos, setFilteredProjetos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const { user } = useAuth();
  const [selectedUserEmail, setSelectedUserEmail] = useState(
    () => localStorage.getItem('admin_filter_user_email') || 'todos'
  );
  const [viewMode, setViewMode] = useState("grid");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState(null);
  const [projetoViews, setProjetoViews] = useState(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [metricsData, setMetricsData] = useState(null);
  const [metricsProjetoId, setMetricsProjetoId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const clienteId = urlParams.get('cliente_id');
    
    const base = (() => {
      let arr = projetos;
      if (clienteId) {
        arr = arr.filter(p => p.cliente_id === clienteId);
      }
      
      // 1. Filtro Admin
      if (user?.role === 'admin') {
        if (selectedUserEmail && selectedUserEmail !== 'todos') {
          const raw = String(selectedUserEmail || '').toLowerCase().trim();
          const emailPrefix = raw.includes('@') ? raw.split('@')[0] : raw;
          
          // Função de match flexível
          const matchKey = (value) => {
            const v = String(value || '').toLowerCase().trim();
            if (!v) return false;
            if (v === raw) return true;
            const vPrefix = v.includes('@') ? v.split('@')[0] : v;
            return vPrefix === emailPrefix;
          };
          
          // Buscar clientes do usuário selecionado
          const usuarioSelecionado = usuarios.find(u => {
            const uEmail = String(u.email || '').toLowerCase();
            return matchKey(uEmail) || matchKey(u.nome);
          });
          const uidSelecionado = usuarioSelecionado?.uid;
          
          const clientesDoUsuario = new Set();
          (clientes || []).forEach(c => {
            if (uidSelecionado && c.created_by === uidSelecionado) clientesDoUsuario.add(c.id);
            if (matchKey(c.created_by_email)) clientesDoUsuario.add(c.id);
            if (matchKey(c.created_by)) clientesDoUsuario.add(c.id);
          });
          
          arr = arr.filter(p => {
            // 1. Projeto tem vendedor_email ou created_by_email do usuário
            const candidates = [
              p?.vendedor_email,
              p?.payload?.vendedor_email,
              p?.created_by_email,
              p?.payload?.created_by_email,
            ];
            if (candidates.some(matchKey)) return true;
            
            // 2. Projeto está vinculado a um cliente do usuário
            if (p.cliente_id && clientesDoUsuario.has(p.cliente_id)) return true;
            
            // 3. Projeto tem nome de cliente que corresponde a um cliente do usuário (legado)
            if (p.cliente_nome) {
              const clienteMatch = clientes.find(c => 
                c.nome?.toLowerCase() === p.cliente_nome?.toLowerCase() && 
                clientesDoUsuario.has(c.id)
              );
              if (clienteMatch) return true;
            }
            
            return false;
          });
        }
        return arr;
      }

      // 2. Filtro Gestor (vê projetos próprios + da equipe)
      if (user?.role === 'gestor' && user.email) {
        return arr.filter(p => {
          const hasOwner = p.vendedor_email || p.created_by || p.payload?.vendedor_email || p.created_by_email;
          // Projetos legados (sem dono) são exibidos para gestores
          if (!hasOwner) return true;
          
          const userEmailLower = user.email.toLowerCase();
          const projetoEmail = (p.vendedor_email || p.payload?.vendedor_email || p.created_by_email || '').toLowerCase();
          
          // Projeto do próprio gestor
          if (projetoEmail === userEmailLower) return true;
          if (p.created_by === user.uid) return true;
          
          // TODO: Verificar se o projeto é de alguém da equipe do gestor
          // Por enquanto, gestor vê todos os projetos (como admin)
          return true;
        });
      }
      
      // 3. Filtro Vendedor (vê apenas seus projetos ou projetos onde é vendedor)
      // Nota: projetos legados sem vendedor_email/created_by são mostrados para todos
      if (user && user.uid) {
        return arr.filter(p => {
          const hasOwner = p.vendedor_email || p.created_by || p.payload?.vendedor_email;
          // Projetos legados (sem dono) são exibidos para todos os vendedores
          if (!hasOwner) return true;
          // Projetos com dono: verificar se pertence ao usuário atual
          const userEmailLower = (user.email || '').toLowerCase();
          return (
            (p.vendedor_email && p.vendedor_email.toLowerCase() === userEmailLower) || 
            p.created_by === user.uid ||
            (p.payload?.vendedor_email && p.payload.vendedor_email.toLowerCase() === userEmailLower) ||
            (p.created_by_email && p.created_by_email.toLowerCase() === userEmailLower)
          );
        });
      }

      return []; // Segurança
    })();
    
    if (!searchTerm) {
      setFilteredProjetos(base);
      return;
    }
    
    const filtered = base.filter(p => 
      p.nome_projeto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cidade?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProjetos(filtered);
  }, [searchTerm, projetos, user, selectedUserEmail]);

  const loadData = async () => {
    setLoading(true);
    const urlParams = new URLSearchParams(window.location.search);
    const clienteId = urlParams.get('cliente_id');
    
    const [projetosData, clientesData] = await Promise.all([
      Projeto.list("-created_date"),
      Cliente.list()
    ]);
    
    setProjetos(projetosData);
    setClientes(clientesData);
    
    // Filtro inicial também respeita usuário selecionado
    let initial = projetosData;
    if (clienteId) initial = initial.filter(p => p.cliente_id === clienteId);
    if (user?.role === 'admin' && selectedUserEmail && selectedUserEmail !== 'todos') {
      const raw = String(selectedUserEmail || '').toLowerCase().trim();
      const emailPrefix = raw.includes('@') ? raw.split('@')[0] : raw;
      
      const matchKey = (value) => {
        const v = String(value || '').toLowerCase().trim();
        if (!v) return false;
        if (v === raw) return true;
        const vPrefix = v.includes('@') ? v.split('@')[0] : v;
        return vPrefix === emailPrefix;
      };
      
      // Buscar clientes do usuário
      const clientesDoUsuario = new Set();
      (clientesData || []).forEach(c => {
        if (matchKey(c.created_by_email)) clientesDoUsuario.add(c.id);
        if (matchKey(c.created_by)) clientesDoUsuario.add(c.id);
      });
      
      initial = initial.filter(p => {
        const candidates = [p?.vendedor_email, p?.payload?.vendedor_email, p?.created_by_email, p?.payload?.created_by_email];
        if (candidates.some(matchKey)) return true;
        if (p.cliente_id && clientesDoUsuario.has(p.cliente_id)) return true;
        if (p.cliente_nome) {
          const clienteMatch = clientesData.find(c => 
            c.nome?.toLowerCase() === p.cliente_nome?.toLowerCase() && 
            clientesDoUsuario.has(c.id)
          );
          if (clienteMatch) return true;
        }
        return false;
      });
    }
    setFilteredProjetos(initial);
    
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const serverUrl = getBackendUrl();
      const resp = await fetch(`${serverUrl}/admin/users?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${(await authService.getAuthToken()) || ""}`,
        },
      });
      let items = [];
      if (resp.ok) {
        const json = await resp.json();
        const users = Array.isArray(json?.users) ? json.users : Array.isArray(json) ? json : [];
        items = users.map((u) => ({
          uid: u.uid,
          email: u.email || "",
          nome: u.nome || (u.email ? u.email.split("@")[0] : "Usuário"),
        }));
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

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este projeto?")) {
      await Projeto.delete(id);
      loadData();
    }
  };

  const getClienteNome = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente?.nome || "Cliente não encontrado";
  };

  const getClienteByProjeto = (projeto) => {
    // Buscar por cliente_id primeiro
    if (projeto.cliente_id) {
      const cliente = clientes.find(c => c.id === projeto.cliente_id);
      if (cliente) return cliente;
    }
    // Fallback: buscar por nome
    if (projeto.cliente_nome) {
      const cliente = clientes.find(c => c.nome?.toLowerCase() === projeto.cliente_nome?.toLowerCase());
      if (cliente) return cliente;
    }
    return null;
  };

  const handleViewDetails = async (projeto) => {
    setSelectedProjeto(projeto);
    setProjetoViews(null);
    setShowDetailsModal(true);
    
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

  const handleViewMetrics = async (projeto) => {
    setMetricsProjetoId(projeto.id);
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
              Projetos
            </h1>
            <p className="text-gray-600 mt-2">Gerencie seus projetos fotovoltaicos</p>
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
            <Link to={createPageUrl("NovoProjeto")}>
              <Button className="bg-fohat-blue hover:bg-fohat-dark text-white shadow-lg shadow-blue-900/20 transition-colors duration-300">
                <Plus className="w-4 h-4 mr-2" />
                Novo Projeto
              </Button>
            </Link>
          </div>
        </motion.div>

        <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-center min-h-[60px]">
            <div className="relative w-full flex items-center">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por nome do projeto ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 focus:border-fohat-blue focus:ring-fohat-blue"
              />
            </div>
          </CardContent>
        </Card>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjetos.map((projeto) => (
              <motion.div
                key={projeto.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
              <Card className="bg-white border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
                <CardContent className="p-6 relative">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-gray-900 mb-1">{projeto.nome_projeto}</h3>
                      <p className="text-sm text-gray-600">{getClienteNome(projeto.cliente_id)}</p>
                    </div>
                    <Badge className={`${statusColors[projeto.status]} border`}>
                      {projeto.status?.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {projeto.potencia_sistema_kwp && (
                      <div className="flex items-center gap-2 p-3 bg-fohat-light rounded-lg">
                        <Zap className="w-5 h-5 text-fohat-blue" />
                        <div>
                          <p className="text-xs text-gray-600">Potência</p>
                          <p className="font-bold text-gray-900">{projeto.potencia_sistema_kwp.toFixed(2)} kWp</p>
                        </div>
                      </div>
                    )}
                    
                    {projeto.preco_final && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-xs text-gray-600">Valor</p>
                          <p className="font-bold text-gray-900">
                            R$ {projeto.preco_final.toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    {projeto.cidade && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-fohat-orange" />
                        {projeto.cidade}, {projeto.estado}
                      </div>
                    )}
                    {projeto.created_date && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-fohat-orange" />
                        Criado em {format(new Date(projeto.created_date), "dd/MM/yyyy")}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 border-fohat-blue text-fohat-blue hover:bg-fohat-light"
                      onClick={() => handleViewDetails(projeto)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Mais
                    </Button>
                    <Link to={`${createPageUrl("NovoProjeto")}?projeto_id=${projeto.id}`}>
                      <Button variant="outline" size="icon" className="border-fohat-light text-fohat-blue hover:bg-fohat-light">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    {projeto.url_proposta && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(projeto.url_proposta, '_blank')}
                        className="border-green-200 text-green-600 hover:bg-green-50"
                        title="Ver Proposta"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleViewMetrics(projeto)}
                      className="border-blue-200 text-blue-600 hover:bg-blue-50"
                      title="Métricas de Visualização"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(projeto.id)}
                      className="text-gray-600 hover:text-red-600 hover:bg-red-50"
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
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Projeto / Cliente</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Dados Técnicos</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Local</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProjetos.map((projeto) => (
                    <tr key={projeto.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900">{projeto.nome_projeto}</p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <span className="font-medium">{getClienteNome(projeto.cliente_id)}</span>
                            {projeto.created_date && (
                              <span className="text-gray-400">• {format(new Date(projeto.created_date), "dd/MM/yyyy")}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={`${statusColors[projeto.status]} border whitespace-nowrap`}>
                          {projeto.status?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {projeto.potencia_sistema_kwp && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <Zap className="w-3 h-3 text-fohat-blue" />
                              {projeto.potencia_sistema_kwp.toFixed(2)} kWp
                            </div>
                          )}
                          {projeto.preco_final && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <DollarSign className="w-3 h-3 text-green-500" />
                              R$ {projeto.preco_final.toLocaleString('pt-BR')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {projeto.cidade ? (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <MapPin className="w-3 h-3 text-fohat-orange" />
                            {projeto.cidade}, {projeto.estado}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(projeto)}
                            className="text-fohat-blue hover:bg-fohat-light h-8 w-8"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
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
                            onClick={() => handleViewMetrics(projeto)}
                            className="text-purple-600 hover:bg-purple-50 h-8 w-8"
                            title="Métricas de Visualização"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </Button>
                          <Link to={`${createPageUrl("NovoProjeto")}?projeto_id=${projeto.id}`}>
                            <Button variant="ghost" size="icon" className="text-fohat-blue hover:bg-fohat-light h-8 w-8" title="Editar">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(projeto.id)}
                            className="text-gray-600 hover:text-red-600 h-8 w-8"
                            title="Excluir"
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

        {filteredProjetos.length === 0 && !loading && (
          <Card className="glass-card border-0 shadow-xl">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg">Nenhum projeto encontrado</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Detalhes do Projeto */}
      {showDetailsModal && selectedProjeto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailsModal(false)}>
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
                onClick={() => setShowDetailsModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold pr-8">{selectedProjeto.nome_projeto}</h2>
              <div className="flex items-center gap-3 mt-2">
                <Badge className={`${statusColors[selectedProjeto.status]} border-0`}>
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
              {(() => {
                const cliente = getClienteByProjeto(selectedProjeto);
                return cliente ? (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <User className="w-5 h-5 text-fohat-blue" />
                      Dados do Cliente
                    </h3>
                    <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Nome</p>
                        <p className="font-medium text-gray-800">{cliente.nome}</p>
                      </div>
                      {cliente.telefone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-fohat-blue" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Telefone</p>
                            <p className="font-medium text-gray-800">{cliente.telefone}</p>
                          </div>
                        </div>
                      )}
                      {cliente.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-fohat-blue" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                            <p className="font-medium text-gray-800">{cliente.email}</p>
                          </div>
                        </div>
                      )}
                      {cliente.endereco_completo && (
                        <div className="flex items-center gap-2 md:col-span-2">
                          <Home className="w-4 h-4 text-fohat-orange" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Endereço</p>
                            <p className="font-medium text-gray-800">{cliente.endereco_completo}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 bg-gray-50 rounded-xl p-4">
                    <p className="text-gray-500">Cliente: {selectedProjeto.cliente_nome || 'Não informado'}</p>
                  </div>
                );
              })()}

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
                      {(selectedProjeto.potencia_sistema_kwp || selectedProjeto.potencia_sistema || selectedProjeto.payload?.potencia_sistema || 0).toFixed(2)} kWp
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 uppercase">Valor</p>
                    <p className="text-xl font-bold text-gray-800">
                      R$ {(selectedProjeto.preco_final || selectedProjeto.preco_venda || selectedProjeto.payload?.preco_final || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 uppercase">Economia Mensal</p>
                    <p className="text-xl font-bold text-gray-800">
                      R$ {(selectedProjeto.economia_mensal_estimada || selectedProjeto.payload?.economia_mensal_estimada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <Clock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 uppercase">Payback</p>
                    <p className="text-xl font-bold text-gray-800">
                      {(selectedProjeto.anos_payback || selectedProjeto.payload?.anos_payback || 0).toFixed(1)} anos
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

              {/* Mais Detalhes */}
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
                  <div>
                    <p className="text-gray-500">Valor de Venda</p>
                    <p className="font-medium text-gray-800">R$ {(selectedProjeto.preco_venda || selectedProjeto.preco_final || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  {(selectedProjeto.quantidade_placas > 0) && (
                    <div>
                      <p className="text-gray-500">Quantidade de Placas</p>
                      <p className="font-medium text-gray-800">{selectedProjeto.quantidade_placas}</p>
                    </div>
                  )}
                  {(selectedProjeto.geracao_media_mensal > 0) && (
                    <div>
                      <p className="text-gray-500">Geração Média Mensal</p>
                      <p className="font-medium text-gray-800">{selectedProjeto.geracao_media_mensal.toFixed(0)} kWh</p>
                    </div>
                  )}
                  {selectedProjeto.tipo_telhado && (
                    <div>
                      <p className="text-gray-500">Tipo de Telhado</p>
                      <p className="font-medium text-gray-800">{selectedProjeto.tipo_telhado}</p>
                    </div>
                  )}
                  {selectedProjeto.concessionaria && (
                    <div>
                      <p className="text-gray-500">Concessionária</p>
                      <p className="font-medium text-gray-800">{selectedProjeto.concessionaria}</p>
                    </div>
                  )}
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
        </div>
      )}

      {/* Modal de Métricas de Visualização */}
      {showMetricsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMetricsModal(false)}>
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
        </div>
      )}
    </div>
  );
}
