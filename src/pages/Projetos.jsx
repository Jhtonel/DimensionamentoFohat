
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
  List
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { useAuth } from "@/services/authService.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { systemConfig } from "@/config/firebase.js";

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
          const email = selectedUserEmail.toLowerCase();
          arr = arr.filter(p => [p?.vendedor_email, p?.payload?.vendedor_email, p?.created_by_email, p?.cliente?.email]
            .map(v => (v || '').toLowerCase())
            .includes(email));
        }
        return arr;
      }

      // 2. Filtro Vendedor (vê apenas seus projetos ou projetos onde é vendedor)
      if (user && user.uid) {
        return arr.filter(p => 
          (p.vendedor_email && p.vendedor_email.toLowerCase() === user.email.toLowerCase()) || 
          p.created_by === user.uid ||
          (p.payload?.vendedor_email && p.payload.vendedor_email.toLowerCase() === user.email.toLowerCase())
        );
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
      const email = selectedUserEmail.toLowerCase();
      initial = initial.filter(p => [p?.vendedor_email, p?.payload?.vendedor_email, p?.created_by_email, p?.cliente?.email]
        .map(v => (v || '').toLowerCase())
        .includes(email));
    }
    setFilteredProjetos(initial);
    
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const serverUrl = (systemConfig?.apiUrl && systemConfig.apiUrl.length > 0)
        ? systemConfig.apiUrl
        : (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://localhost:8000');
      const resp = await fetch(`${serverUrl}/admin/firebase/list-users?t=${Date.now()}`);
      let items = [];
      if (resp.ok) {
        const json = await resp.json();
        if (json?.success && Array.isArray(json.users)) {
          items = json.users.map(u => ({
            uid: u.uid,
            email: u.email || '',
            nome: u.display_name || (u.email ? u.email.split('@')[0] : 'Usuário')
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
                    <Link to={`${createPageUrl("NovoProjeto")}?projeto_id=${projeto.id}`} className="flex-1">
                      <Button variant="outline" className="w-full border-fohat-light text-fohat-blue hover:bg-fohat-light">
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </Link>
                    {projeto.url_proposta && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(projeto.url_proposta, '_blank')}
                        className="border-green-200 text-green-600 hover:bg-green-50"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
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
                          {projeto.url_proposta && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(projeto.url_proposta, '_blank')}
                              className="text-green-600 hover:bg-green-50 h-8 w-8"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                          <Link to={`${createPageUrl("NovoProjeto")}?projeto_id=${projeto.id}`}>
                            <Button variant="ghost" size="icon" className="text-fohat-blue hover:bg-fohat-light h-8 w-8">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(projeto.id)}
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

        {filteredProjetos.length === 0 && !loading && (
          <Card className="glass-card border-0 shadow-xl">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg">Nenhum projeto encontrado</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
