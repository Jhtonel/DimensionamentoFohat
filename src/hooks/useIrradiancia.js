import { useState, useEffect } from 'react';
import { 
  loadIrradianciaData, 
  getIrradianciaByCity, 
  getIrradianciaByState,
  calcularPotenciaUsina,
  calcularEnergiaMensal,
  getNearestCity,
  getStateIrradianciaStats
} from '../utils/irradianciaUtils';

/**
 * Hook para trabalhar com dados de irradiância solar
 */
export function useIrradiancia() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadIrradianciaData()
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return {
    data,
    loading,
    error,
    getCityIrradiancia: getIrradianciaByCity,
    getStateIrradiancia: getIrradianciaByState,
    calculatePower: calcularPotenciaUsina,
    calculateMonthlyEnergy: calcularEnergiaMensal,
    getNearestCity,
    getStateStats: getStateIrradianciaStats
  };
}

/**
 * Hook para calcular potência de usina solar
 * @param {string} cityName - Nome da cidade
 * @param {number} areaPainel - Área dos painéis em m²
 * @param {number} eficienciaPainel - Eficiência do painel (0-1)
 */
export function useSolarPowerCalculation(cityName, areaPainel, eficienciaPainel = 0.2) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!cityName || !areaPainel) {
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    getIrradianciaByCity(cityName)
      .then(irradianciaData => {
        if (!irradianciaData) {
          setError(`Cidade "${cityName}" não encontrada nos dados de irradiância`);
          setResult(null);
          setLoading(false);
          return;
        }

        const potencia = calcularPotenciaUsina(
          irradianciaData.annual, 
          areaPainel, 
          eficienciaPainel
        );

        const energiaMensal = calcularEnergiaMensal(
          irradianciaData, 
          areaPainel, 
          eficienciaPainel
        );

        setResult({
          city: irradianciaData.name,
          state: irradianciaData.state,
          irradianciaAnual: irradianciaData.annual,
          potenciaUsina: potencia,
          energiaMensal,
          areaPainel,
          eficienciaPainel
        });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setResult(null);
        setLoading(false);
      });
  }, [cityName, areaPainel, eficienciaPainel]);

  return {
    result,
    loading,
    error
  };
}

/**
 * Hook para buscar cidades por estado
 * @param {string} state - Sigla do estado
 */
export function useCitiesByState(state) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!state) {
      setCities([]);
      return;
    }

    setLoading(true);
    setError(null);

    getIrradianciaByState(state)
      .then(data => {
        setCities(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setCities([]);
        setLoading(false);
      });
  }, [state]);

  return {
    cities,
    loading,
    error
  };
}
