/**
 * Componente de Layout Principal com menu lateral recolhível
 */

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from "../../services/authService.jsx";
import { 
  Menu, 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  Settings, 
  LogOut,
  DollarSign,
  FileText
} from "lucide-react";

const Layout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  const [open, setOpen] = useState(true);
  const displayName = (user?.nome || user?.full_name || user?.email || 'Usuário');
  const getInitials = (value) => {
    try {
      const parts = String(value || '').trim().split(/\s+/);
      const initials = (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
      return initials.toUpperCase() || 'U';
    } catch {
      return 'U';
    }
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'gestor', 'vendedor', 'instalador'] },
    { to: '/pipeline', label: 'Pipeline', icon: FolderKanban, roles: ['admin', 'gestor', 'vendedor'] },
    { to: '/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'gestor', 'vendedor'] },
    { to: '/projetos', label: 'Propostas', icon: FileText, roles: ['admin', 'gestor', 'vendedor'] }
  ];
  const [adminOpen, setAdminOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="h-screen flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`bg-white border-r border-gray-200 h-screen sticky top-0 ${open ? 'w-64' : 'w-16'} transition-all duration-300 flex flex-col`}>
          <div className="flex items-center justify-between px-3 py-4 border-b">
            <div className={`flex items-center gap-2 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity`}>
              <span className="h-8 w-8 rounded-lg bg-sky-500 inline-block" />
              <span className="font-semibold text-gray-800">Solar CRM</span>
            </div>
            {open && (
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
                aria-label="Recolher menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
          <nav className="flex-1 py-3 overflow-y-auto">
            {navItems
              .filter(item => !item.roles || item.roles.includes(user?.role))
              .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 mx-2 my-1 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive ? 'bg-sky-100 text-sky-700' : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {open && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
            {(user?.role === 'admin') && (
            <div className="mt-3">
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className="w-full flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100"
              >
                <Settings className="w-4 h-4" />
                {open && <span className="flex-1 text-left">Admin</span>}
              </button>
              {adminOpen && (
                <div className={`pl-2 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity`}>
                  <NavLink
                    to="/configuracoes"
                    className={({ isActive }) =>
                      `flex items-center gap-3 mx-2 mt-1 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive ? 'bg-sky-100 text-sky-700' : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    <Settings className="w-4 h-4" />
                    {open && <span>Configurações</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/usuarios"
                    className={({ isActive }) =>
                      `flex items-center gap-3 mx-2 mt-1 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive ? 'bg-sky-100 text-sky-700' : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    <Users className="w-4 h-4" />
                    {open && <span>Usuários</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/taxas"
                    className={({ isActive }) =>
                      `flex items-center gap-3 mx-2 mt-1 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive ? 'bg-sky-100 text-sky-700' : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    <Settings className="w-4 h-4" />
                    {open && <span>Taxas</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/comissoes"
                    className={({ isActive }) =>
                      `flex items-center gap-3 mx-2 mt-1 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive ? 'bg-sky-100 text-sky-700' : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    <DollarSign className="w-4 h-4" />
                    {open && <span>Comissões</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/clientes"
                    className={({ isActive }) =>
                      `flex items-center gap-3 mx-2 mt-1 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive ? 'bg-sky-100 text-sky-700' : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    <Users className="w-4 h-4" />
                    {open && <span>Clientes</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/propostas"
                    className={({ isActive }) =>
                      `flex items-center gap-3 mx-2 mt-1 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive ? 'bg-sky-100 text-sky-700' : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    <FileText className="w-4 h-4" />
                    {open && <span>Propostas</span>}
                  </NavLink>
                </div>
              )}
            </div>
            )}
          </nav>
          <div className="p-3 border-t">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              {open && <span>Sair</span>}
            </button>
          </div>
        </aside>

        {/* Conteúdo */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header superior simples */}
          <header className="bg-white shadow">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center gap-2">
                  {!open && (
                    <button
                      onClick={() => setOpen(true)}
                      className="p-2 rounded-md hover:bg-gray-100 text-gray-600 mr-1"
                      aria-label="Abrir menu"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                  )}
                  <h1 className="text-xl font-bold text-gray-900">
                    Sistema de Propostas Solares
                  </h1>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center gap-2 max-w-full">
                    <div className="h-8 w-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {getInitials(displayName)}
                    </div>
                    <div className="text-sm text-gray-700 truncate">
                      <span className="font-medium truncate max-w-[40vw] inline-block align-middle">{displayName}</span>
                      <span className="ml-2 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 align-middle">
                        {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                      </span>
                    </div>
                  </div>
                </div>
          </div>
        </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto min-h-0">
        {children}
      </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
