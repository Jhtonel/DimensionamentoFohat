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
