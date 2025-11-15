import React, { useEffect, useMemo, useState } from "react";
import { Usuario } from "@/entities";
import { systemConfig } from "@/config/firebase.js";
import { authService } from "@/services/authService.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";

const ROLE_LABEL = {
  admin: "Admin",
  gestor: "Gestor",
  vendedor: "Vendedor",
  instalador: "Instalador"
};

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [novo, setNovo] = useState({ nome: "", email: "", telefone: "", role: "vendedor" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    // 1) Buscar usuários do Firebase via backend
    try {
      const serverUrl = (systemConfig?.apiUrl && systemConfig.apiUrl.length > 0)
        ? systemConfig.apiUrl
        : (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://localhost:8000');
      const resp = await fetch(`${serverUrl}/admin/firebase/list-users?t=${Date.now()}`);
      let fbUsers = [];
      if (resp.ok) {
        const json = await resp.json();
        if (json?.success && Array.isArray(json.users)) {
          fbUsers = json.users;
        }
      }
      // 2) Buscar mapeamentos de role do banco/local
      const rolesList = await Usuario.list("-created_date");
      const roleByEmail = {};
      rolesList.forEach(r => {
        if (r?.email) roleByEmail[r.email.toLowerCase()] = { id: r.id, role: r.role, telefone: r.telefone, nome: r.nome };
      });
      // 3) Mesclar: Firebase + role
      const merged = fbUsers.map(u => {
        const info = roleByEmail[(u.email || '').toLowerCase()] || {};
        return {
          id: u.uid, // usar uid do firebase para chave
          uid: u.uid,
          nome: u.display_name || (u.email ? u.email.split('@')[0] : 'Usuário'),
          email: u.email || '',
          telefone: info.telefone || u.phone_number || '',
          role: info.role || 'vendedor',
          _mapId: info.id || null // id do registro de role (se existir)
        };
      });
      setUsuarios(merged);
    } catch (e) {
      console.error('Falha ao listar usuários do Firebase:', e);
      // fallback: lista local
      const list = await Usuario.list("-created_date");
      setUsuarios(list);
    }
  };

  const salvarNovo = async () => {
    // Somente cria/atualiza o mapeamento de role no backend (não cria usuário no Firebase)
    if (!novo?.email) return;
    setLoading(true);
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const serverUrl = `http://${hostname}:8000`;
      await fetch(`${serverUrl}/auth/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: novo.email, role: novo.role || 'vendedor' })
      });
      setNovo({ nome: "", email: "", telefone: "", role: "vendedor" });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const atualizarUsuario = async (id, data) => {
    setLoading(true);
    try {
      // Atualiza/insere mapeamento de role por e-mail no backend (não no Firebase)
      const target = usuarios.find(u => u.id === id);
      if (!target) return;
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const serverUrl = `http://${hostname}:8000`;
      await fetch(`${serverUrl}/auth/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target.email, role: data.role || 'vendedor' })
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const removerUsuario = async (id) => {
    // Nesta versão não removemos do Firebase.
    // Removemos apenas o mapeamento de role (se houver) e resetamos para 'vendedor'.
    const target = usuarios.find(u => u.id === id);
    if (!target) return;
    if (!confirm("Remover as permissões deste usuário?")) return;
    setLoading(true);
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const serverUrl = `http://${hostname}:8000`;
      await fetch(`${serverUrl}/auth/roles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target.email })
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const agrupados = useMemo(() => {
    const base = { admin: [], gestor: [], vendedor: [], instalador: [] };
    (usuarios || []).forEach(u => {
      const role = Usuario.roles.includes(u.role) ? u.role : "vendedor";
      if (!base[role]) base[role] = [];
      base[role].push(u);
    });
    // filtro de busca
    if (!search) return base;
    const filtro = (u) =>
      String(u.nome || "").toLowerCase().includes(search.toLowerCase()) ||
      String(u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      String(u.telefone || "").toLowerCase().includes(search.toLowerCase());
    return Object.fromEntries(Object.entries(base).map(([k, arr]) => [k, arr.filter(filtro)]));
  }, [usuarios, search]);

  const RoleColumn = ({ tipo, items }) => (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">{ROLE_LABEL[tipo]}</h3>
        <span className="text-xs text-gray-500">{items.length} usuários</span>
      </div>
      <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
        {items.map((u) => (
          <Card key={u.id} className="border-gray-200">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900 truncate">{u.nome}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removerUsuario(u.id)}
                  className="text-red-600 hover:bg-red-50"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-xs text-gray-600 truncate">{u.email}</div>
              <div className="text-xs text-gray-600">{u.telefone}</div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500">Papel</Label>
                <Select
                  value={u.role || "vendedor"}
                  onValueChange={(v) => atualizarUsuario(u.id, { role: v })}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Usuario.roles.map(r => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-6">Sem usuários</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full w-full p-4 sm:p-6 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin • Usuários</h1>
          <p className="text-gray-600">Gerencie usuários, papéis e permissões.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-64">
            <Label className="text-xs text-gray-500">Buscar</Label>
            <Input
              placeholder="Nome, e-mail ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Novo usuário */}
      <Card className="border-gray-200">
        <CardContent className="p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={novo.nome} onChange={(e) => setNovo(prev => ({ ...prev, nome: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={novo.email} onChange={(e) => setNovo(prev => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={novo.telefone} onChange={(e) => setNovo(prev => ({ ...prev, telefone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={novo.role} onValueChange={(v) => setNovo(prev => ({ ...prev, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Usuario.roles.map(r => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={salvarNovo} disabled={loading} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Salvar Papel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colunas por papel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <RoleColumn tipo="admin" items={agrupados.admin} />
        <RoleColumn tipo="gestor" items={agrupados.gestor} />
        <RoleColumn tipo="vendedor" items={agrupados.vendedor} />
        <RoleColumn tipo="instalador" items={agrupados.instalador} />
      </div>
    </div>
  );
}


