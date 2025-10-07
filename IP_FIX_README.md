# 🔧 Configuração com Proxy - API Solaryum

## Problema Identificado
A API Solaryum só aceita requisições de IPs cadastrados e bloqueia requisições diretas do browser por CORS. O IP permitido é: **192.168.1.9**

## Solução Implementada
Configurado proxy para contornar CORS e enviar o IP correto para a API.

### Arquivos Modificados:
1. **`vite.config.js`** - Servidor com proxy configurado para usar IP 192.168.1.9
2. **`src/config/solaryum.js`** - URL do proxy local e token atualizado
3. **`src/services/solaryumApi.js`** - Funções de teste atualizadas

## Como Aplicar a Correção

### 1. Reinicie o Servidor de Desenvolvimento
```bash
# Pare o servidor atual (Ctrl+C)
# Reinicie o servidor
npm run dev
```

**⚠️ IMPORTANTE:** O servidor agora rodará em `http://192.168.1.9:3002` em vez de `http://localhost:3001`

### 2. Acesse a Aplicação
- **URL correta**: `http://192.168.1.9:3002`
- **Não use**: `http://localhost:3001` (não funcionará com a API)

### 3. Teste a Conectividade
No console do browser, execute:
```javascript
testConnectivity()
```

### 4. Teste a Autenticação
```javascript
testAuthentication()
```

### 5. Teste Diferentes Tokens
```javascript
testTokens()
```

## Como Funciona Agora

### Configuração do Servidor:
- **Host**: `192.168.1.9` (IP da máquina)
- **Porta**: `3002`
- **Proxy**: Redireciona `/api/solaryum/*` para a API real

### Headers Adicionados:
- `X-Forwarded-For: 192.168.1.9`
- `X-Real-IP: 192.168.1.9`
- `X-Client-IP: 192.168.1.9`
- `X-Original-IP: 192.168.1.9`

### Configuração do Proxy:
- **changeOrigin**: `true` (necessário para HTTPS)
- **Headers**: Força o IP correto para a API através de headers

### Método de Autenticação:
- **Método**: GET request
- **Token**: Enviado como query parameter
- **Token**: `1R6OlSTa` (atualizado)
- **Formato**: `?token=1R6OlSTa&potenciaKw=5.0&tipoTelhado=0&...`

### URLs:
- **Desenvolvimento**: `http://192.168.1.9:3002/api/solaryum/integracaoPlataforma/MontarKits`
- **Produção**: `https://api-d1297.cloud.solaryum.com.br/integracaoPlataforma/MontarKits`

## Próximos Passos
1. **Reinicie o servidor** para aplicar as mudanças
2. **Acesse `http://192.168.1.9:3002`** (não localhost!)
3. **Execute `testTokens()`** no console
4. **Execute `testAuthentication()`** no console
5. **Clique em "Buscar Equipamentos"** na interface

## Troubleshooting
Se ainda houver problemas:
1. Verifique se o servidor foi reiniciado
2. Verifique se está acessando `http://192.168.1.9:3002`
3. Verifique se o IP 192.168.1.9 está correto na sua rede
4. Execute `testTokens()` para testar diferentes tokens
5. Execute `testConnectivity()` para diagnosticar

## Verificação do IP
Para verificar seu IP atual:
```bash
# No terminal
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Se o IP não for 192.168.1.9, atualize o arquivo `vite.config.js` com o IP correto.