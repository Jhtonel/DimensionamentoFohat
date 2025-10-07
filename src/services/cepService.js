/**
 * Serviço para busca de CEP usando API ViaCEP
 * Documentação: https://viacep.com.br/
 */

class CepService {
  constructor() {
    this.baseURL = 'https://viacep.com.br/ws';
  }

  /**
   * Busca informações de CEP
   * @param {string} cep - CEP no formato 00000-000 ou 00000000
   * @returns {Promise<Object>} Dados do endereço
   */
  async buscarCEP(cep) {
    try {
      // Remove caracteres não numéricos
      const cepLimpo = cep.replace(/\D/g, '');
      
      // Valida formato do CEP
      if (cepLimpo.length !== 8) {
        throw new Error('CEP deve ter 8 dígitos');
      }

      const url = `${this.baseURL}/${cepLimpo}/json/`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();

      // Verifica se o CEP foi encontrado
      if (data.erro) {
        throw new Error('CEP não encontrado');
      }

      return {
        cep: data.cep,
        logradouro: data.logradouro,
        complemento: data.complemento,
        bairro: data.bairro,
        localidade: data.localidade,
        uf: data.uf,
        ibge: data.ibge,
        gia: data.gia,
        ddd: data.ddd,
        siafi: data.siafi
      };
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      throw error;
    }
  }

  /**
   * Formata CEP para exibição
   * @param {string} cep - CEP no formato 00000000
   * @returns {string} CEP formatado 00000-000
   */
  formatarCEP(cep) {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      return cepLimpo.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return cep;
  }

  /**
   * Valida formato do CEP
   * @param {string} cep - CEP a ser validado
   * @returns {boolean} True se válido
   */
  validarCEP(cep) {
    const cepLimpo = cep.replace(/\D/g, '');
    return cepLimpo.length === 8 && /^\d{8}$/.test(cepLimpo);
  }

  /**
   * Monta endereço completo
   * @param {Object} dadosCEP - Dados retornados pela API
   * @returns {string} Endereço completo formatado
   */
  montarEnderecoCompleto(dadosCEP) {
    const partes = [];
    
    if (dadosCEP.logradouro) partes.push(dadosCEP.logradouro);
    if (dadosCEP.bairro) partes.push(dadosCEP.bairro);
    if (dadosCEP.localidade) partes.push(dadosCEP.localidade);
    if (dadosCEP.uf) partes.push(dadosCEP.uf);
    if (dadosCEP.cep) partes.push(dadosCEP.cep);
    
    return partes.join(', ');
  }
}

// Instância singleton do serviço
const cepService = new CepService();

export default cepService;
