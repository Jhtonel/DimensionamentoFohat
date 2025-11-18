import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './services/authService.jsx';
import Login from './components/auth/Login';
import Layout from './components/layout/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes.jsx';
import Projetos from './pages/Projetos.jsx';
import NovoProjeto from './pages/NovoProjeto.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import PropostaView from './pages/PropostaView.jsx';
import AdminUsuarios from './pages/admin/Usuarios.jsx';
import AdminTaxas from './pages/admin/Taxas.jsx';
import AdminComissoes from './pages/admin/Comissoes.jsx';
import Pipeline from './pages/Pipeline.jsx';
import './index.css';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import ChangePassword from './pages/auth/ChangePassword.jsx';

function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-gray-500">
        Verificando acesso...
      </div>
    );
  }
  if (!roles || roles.includes(user?.role)) {
    return children;
  }
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-gray-800">Acesso negado</h2>
        <p className="text-gray-600">Você não possui permissão para acessar esta página.</p>
      </div>
    </div>
  );
}

// Componente principal com autenticação
function AppWithAuth() {
  const { user, loading } = useAuth();

  // Se ainda está carregando a autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não está logado, mostrar tela de login
  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  // Se está logado, mostrar aplicação normal
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Rotas com Layout do CRM */}
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/pipeline" element={<Layout><RequireRole roles={['admin','gestor','vendedor']}><Pipeline /></RequireRole></Layout>} />
        <Route path="/clientes" element={<Layout><RequireRole roles={['admin','gestor','vendedor']}><Clientes /></RequireRole></Layout>} />
        <Route path="/projetos" element={<Layout><RequireRole roles={['admin','gestor','vendedor']}><Projetos /></RequireRole></Layout>} />
        <Route path="/projetos/novo" element={<Layout><RequireRole roles={['admin','gestor','vendedor']}><NovoProjeto /></RequireRole></Layout>} />
        <Route path="/configuracoes" element={<Layout><RequireRole roles={['admin']}><Configuracoes /></RequireRole></Layout>} />
        {/* Senhas */}
        <Route path="/recuperar-senha" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/alterar-senha" element={<Layout><ChangePassword /></Layout>} />
        {/* Rotas admin */}
        <Route path="/admin/usuarios" element={<Layout><RequireRole roles={['admin']}><AdminUsuarios /></RequireRole></Layout>} />
        <Route path="/admin/taxas" element={<Layout><RequireRole roles={['admin']}><AdminTaxas /></RequireRole></Layout>} />
        <Route path="/admin/comissoes" element={<Layout><RequireRole roles={['admin']}><AdminComissoes /></RequireRole></Layout>} />
        <Route path="/admin/clientes" element={<Layout><RequireRole roles={['admin']}><Clientes /></RequireRole></Layout>} />
        <Route path="/admin/propostas" element={<Layout><RequireRole roles={['admin']}><Projetos /></RequireRole></Layout>} />
        
        {/* Rota independente para proposta (sem Layout) */}
        <Route path="/proposta/:propostaId" element={<PropostaView />} />
      </Routes>
    </Router>
  );
}

function App() {
  return <AppWithAuth />;
}

export default App;