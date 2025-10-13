# Dados de Irradiância Solar

Este diretório contém os dados de irradiância solar para cidades brasileiras, organizados seguindo boas práticas de desenvolvimento.

## Estrutura de Arquivos

```
src/
├── data/
│   └── irradiancia.csv          # Dados brutos de irradiância por cidade
├── utils/
│   └── irradianciaUtils.js      # Utilitários para trabalhar com os dados
├── hooks/
│   └── useIrradiancia.js        # Hooks React para irradiância
└── components/
    └── IrradianciaCard.jsx      # Componente para exibir dados de irradiância
```

## Formato dos Dados

O arquivo `irradiancia.csv` contém dados de irradiância solar no plano inclinado para cidades brasileiras, com o seguinte formato:

```csv
ID;LON;LAT;NAME;CLASS;STATE;ANNUAL;JAN;FEB;MAR;APR;MAY;JUN;JUL;AUG;SEP;OCT;NOV;DEC
30670;-68.7463;-11.0109;Brasiléia;Sede Municipal;ACRE;4675;4376;4504;4284;4782;4276;4517;4713;5181;5192;4972;4866;4440
```

### Campos:
- **ID**: Identificador único da cidade
- **LON**: Longitude
- **LAT**: Latitude  
- **NAME**: Nome da cidade
- **CLASS**: Classificação da cidade
- **STATE**: Estado (sigla)
- **ANNUAL**: Irradiância anual (kWh/m²/ano)
- **JAN-DEC**: Irradiância mensal (kWh/m²/mês)

## Como Usar

### 1. Utilitários Básicos

```javascript
import { 
  getIrradianciaByCity, 
  calcularPotenciaUsina,
  calcularEnergiaMensal 
} from '@/utils/irradianciaUtils';

// Buscar dados de uma cidade
const cidade = await getIrradianciaByCity('São Paulo');

// Calcular potência da usina
const potencia = calcularPotenciaUsina(
  cidade.annual,    // Irradiância anual
  50,               // Área dos painéis (m²)
  0.2               // Eficiência do painel (20%)
);

// Calcular energia mensal
const energiaMensal = calcularEnergiaMensal(cidade, 50, 0.2);
```

### 2. Hooks React

```javascript
import { useSolarPowerCalculation } from '@/hooks/useIrradiancia';

function MeuComponente() {
  const { result, loading, error } = useSolarPowerCalculation(
    'São Paulo',  // Cidade
    50,           // Área dos painéis
    0.2           // Eficiência
  );

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <h3>Potência da Usina: {result.potenciaUsina} kW</h3>
      <p>Irradiância Anual: {result.irradianciaAnual} kWh/m²</p>
    </div>
  );
}
```

### 3. Componente Pronto

```javascript
import { IrradianciaCard, CitySelector } from '@/components/IrradianciaCard';

function MeuComponente() {
  const [cidadeSelecionada, setCidadeSelecionada] = useState(null);

  return (
    <div>
      <CitySelector onCitySelect={setCidadeSelecionada} />
      
      {cidadeSelecionada && (
        <IrradianciaCard 
          cityName={cidadeSelecionada.name}
          areaPainel={50}
          eficienciaPainel={0.2}
        />
      )}
    </div>
  );
}
```

### 4. Entidade Integrada

```javascript
import { IrradiacaoSolar } from '@/entities';

// Buscar irradiação por cidade
const irradiancia = await IrradiacaoSolar.getByCity('São Paulo');

// Calcular potência
const potencia = await IrradiacaoSolar.calculatePower('São Paulo', 50, 0.2);

// Calcular energia mensal
const energiaMensal = await IrradiacaoSolar.calculateMonthlyEnergy('São Paulo', 50, 0.2);
```

## Cálculos Disponíveis

### Potência da Usina
```javascript
Potência (kW) = (Irradiância Anual × Área dos Painéis × Eficiência) / 1000
```

### Energia Mensal
```javascript
Energia Mensal (kWh) = (Irradiância Mensal × Área dos Painéis × Eficiência) / 1000
```

## Exemplo de Uso Completo

```javascript
import React, { useState } from 'react';
import { IrradianciaCard, CitySelector } from '@/components/IrradianciaCard';

function CalculadoraSolar() {
  const [cidade, setCidade] = useState(null);
  const [areaPainel, setAreaPainel] = useState(50);
  const [eficiencia, setEficiencia] = useState(0.2);

  return (
    <div className="space-y-6">
      <div>
        <label>Selecione a Cidade:</label>
        <CitySelector onCitySelect={setCidade} />
      </div>

      <div>
        <label>Área dos Painéis (m²):</label>
        <input 
          type="number" 
          value={areaPainel}
          onChange={(e) => setAreaPainel(Number(e.target.value))}
        />
      </div>

      <div>
        <label>Eficiência do Painel (%):</label>
        <input 
          type="number" 
          value={eficiencia * 100}
          onChange={(e) => setEficiencia(Number(e.target.value) / 100)}
        />
      </div>

      {cidade && (
        <IrradianciaCard 
          cityName={cidade.name}
          areaPainel={areaPainel}
          eficienciaPainel={eficiencia}
        />
      )}
    </div>
  );
}
```

## Notas Importantes

1. **Dados Reais**: Os dados são baseados em medições reais de irradiância solar
2. **Cobertura**: Inclui todas as principais cidades brasileiras
3. **Precisão**: Valores em kWh/m² para cálculos precisos
4. **Performance**: Dados são carregados uma vez e cacheados em memória
5. **Responsividade**: Componentes são totalmente responsivos

## Manutenção

- Para atualizar os dados, substitua o arquivo `irradiancia.csv`
- Os utilitários são compatíveis com o formato atual
- Testes devem ser executados após atualizações dos dados
