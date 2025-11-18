
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
  FileText
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
      if (user?.role === 'admin' && selectedUserEmail && selectedUserEmail !== 'todos') {
        const email = selectedUserEmail.toLowerCase();
        arr = arr.filter(p => [p?.vendedor_email, p?.payload?.vendedor_email, p?.created_by_email, p?.cliente?.email]
          .map(v => (v || '').toLowerCase())
          .includes(email));
      }
      return arr;
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-600 to-orange-500 bg-clip-text text-transparent">
              Projetos
            </h1>
            <p className="text-gray-600 mt-2">Gerencie seus projetos fotovoltaicos</p>
          </div>
          <div className="flex items-end gap-3">
            {user?.role === 'admin' && (
              <div className="hidden sm:block">
                <label className="text-xs text-gray-500 block mb-1">Usuário</label>
                <Select value={selectedUserEmail} onValueChange={setUserFilter}>
                  <SelectTrigger className="h-9 w-56">
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
              <Button className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-lg shadow-sky-500/30">
                <Plus className="w-4 h-4 mr-2" />
                Novo Projeto
              </Button>
            </Link>
          </div>
        </motion.div>

        <Card className="glass-card border-0 shadow-xl">
          <CardContent className="p-4 flex items-center justify-center min-h-[60px]">
            <div className="relative w-full flex items-center">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por nome do projeto ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/50 border-sky-200 focus:border-sky-400"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjetos.map((projeto) => (
            <motion.div
              key={projeto.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group">
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
                      <div className="flex items-center gap-2 p-3 bg-sky-50 rounded-lg">
                        <Zap className="w-5 h-5 text-sky-600" />
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
                        <MapPin className="w-4 h-4 text-sky-500" />
                        {projeto.cidade}, {projeto.estado}
                      </div>
                    )}
                    {projeto.created_date && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-sky-500" />
                        Criado em {format(new Date(projeto.created_date), "dd/MM/yyyy")}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link to={`${createPageUrl("NovoProjeto")}?projeto_id=${projeto.id}`} className="flex-1">
                      <Button variant="outline" className="w-full border-sky-200 text-sky-600 hover:bg-sky-50">
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
