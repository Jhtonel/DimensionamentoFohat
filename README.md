# DimensionamentoSolar

Sistema de dimensionamento de projetos solares fotovoltaicos com integração à API Solaryum.

## 🚀 Funcionalidades

- **Dimensionamento Automático**: Cálculo automático da potência necessária baseado no consumo
- **Integração com API Solaryum**: Busca de equipamentos e kits disponíveis
- **Filtros Dinâmicos**: Filtros por marca, potência e tipo de inversor
- **Cálculo de Custos**: Cálculo automático de custos baseado no kit selecionado
- **Análise de Economia**: Estimativa de economia e payback
- **Interface Responsiva**: Design moderno e responsivo

## 🛠️ Tecnologias

- **Frontend**: React + Vite
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Icons**: Lucide React
- **API Integration**: Fetch API

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/DimensionamentoSolar.git

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

## 🔧 Configuração

### API Solaryum

Configure a API no arquivo `src/config/solaryum.js`:

```javascript
export const SOLARYUM_CONFIG = {
  BASE_URL: 'https://api-d1297.cloud.solaryum.com.br',
  API_KEY: 'seu-token-aqui',
  TIMEOUT: 15000,
  ENDPOINTS: {
    MONTAR_KITS: '/integracaoPlataforma/MontarKits',
    FILTROS: '/integracaoPlataforma/BuscarFiltros'
  }
};
```

### Servidor de Desenvolvimento

Configure o proxy no `vite.config.js` para contornar CORS:

```javascript
export default defineConfig({
  server: {
    host: '192.168.1.9',
    port: 3002,
    proxy: {
      '/api/solaryum': {
        target: 'https://api-d1297.cloud.solaryum.com.br',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.setHeader('X-Forwarded-For', '192.168.1.9');
            proxyReq.setHeader('X-Real-IP', '192.168.1.9');
            proxyReq.setHeader('X-Client-IP', '192.168.1.9');
            proxyReq.setHeader('X-Original-IP', '192.168.1.9');
            proxyReq.setHeader('Client-IP', '192.168.1.9');
            proxyReq.setHeader('Remote-Addr', '192.168.1.9');
            proxyReq.setHeader('X-Forwarded-Proto', 'https');
            proxyReq.setHeader('X-Forwarded-Host', 'api-d1297.cloud.solaryum.com.br');
            proxyReq.setHeader('Origin', 'https://api-d1297.cloud.solaryum.com.br');
            proxyReq.setHeader('Referer', 'https://api-d1297.cloud.solaryum.com.br/swagger/index.html');
          });
        }
      }
    }
  }
});
```

## 📋 Uso

### 1. Dados Básicos
- Preencha o CEP e clique em "Buscar CEP"
- Selecione o tipo de telhado
- Escolha a tensão (220V, 380V, +380V)
- Informe o consumo mensal em kWh

### 2. Buscar Equipamentos
- Clique em "Buscar Equipamentos"
- O sistema buscará todos os kits disponíveis
- Use os filtros para refinar a busca

### 3. Selecionar Kit
- Escolha um kit clicando no card
- Clique em "Avançar para Custos"

### 4. Cálculo de Custos
- Visualize os custos calculados automaticamente
- Veja a estimativa de economia e payback
- Analise o detalhamento dos componentes

## 🎯 Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── clientes/       # Componentes de clientes
│   ├── Dashboard/      # Componentes do dashboard
│   ├── projetos/       # Componentes de projetos
│   └── ui/            # Componentes de UI base
├── config/             # Configurações
├── entities/           # Entidades do domínio
├── hooks/              # Custom hooks
├── integrations/       # Integrações externas
├── pages/              # Páginas da aplicação
├── services/           # Serviços de API
└── utils/              # Utilitários
```

## 🔌 API Endpoints

### Montar Kits
```
GET /integracaoPlataforma/MontarKits
```

**Parâmetros:**
- `token`: Token de autenticação
- `potenciaDoKit`: Potência do kit em kW
- `tensao`: Tensão (1=220V, 2=380V, 3=+380V)
- `fase`: Fase (0=monofásico, 2=trifásico)
- `telhados`: Tipo de telhado (0-13)
- `ibge`: Código IBGE da cidade
- `potenciaDoPainel`: Potência do painel (opcional)
- `tipoInv`: Tipo de inversor (0, 1, 2)

### Buscar Filtros
```
GET /integracaoPlataforma/BuscarFiltros
```

**Parâmetros:**
- `token`: Token de autenticação

## 📊 Cálculos

### Custos do Projeto
- **Equipamentos**: Preço do kit (da API)
- **Instalação**: 15% do preço do kit
- **Subtotal**: Equipamentos + Instalação
- **Impostos**: 18% do subtotal
- **Total Final**: Subtotal + Impostos

### Economia Estimada
- **Tarifa kWh**: R$ 0,75 (padrão)
- **Economia Mensal**: Consumo × Tarifa × 0,95
- **Economia Anual**: Economia Mensal × 12
- **Payback**: Total do Projeto ÷ Economia Anual

## 🚀 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview da build
npm run preview

# Linting
npm run lint
```

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para suporte, entre em contato através de:
- Email: seu-email@exemplo.com
- Issues: [GitHub Issues](https://github.com/seu-usuario/DimensionamentoSolar/issues)

---

Desenvolvido com ❤️ para o setor de energia solar fotovoltaica.
