
import React, { useState, useEffect } from "react";
import { Cliente, Projeto } from "@/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Mail,
  FolderKanban,
  Trash2,
  Edit
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

import ClienteForm from "../components/clientes/ClienteForm.jsx";
import { useAuth } from "@/services/authService.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { systemConfig } from "@/config/firebase.js";

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
        const email = selectedUserEmail.toLowerCase();
        const projetosDoUsuario = new Set(
          (projetos || [])
            .filter(p => [p?.vendedor_email, p?.payload?.vendedor_email, p?.created_by_email, p?.cliente?.email]
              .map(v => (v || '').toLowerCase())
              .includes(email))
            .map(p => p.cliente_id)
        );
        setFilteredClientes(clientes.filter(c => projetosDoUsuario.has(c.id)));
      } else {
        setFilteredClientes(clientes);
      }
      return;
    }
    
    const base = (() => {
      if (user?.role === 'admin' && selectedUserEmail && selectedUserEmail !== 'todos') {
        const email = selectedUserEmail.toLowerCase();
        const projetosDoUsuario = new Set(
          (projetos || [])
            .filter(p => [p?.vendedor_email, p?.payload?.vendedor_email, p?.created_by_email, p?.cliente?.email]
              .map(v => (v || '').toLowerCase())
              .includes(email))
            .map(p => p.cliente_id)
        );
        return clientes.filter(c => projetosDoUsuario.has(c.id));
      }
      return clientes;
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

  const handleSave = async (data) => {
    if (editingCliente) {
      await Cliente.update(editingCliente.id, data);
    } else {
      await Cliente.create(data);
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

  const getProjetosCount = (clienteId) => {
    return projetos.filter(p => p.cliente_id === clienteId).length;
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
              Clientes
            </h1>
            <p className="text-gray-600 mt-2">Gerencie sua base de clientes</p>
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
          <Button
            onClick={() => {
              setEditingCliente(null);
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-lg shadow-sky-500/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
          </div>
        </motion.div>

        <Card className="glass-card border-0 shadow-xl">
          <CardContent className="p-4 flex items-center justify-center min-h-[60px]">
            <div className="relative w-full flex items-center">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/50 border-sky-200 focus:border-sky-400"
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClientes.map((cliente) => (
            <motion.div
              key={cliente.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group">
                <CardContent className="p-6 relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg">
                          {cliente.nome?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{cliente.nome}</h3>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{cliente.tipo}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {cliente.telefone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-sky-500" />
                        {cliente.telefone}
                      </div>
                    )}
                    {cliente.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-sky-500" />
                        {cliente.email}
                      </div>
                    )}
                    {cliente.endereco_completo && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-sky-500" />
                        {cliente.endereco_completo}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-4 p-3 bg-sky-50 rounded-lg">
                    <FolderKanban className="w-4 h-4 text-sky-600" />
                    <span className="text-sm font-medium text-gray-700">
                      {getProjetosCount(cliente.id)} projeto(s)
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Link to={`${createPageUrl("Projetos")}?cliente_id=${cliente.id}`} className="flex-1">
                      <Button variant="outline" className="w-full border-sky-200 text-sky-600 hover:bg-sky-50">
                        Ver Projetos
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(cliente)}
                      className="text-gray-600 hover:text-sky-600 hover:bg-sky-50"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cliente.id)}
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

        {filteredClientes.length === 0 && !loading && (
          <Card className="glass-card border-0 shadow-xl">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg">Nenhum cliente encontrado</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
