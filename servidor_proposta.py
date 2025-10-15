#!/usr/bin/env python3
"""
Servidor Python para gerar propostas PPT usando o script proposta_solar
"""

import os
import sys
import json
import base64
import tempfile
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Servidor para propostas HTML (sem dependência do proposta_solar)

# Diretório para salvar propostas
PROPOSTAS_DIR = Path(__file__).parent / "propostas"
PROPOSTAS_DIR.mkdir(exist_ok=True)

@app.route('/salvar-proposta', methods=['POST'])
def salvar_proposta():
    try:
        print("🚀 Recebida requisição para salvar proposta")
        print(f"🌐 Headers: {dict(request.headers)}")
        print(f"🌐 Origin: {request.headers.get('Origin', 'N/A')}")
        data = request.get_json()
        print(f"📊 Dados recebidos: {data}")
        print(f"💰 Valores financeiros específicos recebidos:")
        print(f"   - conta_atual_anual: {data.get('conta_atual_anual', 'N/A')}")
        print(f"   - anos_payback: {data.get('anos_payback', 'N/A')}")
        print(f"   - gasto_acumulado_payback: {data.get('gasto_acumulado_payback', 'N/A')}")
        print(f"   - potencia_sistema: {data.get('potencia_sistema', 'N/A')}")
        print(f"   - preco_final: {data.get('preco_final', 'N/A')}")
        
        # Gerar ID único para a proposta
        proposta_id = str(uuid.uuid4())
        
        # Preparar dados da proposta
        proposta_data = {
            'id': proposta_id,
            'data_criacao': datetime.now().isoformat(),
            'cliente_nome': data.get('cliente_nome', 'Cliente'),
            'cliente_endereco': data.get('cliente_endereco', 'Endereço não informado'),
            'cliente_telefone': data.get('cliente_telefone', 'Telefone não informado'),
            'potencia_sistema': data.get('potencia_sistema', 0),
            'preco_final': data.get('preco_final', 0),
            'cidade': data.get('cidade', 'Projeto'),
            'vendedor_nome': data.get('vendedor_nome', 'Representante Comercial'),
            'vendedor_cargo': data.get('vendedor_cargo', 'Especialista em Energia Solar'),
            'vendedor_telefone': data.get('vendedor_telefone', '(11) 99999-9999'),
            'vendedor_email': data.get('vendedor_email', 'contato@empresa.com'),
            'data_proposta': datetime.now().strftime('%d/%m/%Y'),
            # Dados financeiros
            'conta_atual_anual': data.get('conta_atual_anual', 0),
            'anos_payback': data.get('anos_payback', 0),
            'gasto_acumulado_payback': data.get('gasto_acumulado_payback', 0),
            'consumo_mensal_kwh': data.get('consumo_mensal_kwh', 0),
            'tarifa_energia': data.get('tarifa_energia', 0.75),
            'economia_mensal_estimada': data.get('economia_mensal_estimada', 0),
            # Dados do kit
            'quantidade_placas': data.get('quantidade_placas', 0),
            'potencia_placa_w': data.get('potencia_placa_w', 0),
            'area_necessaria': data.get('area_necessaria', 0),
            'irradiacao_media': data.get('irradiacao_media', 5.15),
            'geracao_media_mensal': data.get('geracao_media_mensal', 0),
            'creditos_anuais': data.get('creditos_anuais', 0),
            'economia_total_25_anos': data.get('economia_total_25_anos', 0),
            'payback_meses': data.get('payback_meses', 0),
            # Custos
            'custo_total_projeto': data.get('custo_total_projeto', 0),
            'custo_equipamentos': data.get('custo_equipamentos', 0),
            'custo_instalacao': data.get('custo_instalacao', 0),
            'custo_homologacao': data.get('custo_homologacao', 0),
            'custo_outros': data.get('custo_outros', 0),
            'margem_lucro': data.get('margem_lucro', 0)
        }
        
        # Salvar dados da proposta
        proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
        with open(proposta_file, 'w', encoding='utf-8') as f:
            json.dump(proposta_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Proposta salva: {proposta_id}")
        
        return jsonify({
            'success': True,
            'proposta_id': proposta_id,
            'message': 'Proposta salva com sucesso'
        })
        
    except Exception as e:
        print(f"❌ Erro ao salvar proposta: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Erro ao salvar proposta: {str(e)}'
        }), 500

@app.route('/gerar-proposta-html/<proposta_id>', methods=['GET'])
def gerar_proposta_html(proposta_id):
    try:
        # Carregar dados da proposta
        proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
        if not proposta_file.exists():
            return jsonify({
                'success': False,
                'message': 'Proposta não encontrada'
            }), 404
        
        with open(proposta_file, 'r', encoding='utf-8') as f:
            proposta_data = json.load(f)
        
        # Carregar template HTML
        template_path = Path(__file__).parent / "public" / "template.html"
        if not template_path.exists():
            return jsonify({
                'success': False,
                'message': 'Template não encontrado'
            }), 404
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template_html = f.read()
        
        # Substituir todas as variáveis {{}} no template
        template_html = template_html.replace('{{cliente_nome}}', proposta_data.get('cliente_nome', 'Cliente'))
        template_html = template_html.replace('{{cliente_endereco}}', proposta_data.get('cliente_endereco', 'Endereço não informado'))
        template_html = template_html.replace('{{cliente_telefone}}', proposta_data.get('cliente_telefone', 'Telefone não informado'))
        template_html = template_html.replace('{{potencia_sistema}}', str(proposta_data.get('potencia_sistema', 0)))
        template_html = template_html.replace('{{potencia_sistema_kwp}}', f"{proposta_data.get('potencia_sistema', 0):.2f}")
        template_html = template_html.replace('{{preco_final}}', f"R$ {proposta_data.get('preco_final', 0):,.2f}")
        template_html = template_html.replace('{{cidade}}', proposta_data.get('cidade', 'Projeto'))
        template_html = template_html.replace('{{vendedor_nome}}', proposta_data.get('vendedor_nome', 'Representante Comercial'))
        template_html = template_html.replace('{{vendedor_cargo}}', proposta_data.get('vendedor_cargo', 'Especialista em Energia Solar'))
        template_html = template_html.replace('{{vendedor_telefone}}', proposta_data.get('vendedor_telefone', '(11) 99999-9999'))
        template_html = template_html.replace('{{vendedor_email}}', proposta_data.get('vendedor_email', 'contato@empresa.com'))
        template_html = template_html.replace('{{data_proposta}}', proposta_data.get('data_proposta', datetime.now().strftime('%d/%m/%Y')))
        
        # Substituir variáveis financeiras
        template_html = template_html.replace('{{conta_atual_anual}}', f"R$ {proposta_data.get('conta_atual_anual', 0):,.2f}")
        template_html = template_html.replace('{{anos_payback}}', str(proposta_data.get('anos_payback', 0)))
        template_html = template_html.replace('{{gasto_acumulado_payback}}', f"R$ {proposta_data.get('gasto_acumulado_payback', 0):,.2f}")
        template_html = template_html.replace('{{consumo_mensal_kwh}}', str(int(proposta_data.get('consumo_mensal_kwh', 0))))
        template_html = template_html.replace('{{tarifa_energia}}', f"{proposta_data.get('tarifa_energia', 0.75):.3f}")
        template_html = template_html.replace('{{economia_mensal_estimada}}', f"R$ {proposta_data.get('economia_mensal_estimada', 0):,.2f}")
        
        # Substituir variáveis do kit
        template_html = template_html.replace('{{quantidade_placas}}', str(proposta_data.get('quantidade_placas', 0)))
        template_html = template_html.replace('{{potencia_placa_w}}', str(proposta_data.get('potencia_placa_w', 0)))
        template_html = template_html.replace('{{area_necessaria}}', str(proposta_data.get('area_necessaria', 0)))
        template_html = template_html.replace('{{irradiacao_media}}', f"{proposta_data.get('irradiacao_media', 5.15):.2f}")
        template_html = template_html.replace('{{geracao_media_mensal}}', f"{proposta_data.get('geracao_media_mensal', 0):.0f}")
        template_html = template_html.replace('{{creditos_anuais}}', f"R$ {proposta_data.get('creditos_anuais', 0):,.2f}")
        template_html = template_html.replace('{{economia_total_25_anos}}', f"R$ {proposta_data.get('economia_total_25_anos', 0):,.2f}")
        template_html = template_html.replace('{{payback_meses}}', str(proposta_data.get('payback_meses', 0)))
        
        # Substituir variáveis de custos
        template_html = template_html.replace('{{custo_total_projeto}}', f"R$ {proposta_data.get('custo_total_projeto', 0):,.2f}")
        template_html = template_html.replace('{{custo_equipamentos}}', f"R$ {proposta_data.get('custo_equipamentos', 0):,.2f}")
        template_html = template_html.replace('{{custo_instalacao}}', f"R$ {proposta_data.get('custo_instalacao', 0):,.2f}")
        template_html = template_html.replace('{{custo_homologacao}}', f"R$ {proposta_data.get('custo_homologacao', 0):,.2f}")
        template_html = template_html.replace('{{custo_outros}}', f"R$ {proposta_data.get('custo_outros', 0):,.2f}")
        template_html = template_html.replace('{{margem_lucro}}', f"R$ {proposta_data.get('margem_lucro', 0):,.2f}")
        
        # ====== SLIDE 03 - GRÁFICO DE BARRAS (Cenário Atual) ======
        # Alturas das barras (percentuais para CSS)
        template_html = template_html.replace('{{altura_barra_ano_1}}', str(proposta_data.get('altura_barra_ano_1', 10)))
        template_html = template_html.replace('{{altura_barra_ano_5}}', str(proposta_data.get('altura_barra_ano_5', 25)))
        template_html = template_html.replace('{{altura_barra_ano_10}}', str(proposta_data.get('altura_barra_ano_10', 50)))
        template_html = template_html.replace('{{altura_barra_ano_15}}', str(proposta_data.get('altura_barra_ano_15', 75)))
        template_html = template_html.replace('{{altura_barra_ano_20}}', str(proposta_data.get('altura_barra_ano_20', 90)))
        template_html = template_html.replace('{{altura_barra_ano_25}}', str(proposta_data.get('altura_barra_ano_25', 100)))
        
        # Valores das contas por ano
        template_html = template_html.replace('{{conta_ano_1}}', f"R$ {proposta_data.get('conta_ano_1', proposta_data.get('conta_atual_anual', 0)):,.2f}")
        template_html = template_html.replace('{{conta_ano_5}}', f"R$ {proposta_data.get('conta_ano_5', proposta_data.get('conta_atual_anual', 0) * 1.4):,.2f}")
        template_html = template_html.replace('{{conta_ano_10}}', f"R$ {proposta_data.get('conta_ano_10', proposta_data.get('conta_atual_anual', 0) * 2.0):,.2f}")
        template_html = template_html.replace('{{conta_ano_15}}', f"R$ {proposta_data.get('conta_ano_15', proposta_data.get('conta_atual_anual', 0) * 2.8):,.2f}")
        template_html = template_html.replace('{{conta_ano_20}}', f"R$ {proposta_data.get('conta_ano_20', proposta_data.get('conta_atual_anual', 0) * 3.9):,.2f}")
        template_html = template_html.replace('{{conta_ano_25}}', f"R$ {proposta_data.get('conta_ano_25', proposta_data.get('conta_atual_anual', 0) * 5.4):,.2f}")
        
        # ====== SLIDE 04 - EVOLUÇÃO DA CONTA ======
        template_html = template_html.replace('{{conta_futura_25_anos}}', f"R$ {proposta_data.get('conta_futura_25_anos', proposta_data.get('conta_atual_anual', 0) * 5.4):,.2f}")
        template_html = template_html.replace('{{valor_maximo}}', f"R$ {proposta_data.get('valor_maximo', proposta_data.get('conta_atual_anual', 0) * 5.4):,.2f}")
        template_html = template_html.replace('{{valor_medio}}', f"R$ {proposta_data.get('valor_medio', proposta_data.get('conta_atual_anual', 0) * 2.7):,.2f}")
        template_html = template_html.replace('{{valor_minimo}}', f"R$ {proposta_data.get('valor_minimo', proposta_data.get('conta_atual_anual', 0)):,.2f}")
        
        # ====== SLIDE 06 - ECONOMIA ======
        template_html = template_html.replace('{{valor_maximo_economia}}', f"R$ {proposta_data.get('valor_maximo_economia', proposta_data.get('economia_total_25_anos', 0)):,.2f}")
        template_html = template_html.replace('{{valor_medio_economia}}', f"R$ {proposta_data.get('valor_medio_economia', proposta_data.get('economia_total_25_anos', 0) / 2):,.2f}")
        template_html = template_html.replace('{{valor_minimo_economia}}', f"R$ {proposta_data.get('valor_minimo_economia', 0):,.2f}")
        
        # Posição do payback no gráfico
        payback_anos = proposta_data.get('anos_payback', 0)
        posicao_payback = min(100, (payback_anos / 25) * 100) if payback_anos > 0 else 0
        template_html = template_html.replace('{{posicao_payback}}', str(posicao_payback))
        template_html = template_html.replace('{{altura_payback}}', str(50))  # Altura fixa para o ponto de payback
        
        # Valores de economia por ano
        economia_anual_base = proposta_data.get('economia_mensal_estimada', 0) * 12
        template_html = template_html.replace('{{economia_ano_1}}', f"R$ {proposta_data.get('economia_ano_1', economia_anual_base):,.2f}")
        template_html = template_html.replace('{{economia_ano_5}}', f"R$ {proposta_data.get('economia_ano_5', economia_anual_base * 5):,.2f}")
        template_html = template_html.replace('{{economia_ano_10}}', f"R$ {proposta_data.get('economia_ano_10', economia_anual_base * 10):,.2f}")
        template_html = template_html.replace('{{economia_ano_15}}', f"R$ {proposta_data.get('economia_ano_15', economia_anual_base * 15):,.2f}")
        template_html = template_html.replace('{{economia_ano_20}}', f"R$ {proposta_data.get('economia_ano_20', economia_anual_base * 20):,.2f}")
        template_html = template_html.replace('{{economia_ano_25}}', f"R$ {proposta_data.get('economia_ano_25', proposta_data.get('economia_total_25_anos', 0)):,.2f}")
        
        # Alturas das barras de economia (percentuais)
        economia_total = proposta_data.get('economia_total_25_anos', 1)
        if economia_total <= 0:
            economia_total = 1  # Evitar divisão por zero
        
        template_html = template_html.replace('{{altura_economia_ano_5}}', str(int((economia_anual_base * 5 / economia_total) * 100)))
        template_html = template_html.replace('{{altura_economia_ano_10}}', str(int((economia_anual_base * 10 / economia_total) * 100)))
        template_html = template_html.replace('{{altura_economia_ano_15}}', str(int((economia_anual_base * 15 / economia_total) * 100)))
        template_html = template_html.replace('{{altura_economia_ano_20}}', str(int((economia_anual_base * 20 / economia_total) * 100)))
        template_html = template_html.replace('{{altura_economia_ano_25}}', str(100))  # Sempre 100% para o ano 25
        
        # ====== SLIDE 05 - GRÁFICO MENSAL ======
        # Alturas das barras mensais (produção e consumo)
        geracao_mensal = proposta_data.get('geracao_media_mensal', 0)
        consumo_mensal = proposta_data.get('consumo_mensal_kwh', 0)
        
        # Alturas de produção mensal (baseadas na irradiação média)
        template_html = template_html.replace('{{altura_producao_jan}}', str(int(geracao_mensal * 0.8)))
        template_html = template_html.replace('{{altura_producao_fev}}', str(int(geracao_mensal * 0.7)))
        template_html = template_html.replace('{{altura_producao_mar}}', str(int(geracao_mensal * 0.8)))
        template_html = template_html.replace('{{altura_producao_abr}}', str(int(geracao_mensal * 0.7)))
        template_html = template_html.replace('{{altura_producao_mai}}', str(int(geracao_mensal * 0.6)))
        template_html = template_html.replace('{{altura_producao_jun}}', str(int(geracao_mensal * 0.5)))
        template_html = template_html.replace('{{altura_producao_jul}}', str(int(geracao_mensal * 0.6)))
        template_html = template_html.replace('{{altura_producao_ago}}', str(int(geracao_mensal * 0.7)))
        template_html = template_html.replace('{{altura_producao_set}}', str(int(geracao_mensal * 0.8)))
        template_html = template_html.replace('{{altura_producao_out}}', str(int(geracao_mensal * 0.9)))
        template_html = template_html.replace('{{altura_producao_nov}}', str(int(geracao_mensal * 0.9)))
        template_html = template_html.replace('{{altura_producao_dez}}', str(int(geracao_mensal * 1.0)))
        
        # Alturas de consumo mensal (constante)
        template_html = template_html.replace('{{altura_consumo_jan}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_fev}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_mar}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_abr}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_mai}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_jun}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_jul}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_ago}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_set}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_out}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_nov}}', str(int(consumo_mensal)))
        template_html = template_html.replace('{{altura_consumo_dez}}', str(int(consumo_mensal)))
        
        # ====== SLIDE 07 - CRONOGRAMA ======
        template_html = template_html.replace('{{data_aprovacao}}', proposta_data.get('data_aprovacao', '15 dias'))
        template_html = template_html.replace('{{data_validacao}}', proposta_data.get('data_validacao', '30 dias'))
        template_html = template_html.replace('{{data_contrato}}', proposta_data.get('data_contrato', '45 dias'))
        template_html = template_html.replace('{{data_equipamentos}}', proposta_data.get('data_equipamentos', '60 dias'))
        template_html = template_html.replace('{{data_montagem}}', proposta_data.get('data_montagem', '75 dias'))
        template_html = template_html.replace('{{data_conclusao}}', proposta_data.get('data_conclusao', '90 dias'))
        
        # ====== SLIDE 08 - COMPARAÇÃO FINANCEIRA ======
        template_html = template_html.replace('{{gasto_total_25_anos}}', f"R$ {proposta_data.get('gasto_total_25_anos', proposta_data.get('conta_atual_anual', 0) * 25):,.2f}")
        template_html = template_html.replace('{{economia_mensal}}', f"R$ {proposta_data.get('economia_mensal', proposta_data.get('economia_mensal_estimada', 0)):,.2f}")
        template_html = template_html.replace('{{payback_anos}}', str(proposta_data.get('payback_anos', proposta_data.get('anos_payback', 0))))
        
        # Valores do gráfico de comparação
        template_html = template_html.replace('{{valor_maximo_grafico}}', f"R$ {proposta_data.get('valor_maximo_grafico', proposta_data.get('conta_atual_anual', 0) * 5.4):,.2f}")
        template_html = template_html.replace('{{valor_medio_grafico}}', f"R$ {proposta_data.get('valor_medio_grafico', proposta_data.get('conta_atual_anual', 0) * 2.7):,.2f}")
        template_html = template_html.replace('{{valor_minimo_grafico}}', f"R$ {proposta_data.get('valor_minimo_grafico', proposta_data.get('conta_atual_anual', 0)):,.2f}")
        
        # Gastos sem solar por ano
        conta_anual = proposta_data.get('conta_atual_anual', 0)
        template_html = template_html.replace('{{gasto_ano_1_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_1_sem_solar', conta_anual):,.2f}")
        template_html = template_html.replace('{{gasto_ano_5_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_5_sem_solar', conta_anual * 1.4):,.2f}")
        template_html = template_html.replace('{{gasto_ano_10_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_10_sem_solar', conta_anual * 2.0):,.2f}")
        template_html = template_html.replace('{{gasto_ano_15_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_15_sem_solar', conta_anual * 2.8):,.2f}")
        template_html = template_html.replace('{{gasto_ano_20_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_20_sem_solar', conta_anual * 3.9):,.2f}")
        template_html = template_html.replace('{{gasto_ano_25_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_25_sem_solar', conta_anual * 5.4):,.2f}")
        
        # ====== SLIDE 09 - COMPARATIVO FINANCEIRO (Variáveis Faltantes) ======
        # Altura do investimento inicial no gráfico
        investimento_inicial = proposta_data.get('preco_final', 0)
        altura_investimento = min(100, (investimento_inicial / (conta_anual * 5.4)) * 100) if conta_anual > 0 else 0
        template_html = template_html.replace('{{altura_investimento}}', str(int(altura_investimento)))
        
        # Gastos com energia solar por ano (após payback, apenas manutenção)
        template_html = template_html.replace('{{gasto_ano_1_com_solar}}', f"R$ {proposta_data.get('gasto_ano_1_com_solar', investimento_inicial):,.2f}")
        template_html = template_html.replace('{{gasto_ano_5_com_solar}}', f"R$ {proposta_data.get('gasto_ano_5_com_solar', investimento_inicial + 500):,.2f}")
        template_html = template_html.replace('{{gasto_ano_10_com_solar}}', f"R$ {proposta_data.get('gasto_ano_10_com_solar', investimento_inicial + 1000):,.2f}")
        template_html = template_html.replace('{{gasto_ano_15_com_solar}}', f"R$ {proposta_data.get('gasto_ano_15_com_solar', investimento_inicial + 1500):,.2f}")
        template_html = template_html.replace('{{gasto_ano_20_com_solar}}', f"R$ {proposta_data.get('gasto_ano_20_com_solar', investimento_inicial + 2000):,.2f}")
        template_html = template_html.replace('{{gasto_ano_25_com_solar}}', f"R$ {proposta_data.get('gasto_ano_25_com_solar', investimento_inicial + 2500):,.2f}")
        
        # Alturas das barras com energia solar (percentuais)
        gasto_maximo = conta_anual * 5.4
        template_html = template_html.replace('{{altura_ano_5_com_solar}}', str(int(((investimento_inicial + 500) / gasto_maximo) * 100)))
        template_html = template_html.replace('{{altura_ano_10_com_solar}}', str(int(((investimento_inicial + 1000) / gasto_maximo) * 100)))
        template_html = template_html.replace('{{altura_ano_15_com_solar}}', str(int(((investimento_inicial + 1500) / gasto_maximo) * 100)))
        template_html = template_html.replace('{{altura_ano_20_com_solar}}', str(int(((investimento_inicial + 2000) / gasto_maximo) * 100)))
        template_html = template_html.replace('{{altura_ano_25_com_solar}}', str(int(((investimento_inicial + 2500) / gasto_maximo) * 100)))
        
        print(f"✅ Proposta HTML gerada: {proposta_id}")
        print(f"📊 Variáveis substituídas:")
        print(f"   - conta_atual_anual: {proposta_data.get('conta_atual_anual', 0)}")
        print(f"   - anos_payback: {proposta_data.get('anos_payback', 0)}")
        print(f"   - gasto_acumulado_payback: {proposta_data.get('gasto_acumulado_payback', 0)}")
        print(f"   - economia_mensal_estimada: {proposta_data.get('economia_mensal_estimada', 0)}")
        print(f"   - potencia_sistema: {proposta_data.get('potencia_sistema', 0)}")
        print(f"   - preco_final: {proposta_data.get('preco_final', 0)}")
        
        # Contar quantas variáveis {{}} ainda restam no template
        import re
        variaveis_restantes = re.findall(r'\{\{[^}]+\}\}', template_html)
        print(f"🔍 Variáveis {{}} ainda não substituídas: {len(variaveis_restantes)}")
        if variaveis_restantes:
            print(f"   Primeiras 10: {variaveis_restantes[:10]}")
        
        return jsonify({
            'success': True,
            'proposta_id': proposta_id,
            'html_content': template_html,
            'message': 'Proposta HTML gerada com sucesso'
        })
    
    except Exception as e:
        print(f"❌ Erro ao gerar proposta HTML: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Erro ao gerar proposta HTML: {str(e)}'
        }), 500

@app.route('/proposta/<proposta_id>', methods=['GET'])
def visualizar_proposta(proposta_id):
    try:
        # Carregar dados da proposta
        proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
        if not proposta_file.exists():
            return jsonify({
                'success': False,
                'message': 'Proposta não encontrada'
            }), 404
        
        with open(proposta_file, 'r', encoding='utf-8') as f:
            proposta_data = json.load(f)
        
        # Carregar template HTML
        template_path = Path(__file__).parent / "public" / "template.html"
        if not template_path.exists():
            return jsonify({
                'success': False,
                'message': 'Template não encontrado'
            }), 404
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template_html = f.read()
        
        # Substituir todas as variáveis {{}} no template (mesmo código acima)
        template_html = template_html.replace('{{cliente_nome}}', proposta_data.get('cliente_nome', 'Cliente'))
        template_html = template_html.replace('{{cliente_endereco}}', proposta_data.get('cliente_endereco', 'Endereço não informado'))
        template_html = template_html.replace('{{cliente_telefone}}', proposta_data.get('cliente_telefone', 'Telefone não informado'))
        template_html = template_html.replace('{{potencia_sistema}}', str(proposta_data.get('potencia_sistema', 0)))
        template_html = template_html.replace('{{potencia_sistema_kwp}}', f"{proposta_data.get('potencia_sistema', 0):.2f}")
        template_html = template_html.replace('{{preco_final}}', f"R$ {proposta_data.get('preco_final', 0):,.2f}")
        template_html = template_html.replace('{{cidade}}', proposta_data.get('cidade', 'Projeto'))
        template_html = template_html.replace('{{vendedor_nome}}', proposta_data.get('vendedor_nome', 'Representante Comercial'))
        template_html = template_html.replace('{{vendedor_cargo}}', proposta_data.get('vendedor_cargo', 'Especialista em Energia Solar'))
        template_html = template_html.replace('{{vendedor_telefone}}', proposta_data.get('vendedor_telefone', '(11) 99999-9999'))
        template_html = template_html.replace('{{vendedor_email}}', proposta_data.get('vendedor_email', 'contato@empresa.com'))
        template_html = template_html.replace('{{data_proposta}}', proposta_data.get('data_proposta', datetime.now().strftime('%d/%m/%Y')))
        
        # Substituir variáveis financeiras
        template_html = template_html.replace('{{conta_atual_anual}}', f"R$ {proposta_data.get('conta_atual_anual', 0):,.2f}")
        template_html = template_html.replace('{{anos_payback}}', str(proposta_data.get('anos_payback', 0)))
        template_html = template_html.replace('{{gasto_acumulado_payback}}', f"R$ {proposta_data.get('gasto_acumulado_payback', 0):,.2f}")
        template_html = template_html.replace('{{consumo_mensal_kwh}}', str(int(proposta_data.get('consumo_mensal_kwh', 0))))
        template_html = template_html.replace('{{tarifa_energia}}', f"{proposta_data.get('tarifa_energia', 0.75):.3f}")
        template_html = template_html.replace('{{economia_mensal_estimada}}', f"R$ {proposta_data.get('economia_mensal_estimada', 0):,.2f}")
        
        # Substituir variáveis do kit
        template_html = template_html.replace('{{quantidade_placas}}', str(proposta_data.get('quantidade_placas', 0)))
        template_html = template_html.replace('{{potencia_placa_w}}', str(proposta_data.get('potencia_placa_w', 0)))
        template_html = template_html.replace('{{area_necessaria}}', str(proposta_data.get('area_necessaria', 0)))
        template_html = template_html.replace('{{irradiacao_media}}', f"{proposta_data.get('irradiacao_media', 5.15):.2f}")
        template_html = template_html.replace('{{geracao_media_mensal}}', f"{proposta_data.get('geracao_media_mensal', 0):.0f}")
        template_html = template_html.replace('{{creditos_anuais}}', f"R$ {proposta_data.get('creditos_anuais', 0):,.2f}")
        template_html = template_html.replace('{{economia_total_25_anos}}', f"R$ {proposta_data.get('economia_total_25_anos', 0):,.2f}")
        template_html = template_html.replace('{{payback_meses}}', str(proposta_data.get('payback_meses', 0)))
        
        # Substituir variáveis de custos
        template_html = template_html.replace('{{custo_total_projeto}}', f"R$ {proposta_data.get('custo_total_projeto', 0):,.2f}")
        template_html = template_html.replace('{{custo_equipamentos}}', f"R$ {proposta_data.get('custo_equipamentos', 0):,.2f}")
        template_html = template_html.replace('{{custo_instalacao}}', f"R$ {proposta_data.get('custo_instalacao', 0):,.2f}")
        template_html = template_html.replace('{{custo_homologacao}}', f"R$ {proposta_data.get('custo_homologacao', 0):,.2f}")
        template_html = template_html.replace('{{custo_outros}}', f"R$ {proposta_data.get('custo_outros', 0):,.2f}")
        template_html = template_html.replace('{{margem_lucro}}', f"R$ {proposta_data.get('margem_lucro', 0):,.2f}")
        
        return template_html
        
    except Exception as e:
        print(f"❌ Erro ao visualizar proposta: {str(e)}")
        return f"<html><body><h1>Erro ao carregar proposta: {str(e)}</h1></body></html>", 500

# Endpoint antigo removido - agora usamos apenas os endpoints HTML

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Servidor Python funcionando'})

if __name__ == '__main__':
    print("🚀 Iniciando servidor Python para geração de propostas HTML...")
    print(f"📁 Diretório de propostas: {PROPOSTAS_DIR}")
    print(f"📁 Template HTML: {(Path(__file__).parent / 'public' / 'template.html').exists()}")
    
    app.run(host='0.0.0.0', port=8000, debug=True)
