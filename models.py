#!/usr/bin/env python3
"""
Modelos de dados para o sistema de propostas solares
"""

from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

@dataclass
class User:
    """Modelo de usuário"""
    uid: str  # Firebase UID
    email: str
    nome: str
    role: str  # 'admin' ou 'comum'
    created_at: str
    updated_at: str
    telefone: str = ""  # Telefone do usuário
    cargo: str = ""  # Cargo do usuário
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'User':
        # Suportar dados antigos sem os novos campos
        data = data.copy()
        if 'telefone' not in data:
            data['telefone'] = ""
        if 'cargo' not in data:
            data['cargo'] = ""
        return cls(**data)

@dataclass
class Endereco:
    """Modelo de endereço"""
    logradouro: str
    numero: str
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: str = ""
    estado: str = ""
    cep: str = ""
    principal: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Endereco':
        return cls(**data)

@dataclass
class Cliente:
    """Modelo de cliente"""
    id: str
    nome: str
    telefone: str
    email: Optional[str] = None
    enderecos: List[Endereco] = None
    created_by: str = ""  # UID do usuário que criou
    created_at: str = ""
    updated_at: str = ""
    
    def __post_init__(self):
        if self.enderecos is None:
            self.enderecos = []
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['enderecos'] = [end.to_dict() for end in self.enderecos]
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Cliente':
        enderecos_data = data.get('enderecos', [])
        enderecos = [Endereco.from_dict(end) for end in enderecos_data]
        data['enderecos'] = enderecos
        return cls(**data)

@dataclass
class ConfiguracaoCalculo:
    """Configurações para cálculos de propostas"""
    # Custos operacionais
    custo_instalacao_por_kw: float = 800.0
    custo_ca_aterramento: float = 500.0
    custo_homologacao: float = 300.0
    custo_plaquinhas: float = 200.0
    custo_obra_por_kw: float = 400.0
    
    # Margens e comissões
    margem_desejada: float = 0.3  # 30%
    comissao_vendedor: float = 0.05  # 5%
    
    # Eficiência e degradação
    eficiencia_sistema: float = 0.85
    degradacao_anual: float = 0.005  # 0.5% ao ano
    
    # Tarifas padrão por concessionária
    tarifas_concessionarias: Dict[str, float] = None
    
    def __post_init__(self):
        if self.tarifas_concessionarias is None:
            self.tarifas_concessionarias = {
                "EDP SP": 0.82,
                "Enel SP": 0.75,
                "CPFL": 0.78,
                "Light": 0.85,
                "Cemig": 0.72,
                "Coelba": 0.74,
                "Celpe": 0.76
            }
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConfiguracaoCalculo':
        return cls(**data)

@dataclass
class Proposta:
    """Modelo de proposta solar"""
    id: str
    cliente_id: str
    cliente_nome: str
    
    # Dados do sistema
    potencia_sistema: float
    quantidade_placas: int
    potencia_placa_w: int
    area_necessaria: float
    
    # Dados de consumo
    consumo_mensal_kwh: float
    tarifa_energia: float
    concessionaria: str
    
    # Dados de irradiação
    irradiacao_media: float
    cidade: str
    
    # Custos
    custo_equipamentos: float
    custo_instalacao: float
    custo_ca_aterramento: float
    custo_homologacao: float
    custo_plaquinhas: float
    custo_obra: float
    custo_total: float
    
    # Preços e margens
    preco_venda: float
    comissao_vendedor: float
    margem_desejada: float
    
    # Cálculos financeiros
    conta_atual_anual: float
    economia_mensal_estimada: float
    economia_anual_estimada: float
    anos_payback: float
    payback_meses: int
    gasto_acumulado_payback: float
    economia_total_25_anos: float
    
    # Geração
    geracao_media_mensal: float
    eficiencia_sistema: float
    
    # Informações do vendedor
    vendedor_nome: str = ""
    vendedor_cargo: str = "Consultor de Energia Solar"
    vendedor_telefone: str = ""
    vendedor_email: str = ""
    
    # Datas
    data_proposta: str = ""
    data_contrato: str = ""
    data_aprovacao: str = ""
    data_validacao: str = ""
    data_equipamentos: str = ""
    data_montagem: str = ""
    data_conclusao: str = ""
    
    # Campos adicionais para o template
    preco_final: float = 0.0
    economia_mensal: float = 0.0
    gasto_total_25_anos: float = 0.0
    conta_futura_25_anos: float = 0.0
    creditos_anuais: float = 0.0
    payback_anos: float = 0.0
    
    # Metadados
    created_by: str = ""  # UID do usuário que criou
    created_at: str = ""
    updated_at: str = ""
    
    # Campos opcionais para o template
    cliente_endereco: str = ""
    cliente_telefone: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Proposta':
        return cls(**data)

@dataclass
class SistemaConfiguracao:
    """Configurações gerais do sistema"""
    configuracao_calculo: ConfiguracaoCalculo
    updated_by: str = ""  # UID do admin que atualizou
    updated_at: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'configuracao_calculo': self.configuracao_calculo.to_dict(),
            'updated_by': self.updated_by,
            'updated_at': self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SistemaConfiguracao':
        config_calc = ConfiguracaoCalculo.from_dict(data['configuracao_calculo'])
        return cls(
            configuracao_calculo=config_calc,
            updated_by=data.get('updated_by', ''),
            updated_at=data.get('updated_at', '')
        )
