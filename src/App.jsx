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
import './index.css';

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
        <Route path="/clientes" element={<Layout><Clientes /></Layout>} />
        <Route path="/projetos" element={<Layout><Projetos /></Layout>} />
        <Route path="/projetos/novo" element={<Layout><NovoProjeto /></Layout>} />
        <Route path="/configuracoes" element={<Layout><Configuracoes /></Layout>} />
        
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