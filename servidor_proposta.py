#!/usr/bin/env python3
"""
Servidor Python para gerar propostas PPT usando o script proposta_solar
"""

import os
import sys
import json
import base64
import tempfile
import re
import subprocess
import uuid
import math
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend (deve ser antes do pyplot)
import matplotlib.pyplot as plt
import io
import numpy as np
import pandas as pd
import re
import time
#
from calculadora_solar import CalculadoraSolar, DadosProjeto
from db import init_db, SessionLocal, PropostaDB, ClienteDB, EnderecoDB, UserDB
# WeasyPrint comentado - requer: brew install cairo pango gdk-pixbuf libffi
# from weasyprint import HTML, CSS
# from weasyprint.text.fonts import FontConfiguration
from analise_financeira import calcular_tabelas as af_calcular_tabelas
from analise_financeira import gerar_graficos_base64 as af_gerar_graficos_base64
from analise_financeira import irradiancia_mensal_kwh_m2_dia_ex as af_irr_mensal_ex
import requests
from datetime import date
#
# Firebase Admin (opcional, para gerenciar usuários do Auth)
FIREBASE_ADMIN_AVAILABLE = False
try:
    import firebase_admin
    from firebase_admin import auth as fb_auth
    from firebase_admin import credentials as fb_credentials
    if not firebase_admin._apps:
        cred = None
        # Usa credenciais do ambiente (GOOGLE_APPLICATION_CREDENTIALS) se existir,
        # senão tenta inicializar sem parâmetros (ADC)
        try:
            sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            if sa_path and os.path.exists(sa_path):
                cred = fb_credentials.Certificate(sa_path)
        except Exception:
            cred = None
        # Fallback: procurar arquivo de service account no diretório do projeto
        if cred is None:
            try:
                base_dir = Path(__file__).parent
                # Candidatos comuns de nome de arquivo
                candidates = [
                    base_dir / "service-account.json",
                    base_dir / "firebase-admin.json",
                    base_dir / "fohat-energia-3c422e081e0e.json",
                ]
                for c in candidates:
                    if c.exists():
                        cred = fb_credentials.Certificate(str(c))
                        print(f"🔑 Firebase Admin: carregando credenciais de {c}")
                        break
                # Se ainda não encontrou, varrer *.json à procura de 'type: service_account'
                if cred is None:
                    for f in base_dir.glob("*.json"):
                        try:
                            with open(f, "r", encoding="utf-8") as fh:
                                text = fh.read(2048)  # leitura parcial é suficiente
                                if '"type": "service_account"' in text or "'type': 'service_account'" in text:
                                    cred = fb_credentials.Certificate(str(f))
                                    print(f"🔑 Firebase Admin: detectado arquivo de service account: {f}")
                                    break
                        except Exception:
                            continue
            except Exception as e:
                print(f"⚠️ Falha ao procurar credenciais do Firebase Admin: {e}")
        try:
            firebase_admin.initialize_app(cred)
            FIREBASE_ADMIN_AVAILABLE = True
            print("✅ Firebase Admin inicializado")
        except Exception as e:
            print(f"⚠️ Não foi possível inicializar Firebase Admin: {e}")
            FIREBASE_ADMIN_AVAILABLE = False
    else:
        FIREBASE_ADMIN_AVAILABLE = True
except Exception as e:
    print(f"ℹ️ Firebase Admin indisponível (instale firebase-admin se precisar): {e}")
    FIREBASE_ADMIN_AVAILABLE = False

app = Flask(__name__)
CORS(app)

@app.after_request
def add_security_headers(response):
    # Permitir embed em iframe a partir de origens diferentes (frontend porta 3003)
    response.headers['X-Frame-Options'] = 'ALLOWALL'
    # Flexível para testes locais; ajuste conforme necessidade de segurança
    response.headers['Content-Security-Policy'] = "frame-ancestors *"
    return response

# Servidor para propostas HTML (sem dependência do proposta_solar)

# Diretório para salvar propostas
PROPOSTAS_DIR = Path(__file__).parent / "propostas"
PROPOSTAS_DIR.mkdir(exist_ok=True)

# Diretório para salvar PDFs
PDFS_DIR = Path(__file__).parent / "propostas" / "pdfs"
PDFS_DIR.mkdir(parents=True, exist_ok=True)

# Diretório/arquivo para papéis (roles) de usuários
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
ROLES_FILE = DATA_DIR / "users_roles.json"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def format_brl(value) -> str:
    """Formata valor em BRL como R$ 0.000,00."""
    try:
        v = float(value)
    except Exception:
        try:
            v = float(str(value).replace('R$', '').replace('.', '').replace(',', '.').strip())
        except Exception:
            return f"R$ {value}"
    s = f"R$ {v:,.2f}"
    # Converter estilo en-US para pt-BR
    return s.replace(',', 'X').replace('.', ',').replace('X', '.')
TAXAS_FILE = DATA_DIR / "taxas_distribuicao.json"

def _load_roles() -> dict:
    try:
        if ROLES_FILE.exists():
            with open(ROLES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
    except Exception as e:
        print(f"⚠️ Falha ao carregar roles: {e}")
    return {}

def _save_roles(mapping: dict) -> None:
    try:
        with open(ROLES_FILE, "w", encoding="utf-8") as f:
            json.dump(mapping, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Falha ao salvar roles: {e}")

def _slug(s: str) -> str:
    return ''.join(ch.lower() if ch.isalnum() else '_' for ch in (s or '')).strip('_')

def _load_taxas() -> dict:
    if TAXAS_FILE.exists():
        try:
            with open(TAXAS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def _save_taxas(mapping: dict) -> None:
    with open(TAXAS_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

def _calcular_disponibilidade(te_rskwh: float, tusd_rskwh: float, tipo: str) -> float:
    # Custo de disponibilidade (Grupo B, RN 1000): mono 30 kWh; bi 50; tri 100
    kwh_min = 30 if tipo == "monofasica" else 50 if tipo == "bifasica" else 100
    return float(kwh_min) * (float(te_rskwh) + float(tusd_rskwh))

def _fetch_estrutura_tarifaria_aneel() -> list[dict]:
    url = "https://dados.aneel.gov.br/dataset/estrutura-tarifaria/resource/6f7bd2f1-1a0a-4b3a-9d4f-0cefa5f46ccf/download/estrutura_tarifaria_grupo_b.csv"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    # csv -> linhas
    import csv, io
    reader = csv.DictReader(io.StringIO(r.text), delimiter=';')
    return list(reader)

def _atualizar_taxas_distribuicao():
    rows = _fetch_estrutura_tarifaria_aneel()
    # mapear colunas possíveis
    def pick(row, keys):
        for k in keys:
            if k in row and row[k]:
                return row[k]
        return ""
    taxa_map = _load_taxas()
    for row in rows:
        nome = pick(row, ["Distribuidora", "Empresa", "Concessionaria", "Empreendimento"]).strip()
        classe = pick(row, [k for k in row.keys() if "classe" in k.lower()]).lower()
        if not nome or "resid" not in classe or "b1" not in classe:
            continue
        # TE/TUSD em R$/MWh -> R$/kWh
        te = pick(row, [k for k in row.keys() if "te" in k.lower() and "r$" in k.lower()])
        tusd = pick(row, [k for k in row.keys() if "tusd" in k.lower() and "r$" in k.lower()])
        try:
            te_kwh = float(str(te).replace(',', '.')) / 1000.0
            tusd_kwh = float(str(tusd).replace(',', '.')) / 1000.0
        except Exception:
            continue
        slug = _slug(nome)
        taxa_map[slug] = {
            "nome": nome,
            "monofasica": round(_calcular_disponibilidade(te_kwh, tusd_kwh, "monofasica"), 2),
            "bifasica": round(_calcular_disponibilidade(te_kwh, tusd_kwh, "bifasica"), 2),
            "trifasica": round(_calcular_disponibilidade(te_kwh, tusd_kwh, "trifasica"), 2),
            "fonte": "ANEEL: Estrutura Tarifária Grupo B (TE/TUSD sem impostos)"
        }
    _save_taxas(taxa_map)
    return taxa_map

def convert_image_to_base64(image_path):
    """Converte uma imagem para base64"""
    try:
        full_path = Path(__file__).parent / "public" / image_path.lstrip('/')
        if not full_path.exists():
            print(f"⚠️ Imagem não encontrada: {full_path}")
            return None
        
        with open(full_path, 'rb') as img_file:
            img_data = img_file.read()
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            
            # Determinar o tipo MIME baseado na extensão
            if image_path.endswith('.svg'):
                mime_type = 'image/svg+xml'
            elif image_path.endswith('.png'):
                mime_type = 'image/png'
            elif image_path.endswith('.jpg') or image_path.endswith('.jpeg'):
                mime_type = 'image/jpeg'
            else:
                mime_type = 'image/png'
            
            return f"data:{mime_type};base64,{img_base64}"
    except Exception as e:
        print(f"❌ Erro ao converter imagem {image_path}: {e}")
        return None

def format_endereco_resumido(endereco_raw: str, cidade: str | None = None) -> str:
    """
    Formata endereço no padrão: 'rua, numero - cidade'
    A função é tolerante a endereços longos separados por vírgulas.
    """
    try:
        if not endereco_raw and not cidade:
            return 'Endereço não informado'
        endereco = endereco_raw or ''
        parts = [p.strip() for p in endereco.split(',') if p.strip()]
        rua = parts[0] if parts else ''
        numero = ''
        if len(parts) > 1:
            # escolher o primeiro trecho que contenha dígitos como número
            for p in parts[1:3]:
                if any(ch.isdigit() for ch in p):
                    numero = p.strip()
                    break
            if not numero:
                numero = parts[1].strip()
        cidade_final = (cidade or '')
        if not cidade_final:
            # tentar inferir cidade a partir das partes (geralmente penúltima)
            if len(parts) >= 2:
                possiveis = [p for p in parts if (len(p) > 2 and not p.isupper() and not any(ch.isdigit() for ch in p))]
                cidade_final = possiveis[-1] if possiveis else parts[-1]
        # montar
        if rua and numero and cidade_final:
            return f"{rua}, {numero} - {cidade_final}"
        if rua and cidade_final:
            return f"{rua} - {cidade_final}"
        return endereco or cidade_final or 'Endereço não informado'
    except Exception:
        return endereco_raw or 'Endereço não informado'

def generate_bar_chart_base64(values, labels, title="Gráfico de Barras", colors=None):
    """Gera um gráfico de barras profissional e retorna como base64"""
    try:
        # Configurar estilo profissional
        plt.style.use('default')
        plt.rcParams.update({
            'font.family': 'sans-serif',
            'font.sans-serif': ['Arial', 'DejaVu Sans', 'Liberation Sans'],
            'font.size': 11,
            'axes.titlesize': 14,
            'axes.labelsize': 12,
            'xtick.labelsize': 10,
            'ytick.labelsize': 10,
            'legend.fontsize': 10,
            'figure.titlesize': 16
        })
        
        fig, ax = plt.subplots(figsize=(10, 6), facecolor='white')
        ax.set_facecolor('white')
        
        # Cores profissionais baseadas no design da proposta
        if colors is None:
            colors = ['#2563eb', '#059669', '#dc2626', '#d97706', '#7c3aed', '#16a34a']
        
        # Criar o gráfico de barras com estilo profissional
        bars = ax.bar(labels, values, color=colors[:len(values)], alpha=0.8, 
                     edgecolor='white', linewidth=2, capsize=5, capstyle='round')
        
        # Configurações de estilo profissional
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#e2e8f0')
        ax.spines['bottom'].set_color('#e2e8f0')
        ax.spines['left'].set_linewidth(1)
        ax.spines['bottom'].set_linewidth(1)
        
        # Configurar grid
        ax.grid(True, alpha=0.1, color='#e2e8f0', linestyle='-', linewidth=0.5)
        ax.set_axisbelow(True)
        
        # Configurar título com estilo profissional
        ax.set_title(title, fontsize=16, fontweight='700', pad=25, color='#1e293b')
        
        # Configurar rótulos dos eixos
        ax.set_xlabel('Período', fontsize=12, fontweight='600', color='#374151')
        ax.set_ylabel('Valor (R$)', fontsize=12, fontweight='600', color='#374151')
        
        # Adicionar valores nas barras com estilo melhorado
        max_val = max(values) if values else 0
        for i, (bar, value) in enumerate(zip(bars, values)):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + max_val*0.02,
                   f'R$ {value:,.0f}', ha='center', va='bottom', 
                   fontsize=10, fontweight='600', color='#374151',
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='white', 
                           edgecolor='none', alpha=0.9))
        
        # Configurar ticks
        ax.tick_params(axis='x', rotation=45, colors='#6b7280', labelsize=10)
        ax.tick_params(axis='y', colors='#6b7280', labelsize=10)
        
        # Configurar formato dos valores do eixo Y
        ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'R$ {x:,.0f}'))
        
        # Configurar limites do eixo Y
        ax.set_ylim(0, max_val * 1.15)
        
        # Ajustar layout para evitar sobreposição
        plt.tight_layout()
        
        # Converter para base64 com alta qualidade
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=200, bbox_inches='tight', 
                   facecolor='white', edgecolor='none', pad_inches=0.2)
        buffer.seek(0)
        
        import base64
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        plt.close(fig)  # Liberar memória
        
        return f"data:image/png;base64,{img_base64}"
        
    except Exception as e:
        print(f"❌ Erro ao gerar gráfico de barras: {e}")
        return None

def generate_line_chart_base64(values, labels, title="Gráfico de Linha", color='#2563eb'):
    """Gera um gráfico de linha profissional e retorna como base64"""
    try:
        # Configurar estilo profissional
        plt.style.use('default')
        plt.rcParams.update({
            'font.family': 'sans-serif',
            'font.sans-serif': ['Arial', 'DejaVu Sans', 'Liberation Sans'],
            'font.size': 11,
            'axes.titlesize': 14,
            'axes.labelsize': 12,
            'xtick.labelsize': 10,
            'ytick.labelsize': 10,
            'legend.fontsize': 10,
            'figure.titlesize': 16
        })
        
        fig, ax = plt.subplots(figsize=(10, 6), facecolor='white')
        ax.set_facecolor('white')
        
        # Criar o gráfico de linha com estilo profissional
        line = ax.plot(labels, values, color=color, linewidth=3, marker='o', 
                      markersize=8, markerfacecolor='white', markeredgecolor=color, 
                      markeredgewidth=2, alpha=0.9)
        
        # Preencher área abaixo da linha com transparência
        ax.fill_between(labels, values, alpha=0.1, color=color)
        
        # Configurações de estilo profissional
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#e2e8f0')
        ax.spines['bottom'].set_color('#e2e8f0')
        ax.spines['left'].set_linewidth(1)
        ax.spines['bottom'].set_linewidth(1)
        
        # Configurar grid
        ax.grid(True, alpha=0.1, color='#e2e8f0', linestyle='-', linewidth=0.5)
        ax.set_axisbelow(True)
        
        # Configurar título com estilo profissional
        ax.set_title(title, fontsize=16, fontweight='700', pad=25, color='#1e293b')
        
        # Configurar rótulos dos eixos
        ax.set_xlabel('Período', fontsize=12, fontweight='600', color='#374151')
        ax.set_ylabel('Valor (R$)', fontsize=12, fontweight='600', color='#374151')
        
        # Adicionar valores nos pontos com estilo melhorado
        for i, (label, value) in enumerate(zip(labels, values)):
            ax.annotate(f'R$ {value:,.0f}', 
                       (label, value), 
                       textcoords="offset points", 
                       xytext=(0,15), 
                       ha='center', 
                       fontsize=9, 
                       fontweight='600',
                       color='#374151',
                       bbox=dict(boxstyle='round,pad=0.3', facecolor='white', 
                               edgecolor='none', alpha=0.9))
        
        # Configurar ticks
        ax.tick_params(axis='x', rotation=45, colors='#6b7280', labelsize=10)
        ax.tick_params(axis='y', colors='#6b7280', labelsize=10)
        
        # Configurar formato dos valores do eixo Y
        ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'R$ {x:,.0f}'))
        
        # Configurar limites do eixo Y
        ax.set_ylim(0, max(values) * 1.15)
        
        # Ajustar layout para evitar sobreposição
        plt.tight_layout()
        
        # Converter para base64 com alta qualidade
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=200, bbox_inches='tight', 
                   facecolor='white', edgecolor='none', pad_inches=0.2)
        buffer.seek(0)
        
        import base64
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        plt.close(fig)  # Liberar memória
        
        return f"data:image/png;base64,{img_base64}"
        
    except Exception as e:
        print(f"❌ Erro ao gerar gráfico de linha: {e}")
        return None

def generate_chart_file(chart_type, data, labels, title, colors=None, figsize=(20, 12), filename=None):
    """Gera gráficos usando matplotlib e salva como arquivo físico"""
    try:
        plt.style.use('default')
        fig, ax = plt.subplots(figsize=figsize)
        
        # Configurações profissionais
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#666666')
        ax.spines['bottom'].set_color('#666666')
        ax.tick_params(colors='#666666')
        
        if chart_type == 'bar':
            # Gráfico de barras
            if colors is None:
                colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b']
            
            bars = ax.bar(labels, data, color=colors[:len(data)], alpha=0.8, 
                         edgecolor='white', linewidth=2, capsize=5)
            
            # Adicionar valores nas barras
            for bar, value in zip(bars, data):
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height + max(data)*0.01,
                       f'R$ {value:,.0f}', ha='center', va='bottom', 
                       fontsize=11, fontweight='bold', color='#333333')
            
        elif chart_type == 'line':
            # Gráfico de linha
            if colors is None:
                colors = ['#1f77b4']
            
            ax.plot(labels, data, color=colors[0], linewidth=4, marker='o', 
                    markersize=10, markerfacecolor='white', markeredgecolor=colors[0], 
                    markeredgewidth=3, alpha=0.9)
            ax.fill_between(labels, data, alpha=0.15, color=colors[0])
            
            # Adicionar valores nos pontos
            for i, (label, value) in enumerate(zip(labels, data)):
                ax.annotate(f'R$ {value:,.0f}', 
                           (label, value), 
                           textcoords="offset points", 
                           xytext=(0,15), ha='center', fontsize=10, 
                           fontweight='bold', color='#333333')
        
        elif chart_type == 'dual_bar':
            # Gráfico de barras duplas (produção vs consumo)
            if colors is None:
                colors = ['#2ca02c', '#d62728']  # Verde para produção, vermelho para consumo
            
            x = np.arange(len(labels))
            width = 0.35
            
            bars1 = ax.bar(x - width/2, data[0], width, label='Produção', color=colors[0], alpha=0.8)
            bars2 = ax.bar(x + width/2, data[1], width, label='Consumo', color=colors[1], alpha=0.8)
            
            ax.set_xlabel('Meses', fontsize=12, color='#333333')
            ax.set_ylabel('kWh', fontsize=12, color='#333333')
            ax.set_title(title, fontsize=16, fontweight='bold', color='#333333', pad=20)
            ax.set_xticks(x)
            ax.set_xticklabels(labels)
            ax.legend(fontsize=11)
            
            # Adicionar valores nas barras
            for bars in [bars1, bars2]:
                for bar in bars:
                    height = bar.get_height()
                    ax.text(bar.get_x() + bar.get_width()/2., height + max(max(data[0]), max(data[1]))*0.01,
                           f'{height:.0f}', ha='center', va='bottom', fontsize=9, fontweight='bold')
        
        # Configurações comuns
        ax.set_title(title, fontsize=18, fontweight='bold', pad=25, color='#333333')
        ax.set_ylabel('Valor (R$)', fontsize=14, color='#333333')
        ax.set_xlabel('Período', fontsize=14, color='#333333')
        ax.grid(True, alpha=0.3, color='#cccccc')
        
        # Formatação do eixo Y
        ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'R$ {x:,.0f}'))
        
        # Melhorar aparência dos rótulos
        ax.tick_params(axis='x', labelsize=11, colors='#333333')
        ax.tick_params(axis='y', labelsize=11, colors='#333333')
        
        plt.tight_layout()
        
        # Salvar como arquivo físico
        if filename is None:
            filename = f"chart_{chart_type}_{int(time.time())}.png"
        
        filepath = Path(__file__).parent / "public" / "charts" / filename
        
        # Criar diretório se não existir
        filepath.parent.mkdir(exist_ok=True)
        
        plt.savefig(filepath, format='png', dpi=150, bbox_inches='tight', 
                   facecolor='white', edgecolor='none')
        plt.close(fig)
        
        print(f"✅ Gráfico salvo em: {filepath}")
        return f"charts/{filename}"
        
    except Exception as e:
        print(f"❌ Erro ao gerar gráfico {chart_type}: {e}")
        return None

def generate_chart_base64(chart_type, data, labels, title, colors=None, figsize=(12, 8)):
    """Gera gráfico profissional e retorna como base64"""
    try:
        # Configurar estilo profissional
        plt.style.use('default')
        
        # Ajustar tamanhos de fonte baseado no figsize - aumentados para harmonizar com proposta
        base_font_size = 16  # Aumentado de 11 para 16
        scale_factor = min(figsize[0] / 12, figsize[1] / 8)  # Fator de escala baseado no figsize
        
        plt.rcParams.update({
            'font.family': 'sans-serif',
            'font.sans-serif': ['Arial', 'DejaVu Sans', 'Liberation Sans'],
            'font.size': int(base_font_size * scale_factor),
            'axes.titlesize': int(20 * scale_factor),  # Aumentado de 14 para 20
            'axes.labelsize': int(18 * scale_factor),  # Aumentado de 12 para 18
            'xtick.labelsize': int(16 * scale_factor), # Aumentado de 10 para 16
            'ytick.labelsize': int(16 * scale_factor), # Aumentado de 10 para 16
            'legend.fontsize': int(16 * scale_factor), # Aumentado de 10 para 16
            'figure.titlesize': int(24 * scale_factor) # Aumentado de 16 para 24
        })
        
        fig, ax = plt.subplots(figsize=figsize, facecolor='none')  # Fundo transparente
        ax.set_facecolor('none')  # Fundo transparente
        
        # Cores profissionais baseadas no design da proposta
        if colors is None:
            colors = {
                'primary': '#2563eb',      # Azul principal
                'secondary': '#059669',    # Verde
                'accent': '#dc2626',       # Vermelho
                'warning': '#d97706',      # Laranja
                'info': '#7c3aed',         # Roxo
                'success': '#16a34a',      # Verde sucesso
                'danger': '#dc2626',       # Vermelho perigo
                'light': '#f8fafc',        # Cinza claro
                'dark': '#1e293b'          # Cinza escuro
            }
            color_list = [colors['primary'], colors['secondary'], colors['accent'], 
                         colors['warning'], colors['info'], colors['success']]
        else:
            color_list = colors
        
        # Configurações de estilo profissional
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#e2e8f0')
        ax.spines['bottom'].set_color('#e2e8f0')
        ax.spines['left'].set_linewidth(1)
        ax.spines['bottom'].set_linewidth(1)
        
        # Configurar grid
        ax.grid(True, alpha=0.1, color='#e2e8f0', linestyle='-', linewidth=0.5)
        ax.set_axisbelow(True)
        
        if chart_type == 'bar':
            # Criar barras com gradiente visual
            bars = ax.bar(labels, data, color=color_list[:len(data)], 
                         alpha=0.8, edgecolor='white', linewidth=2,
                         capsize=5, capstyle='round')
            
            # Adicionar valores nas barras com estilo melhorado
            max_val = max(data) if data else 0
            for i, (bar, value) in enumerate(zip(bars, data)):
                height = bar.get_height()
                # Posicionar texto acima da barra
                ax.text(bar.get_x() + bar.get_width()/2, height + max_val*0.02,
                       f'R$ {value:,.0f}', ha='center', va='bottom', 
                       fontsize=int(14 * scale_factor), fontweight='700', color='#1e293b',
                       bbox=dict(boxstyle='round,pad=0.4', facecolor='white', 
                               edgecolor='#e2e8f0', alpha=0.95, linewidth=1))
            
            # Configurar eixo Y com formato monetário
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'R$ {x:,.0f}'))
            
        elif chart_type == 'line':
            # Criar linha com estilo profissional
            line = ax.plot(labels, data, marker='o', linewidth=3, markersize=8, 
                          color=color_list[0], markerfacecolor='white', 
                          markeredgecolor=color_list[0], markeredgewidth=2,
                          alpha=0.9)
            
            # Adicionar valores nos pontos com estilo melhorado
            for i, (x, y) in enumerate(zip(labels, data)):
                ax.annotate(f'R$ {y:,.0f}', (x, y), textcoords="offset points", 
                           xytext=(0,20), ha='center', fontsize=int(13 * scale_factor), fontweight='700',
                           color='#1e293b',
                           bbox=dict(boxstyle='round,pad=0.4', facecolor='white', 
                                   edgecolor='#e2e8f0', alpha=0.95, linewidth=1))
            
            # Configurar eixo Y com formato monetário
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'R$ {x:,.0f}'))
            
        elif chart_type == 'dual_bar':
            x = np.arange(len(labels))
            width = 0.35
            
            # Criar barras duplas com estilo profissional
            bars1 = ax.bar(x - width/2, data[0], width, label='Consumo', 
                          color=color_list[0], alpha=0.8, edgecolor='white', linewidth=1)
            bars2 = ax.bar(x + width/2, data[1], width, label='Produção', 
                          color=color_list[1], alpha=0.8, edgecolor='white', linewidth=1)
            
            ax.set_xticks(x)
            ax.set_xticklabels(labels)
            
            # Configurar legenda com estilo melhorado
            legend = ax.legend(loc='upper right', frameon=True, fancybox=True, 
                             shadow=True, framealpha=0.9)
            legend.get_frame().set_facecolor('white')
            legend.get_frame().set_edgecolor('#e2e8f0')
            
            # Configurar eixo Y com formato monetário
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'R$ {x:,.0f}'))
        
        # Configurar título com estilo profissional
        ax.set_title(title, fontsize=int(22 * scale_factor), fontweight='800', pad=30, color='#1e293b')
        
        # Configurar rótulos dos eixos
        ax.set_xlabel('Período', fontsize=int(18 * scale_factor), fontweight='700', color='#1e293b')
        ax.set_ylabel('Valor (R$)', fontsize=int(18 * scale_factor), fontweight='700', color='#1e293b')
        
        # Configurar ticks
        ax.tick_params(axis='x', rotation=45, colors='#374151', labelsize=int(16 * scale_factor))
        ax.tick_params(axis='y', colors='#374151', labelsize=int(16 * scale_factor))
        
        # Ajustar layout para evitar sobreposição
        plt.tight_layout()
        
        # Converter para base64 com alta qualidade e fundo transparente
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=200, bbox_inches='tight', 
                   facecolor='none', edgecolor='none', pad_inches=0.2, transparent=True)
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        plt.close()
        
        return f"data:image/png;base64,{img_base64}"
        
    except Exception as e:
        print(f"❌ Erro ao gerar gráfico {chart_type}: {e}")
        return None

def apply_analise_financeira_graphs(template_html: str, proposta_data: dict) -> str:
    """
    Substitui as imagens dos 5 gráficos no template usando as tabelas e gráficos
    calculados por analise_financeira.py, garantindo consistência com a planilha.
    """
    try:
        # Extrair parâmetros da proposta
        def to_float(value, default=0.0):
            try:
                if isinstance(value, str):
                    s = value.strip()
                    # remover moeda/espacos e normalizar separadores BR -> EN
                    for token in ['R$', 'r$', ' ']:
                        s = s.replace(token, '')
                    s = s.replace('.', '').replace(',', '.')
                    return float(s)
                return float(value)
            except (TypeError, ValueError):
                return default

        consumo_medio_kwh_mes = to_float(proposta_data.get('consumo_mensal_kwh', 0), 0.0)
        tarifa_atual_r_kwh = to_float(proposta_data.get('tarifa_energia', 0.0), 0.0)
        # Fallback: se consumo kWh vier 0 mas existe consumo em R$, derive kWh
        if consumo_medio_kwh_mes <= 0:
            consumo_reais = to_float(proposta_data.get('consumo_mensal_reais', 0), 0.0)
            if consumo_reais > 0 and tarifa_atual_r_kwh > 0:
                consumo_medio_kwh_mes = consumo_reais / tarifa_atual_r_kwh
        potencia_kwp = to_float(proposta_data.get('potencia_sistema', 0), 0.0)
        valor_usina = to_float(
            proposta_data.get('preco_venda',
                              proposta_data.get('preco_final',
                                                proposta_data.get('custo_total_projeto', 0))),
            0.0
        )

        irr_custom = proposta_data.get('irradiancia_mensal_kwh_m2_dia')
        if isinstance(irr_custom, list) and len(irr_custom) == 12:
            irr_vec = [to_float(v, 0.0) for v in irr_custom]
        else:
            # fallback: usar exemplo do módulo; se não houver, usar média replicada
            media = to_float(proposta_data.get('irradiacao_media', 5.15), 5.15)
            irr_vec = af_irr_mensal_ex if isinstance(af_irr_mensal_ex, list) and len(af_irr_mensal_ex) == 12 else [media] * 12

        # Montar tabelas (25 anos)
        tabelas = af_calcular_tabelas(
            consumo_medio_kwh_mes=consumo_medio_kwh_mes,
            tarifa_atual_r_kwh=tarifa_atual_r_kwh,
            potencia_kwp=potencia_kwp,
            irradiancia_mensal_kwh_m2_dia=irr_vec,
            valor_usina=valor_usina
        )

        # Gerar gráficos base64
        graficos = af_gerar_graficos_base64(tabelas)

        # Substituir nos slides correspondentes
        substitutions = [
            ("grafico-slide-03", graficos.get("grafico1")),  # Custo acumulado sem solar
            ("grafico-slide-04", graficos.get("grafico2")),  # Conta média mensal
            ("grafico-slide-05", graficos.get("grafico3")),  # Produção mensal x Consumo médio mensal (R$)
            ("grafico-slide-06", graficos.get("grafico4")),  # Fluxo de caixa acumulado
            ("grafico-slide-09", graficos.get("grafico5")),  # Economia x Custos
        ]
        for img_id, data_uri in substitutions:
            if data_uri:
                pattern = rf'id="{img_id}" src="[^"]*"'
                replacement = f'id="{img_id}" src="{data_uri}"'
                template_html = re.sub(pattern, replacement, template_html)

        return template_html
    except Exception as e:
        print(f"⚠️ Erro ao aplicar gráficos analise_financeira: {e}")
        return template_html

def process_template_html(proposta_data):
    """
    Processa template HTML com todas as substituições de variáveis e gráficos.
    Esta função centraliza toda a lógica de processamento para ser reutilizada
    tanto no endpoint HTML quanto no endpoint PDF.
    
    Args:
        proposta_data (dict): Dicionário com os dados da proposta
    
    Returns:
        str: HTML processado com todas as variáveis e gráficos substituídos
    """
    try:
        # Carregar template HTML
        template_path = Path(__file__).parent / "public" / "template.html"
        if not template_path.exists():
            raise FileNotFoundError("Template não encontrado")
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template_html = f.read()
        
        # Converter imagens para base64
        fohat_base64 = convert_image_to_base64('/img/fohat.svg')
        logo_base64 = convert_image_to_base64('/img/logo.svg')
        como_funciona_base64 = convert_image_to_base64('/img/como-funciona.png')
        
        # Substituir URLs das imagens por base64
        if fohat_base64:
            template_html = template_html.replace("url('/img/fohat.svg')", f"url('{fohat_base64}')")
            template_html = template_html.replace("url('img/fohat.svg')", f"url('{fohat_base64}')")
        if logo_base64:
            template_html = template_html.replace('src="/img/logo.svg"', f'src="{logo_base64}"')
            template_html = template_html.replace('src="img/logo.svg"', f'src="{logo_base64}"')
        if como_funciona_base64:
            template_html = template_html.replace('src="/img/como-funciona.png"', f'src="{como_funciona_base64}"')
            template_html = template_html.replace('src="img/como-funciona.png"', f'src="{como_funciona_base64}"')
        
        # ====== Modo sem cálculo: usar apenas valores pré-calculados que vieram no payload ======
        try:
            print("🔎 [process_template_html] no-compute: usando valores fornecidos.")
            conta_atual_anual_calc = float(proposta_data.get('conta_atual_anual', 0) or 0)
            anos_payback_calc = float(proposta_data.get('anos_payback', 0) or 0)
            gasto_acum_payback_calc = float(proposta_data.get('gasto_acumulado_payback', 0) or 0)
        except Exception:
            conta_atual_anual_calc = float(proposta_data.get('conta_atual_anual', 0) or 0)
            anos_payback_calc = float(proposta_data.get('anos_payback', 0) or 0)
            gasto_acum_payback_calc = float(proposta_data.get('gasto_acumulado_payback', 0) or 0)

        # Substituir todas as variáveis {{}} no template (agora com valores normalizados)
        template_html = template_html.replace('{{cliente_nome}}', proposta_data.get('cliente_nome', 'Cliente'))
        endereco_resumido = format_endereco_resumido(proposta_data.get('cliente_endereco', ''), proposta_data.get('cidade'))
        template_html = template_html.replace('{{cliente_endereco}}', endereco_resumido)
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
        # Não substituir aqui o {{gasto_acumulado_payback}}. Vamos definir após calcular o gráfico
        template_html = template_html.replace('{{consumo_mensal_kwh}}', str(int(float(proposta_data.get('consumo_mensal_kwh', 0)))))
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
        # Detalhamento adicional de custos calculados antes de gerar a proposta
        template_html = template_html.replace('{{custo_ca_aterramento}}', f"R$ {proposta_data.get('custo_ca_aterramento', 0):,.2f}")
        template_html = template_html.replace('{{custo_plaquinhas}}', f"R$ {proposta_data.get('custo_plaquinhas', 0):,.2f}")
        template_html = template_html.replace('{{custo_obra}}', f"R$ {proposta_data.get('custo_obra', 0):,.2f}")
        template_html = template_html.replace('{{preco_venda}}', f"R$ {proposta_data.get('preco_venda', proposta_data.get('preco_final', 0)):,.2f}")
        try:
            _comissao_pct_b = float(proposta_data.get('comissao_vendedor', 0))
        except Exception:
            _comissao_pct_b = 0.0
        template_html = template_html.replace('{{comissao_vendedor}}', f"{_comissao_pct_b:.2f}%")
        try:
            _margem_desejada_b = float(proposta_data.get('margem_desejada', 0))
        except Exception:
            _margem_desejada_b = 0.0
        template_html = template_html.replace('{{margem_desejada}}', f"{_margem_desejada_b:.1f}%")
        template_html = template_html.replace('{{margem_lucro}}', f"R$ {proposta_data.get('margem_lucro', 0):,.2f}")
        # Detalhamento adicional de custos calculados antes de gerar a proposta
        template_html = template_html.replace('{{custo_ca_aterramento}}', f"R$ {proposta_data.get('custo_ca_aterramento', 0):,.2f}")
        template_html = template_html.replace('{{custo_plaquinhas}}', f"R$ {proposta_data.get('custo_plaquinhas', 0):,.2f}")
        template_html = template_html.replace('{{custo_obra}}', f"R$ {proposta_data.get('custo_obra', 0):,.2f}")
        template_html = template_html.replace('{{preco_venda}}', f"R$ {proposta_data.get('preco_venda', proposta_data.get('preco_final', 0)):,.2f}")
        try:
            _comissao_pct = float(proposta_data.get('comissao_vendedor', 0))
        except Exception:
            _comissao_pct = 0.0
        template_html = template_html.replace('{{comissao_vendedor}}', f"{_comissao_pct:.2f}%")
        try:
            _margem_desejada = float(proposta_data.get('margem_desejada', 0))
        except Exception:
            _margem_desejada = 0.0
        template_html = template_html.replace('{{margem_desejada}}', f"{_margem_desejada:.1f}%")
        
        # ====== Sem gerar novos gráficos: aplicar somente os já fornecidos (se existirem) ======
        try:
            graficos = proposta_data.get('graficos_base64')
            if isinstance(graficos, dict):
                id_map = {
                    "grafico1": "grafico-slide-03",
                    "grafico2": "grafico-slide-04",
                    "grafico3": "grafico-slide-05",
                    "grafico4": "grafico-slide-06",
                    "grafico5": "grafico-slide-09",
                }
                # Helper robusto para substituir src do <img id="...">
                def _inject_img_src(html: str, element_id: str, new_src: str) -> str:
                    # 1) Se já existe src no mesmo tag (ordem de atributos indiferente, aspas simples/duplas)
                    pattern1 = re.compile(
                        r'(<img\b[^>]*\bid=["\']%s["\'][^>]*\bsrc=["\'])([^"\']*)(["\'][^>]*>)' % re.escape(element_id),
                        flags=re.IGNORECASE
                    )
                    if pattern1.search(html):
                        return pattern1.sub(r'\1' + new_src + r'\3', html)
                    # 2) Se não tem src ainda, injeta antes do fechamento do tag
                    pattern2 = re.compile(
                        r'(<img\b[^>]*\bid=["\']%s["\'][^>]*)(>)' % re.escape(element_id),
                        flags=re.IGNORECASE
                    )
                    if pattern2.search(html):
                        return pattern2.sub(r'\1 src="' + new_src + r'"\2', html)
                    return html

                for k, v in graficos.items():
                    if k in id_map and v:
                        template_html = _inject_img_src(template_html, id_map[k], v)
        except Exception as _e:
            print(f"⚠️ Falha ao injetar gráficos prontos: {_e}")
        
        # Substituir variáveis restantes com valores padrão
        template_html = template_html.replace('{{conta_futura_25_anos}}', f"R$ {proposta_data.get('conta_futura_25_anos', proposta_data.get('conta_atual_anual', 0) * 5.4):,.2f}")
        template_html = template_html.replace('{{valor_maximo}}', f"R$ {proposta_data.get('valor_maximo', proposta_data.get('conta_atual_anual', 0) * 5.4):,.2f}")
        template_html = template_html.replace('{{valor_medio}}', f"R$ {proposta_data.get('valor_medio', proposta_data.get('conta_atual_anual', 0) * 2.7):,.2f}")
        template_html = template_html.replace('{{valor_minimo}}', f"R$ {proposta_data.get('valor_minimo', proposta_data.get('conta_atual_anual', 0)):,.2f}")
        
        economia_anual_base = proposta_data.get('economia_mensal_estimada', 0) * 12
        template_html = template_html.replace('{{economia_ano_1}}', f"R$ {proposta_data.get('economia_ano_1', economia_anual_base):,.2f}")
        template_html = template_html.replace('{{economia_ano_5}}', f"R$ {proposta_data.get('economia_ano_5', economia_anual_base * 5):,.2f}")
        template_html = template_html.replace('{{economia_ano_10}}', f"R$ {proposta_data.get('economia_ano_10', economia_anual_base * 10):,.2f}")
        template_html = template_html.replace('{{economia_ano_15}}', f"R$ {proposta_data.get('economia_ano_15', economia_anual_base * 15):,.2f}")
        template_html = template_html.replace('{{economia_ano_20}}', f"R$ {proposta_data.get('economia_ano_20', economia_anual_base * 20):,.2f}")
        template_html = template_html.replace('{{economia_ano_25}}', f"R$ {proposta_data.get('economia_ano_25', proposta_data.get('economia_total_25_anos', 0)):,.2f}")
        
        # Substituir variáveis de cronograma
        template_html = template_html.replace('{{data_aprovacao}}', proposta_data.get('data_aprovacao', '15 dias'))
        template_html = template_html.replace('{{data_validacao}}', proposta_data.get('data_validacao', '30 dias'))
        template_html = template_html.replace('{{data_contrato}}', proposta_data.get('data_contrato', '45 dias'))
        template_html = template_html.replace('{{data_equipamentos}}', proposta_data.get('data_equipamentos', '60 dias'))
        template_html = template_html.replace('{{data_montagem}}', proposta_data.get('data_montagem', '75 dias'))
        template_html = template_html.replace('{{data_conclusao}}', proposta_data.get('data_conclusao', '90 dias'))
        
        # Substituir variáveis de comparação financeira
        conta_anual = proposta_data.get('conta_atual_anual', 0)
        investimento_inicial = proposta_data.get('preco_final', 0)
        
        template_html = template_html.replace('{{gasto_total_25_anos}}', f"R$ {proposta_data.get('gasto_total_25_anos', conta_anual * 25):,.2f}")
        template_html = template_html.replace('{{economia_mensal}}', f"R$ {proposta_data.get('economia_mensal', proposta_data.get('economia_mensal_estimada', 0)):,.2f}")
        template_html = template_html.replace('{{payback_anos}}', str(proposta_data.get('payback_anos', proposta_data.get('anos_payback', 0))))
        
        template_html = template_html.replace('{{gasto_ano_1_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_1_sem_solar', conta_anual):,.2f}")
        template_html = template_html.replace('{{gasto_ano_5_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_5_sem_solar', conta_anual * 1.4):,.2f}")
        template_html = template_html.replace('{{gasto_ano_10_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_10_sem_solar', conta_anual * 2.0):,.2f}")
        template_html = template_html.replace('{{gasto_ano_15_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_15_sem_solar', conta_anual * 2.8):,.2f}")
        template_html = template_html.replace('{{gasto_ano_20_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_20_sem_solar', conta_anual * 3.9):,.2f}")
        template_html = template_html.replace('{{gasto_ano_25_sem_solar}}', f"R$ {proposta_data.get('gasto_ano_25_sem_solar', conta_anual * 5.4):,.2f}")
        
        template_html = template_html.replace('{{gasto_ano_1_com_solar}}', f"R$ {proposta_data.get('gasto_ano_1_com_solar', investimento_inicial):,.2f}")
        template_html = template_html.replace('{{gasto_ano_5_com_solar}}', f"R$ {proposta_data.get('gasto_ano_5_com_solar', investimento_inicial + 500):,.2f}")
        template_html = template_html.replace('{{gasto_ano_10_com_solar}}', f"R$ {proposta_data.get('gasto_ano_10_com_solar', investimento_inicial + 1000):,.2f}")
        template_html = template_html.replace('{{gasto_ano_15_com_solar}}', f"R$ {proposta_data.get('gasto_ano_15_com_solar', investimento_inicial + 1500):,.2f}")
        template_html = template_html.replace('{{gasto_ano_20_com_solar}}', f"R$ {proposta_data.get('gasto_ano_20_com_solar', investimento_inicial + 2000):,.2f}")
        template_html = template_html.replace('{{gasto_ano_25_com_solar}}', f"R$ {proposta_data.get('gasto_ano_25_com_solar', investimento_inicial + 2500):,.2f}")
        
        # Substituir variáveis de altura de produção/consumo mensal
        geracao_mensal = proposta_data.get('geracao_media_mensal', 0)
        consumo_mensal_kwh = float(proposta_data.get('consumo_mensal_kwh', 0))
        
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
        
        for mes in ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']:
            template_html = template_html.replace(f'{{{{altura_consumo_{mes}}}}}', str(int(consumo_mensal_kwh)))
        
        # Substituir variáveis de economia e investimento
        economia_total = proposta_data.get('economia_total_25_anos', 1)
        if economia_total <= 0:
            economia_total = 1
        
        template_html = template_html.replace('{{altura_economia_ano_5}}', str(int((economia_anual_base * 5 / economia_total) * 100)))
        template_html = template_html.replace('{{altura_economia_ano_10}}', str(int((economia_anual_base * 10 / economia_total) * 100)))
        template_html = template_html.replace('{{altura_economia_ano_15}}', str(int((economia_anual_base * 15 / economia_total) * 100)))
        template_html = template_html.replace('{{altura_economia_ano_20}}', str(int((economia_anual_base * 20 / economia_total) * 100)))
        template_html = template_html.replace('{{altura_economia_ano_25}}', str(100))
        
        payback_anos = proposta_data.get('anos_payback', 0)
        posicao_payback = min(100, (payback_anos / 25) * 100) if payback_anos > 0 else 0
        template_html = template_html.replace('{{posicao_payback}}', str(posicao_payback))
        template_html = template_html.replace('{{altura_payback}}', str(50))
        
        altura_investimento = min(100, (investimento_inicial / (conta_anual * 5.4)) * 100) if conta_anual > 0 else 0
        template_html = template_html.replace('{{altura_investimento}}', str(int(altura_investimento)))
        
        gasto_maximo = conta_anual * 5.4
        if gasto_maximo <= 0:
            template_html = template_html.replace('{{altura_ano_5_com_solar}}', '0')
            template_html = template_html.replace('{{altura_ano_10_com_solar}}', '0')
            template_html = template_html.replace('{{altura_ano_15_com_solar}}', '0')
            template_html = template_html.replace('{{altura_ano_20_com_solar}}', '0')
            template_html = template_html.replace('{{altura_ano_25_com_solar}}', '0')
        else:
            template_html = template_html.replace('{{altura_ano_5_com_solar}}', str(int(((investimento_inicial + 500) / gasto_maximo) * 100)))
            template_html = template_html.replace('{{altura_ano_10_com_solar}}', str(int(((investimento_inicial + 1000) / gasto_maximo) * 100)))
            template_html = template_html.replace('{{altura_ano_15_com_solar}}', str(int(((investimento_inicial + 1500) / gasto_maximo) * 100)))
            template_html = template_html.replace('{{altura_ano_20_com_solar}}', str(int(((investimento_inicial + 2000) / gasto_maximo) * 100)))
            template_html = template_html.replace('{{altura_ano_25_com_solar}}', str(int(((investimento_inicial + 2500) / gasto_maximo) * 100)))
        
        template_html = template_html.replace('{{valor_maximo_economia}}', f"R$ {proposta_data.get('valor_maximo_economia', proposta_data.get('economia_total_25_anos', 0)):,.2f}")
        template_html = template_html.replace('{{valor_medio_economia}}', f"R$ {proposta_data.get('valor_medio_economia', proposta_data.get('economia_total_25_anos', 0) / 2):,.2f}")
        template_html = template_html.replace('{{valor_minimo_economia}}', f"R$ {proposta_data.get('valor_minimo_economia', 0):,.2f}")
        
        template_html = template_html.replace('{{valor_maximo_grafico}}', f"R$ {proposta_data.get('valor_maximo_grafico', conta_anual * 5.4):,.2f}")
        template_html = template_html.replace('{{valor_medio_grafico}}', f"R$ {proposta_data.get('valor_medio_grafico', conta_anual * 2.7):,.2f}")
        template_html = template_html.replace('{{valor_minimo_grafico}}', f"R$ {proposta_data.get('valor_minimo_grafico', conta_anual):,.2f}")
        
        # Não recalcular gráficos aqui. Se necessário, uma etapa anterior deve ter gerado e enviado.

        # Fallback: caso '{{gasto_acumulado_payback}}' ainda não tenha sido substituído (ex.: conta_atual_anual=0),
        # usar o valor calculado a partir da conta anual e do payback, se existir.
        if '{{gasto_acumulado_payback}}' in template_html:
            try:
                metrics = proposta_data.get('metrics') or {}
                # Preferir o acumulado de 25 anos calculado na análise financeira, se existir
                metric_gap = metrics.get('gasto_acumulado_sem_solar_25')
                if metric_gap is not None:
                    _gap = float(metric_gap)
                else:
                    _gap = float(proposta_data.get('gasto_acumulado_payback', 0) or gasto_acum_payback_calc or 0)
            except Exception:
                _gap = 0.0
            template_html = template_html.replace('{{gasto_acumulado_payback}}', format_brl(_gap))
        return template_html
        
    except Exception as e:
        print(f"❌ Erro ao processar template: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

@app.route('/config/taxas-distribuicao', methods=['GET'])
def get_taxas_distribuicao():
    """
    Lista o mapa de taxas de distribuição mensais por concessionária.
    """
    try:
        return jsonify({"success": True, "items": _load_taxas()})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/taxas-distribuicao', methods=['POST'])
def upsert_taxa_distribuicao():
    """
    Upsert manual (Admin) no mapa de taxas:
    Body: { "concessionaria": "enel_sp", "nome": "Enel SP", "monofasica": 40, "bifasica": 65, "trifasica": 130 }
    """
    try:
        body = request.get_json() or {}
        slug = ''.join(ch.lower() if ch.isalnum() else '_' for ch in (body.get("concessionaria") or body.get("nome") or "")).strip('_')
        if not slug:
            return jsonify({"success": False, "message": "Concessionária inválida"}), 400
        cur = _load_taxas()
        cur[slug] = {
            "nome": body.get("nome") or slug,
            "monofasica": float(body.get("monofasica") or 0),
            "bifasica": float(body.get("bifasica") or 0),
            "trifasica": float(body.get("trifasica") or 0),
            "fonte": body.get("fonte") or "Admin"
        }
        _save_taxas(cur)
        return jsonify({"success": True, "items": cur})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/taxas-distribuicao/atualizar-aneel', methods=['POST'])
def atualizar_taxas_aneel():
    """
    Atualiza automaticamente pela ANEEL (Estrutura Tarifária Grupo B).
    """
    try:
        taxa_map = _atualizar_taxas_distribuicao()
        return jsonify({"success": True, "items": taxa_map})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/analise/gerar-graficos', methods=['POST'])
def analise_gerar_graficos():
    """
    Gera tabelas da análise financeira e devolve os 5 gráficos em base64,
    além de métricas úteis (payback natural por fluxo, valores resumidos).
    Nenhum dado é persistido aqui; a tela de análise deve chamar este endpoint
    antes de salvar/gerar a proposta.
    """
    try:
        body = request.get_json() or {}

        def _to_float(v, d=0.0):
            try:
                if isinstance(v, str):
                    s = v.strip()
                    for token in ['R$', 'r$', ' ']:
                        s = s.replace(token, '')
                    s = s.replace('.', '').replace(',', '.')
                    return float(s)
                return float(v)
            except Exception:
                return d

        # Entradas (aceita tanto nomes "frontend" quanto "backend")
        consumo_kwh = _to_float(body.get('consumo_mensal_kwh', body.get('consumo_medio_kwh_mes', 0)), 0.0)
        consumo_reais = _to_float(body.get('consumo_mensal_reais', 0), 0.0)
        tarifa = _to_float(body.get('tarifa_energia', 0), 0.0)
        potencia_kwp = _to_float(body.get('potencia_kwp', body.get('potencia_sistema', 0)), 0.0)
        preco_venda = _to_float(body.get('preco_venda', body.get('preco_final', 0)), 0.0)

        # Vetor de irradiância mensal opcional; senão replicar média
        irr_vec_in = body.get('irradiancia_mensal_kwh_m2_dia')
        if isinstance(irr_vec_in, list) and len(irr_vec_in) == 12:
            irr_vec = [_to_float(v, 0.0) for v in irr_vec_in]
        else:
            irr_media = _to_float(body.get('irradiacao_media', 5.15), 5.15)
            irr_vec = af_irr_mensal_ex if isinstance(af_irr_mensal_ex, list) and len(af_irr_mensal_ex) == 12 else [irr_media] * 12

        # Derivar kWh se vier apenas R$ e tarifa
        if (consumo_kwh <= 0) and (consumo_reais > 0) and (tarifa > 0):
            consumo_kwh = consumo_reais / tarifa

        # Sanitização mínima
        if tarifa <= 0 or tarifa > 10:
            return jsonify({"success": False, "message": "Tarifa inválida. Informe tarifa (R$/kWh)."}), 400
        if potencia_kwp <= 0:
            return jsonify({"success": False, "message": "Potência do sistema (kWp) inválida."}), 400

        # Tabelas 25 anos
        tabelas = af_calcular_tabelas(
            consumo_medio_kwh_mes=consumo_kwh,
            tarifa_atual_r_kwh=tarifa,
            potencia_kwp=potencia_kwp,
            irradiancia_mensal_kwh_m2_dia=irr_vec,
            valor_usina=preco_venda
        )

        # Gráficos base64
        graficos = af_gerar_graficos_base64(tabelas)

        # Métricas de resumo
        df_custo = tabelas["custo_sem_solar"]
        df_fx = tabelas["fluxo_caixa"]
        # Gasto acumulado sem solar (ano 25)
        gasto_acumulado_25 = float(df_custo["custo_acumulado_sem_solar_r"].iloc[24])
        # Payback natural pelo fluxo (primeiro ano com acumulado >= 0)
        ano_payback_fluxo = None
        try:
            for y, v in zip(list(df_fx["ano"]), list(df_fx["fluxo_caixa_acumulado_r"])):
                if v >= 0:
                    ano_payback_fluxo = int(y)
                    break
        except Exception:
            ano_payback_fluxo = None

        # Payback pela fórmula preco/economia (se possível)
        economia_mensal_est = 0.0
        try:
            # Produção anual ano 1 / 12 (kWh/mês)
            prod_kwh_mes_ano1 = float(tabelas["producao_anual"]["producao_anual_kwh"].iloc[0]) / 12.0
            energia_aproveitada = min(consumo_kwh, prod_kwh_mes_ano1)
            economia_mensal_est = energia_aproveitada * tarifa
        except Exception:
            pass
        anos_payback_formula = round(preco_venda / (economia_mensal_est * 12), 1) if economia_mensal_est > 0 and preco_venda > 0 else 0.0

        # Resumo de pontos do gráfico 1 (anos 1,5,10,15,20,25)
        idxs = [0, 4, 9, 14, 19, 24]
        pontos_sem_solar = [float(df_custo["custo_acumulado_sem_solar_r"].iloc[i]) for i in idxs]

        return jsonify({
            "success": True,
            "graficos_base64": graficos,
            "metrics": {
                "consumo_medio_kwh_mes": consumo_kwh,
                "tarifa_energia": tarifa,
                "preco_venda": preco_venda,
                "economia_mensal_estimada": economia_mensal_est,
                "anos_payback_formula": anos_payback_formula,
                "ano_payback_fluxo": ano_payback_fluxo,
                "gasto_acumulado_sem_solar_25": gasto_acumulado_25,
                "pontos_sem_solar": {
                    "ano_1": pontos_sem_solar[0],
                    "ano_5": pontos_sem_solar[1],
                    "ano_10": pontos_sem_solar[2],
                    "ano_15": pontos_sem_solar[3],
                    "ano_20": pontos_sem_solar[4],
                    "ano_25": pontos_sem_solar[5],
                }
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/propostas/<proposta_id>/anexar-graficos', methods=['POST'])
def anexar_graficos_a_proposta(proposta_id):
    """
    Atualiza o JSON da proposta anexando 'graficos_base64' e métricas já calculadas.
    Use após chamar /analise/gerar-graficos na etapa anterior.
    """
    try:
        body = request.get_json() or {}
        graficos = body.get('graficos_base64') or {}
        metrics = body.get('metrics') or {}
        proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
        if not proposta_file.exists():
            return jsonify({"success": False, "message": "Proposta não encontrada"}), 404
        with open(proposta_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(graficos, dict) and graficos:
            data['graficos_base64'] = graficos
        # Opcionalmente, sincroniza alguns campos úteis
        try:
            if 'anos_payback_formula' in metrics and float(metrics['anos_payback_formula']) > 0:
                data['anos_payback'] = float(metrics['anos_payback_formula'])
            if 'economia_mensal_estimada' in metrics and float(metrics['economia_mensal_estimada']) > 0:
                data['economia_mensal_estimada'] = float(metrics['economia_mensal_estimada'])
        except Exception:
            pass
        with open(proposta_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"success": True, "message": "Gráficos anexados à proposta."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/salvar-proposta', methods=['POST'])
def salvar_proposta():
    try:
        print("🔍 DEBUG: Iniciando endpoint /salvar-proposta")
        data = request.get_json()
        print(f"🔍 DEBUG: Dados recebidos: {data}")
        
        # Gerar ID único para a proposta
        proposta_id = str(uuid.uuid4())
        print(f"🔍 DEBUG: ID gerado: {proposta_id}")
        
        # Validação obrigatória: concessionária e tarifa válidas
        def _to_float(v, d=0.0):
            try:
                if isinstance(v, str):
                    s = v.strip()
                    for token in ['R$', 'r$', ' ']:
                        s = s.replace(token, '')
                    s = s.replace('.', '').replace(',', '.')
                    return float(s)
                return float(v)
            except Exception:
                return d
        concessionaria_payload = (data.get('concessionaria') or data.get('concessionária') or '').strip()
        tarifa_payload = _to_float(data.get('tarifa_energia', 0), 0.0)
        if not concessionaria_payload or tarifa_payload <= 0 or tarifa_payload > 10:
            return jsonify({
                "success": False,
                "message": "Selecione a concessionária e informe uma tarifa válida (R$/kWh)."
            }), 400
        
        # Preparar dados da proposta
        proposta_data = {
            'id': proposta_id,
            'data_criacao': datetime.now().isoformat(),
            'cliente_nome': data.get('cliente_nome', 'Cliente'),
            'cliente_endereco': data.get('cliente_endereco', 'Endereço não informado'),
            'cliente_telefone': data.get('cliente_telefone', 'Telefone não informado'),
            'potencia_sistema': data.get('potencia_sistema', 0),
            'preco_final': data.get('preco_final', 0),
            'preco_venda': data.get('preco_venda', data.get('preco_final', 0)),  # Preço de venda para cálculo do payback
            'cidade': data.get('cidade', 'Projeto'),
            'vendedor_nome': data.get('vendedor_nome', 'Representante Comercial'),
            'vendedor_cargo': data.get('vendedor_cargo', 'Especialista em Energia Solar'),
            'vendedor_telefone': data.get('vendedor_telefone', '(11) 99999-9999'),
            'vendedor_email': data.get('vendedor_email', 'contato@empresa.com'),
            'data_proposta': datetime.now().strftime('%d/%m/%Y'),
            # Dados financeiros
            'conta_atual_anual': data.get('conta_atual_anual', 0),
            # Calcular payback automaticamente usando preço de venda
            'preco_venda': data.get('preco_venda', data.get('preco_final', 0)),
            'anos_payback': data.get('anos_payback', 0),
            'gasto_acumulado_payback': data.get('gasto_acumulado_payback', 0),
            'consumo_mensal_kwh': data.get('consumo_mensal_kwh', 0),
            'tarifa_energia': tarifa_payload,
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
            'margem_lucro': data.get('margem_lucro', 0),
            'comissao_vendedor': data.get('comissao_vendedor', 5),
            # Preservar gráficos e métricas gerados na etapa de análise (se enviados pelo frontend)
            'graficos_base64': data.get('graficos_base64') or {},
            'metrics': data.get('metrics') or {}
        }
        # Garantir que a proposta use apenas o preço de venda
        try:
            _pv = float(proposta_data.get('preco_venda', 0) or 0)
            if _pv > 0:
                proposta_data['preco_final'] = _pv
        except Exception:
            pass
        
        # Não realizar cálculos aqui: a análise financeira deve ocorrer antes e enviar todos os valores
        print("ℹ️ [salvar-proposta] no-compute: mantendo valores recebidos (sem chamar calculadoras).")
        
        # Salvar dados da proposta
        proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
        with open(proposta_file, 'w', encoding='utf-8') as f:
            json.dump(proposta_data, f, ensure_ascii=False, indent=2)

        # Persistir no banco de dados (best-effort)
        try:
            db = SessionLocal()
            row = PropostaDB(
                id=proposta_id,
                cliente_nome=proposta_data.get('cliente_nome'),
                cliente_endereco=proposta_data.get('cliente_endereco'),
                cliente_telefone=proposta_data.get('cliente_telefone'),
                cidade=proposta_data.get('cidade'),
                potencia_sistema=proposta_data.get('potencia_sistema'),
                preco_final=proposta_data.get('preco_final'),
                conta_atual_anual=proposta_data.get('conta_atual_anual'),
                anos_payback=proposta_data.get('anos_payback'),
                gasto_acumulado_payback=proposta_data.get('gasto_acumulado_payback'),
                consumo_mensal_kwh=float(proposta_data.get('consumo_mensal_kwh', 0) or 0),
                tarifa_energia=proposta_data.get('tarifa_energia'),
                economia_mensal_estimada=proposta_data.get('economia_mensal_estimada'),
                quantidade_placas=proposta_data.get('quantidade_placas'),
                potencia_placa_w=int(proposta_data.get('potencia_placa_w', 0) or 0),
                area_necessaria=proposta_data.get('area_necessaria'),
                irradiacao_media=proposta_data.get('irradiacao_media'),
                geracao_media_mensal=proposta_data.get('geracao_media_mensal'),
                creditos_anuais=proposta_data.get('creditos_anuais'),
                economia_total_25_anos=proposta_data.get('economia_total_25_anos'),
                payback_meses=proposta_data.get('payback_meses'),
                custo_total_projeto=proposta_data.get('custo_total_projeto'),
                custo_equipamentos=proposta_data.get('custo_equipamentos'),
                custo_instalacao=proposta_data.get('custo_instalacao'),
                custo_homologacao=proposta_data.get('custo_homologacao'),
                custo_outros=proposta_data.get('custo_outros'),
                margem_lucro=proposta_data.get('margem_lucro'),
                comissao_vendedor=proposta_data.get('comissao_vendedor'),
                payload=proposta_data,
            )
            db.add(row)
            db.commit()
            db.close()
            print(f"💾 Proposta {proposta_id} salva no banco de dados")
        except Exception as e:
            print(f"⚠️ Falha ao salvar proposta no banco: {e}")
        
        return jsonify({
            'success': True,
            'proposta_id': proposta_id,
            'message': 'Proposta salva com sucesso'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao salvar proposta: {str(e)}'
        }), 500

@app.route('/gerar-proposta-html/<proposta_id>', methods=['GET'])
def gerar_proposta_html(proposta_id):
    """
    Endpoint para gerar HTML da proposta.
    Agora usa a função centralizada process_template_html().
    """
    try:
        start_ts = time.time()
        print(f"🔄 [gerar_proposta_html] Início - proposta_id={proposta_id}")
        # Limpar gráficos antigos
        cleanup_old_charts()
        
        # Carregar dados da proposta
        proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
        if not proposta_file.exists():
            return f"<html><body><h1>Proposta não encontrada</h1></body></html>", 404
        
        with open(proposta_file, 'r', encoding='utf-8') as f:
            proposta_data = json.load(f)
        
        # Processar template usando função centralizada
        template_html = process_template_html(proposta_data)
        dur_ms = int((time.time() - start_ts) * 1000)
        print(f"✅ [gerar_proposta_html] Concluído em {dur_ms} ms - proposta_id={proposta_id}")
        
        # Verificar variáveis restantes
        variaveis_restantes = re.findall(r'\{\{[^}]+\}\}', template_html)
        if variaveis_restantes:
            print(f"⚠️ Variáveis não substituídas: {len(variaveis_restantes)}")
        
        return template_html, 200, {'Content-Type': 'text/html; charset=utf-8'}
    
    except Exception as e:
        print(f"❌ [gerar_proposta_html] Erro: {e}")
        return f"<html><body><h1>Erro ao gerar proposta HTML: {str(e)}</h1></body></html>", 500

@app.route('/gerar-pdf/<proposta_id>', methods=['GET'])
def gerar_pdf(proposta_id):
    """
    Endpoint para gerar PDF da proposta.
    TEMPORÁRIO: Retorna HTML até que as dependências do WeasyPrint sejam instaladas.
    """
    try:
        print(f"⚠️ AVISO: Retornando HTML temporariamente (WeasyPrint não disponível)")
        
        # Carregar dados da proposta
        proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
        if not proposta_file.exists():
            return jsonify({'success': False, 'message': 'Proposta não encontrada'}), 404
        
        with open(proposta_file, 'r', encoding='utf-8') as f:
            proposta_data = json.load(f)
        
        # Processar template HTML usando função centralizada
        print(f"🔄 Gerando HTML para proposta {proposta_id}...")
        processed_html = process_template_html(proposta_data)
        
        print(f"✅ HTML gerado com sucesso")
        
        # Retornar HTML temporariamente
        return processed_html, 200, {'Content-Type': 'text/html; charset=utf-8'}
        
    except Exception as e:
        print(f"❌ Erro ao gerar PDF/HTML: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Erro ao gerar PDF: {str(e)}'}), 500

@app.route('/proposta/<proposta_id>', methods=['GET'])
def visualizar_proposta(proposta_id):
    try:
        print(f"🔎 [visualizar_proposta] GET /proposta/{proposta_id}")
        # Carregar dados da proposta
        proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
        if not proposta_file.exists():
            return jsonify({
                'success': False,
                'message': 'Proposta não encontrada'
            }), 404
        
        with open(proposta_file, 'r', encoding='utf-8') as f:
            proposta_data = json.load(f)
        
        # Usar o processador central para garantir substituição total de variáveis
        # e injeção dos gráficos/imagens em base64.
        try:
            processed = process_template_html(proposta_data)
            return processed, 200, {'Content-Type': 'text/html; charset=utf-8'}
        except Exception as e:
            print(f"⚠️ Falha no process_template_html em visualizar_proposta: {e} - seguindo com processamento local")
        
        # Carregar template HTML
        template_path = Path(__file__).parent / "public" / "template.html"
        if not template_path.exists():
            return f"<html><body><h1>Template não encontrado</h1></body></html>", 404
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template_html = f.read()
        
        # Converter imagens para base64
        fohat_base64 = convert_image_to_base64('/img/fohat.svg')
        logo_base64 = convert_image_to_base64('/img/logo.svg')
        como_funciona_base64 = convert_image_to_base64('/img/como-funciona.png')
        
        # Substituir URLs das imagens por base64
        if fohat_base64:
            template_html = template_html.replace("url('/img/fohat.svg')", f"url('{fohat_base64}')")
            template_html = template_html.replace("url('img/fohat.svg')", f"url('{fohat_base64}')")
        if logo_base64:
            template_html = template_html.replace('src="/img/logo.svg"', f'src="{logo_base64}"')
            template_html = template_html.replace('src="img/logo.svg"', f'src="{logo_base64}"')
        if como_funciona_base64:
            template_html = template_html.replace('src="/img/como-funciona.png"', f'src="{como_funciona_base64}"')
            template_html = template_html.replace('src="img/como-funciona.png"', f'src="{como_funciona_base64}"')
        
        # Substituir todas as variáveis {{}} no template (mesmo código acima)
        template_html = template_html.replace('{{cliente_nome}}', proposta_data.get('cliente_nome', 'Cliente'))
        template_html = template_html.replace('{{cliente_endereco}}', format_endereco_resumido(proposta_data.get('cliente_endereco', ''), proposta_data.get('cidade')))
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
        # Não substituir aqui {{gasto_acumulado_payback}} para evitar divergência.
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
        print("📊 === DEBUG GRÁFICO SLIDE-03 (visualizar) ===")
        conta_atual_anual = proposta_data.get('conta_atual_anual', 0)
        print(f"📊 Conta atual anual: R$ {conta_atual_anual:,.2f}")
        
        if conta_atual_anual > 0:
            # Calcular gasto mensal atual
            gasto_mensal_atual = conta_atual_anual / 12
            
            # Calcular gastos anuais para todos os 25 anos (com aumento de 4.1% ao ano)
            gastos_anuais = []
            for ano in range(1, 26):
                gasto_anual = gasto_mensal_atual * (1.041 ** (ano - 1)) * 12
                gastos_anuais.append(gasto_anual)
            
            # Calcular soma acumulada dos gastos
            soma_acumulada = 0
            gastos_acumulados = []
            for gasto_anual in gastos_anuais:
                soma_acumulada += gasto_anual
                gastos_acumulados.append(soma_acumulada)
            
            # Selecionar valores para os anos específicos (1, 5, 10, 15, 20, 25)
            indices_anos = [0, 4, 9, 14, 19, 24]  # Índices para anos 1, 5, 10, 15, 20, 25
            valores = [gastos_acumulados[i] for i in indices_anos]
            labels = ['Ano 1', 'Ano 5', 'Ano 10', 'Ano 15', 'Ano 20', 'Ano 25']
            
            # Paleta de cores da proposta (usando cores negativas/vermelhas para gastos)
            cores = ['#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D', '#450A0A']
            
            # Definir variáveis para uso posterior
            conta_ano_1 = valores[0]
            conta_ano_5 = valores[1]
            conta_ano_10 = valores[2]
            conta_ano_15 = valores[3]
            conta_ano_20 = valores[4]
            conta_ano_25 = valores[5]
            
            # Gerar gráfico usando matplotlib com Base64, fonte maior e cores da proposta
            chart_base64 = generate_chart_base64(
                'bar',
                valores,
                labels,
                "Seu Gasto Atual",
                cores,
                figsize=(20, 14)  # Gráfico ainda maior para usar toda metade direita
            )

            if chart_base64:
                print("✅ Gráfico slide-03 gerado com sucesso!")
                template_html = template_html.replace(
                    'id="grafico-slide-03" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdyw6FmaWNvIFNsaWRlLTAzPC90ZXh0Pgo8L3N2Zz4K"',
                    f'id="grafico-slide-03" src="{chart_base64}"'
                )
            else:
                print("❌ Erro ao gerar gráfico slide-03")
            
            print(f"📊 Valores calculados:")
            for i, (label, valor) in enumerate(zip(labels, valores)):
                print(f"   {label}: R$ {valor:,.2f}")
        else:
            print("⚠️ Conta atual anual é zero - usando valores padrão")
            # Valores padrão se não houver dados
            valores = [900, 1056, 1399, 1790, 2260, 2860]
            labels = ['Ano 1', 'Ano 5', 'Ano 10', 'Ano 15', 'Ano 20', 'Ano 25']
            cores = ['#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D', '#450A0A']
            
            # Esta seção foi removida - agora usamos Base64
        
        # Substituir valores das contas (mantendo para compatibilidade)
        conta_ano_1 = valores[0]
        conta_ano_5 = valores[1]
        conta_ano_10 = valores[2]
        conta_ano_15 = valores[3]
        conta_ano_20 = valores[4]
        conta_ano_25 = valores[5]
        
        # Calcular alturas das barras para CSS (caso ainda existam no template)
        valor_maximo = conta_ano_25
        altura_barra_ano_1 = int((conta_ano_1 / valor_maximo) * 100)
        altura_barra_ano_5 = int((conta_ano_5 / valor_maximo) * 100)
        altura_barra_ano_10 = int((conta_ano_10 / valor_maximo) * 100)
        altura_barra_ano_15 = int((conta_ano_15 / valor_maximo) * 100)
        altura_barra_ano_20 = int((conta_ano_20 / valor_maximo) * 100)
        altura_barra_ano_25 = 100  # Sempre 100% para o ano 25
        
        # Substituir variáveis de altura das barras (para CSS)
        template_html = template_html.replace('{{altura_barra_ano_1}}', f"{altura_barra_ano_1}px")
        template_html = template_html.replace('{{altura_barra_ano_5}}', f"{altura_barra_ano_5}px")
        template_html = template_html.replace('{{altura_barra_ano_10}}', f"{altura_barra_ano_10}px")
        template_html = template_html.replace('{{altura_barra_ano_15}}', f"{altura_barra_ano_15}px")
        template_html = template_html.replace('{{altura_barra_ano_20}}', f"{altura_barra_ano_20}px")
        template_html = template_html.replace('{{altura_barra_ano_25}}', f"{altura_barra_ano_25}px")
        
        # Substituir valores das contas
        template_html = template_html.replace('{{conta_ano_1}}', f"R$ {conta_ano_1:,.2f}")
        template_html = template_html.replace('{{conta_ano_5}}', f"R$ {conta_ano_5:,.2f}")
        template_html = template_html.replace('{{conta_ano_10}}', f"R$ {conta_ano_10:,.2f}")
        template_html = template_html.replace('{{conta_ano_15}}', f"R$ {conta_ano_15:,.2f}")
        template_html = template_html.replace('{{conta_ano_20}}', f"R$ {conta_ano_20:,.2f}")
        template_html = template_html.replace('{{conta_ano_25}}', f"R$ {conta_ano_25:,.2f}")
        
        print("📊 === FIM DEBUG GRÁFICO SLIDE-03 (visualizar) ===")
        
        # ====== SLIDE 04 - GRÁFICO DE LINHA ======
        print(f"📊 === DEBUG GRÁFICO SLIDE-04 (visualizar) ===")
        
        # Gerar gráfico de linha para slide-04
        if conta_atual_anual > 0:
            # Usar os mesmos valores do slide-03
            valores_linha = valores
            labels_linha = labels
            
            # Gerar gráfico de linha usando base64
            chart_base64_linha = generate_chart_base64(
                'line', 
                valores_linha, 
                labels_linha, 
                "Evolução da Conta de Luz (25 anos)",
                ['#3b82f6']
            )
            
            if chart_base64_linha:
                print("✅ Gráfico slide-04 gerado com sucesso!")
                # Substituir o src da imagem do slide-04
                template_html = template_html.replace(
                    'id="grafico-slide-04" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdyw6FmaWNvIFNsaWRlLTA0PC90ZXh0Pgo8L3N2Zz4K"',
                    f'id="grafico-slide-04" src="{chart_base64_linha}"'
                )
            else:
                print("❌ Erro ao gerar gráfico de linha matplotlib")
        
        print(f"📊 === FIM DEBUG GRÁFICO SLIDE-04 (visualizar) ===")
        
        # ====== SLIDE 05 - GRÁFICO DE BARRAS DUPLAS ======
        print("📊 === DEBUG GRÁFICO SLIDE-05 (visualizar) ===")
        
        # Gerar gráfico de barras duplas para slide-05 (Consumo x Geração)
        if conta_atual_anual > 0:
            # Dados simulados para produção e consumo mensal
            meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
            producao_mensal = [120, 110, 130, 100, 90, 80, 85, 95, 110, 125, 135, 140]  # kWh/mês
            consumo_mensal = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]  # kWh/mês
            
            # Gerar gráfico de barras duplas usando base64
            chart_base64_slide05 = generate_chart_base64(
                'dual_bar',
                [producao_mensal, consumo_mensal],
                meses,
                "Consumo x Geração (kWh/mês)",
                ['#2ca02c', '#d62728']  # Verde para produção, vermelho para consumo
            )
            
            if chart_base64_slide05:
                print("✅ Gráfico slide-05 gerado com sucesso!")
                # Substituir o src da imagem do slide-05
                template_html = template_html.replace(
                    'id="grafico-slide-05" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdyw6FmaWNvIFNsaWRlLTA1PC90ZXh0Pgo8L3N2Zz4K"',
                    f'id="grafico-slide-05" src="{chart_base64_slide05}"'
                )
            else:
                print("❌ Erro ao gerar gráfico de barras duplas matplotlib")
        
        print("📊 === FIM DEBUG GRÁFICO SLIDE-05 (visualizar) ===")
        
        # ====== SLIDE 06 - GRÁFICO DE PAYBACK ======
        print("📊 === DEBUG GRÁFICO SLIDE-06 (visualizar) ===")
        print(f"conta_atual_anual: {conta_atual_anual}")
        
        # Gerar gráfico de payback para slide-06 (Economia Acumulada vs Investimento)
        if conta_atual_anual > 0:
            print("✅ Condição conta_atual_anual > 0 satisfeita")
            # Dados para gráfico de payback
            anos = ['Ano 1', 'Ano 5', 'Ano 10', 'Ano 15', 'Ano 20', 'Ano 25']
            investimento_inicial = proposta_data.get('custo_total_projeto', 50000)
            economia_mensal = proposta_data.get('economia_mensal_estimada', 75)
            
            print(f"investimento_inicial: {investimento_inicial}")
            print(f"economia_mensal: {economia_mensal}")
            
            # Calcular economia acumulada ao longo dos anos
            economia_acumulada = []
            for i in range(len(anos)):
                economia_acumulada.append(economia_mensal * 12 * (i + 1))
            
            print(f"economia_acumulada: {economia_acumulada}")
            
            # Criar gráfico de linha dupla usando base64
            chart_base64_slide06 = generate_chart_base64(
                'line',
                economia_acumulada,
                anos,
                "Economia Acumulada vs Investimento",
                ['#2ca02c']  # Verde para economia
            )
            
            if chart_base64_slide06:
                print("✅ Gráfico slide-06 gerado com sucesso!")
                # Substituir apenas o src da imagem do slide-06 usando regex
                import re
                pattern = r'id="grafico-slide-06" src="[^"]*"'
                replacement = f'id="grafico-slide-06" src="{chart_base64_slide06}"'
                template_html = re.sub(pattern, replacement, template_html)
            else:
                print("❌ Erro ao gerar gráfico de payback matplotlib")
        else:
            print("❌ Condição conta_atual_anual > 0 NÃO satisfeita")
        
        print("📊 === FIM DEBUG GRÁFICO SLIDE-06 (visualizar) ===")
        
        # ====== SLIDE 09 - GRÁFICO COMPARATIVO ======
        print("📊 === DEBUG GRÁFICO SLIDE-09 (visualizar) ===")
        print(f"conta_atual_anual: {conta_atual_anual}")
        
        # Gerar gráfico comparativo para slide-09
        if conta_atual_anual > 0:
            print("✅ Condição conta_atual_anual > 0 satisfeita para slide-09")
            # Dados para comparação: gastos sem solar vs economia com solar
            anos = ['Ano 1', 'Ano 5', 'Ano 10', 'Ano 15', 'Ano 20', 'Ano 25']
            gastos_sem_solar = [conta_atual_anual, conta_ano_5, conta_ano_10, conta_ano_15, conta_ano_20, conta_ano_25]
            economia_com_solar = [0, 0, 0, 0, 0, 0]  # Economia acumulada
            
            print(f"gastos_sem_solar: {gastos_sem_solar}")
            
            # Calcular economia acumulada
            economia_mensal = proposta_data.get('economia_mensal_estimada', 75)
            for i in range(len(anos)):
                economia_com_solar[i] = economia_mensal * 12 * (i + 1)
            
            print(f"economia_com_solar: {economia_com_solar}")
            
            # Gerar gráfico de linha comparativo usando base64
            chart_base64_slide09 = generate_chart_base64(
                'line',
                gastos_sem_solar,
                anos,
                "Evolução dos Gastos - Próximos 25 Anos",
                ['#d62728'],  # Vermelho para gastos sem solar
                figsize=(18, 10)  # Proporção mais equilibrada
            )
            
            if chart_base64_slide09:
                print("✅ Gráfico slide-09 gerado com sucesso!")
                # Substituir apenas o src da imagem do slide-09 usando regex
                import re
                pattern = r'id="grafico-slide-09" src="[^"]*"'
                replacement = f'id="grafico-slide-09" src="{chart_base64_slide09}"'
                template_html = re.sub(pattern, replacement, template_html)
            else:
                print("❌ Erro ao gerar gráfico comparativo matplotlib")
        else:
            print("❌ Condição conta_atual_anual > 0 NÃO satisfeita para slide-09")
        
        print("📊 === FIM DEBUG GRÁFICO SLIDE-09 (visualizar) ===")
        # Garantir gráficos oficiais também aqui (fallback robusto)
        try:
            template_html = apply_analise_financeira_graphs(template_html, proposta_data)
        except Exception as e:
            print(f"⚠️ Falha ao aplicar gráficos via analise_financeira no visualizar_proposta: {e}")
        
        return template_html
        
    except Exception as e:
        return f"<html><body><h1>Erro ao carregar proposta: {str(e)}</h1></body></html>", 500

# Endpoint antigo removido - agora usamos apenas os endpoints HTML

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Servidor Python funcionando'})


@app.route('/db/health', methods=['GET'])
def db_health():
    try:
        db = SessionLocal()
        db.execute('SELECT 1')
        db.close()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/db/importar-locais', methods=['POST'])
def importar_locais():
    """Importa dados locais (data/*.json, propostas/*.json) para o DB."""
    try:
        db = SessionLocal()
        import_count = 0

        # Importar propostas da pasta 'propostas'
        for file in PROPOSTAS_DIR.glob('*.json'):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                prop_id = file.stem
                # pular se já existe
                exists = db.get(PropostaDB, prop_id)
                if exists:
                    continue
                row = PropostaDB(
                    id=prop_id,
                    cliente_nome=data.get('cliente_nome'),
                    cliente_endereco=data.get('cliente_endereco'),
                    cliente_telefone=data.get('cliente_telefone'),
                    cidade=data.get('cidade'),
                    potencia_sistema=data.get('potencia_sistema'),
                    preco_final=data.get('preco_final'),
                    conta_atual_anual=data.get('conta_atual_anual'),
                    anos_payback=data.get('anos_payback'),
                    gasto_acumulado_payback=data.get('gasto_acumulado_payback'),
                    consumo_mensal_kwh=float(data.get('consumo_mensal_kwh', 0) or 0),
                    tarifa_energia=data.get('tarifa_energia'),
                    economia_mensal_estimada=data.get('economia_mensal_estimada'),
                    quantidade_placas=data.get('quantidade_placas'),
                    potencia_placa_w=int(data.get('potencia_placa_w', 0) or 0),
                    area_necessaria=data.get('area_necessaria'),
                    irradiacao_media=data.get('irradiacao_media'),
                    geracao_media_mensal=data.get('geracao_media_mensal'),
                    creditos_anuais=data.get('creditos_anuais'),
                    economia_total_25_anos=data.get('economia_total_25_anos'),
                    payback_meses=data.get('payback_meses'),
                    custo_total_projeto=data.get('custo_total_projeto'),
                    custo_equipamentos=data.get('custo_equipamentos'),
                    custo_instalacao=data.get('custo_instalacao'),
                    custo_homologacao=data.get('custo_homologacao'),
                    custo_outros=data.get('custo_outros'),
                    margem_lucro=data.get('margem_lucro'),
                    payload=data,
                )
                db.add(row)
                import_count += 1
            except Exception as e:
                print(f"⚠️ Falha ao importar {file.name}: {e}")

        db.commit()
        db.close()
        return jsonify({'success': True, 'imported': import_count})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/teste-imagem')
def teste_imagem():
    """Página de teste para verificar se as imagens estão carregando"""
    try:
        teste_path = Path(__file__).parent / "public" / "teste_imagem.html"
        if teste_path.exists():
            with open(teste_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            return "Arquivo de teste não encontrado", 404
    except Exception as e:
        return f"Erro ao carregar teste: {str(e)}", 500

@app.route('/img/<path:filename>')
def serve_image(filename):
    """Serve static images from public/img/ directory"""
    try:
        img_path = Path(__file__).parent / "public" / "img" / filename
        if img_path.exists() and img_path.is_file():
            return send_file(img_path)
        else:
            return "Image not found", 404
    except Exception as e:
        return f"Error serving image: {str(e)}", 500

@app.route('/charts/<filename>')
def serve_chart(filename):
    """Serve arquivos de gráficos"""
    try:
        chart_path = Path(__file__).parent / "public" / "charts" / filename
        if chart_path.exists():
            return send_file(chart_path, mimetype='image/png')
        else:
            return "Arquivo não encontrado", 404
    except Exception as e:
        print(f"❌ Erro ao servir gráfico {filename}: {e}")
        return "Erro interno", 500

def cleanup_old_charts():
    """Remove gráficos antigos (mais de 1 hora)"""
    try:
        charts_dir = Path(__file__).parent / "public" / "charts"
        if not charts_dir.exists():
            return
        
        current_time = time.time()
        for chart_file in charts_dir.glob("*.png"):
            if current_time - chart_file.stat().st_mtime > 3600:  # 1 hora
                chart_file.unlink()
                print(f"🗑️ Gráfico antigo removido: {chart_file.name}")
    except Exception as e:
        print(f"❌ Erro ao limpar gráficos antigos: {e}")

@app.route('/admin/firebase/delete-user', methods=['POST'])
def admin_firebase_delete_user():
    if not FIREBASE_ADMIN_AVAILABLE:
        return jsonify({'success': False, 'message': 'Firebase Admin não configurado no servidor'}), 500
    try:
        data = request.get_json() or {}
        uid = data.get('uid')
        if not uid:
            return jsonify({'success': False, 'message': 'UID obrigatório'}), 400
        fb_auth.delete_user(uid)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/admin/firebase/list-users', methods=['GET'])
def admin_firebase_list_users():
    """
    Lista usuários do Firebase Auth (UID, email, display_name, phone, metadata).
    Requer Firebase Admin configurado.
    """
    if not FIREBASE_ADMIN_AVAILABLE:
        return jsonify({'success': False, 'message': 'Firebase Admin não configurado no servidor'}), 500
    try:
        users = []
        page = fb_auth.list_users()
        while page:
            for u in page.users:
                users.append({
                    'uid': u.uid,
                    'email': u.email,
                    'display_name': u.display_name,
                    'phone_number': u.phone_number,
                    'disabled': u.disabled,
                    'email_verified': u.email_verified,
                    'provider_ids': [p.provider_id for p in (u.provider_data or [])],
                    'metadata': {
                        'creation_time': getattr(u.user_metadata, 'creation_timestamp', None),
                        'last_sign_in_time': getattr(u.user_metadata, 'last_sign_in_timestamp', None),
                    }
                })
            page = page.get_next_page()
        return jsonify({'success': True, 'users': users})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/admin/firebase/generate-reset-link', methods=['POST'])
def admin_firebase_generate_reset_link():
    # Desativado: criação/gestão de usuários deve ser feita manualmente no Firebase
    return jsonify({'success': False, 'message': 'Desativado'}), 404

def _get_app_base_url() -> str:
    # Base pública usada nos links dos e-mails
    env_url = os.environ.get("APP_PUBLIC_URL")
    if env_url:
        return env_url.rstrip("/")
    return "http://localhost:3003"

def _send_smtp_email(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> tuple[bool, str]:
    # Desativado: envio de e-mails não é realizado pelo servidor
    return False, "desativado"

def _send_sendgrid_email(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> tuple[bool, str]:
    # Desativado: envio de e-mails não é realizado pelo servidor
    return False, "desativado"

@app.route('/admin/firebase/send-invite', methods=['POST'])
def admin_firebase_send_invite():
    # Desativado: envio de convites/e-mails não é mais responsabilidade do app
    return jsonify({'success': False, 'message': 'Desativado'}), 404

# ===== Roles (controle de acesso pelo backend) =====
@app.route('/auth/role', methods=['GET'])
def get_user_role():
    """
    Retorna a role do usuário a partir do e-mail.
    Ex.: /auth/role?email=john@doe.com -> { role: "admin" | "gestor" | "vendedor" | "instalador" }
    Padrão: "vendedor" quando não configurado.
    """
    try:
        email = (request.args.get('email') or '').strip().lower()
        mapping = _load_roles()
        # Bootstrap: se ainda não há nenhum mapeamento, o primeiro e-mail consultado vira admin
        if email and len(mapping.keys()) == 0:
            mapping[email] = 'admin'
            _save_roles(mapping)
            print(f"🔐 Bootstrap de roles: '{email}' definido como admin.")
        raw = mapping.get(email, 'vendedor')
        role = raw.get('role') if isinstance(raw, dict) else raw
        nome = raw.get('nome') if isinstance(raw, dict) else None
        return jsonify({'role': role or 'vendedor', 'nome': nome})
    except Exception as e:
        return jsonify({'role': 'vendedor', 'message': str(e)}), 200

@app.route('/auth/roles', methods=['GET'])
def list_roles():
    """
    Retorna o mapeamento completo de roles (apenas e-mail -> role).
    """
    try:
        mapping = _load_roles()
        items = []
        for k, v in mapping.items():
            if isinstance(v, dict):
                items.append({'email': k, 'role': v.get('role'), 'nome': v.get('nome')})
            else:
                items.append({'email': k, 'role': v})
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/auth/roles', methods=['POST'])
def upsert_role():
    """
    Define/atualiza a role de um e-mail.
    Body: { email: string, role: string }
    """
    try:
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        role = (data.get('role') or '').strip().lower()
        nome = (data.get('nome') or '').strip() or None
        if not email or role not in ('admin', 'gestor', 'vendedor', 'instalador'):
            return jsonify({'success': False, 'message': 'Parâmetros inválidos'}), 400
        mapping = _load_roles()
        current = mapping.get(email)
        if isinstance(current, dict):
            current['role'] = role
            if nome is not None:
                current['nome'] = nome
            mapping[email] = current
        else:
            obj = {'role': role}
            if nome is not None:
                obj['nome'] = nome
            mapping[email] = obj
        _save_roles(mapping)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/auth/roles', methods=['DELETE'])
def delete_role():
    """
    Remove o mapeamento de role (o acesso continua existindo no Firebase; aqui só tiramos a permissão customizada).
    Body: { email: string }
    """
    try:
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email obrigatório'}), 400
        mapping = _load_roles()
        if email in mapping:
            del mapping[email]
            _save_roles(mapping)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/projetos/delete/<projeto_id>', methods=['DELETE'])
def deletar_projeto(projeto_id):
    """
    Remove um projeto/proposta do backend:
    - Apaga arquivo propostas/<id>.json
    - Apaga PDF relacionado (se existir)
    - Remove registro do banco (best-effort)
    """
    try:
        # Remover JSON
        json_path = PROPOSTAS_DIR / f"{projeto_id}.json"
        if json_path.exists():
            json_path.unlink()
            print(f"🗑️ Removido arquivo de proposta: {json_path.name}")
        # Remover PDF (se existir)
        pdf_path = PDFS_DIR / f"{projeto_id}.pdf"
        if pdf_path.exists():
            pdf_path.unlink()
            print(f"🗑️ Removido PDF da proposta: {pdf_path.name}")
        # Remover do banco (best-effort)
        try:
            db = SessionLocal()
            row = db.get(PropostaDB, projeto_id)
            if row:
                db.delete(row)
                db.commit()
            db.close()
        except Exception as e:
            print(f"⚠️ Falha ao remover do banco: {e}")
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# alias compatível
@app.route('/projeto/delete/<projeto_id>', methods=['DELETE'])
def deletar_projeto_alias(projeto_id):
    return deletar_projeto(projeto_id)

@app.route('/projetos/status', methods=['POST'])
def atualizar_status_projeto():
    """
    Atualiza o status de um projeto listado a partir dos arquivos em 'propostas/'.
    Body: { id: string, status: 'dimensionamento'|'orcamento_enviado'|'negociacao'|'fechado'|'instalacao' }
    """
    try:
        data = request.get_json() or {}
        prop_id = (data.get('id') or '').strip()
        new_status = (data.get('status') or '').strip()
        allowed = ('dimensionamento', 'orcamento_enviado', 'negociacao', 'fechado', 'instalacao', 'concluido', 'perdido')
        if not prop_id or new_status not in allowed:
            return jsonify({'success': False, 'message': 'Parâmetros inválidos'}), 400
        prop_file = PROPOSTAS_DIR / f"{prop_id}.json"
        if not prop_file.exists():
            return jsonify({'success': False, 'message': 'Proposta não encontrada'}), 404
        with open(prop_file, 'r', encoding='utf-8') as f:
            content = json.load(f)
        content['status'] = new_status
        with open(prop_file, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/projetos/list', methods=['GET'])
def listar_projetos():
    """
    Lista projetos a partir dos arquivos JSON gerados em 'propostas/' para alimentar o dashboard.
    Retorna uma coleção normalizada de projetos (não depende do Supabase).
    """
    try:
        projetos = []
        for file in PROPOSTAS_DIR.glob("*.json"):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                projeto = {
                    "id": file.stem,
                    "nome_projeto": data.get("nome_projeto") or f"Projeto - {data.get('cliente_nome','Cliente')}",
                    "cliente_id": data.get("cliente_id"),
                    "cliente": {
                        "nome": data.get("cliente_nome"),
                        "telefone": data.get("cliente_telefone"),
                        "email": data.get("vendedor_email"),
                    },
                    "cliente_nome": data.get("cliente_nome"),
                    "preco_final": data.get("preco_final") or data.get("custo_total_projeto") or 0,
                    "cidade": data.get("cidade"),
                    "estado": data.get("estado"),
                    # Requisito: recem gerados devem cair em "dimensionamento"
                    "status": data.get("status") or "dimensionamento",
                    "prioridade": data.get("prioridade") or "Normal",
                    "created_date": data.get("data_criacao") or datetime.now().isoformat(),
                    "url_proposta": f"/proposta/{file.stem}"
                }
                projetos.append(projeto)
            except Exception as e:
                print(f"⚠️ Falha ao ler proposta {file.name}: {e}")
                continue
        # ordenar por data (desc)
        projetos.sort(key=lambda p: p.get("created_date") or "", reverse=True)
        return jsonify(projetos)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    # Inicializa o banco (SQLite por padrão; PostgreSQL via DATABASE_URL)
    try:
        init_db()
        print('✅ Banco de dados inicializado')
    except Exception as e:
        print(f'⚠️ Falha ao inicializar DB: {e}')
    app.run(host='0.0.0.0', port=8000, debug=True)
