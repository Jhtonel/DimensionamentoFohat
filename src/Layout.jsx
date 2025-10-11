import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  Settings,
  Sun,
  LogOut
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { User } from "@/entities";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "Clientes",
    url: createPageUrl("Clientes"),
    icon: Users,
  },
  {
    title: "Projetos",
    url: createPageUrl("Projetos"),
    icon: FolderKanban,
  },
  {
    title: "Configurações",
    url: createPageUrl("Configuracoes"),
    icon: Settings,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {
      console.error("Erro ao carregar usuário", error);
    }
  };

  const handleLogout = async () => {
    await User.logout();
  };

  return (
    <SidebarProvider>
      <LayoutContent 
        children={children} 
        location={location} 
        user={user} 
        handleLogout={handleLogout} 
      />
    </SidebarProvider>
  );
}

function LayoutContent({ children, location, user, handleLogout }) {
  const { collapsed } = useSidebar();

  return (
    <>
      <style>{`
        :root {
          --solar-blue: #0EA5E9;
          --solar-light: #38BDF8;
          --solar-orange: #F97316;
          --glass-bg: rgba(255, 255, 255, 0.7);
          --glass-border: rgba(255, 255, 255, 0.3);
        }
        
        body {
          background: linear-gradient(135deg, #0EA5E9 0%, #38BDF8 50%, #F0F9FF 100%);
          min-height: 100vh;
        }
        
        .glass-card {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          box-shadow: 0 8px 32px rgba(14, 165, 233, 0.15);
        }
        
        .glass-sidebar {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(24px);
          border-right: 1px solid rgba(14, 165, 233, 0.1);
        }
      `}</style>
      
      <div className="min-h-screen flex w-full">
        <Sidebar className="glass-sidebar" collapsed={collapsed}>
          <SidebarHeader className="border-b border-sky-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg">
                <Sun className="w-7 h-7 text-white" />
              </div>
              {!collapsed && (
                <div>
                  <h2 className="font-bold text-xl text-gray-900">Fohat Energia</h2>
                  <p className="text-xs text-sky-600 font-medium">Energia Fotovoltaica</p>
                </div>
              )}
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">
                  Menu Principal
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-sky-50 hover:text-sky-700 transition-all duration-300 rounded-xl mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-gradient-to-r from-sky-50 to-orange-50 text-sky-700 shadow-sm' 
                            : ''
                        }`}
                        title={collapsed ? item.title : undefined}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          {!collapsed && <span className="font-medium">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sky-100 p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-600 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold text-sm">
                    {user?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {user?.full_name || 'Usuário'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                title={collapsed ? "Sair" : undefined}
              >
                <LogOut className="w-4 h-4" />
                {!collapsed && "Sair"}
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-xl border-b border-sky-100 px-6 py-4 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-sky-50 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-sky-600 to-orange-500 bg-clip-text text-transparent">
                Solar CRM
              </h1>
              <div className="ml-auto text-sm text-gray-500">
                Sidebar: {collapsed ? 'Recolhida' : 'Expandida'}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}