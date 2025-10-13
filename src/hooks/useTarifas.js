import { useState, useEffect } from 'react';
import {
  calcularConsumoPorValor,
  calcularValorPorConsumo,
  buscarConcessionariasCidade,
  obterConcessionaria,
  calcularEconomiaSolar,
  compararTarifas,
  obterEstatisticas,
  validarConcessionaria,
  obterTiposConsumo,
  obterBandeirasTarifarias
} from '../utils/tarifasUtils';

/**
 * Hook para calcular consumo baseado no valor em reais
 */
export function useConsumoPorValor(valorReais, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!valorReais || !concessionaria || valorReais <= 0) {
      setResultado(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    calcularConsumoPorValor(valorReais, concessionaria, tipoConsumo, bandeira)
      .then(resultado => {
        setResultado(resultado);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setResultado(null);
        setLoading(false);
      });
  }, [valorReais, concessionaria, tipoConsumo, bandeira]);

  return {
    resultado,
    loading,
    error
  };
}

/**
 * Hook para calcular valor baseado no consumo em kWh
 */
export function useValorPorConsumo(consumoKwh, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde') {
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!consumoKwh || !concessionaria || consumoKwh <= 0) {
      setResultado(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    calcularValorPorConsumo(consumoKwh, concessionaria, tipoConsumo, bandeira)
      .then(resultado => {
        setResultado(resultado);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setResultado(null);
        setLoading(false);
      });
  }, [consumoKwh, concessionaria, tipoConsumo, bandeira]);

  return {
    resultado,
    loading,
    error
  };
}

/**
 * Hook para buscar concessionárias por cidade
 */
export function useConcessionariasPorCidade(cidade) {
  const [concessionarias, setConcessionarias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!cidade || cidade.length < 2) {
      setConcessionarias([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resultado = buscarConcessionariasCidade(cidade);
      setConcessionarias(resultado);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setConcessionarias([]);
      setLoading(false);
    }
  }, [cidade]);

  return {
    concessionarias,
    loading,
    error
  };
}

/**
 * Hook para calcular economia com energia solar
 */
export function useEconomiaSolar(consumoKwh, concessionaria, tipoConsumo = 'residencial', bandeira = 'verde', percentualEconomia = 0.8) {
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!consumoKwh || !concessionaria || consumoKwh <= 0) {
      setResultado(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    calcularEconomiaSolar(consumoKwh, concessionaria, tipoConsumo, bandeira, percentualEconomia)
      .then(resultado => {
        setResultado(resultado);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setResultado(null);
        setLoading(false);
      });
  }, [consumoKwh, concessionaria, tipoConsumo, bandeira, percentualEconomia]);

  return {
    resultado,
    loading,
    error
  };
}

/**
 * Hook para comparar tarifas entre concessionárias
 */
export function useComparacaoTarifas(tipoConsumo = 'residencial', bandeira = 'verde') {
  const [comparacao, setComparacao] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const resultado = compararTarifas(tipoConsumo, bandeira);
      setComparacao(resultado);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setComparacao([]);
      setLoading(false);
    }
  }, [tipoConsumo, bandeira]);

  return {
    comparacao,
    loading,
    error
  };
}

/**
 * Hook para obter estatísticas das tarifas
 */
export function useEstatisticasTarifas() {
  const [estatisticas, setEstatisticas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const resultado = obterEstatisticas();
      setEstatisticas(resultado);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setEstatisticas(null);
      setLoading(false);
    }
  }, []);

  return {
    estatisticas,
    loading,
    error
  };
}

/**
 * Hook para obter dados estáticos (tipos de consumo, bandeiras, etc.)
 */
export function useDadosEstaticos() {
  const [dados, setDados] = useState({
    tiposConsumo: [],
    bandeirasTarifarias: []
  });

  useEffect(() => {
    setDados({
      tiposConsumo: obterTiposConsumo(),
      bandeirasTarifarias: obterBandeirasTarifarias()
    });
  }, []);

  return dados;
}

/**
 * Hook para validar concessionária
 */
export function useValidacaoConcessionaria(concessionaria) {
  const [valida, setValida] = useState(false);

  useEffect(() => {
    if (!concessionaria) {
      setValida(false);
      return;
    }

    setValida(validarConcessionaria(concessionaria));
  }, [concessionaria]);

  return valida;
}
