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

    # Postgres com SSL
    if url.startswith('postgresql'):
        # Allow overriding via env
        sslmode = os.getenv('PGSSLMODE', 'require')

        args = {
            "sslmode": sslmode,
            "connect_timeout": 10,  # Timeout de conexão em segundos
        }

        # CA opcional (se fornecida via env)
        ca_env = os.getenv('PGSSLROOTCERT')
        if ca_env and Path(ca_env).exists():
            args["sslrootcert"] = ca_env
        return args

    return {}


engine = create_engine(
    DATABASE_URL,
    connect_args=_build_connect_args(DATABASE_URL),
    future=True,
    pool_pre_ping=True,  # Verificar conexão antes de usar
    pool_timeout=30,     # Timeout para obter conexão do pool
    pool_recycle=1800,   # Reciclar conexões a cada 30 min
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()


class PropostaDB(Base):
    __tablename__ = 'propostas'

    id = Column(String, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Rastreamento do criador (para filtros por usuário)
    created_by = Column(String(128), nullable=True, index=True)
    created_by_email = Column(String(255), nullable=True)

    # ====== Dados do Projeto ======
    nome_projeto = Column(String(255), nullable=True)
    status = Column(String(64), nullable=True, default='dimensionamento', index=True)
    
    # ====== Dados do Cliente ======
    cliente_id = Column(String(64), nullable=True, index=True)
    cliente_nome = Column(String(255))
    cliente_endereco = Column(Text)
    cliente_telefone = Column(String(64))
    
    # ====== Localização ======
    cidade = Column(String(128))
    estado = Column(String(32), nullable=True)
    cep = Column(String(32), nullable=True)
    logradouro = Column(String(255), nullable=True)
    numero = Column(String(64), nullable=True)
    bairro = Column(String(255), nullable=True)
    complemento = Column(String(255), nullable=True)
    
    # ====== Concessionária ======
    concessionaria = Column(String(255), nullable=True, index=True)

    # ====== Sistema Solar ======
    potencia_sistema = Column(Float)
    potencia_kw = Column(Float, nullable=True)  # Potência calculada
    tipo_telhado = Column(String(64), nullable=True)
    tensao = Column(String(32), nullable=True)
    
    # ====== Preços ======
    preco_final = Column(Float)
    preco_venda = Column(Float, nullable=True)
    
    # ====== Consumo ======
    consumo_mensal_kwh = Column(Float)
    consumo_mensal_reais = Column(Float, nullable=True)
    tarifa_energia = Column(Float)
    
    # ====== Margem/Produção Adicional ======
    margem_adicional_percentual = Column(Float, nullable=True)
    margem_adicional_kwh = Column(Float, nullable=True)
    margem_adicional_reais = Column(Float, nullable=True)

    # ====== Métricas Financeiras ======
    conta_atual_anual = Column(Float)
    anos_payback = Column(Float)
    gasto_acumulado_payback = Column(Float)
    economia_mensal_estimada = Column(Float)
    economia_total_25_anos = Column(Float)
    payback_meses = Column(Integer)

    # ====== Equipamentos ======
    quantidade_placas = Column(Integer)
    potencia_placa_w = Column(Integer)
    area_necessaria = Column(Float)
    irradiacao_media = Column(Float)
    geracao_media_mensal = Column(Float)
    creditos_anuais = Column(Float)
    
    # ====== Equipamentos - Detalhes ======
    modulo_marca = Column(String(255), nullable=True)
    modulo_modelo = Column(String(255), nullable=True)
    inversor_marca = Column(String(255), nullable=True)
    inversor_modelo = Column(String(255), nullable=True)
    tipo_inversor = Column(String(64), nullable=True)

    # ====== Custos ======
    custo_total_projeto = Column(Float)
    custo_equipamentos = Column(Float)
    custo_instalacao = Column(Float)
    custo_homologacao = Column(Float)
    custo_outros = Column(Float)
    margem_lucro = Column(Float)
    comissao_vendedor = Column(Float)
    
    # ====== Vendedor ======
    vendedor_nome = Column(String(255), nullable=True)
    vendedor_email = Column(String(255), nullable=True)
    vendedor_telefone = Column(String(64), nullable=True)
    vendedor_cargo = Column(String(255), nullable=True)
    
    # ====== URLs e Referências ======
    proposta_id = Column(String(64), nullable=True)
    url_proposta = Column(Text, nullable=True)

    # ====== Payload JSON completo (para dados adicionais e auditoria) ======
    # Inclui: consumo_mes_a_mes, graficos_base64, metrics, kit_selecionado, etc.
    payload = Column(JSON)


class UserDB(Base):
    __tablename__ = 'users'

    uid = Column(String(128), primary_key=True)
    email = Column(String(255), index=True)
    nome = Column(String(255))
    role = Column(String(32))
    cargo = Column(String(255), nullable=True)
    telefone = Column(String(50), nullable=True)
    password_hash = Column(Text, nullable=True)
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

    # Migração leve (sem Alembic): garantir novas colunas existam em produção.
    try:
        with engine.begin() as conn:
            from sqlalchemy import text
            
            if str(DATABASE_URL).startswith("postgresql"):
                # Função auxiliar para verificar e adicionar coluna
                def add_column_if_not_exists(table: str, column: str, col_type: str):
                    try:
                        r = conn.execute(
                            text(f"SELECT 1 FROM information_schema.columns WHERE table_name='{table}' AND column_name='{column}' LIMIT 1")
                        ).fetchone()
                        if not r:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                            print(f"✅ Coluna '{column}' adicionada à tabela '{table}'")
                    except Exception as e:
                        print(f"⚠️ Erro ao adicionar coluna {column}: {e}")
                
                # Migrações para tabela 'users'
                add_column_if_not_exists('users', 'password_hash', 'TEXT')
                add_column_if_not_exists('users', 'telefone', 'VARCHAR(50)')
                
                # Migrações para tabela 'propostas' - novas colunas
                add_column_if_not_exists('propostas', 'updated_at', 'TIMESTAMP')
                add_column_if_not_exists('propostas', 'nome_projeto', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'status', 'VARCHAR(64)')
                add_column_if_not_exists('propostas', 'estado', 'VARCHAR(32)')
                add_column_if_not_exists('propostas', 'cep', 'VARCHAR(32)')
                add_column_if_not_exists('propostas', 'logradouro', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'numero', 'VARCHAR(64)')
                add_column_if_not_exists('propostas', 'bairro', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'complemento', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'concessionaria', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'potencia_kw', 'FLOAT')
                add_column_if_not_exists('propostas', 'tipo_telhado', 'VARCHAR(64)')
                add_column_if_not_exists('propostas', 'tensao', 'VARCHAR(32)')
                add_column_if_not_exists('propostas', 'preco_venda', 'FLOAT')
                add_column_if_not_exists('propostas', 'consumo_mensal_reais', 'FLOAT')
                add_column_if_not_exists('propostas', 'margem_adicional_percentual', 'FLOAT')
                add_column_if_not_exists('propostas', 'margem_adicional_kwh', 'FLOAT')
                add_column_if_not_exists('propostas', 'margem_adicional_reais', 'FLOAT')
                add_column_if_not_exists('propostas', 'modulo_marca', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'modulo_modelo', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'inversor_marca', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'inversor_modelo', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'tipo_inversor', 'VARCHAR(64)')
                add_column_if_not_exists('propostas', 'vendedor_nome', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'vendedor_email', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'vendedor_telefone', 'VARCHAR(64)')
                add_column_if_not_exists('propostas', 'vendedor_cargo', 'VARCHAR(255)')
                add_column_if_not_exists('propostas', 'proposta_id', 'VARCHAR(64)')
                add_column_if_not_exists('propostas', 'url_proposta', 'TEXT')
                
                # Criar índices se não existirem
                try:
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_propostas_status ON propostas(status)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_propostas_cliente_id ON propostas(cliente_id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_propostas_concessionaria ON propostas(concessionaria)"))
                except Exception:
                    pass
                    
            elif str(DATABASE_URL).startswith("sqlite"):
                # SQLite: tentar adicionar colunas se não existirem
                def add_sqlite_column(table: str, column: str, col_type: str):
                    try:
                        r = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
                        cols = {row[1] for row in (r or [])}
                        if column not in cols:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                    except Exception:
                        pass
                
                add_sqlite_column('users', 'password_hash', 'TEXT')
                add_sqlite_column('users', 'telefone', 'VARCHAR(50)')
                # Adicionar novas colunas da proposta
                for col, typ in [
                    ('updated_at', 'TIMESTAMP'), ('nome_projeto', 'TEXT'), ('status', 'TEXT'),
                    ('estado', 'TEXT'), ('cep', 'TEXT'), ('logradouro', 'TEXT'), ('numero', 'TEXT'),
                    ('bairro', 'TEXT'), ('complemento', 'TEXT'), ('concessionaria', 'TEXT'),
                    ('potencia_kw', 'REAL'), ('tipo_telhado', 'TEXT'), ('tensao', 'TEXT'),
                    ('preco_venda', 'REAL'), ('consumo_mensal_reais', 'REAL'),
                    ('margem_adicional_percentual', 'REAL'), ('margem_adicional_kwh', 'REAL'),
                    ('margem_adicional_reais', 'REAL'), ('modulo_marca', 'TEXT'), ('modulo_modelo', 'TEXT'),
                    ('inversor_marca', 'TEXT'), ('inversor_modelo', 'TEXT'), ('tipo_inversor', 'TEXT'),
                    ('vendedor_nome', 'TEXT'), ('vendedor_email', 'TEXT'), ('vendedor_telefone', 'TEXT'),
                    ('vendedor_cargo', 'TEXT'), ('proposta_id', 'TEXT'), ('url_proposta', 'TEXT')
                ]:
                    add_sqlite_column('propostas', col, typ)
    except Exception as e:
        print(f"⚠️ Erro na migração do banco: {e}")
        # best-effort
        pass


