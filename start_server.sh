#!/bin/bash

# Script para iniciar o servidor Python automaticamente

echo "🚀 Iniciando servidor Python para propostas..."

# Verificar se já está rodando
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Servidor já está rodando em http://localhost:8000"
    exit 0
fi

# Verificar se o Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não está instalado!"
    exit 1
fi

# Verificar se o Flask está instalado
if ! python3 -c "import flask" &> /dev/null; then
    echo "📦 Instalando Flask..."
    pip3 install flask flask-cors
fi

# Navegar para o diretório do projeto
cd "$(dirname "$0")"

# Criar diretório para propostas salvas se não existir
mkdir -p propostas_salvas

# Segurança: nunca inferir/usar arquivo de credenciais no repositório.
# Use GOOGLE_APPLICATION_CREDENTIALS apontando para um caminho fora do repo, ou Application Default Credentials (ADC).
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "🔑 GOOGLE_APPLICATION_CREDENTIALS já definido (usando credencial externa ao repositório)."
else
    echo "ℹ️ GOOGLE_APPLICATION_CREDENTIALS não definido. Se precisar de Firebase Admin, configure a variável de ambiente (fora do repo) ou use ADC."
fi

# Iniciar o servidor
python3 servidor_proposta.py