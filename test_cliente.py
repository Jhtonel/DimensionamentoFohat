#!/usr/bin/env python3
"""Verifica dados do cliente"""
import os
os.environ['ALLOW_SQLITE'] = '1'

from db import SessionLocal, ClienteDB, EnderecoDB

db = SessionLocal()

# Buscar cliente específico
cliente_id = "cbe746e5-81cf-42d1-974b-0ccf8d6a7d8b"
cliente = db.get(ClienteDB, cliente_id)

if cliente:
    print(f"📋 Cliente: {cliente.nome}")
    print(f"  CEP: {cliente.cep}")
    print(f"  Endereco completo: {cliente.endereco_completo}")
    print(f"  Telefone: {cliente.telefone}")
    print()
    
    # Verificar endereços
    print(f"📍 Endereços cadastrados: {len(cliente.enderecos) if cliente.enderecos else 0}")
    if cliente.enderecos:
        for i, end in enumerate(cliente.enderecos):
            print(f"  Endereço {i+1}:")
            print(f"    Logradouro: {end.logradouro}")
            print(f"    Número: {end.numero}")
            print(f"    Bairro: {end.bairro}")
            print(f"    Cidade: {end.cidade}")
            print(f"    Estado: {end.estado}")
            print(f"    CEP: {end.cep}")
else:
    print("❌ Cliente não encontrado")

# Listar todos os clientes
print("\n📋 Todos os clientes:")
for c in db.query(ClienteDB).limit(5).all():
    print(f"  - {c.id[:8]}... | {c.nome} | CEP: {c.cep} | Endereços: {len(c.enderecos) if c.enderecos else 0}")

db.close()
