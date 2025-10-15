import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes.jsx';
import Projetos from './pages/Projetos.jsx';
import NovoProjeto from './pages/NovoProjeto.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import PropostaView from './pages/PropostaView.jsx';
import './index.css';

function App() {
  return (
    <Router>
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

export default App;
