/**
 * Serviço para busca de CEP usando proxy no servidor Python
 * (Evita problemas de CORS e rede ao chamar ViaCEP diretamente)
 */

import { getBackendUrl } from "./backendUrl.js";

class CepService {
  constructor() {
    // Usa o proxy do servidor Python
    this.baseURL = `${getBackendUrl()}/cep`;
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

      const url = `${this.baseURL}/${cepLimpo}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      const data = await response.json();

      // Verifica se houve erro
      if (!response.ok || data.erro) {
        throw new Error(data.message || 'CEP não encontrado');
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
    // Formato pensado para aparecer bem na proposta (linha única, sem poluição):
    // "Rua X - Bairro Y, Cidade/UF"
    // (CEP fica no campo CEP, não no endereço completo)
    const logradouro = String(dadosCEP?.logradouro || "").trim();
    const bairro = String(dadosCEP?.bairro || "").trim();
    const cidade = String(dadosCEP?.localidade || "").trim();
    const uf = String(dadosCEP?.uf || "").trim();

    let out = "";
    if (logradouro) out += logradouro;
    if (bairro) out += (out ? " - " : "") + bairro;
    if (cidade) out += (out ? ", " : "") + cidade;
    if (uf) out += (cidade ? `/${uf}` : (out ? ` - ${uf}` : uf));
    return out.trim();
  }
}

// Instância singleton do serviço
const cepService = new CepService();

export default cepService;
