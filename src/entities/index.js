// Simulação de dados em memória para desenvolvimento
import { supabase } from '../services/supabaseClient.js';
let clientesData = [
  {
    id: '1',
    nome: 'João Silva',
    telefone: '(11) 99999-9999',
    email: 'joao@email.com',
    endereco_completo: 'Rua das Flores, 123',
    cep: '01234-567',
    tipo: 'residencial',
    observacoes: 'Cliente interessado em sistema residencial',
    created_date: new Date().toISOString()
  }
];

let projetosData = [
  {
    id: '1',
    cliente_id: '1',
    nome_projeto: 'Casa João Silva',
    cep: '01234-567',
    cidade: 'São Paulo',
    estado: 'SP',
    tipo_telhado: 'ceramico',
    concessionaria: 'Enel',
    consumo_mensal_kwh: 300,
    consumo_mensal_reais: 180,
    status: 'dimensionamento',
    preco_final: 25000,
    created_date: new Date().toISOString()
  }
];

let configuracoesData = [
  {
    id: '1',
    chave: 'tarifa_enel',
    tipo: 'tarifa',
    concessionaria: 'Enel SP',
    tarifa_kwh: 0.83,
    created_date: new Date().toISOString()
  },
  {
    id: '2',
    chave: 'potencia_placa',
    tipo: 'equipamento',
    potencia_placa_padrao_w: 600,
    eficiencia_sistema: 0.80,
    created_date: new Date().toISOString()
  },
  {
    id: '3',
    chave: 'tarifa_cpfl_piratininga',
    tipo: 'tarifa',
    concessionaria: 'CPFL Piratininga',
    tarifa_kwh: 0.81,
    created_date: new Date().toISOString()
  },
  {
    id: '4',
    chave: 'tarifa_cpfl_paulista',
    tipo: 'tarifa',
    concessionaria: 'CPFL Paulista',
    tarifa_kwh: 0.80,
    created_date: new Date().toISOString()
  },
  {
    id: '5',
    chave: 'tarifa_cpfl_santa_cruz',
    tipo: 'tarifa',
    concessionaria: 'CPFL Santa Cruz',
    tarifa_kwh: 0.79,
    created_date: new Date().toISOString()
  },
  {
    id: '6',
    chave: 'tarifa_edp',
    tipo: 'tarifa',
    concessionaria: 'EDP SP',
    tarifa_kwh: 0.82,
    created_date: new Date().toISOString()
  },
  {
    id: '7',
    chave: 'tarifa_neoenergia_elektro',
    tipo: 'tarifa',
    concessionaria: 'Neoenergia Elektro',
    tarifa_kwh: 0.79,
    created_date: new Date().toISOString()
  },
  {
    id: '8',
    chave: 'tarifa_energia_sul',
    tipo: 'tarifa',
    concessionaria: 'Energia Sul',
    tarifa_kwh: 0.80,
    created_date: new Date().toISOString()
  }
];

// Dados de irradiação solar - integração com CSV real
let irradiacaoData = [
  {
    id: '1',
    cidade: 'São Paulo',
    estado: 'SP',
    irradiacao_anual: 4.5,
    irradiacao_janeiro: 5.2,
    irradiacao_fevereiro: 4.8,
    irradiacao_marco: 4.5,
    irradiacao_abril: 4.0,
    irradiacao_maio: 3.5,
    irradiacao_junho: 3.2,
    irradiacao_julho: 3.8,
    irradiacao_agosto: 4.2,
    irradiacao_setembro: 4.5,
    irradiacao_outubro: 4.8,
    irradiacao_novembro: 5.0,
    irradiacao_dezembro: 5.1,
    created_date: new Date().toISOString()
  }
];

let userData = {
  id: '1',
  full_name: 'Administrador',
  email: 'admin@solarcrm.com'
};

// Usuários do sistema (admin, vendedor, instalador, gestor)
let usuariosData = [
  {
    id: 'u_admin',
    nome: 'Administrador',
    email: 'admin@solarcrm.com',
    telefone: '(00) 00000-0000',
    role: 'admin',
    created_date: new Date().toISOString()
  },
  {
    id: 'u_vendedor_1',
    nome: 'Vendedor Padrão',
    email: 'vendas@solarcrm.com',
    telefone: '(11) 98888-8888',
    role: 'vendedor',
    created_date: new Date().toISOString()
  }
];

// Classe base para entidades
class BaseEntity {
  static async list(orderBy = '') {
    // Simula delay de API
    await new Promise(resolve => setTimeout(resolve, 300));
    return this.data;
  }

  static async create(data) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newItem = {
      id: Date.now().toString(),
      ...data,
      created_date: new Date().toISOString()
    };
    this.data.push(newItem);
    return newItem;
  }

  static async update(id, data) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = this.data.findIndex(item => item.id === id);
    if (index !== -1) {
      this.data[index] = { ...this.data[index], ...data };
      return this.data[index];
    }
    throw new Error('Item não encontrado');
  }

  static async delete(id) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = this.data.findIndex(item => item.id === id);
    if (index !== -1) {
      return this.data.splice(index, 1)[0];
    }
    throw new Error('Item não encontrado');
  }
}

class Cliente extends BaseEntity {
  static data = clientesData;

  static async list(orderBy = '-created_at') {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      // Apenas para acionar RLS corretamente; não precisamos do uid explicitamente aqui
      const col = String(orderBy || '').replace('-', '') || 'created_at';
      const orderCol = col === 'created_date' ? 'created_at' : col;
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order(orderCol, { ascending: !String(orderBy || '').startsWith('-') });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return super.list(orderBy);
    }
  }

  static async create(data) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id || null;
      const payload = {
        nome: data?.nome ?? '',
        telefone: data?.telefone ?? '',
        email: data?.email ?? null,
        created_by: uid || null
      };
      const { data: inserted, error } = await supabase
        .from('clientes')
        .insert([payload])
        .select('*')
        .single();
      if (error) throw error;
      return inserted;
    } catch (_) {
      return super.create(data);
    }
  }

  static async update(id, data) {
    try {
      const updates = {
        nome: data?.nome,
        telefone: data?.telefone,
        email: data?.email,
        updated_at: new Date().toISOString()
      };
      const { data: updated, error } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return updated;
    } catch (_) {
      return super.update(id, data);
    }
  }

  static async delete(id) {
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
      return { id };
    } catch (_) {
      return super.delete(id);
    }
  }
}

class Projeto extends BaseEntity {
  static data = projetosData;

  static getServerUrl() {
    try {
      const { systemConfig } = require('../config/firebase.js');
      if (import.meta && import.meta.env && import.meta.env.VITE_PROPOSAL_SERVER_URL) {
        return import.meta.env.VITE_PROPOSAL_SERVER_URL;
      }
      if (systemConfig?.apiUrl) return systemConfig.apiUrl;
    } catch (_) {}
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const port = '8000';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return `http://localhost:${port}`;
    return `http://${hostname}:${port}`;
  }

  static async list(orderBy = '-created_at') {
    try {
      // Política: se o backend Python responder, ele é a verdade (mesmo se vier vazio).
      // Caso o backend falhe, caímos para Supabase → localStorage → memória.
      const fetchBackend = async () => {
        try {
          const url = `${this.getServerUrl()}/projetos/list?t=${Date.now()}`;
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const arr = await resp.json();
          // Atualizar cache local para manter sincronizado com o backend
          localStorage.setItem('projetos_local', JSON.stringify(Array.isArray(arr) ? arr : []));
          return Array.isArray(arr) ? arr : [];
        } catch (_) {
          return null;
        }
      };
      const backend = await fetchBackend();
      if (backend !== null) return backend;

      // Fallback: Supabase
      try {
        const col = String(orderBy || '').replace('-', '') || 'created_at';
        const orderCol = col === 'created_date' ? 'created_at' : col;
        const { data, error } = await supabase
          .from('projetos')
          .select('*')
          .order(orderCol, { ascending: !String(orderBy || '').startsWith('-') });
        if (!error && Array.isArray(data)) {
          localStorage.setItem('projetos_local', JSON.stringify(data));
          return data;
        }
      } catch (_) {}

      // Fallback: cache local
      const stored = JSON.parse(localStorage.getItem('projetos_local') || '[]');
      if (stored.length > 0) return stored;
      return super.list(orderBy);
    } catch (_) {
      // Fallback: localStorage -> memória
      const stored = JSON.parse(localStorage.getItem('projetos_local') || '[]');
      if (stored.length > 0) return stored;
      return super.list(orderBy);
    }
  }

  static async create(data) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id || null;
      const payload = {
        cliente_id: data?.cliente_id || null,
        nome: data?.nome || data?.nome_projeto || null,
        descricao: data?.descricao || null,
        status: data?.status || 'rascunho',
        proposta_id: data?.proposta_id || null,
        payload: data || null,
        created_by: uid || null
      };
      const { data: inserted, error } = await supabase
        .from('projetos')
        .insert([payload])
        .select('*')
        .single();
      if (error) throw error;
      // espelhar no localStorage para uso offline
      const stored = JSON.parse(localStorage.getItem('projetos_local') || '[]');
      localStorage.setItem('projetos_local', JSON.stringify([inserted, ...stored]));
      return inserted;
    } catch (_) {
      const created = await super.create(data);
      const stored = JSON.parse(localStorage.getItem('projetos_local') || '[]');
      localStorage.setItem('projetos_local', JSON.stringify([created, ...stored]));
      return created;
    }
  }

  static async update(id, data) {
    try {
      const updates = {
        nome: data?.nome || data?.nome_projeto,
        descricao: data?.descricao,
        status: data?.status,
        cliente_id: data?.cliente_id,
        proposta_id: data?.proposta_id,
        payload: data || null,
        updated_at: new Date().toISOString()
      };
      const { data: updated, error } = await supabase
        .from('projetos')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      // espelhar no localStorage
      const stored = JSON.parse(localStorage.getItem('projetos_local') || '[]');
      const idx = stored.findIndex(p => p.id === id);
      if (idx !== -1) {
        stored[idx] = { ...stored[idx], ...updates, id };
      } else {
        stored.unshift({ id, ...updates });
      }
      localStorage.setItem('projetos_local', JSON.stringify(stored));
      return updated;
    } catch (_) {
      const updated = await super.update(id, data);
      const stored = JSON.parse(localStorage.getItem('projetos_local') || '[]');
      const idx = stored.findIndex(p => p.id === id);
      if (idx !== -1) {
        stored[idx] = { ...stored[idx], ...updated };
      } else {
        stored.unshift(updated);
      }
      localStorage.setItem('projetos_local', JSON.stringify(stored));
      return updated;
    }
  }

  static async delete(id) {
    try {
      // Tentar remover no backend Python (arquivos em /propostas)
      try {
        const url = `${this.getServerUrl()}/projetos/delete/${id}`;
        await fetch(url, { method: 'DELETE' });
      } catch (_) {}
      // Tentar remover no Supabase (se existir)
      try {
        const { error } = await supabase.from('projetos').delete().eq('id', id);
        if (error) {
          // apenas loga; seguimos com remoção local
          console.warn('Supabase delete falhou (seguindo com remoção local):', error?.message || error);
        }
      } catch (e) {
        console.warn('Supabase indisponível para delete:', e?.message || e);
      }
      // Remover do localStorage
      const stored = JSON.parse(localStorage.getItem('projetos_local') || '[]');
      localStorage.setItem('projetos_local', JSON.stringify(stored.filter(p => p.id !== id)));
      // Remover da memória
      const index = this.data.findIndex(item => item.id === id);
      if (index !== -1) this.data.splice(index, 1);
      return { id, success: true };
    } catch (_) {
      const deleted = await super.delete(id);
      const stored = JSON.parse(localStorage.getItem('projetos_local') || '[]');
      localStorage.setItem('projetos_local', JSON.stringify(stored.filter(p => p.id !== id)));
      return deleted;
    }
  }
}

class Configuracao extends BaseEntity {
  static data = configuracoesData;

  // Método para buscar tarifa por concessionária
  static async getTarifaByConcessionaria(concessionaria) {
    try {
      const { obterConcessionaria } = await import('../utils/tarifasUtils');
      const concessionariaData = obterConcessionaria(concessionaria);
      
      if (!concessionariaData) {
        throw new Error(`Concessionária "${concessionaria}" não encontrada`);
      }

      return concessionariaData.tarifas.residencial.totalComImpostos;
    } catch (error) {
      console.error('Erro ao buscar tarifa:', error);
      throw error;
    }
  }

  // Método para calcular consumo baseado no valor em reais
  static async calcularConsumoPorValor(valorReais, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
    try {
      const { calcularConsumoPorValor } = await import('../utils/tarifasUtils');
      return await calcularConsumoPorValor(valorReais, concessionaria, tipoConsumo, bandeira);
    } catch (error) {
      console.error('Erro ao calcular consumo por valor:', error);
      throw error;
    }
  }

  // Método para calcular valor baseado no consumo
  static async calcularValorPorConsumo(consumoKwh, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
    try {
      const { calcularValorPorConsumo } = await import('../utils/tarifasUtils');
      return await calcularValorPorConsumo(consumoKwh, concessionaria, tipoConsumo, bandeira);
    } catch (error) {
      console.error('Erro ao calcular valor por consumo:', error);
      throw error;
    }
  }
}

class IrradiacaoSolar extends BaseEntity {
  static data = irradiacaoData;

  // Método para buscar irradiação por cidade usando dados reais do CSV
  static async getByCity(cityName) {
    try {
      const { getIrradianciaByCity } = await import('../utils/irradianciaUtils');
      return await getIrradianciaByCity(cityName);
    } catch (error) {
      console.error('Erro ao buscar irradiação por cidade:', error);
      return null;
    }
  }

  // Método para calcular potência da usina
  static async calculatePower(cityName, areaPainel, eficienciaPainel = 0.2) {
    try {
      const { getIrradianciaByCity, calcularPotenciaUsina } = await import('../utils/irradianciaUtils');
      const irradianciaData = await getIrradianciaByCity(cityName);
      
      if (!irradianciaData) {
        throw new Error(`Cidade "${cityName}" não encontrada`);
      }

      return calcularPotenciaUsina(irradianciaData.annual, areaPainel, eficienciaPainel);
    } catch (error) {
      console.error('Erro ao calcular potência:', error);
      throw error;
    }
  }

  // Método para calcular energia mensal
  static async calculateMonthlyEnergy(cityName, areaPainel, eficienciaPainel = 0.2) {
    try {
      const { getIrradianciaByCity, calcularEnergiaMensal } = await import('../utils/irradianciaUtils');
      const irradianciaData = await getIrradianciaByCity(cityName);
      
      if (!irradianciaData) {
        throw new Error(`Cidade "${cityName}" não encontrada`);
      }

      return calcularEnergiaMensal(irradianciaData, areaPainel, eficienciaPainel);
    } catch (error) {
      console.error('Erro ao calcular energia mensal:', error);
      throw error;
    }
  }
}

export { Cliente, Projeto, Configuracao, IrradiacaoSolar };

export class User {
  static async me() {
    await new Promise(resolve => setTimeout(resolve, 300));
    return userData;
  }

  static async logout() {
    await new Promise(resolve => setTimeout(resolve, 300));
    // Simula logout
    return true;
  }
}

// ==========================================
// Usuários (Admin)
// ==========================================
export class Usuario extends BaseEntity {
  static data = usuariosData;
  static roles = ['admin', 'gestor', 'vendedor', 'instalador'];

  static getServerUrl() {
    // Mantemos a mesma heurística do Projeto
    try {
      const { systemConfig } = require('../config/firebase.js');
      if (import.meta && import.meta.env && import.meta.env.VITE_PROPOSAL_SERVER_URL) {
        return import.meta.env.VITE_PROPOSAL_SERVER_URL;
      }
      if (systemConfig?.apiUrl) return systemConfig.apiUrl;
    } catch (_) {}
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const port = '8000';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return `http://localhost:${port}`;
    return `http://${hostname}:${port}`;
  }

  static async list(orderBy = '-created_at') {
    // 1) Tentar Supabase
    try {
      const col = String(orderBy || '').replace('-', '') || 'created_at';
      const orderCol = col === 'created_date' ? 'created_at' : col;
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order(orderCol, { ascending: !String(orderBy || '').startsWith('-') });
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem('usuarios_local', JSON.stringify(data));
        return data;
      }
    } catch (_) {}
    // 2) Cache local
    const stored = JSON.parse(localStorage.getItem('usuarios_local') || '[]');
    if (stored.length > 0) return stored;
    // 3) Memória
    return super.list(orderBy);
  }

  static async create(data) {
    const payload = {
      nome: data?.nome ?? '',
      email: data?.email ?? '',
      telefone: data?.telefone ?? '',
      role: Usuario.roles.includes(data?.role) ? data.role : 'vendedor',
      firebase_uid: data?.firebase_uid || null
    };
    // Supabase
    try {
      const { data: inserted, error } = await supabase
        .from('usuarios')
        .insert([payload])
        .select('*')
        .single();
      if (error) throw error;
      const stored = JSON.parse(localStorage.getItem('usuarios_local') || '[]');
      localStorage.setItem('usuarios_local', JSON.stringify([inserted, ...stored]));
      return inserted;
    } catch (_) {
      const created = await super.create(payload);
      const stored = JSON.parse(localStorage.getItem('usuarios_local') || '[]');
      localStorage.setItem('usuarios_local', JSON.stringify([created, ...stored]));
      return created;
    }
  }

  static async update(id, data) {
    // Monta objeto de updates somente com chaves definidas
    const candidate = {
      nome: data?.nome,
      email: data?.email,
      telefone: data?.telefone,
      role: Usuario.roles.includes(data?.role) ? data.role : undefined,
      updated_at: new Date().toISOString()
    };
    const updates = {};
    Object.keys(candidate).forEach((k) => {
      if (typeof candidate[k] !== 'undefined') updates[k] = candidate[k];
    });
    // Supabase
    try {
      const { data: updated, error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      // espelhar no local
      const stored = JSON.parse(localStorage.getItem('usuarios_local') || '[]');
      const idx = stored.findIndex(u => u.id === id);
      if (idx !== -1) stored[idx] = { ...stored[idx], ...updates, id };
      else stored.unshift({ id, ...updates });
      localStorage.setItem('usuarios_local', JSON.stringify(stored));
      return updated;
    } catch (_) {
      const updated = await super.update(id, updates);
      const stored = JSON.parse(localStorage.getItem('usuarios_local') || '[]');
      const idx = stored.findIndex(u => u.id === id);
      if (idx !== -1) stored[idx] = { ...stored[idx], ...updated };
      else stored.unshift(updated);
      localStorage.setItem('usuarios_local', JSON.stringify(stored));
      return updated;
    }
  }

  static async delete(id) {
    try {
      // Remover somente o mapeamento interno (não remove do Firebase)
      try {
        const { error } = await supabase.from('usuarios').delete().eq('id', id);
        if (error) throw error;
      } catch (_) {}
      const stored = JSON.parse(localStorage.getItem('usuarios_local') || '[]');
      localStorage.setItem('usuarios_local', JSON.stringify(stored.filter(u => u.id !== id)));
      return { id };
    } catch (_) {
      const deleted = await super.delete(id);
      const stored = JSON.parse(localStorage.getItem('usuarios_local') || '[]');
      localStorage.setItem('usuarios_local', JSON.stringify(stored.filter(u => u.id !== id)));
      return deleted;
    }
  }
}
