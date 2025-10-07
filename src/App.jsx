import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes.jsx';
import Projetos from './pages/Projetos.jsx';
import NovoProjeto from './pages/NovoProjeto.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import './index.css';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/projetos" element={<Projetos />} />
          <Route path="/projetos/novo" element={<NovoProjeto />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
