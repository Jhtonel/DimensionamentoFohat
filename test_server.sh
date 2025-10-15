#!/bin/bash

# Script para testar o servidor de propostas

echo "🧪 Testando servidor de propostas..."

# Testar health check
echo "1. Testando health check..."
curl -s http://localhost:8000/health | jq '.' 2>/dev/null || curl -s http://localhost:8000/health
echo ""

# Testar salvamento de proposta
echo "2. Testando salvamento de proposta..."
curl -X POST http://localhost:8000/salvar-proposta \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_nome": "João Silva",
    "potencia_sistema": 9.36,
    "preco_final": 11344.40,
    "cidade": "São José dos Campos",
    "conta_atual_anual": 12000,
    "anos_payback": 5,
    "gasto_acumulado_payback": 60000
  }' | jq '.' 2>/dev/null || curl -X POST http://localhost:8000/salvar-proposta \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_nome": "João Silva",
    "potencia_sistema": 9.36,
    "preco_final": 11344.40,
    "cidade": "São José dos Campos",
    "conta_atual_anual": 12000,
    "anos_payback": 5,
    "gasto_acumulado_payback": 60000
  }'
echo ""

echo "✅ Teste concluído!"
