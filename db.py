import os
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, DateTime, JSON, Text,
    ForeignKey, Boolean
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

load_dotenv()
# Também suportar um arquivo local não-dot (gitignored) para dev sem export manual.
try:
    dev_env = Path(__file__).parent / "dev.env"
    if dev_env.exists():
        load_dotenv(dotenv_path=dev_env, override=False)
except Exception:
    pass
# Railway pode expor diferentes nomes de variável para Postgres.
DATABASE_URL = (
    os.getenv('DATABASE_URL')
    or os.getenv('POSTGRES_URL')
    or os.getenv('POSTGRESQL_URL')
    or os.getenv('RAILWAY_DATABASE_URL')
)

# Modo DB-only (padrão): sem URL definida, falhar explicitamente.
# Se você realmente quiser SQLite local, defina ALLOW_SQLITE=1.
if not DATABASE_URL:
    if os.getenv("ALLOW_SQLITE") in ("1", "true", "True"):
        DATABASE_URL = 'sqlite:///./app.db'
    else:
        raise RuntimeError(
            "DATABASE_URL não definido. Este projeto opera apenas com Postgres (Railway). "
            "Defina DATABASE_URL/POSTGRESQL_URL no ambiente ou use ALLOW_SQLITE=1 (dev local apenas)."
        )

def _build_connect_args(url: str) -> dict:
    # SQLite needs check_same_thread flag
    if url.startswith('sqlite'):
        return {"check_same_thread": False}

    # Postgres (incl. Supabase) with SSL
    if url.startswith('postgresql'):
        # Allow overriding via env
        # Supabase exige CA + verify-full; Railway normalmente funciona com 'require' (ou até sem SSL).
        is_supabase = ('supabase.co' in url) or ('pooler.supabase.com' in url)
        default_sslmode = 'verify-full' if is_supabase else 'require'
        sslmode = os.getenv('PGSSLMODE', default_sslmode)

        args = {"sslmode": sslmode}

        # Prefer explicit env var path; fallback to ./certs/prod-ca-2021.crt (apenas se existir)
        default_ca = Path(__file__).parent / 'certs' / 'prod-ca-2021.crt'
        ca_path = os.getenv('PGSSLROOTCERT') or os.getenv('SUPABASE_CA_CERT') or str(default_ca)
        if is_supabase and Path(ca_path).exists():
            args["sslrootcert"] = ca_path
        # Para Railway/hosts não-Supabase, não forçamos CA (evita falhas).
        if (not is_supabase) and os.getenv('PGSSLROOTCERT') and Path(os.getenv('PGSSLROOTCERT')).exists():
            args["sslrootcert"] = os.getenv('PGSSLROOTCERT')
        return args

    return {}


engine = create_engine(
    DATABASE_URL,
    connect_args=_build_connect_args(DATABASE_URL),
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()


class PropostaDB(Base):
    __tablename__ = 'propostas'

    id = Column(String, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Rastreamento do criador (para filtros por usuário)
    created_by = Column(String(128), nullable=True, index=True)
    created_by_email = Column(String(255), nullable=True)

    # Campos principais
    cliente_id = Column(String(64), nullable=True)
    cliente_nome = Column(String(255))
    cliente_endereco = Column(Text)
    cliente_telefone = Column(String(64))
    cidade = Column(String(128))

    potencia_sistema = Column(Float)
    preco_final = Column(Float)

    conta_atual_anual = Column(Float)
    anos_payback = Column(Float)
    gasto_acumulado_payback = Column(Float)
    consumo_mensal_kwh = Column(Float)
    tarifa_energia = Column(Float)
    economia_mensal_estimada = Column(Float)

    quantidade_placas = Column(Integer)
    potencia_placa_w = Column(Integer)
    area_necessaria = Column(Float)
    irradiacao_media = Column(Float)
    geracao_media_mensal = Column(Float)
    creditos_anuais = Column(Float)
    economia_total_25_anos = Column(Float)
    payback_meses = Column(Integer)

    custo_total_projeto = Column(Float)
    custo_equipamentos = Column(Float)
    custo_instalacao = Column(Float)
    custo_homologacao = Column(Float)
    custo_outros = Column(Float)
    margem_lucro = Column(Float)

    comissao_vendedor = Column(Float)

    # Armazena payload bruto para referência/auditoria
    payload = Column(JSON)


class UserDB(Base):
    __tablename__ = 'users'

    uid = Column(String(128), primary_key=True)
    email = Column(String(255), index=True)
    nome = Column(String(255))
    role = Column(String(32))
    cargo = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RoleDB(Base):
    """
    Mapeamento de roles por e-mail (fonte de verdade do acesso no backend).
    """
    __tablename__ = 'roles'

    email = Column(String(255), primary_key=True)
    role = Column(String(32), nullable=False, default='vendedor')
    nome = Column(String(255), nullable=True)
    cargo = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClienteDB(Base):
    __tablename__ = 'clientes'

    id = Column(String(64), primary_key=True)
    nome = Column(String(255), index=True)
    telefone = Column(String(64))
    email = Column(String(255))
    created_by = Column(String(128))
    created_by_email = Column(String(255), nullable=True)
    endereco_completo = Column(Text, nullable=True)
    cep = Column(String(32), nullable=True)
    tipo = Column(String(64), nullable=True)
    observacoes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    enderecos = relationship('EnderecoDB', back_populates='cliente', cascade='all, delete-orphan')


class EnderecoDB(Base):
    __tablename__ = 'enderecos'

    id = Column(Integer, primary_key=True, autoincrement=True)
    cliente_id = Column(String(64), ForeignKey('clientes.id', ondelete='CASCADE'))
    logradouro = Column(String(255))
    numero = Column(String(64))
    complemento = Column(String(255))
    bairro = Column(String(255))
    cidade = Column(String(128))
    estado = Column(String(32))
    cep = Column(String(32))
    principal = Column(Boolean, default=True)

    cliente = relationship('ClienteDB', back_populates='enderecos')


class ConfigDB(Base):
    __tablename__ = 'configuracoes'

    id = Column(String(64), primary_key=True)
    data = Column(JSON)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


