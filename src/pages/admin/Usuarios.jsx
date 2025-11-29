import React, { useEffect, useMemo, useState } from "react";
import { Usuario } from "@/entities";
import { systemConfig } from "@/config/firebase.js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

const ROLE_LABEL = {
  admin: "Admin",
  gestor: "Gestor",
  vendedor: "Vendedor",
  instalador: "Instalador"
};

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [onlyNoName, setOnlyNoName] = useState(false);
  const [editedNome, setEditedNome] = useState({});

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
      // 2) Buscar mapeamentos de role do backend
      let roleByEmail = {};
      try {
        const rolesResp = await fetch(`${serverUrl}/auth/roles?t=${Date.now()}`);
        if (rolesResp.ok) {
          const rolesJson = await rolesResp.json();
          const items = Array.isArray(rolesJson?.items) ? rolesJson.items : [];
          items.forEach((it) => {
            if (it?.email && it?.role) roleByEmail[it.email.toLowerCase()] = { role: it.role, nome: it?.nome };
          });
        }
      } catch (_) {}
      
      // 3) Mesclar: Firebase + role
      const merged = fbUsers.map(u => {
        // Se não tiver role definida no backend, assume 'vendedor'
        // Se já tiver role no backend, usa.
        // Se o email do usuário for o mesmo do admin logado (se pudéssemos saber), daria admin
        const info = roleByEmail[(u.email || '').toLowerCase()] || {};
        
        // Tentar normalizar o nome se vier vazio do Firebase
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
          role: info.role || 'vendedor', // Default role
          metadata: u.metadata
        };
      });
      
      setUsuarios(merged);
    } catch (e) {
      console.error('Falha ao listar usuários do Firebase:', e);
      setUsuarios([]);
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
        body: JSON.stringify({ email: target.email, role: data.role || target.role || 'vendedor', nome: data?.nome })
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const removerUsuario = async (id) => {
    const target = usuarios.find(u => u.id === id);
    if (!target) return;
    if (!confirm("Remover as permissões deste usuário?")) return;
    setLoading(true);
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const serverUrl = `http://${hostname}:8000`;
      // 1) Remover usuário no Firebase (se backend estiver com Admin habilitado)
      try {
        await fetch(`${serverUrl}/admin/firebase/delete-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: target.uid || id })
        });
      } catch (_) {}
      // 2) Remover papel no backend
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
    const filtroTexto = (u) =>
      String(u.nome || "").toLowerCase().includes(search.toLowerCase()) ||
      String(u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      String(u.telefone || "").toLowerCase().includes(search.toLowerCase());
    const filtroNome = (u) => (!onlyNoName ? true : !u.nome || u.nome.trim().length === 0 || u.nome === u.email);
    const filtrarArr = (arr) => arr.filter(u => filtroTexto(u) && filtroNome(u));
    let result = Object.fromEntries(Object.entries(base).map(([k, arr]) => [k, filtrarArr(arr)]));
    // filtro por role
    if (roleFilter && roleFilter !== 'todos') {
      result = Object.fromEntries(Object.entries(result).map(([k, arr]) => [k, k === roleFilter ? arr : []]));
    }
    return result;
  }, [usuarios, search, roleFilter, onlyNoName]);

  const RoleColumn = ({ tipo, items }) => (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col h-full max-h-[calc(100vh-180px)]">
      <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-gray-800">{ROLE_LABEL[tipo]}</h3>
        <span className="text-xs text-gray-500">{items.length} usuários</span>
      </div>
      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {items.map((u) => (
          <Card key={u.id} className="border-gray-200">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900 truncate w-1/2">
                  <Input
                    value={editedNome[u.id] ?? u.nome ?? ''}
                    onChange={(e) => setEditedNome(prev => ({ ...prev, [u.id]: e.target.value }))}
                    placeholder="Nome do usuário"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => atualizarUsuario(u.id, { nome: editedNome[u.id] ?? u.nome, role: u.role })}
                    className="text-sky-700 border-sky-200"
                  >
                    Salvar nome
                  </Button>
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
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-48">
            <Label className="text-xs text-gray-500">Filtrar por papel</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Usuario.roles.map(r => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="only-noname"
              type="checkbox"
              className="h-4 w-4"
              checked={onlyNoName}
              onChange={(e) => setOnlyNoName(e.target.checked)}
            />
            <Label htmlFor="only-noname" className="text-xs text-gray-600">Somente sem nome</Label>
          </div>
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


