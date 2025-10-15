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
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Caminho para o script proposta_solar
PROPOSTA_SOLAR_PATH = Path(__file__).parent / "proposta_solar"

# Adicionar o caminho do módulo ao sys.path
sys.path.insert(0, str(PROPOSTA_SOLAR_PATH / "src"))

# Importar a função principal
from proposta_solar.presentation import main_dados_diretos

@app.route('/gerar-proposta', methods=['POST'])
def gerar_proposta():
    try:
        data = request.get_json()
        dados_projeto = data.get('dadosProjeto', {})
        projecoes_financeiras = data.get('projecoesFinanceiras', {})
        
        print(f"📊 Recebidos dados do projeto: {dados_projeto}")
        print(f"📊 Projeções financeiras: {projecoes_financeiras}")
        
        # Caminho para o template PPT
        template_path = PROPOSTA_SOLAR_PATH / "templates" / "modelo.pptx"
        
        # Caminho de saída
        output_dir = PROPOSTA_SOLAR_PATH / "output"
        output_dir.mkdir(exist_ok=True)
        
        output_ppt = output_dir / f"proposta_{dados_projeto.get('cliente', 'cliente')}.pptx"
        
        print(f"🚀 Gerando proposta usando dados diretos...")
        print(f"📁 Template: {template_path}")
        print(f"📁 Saída: {output_ppt}")
        
        # Usar a nova função que aceita dados diretos
        success, message, ppt_path, pdf_path = main_dados_diretos(
            dados_projeto=dados_projeto,
            projecoes_financeiras=projecoes_financeiras,
            template_path=str(template_path),
            output_path=str(output_ppt),
            verbose=True,
            save_pdf=True
        )
        
        if not success:
            print(f"❌ Erro ao gerar proposta: {message}")
            return jsonify({
                'success': False,
                'message': f'Erro ao gerar proposta: {message}'
            }), 500
        
        print(f"✅ Proposta gerada com sucesso!")
        
        response_data = {'success': True, 'message': message}
        
        # Converter PPT para base64
        if ppt_path and os.path.exists(ppt_path):
            with open(ppt_path, 'rb') as f:
                ppt_base64 = base64.b64encode(f.read()).decode('utf-8')
                response_data['pptBase64'] = ppt_base64
        
        # Converter PDF para base64
        if pdf_path and os.path.exists(pdf_path):
            with open(pdf_path, 'rb') as f:
                pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
                response_data['pdfBase64'] = pdf_base64
        
        return jsonify(response_data)
    
    except Exception as e:
        print(f"❌ Erro geral: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Erro interno: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Servidor Python funcionando'})

if __name__ == '__main__':
    print("🚀 Iniciando servidor Python para geração de propostas...")
    print(f"📁 Caminho proposta_solar: {PROPOSTA_SOLAR_PATH}")
    print(f"📁 Template existe: {(PROPOSTA_SOLAR_PATH / 'templates' / 'modelo.pptx').exists()}")
    
    app.run(host='0.0.0.0', port=8000, debug=True)
