#!/usr/bin/env python3
"""Teste direto do endpoint get_projeto"""
import os
os.environ['ALLOW_SQLITE'] = '1'

from servidor_proposta import app
import json

# Simular requisição
with app.test_client() as client:
    # Listar projetos primeiro
    resp = client.get('/projetos/list')
    projetos = resp.get_json()
    
    if projetos and len(projetos) > 0:
        projeto_id = projetos[0].get('id')
        print(f"📋 Testando projeto: {projeto_id}")
        print(f"📋 Nome: {projetos[0].get('cliente_nome')}")
        print(f"📋 Cliente ID: {projetos[0].get('cliente_id')}")
        print()
        
        # Buscar detalhes
        resp2 = client.get(f'/projetos/get/{projeto_id}')
        data = resp2.get_json()
        
        if data.get('success'):
            projeto = data.get('projeto', {})
            print("✅ Dados retornados pelo endpoint:")
            campos_importantes = ['cliente_id', 'cliente_nome', 'cep', 'cidade', 'estado', 
                                 'logradouro', 'numero', 'bairro', 'endereco_completo',
                                 'concessionaria', 'consumo_mensal_kwh', 'tarifa_energia']
            for campo in campos_importantes:
                valor = projeto.get(campo)
                status = "✅" if valor else "❌"
                print(f"  {status} {campo}: {valor}")
        else:
            print(f"❌ Erro: {data.get('message')}")
    else:
        print("❌ Nenhum projeto encontrado")
