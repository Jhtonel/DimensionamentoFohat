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
import logging
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import io
import re
import time
import csv
#
from db import init_db, SessionLocal, PropostaDB, ClienteDB, EnderecoDB, UserDB, RoleDB, ConfigDB, DATABASE_URL
from sqlalchemy import text, func, or_
# WeasyPrint comentado - requer: brew install cairo pango gdk-pixbuf libffi
# from weasyprint import HTML, CSS
# from weasyprint.text.fonts import FontConfiguration
from dimensionamento_core import calcular_dimensionamento
# import requests  # Removido para evitar erro de permissão em sandbox
import urllib.request
import urllib.error
from urllib.parse import urljoin
from datetime import date
import jwt
# bcrypt é opcional; não é necessário para geração de propostas/gráficos estáticos
bcrypt = None

app = Flask(__name__)
CORS(app)

# Flag simples: em produção (Railway) vamos preferir Postgres quando DATABASE_URL for postgresql://
USE_DB = str(DATABASE_URL or "").startswith("postgresql")

# Garantir que as tabelas existam também quando rodando via gunicorn (import mode),
# especialmente em produção com Postgres.
try:
    init_db()
    print("✅ DB schema pronto (init_db)")
except Exception as _init_err:
    print(f"⚠️ Falha ao preparar schema do DB (init_db): {_init_err}")

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
VIEWS_FILE = DATA_DIR / "proposta_views.json"

# -----------------------------------------------------------------------------
# Rastreamento de Visualizações
# -----------------------------------------------------------------------------
def _load_views() -> dict:
    """Carrega métricas de visualização das propostas."""
    try:
        if VIEWS_FILE.exists():
            with open(VIEWS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
    except Exception as e:
        print(f"⚠️ Falha ao carregar views: {e}")
    return {}

def _save_views(views: dict) -> None:
    """Salva métricas de visualização das propostas."""
    try:
        with open(VIEWS_FILE, "w", encoding="utf-8") as f:
            json.dump(views, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Falha ao salvar views: {e}")

def _registrar_visualizacao(proposta_id: str, request_obj) -> dict:
    """Registra uma visualização de proposta e retorna métricas atualizadas."""
    views = _load_views()
    
    if proposta_id not in views:
        views[proposta_id] = {
            "total_views": 0,
            "unique_ips": [],
            "first_view": None,
            "last_view": None,
            "views_history": []
        }
    
    now = datetime.now().isoformat()
    ip = request_obj.remote_addr or "unknown"
    user_agent = request_obj.headers.get('User-Agent', 'unknown')
    referrer = request_obj.headers.get('Referer', '')
    
    # Incrementar contador total
    views[proposta_id]["total_views"] += 1
    
    # Registrar IP único
    if ip not in views[proposta_id]["unique_ips"]:
        views[proposta_id]["unique_ips"].append(ip)
    
    # Atualizar timestamps
    if not views[proposta_id]["first_view"]:
        views[proposta_id]["first_view"] = now
    views[proposta_id]["last_view"] = now
    
    # Adicionar ao histórico (limitar a 100 registros)
    view_record = {
        "timestamp": now,
        "ip": ip,
        "user_agent": user_agent[:100] if user_agent else "",
        "referrer": referrer[:200] if referrer else ""
    }
    views[proposta_id]["views_history"].append(view_record)
    if len(views[proposta_id]["views_history"]) > 100:
        views[proposta_id]["views_history"] = views[proposta_id]["views_history"][-100:]
    
    _save_views(views)
    
    return {
        "total_views": views[proposta_id]["total_views"],
        "unique_views": len(views[proposta_id]["unique_ips"]),
        "first_view": views[proposta_id]["first_view"],
        "last_view": views[proposta_id]["last_view"]
    }

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
def parse_float(value, default: float = 0.0) -> float:
    """
    Conversor robusto para números que podem vir como string BRL (ex.: 'R$ 185.645,23').
    """
    try:
        if isinstance(value, str):
            s = value.strip()
            for token in ['R$', 'r$', ' ']:
                s = s.replace(token, '')
            s = s.replace('.', '').replace(',', '.')
            return float(s)
        return float(value)
    except Exception:
        return default

# Arquivos de dados
TAXAS_FILE = DATA_DIR / "taxas_distribuicao.json"
CONCESSIONARIAS_FILE = DATA_DIR / "concessionarias.json"

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

def _parse_env_emails(var_name: str) -> set[str]:
    """
    Lê uma lista de e-mails de uma env var (separada por vírgula, ponto-e-vírgula ou espaços).
    Ex.: ADMIN_EMAILS="admin@fohat.com, outro@fohat.com"
    """
    raw = (os.environ.get(var_name) or "").strip()
    if not raw:
        return set()
    parts = re.split(r"[,\s;]+", raw)
    return {p.strip().lower() for p in parts if p and p.strip()}

def _is_prod() -> bool:
    # Railway seta RAILWAY_ENVIRONMENT_NAME/RAILWAY_ENVIRONMENT
    env = (os.environ.get("RAILWAY_ENVIRONMENT_NAME") or os.environ.get("RAILWAY_ENVIRONMENT") or "").strip().lower()
    return env in ("production", "prod")

def _require_role_admin_secret() -> bool:
    """
    Protege endpoints de escrita de roles.
    - Se ROLE_ADMIN_SECRET estiver definido, exige header X-Admin-Secret com o mesmo valor.
    - Se não estiver definido, retorna True (mantém compatibilidade local).
    """
    secret = (os.environ.get("ROLE_ADMIN_SECRET") or "").strip()
    if not secret:
        return True
    provided = (request.headers.get("X-Admin-Secret") or "").strip()
    return provided == secret

def _get_bearer_token() -> str:
    try:
        h = (request.headers.get("Authorization") or "").strip()
        if not h:
            return ""
        if h.lower().startswith("bearer "):
            return h.split(" ", 1)[1].strip()
        return ""
    except Exception:
        return ""

def _require_admin_access() -> bool:
    """
    Protege endpoints administrativos.
    Compat legado: este helper existe para endpoints antigos.
    Regras (sem Firebase):
    - Se ROLE_ADMIN_SECRET estiver definido: exige X-Admin-Secret.
    - Caso contrário: permite apenas em DEV/local.
    """
    # Secret (quando configurado) sempre é aceito
    secret = (os.environ.get("ROLE_ADMIN_SECRET") or "").strip()
    if secret and _require_role_admin_secret():
        return True

    # Se não é produção e não há secret, permitir (compat)
    if (not _is_prod()) and (not secret):
        return True

    return False

# -----------------------------------------------------------------------------
# Auth próprio (Postgres) - JWT
# -----------------------------------------------------------------------------
def _app_jwt_secret() -> str:
    return (os.environ.get("JWT_SECRET") or os.environ.get("APP_JWT_SECRET") or "").strip()

def _create_app_jwt(email: str) -> str:
    secret = _app_jwt_secret()
    if not secret:
        raise RuntimeError("JWT_SECRET não definido")
    now = int(time.time())
    payload = {"sub": email.lower(), "iat": now, "exp": now + (60 * 60 * 24 * 14)}  # 14 dias
    return jwt.encode(payload, secret, algorithm="HS256")

def _decode_app_jwt(token: str) -> dict | None:
    try:
        secret = _app_jwt_secret()
        if not secret:
            return None
        return jwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        return None

def _get_request_email_from_app_jwt() -> str | None:
    tok = _get_bearer_token()
    if not tok:
        return None
    decoded = _decode_app_jwt(tok)
    if not decoded:
        return None
    email = (decoded.get("sub") or "").strip().lower()
    return email or None

def _require_auth() -> str | None:
    """
    Retorna e-mail autenticado via JWT do app (Authorization: Bearer).
    """
    email = _get_request_email_from_app_jwt()
    return email

def _current_user_row():
    """
    Retorna o registro UserDB do usuário autenticado (ou None).
    """
    email = _require_auth()
    if not email:
        return None
    try:
        db = SessionLocal()
        u = db.query(UserDB).filter(UserDB.email == email).first()
        db.close()
        return u
    except Exception:
        return None

def _require_admin_access_app() -> bool:
    """
    Admin baseado no nosso banco:
    - aceita ROLE_ADMIN_SECRET (compat)
    - ou JWT do app com user.role == admin/gestor
    - ou e-mail presente em ADMIN_EMAILS
    """
    secret = (os.environ.get("ROLE_ADMIN_SECRET") or "").strip()
    if secret and _require_role_admin_secret():
        return True
    email = _get_request_email_from_app_jwt()
    if not email:
        return False
    # Override por env (produção)
    try:
        admin_emails = _parse_env_emails("ADMIN_EMAILS")
        if email in admin_emails:
            return True
    except Exception:
        pass
    try:
        db = SessionLocal()
        u = db.query(UserDB).filter(UserDB.email == email).first()
        db.close()
        role = (u.role or "").strip().lower() if u else ""
        return bool(u and role in ("admin", "gestor"))
    except Exception:
        return False

def _hash_password(password: str) -> str:
    if not bcrypt:
        raise RuntimeError("bcrypt não está disponível neste ambiente.")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def _check_password(password: str, password_hash: str) -> bool:
    try:
        if not bcrypt:
            return False
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False

@app.route("/auth/login", methods=["POST"])
def auth_login():
    """
    Login no Postgres. Body: { email, password }
    Retorna: { success, token, user }
    """
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()
        if not email or not password:
            return jsonify({"success": False, "message": "Email e senha obrigatórios"}), 400
        db = SessionLocal()
        u = db.query(UserDB).filter(UserDB.email == email).first()
        db.close()
        if not u or not u.password_hash:
            return jsonify({"success": False, "message": "Credenciais inválidas"}), 401
        if not _check_password(password, u.password_hash):
            return jsonify({"success": False, "message": "Credenciais inválidas"}), 401
        token = _create_app_jwt(email)
        return jsonify({
            "success": True,
            "token": token,
            "user": {"email": u.email, "nome": u.nome, "role": u.role, "cargo": u.cargo, "uid": u.uid}
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/auth/me", methods=["GET"])
def auth_me():
    email = _require_auth()
    if not email:
        return jsonify({"success": False, "message": "Não autenticado"}), 401
    try:
        db = SessionLocal()
        u = db.query(UserDB).filter(UserDB.email == email).first()
        db.close()
        if not u:
            return jsonify({"success": False, "message": "Usuário não encontrado"}), 404
        return jsonify({"success": True, "user": {"email": u.email, "nome": u.nome, "role": u.role, "cargo": u.cargo, "uid": u.uid}})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/auth/change-password", methods=["POST"])
def auth_change_password():
    email = _require_auth()
    if not email:
        return jsonify({"success": False, "message": "Não autenticado"}), 401
    try:
        data = request.get_json() or {}
        current_pwd = (data.get("currentPassword") or "").strip()
        new_pwd = (data.get("newPassword") or "").strip()
        if not new_pwd or len(new_pwd) < 6:
            return jsonify({"success": False, "message": "Nova senha inválida (mínimo 6 caracteres)"}), 400
        db = SessionLocal()
        u = db.query(UserDB).filter(UserDB.email == email).first()
        if not u or not u.password_hash:
            db.close()
            return jsonify({"success": False, "message": "Usuário sem senha configurada"}), 400
        if not _check_password(current_pwd, u.password_hash):
            db.close()
            return jsonify({"success": False, "message": "Senha atual incorreta"}), 400
        u.password_hash = _hash_password(new_pwd)
        db.commit()
        db.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/auth/bootstrap-admin", methods=["POST"])
def auth_bootstrap_admin():
    """
    Cria o primeiro admin no Postgres (para migrar fora do Firebase).
    Requer header X-Admin-Secret=ROLE_ADMIN_SECRET.
    """
    if not _require_role_admin_secret():
        return jsonify({"success": False, "message": "Não autorizado"}), 403
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()
        nome = (data.get("nome") or "").strip() or None
        cargo = (data.get("cargo") or "").strip() or "Administrador"
        if not email or not password:
            return jsonify({"success": False, "message": "Email e senha obrigatórios"}), 400
        db = SessionLocal()
        total = db.query(UserDB).count()
        if total > 0:
            db.close()
            return jsonify({"success": False, "message": "Bootstrap já executado"}), 400
        uid = str(uuid.uuid4())
        u = UserDB(uid=uid, email=email, nome=nome or email.split("@")[0], role="admin", cargo=cargo, password_hash=_hash_password(password))
        db.add(u)
        db.commit()
        db.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/admin/users", methods=["GET"])
def admin_list_users():
    if not _require_admin_access_app():
        return jsonify({"success": False, "message": "Não autorizado"}), 403
    try:
        db = SessionLocal()
        rows = db.query(UserDB).order_by(UserDB.created_at.desc()).all()
        db.close()
        items = [{"uid": u.uid, "email": u.email, "nome": u.nome, "role": u.role, "cargo": u.cargo, "created_at": str(u.created_at)} for u in rows]
        return jsonify({"success": True, "items": items})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/admin/users", methods=["POST"])
def admin_create_user():
    if not _require_admin_access_app():
        return jsonify({"success": False, "message": "Não autorizado"}), 403
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()
        nome = (data.get("nome") or "").strip() or None
        role = (data.get("role") or "vendedor").strip().lower()
        cargo = (data.get("cargo") or "").strip() or None
        if not email or not password:
            return jsonify({"success": False, "message": "Email e senha obrigatórios"}), 400
        if role not in ("admin", "gestor", "vendedor", "instalador"):
            return jsonify({"success": False, "message": "Role inválida"}), 400
        db = SessionLocal()
        existing = db.query(UserDB).filter(UserDB.email == email).first()
        if existing:
            db.close()
            return jsonify({"success": False, "message": "Usuário já existe"}), 400
        uid = str(uuid.uuid4())
        u = UserDB(uid=uid, email=email, nome=nome or email.split("@")[0], role=role, cargo=cargo, password_hash=_hash_password(password))
        db.add(u)
        db.commit()
        db.close()
        return jsonify({"success": True, "uid": uid})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/admin/users/<uid>", methods=["PATCH"])
def admin_update_user(uid):
    if not _require_admin_access_app():
        return jsonify({"success": False, "message": "Não autorizado"}), 403
    try:
        data = request.get_json() or {}
        db = SessionLocal()
        u = db.query(UserDB).filter(UserDB.uid == uid).first()
        if not u:
            db.close()
            return jsonify({"success": False, "message": "Usuário não encontrado"}), 404
        if "nome" in data:
            u.nome = (data.get("nome") or "").strip()
        if "cargo" in data:
            u.cargo = (data.get("cargo") or "").strip()
        if "role" in data:
            role = (data.get("role") or "").strip().lower()
            if role not in ("admin", "gestor", "vendedor", "instalador"):
                db.close()
                return jsonify({"success": False, "message": "Role inválida"}), 400
            u.role = role
        if "password" in data and str(data.get("password") or "").strip():
            u.password_hash = _hash_password(str(data.get("password")).strip())
        db.commit()
        db.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/admin/users/<uid>", methods=["DELETE"])
def admin_delete_user(uid):
    if not _require_admin_access_app():
        return jsonify({"success": False, "message": "Não autorizado"}), 403
    try:
        db = SessionLocal()
        u = db.query(UserDB).filter(UserDB.uid == uid).first()
        if u:
            db.delete(u)
            db.commit()
        db.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

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

def _load_concessionarias() -> dict:
    """Carrega dados unificados das concessionárias (fonte ANEEL)."""
    if CONCESSIONARIAS_FILE.exists():
        try:
            with open(CONCESSIONARIAS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("concessionarias", {})
        except Exception as e:
            print(f"⚠️ Erro ao carregar concessionarias.json: {e}")
    return {}

def _get_tarifa_by_concessionaria(nome_concessionaria: str) -> float:
    """Busca a tarifa de uma concessionária pelo nome."""
    concessionarias = _load_concessionarias()
    nome_lower = nome_concessionaria.lower().strip()
    
    # Busca por slug exato
    slug = ''.join(ch.lower() if ch.isalnum() else '_' for ch in nome_lower).strip('_')
    if slug in concessionarias:
        return concessionarias[slug].get("tarifa_kwh", 0)
    
    # Busca por nome
    for key, data in concessionarias.items():
        if data.get("nome", "").lower() == nome_lower:
            return data.get("tarifa_kwh", 0)
    
    return 0

def _calcular_disponibilidade(te_rskwh: float, tusd_rskwh: float, tipo: str) -> float:
    # Custo de disponibilidade (Grupo B, RN 1000): mono 30 kWh; bi 50; tri 100
    kwh_min = 30 if tipo == "monofasica" else 50 if tipo == "bifasica" else 100
    return float(kwh_min) * (float(te_rskwh) + float(tusd_rskwh))

def _fetch_estrutura_tarifaria_aneel() -> list[dict]:
    url = "https://dados.aneel.gov.br/dataset/estrutura-tarifaria/resource/6f7bd2f1-1a0a-4b3a-9d4f-0cefa5f46ccf/download/estrutura_tarifaria_grupo_b.csv"
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            text = response.read().decode('utf-8')
            # csv -> linhas
            import csv
            reader = csv.DictReader(io.StringIO(text), delimiter=';')
            return list(reader)
    except Exception as e:
        print(f"⚠️ Erro ao buscar dados da ANEEL: {e}")
        return []

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

def apply_analise_financeira_graphs(template_html: str, proposta_data: dict) -> str:
    """
    Substitui as imagens dos 5 gráficos no template gerando-os a partir do núcleo
    único `calcular_dimensionamento`, garantindo consistência com a planilha.
    """
    try:
        # Extrair e normalizar entradas
        consumo_kwh = parse_float(proposta_data.get('consumo_mensal_kwh', 0), 0.0)
        consumo_reais = parse_float(proposta_data.get('consumo_mensal_reais', 0), 0.0)
        tarifa_kwh = parse_float(proposta_data.get('tarifa_energia', 0), 0.0)
        if consumo_kwh <= 0 and consumo_reais > 0 and tarifa_kwh > 0:
            consumo_kwh = consumo_reais / tarifa_kwh
        potencia_kwp = parse_float(proposta_data.get('potencia_sistema', proposta_data.get('potencia_kwp', 0)), 0.0)
        preco_venda = parse_float(
            proposta_data.get('preco_venda',
                              proposta_data.get('preco_final',
                                                proposta_data.get('custo_total_projeto', 0))),
            0.0
        )
        # Vetor de irradiância: preferir vindo do payload; senão média replicada
        irr_custom = proposta_data.get('irradiancia_mensal_kwh_m2_dia')
        if isinstance(irr_custom, list) and len(irr_custom) == 12:
            irr_vec = [parse_float(v, 0.0) for v in irr_custom]
        else:
            media = parse_float(proposta_data.get('irradiacao_media', 5.15), 5.15)
            try:
                irr_vec_csv = _resolve_irr_vec_from_csv(proposta_data.get('cidade'), media)
                irr_vec = irr_vec_csv if (isinstance(irr_vec_csv, list) and len(irr_vec_csv) == 12) else [media] * 12
            except Exception:
                irr_vec = [media] * 12

        # Calcular tabelas pelo núcleo (Lei 14.300/2022)
        core = calcular_dimensionamento({
            "consumo_mensal_kwh": consumo_kwh,
            "consumo_mensal_reais": consumo_reais,
            "tarifa_energia": tarifa_kwh,
            "potencia_sistema": potencia_kwp,
            "preco_venda": preco_venda,
            "irradiacao_media": parse_float(proposta_data.get('irradiacao_media', 5.15), 5.15),
            "irradiancia_mensal_kwh_m2_dia": irr_vec,
            "ano_instalacao": 2026,  # Lei 14.300
        })
        tabelas = core.get("tabelas") or {}
        metrics = core.get("metrics") or {}

        # --------------------------
        # ECharts (SVG) — datasets (Lei 14.300/2022)
        # --------------------------
        # Todos os dados vêm do núcleo que já aplica:
        # - Degradação do sistema (0.75%/ano)
        # - TUSD Fio B (não compensável)
        # - Custos de manutenção (1%/ano)
        # - Substituição do inversor (ano 12)
        cas = tabelas.get("custo_acumulado_sem_solar_r") or []
        ca = tabelas.get("custo_anual_sem_solar_r") or []
        fca = tabelas.get("fluxo_caixa_acumulado_r") or []  # Fluxo com Lei 14.300
        consumo_tbl = (tabelas.get("consumo_mensal_kwh") or []) if tabelas else []
        # `consumo_mensal_kwh` no núcleo pode vir como:
        # - número único (média mensal) -> [avg]
        # - vetor 12 meses -> [jan..dez]
        consumo_mes = float(consumo_tbl[0]) if (isinstance(consumo_tbl, list) and len(consumo_tbl) >= 1) else 0
        prod_mes = (tabelas.get("producao_mensal_kwh_ano1") or [])

        meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        
        # ==============================================
        # GRÁFICOS DA PROPOSTA (Lei 14.300/2022)
        # Todos os dados já incluem:
        # - TUSD Fio B (não compensável)
        # - Degradação do sistema (0.75%/ano)
        # - Custos de manutenção (1%/ano)
        # - Substituição do inversor (ano 12)
        # ==============================================
        
        # Slide 03 — Cenário atual: gasto acumulado sem solar (anos 1,5,10,15,20,25)
        idxs = [0, 4, 9, 14, 19, 24]
        s03_vals = [float(cas[i]) for i in idxs] if len(cas) >= 25 else []
        s03_labs = [f"Ano {i+1}" for i in idxs]

        # Slide 04 — Evolução da conta: custo anual sem solar (25 anos)
        # Com reajuste de tarifa de 5% ao ano
        s04_vals = [float(v) for v in ca] if ca else []
        s04_labs = [f"Ano {i+1}" for i in range(len(s04_vals))]

        # Slide 05 — Consumo vs Produção (kWh/mês - Ano 1)
        # Requisito: quando o usuário informa consumo mês a mês, usar o vetor real (não a média).
        def _extract_consumo_vec() -> list[float]:
            # 1) Preferir consumo mês-a-mês vindo do frontend (lista de dicts)
            try:
                cmm = proposta_data.get("consumo_mes_a_mes")
                if isinstance(cmm, list) and len(cmm) > 0:
                    out = [None] * 12
                    months_map = {
                        "jan": 0, "janeiro": 0,
                        "fev": 1, "fevereiro": 1,
                        "mar": 2, "março": 2, "marco": 2,
                        "abr": 3, "abril": 3,
                        "mai": 4, "maio": 4,
                        "jun": 5, "junho": 5,
                        "jul": 6, "julho": 6,
                        "ago": 7, "agosto": 7,
                        "set": 8, "setembro": 8,
                        "out": 9, "outubro": 9,
                        "nov": 10, "novembro": 10,
                        "dez": 11, "dezembro": 11,
                    }
                    seq_i = 0
                    for item in cmm[:24]:
                        if not isinstance(item, dict):
                            continue
                        v = parse_float(item.get("kwh", item.get("valor", item.get("value", 0))), None)
                        if v is None:
                            continue
                        mes_raw = (item.get("mes") or item.get("month") or item.get("label") or "")
                        mes_s = str(mes_raw).strip().lower()
                        idx = None
                        # abreviações e nomes
                        if mes_s in months_map:
                            idx = months_map[mes_s]
                        else:
                            # "Jan/2026", "01/2026", "2026-01" etc.
                            m = re.search(r"(\d{1,2})", mes_s)
                            if m:
                                try:
                                    n = int(m.group(1))
                                    if 1 <= n <= 12:
                                        idx = n - 1
                                except Exception:
                                    idx = None
                            if idx is None:
                                # tentar por prefixo "jan", "fev", etc.
                                for k, i in months_map.items():
                                    if mes_s.startswith(k):
                                        idx = i
                                        break
                        if idx is None:
                            # fallback: assume ordem de inserção
                            if seq_i < 12:
                                idx = seq_i
                                seq_i += 1
                        if idx is not None and 0 <= idx < 12:
                            out[idx] = float(v)
                    vals = [x for x in out if isinstance(x, (int, float))]
                    if vals:
                        avg = sum(vals) / len(vals)
                        return [float(x) if isinstance(x, (int, float)) else float(avg) for x in out]
            except Exception:
                pass

            # 2) Vetores alternativos (legado/compat)
            for k in [
                "consumo_mensal_kwh_meses", "consumo_mes_a_mes_kwh", "consumo_kwh_mensal",
                "consumo_kwh_12meses", "consumo_mensal_kwh_array"
            ]:
                v = proposta_data.get(k)
                if isinstance(v, list) and len(v) >= 12:
                    out = [parse_float(x, 0.0) for x in v[:12]]
                    return [float(x) for x in out]

            # 3) Se o núcleo já devolveu 12 meses, usar
            if isinstance(consumo_tbl, list) and len(consumo_tbl) == 12:
                return [parse_float(x, 0.0) for x in consumo_tbl]

            # 4) Fallback: média mensal replicada
            base = float(consumo_mes or 0.0)
            return [base] * 12 if base > 0 else [0.0] * 12

        consumo_vec = _extract_consumo_vec()
        prod_vec = [float(v) for v in (prod_mes[:12] if prod_mes else [])]
        if not prod_vec or len(prod_vec) != 12:
            prod_anual_kwh = (tabelas.get("producao_anual_kwh") or [0])[0] if tabelas else 0
            if float(prod_anual_kwh or 0) > 0:
                prod_vec = [float(prod_anual_kwh) / 12.0] * 12
            else:
                prod_vec = [0.0] * 12

        # Slide 06 — Payback: fluxo de caixa acumulado (25 anos)
        # LEI 14.300: Inclui TUSD Fio B, manutenção, degradação
        # O ponto onde cruza zero é o payback real
        s06_vals = [float(v) for v in fca] if fca else []
        s06_labs = [f"Ano {i+1}" for i in range(len(s06_vals))]

        # Slide 09 — Comparativo financeiro (25 anos)
        # Compara gasto total sem solar vs investimento inicial
        gasto_total_25 = float(cas[-1]) if cas else 0.0
        investimento = float(preco_venda or 0.0)
        s09_vals = [gasto_total_25, investimento]
        s09_labs = ["Sem energia solar (25 anos)", "Investimento (preço de venda)"]

        charts_payload = {
            "brand": {"blue": "#1E3A8A", "green": "#059669", "red": "#DC2626", "text": "#0f172a", "muted": "#334155", "grid": "#e2e8f0"},
            "s03": {"el": "grafico-slide-03", "labels": s03_labs, "values": s03_vals},
            "s04": {"el": "grafico-slide-04", "labels": s04_labs, "values": s04_vals},
            "s05": {"el": "grafico-slide-05", "labels": meses, "consumo": consumo_vec, "producao": prod_vec},
            "s06": {"el": "grafico-slide-06", "labels": s06_labs, "values": s06_vals},
            "s09": {"el": "grafico-slide-09", "labels": s09_labs, "values": s09_vals},
        }

        # Injetar ECharts + bootstrap apenas uma vez
        if "FOHAT_ECHARTS_BOOTSTRAP" in template_html:
            return template_html

        try:
            vendor_path = Path(__file__).parent / "public" / "vendor" / "echarts.min.js"
            echarts_js = vendor_path.read_text(encoding="utf-8") if vendor_path.exists() else ""
        except Exception:
            echarts_js = ""

        charts_json = json.dumps(charts_payload, ensure_ascii=False)

        bootstrap = f"""
<!-- FOHAT_ECHARTS_BOOTSTRAP -->
<script>{echarts_js}</script>
<script>
(function(){{
  try {{
    window.__FOHAT_CHARTS__ = {charts_json};
    const C = window.__FOHAT_CHARTS__ || {{}};
    const brand = C.brand || {{}};
    const fmtBRL0 = new Intl.NumberFormat('pt-BR', {{ style:'currency', currency:'BRL', maximumFractionDigits:0 }});
    const fmtNum0 = new Intl.NumberFormat('pt-BR', {{ maximumFractionDigits:0 }});
    
    // Formatador compacto: R$ 10K, R$ 100K, etc.
    function fmtCompact(v) {{
      if (Math.abs(v) >= 1000000) return 'R$ ' + (v/1000000).toFixed(0) + 'M';
      if (Math.abs(v) >= 1000) return 'R$ ' + (v/1000).toFixed(0) + 'K';
      return 'R$ ' + v.toFixed(0);
    }}

    function axisLabelEvery5(value, idx) {{
      const n = idx + 1;
      if (n === 1 || n === 5 || n === 10 || n === 15 || n === 20 || n === 25) return 'Ano ' + n;
      return '';
    }}

    function render(elId, option) {{
      const el = document.getElementById(elId);
      if (!el) return null;
      try {{
        const chart = echarts.init(el, null, {{ renderer: 'svg' }});
        chart.setOption(option, true);
        window.addEventListener('resize', () => chart.resize(), {{ passive:true }});
        return chart;
      }} catch (e) {{
        return null;
      }}
    }}

    // ========== Gráfico 1 - Slide 03 (Seu Gasto Atual - barras) ==========
    if (C.s03 && Array.isArray(C.s03.values) && C.s03.values.length) {{
      const colors = ['#F97316','#EA580C','#DC2626','#B91C1C','#991B1B','#7F1D1D'];
      render(C.s03.el, {{
        animation: false,
        backgroundColor: 'transparent',
        textStyle: {{ fontFamily: 'Poppins, Arial, sans-serif', color: brand.text }},
        grid: {{ left: 16, right: 16, top: 36, bottom: 32, containLabel: true }},
        xAxis: {{
          type: 'category',
          data: C.s03.labels,
          axisTick: {{ show:false }},
          axisLine: {{ lineStyle: {{ color: brand.grid }} }},
          axisLabel: {{ color: brand.muted, fontSize: 13, interval:0, fontWeight: 500 }}
        }},
        yAxis: {{
          type: 'value',
          axisLine: {{ show:false }},
          splitLine: {{ lineStyle: {{ color: brand.grid, opacity: 0.6 }} }},
          axisLabel: {{ color: brand.muted, fontSize: 12, formatter: fmtCompact }}
        }},
        series: [{{
          type: 'bar',
          data: C.s03.values.map((v,i)=>({{ value:v, itemStyle: {{ color: colors[i] || brand.red, borderRadius: [4,4,0,0] }} }})),
          barWidth: '52%',
          barGap: '30%',
          label: {{ show:true, position:'top', fontSize: 13, fontWeight: 700, color: brand.text, formatter: (p)=>fmtBRL0.format(p.value) }}
        }}]
      }});
    }}

    // ========== Gráfico 2 - Slide 04 (Evolução da Conta - linha) ==========
    if (C.s04 && Array.isArray(C.s04.values) && C.s04.values.length) {{
      render(C.s04.el, {{
        animation: false,
        backgroundColor: 'transparent',
        textStyle: {{ fontFamily: 'Poppins, Arial, sans-serif', color: brand.text }},
        grid: {{ left: 12, right: 12, top: 24, bottom: 32, containLabel: true }},
        xAxis: {{
          type:'category',
          data: C.s04.labels,
          axisTick: {{ show:false }},
          axisLine: {{ lineStyle: {{ color: brand.grid }} }},
          axisLabel: {{ color: brand.muted, fontSize: 11, fontWeight: 500, interval: 0, formatter: axisLabelEvery5 }}
        }},
        yAxis: {{
          type:'value',
          axisLine: {{ show:false }},
          splitLine: {{ lineStyle: {{ color: brand.grid, opacity: 0.6 }} }},
          axisLabel: {{ color: brand.muted, fontSize: 11, formatter: fmtCompact }}
        }},
        series: [{{
          type:'line',
          data: C.s04.values,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {{ width: 3, color: brand.blue }},
          itemStyle: {{ color: brand.blue }},
          areaStyle: {{ color: {{ type:'linear', x:0,y:0,x2:0,y2:1, colorStops:[{{offset:0,color:'rgba(30,58,138,0.25)'}},{{offset:1,color:'rgba(30,58,138,0.02)'}}] }} }}
        }}]
      }});
    }}

    // ========== Gráfico 3 - Slide 05 (Consumo x Geração - barras duplas) ==========
    if (C.s05 && Array.isArray(C.s05.labels) && C.s05.labels.length) {{
      render(C.s05.el, {{
        animation: false,
        backgroundColor: 'transparent',
        textStyle: {{ fontFamily: 'Poppins, Arial, sans-serif', color: brand.text }},
        grid: {{ left: 8, right: 8, top: 42, bottom: 28, containLabel: true }},
        legend: {{
          top: 4,
          left: 'center',
          textStyle: {{ color: brand.muted, fontSize: 11, fontWeight: 500 }},
          itemWidth: 12,
          itemHeight: 10,
          itemGap: 20
        }},
        xAxis: {{
          type:'category',
          data: C.s05.labels,
          axisTick: {{ show:false }},
          axisLine: {{ lineStyle: {{ color: brand.grid }} }},
          axisLabel: {{ color: brand.muted, fontSize: 11, interval:0, fontWeight: 500 }}
        }},
        yAxis: {{
          type:'value',
          axisLine: {{ show:false }},
          splitLine: {{ lineStyle: {{ color: brand.grid, opacity: 0.6 }} }},
          axisLabel: {{ color: brand.muted, fontSize: 11, formatter: (v)=>fmtNum0.format(v) }}
        }},
        series: [
          {{
            name: 'Consumo médio',
            type:'bar',
            data: (C.s05.consumo || []),
            barWidth: '32%',
            itemStyle: {{ color: brand.blue, borderRadius: [3,3,0,0] }},
            label: {{ show:true, position:'top', fontSize: 10, fontWeight: 700, color: brand.muted, formatter: (p)=>fmtNum0.format(p.value) }}
          }},
          {{
            name: 'Produção estimada',
            type:'bar',
            data: (C.s05.producao || []),
            barWidth: '32%',
            itemStyle: {{ color: brand.green, borderRadius: [3,3,0,0] }},
            label: {{ show:true, position:'top', fontSize: 10, fontWeight: 700, color: brand.muted, formatter: (p)=>fmtNum0.format(p.value) }}
          }}
        ]
      }});
    }}

    // ========== Gráfico 4 - Payback (fluxo de caixa acumulado - linha) ==========
    if (C.s06 && Array.isArray(C.s06.values) && C.s06.values.length) {{
      // ponto de payback = primeiro índice em que o fluxo acumulado cruza 0 (>=0)
      let payIdx = -1;
      try {{
        for (let i = 0; i < C.s06.values.length; i++) {{
          const v = Number(C.s06.values[i] || 0);
          if (v >= 0) {{ payIdx = i; break; }}
        }}
      }} catch (e) {{}}
      const payAno = (payIdx >= 0) ? (payIdx + 1) : null;
      const payName = (payAno != null) ? ('Payback\\nAno ' + payAno) : 'Payback';
      render(C.s06.el, {{
        animation: false,
        backgroundColor: 'transparent',
        textStyle: {{ fontFamily: 'Poppins, Arial, sans-serif', color: brand.text }},
        grid: {{ left: 12, right: 12, top: 24, bottom: 32, containLabel: true }},
        xAxis: {{
          type:'category',
          data: C.s06.labels,
          axisTick: {{ show:false }},
          axisLine: {{ lineStyle: {{ color: brand.grid }} }},
          axisLabel: {{ color: brand.muted, fontSize: 11, fontWeight: 500, interval: 0, formatter: axisLabelEvery5 }}
        }},
        yAxis: {{
          type:'value',
          axisLine: {{ show:false }},
          axisTick: {{ show:false }},
          axisLabel: {{ color: brand.muted, fontSize: 11, formatter: fmtCompact }},
          splitLine: {{ lineStyle: {{ color: brand.grid, opacity: 0.6 }} }},
          // linha do zero = referência visual do payback
          axisPointer: {{ show: false }}
        }},
        series: [{{
          type:'line',
          data: C.s06.values,
          smooth: 0.3,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {{ width: 3, color: brand.green }},
          itemStyle: {{ color: brand.green }},
          areaStyle: {{ color: {{ type:'linear', x:0,y:0,x2:0,y2:1, colorStops:[{{offset:0,color:'rgba(5,150,105,0.18)'}},{{offset:1,color:'rgba(5,150,105,0.02)'}}] }} }},
          markLine: {{
            silent: true,
            symbol: ['none','none'],
            lineStyle: {{ color: brand.grid, width: 2, type:'solid' }},
            label: {{ show: false }},
            data: (function() {{
              const out = [{{ yAxis: 0 }}];
              if (payIdx >= 0) {{
                out.push({{
                  xAxis: C.s06.labels[payIdx],
                  lineStyle: {{ color: brand.blue, width: 2, type:'dashed' }},
                  label: {{
                    show: true,
                    position: 'insideEndTop',
                    color: brand.blue,
                    fontSize: 11,
                    fontWeight: 800,
                    formatter: 'Payback'
                  }}
                }});
              }}
              return out;
            }})()
          }},
          markPoint: (payIdx >= 0) ? {{
            symbol: 'circle',
            symbolSize: 14,
            itemStyle: {{ color: brand.blue, borderColor: '#fff', borderWidth: 3 }},
            label: {{
              show: true,
              position: 'top',
              distance: 10,
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              padding: [6, 10],
              backgroundColor: brand.blue,
              borderRadius: 999,
              formatter: (p) => (p && p.name) ? p.name.replace('\\n', ' • ') : 'Payback'
            }},
            data: [{{ coord: [C.s06.labels[payIdx], C.s06.values[payIdx]], name: payName }}]
          }}
        }}]
      }});
    }}

    // ========== Gráfico 5 - Slide 09 (Comparativo Financeiro - barras) ==========
    if (C.s09 && Array.isArray(C.s09.values) && C.s09.values.length) {{
      render(C.s09.el, {{
        animation: false,
        backgroundColor: 'transparent',
        textStyle: {{ fontFamily: 'Poppins, Arial, sans-serif', color: brand.text }},
        grid: {{ left: 16, right: 16, top: 36, bottom: 48, containLabel: true }},
        xAxis: {{
          type:'category',
          data: ['Gasto sem solar\\n(25 anos)', 'Investimento\\nno sistema'],
          axisTick: {{ show:false }},
          axisLine: {{ lineStyle: {{ color: brand.grid }} }},
          axisLabel: {{ 
            color: brand.muted, 
            fontSize: 12, 
            fontWeight: 600,
            interval: 0,
            lineHeight: 16
          }}
        }},
        yAxis: {{
          type:'value',
          axisLine: {{ show:false }},
          splitLine: {{ lineStyle: {{ color: brand.grid, opacity: 0.6 }} }},
          axisLabel: {{ color: brand.muted, fontSize: 11, formatter: fmtCompact }}
        }},
        series: [{{
          type:'bar',
          data: [
            {{ value: C.s09.values[0] || 0, itemStyle: {{ color: brand.red, borderRadius: [6,6,0,0] }} }},
            {{ value: C.s09.values[1] || 0, itemStyle: {{ color: brand.green, borderRadius: [6,6,0,0] }} }}
          ],
          barWidth: '48%',
          barGap: '40%',
          label: {{ show:true, position:'top', fontSize: 15, fontWeight: 800, color: brand.text, formatter: (p)=>fmtBRL0.format(p.value) }}
        }}]
      }});
    }}

    window.__FOHAT_ECHARTS_READY__ = true;
  }} catch (e) {{
    console.error('Erro ao renderizar gráficos:', e);
    window.__FOHAT_ECHARTS_READY__ = true;
  }}
}})();
</script>
"""

        if "</body>" in template_html:
            template_html = template_html.replace("</body>", bootstrap + "\n</body>")
        else:
            template_html = template_html + bootstrap

        return template_html
    except Exception as e:
        print(f"⚠️ Erro ao aplicar gráficos analise_financeira: {e}")
        return template_html

def process_template_html(proposta_data, template_filename: str = "template.html"):
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
        # Permite usar um template alternativo (ex.: "template copy.html") para testes sem afetar o template oficial.
        safe_name = (template_filename or "template.html").strip()
        template_path = Path(__file__).parent / "public" / safe_name
        if not template_path.exists():
            raise FileNotFoundError("Template não encontrado")
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template_html = f.read()
        
        # Converter imagens para base64
        fohat_base64 = convert_image_to_base64('/img/fohat.svg')
        # A capa do template usa logo-green.svg + filter invert para ficar branco.
        # Se substituirmos pelo logo-bg-blue.svg (que tem fundo preenchido), esse filter vira um "quadrado branco".
        # Portanto: preferir sempre o logo SEM fundo para a proposta.
        logo_green_base64 = (
            convert_image_to_base64('/img/logo-green.svg')
            or convert_image_to_base64('/img/logo.svg')
            or convert_image_to_base64('/img/logo-bg-blue.svg')
        )
        logo_bg_blue_base64 = convert_image_to_base64('/img/logo-bg-blue.svg') or logo_green_base64
        como_funciona_base64 = convert_image_to_base64('/img/como-funciona.png')
        
        # Substituir URLs das imagens por base64
        if fohat_base64:
            template_html = template_html.replace("url('/img/fohat.svg')", f"url('{fohat_base64}')")
            template_html = template_html.replace("url('img/fohat.svg')", f"url('{fohat_base64}')")
        if logo_green_base64 or logo_bg_blue_base64:
            # svg variantes
            if logo_bg_blue_base64:
                template_html = template_html.replace('src="/img/logo-bg-blue.svg"', f'src="{logo_bg_blue_base64}"')
                template_html = template_html.replace('src="img/logo-bg-blue.svg"', f'src="{logo_bg_blue_base64}"')
            if logo_green_base64:
                template_html = template_html.replace('src="/img/logo-green.svg"', f'src="{logo_green_base64}"')
                template_html = template_html.replace('src="img/logo-green.svg"', f'src="{logo_green_base64}"')
                template_html = template_html.replace('src="/img/logo.svg"', f'src="{logo_green_base64}"')
                template_html = template_html.replace('src="img/logo.svg"', f'src="{logo_green_base64}"')
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

        # ====== CALCULAR PREÇO FINAL DE FORMA ROBUSTA ======
        # Buscar o preço em múltiplos campos para garantir que temos um valor válido
        def _parse_preco_robusto(val):
            """Converte qualquer formato de preço para float."""
            if val is None:
                return 0.0
            if isinstance(val, (int, float)):
                return float(val)
            if isinstance(val, str):
                s = val.strip()
                # Remover prefixos de moeda
                for token in ['R$', 'r$', 'RS', 'rs', ' ']:
                    s = s.replace(token, '')
                # Remover qualquer whitespace (inclui NBSP, thin spaces etc.)
                # Ex: "R$\xa035.000,00" quebra float() se não normalizar.
                try:
                    import re
                    s = re.sub(r'\s+', '', s)
                except Exception:
                    # fallback simples: split remove qualquer whitespace reconhecido pelo Python
                    s = ''.join(s.split())
                s = s.strip()
                if not s:
                    return 0.0
                # Detectar formato (brasileiro ou americano)
                if ',' in s and '.' in s:
                    if s.rfind(',') > s.rfind('.'):
                        # Formato brasileiro: 10.174,00
                        s = s.replace('.', '').replace(',', '.')
                    else:
                        # Formato americano: 10,174.00
                        s = s.replace(',', '')
                elif ',' in s:
                    parts = s.split(',')
                    if len(parts) == 2 and len(parts[1]) == 2:
                        s = s.replace(',', '.')
                    else:
                        s = s.replace(',', '')
                try:
                    return float(s)
                except:
                    return 0.0
            return 0.0
        
        # Tentar obter o preço de várias fontes
        preco_final_real = 0.0
        chaves_preco = ['preco_venda', 'preco_final', 'custo_total_projeto', 'investimento_inicial', 'custo_total', 'valor_total']
        for chave in chaves_preco:
            val = proposta_data.get(chave)
            if val is not None:
                parsed = _parse_preco_robusto(val)
                if parsed > 0:
                    preco_final_real = parsed
                    print(f"💰 [PRECO] Encontrado em '{chave}': R$ {preco_final_real:,.2f}")
                    break
        
        # Se ainda não encontrou, tentar calcular a partir dos custos
        if preco_final_real == 0:
            try:
                custo_equip = _parse_preco_robusto(proposta_data.get('custo_equipamentos', 0))
                custo_inst = _parse_preco_robusto(proposta_data.get('custo_instalacao', 0))
                custo_homol = _parse_preco_robusto(proposta_data.get('custo_homologacao', 0))
                custo_outros = _parse_preco_robusto(proposta_data.get('custo_outros', 0))
                margem = _parse_preco_robusto(proposta_data.get('margem_lucro', 0))
                soma = custo_equip + custo_inst + custo_homol + custo_outros + margem
                if soma > 0:
                    preco_final_real = soma
                    print(f"💰 [PRECO] Calculado da soma de custos: R$ {preco_final_real:,.2f}")
            except Exception as e:
                print(f"⚠️ [PRECO] Erro ao calcular soma de custos: {e}")
        
        if preco_final_real == 0:
            print(f"⚠️ [PRECO] Não foi possível determinar o preço! Keys disponíveis: {list(proposta_data.keys())[:20]}")
        
        # Formatar preço para exibição
        preco_final_formatado = f"R$ {preco_final_real:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        print(f"💰 [PRECO] Valor final para proposta: {preco_final_formatado}")

        # Substituir todas as variáveis {{}} no template (agora com valores normalizados)
        template_html = template_html.replace('{{cliente_nome}}', proposta_data.get('cliente_nome', 'Cliente'))
        endereco_resumido = format_endereco_resumido(proposta_data.get('cliente_endereco', ''), proposta_data.get('cidade'))
        template_html = template_html.replace('{{cliente_endereco}}', endereco_resumido)
        template_html = template_html.replace('{{cliente_telefone}}', proposta_data.get('cliente_telefone', 'Telefone não informado'))
        template_html = template_html.replace('{{potencia_sistema}}', str(proposta_data.get('potencia_sistema', 0)))
        template_html = template_html.replace('{{potencia_sistema_kwp}}', f"{proposta_data.get('potencia_sistema', 0):.2f}")
        # Usar o preço calculado de forma robusta
        template_html = template_html.replace('{{preco_final}}', preco_final_formatado)
        template_html = template_html.replace('{{cidade}}', proposta_data.get('cidade', 'Projeto'))
        template_html = template_html.replace('{{vendedor_nome}}', proposta_data.get('vendedor_nome', 'Representante Comercial'))
        template_html = template_html.replace('{{vendedor_cargo}}', proposta_data.get('vendedor_cargo', 'Especialista em Energia Solar'))
        template_html = template_html.replace('{{vendedor_telefone}}', proposta_data.get('vendedor_telefone', '(11) 99999-9999'))
        template_html = template_html.replace('{{vendedor_email}}', proposta_data.get('vendedor_email', 'contato@empresa.com'))
        template_html = template_html.replace('{{data_proposta}}', proposta_data.get('data_proposta', datetime.now().strftime('%d/%m/%Y')))
        
        # Substituir variáveis financeiras
        conta_anual_val = float(proposta_data.get('conta_atual_anual', 0) or 0)
        template_html = template_html.replace('{{conta_atual_anual}}', f"R$ {conta_anual_val:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
        template_html = template_html.replace('{{conta_mensal_media}}', f"R$ {conta_anual_val/12:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
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
        # Equipamentos (marca/modelo/tipo) — podem não existir em propostas legadas
        template_html = template_html.replace('{{modulo_marca}}', str(proposta_data.get('modulo_marca') or 'Não informado'))
        template_html = template_html.replace('{{modulo_modelo}}', str(proposta_data.get('modulo_modelo') or 'Não informado'))
        template_html = template_html.replace('{{inversor_marca}}', str(proposta_data.get('inversor_marca') or 'Não informado'))
        template_html = template_html.replace('{{inversor_modelo}}', str(proposta_data.get('inversor_modelo') or 'Não informado'))
        template_html = template_html.replace('{{tipo_inversor}}', str(proposta_data.get('tipo_inversor') or 'Não informado'))
        # Somente substituir aqui se vier um valor positivo no payload.
        # Caso contrário, manter o placeholder para ser preenchido mais adiante
        # com o valor calculado do fluxo de caixa acumulado (economia_total_25_calc).
        try:
            _eco_payload = float(proposta_data.get('economia_total_25_anos', 0) or 0)
        except Exception:
            _eco_payload = 0.0
        if _eco_payload > 0:
            template_html = template_html.replace('{{economia_total_25_anos}}', f"R$ {_eco_payload:,.2f}")
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
        
        # Mapeamento fixo: chaves -> ids do template
        id_map = {
            "grafico1": "grafico-slide-03",
            "grafico2": "grafico-slide-04",
            "grafico3": "grafico-slide-05",
            "grafico4": "grafico-slide-06",
            "grafico5": "grafico-slide-09",
        }

        # Helper robusto:
        # - se existir <img id="..."> injeta/atualiza src
        # - se existir <div id="..."></div> (container do gráfico), substitui por <img ... src="...">
        def _inject_img_src(html: str, element_id: str, new_src: str) -> str:
            # 1) Se já existe src no mesmo tag (ordem de atributos indiferente, aspas simples/duplas)
            pattern1 = re.compile(
                r'(<img\b[^>]*\bid=["\']%s["\'][^>]*\bsrc=["\'])([^"\']*)(["\'"][^>]*>)' % re.escape(element_id),
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

            # 3) Se é um <div id="..."> (container do gráfico), substituir por <img>
            # Regex mais robusto: captura divs vazios (com espaços/newlines) ou com comentários
            pattern3 = re.compile(
                r'<div\b(?P<attrs>[^>]*\bid=["\']%s["\'][^>]*)>(?:\s|<!--[^>]*-->)*</div>' % re.escape(element_id),
                flags=re.IGNORECASE
            )
            m = pattern3.search(html)
            if m:
                attrs = m.group('attrs') or ''
                alt = "Gráfico"
                m_alt = re.search(r'aria-label=["\']([^"\']+)["\']', attrs, flags=re.IGNORECASE)
                if m_alt and m_alt.group(1).strip():
                    alt = m_alt.group(1).strip()
                img_tag = (
                    f'<img id="{element_id}" '
                    f'src="{new_src}" '
                    f'alt="{alt}" '
                    f'style="width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;display:block;" />'
                )
                return html[:m.start()] + img_tag + html[m.end():]
            
            # 4) Fallback: Tentar encontrar o elemento por ID e substituir todo o tag
            pattern4 = re.compile(
                r'<div\b[^>]*\bid=["\']%s["\'][^>]*>.*?</div>' % re.escape(element_id),
                flags=re.IGNORECASE | re.DOTALL
            )
            m = pattern4.search(html)
            if m:
                img_tag = (
                    f'<img id="{element_id}" '
                    f'src="{new_src}" '
                    f'alt="Gráfico" '
                    f'style="width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;display:block;" />'
                )
                return html[:m.start()] + img_tag + html[m.end():]
            
            return html

        # ====== Sem gerar novos gráficos: aplicar somente os já fornecidos (se existirem) ======
        try:
            graficos = proposta_data.get('graficos_base64')
            if isinstance(graficos, dict):
                for k, v in graficos.items():
                    if k in id_map and v:
                        template_html = _inject_img_src(template_html, id_map[k], v)
        except Exception as _e:
            print(f"⚠️ Falha ao injetar gráficos prontos: {_e}")
        
        # Substituir variáveis restantes com dados REAIS calculados pelo núcleo (sem mocks)
        try:
            # Derivar kWh mensal a partir da série mês a mês quando presente
            _consumo_kwh = 0.0
            try:
                _consumo_kwh = parse_float(proposta_data.get('consumo_mensal_kwh', 0), 0.0)
            except Exception:
                _consumo_kwh = 0.0
            if (_consumo_kwh <= 0) and isinstance(proposta_data.get('consumo_mes_a_mes'), list):
                try:
                    arr_vals = [parse_float(((x or {}).get('kwh') or 0), 0.0) for x in proposta_data.get('consumo_mes_a_mes')]
                    arr_vals = [v for v in arr_vals if v > 0]
                    if len(arr_vals) > 0:
                        _consumo_kwh = sum(arr_vals) / len(arr_vals)
                except Exception:
                    pass
            core_payload = {
                "consumo_mensal_reais": parse_float(proposta_data.get('consumo_mensal_reais', 0), 0.0),
                "consumo_mensal_kwh": _consumo_kwh,
                "tarifa_energia": parse_float(proposta_data.get('tarifa_energia', 0), 0.0),
                "potencia_sistema": parse_float(proposta_data.get('potencia_sistema', proposta_data.get('potencia_kwp', 0)), 0.0),
                "preco_venda": parse_float(
                    proposta_data.get('preco_venda',
                                      proposta_data.get('preco_final',
                                                        proposta_data.get('custo_total_projeto', 0))),
                    0.0
                ),
                "irradiacao_media": parse_float(proposta_data.get('irradiacao_media', 5.15), 5.15),
                "ano_instalacao": 2026,  # Lei 14.300
            }
            print(f"🧮 [ECON25] core_payload (Lei 14.300) -> consumo_kwh={core_payload['consumo_mensal_kwh']}, "
                  f"consumo_r$={core_payload['consumo_mensal_reais']}, tarifa={core_payload['tarifa_energia']}, "
                  f"potencia={core_payload['potencia_sistema']}, preco_venda={core_payload['preco_venda']}, "
                  f"irr_media={core_payload['irradiacao_media']}")
            core_calc = calcular_dimensionamento(core_payload)
            tabelas = core_calc.get("tabelas") or {}
            kpis_core = core_calc.get("metrics") or {}
        except Exception:
            tabelas = {}
            kpis_core = {}

        custo_sem = tabelas.get("custo_anual_sem_solar_r") or []
        custo_sem_acum = tabelas.get("custo_acumulado_sem_solar_r") or []
        custo_com = tabelas.get("custo_anual_com_solar_r") or []
        economia_anual_r = tabelas.get("economia_anual_r") or []
        fluxo_caixa_acumulado_r = tabelas.get("fluxo_caixa_acumulado_r") or []
        try:
            print(f"🧮 [ECON25] tabelas -> fca_len={len(fluxo_caixa_acumulado_r)}, "
                  f"fca_last={(fluxo_caixa_acumulado_r[-1] if fluxo_caixa_acumulado_r else 0)}")
        except Exception:
            pass
        # Calcular economia total em 25 anos:
        # Preferência: fluxo de caixa acumulado com energia solar no ano 25 (valor do projeto após 25 anos)
        try:
            economia_total_25_calc = float(fluxo_caixa_acumulado_r[-1]) if fluxo_caixa_acumulado_r else 0.0
        except Exception:
            economia_total_25_calc = 0.0
        # Fallback: soma da economia anual projetada (quando não houver fluxo acumulado)
        if economia_total_25_calc == 0.0:
            try:
                economia_total_25_calc = float(sum(float(v) for v in (economia_anual_r or [])))
            except Exception:
                economia_total_25_calc = 0.0
        # Fallback adicional: usar KPIs quando tabelas não foram geradas
        if economia_total_25_calc == 0.0:
            try:
                eco_anual = parse_float(kpis_core.get("economia_anual_estimada", 0), 0.0)
                preco_usina = parse_float(
                    proposta_data.get('preco_venda',
                                      proposta_data.get('preco_final',
                                                        proposta_data.get('custo_total_projeto', 0))),
                    0.0
                )
                if eco_anual > 0:
                    economia_total_25_calc = max(0.0, (eco_anual * 25.0) - preco_usina)
            except Exception:
                pass
        print(f"🧮 [ECON25] economia_total_25_calc={economia_total_25_calc}")

        # conta futura no ano 25 (sem solar) e valores para o gráfico comparativo
        conta_futura_25 = float(custo_sem[-1]) if len(custo_sem) >= 25 else float(proposta_data.get('conta_atual_anual', 0))
        template_html = template_html.replace('{{conta_futura_25_anos}}', format_brl(conta_futura_25))
        # Valores auxiliares (max/med/min) para o gráfico - derivados de custo anual sem solar
        try:
            if custo_sem:
                valor_maximo = max(custo_sem)
                valor_minimo = min(custo_sem)
                valor_medio = (valor_maximo + valor_minimo) / 2
            else:
                base = float(proposta_data.get('conta_atual_anual', 0) or 0)
                valor_maximo = base
                valor_minimo = base
                valor_medio = base
        except Exception:
            base = float(proposta_data.get('conta_atual_anual', 0) or 0)
            valor_maximo = base
            valor_minimo = base
            valor_medio = base
        template_html = template_html.replace('{{valor_maximo}}', format_brl(valor_maximo))
        template_html = template_html.replace('{{valor_medio}}', format_brl(valor_medio))
        template_html = template_html.replace('{{valor_minimo}}', format_brl(valor_minimo))
        
        economia_anual_base = proposta_data.get('economia_mensal_estimada', 0) * 12
        template_html = template_html.replace('{{economia_ano_1}}', f"R$ {proposta_data.get('economia_ano_1', economia_anual_base):,.2f}")
        template_html = template_html.replace('{{economia_ano_5}}', f"R$ {proposta_data.get('economia_ano_5', economia_anual_base * 5):,.2f}")
        template_html = template_html.replace('{{economia_ano_10}}', f"R$ {proposta_data.get('economia_ano_10', economia_anual_base * 10):,.2f}")
        template_html = template_html.replace('{{economia_ano_15}}', f"R$ {proposta_data.get('economia_ano_15', economia_anual_base * 15):,.2f}")
        template_html = template_html.replace('{{economia_ano_20}}', f"R$ {proposta_data.get('economia_ano_20', economia_anual_base * 20):,.2f}")
        template_html = template_html.replace('{{economia_ano_25}}', f"R$ {proposta_data.get('economia_ano_25', economia_total_25_calc or proposta_data.get('economia_total_25_anos', 0)):,.2f}")
        # Preencher a Economia Total em 25 anos priorizando SEMPRE o valor calculado
        # (ignorar 0 vindo do payload)
        try:
            _eco_payload = proposta_data.get('economia_total_25_anos', None)
            if _eco_payload is None:
                _eco_final = float(economia_total_25_calc)
            else:
                _eco_val = float(_eco_payload) if str(_eco_payload).strip() != "" else 0.0
                _eco_final = float(economia_total_25_calc) if _eco_val <= 0 else _eco_val
        except Exception:
            _eco_final = float(economia_total_25_calc)
        # Persistir de volta para que outras partes usem o valor correto
        try:
            proposta_data['economia_total_25_anos'] = _eco_final
        except Exception:
            pass
        template_html = template_html.replace('{{economia_total_25_anos}}', format_brl(_eco_final))
        
        # Atualizar produção média e créditos com base nas tabelas (após cálculos)
        try:
            prod_anual_kwh_ano1 = float((tabelas.get("producao_anual_kwh") or [0])[0] or 0)
            consumo_mensal_kwh_ano1 = float((tabelas.get("consumo_mensal_kwh") or [0])[0] or 0)
            tarifa_r_kwh_ano1 = float((tabelas.get("tarifa_r_kwh") or [0])[0] or float(proposta_data.get('tarifa_energia', 0) or 0))
            geracao_media_mensal_calc = prod_anual_kwh_ano1 / 12.0 if prod_anual_kwh_ano1 > 0 else 0.0
            excedente_mensal_kwh = max(0.0, geracao_media_mensal_calc - consumo_mensal_kwh_ano1)
            creditos_anuais_calc = excedente_mensal_kwh * tarifa_r_kwh_ano1 * 12.0
            template_html = template_html.replace('{{geracao_media_mensal}}', f"{geracao_media_mensal_calc:.0f}")
            template_html = template_html.replace('{{creditos_anuais}}', format_brl(creditos_anuais_calc))
        except Exception:
            pass
        
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
        
        # Gasto total em 25 anos (sem solar) = acumulado real do núcleo
        gasto_total_25 = float(custo_sem_acum[-1]) if custo_sem_acum else float(proposta_data.get('gasto_total_25_anos', conta_anual * 25))
        template_html = template_html.replace('{{gasto_total_25_anos}}', format_brl(gasto_total_25))
        template_html = template_html.replace('{{economia_mensal}}', f"R$ {proposta_data.get('economia_mensal', proposta_data.get('economia_mensal_estimada', 0)):,.2f}")
        template_html = template_html.replace('{{payback_anos}}', str(proposta_data.get('payback_anos', proposta_data.get('anos_payback', 0))))
        
        # Gastos por marcos de ano (sem solar) com dados das tabelas
        idxs = [0, 4, 9, 14, 19, 24]
        def get_idx(arr, i, default=0.0):
            try:
                return float(arr[i]) if len(arr) > i else float(default)
            except Exception:
                return float(default)
        template_html = template_html.replace('{{gasto_ano_1_sem_solar}}', format_brl(get_idx(custo_sem, idxs[0], conta_anual)))
        template_html = template_html.replace('{{gasto_ano_5_sem_solar}}', format_brl(get_idx(custo_sem, idxs[1], conta_anual)))
        template_html = template_html.replace('{{gasto_ano_10_sem_solar}}', format_brl(get_idx(custo_sem, idxs[2], conta_anual)))
        template_html = template_html.replace('{{gasto_ano_15_sem_solar}}', format_brl(get_idx(custo_sem, idxs[3], conta_anual)))
        template_html = template_html.replace('{{gasto_ano_20_sem_solar}}', format_brl(get_idx(custo_sem, idxs[4], conta_anual)))
        template_html = template_html.replace('{{gasto_ano_25_sem_solar}}', format_brl(get_idx(custo_sem, idxs[5], conta_anual)))
        
        # Gastos por marcos de ano (com solar) com dados das tabelas (taxas de distribuição)
        template_html = template_html.replace('{{gasto_ano_1_com_solar}}', format_brl(get_idx(custo_com, idxs[0], investimento_inicial)))
        template_html = template_html.replace('{{gasto_ano_5_com_solar}}', format_brl(get_idx(custo_com, idxs[1], investimento_inicial)))
        template_html = template_html.replace('{{gasto_ano_10_com_solar}}', format_brl(get_idx(custo_com, idxs[2], investimento_inicial)))
        template_html = template_html.replace('{{gasto_ano_15_com_solar}}', format_brl(get_idx(custo_com, idxs[3], investimento_inicial)))
        template_html = template_html.replace('{{gasto_ano_20_com_solar}}', format_brl(get_idx(custo_com, idxs[4], investimento_inicial)))
        template_html = template_html.replace('{{gasto_ano_25_com_solar}}', format_brl(get_idx(custo_com, idxs[5], investimento_inicial)))
        
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
        # Usar a economia total calculada pelos dados do núcleo (fluxo acumulado 25 anos), se disponível
        if economia_total_25_calc and economia_total_25_calc > 0:
            try:
                proposta_data['economia_total_25_anos'] = economia_total_25_calc
            except Exception:
                pass
        economia_total = proposta_data.get('economia_total_25_anos', economia_total_25_calc if economia_total_25_calc > 0 else 1)
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
        
        # Para escalas relativas, usar o maior custo anual sem solar como referência
        gasto_maximo = max(custo_sem) if custo_sem else conta_anual
        if gasto_maximo <= 0:
            template_html = template_html.replace('{{altura_ano_5_com_solar}}', '0')
            template_html = template_html.replace('{{altura_ano_10_com_solar}}', '0')
            template_html = template_html.replace('{{altura_ano_15_com_solar}}', '0')
            template_html = template_html.replace('{{altura_ano_20_com_solar}}', '0')
            template_html = template_html.replace('{{altura_ano_25_com_solar}}', '0')
        else:
            template_html = template_html.replace('{{altura_ano_5_com_solar}}', str(int((get_idx(custo_com, idxs[1], 0) / gasto_maximo) * 100)))
            template_html = template_html.replace('{{altura_ano_10_com_solar}}', str(int((get_idx(custo_com, idxs[2], 0) / gasto_maximo) * 100)))
            template_html = template_html.replace('{{altura_ano_15_com_solar}}', str(int((get_idx(custo_com, idxs[3], 0) / gasto_maximo) * 100)))
            template_html = template_html.replace('{{altura_ano_20_com_solar}}', str(int((get_idx(custo_com, idxs[4], 0) / gasto_maximo) * 100)))
            template_html = template_html.replace('{{altura_ano_25_com_solar}}', str(int((get_idx(custo_com, idxs[5], 0) / gasto_maximo) * 100)))
        
        template_html = template_html.replace('{{valor_maximo_economia}}', f"R$ {proposta_data.get('valor_maximo_economia', proposta_data.get('economia_total_25_anos', economia_total_25_calc)):,.2f}")
        template_html = template_html.replace('{{valor_medio_economia}}', f"R$ {proposta_data.get('valor_medio_economia', (proposta_data.get('economia_total_25_anos', economia_total_25_calc) or 0) / 2):,.2f}")
        template_html = template_html.replace('{{valor_minimo_economia}}', f"R$ {proposta_data.get('valor_minimo_economia', 0):,.2f}")
        
        template_html = template_html.replace('{{valor_maximo_grafico}}', format_brl(valor_maximo))
        template_html = template_html.replace('{{valor_medio_grafico}}', format_brl(valor_medio))
        template_html = template_html.replace('{{valor_minimo_grafico}}', format_brl(valor_minimo))
        
        # Não recalcular gráficos aqui. Se necessário, uma etapa anterior deve ter gerado e enviado.

        # Fallback: caso '{{gasto_acumulado_payback}}' ainda não tenha sido substituído (ex.: conta_atual_anual=0),
        # usar SEMPRE o acumulado até o payback (não o acumulado de 25 anos).
        if '{{gasto_acumulado_payback}}' in template_html:
            try:
                metrics = proposta_data.get('metrics') or {}
                # Preferir o acumulado até o payback calculado pela análise financeira, se existir
                metric_gap = metrics.get('gasto_acumulado_payback')
                if metric_gap is not None:
                    _gap = float(metric_gap)
                else:
                    _gap = float(proposta_data.get('gasto_acumulado_payback', 0) or gasto_acum_payback_calc or 0)
            except Exception:
                _gap = 0.0
            template_html = template_html.replace('{{gasto_acumulado_payback}}', format_brl(_gap))
        
        # IMPORTANTE: Gráficos estáticos (PNG base64) são mais confiáveis que ECharts dinâmico
        # Sempre usar gráficos estáticos para garantir exibição correta na web e no PDF
        # ECharts dinâmico pode falhar se o JavaScript não executar corretamente
        use_static_charts = True  # Sempre usar PNG para garantir funcionamento
        if use_static_charts:
            try:
                # Gerar PNGs estáticos (Matplotlib) a partir das tabelas do núcleo
                import matplotlib
                matplotlib.use("Agg")
                import matplotlib.pyplot as plt
                from matplotlib.ticker import FuncFormatter
                from matplotlib.patches import FancyBboxPatch
                import numpy as np

                # ====== TEMA VISUAL PREMIUM - Design Moderno 2024 ======
                # Paleta de cores vibrante e moderna
                BRAND_BLUE = "#2563EB"       # Azul vibrante (mais moderno)
                BRAND_BLUE_DARK = "#1D4ED8"  # Azul escuro para contraste
                BRAND_GREEN = "#10B981"      # Verde esmeralda vibrante
                BRAND_GREEN_DARK = "#059669" # Verde escuro
                BRAND_RED = "#EF4444"        # Vermelho coral moderno
                BRAND_RED_DARK = "#DC2626"   # Vermelho escuro
                BRAND_ORANGE = "#F59E0B"     # Laranja para destaque
                BRAND_TEXT = "#1E293B"       # Texto principal (slate-800)
                BRAND_MUTED = "#64748B"      # Texto secundário (slate-500)
                BRAND_GRID = "#E2E8F0"       # Grid suave (slate-200)
                BRAND_BG = "#FFFFFF"         # Fundo branco

                # Configuração global de alta qualidade
                plt.rcParams.update({
                    "figure.facecolor": BRAND_BG,
                    "axes.facecolor": BRAND_BG,
                    "savefig.facecolor": BRAND_BG,
                    "font.family": "sans-serif",
                    "font.sans-serif": ["Poppins", "Inter", "Segoe UI", "DejaVu Sans", "Arial"],
                    "font.size": 14,
                    "font.weight": "medium",
                    "axes.edgecolor": BRAND_GRID,
                    "axes.labelcolor": BRAND_TEXT,
                    "axes.labelweight": "bold",
                    "axes.titleweight": "bold",
                    "xtick.color": BRAND_MUTED,
                    "ytick.color": BRAND_MUTED,
                    "xtick.labelsize": 13,
                    "ytick.labelsize": 13,
                    "legend.fontsize": 14,
                    "legend.frameon": False,
                    "figure.dpi": 100,
                })

                def _to_data_uri(fig) -> str:
                    buf = io.BytesIO()
                    # DPI alto para máxima qualidade e nitidez
                    fig.savefig(buf, format="png", dpi=220, bbox_inches="tight", 
                               pad_inches=0.15, transparent=False)
                    plt.close(fig)
                    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                    return "data:image/png;base64," + b64

                def _fmt_compact(v, _pos=None):
                    """Formatar valores em formato compacto e legível"""
                    try:
                        v = float(v)
                    except Exception:
                        return ""
                    av = abs(v)
                    if av >= 1_000_000:
                        return f"R$ {v/1_000_000:.1f} mi"
                    if av >= 1_000:
                        return f"R$ {v/1_000:.0f} mil"
                    return f"R$ {v:,.0f}"

                def _fmt_brl_full(v):
                    """Formatar valor em BRL completo"""
                    try:
                        v = float(v)
                        if v >= 1_000_000:
                            return f"R$ {v/1_000_000:.2f} milhões"
                        if v >= 1_000:
                            return f"R$ {v:,.0f}".replace(",", ".")
                        return f"R$ {v:.0f}"
                    except Exception:
                        return "R$ 0"

                def _style_axes_modern(ax, show_y_grid=True):
                    """Estilização moderna dos eixos - limpo e elegante"""
                    # Grid suave apenas no eixo Y
                    if show_y_grid:
                        ax.grid(True, axis="y", color=BRAND_GRID, linewidth=1.5, alpha=0.8, linestyle="-")
                    ax.grid(False, axis="x")
                    
                    # Remover bordas desnecessárias
                    for side in ["top", "right"]:
                        ax.spines[side].set_visible(False)
                    for side in ["left", "bottom"]:
                        ax.spines[side].set_color(BRAND_GRID)
                        ax.spines[side].set_linewidth(1.5)
                    
                    # Ticks mais elegantes
                    ax.tick_params(axis="both", which="both", length=0, pad=10)
                    ax.set_axisbelow(True)
                    
                    # Fontes maiores e mais legíveis
                    for label in ax.get_xticklabels():
                        label.set_fontsize(14)
                        label.set_fontweight("600")
                        label.set_color(BRAND_MUTED)
                    for label in ax.get_yticklabels():
                        label.set_fontsize(13)
                        label.set_fontweight("500")
                        label.set_color(BRAND_MUTED)

                def _add_value_labels(ax, bars, color=None, fontsize=16, offset=0.02, fmt_func=None):
                    """Adicionar rótulos de valor em cima das barras"""
                    if fmt_func is None:
                        fmt_func = _fmt_compact
                    for bar in bars:
                        height = bar.get_height()
                        label_color = color if color else BRAND_TEXT
                        ax.annotate(
                            fmt_func(height),
                            xy=(bar.get_x() + bar.get_width() / 2, height),
                            xytext=(0, 8),
                            textcoords="offset points",
                            ha='center', va='bottom',
                            fontsize=fontsize,
                            fontweight='bold',
                            color=label_color
                        )

                tables = core_calc.get("tabelas") or {}
                metrics = core_calc.get("metrics") or {}

                cas = tables.get("custo_acumulado_sem_solar_r") or []
                ca = tables.get("custo_anual_sem_solar_r") or []
                fca = tables.get("fluxo_caixa_acumulado_r") or []
                prod = (tables.get("producao_mensal_kwh_ano1") or [])[:12]

                # Consumo mês a mês (se existir) — senão média
                consumo_vec = proposta_data.get("consumo_mes_a_mes_kwh")
                if not (isinstance(consumo_vec, list) and len(consumo_vec) == 12):
                    try:
                        if isinstance(proposta_data.get("consumo_mes_a_mes"), list):
                            arr = [parse_float(((x or {}).get("kwh") or 0), 0.0) for x in proposta_data.get("consumo_mes_a_mes")]
                            if len(arr) == 12:
                                consumo_vec = arr
                    except Exception:
                        consumo_vec = None
                if not (isinstance(consumo_vec, list) and len(consumo_vec) == 12):
                    _ck = parse_float(proposta_data.get("consumo_mensal_kwh", 0), 0.0)
                    consumo_vec = [float(_ck or 0.0)] * 12

                meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

                # ====== GRÁFICO 1: Slide 03 - Gasto Acumulado (Linha com área) ======
                g = {}
                try:
                    idxs = [0, 4, 9, 14, 19, 24]
                    xs = [f"Ano {i+1}" for i in idxs]
                    ys = [float(cas[i]) for i in idxs] if len(cas) >= 25 else []
                    if ys:
                        fig, ax = plt.subplots(figsize=(14, 9.5))
                        
                        # Linha principal com marcadores destacados
                        line = ax.plot(xs, ys, color=BRAND_BLUE, linewidth=4, marker="o", 
                                       markersize=12, markerfacecolor=BRAND_BLUE, 
                                       markeredgecolor="white", markeredgewidth=3, zorder=5)
                        
                        # Área com gradiente suave
                        ax.fill_between(range(len(ys)), ys, [0]*len(ys), 
                                       color=BRAND_BLUE, alpha=0.12)
                        
                        ax.set_ylim(0, max(ys)*1.18 if ys else 1)
                        _style_axes_modern(ax)
                        ax.yaxis.set_major_formatter(FuncFormatter(_fmt_compact))
                        
                        # Labels grandes e destacados nos pontos
                        for xi, yi in enumerate(ys):
                            ax.annotate(
                                _fmt_compact(yi),
                                xy=(xi, yi),
                                xytext=(0, 30),
                                textcoords="offset points",
                                ha='center', va='bottom',
                                fontsize=15,
                                fontweight='bold',
                                color=BRAND_TEXT,
                                bbox=dict(boxstyle='round,pad=0.3', facecolor='white', 
                                         edgecolor=BRAND_GRID, alpha=0.9)
                            )
                        
                        fig.tight_layout(pad=1.5)
                        g["grafico1"] = _to_data_uri(fig)
                except Exception as _e:
                    print(f"⚠️ Falha ao gerar grafico1 estático: {_e}")

                # ====== GRÁFICO 2: Slide 04 - Custo Anual (não usado no template copy) ======
                try:
                    if ca:
                        xs = [f"Ano {i+1}" for i in range(len(ca))]
                        ys = [float(v) for v in ca]
                        fig, ax = plt.subplots(figsize=(12, 5))
                        ax.plot(xs, ys, color=BRAND_BLUE, linewidth=3.5)
                        ax.fill_between(range(len(ys)), ys, [0]*len(ys), color=BRAND_BLUE, alpha=0.1)
                        _style_axes_modern(ax)
                        ax.yaxis.set_major_formatter(FuncFormatter(_fmt_compact))
                        
                        # Mostrar apenas alguns anos no eixo X
                        tick_positions = [0, 4, 9, 14, 19, 24]
                        ax.set_xticks(tick_positions)
                        ax.set_xticklabels([xs[i] for i in tick_positions if i < len(xs)], fontsize=13)
                        
                        fig.tight_layout(pad=1.5)
                        g["grafico2"] = _to_data_uri(fig)
                except Exception as _e:
                    print(f"⚠️ Falha ao gerar grafico2 estático: {_e}")

                # ====== GRÁFICO 3: Slide 05 - Consumo x Produção (Barras Duplas) ======
                try:
                    if isinstance(consumo_vec, list) and len(consumo_vec) == 12 and isinstance(prod, list) and len(prod) == 12:
                        # Figura maior verticalmente para ocupar todo o espaço do card
                        fig, ax = plt.subplots(figsize=(14, 9.5))
                        x = np.arange(12)
                        width = 0.38
                        
                        # Barras com cores vibrantes (sem label para legenda)
                        bars1 = ax.bar(x - width/2, consumo_vec, width, color=BRAND_BLUE, 
                                      alpha=0.92, edgecolor='white', linewidth=1.7)
                        bars2 = ax.bar(x + width/2, prod, width, color=BRAND_GREEN, 
                                      alpha=0.92, edgecolor='white', linewidth=1.7)
                        
                        ax.set_xticks(x)
                        ax.set_xticklabels(meses, fontsize=15, fontweight='700')
                        _style_axes_modern(ax)
                        
                        # SEM legenda interna - removida conforme solicitado
                        
                        # Espaço para labels em cima das colunas
                        ymax = max(max(consumo_vec), max(prod)) if (consumo_vec and prod) else 1
                        ax.set_ylim(0, ymax * 1.18)
                        
                        # Labels em TODAS as colunas (consumo e produção)
                        for i in range(12):
                            try:
                                cv = float(consumo_vec[i])
                                pv = float(prod[i])
                                # Label do consumo (azul)
                                ax.annotate(f"{cv:.0f}", xy=(i - width/2, cv), xytext=(0, 4),
                                           textcoords="offset points", ha='center', va='bottom',
                                           fontsize=16, fontweight='bold', color=BRAND_BLUE_DARK)
                                # Label da produção (verde)
                                ax.annotate(f"{pv:.0f}", xy=(i + width/2, pv), xytext=(0, 4),
                                           textcoords="offset points", ha='center', va='bottom',
                                           fontsize=16, fontweight='bold', color=BRAND_GREEN_DARK)
                            except Exception:
                                pass
                        
                        # Ajustar margens para ocupar melhor o espaço
                        fig.subplots_adjust(left=0.05, right=0.98, top=0.95, bottom=0.12)
                        fig.tight_layout(pad=1.0)
                        g["grafico3"] = _to_data_uri(fig)
                except Exception as _e:
                    print(f"⚠️ Falha ao gerar grafico3 estático: {_e}")

                # ====== GRÁFICO 4: Slide 07 - Payback (Fluxo de Caixa Acumulado) ======
                try:
                    if fca:
                        xs_labels = [f"Ano {i+1}" for i in range(len(fca))]
                        ys = [float(v) for v in fca]
                        pay_idx = next((i for i, v in enumerate(ys) if v >= 0), None)
                        
                        fig, ax = plt.subplots(figsize=(14, 9.5))
                        x_positions = list(range(len(fca)))
                        
                        # Cores diferentes para valores negativos e positivos
                        colors_area = [BRAND_RED if y < 0 else BRAND_GREEN for y in ys]
                        
                        # Linha principal
                        ax.plot(x_positions, ys, color=BRAND_GREEN, linewidth=4, zorder=4)
                        
                        # Área colorida (vermelho abaixo de zero, verde acima)
                        ys_neg = [min(y, 0) for y in ys]
                        ys_pos = [max(y, 0) for y in ys]
                        ax.fill_between(x_positions, ys_neg, 0, color=BRAND_RED, alpha=0.15)
                        ax.fill_between(x_positions, 0, ys_pos, color=BRAND_GREEN, alpha=0.15)
                        
                        # Linha do zero destacada
                        ax.axhline(0, color=BRAND_TEXT, linewidth=2, alpha=0.3, linestyle='-')
                        
                        _style_axes_modern(ax)
                        ax.yaxis.set_major_formatter(FuncFormatter(_fmt_compact))
                        
                        # Apenas alguns anos no eixo X
                        tick_idx = [0, 4, 9, 14, 19, 24]
                        ax.set_xticks(tick_idx)
                        ax.set_xticklabels([xs_labels[i] for i in tick_idx if i < len(xs_labels)], fontsize=13)
                        
                        # Destaque do ponto de payback
                        if pay_idx is not None:
                            ax.axvline(pay_idx, color=BRAND_ORANGE, linestyle="--", linewidth=3, alpha=0.8)
                            ax.scatter([pay_idx], [ys[pay_idx]], s=200, color=BRAND_ORANGE, 
                                      edgecolors="white", linewidths=3, zorder=6)
                            
                            # Label do payback com destaque
                            ax.annotate(
                                f"PAYBACK\nAno {pay_idx+1}",
                                xy=(pay_idx, ys[pay_idx]),
                                xytext=(-100,20),
                                textcoords="offset points",
                                fontsize=16,
                                fontweight='bold',
                                color=BRAND_ORANGE,
                                ha='left',
                                bbox=dict(boxstyle='round,pad=0.5', facecolor='white', 
                                         edgecolor=BRAND_ORANGE, linewidth=2, alpha=0.95),
                                arrowprops=dict(arrowstyle='->', color=BRAND_ORANGE, lw=2)
                            )
                        
                        fig.tight_layout(pad=1.5)
                        g["grafico4"] = _to_data_uri(fig)
                except Exception as _e:
                    print(f"⚠️ Falha ao gerar grafico4 estático: {_e}")

                # ====== GRÁFICO 5: Slide 11 - Comparativo 25 Anos vs Investimento ======
                try:
                    if cas:
                        sem_solar_25 = float(cas[-1]) if cas else 0.0
                    else:
                        sem_solar_25 = float(metrics.get("gasto_total_25_anos", 0) or 0.0)
                    inv = float(core_payload.get("preco_venda", 0) or 0.0)
                    
                    fig, ax = plt.subplots(figsize=(14, 9.5))
                    labels = ["Gasto SEM\nenergia solar\n(25 anos)", "Investimento\nno sistema"]
                    vals = [sem_solar_25, inv]
                    colors = [BRAND_RED, BRAND_GREEN]
                    
                    # Barras largas e impactantes
                    bars = ax.bar(labels, vals, color=colors, width=0.55, 
                                 edgecolor='white', linewidth=2)
                    
                    _style_axes_modern(ax, show_y_grid=True)
                    ax.yaxis.set_major_formatter(FuncFormatter(_fmt_compact))
                    
                    # Eixo X mais legível
                    ax.tick_params(axis='x', labelsize=16, pad=12)
                    
                    # Espaço para os labels
                    ymax = max(vals) if vals else 1
                    ax.set_ylim(0, ymax * 1.25)
                    
                    # Rótulos grandes e destacados em cima das barras
                    for bar, val, color in zip(bars, vals, [BRAND_RED_DARK, BRAND_GREEN_DARK]):
                        height = bar.get_height()
                        ax.annotate(
                            _fmt_brl_full(val),
                            xy=(bar.get_x() + bar.get_width() / 2, height),
                            xytext=(0, 12),
                            textcoords="offset points",
                            ha='center', va='bottom',
                            fontsize=18,
                            fontweight='bold',
                            color=color,
                            bbox=dict(boxstyle='round,pad=0.4', facecolor='white', 
                                     edgecolor=color, linewidth=2, alpha=0.95)
                        )
                    
                    # Adicionar indicador de economia
                    if sem_solar_25 > 0 and inv > 0:
                        economia = sem_solar_25 - inv
                        economia_pct = (economia / sem_solar_25) * 100
                        economia_text = f"Economia: {_fmt_brl_full(economia)} ({economia_pct:.0f}%)"
                        ax.text(0.5, 0.02, economia_text, transform=ax.transAxes, 
                               fontsize=16, fontweight='bold', color=BRAND_GREEN_DARK,
                               ha='center', va='bottom',
                               bbox=dict(boxstyle='round,pad=0.5', facecolor='#ECFDF5', 
                                        edgecolor=BRAND_GREEN, linewidth=1.5))
                    
                    fig.tight_layout(pad=2)
                    g["grafico5"] = _to_data_uri(fig)
                except Exception as _e:
                    print(f"⚠️ Falha ao gerar grafico5 estático: {_e}")

                # Injetar os PNGs no HTML substituindo os containers por <img>
                if g:
                    proposta_data.setdefault("graficos_base64", {})
                    proposta_data["graficos_base64"].update(g)
                    # reutilizar id_map + helper já definidos acima
                    for k, v in g.items():
                        if k in id_map and v:
                            template_html = _inject_img_src(template_html, id_map[k], v)
            except Exception as _e:
                print(f"⚠️ Falha ao gerar/injetar gráficos estáticos: {_e}")
        else:
            template_html = apply_analise_financeira_graphs(template_html, proposta_data)
        
        # ====== FORMAS DE PAGAMENTO (Slide 12 no template copy / Slide 10 no template antigo) ======
        try:
            # Usar o preco_final_real calculado no início da função (já validado e robusto)
            print(f"💳 [SLIDE10] Usando preco_final_real: R$ {preco_final_real:,.2f}")
            
            # Priorizar valores persistidos no payload (pré-calculados no /salvar-proposta)
            payload_cartao = (proposta_data.get('parcelas_cartao') or '') if isinstance(proposta_data.get('parcelas_cartao'), str) else ''
            payload_fin = (proposta_data.get('parcelas_financiamento') or '') if isinstance(proposta_data.get('parcelas_financiamento'), str) else ''
            payload_avista = proposta_data.get('valor_avista_cartao')
            payload_menor = proposta_data.get('menor_parcela_financiamento')

            payload_cartao_count = payload_cartao.count('parcela-item') if payload_cartao else 0
            has_payload_pagamento = bool(payload_cartao.strip() or payload_fin.strip() or payload_avista or payload_menor)

            is_template_copy = (str(template_filename).lower().strip() == "template copy.html")
            max_cartao_itens = 12 if is_template_copy else 18

            def _parse_brl_to_float(v) -> float:
                try:
                    if v is None:
                        return 0.0
                    if isinstance(v, (int, float)):
                        return float(v)
                    s = str(v).strip()
                    for token in ['R$', 'r$', 'RS', 'rs']:
                        s = s.replace(token, '')
                    s = re.sub(r'\s+', '', s)
                    # "10.495,50" -> "10495.50"
                    if ',' in s:
                        s = s.replace('.', '').replace(',', '.')
                    else:
                        # "892.857" (milhar) -> "892857"
                        s = s.replace('.', '')
                    return float(s)
                except Exception:
                    return 0.0

            def _limit_parcela_items(html: str, max_items: int) -> str:
                if not html:
                    return ""
                try:
                    items = re.findall(r'<div class="parcela-item"[\s\S]*?</div>', html)
                    if items:
                        return "".join(items[:max_items])
                except Exception:
                    pass
                # fallback simples: retorna como veio
                return html
            
            if preco_final_real > 0:
                # Sempre ter um cálculo “fonte da verdade” para evitar financiamento zerado e layout antigo
                pagamento_calc = calcular_parcelas_pagamento(preco_final_real)

                # Cartão: no template copy, exibir SOMENTE até 12x (demais sob consulta)
                src_cartao = payload_cartao if payload_cartao.strip() else (pagamento_calc.get('parcelas_cartao', '') or '')
                template_html = template_html.replace('{{parcelas_cartao}}', _limit_parcela_items(src_cartao, max_cartao_itens))

                # Financiamento: alguns templates não mostram a lista, mas sempre precisamos do destaque.
                src_fin = payload_fin if payload_fin.strip() else (pagamento_calc.get('parcelas_financiamento', '') or '')
                # No template copy, mostrar mais opções mas ainda caber no slide
                max_fin_itens = 8 if is_template_copy else 999
                template_html = template_html.replace('{{parcelas_financiamento}}', _limit_parcela_items(src_fin, max_fin_itens))

                # Destaques: se payload estiver vazio/zerado, usar o calculado.
                av_payload_ok = _parse_brl_to_float(payload_avista) > 0
                menor_payload_ok = _parse_brl_to_float(payload_menor) > 0
                template_html = template_html.replace('{{valor_avista_cartao}}', str(payload_avista) if av_payload_ok else (pagamento_calc.get('valor_avista_cartao', 'R$ 0,00') or 'R$ 0,00'))
                template_html = template_html.replace('{{menor_parcela_financiamento}}', str(payload_menor) if menor_payload_ok else (pagamento_calc.get('menor_parcela_financiamento', 'R$ 0,00') or 'R$ 0,00'))

                if is_template_copy:
                    print("✅ [SLIDE12] Template copy: cartão limitado a 12x e financiamento garantido pelo cálculo.")
                elif has_payload_pagamento:
                    print("✅ [SLIDE10] Usando payload (com fallback no cálculo quando necessário).")
            else:
                # Log completo do proposta_data para debug
                print(f"⚠️ [SLIDE10] Preço zerado! Dump de proposta_data keys: {list(proposta_data.keys())}")
                # Valores padrão se não tiver preço
                template_html = template_html.replace('{{parcelas_cartao}}', '<div class="parcela-item"><span class="parcela-numero">Consulte</span><span class="parcela-valor">valores</span></div>')
                template_html = template_html.replace('{{parcelas_financiamento}}', '<div class="parcela-item"><span class="parcela-numero">Consulte</span><span class="parcela-valor">valores</span></div>')
                template_html = template_html.replace('{{valor_avista_cartao}}', 'Consulte')
                template_html = template_html.replace('{{menor_parcela_financiamento}}', 'Consulte')
        except Exception as e:
            print(f"❌ [SLIDE10] Erro ao processar formas de pagamento: {e}")
            import traceback
            traceback.print_exc()
            # Fallback - substituir com valores vazios para não mostrar as variáveis
            template_html = template_html.replace('{{parcelas_cartao}}', '')
            template_html = template_html.replace('{{parcelas_financiamento}}', '')
            template_html = template_html.replace('{{valor_avista_cartao}}', 'R$ 0,00')
            template_html = template_html.replace('{{menor_parcela_financiamento}}', 'R$ 0,00')
        
        return template_html
        
    except Exception as e:
        print(f"❌ Erro ao processar template: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

# =========================================================================
# ENDPOINTS PARA GERENCIAMENTO DE PERMISSÕES POR ROLE
# =========================================================================

ROLE_PERMISSIONS_FILE = DATA_DIR / "role_permissions.json"

def _load_role_permissions():
    """Carrega permissões de roles do arquivo JSON."""
    if ROLE_PERMISSIONS_FILE.exists():
        try:
            with open(ROLE_PERMISSIONS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Erro ao carregar permissões: {e}")
    return {}

def _save_role_permissions(permissions):
    """Salva permissões de roles no arquivo JSON."""
    with open(ROLE_PERMISSIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(permissions, f, ensure_ascii=False, indent=2)

@app.route('/config/role-permissions', methods=['GET'])
def get_role_permissions():
    """Retorna todas as permissões de roles configuradas."""
    try:
        permissions = _load_role_permissions()
        return jsonify({"success": True, "permissions": permissions})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/role-permissions', methods=['POST'])
def save_role_permission():
    """Salva as permissões de uma role específica."""
    try:
        if not _require_admin_access():
            return jsonify({"success": False, "message": "Não autorizado"}), 403
        data = request.get_json() or {}
        role = data.get('role')
        permissions = data.get('permissions')
        
        if not role or role not in ['admin', 'gestor', 'vendedor', 'instalador']:
            return jsonify({"success": False, "message": "Role inválida"}), 400
        
        if not permissions or not isinstance(permissions, dict):
            return jsonify({"success": False, "message": "Permissões inválidas"}), 400
        
        all_permissions = _load_role_permissions()
        all_permissions[role] = permissions
        _save_role_permissions(all_permissions)
        
        print(f"✅ Permissões da role '{role}' salvas com sucesso")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/role-permissions/<role>', methods=['GET'])
def get_single_role_permissions(role):
    """Retorna as permissões de uma role específica."""
    try:
        if role not in ['admin', 'gestor', 'vendedor', 'instalador']:
            return jsonify({"success": False, "message": "Role inválida"}), 400
        
        all_permissions = _load_role_permissions()
        permissions = all_permissions.get(role, {})
        return jsonify({"success": True, "role": role, "permissions": permissions})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# =========================================================================
# ENDPOINTS PARA GERENCIAMENTO DE EQUIPES
# =========================================================================

EQUIPES_FILE = DATA_DIR / "equipes.json"

def _load_equipes():
    """Carrega configuração de equipes do arquivo JSON."""
    if EQUIPES_FILE.exists():
        try:
            with open(EQUIPES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Erro ao carregar equipes: {e}")
    return {}

def _save_equipes(equipes):
    """Salva configuração de equipes no arquivo JSON."""
    with open(EQUIPES_FILE, "w", encoding="utf-8") as f:
        json.dump(equipes, f, ensure_ascii=False, indent=2)

@app.route('/config/equipes', methods=['GET'])
def get_equipes():
    """Retorna configuração de equipes (gestor -> [membros])."""
    try:
        equipes = _load_equipes()
        return jsonify({"success": True, "equipes": equipes})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/equipes', methods=['POST'])
def save_equipes():
    """Salva configuração de equipes."""
    try:
        if not _require_admin_access():
            return jsonify({"success": False, "message": "Não autorizado"}), 403
        data = request.get_json() or {}
        equipes = data.get('equipes', {})
        
        if not isinstance(equipes, dict):
            return jsonify({"success": False, "message": "Formato inválido"}), 400
        
        _save_equipes(equipes)
        print(f"✅ Equipes salvas com sucesso: {len(equipes)} gestores configurados")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/equipes/<gestor_email>', methods=['GET'])
def get_equipe_gestor(gestor_email):
    """Retorna membros da equipe de um gestor específico."""
    try:
        equipes = _load_equipes()
        membros = equipes.get(gestor_email.lower(), [])
        return jsonify({"success": True, "gestor": gestor_email, "membros": membros})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/equipes/<gestor_email>/membros', methods=['POST'])
def add_membro_equipe(gestor_email):
    """Adiciona um membro à equipe de um gestor."""
    try:
        data = request.get_json() or {}
        membro_email = data.get('membro_email', '').strip().lower()
        
        if not membro_email:
            return jsonify({"success": False, "message": "Email do membro é obrigatório"}), 400
        
        equipes = _load_equipes()
        gestor_key = gestor_email.lower()
        
        if gestor_key not in equipes:
            equipes[gestor_key] = []
        
        if membro_email not in equipes[gestor_key]:
            equipes[gestor_key].append(membro_email)
            _save_equipes(equipes)
        
        return jsonify({"success": True, "membros": equipes[gestor_key]})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/equipes/<gestor_email>/membros/<membro_email>', methods=['DELETE'])
def remove_membro_equipe(gestor_email, membro_email):
    """Remove um membro da equipe de um gestor."""
    try:
        equipes = _load_equipes()
        gestor_key = gestor_email.lower()
        membro_key = membro_email.lower()
        
        if gestor_key in equipes and membro_key in equipes[gestor_key]:
            equipes[gestor_key].remove(membro_key)
            _save_equipes(equipes)
        
        return jsonify({"success": True, "membros": equipes.get(gestor_key, [])})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# =========================================================================
# ENDPOINTS DE CONCESSIONÁRIAS
# =========================================================================

@app.route('/config/concessionarias', methods=['GET'])
def get_concessionarias():
    """
    Lista todas as concessionárias com dados oficiais da ANEEL.
    Endpoint principal para dados de tarifas e disponibilidade.
    """
    try:
        concessionarias = _load_concessionarias()
        # Formatar para lista ordenada por ranking
        lista = []
        for slug, data in concessionarias.items():
            item = {
                "id": slug,
                "nome": data.get("nome"),
                "uf": data.get("uf"),
                "ranking": data.get("ranking"),
                "tarifa_kwh": data.get("tarifa_kwh"),
                "tarifa_branca_ponta": data.get("tarifa_branca_ponta"),
                "tarifa_branca_intermediaria": data.get("tarifa_branca_intermediaria"),
                "tarifa_branca_fora_ponta": data.get("tarifa_branca_fora_ponta"),
                "custo_disponibilidade": data.get("custo_disponibilidade", {}),
                "resolucao": data.get("resolucao"),
                "vigencia": data.get("vigencia")
            }
            lista.append(item)
        lista.sort(key=lambda x: x.get("ranking") or 999)
        return jsonify({"success": True, "concessionarias": lista})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/concessionarias/<slug>', methods=['GET'])
def get_concessionaria(slug):
    """Retorna dados de uma concessionária específica."""
    try:
        concessionarias = _load_concessionarias()
        if slug in concessionarias:
            return jsonify({"success": True, "concessionaria": concessionarias[slug]})
        return jsonify({"success": False, "message": "Concessionária não encontrada"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# =========================================================================
# CONFIG: proposta_configs (Postgres)
# =========================================================================
@app.route('/config/proposta-configs', methods=['GET'])
def get_proposta_configs():
    """
    Retorna a configuração 'proposta_configs' salva no Postgres.
    """
    try:
        if not USE_DB:
            return jsonify({"success": True, "config": None, "source": "file"}), 200
        # Qualquer usuário autenticado pode ler (usado nos cálculos do projeto)
        me = _require_auth()
        if not me:
            return jsonify({"success": False, "message": "Não autenticado"}), 401
        db = SessionLocal()
        row = db.get(ConfigDB, "proposta_configs")
        db.close()
        cfg = row.data if row else None
        if isinstance(cfg, dict):
            cfg = {"id": "proposta_configs", **cfg}
            cfg.setdefault("chave", "proposta_configs")
            cfg.setdefault("tipo", "proposta")
        return jsonify({"success": True, "config": cfg, "source": "db"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/proposta-configs', methods=['POST'])
def save_proposta_configs():
    """
    Salva (upsert) a configuração 'proposta_configs' no Postgres.
    Body: objeto JSON com os campos de configuração.
    """
    try:
        if not USE_DB:
            return jsonify({"success": False, "message": "DB indisponível"}), 400
        if not _require_admin_access_app():
            return jsonify({"success": False, "message": "Não autorizado"}), 403
        data = request.get_json() or {}
        if not isinstance(data, dict):
            return jsonify({"success": False, "message": "Payload inválido"}), 400
        data = {**data}
        data.pop("id", None)
        data.setdefault("chave", "proposta_configs")
        data.setdefault("tipo", "proposta")

        db = SessionLocal()
        row = db.get(ConfigDB, "proposta_configs")
        if row:
            row.data = data
        else:
            db.add(ConfigDB(id="proposta_configs", data=data))
        db.commit()
        row = db.get(ConfigDB, "proposta_configs")
        db.close()

        cfg = row.data if row else data
        cfg = {"id": "proposta_configs", **(cfg if isinstance(cfg, dict) else {})}
        cfg.setdefault("chave", "proposta_configs")
        cfg.setdefault("tipo", "proposta")
        return jsonify({"success": True, "config": cfg, "source": "db"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/taxas-distribuicao', methods=['GET'])
def get_taxas_distribuicao():
    """
    Lista o mapa de taxas de distribuição mensais por concessionária.
    Mantido para compatibilidade - usa dados do concessionarias.json.
    """
    try:
        # Priorizar dados do arquivo unificado de concessionárias
        concessionarias = _load_concessionarias()
        if concessionarias:
            taxas = {}
            for slug, data in concessionarias.items():
                custo = data.get("custo_disponibilidade", {})
                taxas[slug] = {
                    "nome": data.get("nome"),
                    "tarifa_kwh": data.get("tarifa_kwh"),
                    "monofasica": custo.get("monofasica", 0),
                    "bifasica": custo.get("bifasica", 0),
                    "trifasica": custo.get("trifasica", 0),
                    "fonte": f"ANEEL - REH {data.get('resolucao', '')}",
                    "vigencia": data.get("vigencia")
                }
            return jsonify({"success": True, "items": taxas})
        # Fallback para arquivo antigo
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

@app.route('/config/taxas-distribuicao/popular-padrao', methods=['POST'])
def popular_taxas_padrao():
    """
    Popula as taxas de distribuição com as concessionárias padrão de São Paulo.
    Valores baseados na RN ANEEL 1.000/2021 (Grupo B).
    """
    try:
        # Concessionárias de SP com valores médios de custo de disponibilidade (2024/2025)
        concessionarias_padrao = {
            "enel_sp": {
                "nome": "Enel Distribuição São Paulo",
                "monofasica": 49.50,
                "bifasica": 82.50,
                "trifasica": 165.00,
                "fonte": "ANEEL 2024"
            },
            "cpfl_piratininga": {
                "nome": "CPFL Piratininga",
                "monofasica": 48.30,
                "bifasica": 80.50,
                "trifasica": 161.00,
                "fonte": "ANEEL 2024"
            },
            "cpfl_paulista": {
                "nome": "CPFL Paulista",
                "monofasica": 47.40,
                "bifasica": 79.00,
                "trifasica": 158.00,
                "fonte": "ANEEL 2024"
            },
            "cpfl_santa_cruz": {
                "nome": "CPFL Santa Cruz",
                "monofasica": 46.80,
                "bifasica": 78.00,
                "trifasica": 156.00,
                "fonte": "ANEEL 2024"
            },
            "elektro": {
                "nome": "Elektro (Neoenergia)",
                "monofasica": 45.90,
                "bifasica": 76.50,
                "trifasica": 153.00,
                "fonte": "ANEEL 2024"
            },
            "edp_sp": {
                "nome": "EDP São Paulo",
                "monofasica": 51.00,
                "bifasica": 85.00,
                "trifasica": 170.00,
                "fonte": "ANEEL 2024"
            },
            "light": {
                "nome": "Light (RJ)",
                "monofasica": 55.20,
                "bifasica": 92.00,
                "trifasica": 184.00,
                "fonte": "ANEEL 2024"
            },
            "cemig": {
                "nome": "CEMIG (MG)",
                "monofasica": 44.10,
                "bifasica": 73.50,
                "trifasica": 147.00,
                "fonte": "ANEEL 2024"
            },
            "copel": {
                "nome": "COPEL (PR)",
                "monofasica": 42.60,
                "bifasica": 71.00,
                "trifasica": 142.00,
                "fonte": "ANEEL 2024"
            },
            "celesc": {
                "nome": "CELESC (SC)",
                "monofasica": 43.80,
                "bifasica": 73.00,
                "trifasica": 146.00,
                "fonte": "ANEEL 2024"
            },
            "rge_sul": {
                "nome": "RGE Sul (RS)",
                "monofasica": 45.30,
                "bifasica": 75.50,
                "trifasica": 151.00,
                "fonte": "ANEEL 2024"
            },
            "equatorial_goias": {
                "nome": "Equatorial Goiás",
                "monofasica": 41.40,
                "bifasica": 69.00,
                "trifasica": 138.00,
                "fonte": "ANEEL 2024"
            },
            "energisa_mt": {
                "nome": "Energisa MT",
                "monofasica": 43.50,
                "bifasica": 72.50,
                "trifasica": 145.00,
                "fonte": "ANEEL 2024"
            },
            "energisa_ms": {
                "nome": "Energisa MS",
                "monofasica": 44.40,
                "bifasica": 74.00,
                "trifasica": 148.00,
                "fonte": "ANEEL 2024"
            },
            "coelba": {
                "nome": "COELBA (BA)",
                "monofasica": 46.50,
                "bifasica": 77.50,
                "trifasica": 155.00,
                "fonte": "ANEEL 2024"
            },
            "celpe": {
                "nome": "CELPE (PE)",
                "monofasica": 47.70,
                "bifasica": 79.50,
                "trifasica": 159.00,
                "fonte": "ANEEL 2024"
            },
            "cosern": {
                "nome": "COSERN (RN)",
                "monofasica": 45.60,
                "bifasica": 76.00,
                "trifasica": 152.00,
                "fonte": "ANEEL 2024"
            },
            "enel_ce": {
                "nome": "Enel Ceará",
                "monofasica": 48.60,
                "bifasica": 81.00,
                "trifasica": 162.00,
                "fonte": "ANEEL 2024"
            }
        }
        
        # Carregar taxas existentes e mesclar (não sobrescrever se já existir)
        cur = _load_taxas()
        added = 0
        for slug, dados in concessionarias_padrao.items():
            if slug not in cur:
                cur[slug] = dados
                added += 1
        
        _save_taxas(cur)
        
        return jsonify({
            "success": True, 
            "items": cur,
            "message": f"{added} concessionárias adicionadas. Total: {len(cur)}"
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# =========================================================================
# FORMAS DE PAGAMENTO (Config)
# =========================================================================

# Default payment options
DEFAULT_FORMAS_PAGAMENTO = {
    "debito": [
        {"tipo": "Débito", "taxa": 1.09},  # VISA/MASTER
    ],
    "pagseguro": [
        {"parcelas": 1, "taxa": 3.16, "nome": "Crédito à Vista"},
        {"parcelas": 2, "taxa": 4.57},
        {"parcelas": 3, "taxa": 5.38},
        {"parcelas": 4, "taxa": 6.18},
        {"parcelas": 5, "taxa": 6.97},
        {"parcelas": 6, "taxa": 7.75},
        {"parcelas": 7, "taxa": 8.92},
        {"parcelas": 8, "taxa": 9.68},
        {"parcelas": 9, "taxa": 10.44},
        {"parcelas": 10, "taxa": 11.19},
        {"parcelas": 11, "taxa": 11.93},
        {"parcelas": 12, "taxa": 12.66},
        {"parcelas": 13, "taxa": 13.89},
        {"parcelas": 14, "taxa": 14.60},
        {"parcelas": 15, "taxa": 15.31},
        {"parcelas": 16, "taxa": 16.01},
        {"parcelas": 17, "taxa": 16.70},
        {"parcelas": 18, "taxa": 17.39},
    ],
    "financiamento": [
        {"parcelas": 12, "taxa": 1.95},
        {"parcelas": 24, "taxa": 1.95},
        {"parcelas": 36, "taxa": 1.95},
        {"parcelas": 48, "taxa": 1.95},
        {"parcelas": 60, "taxa": 1.95},
        {"parcelas": 72, "taxa": 1.95},
        {"parcelas": 84, "taxa": 1.95},
        {"parcelas": 96, "taxa": 1.95},
    ]
}

def _load_formas_pagamento():
    """Carrega configuração de formas de pagamento do Postgres via ConfigDB (ou retorna default)."""
    try:
        if not USE_DB:
            return DEFAULT_FORMAS_PAGAMENTO

        db = SessionLocal()
        try:
            row = db.get(ConfigDB, "formas_pagamento")
            value = (row.data if row else None)
        finally:
            db.close()

        if isinstance(value, str):
            try:
                value = json.loads(value)
            except Exception:
                value = None

        if isinstance(value, dict) and value.get("pagseguro"):
            return value
    except Exception as e:
        # Nunca pode explodir em produção — senão o Slide 12 cai no fallback e vira R$ 0,00
        try:
            logging.warning(f"Erro ao carregar formas de pagamento: {e}")
        except Exception:
            print(f"⚠️ Erro ao carregar formas de pagamento: {e}")

    return DEFAULT_FORMAS_PAGAMENTO

def _save_formas_pagamento(data):
    """Salva configuração de formas de pagamento no Postgres via ConfigDB."""
    try:
        if not USE_DB:
            return False
        if not isinstance(data, dict):
            return False

        db = SessionLocal()
        try:
            row = db.get(ConfigDB, "formas_pagamento")
            if row:
                row.data = data
            else:
                db.add(ConfigDB(id="formas_pagamento", data=data))
            db.commit()
            return True
        finally:
            db.close()
    except Exception as e:
        try:
            logging.warning(f"Erro ao salvar formas de pagamento: {e}")
        except Exception:
            print(f"⚠️ Erro ao salvar formas de pagamento: {e}")
    return False

@app.route('/config/formas-pagamento', methods=['GET'])
def get_formas_pagamento():
    """Retorna configuração de formas de pagamento."""
    try:
        formas = _load_formas_pagamento()
        return jsonify({"success": True, "formas_pagamento": formas})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/config/formas-pagamento', methods=['POST'])
def save_formas_pagamento():
    """Salva configuração de formas de pagamento."""
    try:
        body = request.get_json() or {}
        formas = body.get('formas_pagamento', DEFAULT_FORMAS_PAGAMENTO)
        
        if _save_formas_pagamento(formas):
            return jsonify({"success": True, "formas_pagamento": formas})
        else:
            # Se não tem DB, retorna sucesso mas os dados não persistem
            return jsonify({"success": True, "formas_pagamento": formas, "warning": "Dados não persistidos (sem banco)"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

def calcular_parcelas_pagamento(valor_total, formas_pagamento=None):
    """
    Calcula o valor das parcelas para cada opção de pagamento.
    Retorna HTML formatado para inserir no template.
    """
    if formas_pagamento is None:
        formas_pagamento = _load_formas_pagamento()
    
    def fmt_currency(val):
        return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    def _to_float(v, default=0.0):
        try:
            if v is None:
                return default
            if isinstance(v, (int, float)):
                return float(v)
            if isinstance(v, str):
                s = v.strip()
                for token in ['R$', 'r$', 'RS', 'rs']:
                    s = s.replace(token, '')
                # normalizar whitespaces (inclui NBSP)
                try:
                    import re
                    s = re.sub(r'\s+', '', s)
                except Exception:
                    s = ''.join(s.split())
                # aceitar "3,16" ou "3.16"
                if ',' in s and '.' in s:
                    if s.rfind(',') > s.rfind('.'):
                        s = s.replace('.', '').replace(',', '.')
                    else:
                        s = s.replace(',', '')
                elif ',' in s:
                    s = s.replace('.', '').replace(',', '.')
                return float(s)
            return float(v)
        except Exception:
            return default

    def _to_int(v, default=1):
        try:
            iv = int(round(_to_float(v, default=float(default))))
            return iv if iv > 0 else default
        except Exception:
            return default

    # Garantir que valor_total é um número válido (aceita string com moeda/virgula/NBSP)
    valor_total = _to_float(valor_total, default=0.0)

    # Blindagem: formas_pagamento pode vir como string JSON, dict aninhado, ou formato inválido.
    try:
        if isinstance(formas_pagamento, str):
            # tentar parsear JSON salvo como string
            try:
                formas_pagamento = json.loads(formas_pagamento)
            except Exception:
                formas_pagamento = None
        # alguns callers podem mandar {"formas_pagamento": {...}}
        if isinstance(formas_pagamento, dict) and "formas_pagamento" in formas_pagamento and "pagseguro" not in formas_pagamento:
            inner = formas_pagamento.get("formas_pagamento")
            if isinstance(inner, dict):
                formas_pagamento = inner
    except Exception:
        formas_pagamento = None
    
    print(f"💳 [PAGAMENTO] Valor total: {valor_total}, Formas: {type(formas_pagamento)}")
    
    # Garantir que temos os dados padrão se necessário
    if not isinstance(formas_pagamento, dict) or not formas_pagamento.get("pagseguro"):
        print("⚠️ [PAGAMENTO] Usando taxas padrão")
        formas_pagamento = DEFAULT_FORMAS_PAGAMENTO
    
    # Parcelas de cartão (taxa simples sobre o valor)
    # Requisito: sempre exibir 1x até 18x e caber no slide.
    parcelas_cartao_html = ""
    pagseguro_list = formas_pagamento.get("pagseguro", DEFAULT_FORMAS_PAGAMENTO["pagseguro"])
    print(f"💳 [PAGAMENTO] PagSeguro: {len(pagseguro_list)} opções")
    
    # Montar mapa 1..18: defaults + override do config (se existir)
    default_ps = DEFAULT_FORMAS_PAGAMENTO.get("pagseguro") or []
    default_map = {}
    for it in default_ps:
        p = _to_int((it or {}).get("parcelas", 0), default=0)
        if 1 <= p <= 18:
            default_map[p] = it

    cfg_map = {}
    if isinstance(pagseguro_list, list):
        for it in pagseguro_list:
            p = _to_int((it or {}).get("parcelas", 0), default=0)
            if 1 <= p <= 18:
                cfg_map[p] = it

    for parcelas in range(1, 19):
        it = cfg_map.get(parcelas) or default_map.get(parcelas) or {"parcelas": parcelas, "taxa": 0}
        taxa = _to_float((it or {}).get("taxa", 0), default=0.0)
        valor_com_taxa = valor_total * (1 + taxa / 100)
        valor_parcela = (valor_com_taxa / parcelas) if parcelas > 0 else 0.0
        parcelas_cartao_html += (
            f'''<div class="parcela-item"><span class="parcela-numero">{parcelas}x de </span>'''
            f'''<span class="parcela-valor">{fmt_currency(valor_parcela)}</span></div>'''
        )
    
    # Parcelas de financiamento (juros compostos - Price)
    parcelas_financiamento_html = ""
    menor_parcela = float('inf')
    financiamento_list = formas_pagamento.get("financiamento", DEFAULT_FORMAS_PAGAMENTO["financiamento"])
    print(f"🏦 [PAGAMENTO] Financiamento: {len(financiamento_list)} opções")
    
    fin_rows = []
    for item in financiamento_list:
        parcelas = _to_int((item or {}).get("parcelas", 1), default=1)
        taxa_mensal = _to_float((item or {}).get("taxa", 0), default=0.0) / 100
        
        if taxa_mensal > 0:
            # Fórmula Price
            valor_parcela = valor_total * (taxa_mensal * (1 + taxa_mensal) ** parcelas) / ((1 + taxa_mensal) ** parcelas - 1)
        else:
            valor_parcela = valor_total / parcelas
        
        fin_rows.append((parcelas, float(valor_parcela)))
        if valor_parcela < menor_parcela:
            menor_parcela = float(valor_parcela)

    # Montar HTML destacando a melhor (menor parcela)
    for parcelas, valor_parcela in fin_rows:
        is_best = (menor_parcela != float('inf')) and (abs(valor_parcela - menor_parcela) <= 0.01)
        cls = "parcela-item best" if is_best else "parcela-item"
        parcelas_financiamento_html += (
            f'''<div class="{cls}"><span class="parcela-numero">{parcelas}x de </span>'''
            f'''<span class="parcela-valor">{fmt_currency(valor_parcela)}</span></div>'''
        )
    
    # Valor à vista no cartão (1x com taxa)
    primeira_taxa = _to_float((cfg_map.get(1) or default_map.get(1) or {}).get("taxa", 3.16), default=3.16)
    valor_avista = valor_total * (1 + primeira_taxa / 100)
    
    return {
        "parcelas_cartao": parcelas_cartao_html,
        "parcelas_financiamento": parcelas_financiamento_html,
        "valor_avista_cartao": fmt_currency(valor_avista),
        "menor_parcela_financiamento": fmt_currency(menor_parcela) if menor_parcela != float('inf') else fmt_currency(0)
    }


# -----------------------------------------------------------------------------
# Admin / Debug: relatório completo de cálculos de uma proposta
# -----------------------------------------------------------------------------
def _json_safe(obj, _depth: int = 0):
    """
    Converte estruturas em algo serializável em JSON com tolerância a tipos não padrão.
    Também evita payloads gigantes (base64) explodirem a resposta.
    """
    try:
        if _depth > 12:
            return str(obj)

        if obj is None or isinstance(obj, (bool, int, float, str)):
            if isinstance(obj, str) and len(obj) > 20000:
                head = obj[:2000]
                tail = obj[-400:]
                return f"{head}\n...[TRUNCADO {len(obj)} chars]...\n{tail}"
            return obj

        if isinstance(obj, (datetime, date)):
            try:
                return obj.isoformat()
            except Exception:
                return str(obj)

        try:
            from decimal import Decimal
            if isinstance(obj, Decimal):
                return float(obj)
        except Exception:
            pass

        if isinstance(obj, (list, tuple, set)):
            return [_json_safe(x, _depth=_depth + 1) for x in list(obj)]

        if isinstance(obj, dict):
            out = {}
            for k, v in obj.items():
                out[str(k)] = _json_safe(v, _depth=_depth + 1)
            return out

        return str(obj)
    except Exception:
        return str(obj)


def _parse_preco_robusto_debug(val) -> float:
    """Parse robusto de preço (inclui NBSP) usado no relatório de debug."""
    try:
        if val is None:
            return 0.0
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            s = val.strip()
            for token in ['R$', 'r$', 'RS', 'rs']:
                s = s.replace(token, '')
            try:
                s = re.sub(r"\s+", "", s)
            except Exception:
                s = ''.join(s.split())
            s = s.strip()
            if not s:
                return 0.0
            if ',' in s and '.' in s:
                if s.rfind(',') > s.rfind('.'):
                    s = s.replace('.', '').replace(',', '.')
                else:
                    s = s.replace(',', '')
            elif ',' in s:
                parts = s.split(',')
                if len(parts) == 2 and len(parts[1]) in (2, 3):
                    s = s.replace(',', '.')
                else:
                    s = s.replace(',', '')
            return float(s)
        return 0.0
    except Exception:
        return 0.0


def build_relatorio_calculos_proposta(proposta_data: dict, include_render: bool = False) -> dict:
    """
    Gera um relatório completo (somente leitura) com os principais cálculos executados
    no backend para montar a proposta (HTML/PDF), incluindo:
    - Normalizações e parsing
    - Núcleo de dimensionamento (calcular_dimensionamento) e tabelas/metrics
    - Dados de gráficos (mesmos usados no ECharts)
    - Parcelamentos (persistidos e calculados)
    """
    proposta_data = proposta_data or {}
    warnings = []

    payload_raw = _json_safe(proposta_data)

    # Preço base para pagamentos (mesma ideia do process_template_html)
    preco_final_real = 0.0
    preco_sources = []
    chaves_preco = ['preco_venda', 'preco_final', 'custo_total_projeto', 'investimento_inicial', 'custo_total', 'valor_total']
    for chave in chaves_preco:
        val = proposta_data.get(chave)
        if val is None:
            continue
        parsed = _parse_preco_robusto_debug(val)
        preco_sources.append({"chave": chave, "raw": val, "parsed": parsed})
        if parsed > 0 and preco_final_real <= 0:
            preco_final_real = parsed

    if preco_final_real <= 0:
        try:
            custo_equip = _parse_preco_robusto_debug(proposta_data.get('custo_equipamentos', 0))
            custo_inst = _parse_preco_robusto_debug(proposta_data.get('custo_instalacao', 0))
            custo_homol = _parse_preco_robusto_debug(proposta_data.get('custo_homologacao', 0))
            custo_outros = _parse_preco_robusto_debug(proposta_data.get('custo_outros', 0))
            margem = _parse_preco_robusto_debug(proposta_data.get('margem_lucro', 0))
            soma = custo_equip + custo_inst + custo_homol + custo_outros + margem
            if soma > 0:
                preco_final_real = soma
                preco_sources.append({"chave": "__soma_custos__", "raw": {"equip": custo_equip, "inst": custo_inst, "homol": custo_homol, "outros": custo_outros, "margem": margem}, "parsed": soma})
        except Exception as e:
            warnings.append(f"Falha ao calcular soma de custos: {e}")

    if preco_final_real <= 0:
        warnings.append("Preço final não encontrado/zerado (preco_venda/preco_final/custos). Parcelamentos podem ficar 0.")

    # Núcleo (placeholders/HTML)
    core_payload_html = {}
    core_html = {}
    try:
        consumo_kwh = parse_float(proposta_data.get('consumo_mensal_kwh', 0), 0.0)
        if (consumo_kwh <= 0) and isinstance(proposta_data.get('consumo_mes_a_mes'), list):
            try:
                arr_vals = [parse_float(((x or {}).get('kwh') or 0), 0.0) for x in proposta_data.get('consumo_mes_a_mes')]
                arr_vals = [v for v in arr_vals if v > 0]
                if arr_vals:
                    consumo_kwh = sum(arr_vals) / len(arr_vals)
            except Exception:
                pass

        core_payload_html = {
            "consumo_mensal_reais": parse_float(proposta_data.get('consumo_mensal_reais', 0), 0.0),
            "consumo_mensal_kwh": consumo_kwh,
            "tarifa_energia": parse_float(proposta_data.get('tarifa_energia', 0), 0.0),
            "potencia_sistema": parse_float(proposta_data.get('potencia_sistema', proposta_data.get('potencia_kwp', 0)), 0.0),
            "preco_venda": parse_float(proposta_data.get('preco_venda', proposta_data.get('preco_final', proposta_data.get('custo_total_projeto', 0))), 0.0),
            "irradiacao_media": parse_float(proposta_data.get('irradiacao_media', 5.15), 5.15),
            "ano_instalacao": 2026,
        }
        core_html = calcular_dimensionamento(core_payload_html) or {}
    except Exception as e:
        warnings.append(f"Falha ao executar calcular_dimensionamento (HTML): {e}")
        core_html = {}

    # Núcleo (gráficos)
    irr_vec = None
    core_payload_charts = {}
    core_charts = {}
    try:
        irr_custom = proposta_data.get('irradiancia_mensal_kwh_m2_dia')
        if isinstance(irr_custom, list) and len(irr_custom) == 12:
            irr_vec = [parse_float(v, 0.0) for v in irr_custom]
        else:
            media = parse_float(proposta_data.get('irradiacao_media', 5.15), 5.15)
            try:
                irr_vec_csv = _resolve_irr_vec_from_csv(proposta_data.get('cidade'), media)
                irr_vec = irr_vec_csv if (isinstance(irr_vec_csv, list) and len(irr_vec_csv) == 12) else [media] * 12
            except Exception:
                irr_vec = [media] * 12

        consumo_kwh_c = parse_float(proposta_data.get('consumo_mensal_kwh', 0), 0.0)
        consumo_reais_c = parse_float(proposta_data.get('consumo_mensal_reais', 0), 0.0)
        tarifa_kwh_c = parse_float(proposta_data.get('tarifa_energia', 0), 0.0)
        if consumo_kwh_c <= 0 and consumo_reais_c > 0 and tarifa_kwh_c > 0:
            consumo_kwh_c = consumo_reais_c / tarifa_kwh_c

        core_payload_charts = {
            "consumo_mensal_kwh": consumo_kwh_c,
            "consumo_mensal_reais": consumo_reais_c,
            "tarifa_energia": tarifa_kwh_c,
            "potencia_sistema": parse_float(proposta_data.get('potencia_sistema', proposta_data.get('potencia_kwp', 0)), 0.0),
            "preco_venda": parse_float(proposta_data.get('preco_venda', proposta_data.get('preco_final', proposta_data.get('custo_total_projeto', 0))), 0.0),
            "irradiacao_media": parse_float(proposta_data.get('irradiacao_media', 5.15), 5.15),
            "irradiancia_mensal_kwh_m2_dia": irr_vec,
            "ano_instalacao": 2026,
        }
        core_charts = calcular_dimensionamento(core_payload_charts) or {}
    except Exception as e:
        warnings.append(f"Falha ao executar calcular_dimensionamento (GRÁFICOS): {e}")
        core_charts = {}

    # Charts payload (para conferência)
    charts_payload = {}
    try:
        tabelas = (core_charts.get("tabelas") or {}) if isinstance(core_charts, dict) else {}
        cas = tabelas.get("custo_acumulado_sem_solar_r") or []
        ca = tabelas.get("custo_anual_sem_solar_r") or []
        fca = tabelas.get("fluxo_caixa_acumulado_r") or []
        consumo_tbl = (tabelas.get("consumo_mensal_kwh") or []) if tabelas else []
        consumo_mes = float(consumo_tbl[0]) if (isinstance(consumo_tbl, list) and len(consumo_tbl) >= 1) else 0.0
        prod_mes = (tabelas.get("producao_mensal_kwh_ano1") or [])
        meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

        def _extract_consumo_vec_local() -> list[float]:
            try:
                cmm = proposta_data.get("consumo_mes_a_mes")
                if isinstance(cmm, list) and len(cmm) > 0:
                    out = [None] * 12
                    months_map = {
                        "jan": 0, "janeiro": 0,
                        "fev": 1, "fevereiro": 1,
                        "mar": 2, "março": 2, "marco": 2,
                        "abr": 3, "abril": 3,
                        "mai": 4, "maio": 4,
                        "jun": 5, "junho": 5,
                        "jul": 6, "julho": 6,
                        "ago": 7, "agosto": 7,
                        "set": 8, "setembro": 8,
                        "out": 9, "outubro": 9,
                        "nov": 10, "novembro": 10,
                        "dez": 11, "dezembro": 11,
                    }
                    seq_i = 0
                    for item in cmm[:24]:
                        if not isinstance(item, dict):
                            continue
                        v = parse_float(item.get("kwh", item.get("valor", item.get("value", 0))), None)
                        if v is None:
                            continue
                        mes_raw = (item.get("mes") or item.get("month") or item.get("label") or "")
                        mes_s = str(mes_raw).strip().lower()
                        idx = None
                        if mes_s in months_map:
                            idx = months_map[mes_s]
                        else:
                            m = re.search(r"(\d{1,2})", mes_s)
                            if m:
                                try:
                                    n = int(m.group(1))
                                    if 1 <= n <= 12:
                                        idx = n - 1
                                except Exception:
                                    idx = None
                            if idx is None:
                                for k, i in months_map.items():
                                    if mes_s.startswith(k):
                                        idx = i
                                        break
                        if idx is None:
                            if seq_i < 12:
                                idx = seq_i
                                seq_i += 1
                        if idx is not None and 0 <= idx < 12:
                            out[idx] = float(v)
                    vals = [x for x in out if isinstance(x, (int, float))]
                    if vals:
                        avg = sum(vals) / len(vals)
                        return [float(x) if isinstance(x, (int, float)) else float(avg) for x in out]
            except Exception:
                pass

            for k in [
                "consumo_mensal_kwh_meses", "consumo_mes_a_mes_kwh", "consumo_kwh_mensal",
                "consumo_kwh_12meses", "consumo_mensal_kwh_array"
            ]:
                v = proposta_data.get(k)
                if isinstance(v, list) and len(v) >= 12:
                    out = [parse_float(x, 0.0) for x in v[:12]]
                    return [float(x) for x in out]

            if isinstance(consumo_tbl, list) and len(consumo_tbl) == 12:
                return [parse_float(x, 0.0) for x in consumo_tbl]

            base = float(consumo_mes or 0.0)
            return [base] * 12 if base > 0 else [0.0] * 12

        consumo_vec = _extract_consumo_vec_local()
        prod_vec = [float(v) for v in (prod_mes[:12] if prod_mes else [])]
        if not prod_vec or len(prod_vec) != 12:
            prod_anual_kwh = (tabelas.get("producao_anual_kwh") or [0])[0] if tabelas else 0
            prod_anual_kwh = float(prod_anual_kwh or 0.0)
            prod_vec = [prod_anual_kwh / 12.0] * 12 if prod_anual_kwh > 0 else [0.0] * 12

        idxs = [0, 4, 9, 14, 19, 24]
        s03_vals = [float(cas[i]) for i in idxs] if len(cas) >= 25 else []
        s03_labs = [f"Ano {i+1}" for i in idxs]
        s04_vals = [float(v) for v in ca] if ca else []
        s04_labs = [f"Ano {i+1}" for i in range(len(s04_vals))]
        s06_vals = [float(v) for v in fca] if fca else []
        s06_labs = [f"Ano {i+1}" for i in range(len(s06_vals))]
        gasto_total_25 = float(cas[-1]) if cas else 0.0
        investimento = float(core_payload_charts.get("preco_venda") or 0.0)
        s09_vals = [gasto_total_25, investimento]
        s09_labs = ["Sem energia solar (25 anos)", "Investimento (preço de venda)"]

        charts_payload = {
            "s03": {"labels": s03_labs, "values": s03_vals},
            "s04": {"labels": s04_labs, "values": s04_vals},
            "s05": {"labels": meses, "consumo": consumo_vec, "producao": prod_vec},
            "s06": {"labels": s06_labs, "values": s06_vals},
            "s09": {"labels": s09_labs, "values": s09_vals},
        }
    except Exception as e:
        warnings.append(f"Falha ao montar charts_payload: {e}")
        charts_payload = {}

    pagamentos_persistidos = {
        "valor_avista_cartao": proposta_data.get("valor_avista_cartao"),
        "parcelas_cartao": proposta_data.get("parcelas_cartao"),
        "menor_parcela_financiamento": proposta_data.get("menor_parcela_financiamento"),
        "parcelas_financiamento": proposta_data.get("parcelas_financiamento"),
    }
    pagamentos_calculados = {}
    formas_pagamento_usadas = None
    try:
        try:
            formas_pagamento_usadas = _load_formas_pagamento()
        except Exception as e:
            warnings.append(f"Falha ao carregar formas_pagamento do DB: {e}")
            formas_pagamento_usadas = None
        pagamentos_calculados = calcular_parcelas_pagamento(preco_final_real, formas_pagamento_usadas)
    except Exception as e:
        warnings.append(f"Falha ao calcular parcelas_pagamento: {e}")
        pagamentos_calculados = {}

    metrics_html = (core_html.get("metrics") or {}) if isinstance(core_html, dict) else {}
    tabelas_html = (core_html.get("tabelas") or {}) if isinstance(core_html, dict) else {}
    metrics_charts = (core_charts.get("metrics") or {}) if isinstance(core_charts, dict) else {}
    tabelas_charts = (core_charts.get("tabelas") or {}) if isinstance(core_charts, dict) else {}

    report = {
        "meta": {
            "generated_at": datetime.now().isoformat(),
            "has_consumo_mes_a_mes": isinstance(proposta_data.get("consumo_mes_a_mes"), list) and len(proposta_data.get("consumo_mes_a_mes")) > 0,
        },
        "payload_raw": payload_raw,
        "pricing": {
            "preco_final_real": preco_final_real,
            "preco_final_formatado": format_brl(preco_final_real),
            "sources": preco_sources,
        },
        "dimensionamento": {
            "html": {
                "core_payload": _json_safe(core_payload_html),
                "metrics": _json_safe(metrics_html),
                "tabelas": _json_safe(tabelas_html),
            },
            "charts": {
                "core_payload": _json_safe(core_payload_charts),
                "irradiancia_mensal_kwh_m2_dia": _json_safe(irr_vec),
                "metrics": _json_safe(metrics_charts),
                "tabelas": _json_safe(tabelas_charts),
            },
        },
        "graficos": {
            "charts_payload": _json_safe(charts_payload),
        },
        "pagamentos": {
            "persistidos_no_payload": _json_safe(pagamentos_persistidos),
            "formas_pagamento": _json_safe(formas_pagamento_usadas),
            "calculado_no_backend": _json_safe(pagamentos_calculados),
        },
        "warnings": warnings,
    }
    # Diagnóstico opcional: roda o render completo e informa placeholders restantes (sem retornar HTML)
    if include_render:
        try:
            import copy
            html = process_template_html(copy.deepcopy(proposta_data))
            restantes = re.findall(r"\{\{[^}]+\}\}", html or "")
            uniq = []
            seen = set()
            for x in restantes:
                if x not in seen:
                    seen.add(x)
                    uniq.append(x)
            report["render_diagnostics"] = {
                "html_size_chars": len(html or ""),
                "placeholders_remaining_count": len(restantes),
                "placeholders_remaining_unique": uniq[:200],
                "placeholders_unique_truncated": len(uniq) > 200,
            }
        except Exception as e:
            warnings.append(f"Falha ao gerar render_diagnostics: {e}")
    return _json_safe(report)


@app.route('/admin/propostas/<proposta_id>/calculos', methods=['GET'])
def admin_relatorio_calculos_proposta(proposta_id):
    """
    Endpoint ADMIN para exibir os cálculos usados pelo backend para gerar a proposta.
    Não altera nada no banco; apenas lê e retorna um relatório detalhado para conferência/debug.
    Requer role admin/gestor quando USE_DB.
    """
    try:
        if USE_DB:
            me = _current_user_row()
            if not me:
                return jsonify({"success": False, "message": "Não autenticado"}), 401
            role = (me.role or "").strip().lower()
            if role not in ("admin", "gestor"):
                return jsonify({"success": False, "message": "Não autorizado"}), 403

            db = SessionLocal()
            row = db.get(PropostaDB, proposta_id)
            db.close()
            if not row:
                return jsonify({"success": False, "message": "Proposta não encontrada"}), 404
            proposta_data = row.payload or {}
        else:
            proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
            if not proposta_file.exists():
                return jsonify({"success": False, "message": "Proposta não encontrada"}), 404
            with open(proposta_file, "r", encoding="utf-8") as f:
                proposta_data = json.load(f)

        include_render = str(request.args.get("render") or "").strip().lower() in ("1", "true", "yes", "y")
        report = build_relatorio_calculos_proposta(proposta_data, include_render=include_render)
        return jsonify({"success": True, "proposta_id": proposta_id, "report": report})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/debug/slide10/<proposta_id>', methods=['GET'])
def debug_slide10(proposta_id):
    """
    Diagnóstico do Slide 10: retorna preço base detectado e os valores calculados/persistidos.
    Útil para validar rapidamente por que o PDF/preview está mostrando R$ 0,00.
    """
    try:
        # Carregar dados da proposta.
        # Nota: este endpoint é de diagnóstico e retorna apenas dados do Slide 10 (sem PII),
        # então permitimos acesso sem auth para facilitar troubleshooting em produção.
        if USE_DB:
            db = SessionLocal()
            row = db.get(PropostaDB, proposta_id)
            db.close()
            if not row:
                return jsonify({"success": False, "message": "Proposta não encontrada"}), 404
            proposta_data = row.payload or {}
        else:
            proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
            if not proposta_file.exists():
                return jsonify({"success": False, "message": "Proposta não encontrada"}), 404
            with open(proposta_file, "r", encoding="utf-8") as f:
                proposta_data = json.load(f)

        base = (
            (proposta_data or {}).get("preco_venda")
            or (proposta_data or {}).get("preco_final")
            or (proposta_data or {}).get("custo_total_projeto")
            or 0
        )
        calc = calcular_parcelas_pagamento(base)

        return jsonify({
            "success": True,
            "base_preco_raw": base,
            "base_preco_num": float(proposta_data.get("preco_venda") or proposta_data.get("preco_final") or proposta_data.get("custo_total_projeto") or 0) if isinstance((proposta_data.get("preco_venda") or proposta_data.get("preco_final") or proposta_data.get("custo_total_projeto") or 0), (int, float)) else None,
            "persistido": {
                "parcelas_cartao_len": len((proposta_data or {}).get("parcelas_cartao") or ""),
                "parcelas_financiamento_len": len((proposta_data or {}).get("parcelas_financiamento") or ""),
                "valor_avista_cartao": (proposta_data or {}).get("valor_avista_cartao"),
                "menor_parcela_financiamento": (proposta_data or {}).get("menor_parcela_financiamento"),
            },
            "calculado": {
                "parcelas_cartao_len": len(calc.get("parcelas_cartao") or ""),
                "parcelas_financiamento_len": len(calc.get("parcelas_financiamento") or ""),
                "valor_avista_cartao": calc.get("valor_avista_cartao"),
                "menor_parcela_financiamento": calc.get("menor_parcela_financiamento"),
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/debug/slide10-render/<proposta_id>', methods=['GET'])
def debug_slide10_render(proposta_id):
    """
    Diagnóstico: roda o process_template_html completo e extrai apenas os valores
    renderizados no Slide 10 (sem retornar HTML inteiro e sem PII).
    """
    try:
        if USE_DB:
            db = SessionLocal()
            row = db.get(PropostaDB, proposta_id)
            db.close()
            if not row:
                return jsonify({"success": False, "message": "Proposta não encontrada"}), 404
            proposta_data = row.payload or {}
        else:
            proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
            if not proposta_file.exists():
                return jsonify({"success": False, "message": "Proposta não encontrada"}), 404
            with open(proposta_file, "r", encoding="utf-8") as f:
                proposta_data = json.load(f)

        html = process_template_html(proposta_data)

        # Extrair apenas dados do Slide 10
        # - valores dos destaques
        # - contagem de itens de parcelas renderizados
        m_avista = re.search(r'<div class="destaque-valor">\\s*([^<]+?)\\s*</div>', html)
        # segunda ocorrência é a do financiamento (class azul). capturar pela classe azul
        m_menor = re.search(r'<div class="destaque-valor azul">\\s*([^<]+?)\\s*</div>', html)
        n_items = len(re.findall(r'class="parcela-item"', html))

        # Contagem por seção (cartão e financiamento) dentro do slide 10 (melhor esforço)
        slide10 = ""
        m_slide = re.search(r'<section id="slide-10"[\\s\\S]*?</section>', html)
        if m_slide:
            slide10 = m_slide.group(0)
        n_items_slide10 = len(re.findall(r'class="parcela-item"', slide10)) if slide10 else 0

        return jsonify({
            "success": True,
            "avista_render": (m_avista.group(1).strip() if m_avista else None),
            "menor_render": (m_menor.group(1).strip() if m_menor else None),
            "parcelas_itens_total": n_items,
            "parcelas_itens_slide10": n_items_slide10,
            "placeholders_restantes": len(re.findall(r'\\{\\{[^}]+\\}\\}', slide10)) if slide10 else None,
        })
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
            # Tentar resolver pelo CSV de irradiância via cidade; se falhar, usa média constante
            try:
                irr_vec_csv = _resolve_irr_vec_from_csv(body.get('cidade') or body.get('city'), irr_media)
                irr_vec = irr_vec_csv if (isinstance(irr_vec_csv, list) and len(irr_vec_csv) == 12) else [irr_media] * 12
            except Exception:
                irr_vec = [irr_media] * 12

        # Derivar kWh se vier apenas R$ e tarifa
        if (consumo_kwh <= 0) and (consumo_reais > 0) and (tarifa > 0):
            consumo_kwh = consumo_reais / tarifa
        # Derivar kWh se vier consumo mês a mês (kWh) como array
        if consumo_kwh <= 0:
            possiveis_chaves_arrays = [
                'consumo_mensal_kwh_array', 'consumo_mensal_kwh_meses', 'consumo_mes_a_mes_kwh',
                'consumo_kwh_mes_a_mes', 'consumo_kwh_12meses', 'consumos_kwh', 'consumo_kwh_mensal'
            ]
            arr = None
            for k in possiveis_chaves_arrays:
                v = body.get(k)
                if isinstance(v, list) and len(v) >= 3:
                    arr = v
                    break
            if arr:
                vals = [_to_float(x, 0.0) for x in arr]
                vals = [x for x in vals if x > 0]
                if len(vals) > 0:
                    consumo_kwh = sum(vals) / len(vals)

        # Sanitização mínima
        if tarifa <= 0 or tarifa > 10:
            return jsonify({"success": False, "message": "Tarifa inválida. Informe tarifa (R$/kWh)."}), 400
        if potencia_kwp <= 0:
            return jsonify({"success": False, "message": "Potência do sistema (kWp) inválida."}), 400

        # Usar o núcleo único de dimensionamento (Lei 14.300/2022)
        core_payload = {
            "consumo_mensal_reais": consumo_reais,
            "consumo_mensal_kwh": consumo_kwh,
            "tarifa_energia": tarifa,
            "potencia_sistema": potencia_kwp,
            "preco_venda": preco_venda,
            "irradiacao_media": _to_float(body.get('irradiacao_media', 5.15), 5.15),
            "irradiancia_mensal_kwh_m2_dia": irr_vec,
            "ano_instalacao": 2026,  # Lei 14.300
        }
        core = calcular_dimensionamento(core_payload)
        metrics = core.get("metrics") or {}
        tabelas = core.get("tabelas") or {}

        # Gasto acumulado de 25 anos (para gráficos comparativos), se disponíveis
        gasto_acumulado_25 = 0.0
        if tabelas:
            cas = tabelas.get("custo_acumulado_sem_solar_r") or []
            if cas:
                gasto_acumulado_25 = float(cas[-1])

        # Resumo de pontos do gráfico 1 (anos 1,5,10,15,20,25) para consumo sem solar
        pontos_sem_solar = []
        if tabelas:
            idxs = [0, 4, 9, 14, 19, 24]
            cas = tabelas.get("custo_acumulado_sem_solar_r") or []
            pontos_sem_solar = [float(cas[i]) for i in idxs] if len(cas) >= 25 else []

        # MIGRAÇÃO: gráficos da proposta agora são ECharts (SVG) no template + Puppeteer.
        # Este endpoint fica focado em métricas e dados-base; mantemos `graficos_base64` por compatibilidade,
        # mas vazio (evita custo de CPU do Matplotlib).
        graficos_base64 = {}
        try:
            # Payload opcional para debug/telemetria (caso algum cliente queira renderizar fora do template)
            cas = tabelas.get("custo_acumulado_sem_solar_r") or []
            ca = tabelas.get("custo_anual_sem_solar_r") or []
            fca = tabelas.get("fluxo_caixa_acumulado_r") or []
            idxs = [0, 4, 9, 14, 19, 24]
            charts_payload = {
                "brand": {"blue": "#1E3A8A", "green": "#059669", "red": "#DC2626", "text": "#0f172a", "muted": "#334155", "grid": "#e2e8f0"},
                "s03": {
                    "labels": [f"Ano {i+1}" for i in idxs],
                    "values": [float(cas[i]) for i in idxs] if len(cas) >= 25 else [],
                },
                "s04": {
                    "labels": [f"Ano {i+1}" for i in range(len(ca or []))],
                    "values": [float(v) for v in (ca or [])],
                },
                "s05": {
                    "labels": ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                    "consumo": [float((tabelas.get("consumo_mensal_kwh") or [0])[0] or 0)] * 12,
                    "producao": [float(v) for v in (tabelas.get("producao_mensal_kwh_ano1") or [])[:12]],
                },
                "s06": {
                    "labels": [f"Ano {i+1}" for i in range(len(fca or []))],
                    "values": [float(v) for v in (fca or [])],
                },
                "s09": {
                    "labels": ["Sem energia solar (25 anos)", "Investimento (preço de venda)"],
                    "values": [float(cas[-1]) if cas else 0.0, float(preco_venda or 0.0)],
                },
            }
        except Exception:
            charts_payload = None

        resp = {
            "success": True,
            "graficos_base64": graficos_base64,
            "charts_payload": charts_payload,
            "metrics": {
                **metrics,
                "consumo_medio_kwh_mes": consumo_kwh,
                "tarifa_energia": tarifa,
                "preco_venda": preco_venda,
                "gasto_acumulado_sem_solar_25": gasto_acumulado_25,
                "pontos_sem_solar": {
                    "ano_1": pontos_sem_solar[0] if len(pontos_sem_solar) > 0 else 0,
                    "ano_5": pontos_sem_solar[1] if len(pontos_sem_solar) > 1 else 0,
                    "ano_10": pontos_sem_solar[2] if len(pontos_sem_solar) > 2 else 0,
                    "ano_15": pontos_sem_solar[3] if len(pontos_sem_solar) > 3 else 0,
                    "ano_20": pontos_sem_solar[4] if len(pontos_sem_solar) > 4 else 0,
                    "ano_25": pontos_sem_solar[5] if len(pontos_sem_solar) > 5 else 0,
                }
            }
        }
        return jsonify(resp)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/dimensionamento/excel-calculo', methods=['POST'])
def dimensionamento_excel_calculo():
    """
    Executa o cálculo unificado (núcleo) e retorna KPIs + tabelas.
    Mantém o endpoint por compatibilidade, mas usa o núcleo único.
    """
    try:
        body = request.get_json() or {}
        resultado = calcular_dimensionamento(body)
        return jsonify({"success": True, "resultado": resultado})
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
        # DB-first: atualizar payload no Postgres
        if USE_DB:
            db = SessionLocal()
            row = db.get(PropostaDB, proposta_id)
            if not row:
                db.close()
                return jsonify({"success": False, "message": "Proposta não encontrada"}), 404
            data = row.payload or {}
        else:
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
        if USE_DB:
            # sincronizar também colunas relevantes
            try:
                row.payload = data
                if data.get('anos_payback') is not None:
                    row.anos_payback = float(data.get('anos_payback') or 0)
                if data.get('economia_mensal_estimada') is not None:
                    row.economia_mensal_estimada = float(data.get('economia_mensal_estimada') or 0)
                db.commit()
            finally:
                db.close()
            return jsonify({"success": True, "message": "Gráficos anexados à proposta.", "source": "db"})

        with open(proposta_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"success": True, "message": "Gráficos anexados à proposta.", "source": "file"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/salvar-proposta', methods=['POST'])
def salvar_proposta():
    try:
        print("🔍 DEBUG: Iniciando endpoint /salvar-proposta")
        data = request.get_json() or {}
        print(f"🔍 DEBUG: Dados recebidos: {data}")

        # Owner sempre vem do usuário logado (Postgres/JWT)
        me = _current_user_row() if USE_DB else None
        if USE_DB and not me:
            return jsonify({"success": False, "message": "Não autenticado"}), 401
        
        # Upsert: se vier um ID existente, atualizamos; caso contrário criamos.
        incoming_id = (data.get("id") or data.get("proposta_id") or data.get("projeto_id") or "").strip()
        proposta_id = incoming_id if incoming_id else str(uuid.uuid4())
        print(f"🔍 DEBUG: ID da proposta: {proposta_id} (incoming={bool(incoming_id)})")

        # Para updates (rascunho/autosave), o frontend pode enviar payload parcial.
        # Não podemos sobrescrever campos ausentes com defaults/zeros.
        existing_payload = {}
        try:
            if incoming_id:
                if USE_DB:
                    db0 = SessionLocal()
                    try:
                        row0 = db0.get(PropostaDB, proposta_id)
                        existing_payload = (row0.payload or {}) if row0 else {}
                    finally:
                        db0.close()
                else:
                    proposta_file0 = PROPOSTAS_DIR / f"{proposta_id}.json"
                    if proposta_file0.exists():
                        with open(proposta_file0, "r", encoding="utf-8") as f:
                            existing_payload = json.load(f) or {}
        except Exception:
            existing_payload = {}

        _S = object()
        def _pick(key: str, default=_S):
            # usa o valor enviado se a chave existe no payload; senão cai para o existente; senão default
            if isinstance(data, dict) and key in data:
                return data.get(key)
            if isinstance(existing_payload, dict) and key in existing_payload:
                return existing_payload.get(key)
            return None if default is _S else default
        
        # Validação obrigatória: concessionária e tarifa válidas
        def _to_float(v, d=0.0):
            try:
                if isinstance(v, str):
                    s = v.strip()
                    for token in ['R$', 'r$', ' ']:
                        s = s.replace(token, '')
                    # BR: "892.857" (milhar) e "10.495,50" (milhar+decimal)
                    # Heurística: se tiver ponto e não tiver vírgula, e o sufixo do último ponto tem 3 dígitos -> é milhar.
                    if ('.' in s) and (',' not in s):
                        try:
                            tail = s.split('.')[-1]
                            if tail.isdigit() and len(tail) == 3:
                                s = s.replace('.', '')
                        except Exception:
                            pass
                    s = s.replace('.', '').replace(',', '.')
                    return float(s)
                return float(v)
            except Exception:
                return d

        def _to_money(v, d=0.0):
            return _to_float(v, d)
        status_payload = (data.get("status") or "").strip().lower() or "dimensionamento"
        is_draft = status_payload in ("rascunho", "draft")

        concessionaria_payload = (data.get('concessionaria') or data.get('concessionária') or '').strip()
        tarifa_payload = _to_float(data.get('tarifa_energia', 0), 0.0)
        # Em rascunho, permitimos salvar sem tarifa/concessionária (o usuário ainda não preencheu tudo).
        if not is_draft:
            if not concessionaria_payload or tarifa_payload <= 0 or tarifa_payload > 10:
                return jsonify({
                    "success": False,
                    "message": "Selecione a concessionária e informe uma tarifa válida (R$/kWh)."
                }), 400
        
        # Preparar dados da proposta
        # Normalizar consumo mês a mês (se fornecido)
        def _normalize_consumo_mes_a_mes(val):
            try:
                if not isinstance(val, list):
                    return []
                out = []
                for item in val[:24]:  # limite defensivo
                    if not isinstance(item, dict):
                        continue
                    mes = (item.get("mes") or item.get("month") or item.get("label") or "").strip()
                    kwh = _to_float(item.get("kwh", item.get("valor", item.get("value", 0))), 0.0)
                    # manter campos extras se existirem (ex.: ordem), mas garantir kwh numérico
                    out.append({**item, "mes": mes, "kwh": kwh})
                return out
            except Exception:
                return []

        consumo_mes_a_mes_norm = _normalize_consumo_mes_a_mes(data.get("consumo_mes_a_mes"))

        # Potência e preço: aceitar múltiplos nomes (rascunho/autosave usa potencia_kw, etc.)
        potencia_sistema_in = _pick("potencia_sistema", _S)
        if potencia_sistema_in is _S:
            potencia_sistema_in = _pick("potencia_kw", _S)
        if potencia_sistema_in is _S:
            potencia_sistema_in = _pick("potencia_sistema_kwp", _S)
        if potencia_sistema_in is _S:
            potencia_sistema_in = _pick("potencia_kwp", 0)

        preco_final_in = _pick("preco_final", _S)
        if preco_final_in is _S:
            preco_final_in = _pick("preco_venda", _S)
        if preco_final_in is _S:
            preco_final_in = _pick("precoVenda", _S)
        if preco_final_in is _S:
            preco_final_in = _pick("precoTotal", 0)

        cliente_nome_default = "" if is_draft else "Cliente"
        cliente_tel_default = "" if is_draft else "Telefone não informado"
        cliente_end_default = "" if is_draft else "Endereço não informado"
        cidade_default = "" if is_draft else "Projeto"

        proposta_data = {
            'id': proposta_id,
            'data_criacao': datetime.now().isoformat(),
            # Rastreamento do criador (para filtros por usuário)
            'created_by': (me.uid if USE_DB and me else data.get('created_by')),
            'created_by_email': (me.email if USE_DB and me else data.get('created_by_email')),
            # Aliases estáveis (para padronização)
            'user_id': (me.uid if USE_DB and me else data.get('created_by') or data.get('user_id')),
            'status': status_payload,
            # Campos do CRM (persistir para edição)
            'nome_projeto': _pick('nome_projeto') or _pick('nome') or None,
            'cep': _pick('cep') or None,
            'logradouro': _pick('logradouro') or None,
            'numero': _pick('numero') or None,
            'complemento': _pick('complemento') or None,
            'bairro': _pick('bairro') or None,
            'cliente_id': _pick('cliente_id'),
            'cliente_nome': _pick('cliente_nome', cliente_nome_default) or cliente_nome_default,
            'cliente_endereco': _pick('cliente_endereco', cliente_end_default) or cliente_end_default,
            'cliente_telefone': _pick('cliente_telefone', cliente_tel_default) or cliente_tel_default,
            'potencia_sistema': _to_float(potencia_sistema_in, 0.0) or 0.0,
            'preco_final': _to_money(preco_final_in, 0.0) or 0.0,
            'preco_venda': _to_money(_pick('preco_venda', preco_final_in or 0) or (preco_final_in or 0), 0.0) or 0.0,
            'cidade': _pick('cidade', cidade_default) or cidade_default,
            'concessionaria': concessionaria_payload,
            'tipo_telhado': _pick('tipo_telhado', ''),
            'estado': _pick('estado') or _pick('uf') or '',
            'tensao': _pick('tensao') or None,
            'vendedor_nome': _pick('vendedor_nome', 'Representante Comercial'),
            'vendedor_cargo': _pick('vendedor_cargo', 'Especialista em Energia Solar'),
            'vendedor_telefone': _pick('vendedor_telefone', '(11) 99999-9999'),
            'vendedor_email': _pick('vendedor_email', 'contato@empresa.com'),
            'data_proposta': datetime.now().strftime('%d/%m/%Y'),
            # Dados financeiros
            'conta_atual_anual': _pick('conta_atual_anual', 0) or 0,
            'anos_payback': _pick('anos_payback', 0) or 0,
            'gasto_acumulado_payback': _pick('gasto_acumulado_payback', 0) or 0,
            'consumo_mensal_kwh': _pick('consumo_mensal_kwh', 0) or 0,
            # Persistir também o consumo mês a mês (quando informado)
            'consumo_mes_a_mes': consumo_mes_a_mes_norm,
            'tarifa_energia': tarifa_payload,
            'economia_mensal_estimada': _pick('economia_mensal_estimada', 0) or 0,
            # Dados do kit
            'quantidade_placas': _pick('quantidade_placas', 0) or 0,
            'potencia_placa_w': _pick('potencia_placa_w', 0) or 0,
            'area_necessaria': _pick('area_necessaria', 0) or 0,
            'irradiacao_media': _pick('irradiacao_media', 5.15) or 5.15,
            'geracao_media_mensal': _pick('geracao_media_mensal', 0) or 0,
            'creditos_anuais': _pick('creditos_anuais', 0) or 0,
            'economia_total_25_anos': _pick('economia_total_25_anos', 0) or 0,
            'payback_meses': _pick('payback_meses', 0) or 0,
            # Custos
            'custo_total_projeto': _to_money(_pick('custo_total_projeto', 0) or 0, 0.0) or 0.0,
            'custo_equipamentos': _to_money(_pick('custo_equipamentos', 0) or 0, 0.0) or 0.0,
            'custo_instalacao': _to_money(_pick('custo_instalacao', 0) or 0, 0.0) or 0.0,
            'custo_homologacao': _to_money(_pick('custo_homologacao', 0) or 0, 0.0) or 0.0,
            'custo_outros': _to_money(_pick('custo_outros', 0) or 0, 0.0) or 0.0,
            'margem_lucro': _to_money(_pick('margem_lucro', 0) or 0, 0.0) or 0.0,
            'comissao_vendedor': _pick('comissao_vendedor', 5) or 5,
            # Preservar gráficos e métricas gerados na etapa de análise (se enviados pelo frontend)
            'graficos_base64': _pick('graficos_base64') or {},
            'metrics': _pick('metrics') or {}
        }

        # ====== Padronização: garantir que SEMPRE exista cliente_id (e vincular por ID, não por nome) ======
        # Motivação: telas como Clientes/Projetos contam projetos por cliente_id (match estrito se existe).
        # Se vier legado sem cliente_id, tentamos resolver; se não existir, criamos cliente e vinculamos.
        try:
            if not (proposta_data.get('cliente_id') or '').strip():
                nome_c = (proposta_data.get('cliente_nome') or '').strip()
                tel_c = (proposta_data.get('cliente_telefone') or '')
                email_c = (data.get('cliente_email') or data.get('email_cliente') or '').strip()

                def _norm_phone(s):
                    try:
                        return re.sub(r"\D+", "", str(s or ""))
                    except Exception:
                        return ""

                tel_norm = _norm_phone(tel_c)

                # Em rascunho/autosave, NÃO criar cliente automaticamente (evita "Cliente" fictício voltando).
                allow_create = (not is_draft)

                if USE_DB:
                    db2 = SessionLocal()
                    try:
                        match = None
                        if email_c:
                            match = db2.query(ClienteDB).filter(func.lower(ClienteDB.email) == email_c.lower()).first()
                        if (not match) and tel_norm and len(tel_norm) > 8:
                            # comparar telefone normalizado (apenas dígitos)
                            match = db2.query(ClienteDB).filter(
                                func.regexp_replace(func.coalesce(ClienteDB.telefone, ""), r"\D", "", "g") == tel_norm
                            ).first()
                        if (not match) and nome_c:
                            match = db2.query(ClienteDB).filter(func.lower(ClienteDB.nome) == nome_c.lower()).first()

                        if match:
                            proposta_data['cliente_id'] = match.id
                        elif allow_create and (nome_c or tel_norm or email_c):
                            # criar cliente novo para garantir vínculo por ID
                            new_cid = str(uuid.uuid4())
                            db2.add(ClienteDB(
                                id=new_cid,
                                nome=nome_c or 'Cliente',
                                telefone=tel_c or '',
                                email=email_c or '',
                                endereco_completo=proposta_data.get('cliente_endereco'),
                                cep=data.get('cep') or None,
                                tipo=data.get('tipo') or data.get('cliente_tipo') or None,
                                observacoes=data.get('observacoes') or None,
                                created_by=proposta_data.get('created_by') or '',
                                created_by_email=proposta_data.get('created_by_email') or None,
                            ))
                            db2.commit()
                            proposta_data['cliente_id'] = new_cid
                    finally:
                        db2.close()
                else:
                    # modo arquivo: criar/ligar no clientes.json
                    clientes_map = _load_clientes()
                    found = None
                    for _cid, c in (clientes_map or {}).items():
                        if not isinstance(c, dict):
                            continue
                        if email_c and (str(c.get('email') or '').strip().lower() == email_c.lower()):
                            found = c.get('id') or _cid
                            break
                        if tel_norm and len(tel_norm) > 8:
                            if _norm_phone(c.get('telefone')) == tel_norm:
                                found = c.get('id') or _cid
                                break
                        if nome_c and (str(c.get('nome') or '').strip().lower() == nome_c.lower()):
                            found = c.get('id') or _cid
                            break
                    if found:
                        proposta_data['cliente_id'] = found
                    elif allow_create and (nome_c or tel_norm or email_c):
                        new_cid = str(uuid.uuid4())
                        now_iso = datetime.now().isoformat()
                        clientes_map[new_cid] = {
                            "id": new_cid,
                            "nome": nome_c or "Cliente",
                            "telefone": tel_c or "",
                            "email": email_c or "",
                            "endereco_completo": proposta_data.get('cliente_endereco'),
                            "cep": data.get('cep') or "",
                            "tipo": data.get('tipo') or "",
                            "observacoes": data.get('observacoes') or "",
                            "created_by": proposta_data.get('created_by'),
                            "created_by_email": proposta_data.get('created_by_email'),
                            "created_at": now_iso,
                            "updated_at": now_iso,
                        }
                        _save_clientes(clientes_map)
                        proposta_data['cliente_id'] = new_cid

            # manter alias no payload
            proposta_data['cliente_id'] = str(proposta_data.get('cliente_id') or '').strip() or proposta_data.get('cliente_id')
        except Exception as _e:
            print(f"⚠️ [salvar-proposta] Falha ao garantir cliente_id: {_e}")
        # Garantir que a proposta use apenas o preço de venda
        try:
            _pv = float(proposta_data.get('preco_venda', 0) or 0)
            if _pv > 0:
                proposta_data['preco_final'] = _pv
        except Exception:
            pass

        # ====== FORMAS DE PAGAMENTO (pré-cálculo e persistência no payload) ======
        # Garantia: Slide 10 sempre renderiza parcelas e destaques mesmo em cenários
        # onde a geração do HTML/PDF esteja rodando com payload diferente ou taxas incompletas.
        try:
            valor_base_pagamento = proposta_data.get('preco_venda', proposta_data.get('preco_final', 0))
            pagamento_data = calcular_parcelas_pagamento(valor_base_pagamento)
            proposta_data['parcelas_cartao'] = pagamento_data.get('parcelas_cartao', '') or ''
            proposta_data['parcelas_financiamento'] = pagamento_data.get('parcelas_financiamento', '') or ''
            proposta_data['valor_avista_cartao'] = pagamento_data.get('valor_avista_cartao', 'R$ 0,00') or 'R$ 0,00'
            proposta_data['menor_parcela_financiamento'] = pagamento_data.get('menor_parcela_financiamento', 'R$ 0,00') or 'R$ 0,00'
        except Exception as e:
            print(f"⚠️ [salvar-proposta] Falha ao pré-calcular Slide 10 (formas de pagamento): {e}")
        
        # Fallback robusto: se KPIs vierem vazios, calcular pelo núcleo único
        try:
            needs_kpis = (
                float(proposta_data.get('anos_payback', 0) or 0) <= 0
                or float(proposta_data.get('conta_atual_anual', 0) or 0) <= 0
                or float(proposta_data.get('economia_mensal_estimada', 0) or 0) <= 0
            )
        except Exception:
            needs_kpis = True
        if needs_kpis:
            print("ℹ️ [salvar-proposta] KPIs ausentes -> calculando via núcleo (Lei 14.300).")
            core_payload = {
                "consumo_mensal_reais": data.get('consumo_mensal_reais', 0),
                "consumo_mensal_kwh": proposta_data.get('consumo_mensal_kwh', 0),
                "tarifa_energia": proposta_data.get('tarifa_energia', 0),
                "potencia_sistema": proposta_data.get('potencia_sistema', 0),
                "preco_venda": proposta_data.get('preco_venda', proposta_data.get('preco_final', 0)),
                "irradiacao_media": proposta_data.get('irradiacao_media', 5.15),
                "ano_instalacao": 2026,  # Lei 14.300
            }
            try:
                core = calcular_dimensionamento(core_payload)
                kpis = (core or {}).get("metrics") or {}
                if isinstance(kpis, dict) and kpis:
                    if float(proposta_data.get('economia_mensal_estimada', 0) or 0) <= 0:
                        proposta_data['economia_mensal_estimada'] = float(kpis.get('economia_mensal_estimada', 0) or 0)
                    if float(proposta_data.get('conta_atual_anual', 0) or 0) <= 0:
                        proposta_data['conta_atual_anual'] = float(kpis.get('conta_atual_anual', 0) or 0)
                    if float(proposta_data.get('anos_payback', 0) or 0) <= 0:
                        proposta_data['anos_payback'] = float(kpis.get('anos_payback', 0) or 0)
                        proposta_data['payback_anos'] = proposta_data['anos_payback']
                    if float(proposta_data.get('payback_meses', 0) or 0) <= 0:
                        proposta_data['payback_meses'] = int(kpis.get('payback_meses', 0) or 0)
                    if float(proposta_data.get('gasto_acumulado_payback', 0) or 0) <= 0:
                        proposta_data['gasto_acumulado_payback'] = float(kpis.get('gasto_acumulado_payback', 0) or 0)
                    # guardar métricas
                    proposta_data['metrics'] = kpis
            except Exception as _e:
                print(f"⚠️ [salvar-proposta] Falha ao calcular KPIs no núcleo: {_e}")
        
        # Persistência:
        # - Em Postgres (USE_DB): DB é fonte de verdade (não gravar em arquivo local).
        # - Em modo arquivo (dev legado): manter JSON em propostas/.
        if not USE_DB:
            proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
            with open(proposta_file, 'w', encoding='utf-8') as f:
                json.dump(proposta_data, f, ensure_ascii=False, indent=2)

        # Persistir no banco de dados (best-effort)
        try:
            db = SessionLocal()
            row = db.get(PropostaDB, proposta_id)
            if row:
                # Preservar owner original
                proposta_data['created_by'] = row.created_by or proposta_data.get('created_by')
                proposta_data['created_by_email'] = row.created_by_email or proposta_data.get('created_by_email')

                row.created_by = proposta_data.get('created_by')
                row.created_by_email = proposta_data.get('created_by_email')
                row.cliente_id = proposta_data.get('cliente_id')
                row.cliente_nome = proposta_data.get('cliente_nome')
                row.cliente_endereco = proposta_data.get('cliente_endereco')
                row.cliente_telefone = proposta_data.get('cliente_telefone')
                row.cidade = proposta_data.get('cidade')
                row.potencia_sistema = proposta_data.get('potencia_sistema') or 0
                row.preco_final = proposta_data.get('preco_final') or 0
                row.conta_atual_anual = proposta_data.get('conta_atual_anual') or 0
                row.anos_payback = proposta_data.get('anos_payback') or 0
                row.gasto_acumulado_payback = proposta_data.get('gasto_acumulado_payback') or 0
                row.consumo_mensal_kwh = float(proposta_data.get('consumo_mensal_kwh', 0) or 0)
                row.tarifa_energia = proposta_data.get('tarifa_energia') or 0
                row.economia_mensal_estimada = proposta_data.get('economia_mensal_estimada') or 0
                row.quantidade_placas = proposta_data.get('quantidade_placas') or 0
                row.potencia_placa_w = int(proposta_data.get('potencia_placa_w', 0) or 0)
                row.area_necessaria = proposta_data.get('area_necessaria') or 0
                row.irradiacao_media = proposta_data.get('irradiacao_media') or 5.15
                row.geracao_media_mensal = proposta_data.get('geracao_media_mensal') or 0
                row.creditos_anuais = proposta_data.get('creditos_anuais') or 0
                row.economia_total_25_anos = proposta_data.get('economia_total_25_anos') or 0
                row.payback_meses = proposta_data.get('payback_meses') or 0
                row.custo_total_projeto = proposta_data.get('custo_total_projeto') or 0
                row.custo_equipamentos = proposta_data.get('custo_equipamentos') or 0
                row.custo_instalacao = proposta_data.get('custo_instalacao') or 0
                row.custo_homologacao = proposta_data.get('custo_homologacao') or 0
                row.custo_outros = proposta_data.get('custo_outros') or 0
                row.margem_lucro = proposta_data.get('margem_lucro') or 0
                row.comissao_vendedor = proposta_data.get('comissao_vendedor') or 0
                row.payload = proposta_data
            else:
                row = PropostaDB(
                    id=proposta_id,
                    created_by=proposta_data.get('created_by'),
                    created_by_email=proposta_data.get('created_by_email'),
                    cliente_id=proposta_data.get('cliente_id'),
                    cliente_nome=proposta_data.get('cliente_nome'),
                    cliente_endereco=proposta_data.get('cliente_endereco'),
                    cliente_telefone=proposta_data.get('cliente_telefone'),
                    cidade=proposta_data.get('cidade'),
                    potencia_sistema=proposta_data.get('potencia_sistema') or 0,
                    preco_final=proposta_data.get('preco_final') or 0,
                    conta_atual_anual=proposta_data.get('conta_atual_anual') or 0,
                    anos_payback=proposta_data.get('anos_payback') or 0,
                    gasto_acumulado_payback=proposta_data.get('gasto_acumulado_payback') or 0,
                    consumo_mensal_kwh=float(proposta_data.get('consumo_mensal_kwh', 0) or 0),
                    tarifa_energia=proposta_data.get('tarifa_energia') or 0,
                    economia_mensal_estimada=proposta_data.get('economia_mensal_estimada') or 0,
                    quantidade_placas=proposta_data.get('quantidade_placas') or 0,
                    potencia_placa_w=int(proposta_data.get('potencia_placa_w', 0) or 0),
                    area_necessaria=proposta_data.get('area_necessaria') or 0,
                    irradiacao_media=proposta_data.get('irradiacao_media') or 5.15,
                    geracao_media_mensal=proposta_data.get('geracao_media_mensal') or 0,
                    creditos_anuais=proposta_data.get('creditos_anuais') or 0,
                    economia_total_25_anos=proposta_data.get('economia_total_25_anos') or 0,
                    payback_meses=proposta_data.get('payback_meses') or 0,
                    custo_total_projeto=proposta_data.get('custo_total_projeto') or 0,
                    custo_equipamentos=proposta_data.get('custo_equipamentos') or 0,
                    custo_instalacao=proposta_data.get('custo_instalacao') or 0,
                    custo_homologacao=proposta_data.get('custo_homologacao') or 0,
                    custo_outros=proposta_data.get('custo_outros') or 0,
                    margem_lucro=proposta_data.get('margem_lucro') or 0,
                    comissao_vendedor=proposta_data.get('comissao_vendedor') or 0,
                    payload=proposta_data,
                )
                db.add(row)
            db.commit()
            db.close()
            print(f"💾 Proposta {proposta_id} salva no banco de dados (upsert)")
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
        if USE_DB:
            db = SessionLocal()
            row = db.get(PropostaDB, proposta_id)
            db.close()
            if not row:
                return f"<html><body><h1>Proposta não encontrada</h1></body></html>", 404
            proposta_data = row.payload or {}
        else:
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


def _render_pdf_with_puppeteer(html: str, timeout_s: int = 60) -> bytes:
    """
    Renderiza o HTML em PDF usando Puppeteer (Chromium headless) via Node.
    Retorna bytes do PDF.
    """
    import time
    start = time.time()
    print(f"📄 [PDF] Iniciando renderização...")
    
    renderer = Path(__file__).parent / "pdf_renderer" / "render_pdf.js"
    if not renderer.exists():
        raise RuntimeError("pdf_renderer/render_pdf.js não encontrado.")

    env = os.environ.copy()
    env.setdefault("CHROMIUM_PATH", "/usr/bin/chromium")
    env.setdefault("PUPPETEER_EXECUTABLE_PATH", "/usr/bin/chromium")

    try:
        proc = subprocess.run(
            ["node", str(renderer)],
            input=html.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            timeout=timeout_s,
            check=False,
        )
    except subprocess.TimeoutExpired:
        print(f"❌ [PDF] Timeout após {timeout_s}s")
        raise RuntimeError("Timeout ao gerar PDF (Puppeteer).")

    elapsed = time.time() - start
    stderr_log = (proc.stderr or b"").decode("utf-8", errors="ignore")
    if stderr_log:
        print(f"📄 [PDF] Puppeteer log: {stderr_log[:500]}")
    
    if proc.returncode != 0 or not proc.stdout:
        print(f"❌ [PDF] Falha rc={proc.returncode}")
        raise RuntimeError(f"Falha ao gerar PDF (Puppeteer). rc={proc.returncode} err={stderr_log[:800]}")

    print(f"✅ [PDF] Renderizado em {elapsed:.1f}s ({len(proc.stdout)} bytes)")
    return proc.stdout


@app.route('/propostas/<proposta_id>/pdf', methods=['GET'])
def gerar_pdf_puppeteer(proposta_id):
    """
    PDF idêntico ao template.html, gerado no backend via Puppeteer.
    Requer auth/ACL quando USE_DB.
    """
    try:
        cleanup_old_charts()

        # Carregar dados da proposta + ACL
        if USE_DB:
            me = _current_user_row()
            if not me:
                return jsonify({"success": False, "message": "Não autenticado"}), 401

            db = SessionLocal()
            row = db.get(PropostaDB, proposta_id)
            db.close()
            if not row:
                return jsonify({"success": False, "message": "Proposta não encontrada"}), 404

            role = (me.role or "").strip().lower()
            if role not in ("admin", "gestor"):
                if not (
                    (row.created_by_email and row.created_by_email == me.email)
                    or (row.created_by and row.created_by == me.uid)
                ):
                    return jsonify({"success": False, "message": "Não autorizado"}), 403

            proposta_data = row.payload or {}
        else:
            proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
            if not proposta_file.exists():
                return jsonify({"success": False, "message": "Proposta não encontrada"}), 404
            with open(proposta_file, "r", encoding="utf-8") as f:
                proposta_data = json.load(f)

        html = process_template_html(proposta_data)
        pdf_bytes = _render_pdf_with_puppeteer(html, timeout_s=60)

        nome = (proposta_data or {}).get("cliente_nome") or "CLIENTE"
        safe_nome = re.sub(r"[\\/:*?\"<>|]+", " ", str(nome)).strip()
        safe_nome = re.sub(r"\s+", " ", safe_nome).strip()[:80] or "CLIENTE"
        # Obs: "/" não é permitido em nome de arquivo -> usamos DD-MM-YY
        dt = datetime.now().strftime("%d-%m-%y")
        filename = f"{safe_nome} - {dt} - FOHAT ENERGIA SOLAR.pdf"

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
            max_age=0,
        )
    except Exception as e:
        print(f"❌ Erro ao gerar PDF (Puppeteer): {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/gerar-pdf/<proposta_id>', methods=['GET'])
def gerar_pdf(proposta_id):
    """
    Endpoint para gerar PDF da proposta.
    TEMPORÁRIO: Retorna HTML até que as dependências do WeasyPrint sejam instaladas.
    """
    try:
        print(f"⚠️ AVISO: Retornando HTML temporariamente (WeasyPrint não disponível)")
        
        # Carregar dados da proposta
        if USE_DB:
            db = SessionLocal()
            row = db.get(PropostaDB, proposta_id)
            db.close()
            if not row:
                return jsonify({'success': False, 'message': 'Proposta não encontrada'}), 404
            proposta_data = row.payload or {}
        else:
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
        
        # Registrar visualização para métricas
        metrics = _registrar_visualizacao(proposta_id, request)
        print(f"📊 [visualizar_proposta] Views: {metrics['total_views']} total, {metrics['unique_views']} únicos")
        
        # Carregar dados da proposta
        if USE_DB:
            db = SessionLocal()
            row = db.get(PropostaDB, proposta_id)
            db.close()
            if not row:
                return jsonify({'success': False, 'message': 'Proposta não encontrada'}), 404
            proposta_data = row.payload or {}
        else:
            proposta_file = PROPOSTAS_DIR / f"{proposta_id}.json"
            if not proposta_file.exists():
                return jsonify({'success': False, 'message': 'Proposta não encontrada'}), 404
            with open(proposta_file, 'r', encoding='utf-8') as f:
                proposta_data = json.load(f)
        
        # Visualização/Preview sempre vem do process_template_html (ECharts + SVG).
        try:
            processed = process_template_html(proposta_data)
            return processed, 200, {'Content-Type': 'text/html; charset=utf-8'}
        except Exception as e:
            print(f"❌ Falha no process_template_html em visualizar_proposta: {e}")
            return f"<html><body><h1>Erro ao carregar proposta</h1><pre>{str(e)}</pre></body></html>", 500
        
    except Exception as e:
        return f"<html><body><h1>Erro ao carregar proposta: {str(e)}</h1></body></html>", 500

# Endpoint antigo removido - agora usamos apenas os endpoints HTML

# -----------------------------------------------------------------------------
# Métricas de Visualização
# -----------------------------------------------------------------------------
@app.route('/proposta/<proposta_id>/views', methods=['GET'])
def get_proposta_views(proposta_id):
    """Retorna métricas de visualização de uma proposta específica."""
    try:
        views = _load_views()
        if proposta_id not in views:
            return jsonify({
                "proposta_id": proposta_id,
                "total_views": 0,
                "unique_views": 0,
                "first_view": None,
                "last_view": None
            })
        
        v = views[proposta_id]
        return jsonify({
            "proposta_id": proposta_id,
            "total_views": v.get("total_views", 0),
            "unique_views": len(v.get("unique_ips", [])),
            "first_view": v.get("first_view"),
            "last_view": v.get("last_view"),
            "views_history": v.get("views_history", [])[-10:]  # Últimas 10 visualizações
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/propostas/views', methods=['GET'])
def get_all_views():
    """Retorna métricas de visualização de todas as propostas."""
    try:
        views = _load_views()
        result = []
        for proposta_id, v in views.items():
            result.append({
                "proposta_id": proposta_id,
                "total_views": v.get("total_views", 0),
                "unique_views": len(v.get("unique_ips", [])),
                "first_view": v.get("first_view"),
                "last_view": v.get("last_view")
            })
        # Ordenar por total de views (mais vistos primeiro)
        result.sort(key=lambda x: x["total_views"], reverse=True)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Servidor Python funcionando'})


@app.route('/db/health', methods=['GET'])
def db_health():
    try:
        db = SessionLocal()
        db.execute(text('SELECT 1'))
        db.close()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/db/importar-locais', methods=['POST'])
def importar_locais():
    """Importa dados locais (data/*.json, propostas/*.json) para o DB."""
    try:
        # Proteção: em produção, exigir segredo de admin para evitar que qualquer pessoa importe dados.
        if not _require_role_admin_secret():
            return jsonify({'success': False, 'error': 'Não autorizado'}), 403

        db = SessionLocal()
        import_count = 0

        # -----------------------------
        # Roles (data/users_roles.json)
        # -----------------------------
        try:
            if ROLES_FILE.exists():
                with open(ROLES_FILE, "r", encoding="utf-8") as f:
                    roles = json.load(f) or {}
                if isinstance(roles, dict):
                    for email, raw in roles.items():
                        email_l = (email or "").strip().lower()
                        if not email_l:
                            continue
                        role = None
                        nome = None
                        cargo = None
                        if isinstance(raw, dict):
                            role = (raw.get("role") or "").strip().lower() or "vendedor"
                            nome = (raw.get("nome") or "").strip() or None
                            cargo = (raw.get("cargo") or "").strip() or None
                        else:
                            role = (str(raw).strip().lower() or "vendedor")
                        try:
                            existing = db.get(RoleDB, email_l)
                            if existing:
                                existing.role = role
                                existing.nome = nome
                                existing.cargo = cargo
                            else:
                                db.add(RoleDB(email=email_l, role=role, nome=nome, cargo=cargo))
                            import_count += 1
                        except Exception as e:
                            print(f"⚠️ Falha ao importar role {email_l}: {e}")
        except Exception as e:
            print(f"⚠️ Falha ao importar roles do arquivo: {e}")

        # -----------------------------
        # Usuários (data/users.json)
        # -----------------------------
        try:
            users_file = DATA_DIR / "users.json"
            if users_file.exists():
                with open(users_file, "r", encoding="utf-8") as f:
                    users = json.load(f) or {}
                if isinstance(users, dict):
                    for uid, u in users.items():
                        if not isinstance(u, dict):
                            continue
                        uid_v = (u.get("uid") or uid or "").strip()
                        if not uid_v:
                            continue
                        email = (u.get("email") or "").strip().lower()
                        nome = (u.get("nome") or "").strip() or (email.split("@")[0] if email else "")
                        role = (u.get("role") or "").strip().lower() or "vendedor"
                        # compat: "comum" -> "vendedor"
                        if role == "comum":
                            role = "vendedor"
                        try:
                            existing = db.get(UserDB, uid_v)
                            if existing:
                                existing.email = email
                                existing.nome = nome
                                existing.role = role
                            else:
                                db.add(UserDB(uid=uid_v, email=email, nome=nome, role=role))
                            import_count += 1
                        except Exception as e:
                            print(f"⚠️ Falha ao importar user {uid_v}: {e}")
        except Exception as e:
            print(f"⚠️ Falha ao importar users do arquivo: {e}")

        # -----------------------------
        # Configuração (data/configuracao.json)
        # -----------------------------
        try:
            cfg_file = DATA_DIR / "configuracao.json"
            if cfg_file.exists():
                with open(cfg_file, "r", encoding="utf-8") as f:
                    cfg = json.load(f) or {}
                cfg_id = "default"
                existing = db.get(ConfigDB, cfg_id)
                if existing:
                    existing.data = cfg
                else:
                    db.add(ConfigDB(id=cfg_id, data=cfg))
                import_count += 1
        except Exception as e:
            print(f"⚠️ Falha ao importar configuracao.json: {e}")

        # -----------------------------
        # Clientes (data/clientes.json)
        # -----------------------------
        try:
            clientes_file = DATA_DIR / "clientes.json"
            if clientes_file.exists():
                with open(clientes_file, "r", encoding="utf-8") as f:
                    clientes = json.load(f) or {}
                if isinstance(clientes, dict):
                    for cid, c in clientes.items():
                        if not isinstance(c, dict):
                            continue
                        cid_v = (c.get("id") or cid or "").strip()
                        if not cid_v:
                            continue
                        try:
                            existing = db.get(ClienteDB, cid_v)
                            if existing:
                                existing.nome = c.get("nome")
                                existing.telefone = c.get("telefone")
                                existing.email = c.get("email")
                                existing.created_by = c.get("created_by")
                                existing.created_by_email = c.get("created_by_email")
                                existing.endereco_completo = c.get("endereco_completo")
                                existing.cep = c.get("cep")
                                existing.tipo = c.get("tipo")
                                existing.observacoes = c.get("observacoes")
                            else:
                                db.add(ClienteDB(
                                    id=cid_v,
                                    nome=c.get("nome"),
                                    telefone=c.get("telefone"),
                                    email=c.get("email"),
                                    created_by=c.get("created_by"),
                                    created_by_email=c.get("created_by_email"),
                                    endereco_completo=c.get("endereco_completo"),
                                    cep=c.get("cep"),
                                    tipo=c.get("tipo"),
                                    observacoes=c.get("observacoes"),
                                ))
                            import_count += 1
                        except Exception as e:
                            print(f"⚠️ Falha ao importar cliente {cid_v}: {e}")
        except Exception as e:
            print(f"⚠️ Falha ao importar clientes.json: {e}")

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
                    created_by=data.get('created_by'),
                    created_by_email=data.get('created_by_email'),
                    cliente_id=data.get('cliente_id'),
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

        # Importar propostas do arquivo data/propostas.json (legado)
        try:
            propostas_file = DATA_DIR / "propostas.json"
            if propostas_file.exists():
                with open(propostas_file, "r", encoding="utf-8") as f:
                    propostas = json.load(f) or {}
                if isinstance(propostas, dict):
                    for pid, pdata in propostas.items():
                        if not isinstance(pdata, dict):
                            continue
                        prop_id = (pdata.get("id") or pid or "").strip()
                        if not prop_id:
                            continue
                        exists = db.get(PropostaDB, prop_id)
                        if exists:
                            continue
                        try:
                            row = PropostaDB(
                                id=prop_id,
                                created_by=pdata.get('created_by'),
                                created_by_email=pdata.get('created_by_email'),
                                cliente_id=pdata.get('cliente_id'),
                                cliente_nome=pdata.get('cliente_nome'),
                                cliente_endereco=pdata.get('cliente_endereco'),
                                cliente_telefone=pdata.get('cliente_telefone'),
                                cidade=pdata.get('cidade'),
                                potencia_sistema=pdata.get('potencia_sistema'),
                                preco_final=pdata.get('preco_final') or pdata.get('preco_venda'),
                                conta_atual_anual=pdata.get('conta_atual_anual'),
                                anos_payback=pdata.get('anos_payback'),
                                gasto_acumulado_payback=pdata.get('gasto_acumulado_payback'),
                                consumo_mensal_kwh=float(pdata.get('consumo_mensal_kwh', 0) or 0),
                                tarifa_energia=pdata.get('tarifa_energia'),
                                economia_mensal_estimada=pdata.get('economia_mensal_estimada'),
                                quantidade_placas=pdata.get('quantidade_placas'),
                                potencia_placa_w=int(pdata.get('potencia_placa_w', 0) or 0),
                                area_necessaria=pdata.get('area_necessaria'),
                                irradiacao_media=pdata.get('irradiacao_media'),
                                geracao_media_mensal=pdata.get('geracao_media_mensal'),
                                creditos_anuais=pdata.get('creditos_anuais'),
                                economia_total_25_anos=pdata.get('economia_total_25_anos'),
                                payback_meses=pdata.get('payback_meses'),
                                custo_total_projeto=pdata.get('custo_total_projeto') or pdata.get('custo_total'),
                                custo_equipamentos=pdata.get('custo_equipamentos'),
                                custo_instalacao=pdata.get('custo_instalacao'),
                                custo_homologacao=pdata.get('custo_homologacao'),
                                custo_outros=pdata.get('custo_outros'),
                                margem_lucro=pdata.get('margem_lucro') or pdata.get('margem_desejada'),
                                payload=pdata,
                            )
                            db.add(row)
                            import_count += 1
                        except Exception as e:
                            print(f"⚠️ Falha ao importar proposta do arquivo data/propostas.json ({prop_id}): {e}")
        except Exception as e:
            print(f"⚠️ Falha ao importar data/propostas.json: {e}")

        db.commit()
        db.close()
        return jsonify({'success': True, 'imported': import_count})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/db/wipe-clientes-projetos', methods=['POST'])
def db_wipe_clientes_projetos():
    """
    APAGA TUDO de clientes e projetos/propostas no banco (Postgres).
    Proteções:
      - exige ROLE_ADMIN_SECRET (header X-Admin-Secret) se configurado
      - exige ALLOW_DB_WIPE=1 para evitar acidentes em produção
    """
    try:
        if not _require_role_admin_secret():
            return jsonify({'success': False, 'error': 'Não autorizado'}), 403
        allow = (os.environ.get("ALLOW_DB_WIPE") or "").strip() in ("1", "true", "True")
        if not allow:
            return jsonify({'success': False, 'error': 'Wipe desabilitado (ALLOW_DB_WIPE != 1)'}), 403
        if not USE_DB:
            return jsonify({'success': False, 'error': 'USE_DB=false (não é Postgres).'}), 400

        db = SessionLocal()
        # TRUNCATE é mais rápido e limpa FKs (enderecos dependem de clientes).
        # RESTART IDENTITY mantém consistência caso existam IDs incrementais (enderecos).
        db.execute(text("TRUNCATE TABLE enderecos RESTART IDENTITY CASCADE;"))
        db.execute(text("TRUNCATE TABLE clientes RESTART IDENTITY CASCADE;"))
        db.execute(text("TRUNCATE TABLE propostas RESTART IDENTITY CASCADE;"))
        db.commit()
        db.close()
        return jsonify({'success': True})
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

# -----------------------------------------------------------------------------
# Proxy Solaryum (produção) — replica o proxy do Vite (/api/solaryum)
# -----------------------------------------------------------------------------
SOLARYUM_BASE = "https://api-d1297.cloud.solaryum.com.br"

@app.route('/api/solaryum/<path:subpath>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
def proxy_solaryum(subpath):
    """
    Proxy server-to-server para a API Solaryum.
    Motivo: em produção, chamadas diretas do browser podem retornar 400/CORS dependendo do Origin.
    Este proxy aplica os mesmos headers que usamos no dev via vite.config.js.
    """
    try:
        qs = request.query_string.decode('utf-8') if request.query_string else ''
        target = urljoin(SOLARYUM_BASE + "/", subpath)
        if qs:
            target = f"{target}?{qs}"

        # Preflight
        if request.method == 'OPTIONS':
            return ('', 204)

        body = None
        if request.method in ('POST', 'PUT', 'PATCH'):
            body = request.get_data() or None

        headers = {
            'Accept': request.headers.get('Accept', 'text/plain'),
            'Content-Type': request.headers.get('Content-Type', 'application/json'),
            'Origin': SOLARYUM_BASE,
            'Referer': f"{SOLARYUM_BASE}/swagger/index.html",
            'User-Agent': request.headers.get('User-Agent', 'Mozilla/5.0'),
        }

        client_ip = request.headers.get('X-Forwarded-For') or request.remote_addr or ''
        if client_ip:
            headers['X-Forwarded-For'] = client_ip
            headers['X-Real-IP'] = client_ip
            headers['X-Client-IP'] = client_ip
            headers['Client-IP'] = client_ip

        req = urllib.request.Request(
            target,
            data=body,
            headers=headers,
            method=request.method
        )

        with urllib.request.urlopen(req, timeout=20) as resp:
            resp_body = resp.read()
            ct = resp.headers.get('Content-Type', 'application/json')
            return (resp_body, resp.status, {'Content-Type': ct})

    except urllib.error.HTTPError as e:
        try:
            err_body = e.read()
        except Exception:
            err_body = str(e).encode('utf-8')
        ct = getattr(e, 'headers', {}).get('Content-Type', 'text/plain') if getattr(e, 'headers', None) else 'text/plain'
        return (err_body, e.code, {'Content-Type': ct})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

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

"""
Gestão de usuários é via Postgres:
- /admin/users (CRUD)
- /auth/login, /auth/me, /auth/change-password
"""

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

# ===== Roles (controle de acesso pelo backend) =====
@app.route('/auth/role', methods=['GET'])
def get_user_role():
    """
    Retorna a role, cargo e nome do usuário a partir do e-mail.
    Ex.: /auth/role?email=john@doe.com -> { role: "admin", cargo: "Diretor", nome: "João" }
    Padrão: "vendedor" quando não configurado.
    """
    try:
        email = (request.args.get('email') or '').strip().lower()
        # Override seguro por env (ideal em produção): ADMIN_EMAILS
        admin_emails = _parse_env_emails("ADMIN_EMAILS")
        if email and email in admin_emails:
            # Preferir DB quando disponível
            if USE_DB:
                try:
                    db = SessionLocal()
                    existing = db.get(RoleDB, email)
                    if existing:
                        existing.role = "admin"
                        existing.cargo = existing.cargo or "Administrador"
                    else:
                        db.add(RoleDB(email=email, role="admin", cargo="Administrador"))
                    db.commit()
                    # recarregar para retornar nome/cargo
                    r = db.get(RoleDB, email)
                    db.close()
                    return jsonify({'role': 'admin', 'nome': getattr(r, "nome", None), 'cargo': getattr(r, "cargo", "Administrador")})
                except Exception as _db_err:
                    print(f"⚠️ Falha ao upsert admin no DB: {_db_err}")
                    try:
                        db.close()
                    except Exception:
                        pass
            # Fallback arquivo local (DEV)
            mapping = _load_roles()
            mapping[email] = mapping.get(email) if isinstance(mapping.get(email), dict) else {}
            if not isinstance(mapping[email], dict):
                mapping[email] = {}
            mapping[email]["role"] = "admin"
            mapping[email].setdefault("cargo", "Administrador")
            _save_roles(mapping)
            raw = mapping[email]
            return jsonify({'role': 'admin', 'nome': raw.get('nome'), 'cargo': raw.get('cargo')})

        # Preferir DB (Postgres) em produção
        if USE_DB and email:
            try:
                db = SessionLocal()
                r = db.get(RoleDB, email)
                db.close()
                if r:
                    return jsonify({'role': r.role or 'vendedor', 'nome': r.nome, 'cargo': r.cargo})
            except Exception as _db_err:
                print(f"⚠️ Falha ao ler role do DB: {_db_err}")

        mapping = _load_roles()
        # Bootstrap local (DEV): se não há nenhum admin configurado, o primeiro e-mail consultado vira admin.
        # Em produção, isso pode ser perigoso; desative com DISABLE_ROLE_BOOTSTRAP=1.
        disable_bootstrap = (os.environ.get("DISABLE_ROLE_BOOTSTRAP") or "").strip() in ("1", "true", "True")
        has_any_admin = any((v.get('role') if isinstance(v, dict) else v) == 'admin' for v in mapping.values())
        if email and (not has_any_admin) and (not disable_bootstrap) and (not _is_prod()):
            mapping[email] = {'role': 'admin', 'cargo': 'Administrador'}
            _save_roles(mapping)
            print(f"🔐 Bootstrap de roles: '{email}' definido como admin.")
        raw = mapping.get(email, 'vendedor')
        role = raw.get('role') if isinstance(raw, dict) else raw
        nome = raw.get('nome') if isinstance(raw, dict) else None
        cargo = raw.get('cargo') if isinstance(raw, dict) else None
        return jsonify({'role': role or 'vendedor', 'nome': nome, 'cargo': cargo})
    except Exception as e:
        return jsonify({'role': 'vendedor', 'message': str(e)}), 200

@app.route('/auth/roles', methods=['GET'])
def list_roles():
    """
    Retorna o mapeamento completo de roles (e-mail -> role, nome, cargo).
    """
    try:
        if not _require_admin_access():
            return jsonify({'success': False, 'message': 'Não autorizado'}), 403
        if USE_DB:
            db = SessionLocal()
            rows = db.query(RoleDB).all()
            db.close()
            items = [{'email': r.email, 'role': r.role, 'nome': r.nome, 'cargo': r.cargo} for r in rows]
            # Garantir que ADMIN_EMAILS apareça na lista, mesmo que não exista registro ainda
            admin_emails = _parse_env_emails("ADMIN_EMAILS")
            existing_emails = {it.get("email", "").lower() for it in items}
            for em in admin_emails:
                if em and em not in existing_emails:
                    items.append({'email': em, 'role': 'admin', 'nome': None, 'cargo': 'Administrador'})
            return jsonify({'success': True, 'items': items, 'source': 'db'})

        mapping = _load_roles()
        items = []
        for k, v in mapping.items():
            if isinstance(v, dict):
                items.append({'email': k, 'role': v.get('role'), 'nome': v.get('nome'), 'cargo': v.get('cargo')})
            else:
                items.append({'email': k, 'role': v})
        return jsonify({'success': True, 'items': items, 'source': 'file'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/auth/roles', methods=['POST'])
def upsert_role():
    """
    Define/atualiza a role de um e-mail.
    Body: { email: string, role: string, nome?: string, cargo?: string }
    """
    try:
        if not _require_admin_access():
            return jsonify({'success': False, 'message': 'Não autorizado'}), 403
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        role = (data.get('role') or '').strip().lower()
        nome = (data.get('nome') or '').strip() or None
        cargo = (data.get('cargo') or '').strip() or None
        if not email or role not in ('admin', 'gestor', 'vendedor', 'instalador'):
            return jsonify({'success': False, 'message': 'Parâmetros inválidos'}), 400
        if USE_DB:
            db = SessionLocal()
            existing = db.get(RoleDB, email)
            if existing:
                existing.role = role
                existing.nome = nome
                existing.cargo = cargo
            else:
                db.add(RoleDB(email=email, role=role, nome=nome, cargo=cargo))
            db.commit()
            db.close()
            return jsonify({'success': True, 'source': 'db'})

        mapping = _load_roles()
        current = mapping.get(email)
        if isinstance(current, dict):
            current['role'] = role
            if nome is not None:
                current['nome'] = nome
            if cargo is not None:
                current['cargo'] = cargo
            mapping[email] = current
        else:
            obj = {'role': role}
            if nome is not None:
                obj['nome'] = nome
            if cargo is not None:
                obj['cargo'] = cargo
            mapping[email] = obj
        _save_roles(mapping)
        return jsonify({'success': True, 'source': 'file'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/auth/roles', methods=['DELETE'])
def delete_role():
    """
    Remove o mapeamento de role (o acesso continua existindo no Firebase; aqui só tiramos a permissão customizada).
    Body: { email: string }
    """
    try:
        if not _require_admin_access():
            return jsonify({'success': False, 'message': 'Não autorizado'}), 403
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        if not email:
            return jsonify({'success': False, 'message': 'Email obrigatório'}), 400
        if USE_DB:
            db = SessionLocal()
            row = db.get(RoleDB, email)
            if row:
                db.delete(row)
                db.commit()
            db.close()
            return jsonify({'success': True, 'source': 'db'})

        mapping = _load_roles()
        if email in mapping:
            del mapping[email]
            _save_roles(mapping)
        return jsonify({'success': True, 'source': 'file'})
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

        # DB (persistente) — atualiza status dentro do payload
        if USE_DB:
            try:
                db = SessionLocal()
                row = db.get(PropostaDB, prop_id)
                if row:
                    payload = row.payload or {}
                    payload['status'] = new_status
                    row.payload = payload
                    db.commit()
                db.close()
            except Exception as _e:
                print(f"⚠️ Falha ao atualizar status no DB: {_e}")

        prop_file = PROPOSTAS_DIR / f"{prop_id}.json"
        if not prop_file.exists():
            # Se não existe no filesystem, mas existe no DB, ainda consideramos sucesso.
            if USE_DB:
                return jsonify({'success': True, 'source': 'db'})
            return jsonify({'success': False, 'message': 'Proposta não encontrada'}), 404
        with open(prop_file, 'r', encoding='utf-8') as f:
            content = json.load(f)
        content['status'] = new_status
        with open(prop_file, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        return jsonify({'success': True, 'source': 'file'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# -----------------------------------------------------------------------------
# Clientes (CRUD via JSON local)
# -----------------------------------------------------------------------------
CLIENTES_FILE = DATA_DIR / "clientes.json"

def _load_clientes() -> dict:
    try:
        if CLIENTES_FILE.exists():
            with open(CLIENTES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"⚠️ Falha ao carregar clientes: {e}")
    return {}

def _save_clientes(data: dict) -> None:
    try:
        with open(CLIENTES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Falha ao salvar clientes: {e}")

@app.route('/clientes/list', methods=['GET'])
def listar_clientes():
    """Lista todos os clientes."""
    try:
        # Auth obrigatório (DB)
        if USE_DB:
            me = _current_user_row()
            if not me:
                return jsonify({"success": False, "message": "Não autenticado"}), 401
        if USE_DB:
            db = SessionLocal()
            q = db.query(ClienteDB)
            role = (me.role or "").strip().lower() if me else ""
            if role not in ("admin", "gestor"):
                # Vendedor/instalador: só seus clientes
                q = q.filter(
                    (ClienteDB.created_by_email == me.email) |
                    (ClienteDB.created_by == me.uid)
                )
            rows = q.order_by(ClienteDB.created_at.desc()).all()
            db.close()
            clientes = []
            for r in rows:
                clientes.append({
                    "id": r.id,
