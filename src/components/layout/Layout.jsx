import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from "../../services/authService.jsx";
import { 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  Settings, 
  LogOut,
  FileText,
  Menu,
  X,
  ChevronRight,
  Bell,
  Search,
  ChevronDown
} from "lucide-react";

/**
 * Componente de Layout Premium
 * - Sidebar responsiva e colapsável
 * - Header com glassmorphism
 * - Transições suaves
 */
const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(true);
  
  // Fechar menu mobile ao mudar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Responsividade automática da sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    
    // Set inicial
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

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

  const adminItems = [
    { to: '/configuracoes', label: 'Configurações', icon: Settings },
    { to: '/admin/usuarios', label: 'Usuários', icon: Users },
    { to: '/admin/taxas', label: 'Taxas', icon: Settings },
    { to: '/admin/calculos', label: 'Debug Cálculos', icon: FileText },
  ];

  const NavItem = ({ to, icon: Icon, label, collapsed }) => (
    <NavLink
      to={to}
      title={collapsed ? label : ''}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
        ${isActive 
          ? 'bg-primary text-white shadow-md shadow-primary/20' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }
        ${collapsed ? 'justify-center' : ''}
        `
      }
    >
      <Icon className={`w-5 h-5 ${collapsed ? '' : 'shrink-0'}`} />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
          {label}
        </div>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans">
      
      {/* Overlay Mobile */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

        {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-white border-r border-slate-200 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]
          transition-all duration-300 ease-in-out
          flex flex-col
          ${mobileMenuOpen ? 'translate-x-0 w-64' : 'lg:translate-x-0 -translate-x-full'}
          ${sidebarOpen ? 'lg:w-64' : 'lg:w-20'}
        `}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center px-4 border-b border-slate-100">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <img
                src="/img/logo-bg-blue.svg"
                alt="Fohat"
                className="w-6 h-6 object-contain"
              />
            </div>
            {(sidebarOpen || mobileMenuOpen) && (
              <span className="font-bold text-lg text-slate-800 tracking-tight">Fohat CRM</span>
            )}
          </div>
          {/* Close Mobile */}
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto lg:hidden p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1 scrollbar-thin">
            {navItems
              .filter(item => !item.roles || item.roles.includes(user?.role))
            .map((item) => (
              <NavItem 
                key={item.to} 
                {...item} 
                collapsed={!sidebarOpen && !mobileMenuOpen} 
              />
            ))}

          {user?.role === 'admin' && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              {(!sidebarOpen && !mobileMenuOpen) ? (
              <button
                 onClick={() => setSidebarOpen(true)}
                 className="w-full flex justify-center p-2 text-slate-400 hover:text-primary transition-colors"
              >
                 <Settings className="w-5 h-5" />
              </button>
              ) : (
                <>
                  <div 
                    className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-slate-600"
                    onClick={() => setAdminExpanded(!adminExpanded)}
                  >
                    <span>Administração</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${adminExpanded ? 'rotate-180' : ''}`} />
                  </div>
                  {adminExpanded && (
                    <div className="space-y-1">
                      {adminItems.map((item) => (
                        <NavItem 
                          key={item.to} 
                          {...item} 
                          collapsed={false} 
                        />
                      ))}
                </div>
                  )}
                </>
              )}
            </div>
            )}
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          {(!sidebarOpen && !mobileMenuOpen) ? (
            <div className="flex flex-col items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-sm ring-2 ring-white">
                  {getInitials(displayName)}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 group">
              <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-white">
                {getInitials(displayName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate capitalize">{user?.role || 'Usuário'}</p>
              </div>
            <button
              onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
            </div>
          )}
          </div>
        </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Header Glassmorphism */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6 transition-all">
          <div className="flex items-center gap-4">
                    <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
            
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Breadcrumb Simples (Pode ser expandido) */}
            <nav className="hidden sm:flex items-center text-sm text-slate-500">
              <span className="hover:text-slate-800 transition-colors cursor-pointer">Home</span>
              {location.pathname !== '/' && (
                <>
                  <ChevronRight className="w-4 h-4 mx-1 text-slate-400" />
                  <span className="font-medium text-slate-800 capitalize">
                    {location.pathname.split('/')[1] || 'Dashboard'}
                  </span>
                </>
              )}
            </nav>
                </div>

          <div className="flex items-center gap-3">
            {/* Search (Visual Only for now) */}
            <div className="hidden md:flex items-center relative group">
              <Search className="absolute left-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="pl-9 pr-4 py-1.5 w-48 focus:w-64 transition-all bg-slate-50 border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:bg-white"
              />
                    </div>

            <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
        </div>
          </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/50 p-4 lg:p-8 scrollbar-thin">
          <div className="max-w-7xl mx-auto w-full space-y-6">
        {children}
          </div>
      </main>
      </div>
    </div>
  );
};

export default Layout;
