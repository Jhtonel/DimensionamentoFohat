#!/usr/bin/env python3
"""
Sistema de persistência de dados para o sistema de propostas solares
"""

import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from models import User, Cliente, Proposta, SistemaConfiguracao, ConfiguracaoCalculo

class DataManager:
    """Gerenciador de dados do sistema"""
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self._ensure_data_dir()
    
    def _ensure_data_dir(self):
        """Garante que o diretório de dados existe"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
    
    def _get_file_path(self, filename: str) -> str:
        """Retorna o caminho completo do arquivo"""
        return os.path.join(self.data_dir, filename)
    
    def _load_json(self, filename: str) -> Dict[str, Any]:
        """Carrega dados de um arquivo JSON"""
        filepath = self._get_file_path(filename)
        if not os.path.exists(filepath):
            return {}
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Erro ao carregar {filename}: {e}")
            return {}
    
    def _save_json(self, filename: str, data: Dict[str, Any]):
        """Salva dados em um arquivo JSON"""
        filepath = self._get_file_path(filename)
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Erro ao salvar {filename}: {e}")
            raise
    
    def _get_timestamp(self) -> str:
        """Retorna timestamp atual"""
        return datetime.now().isoformat()
    
    # Métodos para Usuários
    def get_user(self, uid: str) -> Optional[User]:
        """Busca usuário por UID"""
        users = self._load_json("users.json")
        user_data = users.get(uid)
        if user_data:
            return User.from_dict(user_data)
        return None
    
    def save_user(self, user: User):
        """Salva ou atualiza usuário"""
        users = self._load_json("users.json")
        users[user.uid] = user.to_dict()
        self._save_json("users.json", users)
    
    def get_all_users(self) -> List[User]:
        """Retorna todos os usuários"""
        users = self._load_json("users.json")
        return [User.from_dict(user_data) for user_data in users.values()]
    
    def is_admin(self, uid: str) -> bool:
        """Verifica se usuário é admin"""
        user = self.get_user(uid)
        return user and user.role == 'admin'
    
    # Métodos para Clientes
    def get_cliente(self, cliente_id: str) -> Optional[Cliente]:
        """Busca cliente por ID"""
        clientes = self._load_json("clientes.json")
        cliente_data = clientes.get(cliente_id)
        if cliente_data:
            return Cliente.from_dict(cliente_data)
        return None
    
    def save_cliente(self, cliente: Cliente):
        """Salva ou atualiza cliente"""
        clientes = self._load_json("clientes.json")
        clientes[cliente.id] = cliente.to_dict()
        self._save_json("clientes.json", clientes)
    
    def get_clientes_by_user(self, user_uid: str) -> List[Cliente]:
        """Retorna clientes criados por um usuário"""
        clientes = self._load_json("clientes.json")
        user_clientes = []
        for cliente_data in clientes.values():
            cliente = Cliente.from_dict(cliente_data)
            if cliente.created_by == user_uid:
                user_clientes.append(cliente)
        return user_clientes
    
    def get_all_clientes(self) -> List[Cliente]:
        """Retorna todos os clientes (apenas para admins)"""
        clientes = self._load_json("clientes.json")
        return [Cliente.from_dict(cliente_data) for cliente_data in clientes.values()]
    
    def delete_cliente(self, cliente_id: str, user_uid: str) -> bool:
        """Remove cliente (apenas se criado pelo usuário ou se for admin)"""
        cliente = self.get_cliente(cliente_id)
        if not cliente:
            return False
        
        # Verificar permissão
        if cliente.created_by != user_uid and not self.is_admin(user_uid):
            return False
        
        clientes = self._load_json("clientes.json")
        if cliente_id in clientes:
            del clientes[cliente_id]
            self._save_json("clientes.json", clientes)
            return True
        return False
    
    # Métodos para Propostas
    def get_proposta(self, proposta_id: str) -> Optional[Proposta]:
        """Busca proposta por ID"""
        propostas = self._load_json("propostas.json")
        proposta_data = propostas.get(proposta_id)
        if proposta_data:
            return Proposta.from_dict(proposta_data)
        return None
    
    def save_proposta(self, proposta: Proposta):
        """Salva ou atualiza proposta"""
        propostas = self._load_json("propostas.json")
        propostas[proposta.id] = proposta.to_dict()
        self._save_json("propostas.json", propostas)
    
    def get_propostas_by_user(self, user_uid: str) -> List[Proposta]:
        """Retorna propostas criadas por um usuário"""
        propostas = self._load_json("propostas.json")
        user_propostas = []
        for proposta_data in propostas.values():
            proposta = Proposta.from_dict(proposta_data)
            if proposta.created_by == user_uid:
                user_propostas.append(proposta)
        return user_propostas
    
    def get_propostas_by_cliente(self, cliente_id: str, user_uid: str) -> List[Proposta]:
        """Retorna propostas de um cliente (apenas se usuário tem acesso)"""
        propostas = self._load_json("propostas.json")
        cliente_propostas = []
        
        for proposta_data in propostas.values():
            proposta = Proposta.from_dict(proposta_data)
            if proposta.cliente_id == cliente_id:
                # Verificar se usuário tem acesso à proposta
                if proposta.created_by == user_uid or self.is_admin(user_uid):
                    cliente_propostas.append(proposta)
        
        return cliente_propostas
    
    def get_all_propostas(self) -> List[Proposta]:
        """Retorna todas as propostas (apenas para admins)"""
        propostas = self._load_json("propostas.json")
        return [Proposta.from_dict(proposta_data) for proposta_data in propostas.values()]
    
    def delete_proposta(self, proposta_id: str, user_uid: str) -> bool:
        """Remove proposta (apenas se criada pelo usuário ou se for admin)"""
        proposta = self.get_proposta(proposta_id)
        if not proposta:
            return False
        
        # Verificar permissão
        if proposta.created_by != user_uid and not self.is_admin(user_uid):
            return False
        
        propostas = self._load_json("propostas.json")
        if proposta_id in propostas:
            del propostas[proposta_id]
            self._save_json("propostas.json", propostas)
            return True
        return False
    
    # Métodos para Configurações
    def get_configuracao_sistema(self) -> SistemaConfiguracao:
        """Retorna configurações do sistema"""
        config_data = self._load_json("configuracao.json")
        if not config_data:
            # Configuração padrão
            config_calc = ConfiguracaoCalculo()
            return SistemaConfiguracao(
                configuracao_calculo=config_calc,
                updated_at=self._get_timestamp()
            )
        
        return SistemaConfiguracao.from_dict(config_data)
    
    def save_configuracao_sistema(self, config: SistemaConfiguracao, user_uid: str) -> bool:
        """Salva configurações do sistema (apenas admins)"""
        if not self.is_admin(user_uid):
            return False
        
        config.updated_by = user_uid
        config.updated_at = self._get_timestamp()
        
        self._save_json("configuracao.json", config.to_dict())
        return True
    
    # Métodos utilitários
    def generate_id(self) -> str:
        """Gera ID único"""
        import uuid
        return str(uuid.uuid4())
    
    def get_stats(self, user_uid: str) -> Dict[str, Any]:
        """Retorna estatísticas do sistema"""
        stats = {
            "total_clientes": 0,
            "total_propostas": 0,
            "meus_clientes": 0,
            "minhas_propostas": 0
        }
        
        if self.is_admin(user_uid):
            stats["total_clientes"] = len(self.get_all_clientes())
            stats["total_propostas"] = len(self.get_all_propostas())
        
        stats["meus_clientes"] = len(self.get_clientes_by_user(user_uid))
        stats["minhas_propostas"] = len(self.get_propostas_by_user(user_uid))
        
        return stats
