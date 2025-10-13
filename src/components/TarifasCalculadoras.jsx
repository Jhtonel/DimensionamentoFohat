import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  DollarSign, 
  Zap, 
  TrendingUp, 
  MapPin,
  Phone,
  Globe,
  Info
} from 'lucide-react';
import { useConsumoPorValor, useValorPorConsumo, useConcessionariasPorCidade } from '../hooks/useTarifas';

/**
 * Componente para calcular consumo baseado no valor em reais
 */
export function CalculadoraConsumo() {
  const [valorReais, setValorReais] = useState('');
  const [concessionaria, setConcessionaria] = useState('');
  const [tipoConsumo, setTipoConsumo] = useState('residencial');
  const [bandeira, setBandeira] = useState('verde');

  const { resultado, loading, error } = useConsumoPorValor(
    parseFloat(valorReais) || 0,
    concessionaria,
    tipoConsumo,
    bandeira
  );

  return (
    <Card className="glass-card border-0 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-sky-500" />
          Calculadora de Consumo
        </CardTitle>
        <p className="text-sm text-gray-600">
          Calcule o consumo em kWh baseado no valor da sua conta de luz
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="valor">Valor da Conta (R$)</Label>
            <Input
              id="valor"
              type="number"
              placeholder="Ex: 150.00"
              value={valorReais}
              onChange={(e) => setValorReais(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="concessionaria">Concessionária</Label>
            <Select value={concessionaria} onValueChange={setConcessionaria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a concessionária" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Enel SP">Enel Distribuição São Paulo</SelectItem>
                <SelectItem value="CPFL Piratininga">CPFL Piratininga</SelectItem>
                <SelectItem value="CPFL Paulista">CPFL Paulista</SelectItem>
                <SelectItem value="CPFL Santa Cruz">CPFL Santa Cruz</SelectItem>
                <SelectItem value="EDP SP">EDP São Paulo</SelectItem>
                <SelectItem value="Neoenergia Elektro">Neoenergia Elektro</SelectItem>
                <SelectItem value="Energia Sul">Energia Sul</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tipo">Tipo de Consumo</Label>
            <Select value={tipoConsumo} onValueChange={setTipoConsumo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residencial">Residencial</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="bandeira">Bandeira Tarifária</Label>
            <Select value={bandeira} onValueChange={setBandeira}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verde">Verde (Sem acréscimo)</SelectItem>
                <SelectItem value="amarela">Amarela (+R$ 0,010/kWh)</SelectItem>
                <SelectItem value="vermelha1">Vermelha Patamar 1 (+R$ 0,030/kWh)</SelectItem>
                <SelectItem value="vermelha2">Vermelha Patamar 2 (+R$ 0,030/kWh)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500"></div>
            <span className="ml-2">Calculando...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {resultado && (
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Resultado do Cálculo</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600">Valor da Conta:</span>
                    <span className="font-semibold">R$ {resultado.valorReais.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-gray-600">Consumo Estimado:</span>
                    <span className="font-semibold">{resultado.consumoKwh} kWh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-600">Tarifa Total:</span>
                    <span className="font-semibold">R$ {resultado.tarifaTotal.toFixed(3)}/kWh</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Detalhes da Tarifa</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tarifa Básica:</span>
                    <span>R$ {resultado.detalhes.tarifaBasica.toFixed(3)}/kWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ICMS:</span>
                    <span>{(resultado.detalhes.icms * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PIS/COFINS:</span>
                    <span>{(resultado.detalhes.pisCofins * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bandeira Tarifária:</span>
                    <span>R$ {resultado.detalhes.bandeiraTarifaria.toFixed(3)}/kWh</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Info className="w-4 h-4" />
                <span>Concessionária: {resultado.concessionaria}</span>
                <Badge variant="outline" className="text-xs">
                  {resultado.tipoConsumo.charAt(0).toUpperCase() + resultado.tipoConsumo.slice(1)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {resultado.bandeira.charAt(0).toUpperCase() + resultado.bandeira.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Componente para calcular valor baseado no consumo
 */
export function CalculadoraValor() {
  const [consumoKwh, setConsumoKwh] = useState('');
  const [concessionaria, setConcessionaria] = useState('');
  const [tipoConsumo, setTipoConsumo] = useState('residencial');
  const [bandeira, setBandeira] = useState('verde');

  const { resultado, loading, error } = useValorPorConsumo(
    parseFloat(consumoKwh) || 0,
    concessionaria,
    tipoConsumo,
    bandeira
  );

  return (
    <Card className="glass-card border-0 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          Calculadora de Valor
        </CardTitle>
        <p className="text-sm text-gray-600">
          Calcule o valor da conta baseado no consumo em kWh
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="consumo">Consumo Mensal (kWh)</Label>
            <Input
              id="consumo"
              type="number"
              placeholder="Ex: 300"
              value={consumoKwh}
              onChange={(e) => setConsumoKwh(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="concessionaria-valor">Concessionária</Label>
            <Select value={concessionaria} onValueChange={setConcessionaria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a concessionária" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Enel SP">Enel Distribuição São Paulo</SelectItem>
                <SelectItem value="CPFL Piratininga">CPFL Piratininga</SelectItem>
                <SelectItem value="CPFL Paulista">CPFL Paulista</SelectItem>
                <SelectItem value="CPFL Santa Cruz">CPFL Santa Cruz</SelectItem>
                <SelectItem value="EDP SP">EDP São Paulo</SelectItem>
                <SelectItem value="Neoenergia Elektro">Neoenergia Elektro</SelectItem>
                <SelectItem value="Energia Sul">Energia Sul</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tipo-valor">Tipo de Consumo</Label>
            <Select value={tipoConsumo} onValueChange={setTipoConsumo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residencial">Residencial</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="bandeira-valor">Bandeira Tarifária</Label>
            <Select value={bandeira} onValueChange={setBandeira}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verde">Verde (Sem acréscimo)</SelectItem>
                <SelectItem value="amarela">Amarela (+R$ 0,010/kWh)</SelectItem>
                <SelectItem value="vermelha1">Vermelha Patamar 1 (+R$ 0,030/kWh)</SelectItem>
                <SelectItem value="vermelha2">Vermelha Patamar 2 (+R$ 0,030/kWh)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500"></div>
            <span className="ml-2">Calculando...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {resultado && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Resultado do Cálculo</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-gray-600">Consumo:</span>
                    <span className="font-semibold">{resultado.consumoKwh} kWh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600">Valor Estimado:</span>
                    <span className="font-semibold">R$ {resultado.valorReais.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-600">Tarifa Total:</span>
                    <span className="font-semibold">R$ {resultado.tarifaTotal.toFixed(3)}/kWh</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Detalhes da Tarifa</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tarifa Básica:</span>
                    <span>R$ {resultado.detalhes.tarifaBasica.toFixed(3)}/kWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ICMS:</span>
                    <span>{(resultado.detalhes.icms * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">PIS/COFINS:</span>
                    <span>{(resultado.detalhes.pisCofins * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bandeira Tarifária:</span>
                    <span>R$ {resultado.detalhes.bandeiraTarifaria.toFixed(3)}/kWh</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Info className="w-4 h-4" />
                <span>Concessionária: {resultado.concessionaria}</span>
                <Badge variant="outline" className="text-xs">
                  {resultado.tipoConsumo.charAt(0).toUpperCase() + resultado.tipoConsumo.slice(1)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {resultado.bandeira.charAt(0).toUpperCase() + resultado.bandeira.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Componente para buscar concessionárias por cidade
 */
export function BuscadorConcessionarias() {
  const [cidade, setCidade] = useState('');
  const { concessionarias, loading, error } = useConcessionariasPorCidade(cidade);

  return (
    <Card className="glass-card border-0 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-purple-500" />
          Buscar Concessionárias por Cidade
        </CardTitle>
        <p className="text-sm text-gray-600">
          Encontre as concessionárias que atendem sua cidade
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="cidade">Nome da Cidade</Label>
          <Input
            id="cidade"
            placeholder="Ex: São Paulo, Campinas, Santos..."
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500"></div>
            <span className="ml-2">Buscando...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {concessionarias.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">
              Concessionárias encontradas ({concessionarias.length})
            </h4>
            {concessionarias.map((concessionaria) => (
              <div key={concessionaria.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-900">{concessionaria.nome}</h5>
                    <p className="text-sm text-gray-600">{concessionaria.sigla}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{concessionaria.telefone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Globe className="w-4 h-4" />
                        <span>{concessionaria.website}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">
                      R$ {concessionaria.tarifas.residencial.totalComImpostos.toFixed(3)}/kWh
                    </Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">Áreas de Atendimento:</p>
                  <div className="flex flex-wrap gap-1">
                    {concessionaria.areasAtendimento.map((area, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {cidade && concessionarias.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma concessionária encontrada para "{cidade}"</p>
            <p className="text-sm">Tente buscar por uma cidade maior ou região</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
