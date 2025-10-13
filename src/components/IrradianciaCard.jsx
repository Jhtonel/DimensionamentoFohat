import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, MapPin, Zap, TrendingUp } from 'lucide-react';

/**
 * Componente para exibir informações de irradiância solar de uma cidade
 */
export function IrradianciaCard({ cityName, areaPainel, eficienciaPainel = 0.2 }) {
  const [irradianciaData, setIrradianciaData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!cityName) return;

    setLoading(true);
    setError(null);

    import('../utils/irradianciaUtils').then(({ getIrradianciaByCity, calcularPotenciaUsina, calcularEnergiaMensal }) => {
      getIrradianciaByCity(cityName)
        .then(data => {
          if (!data) {
            setError(`Cidade "${cityName}" não encontrada`);
            setLoading(false);
            return;
          }

          const potencia = areaPainel ? calcularPotenciaUsina(data.annual, areaPainel, eficienciaPainel) : null;
          const energiaMensal = areaPainel ? calcularEnergiaMensal(data, areaPainel, eficienciaPainel) : null;

          setIrradianciaData({
            ...data,
            potenciaUsina: potencia,
            energiaMensal
          });
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    });
  }, [cityName, areaPainel, eficienciaPainel]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
            <span className="ml-2">Carregando dados de irradiância...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <Sun className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!irradianciaData) {
    return null;
  }

  const { name, state, annual, monthly, potenciaUsina, energiaMensal } = irradianciaData;

  return (
    <Card className="glass-card border-0 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sun className="w-5 h-5 text-orange-500" />
          Irradiação Solar - {name}
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>{state}</span>
          <Badge variant="outline" className="text-xs">
            {annual.toLocaleString('pt-BR')} kWh/m²/ano
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Irradiação Anual */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">Irradiação Anual</h4>
              <p className="text-2xl font-bold text-orange-600">
                {annual.toLocaleString('pt-BR')} kWh/m²
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        {/* Potência da Usina (se área fornecida) */}
        {potenciaUsina && (
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">Potência da Usina</h4>
                <p className="text-2xl font-bold text-sky-600">
                  {potenciaUsina.toFixed(2)} kW
                </p>
                <p className="text-sm text-gray-600">
                  Área: {areaPainel} m² | Eficiência: {(eficienciaPainel * 100).toFixed(1)}%
                </p>
              </div>
              <Zap className="w-8 h-8 text-sky-500" />
            </div>
          </div>
        )}

        {/* Energia Mensal (se área fornecida) */}
        {energiaMensal && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Energia Gerada Mensalmente</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {Object.entries(energiaMensal).map(([mes, energia]) => (
                <div key={mes} className="bg-gray-50 rounded p-2 text-center">
                  <div className="font-medium text-gray-600 capitalize">{mes}</div>
                  <div className="font-bold text-gray-900">
                    {energia.toFixed(1)} kWh
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Irradiação Mensal */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Irradiação Mensal</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {Object.entries(monthly).map(([mes, irradiancia]) => (
              <div key={mes} className="bg-orange-50 rounded p-2 text-center">
                <div className="font-medium text-gray-600 capitalize">{mes}</div>
                <div className="font-bold text-orange-600">
                  {irradiancia.toLocaleString('pt-BR')} kWh/m²
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Componente para seleção de cidade
 */
export function CitySelector({ onCitySelect, selectedCity }) {
  const [cities, setCities] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    if (searchTerm.length < 2) {
      setCities([]);
      return;
    }

    setLoading(true);
    
    import('../utils/irradianciaUtils').then(({ loadIrradianciaData }) => {
      loadIrradianciaData().then(data => {
        const filtered = data
          .filter(city => 
            city.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .slice(0, 10); // Limita a 10 resultados
        
        setCities(filtered);
        setLoading(false);
      });
    });
  }, [searchTerm]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Digite o nome da cidade..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      />
      
      {loading && (
        <div className="absolute right-3 top-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-500"></div>
        </div>
      )}

      {cities.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {cities.map(city => (
            <button
              key={city.id}
              onClick={() => {
                onCitySelect(city);
                setSearchTerm(city.name);
                setCities([]);
              }}
              className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium">{city.name}</div>
              <div className="text-sm text-gray-600">{city.state}</div>
              <div className="text-xs text-orange-600">
                {city.annual.toLocaleString('pt-BR')} kWh/m²/ano
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
