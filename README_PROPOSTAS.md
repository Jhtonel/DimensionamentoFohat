# Sistema de Propostas Solares

## 🚀 Como Usar

### 1. Iniciar o Servidor Python

```bash
# Opção 1: Script automático
./start_server.sh

# Opção 2: Manual
python3 servidor_proposta.py
```

### 2. Usar o Sistema

1. **Preencher dados básicos** → Aba "Básico"
2. **Selecionar kit solar** → Aba "Dimensionamento"  
3. **Ver custos** → Aba "Custos"
4. **Clicar "Gerar proposta e avançar"** → **Proposta aparece automaticamente na aba "Resultados"!**

## 🔧 Funcionamento

### Servidor Python (Backend)
- **Porta**: 8000
- **Endpoints**:
  - `POST /salvar-proposta` - Salva dados da proposta
  - `GET /gerar-proposta-html/<id>` - Gera HTML com variáveis substituídas
  - `GET /proposta/<id>` - Visualiza proposta diretamente
  - `GET /health` - Status do servidor

### Frontend (React)
- **Serviço**: `propostaService.js` - Comunicação com servidor
- **Fallback**: Se servidor não estiver disponível, usa localStorage
- **Auto-geração**: Proposta é gerada automaticamente ao navegar para "Resultados"

## 📁 Estrutura

```
/propostas_salvas/          # Dados salvos no servidor
  ├── uuid1.json           # Proposta 1
  ├── uuid2.json           # Proposta 2
  └── ...

/src/services/
  └── propostaService.js   # Comunicação com servidor

/servidor_proposta.py       # Servidor Python
/start_server.sh           # Script para iniciar servidor
/public/template.html      # Template da proposta
```

## ✅ Benefícios

1. **Dados seguros**: Salvos no servidor, não perdidos
2. **Valores corretos**: Todos os dados do kit e financeiros
3. **CSS preservado**: Template mantido exatamente como está
4. **Substituição robusta**: Todas as variáveis `{{}}` substituídas
5. **Fallback automático**: Funciona mesmo sem servidor
6. **Auto-geração**: Proposta aparece automaticamente

## 🐛 Troubleshooting

### Servidor não inicia
```bash
# Verificar Python
python3 --version

# Instalar Flask
pip3 install flask flask-cors

# Verificar template
ls -la public/template.html
```

### Erro de conexão
- O sistema tem fallback automático para localStorage
- Verifique se a porta 8000 está livre
- Execute `./start_server.sh` para iniciar o servidor

### Dados zerados
- Verifique se o kit está selecionado
- Confirme se os dados básicos estão preenchidos
- Verifique os logs do console para debug
