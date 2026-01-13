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
    
    // Tenta múltiplos caminhos para compatibilidade dev/prod
    const paths = ['/irradiancia.csv', '/src/data/irradiancia.csv'];
    let csvText = null;
    
    for (const path of paths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          csvText = await response.text();
          if (csvText && csvText.length > 1000) { // CSV válido tem mais de 1KB
            console.log('📊 CSV carregado de:', path);
            break;
          }
        }
      } catch (e) {
        console.log('⚠️ Tentativa falhou para:', path);
      }
    }
    
    if (!csvText || csvText.length < 1000) {
      throw new Error('CSV não encontrado ou muito pequeno');
    }
    
    console.log('📊 CSV carregado com sucesso, tamanho:', csvText.length, 'caracteres');
    
    const lines = csvText.split('\n');
    const headers = lines[0].split(';');
    
    irradianciaData = lines.slice(1)
      .filter(line => line.trim() && line.split(';').length >= 7)
      .map(line => {
        const values = line.split(';');
        const name = (values[3] || '').trim();
        
        // Ignora linhas sem nome de cidade válido
        if (!name) return null;
        
        return {
          id: parseInt(values[0]) || 0,
          longitude: parseFloat(values[1]) || 0,
          latitude: parseFloat(values[2]) || 0,
          name: name,
          class: (values[4] || '').trim(),
          state: (values[5] || '').trim(),
          annual: parseFloat(values[6]) || 0,
          monthly: {
            jan: parseFloat(values[7]) || 0,
            feb: parseFloat(values[8]) || 0,
            mar: parseFloat(values[9]) || 0,
            apr: parseFloat(values[10]) || 0,
            may: parseFloat(values[11]) || 0,
            jun: parseFloat(values[12]) || 0,
            jul: parseFloat(values[13]) || 0,
            aug: parseFloat(values[14]) || 0,
            sep: parseFloat(values[15]) || 0,
            oct: parseFloat(values[16]) || 0,
            nov: parseFloat(values[17]) || 0,
            dec: parseFloat(values[18]) || 0
          }
        };
      })
      .filter(item => item !== null && item.name && item.annual > 0);
    
    console.log('📊 Total de cidades válidas carregadas:', irradianciaData.length);
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
  
  // Normaliza o nome da cidade para busca
  const cityNameLower = (cityName || '').toLowerCase().trim();
  if (!cityNameLower) {
    console.log('⚠️ Nome da cidade vazio');
    return null;
  }
  
  // Busca exata primeiro
  let city = data.find(item => 
    item?.name && item.name.toLowerCase() === cityNameLower
  );
  
  if (city) {
    console.log('✅ Cidade encontrada (busca exata):', city.name, 'Irradiância:', city.annual);
    return city;
  }
  
  // Se não encontrar, busca parcial
  city = data.find(item => 
    item?.name && item.name.toLowerCase().includes(cityNameLower)
  );
  
  if (city) {
    console.log('✅ Cidade encontrada (busca parcial):', city.name, 'Irradiância:', city.annual);
    return city;
  }
  
  // Tenta busca invertida (cidade contém o termo)
  city = data.find(item => 
    item?.name && cityNameLower.includes(item.name.toLowerCase())
  );
  
  if (city) {
    console.log('✅ Cidade encontrada (busca invertida):', city.name, 'Irradiância:', city.annual);
    return city;
  }
  
  // Fallback: usar São Paulo como padrão
  console.log('⚠️ Cidade não encontrada, usando São Paulo como fallback');
  const fallbackCity = data.find(item => 
    item?.name && item.name.toLowerCase() === 'são paulo' && item.class === 'Capital Estadual'
  );
  
  if (fallbackCity) {
    console.log('✅ Fallback encontrado:', fallbackCity.name, 'Irradiância:', fallbackCity.annual);
    return fallbackCity;
  }
  
  // Fallback secundário: qualquer cidade de São Paulo
  const fallbackSP = data.find(item => 
    item?.state && item.state.toLowerCase().includes('são paulo')
  );
  
  if (fallbackSP) {
    console.log('✅ Fallback SP encontrado:', fallbackSP.name, 'Irradiância:', fallbackSP.annual);
    return fallbackSP;
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
