// Simulação de dados em memória para desenvolvimento
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
    concessionaria: 'Enel',
    tarifa_kwh: 0.6,
    created_date: new Date().toISOString()
  },
  {
    id: '2',
    chave: 'potencia_placa',
    tipo: 'equipamento',
    potencia_placa_padrao_w: 600,
    eficiencia_sistema: 0.80,
    created_date: new Date().toISOString()
  }
];

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
}

class Projeto extends BaseEntity {
  static data = projetosData;
}

class Configuracao extends BaseEntity {
  static data = configuracoesData;
}

class IrradiacaoSolar extends BaseEntity {
  static data = irradiacaoData;
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
