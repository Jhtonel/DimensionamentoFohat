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
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./app.db')

def _build_connect_args(url: str) -> dict:
    # SQLite needs check_same_thread flag
    if url.startswith('sqlite'):
        return {"check_same_thread": False}

    # Postgres (incl. Supabase) with SSL
    if url.startswith('postgresql'):
        # Allow overriding via env
        sslmode = os.getenv('PGSSLMODE', 'verify-full')
        # Prefer explicit env var path; fallback to ./certs/prod-ca-2021.crt
        default_ca = Path(__file__).parent / 'certs' / 'prod-ca-2021.crt'
        ca_path = os.getenv('PGSSLROOTCERT') or os.getenv('SUPABASE_CA_CERT') or str(default_ca)
        args = {"sslmode": sslmode}
        if Path(ca_path).exists():
            args["sslrootcert"] = ca_path
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClienteDB(Base):
    __tablename__ = 'clientes'

    id = Column(String(64), primary_key=True)
    nome = Column(String(255), index=True)
    telefone = Column(String(64))
    email = Column(String(255))
    created_by = Column(String(128))
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


