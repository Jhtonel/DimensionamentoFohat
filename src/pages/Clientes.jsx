
import React, { useState, useEffect } from "react";
import { Cliente, Projeto } from "@/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  List
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
  const [viewMode, setViewMode] = useState("grid");

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
    const payload = { 
        ...data, 
        created_by: editingCliente ? editingCliente.created_by : user?.uid,
        created_by_email: editingCliente ? editingCliente.created_by_email : (user?.email || null),
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
                    <Link to={`${createPageUrl("Projetos")}?cliente_id=${cliente.id}`} className="flex-1">
                      <Button variant="outline" className="w-full border-fohat-light text-fohat-blue hover:bg-fohat-light">
                        Ver Projetos
                      </Button>
                    </Link>
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
                          <Link to={`${createPageUrl("Projetos")}?cliente_id=${cliente.id}`}>
                            <Button variant="ghost" size="sm" className="text-fohat-blue hover:bg-fohat-light h-8 px-2">
                              Ver Projetos
                            </Button>
                          </Link>
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
    </div>
  );
}
