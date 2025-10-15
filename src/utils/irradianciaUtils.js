/**
 * Utilitários para trabalhar com dados de irradiância solar
 * Baseado no arquivo irradiancia.csv com dados de cidades brasileiras
 */

// Cache para os dados de irradiância
let irradianciaData = null;

/**
 * Carrega os dados de irradiância do CSV
 * @returns {Promise<Array>} Array de objetos com dados de irradiância
 */
export async function loadIrradianciaData() {
  if (irradianciaData) {
    console.log('📊 Usando dados de irradiância do cache');
    return irradianciaData;
  }

  try {
    console.log('📊 Carregando dados de irradiância do CSV...');
    const response = await fetch('/src/data/irradiancia.csv');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    console.log('📊 CSV carregado com sucesso, tamanho:', csvText.length, 'caracteres');
    
    const lines = csvText.split('\n');
    const headers = lines[0].split(';');
    
    irradianciaData = lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(';');
        return {
          id: parseInt(values[0]),
          longitude: parseFloat(values[1]),
          latitude: parseFloat(values[2]),
          name: values[3],
          class: values[4],
          state: values[5],
          annual: parseFloat(values[6]),
          monthly: {
            jan: parseFloat(values[7]),
            feb: parseFloat(values[8]),
            mar: parseFloat(values[9]),
            apr: parseFloat(values[10]),
            may: parseFloat(values[11]),
            jun: parseFloat(values[12]),
            jul: parseFloat(values[13]),
            aug: parseFloat(values[14]),
            sep: parseFloat(values[15]),
            oct: parseFloat(values[16]),
            nov: parseFloat(values[17]),
            dec: parseFloat(values[18])
          }
        };
      });
    
    return irradianciaData;
  } catch (error) {
    console.error('Erro ao carregar dados de irradiância:', error);
    return [];
  }
}

/**
 * Busca dados de irradiância por nome da cidade
 * @param {string} cityName - Nome da cidade
 * @returns {Promise<Object|null>} Dados de irradiância da cidade ou null se não encontrada
 */
export async function getIrradianciaByCity(cityName) {
  console.log('🔍 Buscando irradiância para cidade:', cityName);
  const data = await loadIrradianciaData();
  
  if (!data || data.length === 0) {
    console.log('❌ Nenhum dado de irradiância carregado');
    return null;
  }
  
  console.log('📊 Total de cidades carregadas:', data.length);
  
  // Busca exata primeiro
  let city = data.find(item => 
    item.name.toLowerCase() === cityName.toLowerCase()
  );
  
  if (city) {
    console.log('✅ Cidade encontrada (busca exata):', city.name, 'Irradiância:', city.annual);
    return city;
  }
  
  // Se não encontrar, busca parcial
  city = data.find(item => 
    item.name.toLowerCase().includes(cityName.toLowerCase())
  );
  
  if (city) {
    console.log('✅ Cidade encontrada (busca parcial):', city.name, 'Irradiância:', city.annual);
    return city;
  }
  
  // Fallback: usar São José dos Campos como padrão
  console.log('⚠️ Cidade não encontrada, usando São José dos Campos como fallback');
  const fallbackCity = data.find(item => 
    item.name.toLowerCase().includes('são josé dos campos')
  );
  
  if (fallbackCity) {
    console.log('✅ Fallback encontrado:', fallbackCity.name, 'Irradiância:', fallbackCity.annual);
    return fallbackCity;
  }
  
  console.log('❌ Nenhuma cidade encontrada, nem fallback');
  return null;
}

/**
 * Busca dados de irradiância por estado
 * @param {string} state - Sigla do estado
 * @returns {Promise<Array>} Array com todas as cidades do estado
 */
export async function getIrradianciaByState(state) {
  const data = await loadIrradianciaData();
  
  return data.filter(item => 
    item.state.toLowerCase() === state.toLowerCase()
  );
}

/**
 * Calcula a potência da usina baseada na irradiância anual da cidade
 * @param {number} irradianciaAnual - Irradiância anual em kWh/m²/ano
 * @param {number} areaPainel - Área dos painéis em m²
 * @param {number} eficienciaPainel - Eficiência do painel (0-1, padrão 0.2)
 * @returns {number} Potência em kW
 */
export function calcularPotenciaUsina(irradianciaAnual, areaPainel, eficienciaPainel = 0.2) {
  // Potência = Irradiância × Área × Eficiência
  const potenciaAnual = irradianciaAnual * areaPainel * eficienciaPainel;
  
  // Converte para kW (dividindo por 1000)
  return potenciaAnual / 1000;
}

/**
 * Calcula a energia gerada mensalmente
 * @param {Object} irradianciaData - Dados de irradiância da cidade
 * @param {number} areaPainel - Área dos painéis em m²
 * @param {number} eficienciaPainel - Eficiência do painel (0-1, padrão 0.2)
 * @returns {Object} Energia gerada por mês em kWh
 */
export function calcularEnergiaMensal(irradianciaData, areaPainel, eficienciaPainel = 0.2) {
  if (!irradianciaData || !irradianciaData.monthly) {
    return null;
  }

  const energiaMensal = {};
  
  Object.keys(irradianciaData.monthly).forEach(mes => {
    const irradianciaMes = irradianciaData.monthly[mes];
    energiaMensal[mes] = (irradianciaMes * areaPainel * eficienciaPainel) / 1000;
  });
  
  return energiaMensal;
}

/**
 * Busca a cidade mais próxima baseada em coordenadas
 * @param {number} latitude - Latitude da localização
 * @param {number} longitude - Longitude da localização
 * @returns {Promise<Object|null>} Cidade mais próxima
 */
export async function getNearestCity(latitude, longitude) {
  const data = await loadIrradianciaData();
  
  let nearestCity = null;
  let minDistance = Infinity;
  
  data.forEach(city => {
    const distance = Math.sqrt(
      Math.pow(city.latitude - latitude, 2) + 
      Math.pow(city.longitude - longitude, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestCity = city;
    }
  });
  
  return nearestCity;
}

/**
 * Obtém estatísticas de irradiância por estado
 * @param {string} state - Sigla do estado
 * @returns {Promise<Object>} Estatísticas do estado
 */
export async function getStateIrradianciaStats(state) {
  const cities = await getIrradianciaByState(state);
  
  if (cities.length === 0) {
    return null;
  }
  
  const irradiancias = cities.map(city => city.annual);
  
  return {
    state,
    totalCities: cities.length,
    averageIrradiancia: irradiancias.reduce((a, b) => a + b, 0) / irradiancias.length,
    minIrradiancia: Math.min(...irradiancias),
    maxIrradiancia: Math.max(...irradiancias),
    cities: cities.map(city => ({
      name: city.name,
      irradiancia: city.annual
    }))
  };
}
