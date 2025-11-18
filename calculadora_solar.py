#!/usr/bin/env python3
"""
CALCULADORA CENTRALIZADA DE ENERGIA SOLAR
==========================================

Este arquivo contém TODOS os cálculos da aplicação de energia solar,
centralizados em um único local para facilitar análise e manutenção.

Autor: Sistema de Dimensionamento Solar
Data: 2025
"""

import math
import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

@dataclass
class DadosProjeto:
    """Estrutura de dados para um projeto de energia solar"""
    # Dados básicos
    cliente_nome: str = ""
    cidade: str = ""
    estado: str = ""
    
    # Consumo
    consumo_mensal_kwh: float = 0.0
    consumo_mensal_reais: float = 0.0
    consumo_mes_a_mes: List[Dict] = None
    
    # Tarifa e concessionária
    concessionaria: str = ""
    tarifa_energia: float = 0.75
    
    # Potência e dimensionamento
    potencia_sistema: float = 0.0
    potencia_placa_w: float = 600
    quantidade_placas: int = 0
    
    # Irradiação
    irradiacao_media: float = 5.15
    
    # Custos
    custo_equipamentos: float = 0.0
    comissao_vendedor: float = 5.0
    percentual_comissao: float = 5.0
    percentual_margem_lucro: float = 25.0
    
    # Configurações
    eficiencia_sistema: float = 0.80
    tipo_instalacao: str = "residencial"
    tipo_telhado: str = "ceramico"

class CalculadoraSolar:
    """Classe principal com todos os cálculos de energia solar"""
    
    def __init__(self):
        self.configuracoes = {
            'eficiencia_sistema': 0.80,
            'potencia_placa_padrao_w': 600,
            'aumento_tarifa_anual': 0.0034,  # 0.34% ao ano
            'perda_eficiencia_anual': 0.008,  # 0.8% ao ano
            'fator_correcao': 1.066,
            'eficiencia_inicial': 0.85
        }
    
    # ===== CÁLCULOS DE DIMENSIONAMENTO =====
    
    def calcular_potencia_sistema(self, dados: DadosProjeto) -> float:
        """
        Calcula a potência necessária do sistema baseada no consumo
        
        Fórmula: Potência = (Consumo Anual / 365) / (Irradiação × Eficiência)
        """
        if dados.consumo_mensal_kwh <= 0:
            return 0.0
        
        consumo_anual = dados.consumo_mensal_kwh * 12
        consumo_diario_medio = consumo_anual / 365
        
        potencia_necessaria = consumo_diario_medio / (dados.irradiacao_media * self.configuracoes['eficiencia_sistema'])
        
        return round(potencia_necessaria, 3)
    
    def calcular_quantidade_placas(self, dados: DadosProjeto) -> int:
        """
        Calcula a quantidade de placas necessárias
        
        Fórmula: Quantidade = ceil((Potência Sistema × 1000) / Potência Placa)
        """
        if dados.potencia_sistema <= 0 or dados.potencia_placa_w <= 0:
            return 0
        
        quantidade = math.ceil((dados.potencia_sistema * 1000) / dados.potencia_placa_w)
        return quantidade
    
    def calcular_geracao_mensal(self, dados: DadosProjeto) -> float:
        """
        Calcula a geração mensal do sistema
        
        Fórmula: Geração = Potência (kWp) × Irradiação diária (kWh/m²/dia) × 30,4 dias × PR × Fator Correção
        """
        irradiacao_diaria = dados.irradiacao_media
        dias_mes_medio = 30.4
        pr = self.configuracoes['eficiencia_inicial']
        fator_correcao = self.configuracoes['fator_correcao']
        
        geracao = dados.potencia_sistema * irradiacao_diaria * dias_mes_medio * pr * fator_correcao
        return round(geracao, 2)
    
    # ===== CÁLCULOS DE CUSTOS =====
    
    def calcular_custo_homologacao(self, potencia_kwp: float) -> float:
        """
        Calcula o custo de homologação baseado na potência do sistema
        
        Tabela de valores:
        - Até 1 kWp: R$ 200
        - 1-3 kWp: R$ 300
        - 3-5 kWp: R$ 400
        - 5-10 kWp: R$ 500
        - 10-20 kWp: R$ 600
        - 20-50 kWp: R$ 800
        - Acima de 50 kWp: R$ 1000
        """
        if potencia_kwp <= 0:
            return 0
        
        if potencia_kwp <= 1:
            return 200
        elif potencia_kwp <= 3:
            return 300
        elif potencia_kwp <= 5:
            return 400
        elif potencia_kwp <= 10:
            return 500
        elif potencia_kwp <= 20:
            return 600
        elif potencia_kwp <= 50:
            return 800
        else:
            return 1000
    
    def calcular_custo_operacional(self, dados: DadosProjeto) -> Dict[str, float]:
        """
        Calcula todos os custos operacionais do projeto
        
        Componentes:
        - Instalação: R$ 200/placa
        - CA/Aterramento: R$ 100/placa
        - Homologação: Baseado na potência
        - Plaquinhas: R$ 60/projeto
        - Obra: 10% da instalação
        """
        quantidade_placas = dados.quantidade_placas
        
        custo_instalacao = quantidade_placas * 200
        custo_ca_aterramento = quantidade_placas * 100
        custo_homologacao = self.calcular_custo_homologacao(dados.potencia_sistema)
        custo_plaquinhas = 60
        custo_obra = custo_instalacao * 0.1
        
        custo_total = (dados.custo_equipamentos + custo_instalacao + 
                      custo_ca_aterramento + custo_homologacao + 
                      custo_plaquinhas + custo_obra)
        
        return {
            'custo_equipamentos': dados.custo_equipamentos,
            'custo_instalacao': custo_instalacao,
            'custo_ca_aterramento': custo_ca_aterramento,
            'custo_homologacao': custo_homologacao,
            'custo_plaquinhas': custo_plaquinhas,
            'custo_obra': custo_obra,
            'custo_total': custo_total
        }
    
    def calcular_preco_venda(self, custo_operacional: float, comissao_vendedor: float = 5.0) -> float:
        """
        Calcula o preço de venda baseado no custo operacional e margem
        
        Fórmula: Preço Venda = Custo Operacional / (1 - Margem Desejada)
        Margem Desejada = 25% + Comissão Vendedor
        """
        # Limitar comissão para evitar margem muito alta
        if comissao_vendedor > 50:
            comissao_vendedor = 50
        
        margem_desejada = (25 + comissao_vendedor) / 100
        
        # Garantir que a margem esteja entre 10% e 80%
        if margem_desejada >= 0.8:
            margem_desejada = 0.8
        if margem_desejada <= 0.1:
            margem_desejada = 0.1
        
        # Verificação final para evitar divisão por zero
        if (1 - margem_desejada) <= 0.01:
            margem_desejada = 0.1
        
        preco_venda = custo_operacional / (1 - margem_desejada)
        return round(preco_venda, 2)
    
    # ===== CÁLCULOS FINANCEIROS =====
    
    def calcular_conta_atual_anual(self, dados: DadosProjeto) -> float:
        """
        Calcula a conta anual atual do cliente
        
        Prioridade:
        1. Se tem consumo em reais: Consumo Reais × 12
        2. Se tem consumo em kWh: Consumo kWh × Tarifa × 12
        """
        # Se tem consumo em reais, usar ele
        if dados.consumo_mensal_reais > 0:
            return dados.consumo_mensal_reais * 12
        
        # Se não tem consumo em reais, calcular baseado em kWh e tarifa
        if dados.consumo_mensal_kwh > 0:
            return dados.consumo_mensal_kwh * dados.tarifa_energia * 12
        
        return 0
    
    def calcular_economia_mensal(self, dados: DadosProjeto) -> float:
        """
        Calcula a economia mensal estimada
        
        Fórmula: Economia = Consumo kWh × Tarifa × 0.95
        (0.95 é o fator de eficiência do sistema)
        """
        if dados.consumo_mensal_kwh <= 0:
            return 0
        
        economia = dados.consumo_mensal_kwh * dados.tarifa_energia * 0.95
        return round(economia, 2)
    
    def calcular_payback(self, preco_venda: float, economia_mensal: float) -> Dict[str, float]:
        """
        Calcula o tempo de payback do investimento
        
        Fórmula: Payback = Preço Venda / Economia Anual
        """
        if economia_mensal <= 0 or preco_venda <= 0:
            return {'anos': 0, 'meses': 0}
        
        economia_anual = economia_mensal * 12
        payback_anos = preco_venda / economia_anual
        payback_meses = payback_anos * 12
        
        return {
            'anos': round(payback_anos, 1),
            'meses': round(payback_meses, 0)
        }
    
    def calcular_gasto_acumulado_payback(self, conta_atual_anual: float, anos_payback: float) -> float:
        """
        Calcula o gasto acumulado durante o período de payback
        
        Fórmula: Gasto Acumulado = Conta Atual Anual × Anos Payback
        """
        return conta_atual_anual * anos_payback
    
    # ===== PROJEÇÕES FINANCEIRAS DE 25 ANOS =====
    
    def calcular_projecoes_25_anos(self, dados: DadosProjeto) -> Dict:
        """
        Calcula projeções financeiras para 25 anos
        
        Considera:
        - Aumento anual da tarifa: 0.34%
        - Perda de eficiência anual: 0.8%
        - Eficiência inicial: 85%
        """
        anos = 25
        aumentoTarifaAnual = self.configuracoes['aumento_tarifa_anual']
        perdaEficienciaAnual = self.configuracoes['perda_eficiencia_anual']
        eficienciaInicial = self.configuracoes['eficiencia_inicial']
        
        geracao_mensal = self.calcular_geracao_mensal(dados)
        economia_mensal = self.calcular_economia_mensal(dados)
        
        # Arrays para armazenar dados anuais
        geracao_anual = []
        consumo_anual = []
        tarifa_anual = []
        economia_anual = []
        economia_acumulada = []
        
        economia_total = 0
        
        for ano in range(anos):
            # Calcular eficiência atual (perda de 0.8% ao ano)
            eficiencia_atual = eficienciaInicial * (1 - perdaEficienciaAnual) ** ano
            
            # Calcular tarifa atual (aumento de 0.34% ao ano)
            tarifa_atual = dados.tarifa_energia * (1 + aumentoTarifaAnual) ** ano
            
            # Geração anual atual
            geracao_ano = geracao_mensal * 12 * eficiencia_atual
            
            # Consumo anual (assumindo constante)
            consumo_ano = dados.consumo_mensal_kwh * 12
            
            # Economia anual atual
            economia_ano = min(geracao_ano, consumo_ano) * tarifa_atual
            
            economia_total += economia_ano
            
            # Armazenar dados
            geracao_anual.append(round(geracao_ano, 2))
            consumo_anual.append(round(consumo_ano, 2))
            tarifa_anual.append(round(tarifa_atual, 4))
            economia_anual.append(round(economia_ano, 2))
            economia_acumulada.append(round(economia_total, 2))
        
        return {
            'geracao_anual': geracao_anual,
            'consumo_anual': consumo_anual,
            'tarifa_anual': tarifa_anual,
            'economia_anual': economia_anual,
            'economia_acumulada': economia_acumulada,
            'economia_total_25_anos': round(economia_total, 2),
            'geracao_media_mensal': round(geracao_mensal, 2),
            'economia_mensal_estimada': round(economia_mensal, 2)
        }
    
    # ===== CÁLCULO COMPLETO DO PROJETO =====
    
    def calcular_projeto_completo(self, dados: DadosProjeto) -> Dict:
        """
        Executa todos os cálculos do projeto e retorna resultado completo
        """
        print(f"🔍 Calculando projeto para: {dados.cliente_nome}")
        print(f"   - Consumo mensal: {dados.consumo_mensal_kwh} kWh")
        print(f"   - Potência sistema: {dados.potencia_sistema} kWp")
        print(f"   - Custo equipamentos: R$ {dados.custo_equipamentos:,.2f}")
        
        # 1. Dimensionamento
        # Derivar consumo em kWh quando usuário informou apenas média em R$
        if (dados.consumo_mensal_kwh <= 0) and (dados.consumo_mensal_reais > 0) and (dados.tarifa_energia > 0):
            dados.consumo_mensal_kwh = dados.consumo_mensal_reais / dados.tarifa_energia
            print(f"   - Consumo derivado de R$: {dados.consumo_mensal_kwh:.2f} kWh/mês")
        if dados.potencia_sistema <= 0:
            dados.potencia_sistema = self.calcular_potencia_sistema(dados)
        
        dados.quantidade_placas = self.calcular_quantidade_placas(dados)
        
        # 2. Custos operacionais
        custos = self.calcular_custo_operacional(dados)
        
        # 3. Preço de venda
        preco_venda = self.calcular_preco_venda(custos['custo_total'], dados.comissao_vendedor)
        
        # 4. Cálculos financeiros
        conta_atual_anual = self.calcular_conta_atual_anual(dados)
        economia_mensal = self.calcular_economia_mensal(dados)
        payback = self.calcular_payback(preco_venda, economia_mensal)
        gasto_acumulado = self.calcular_gasto_acumulado_payback(conta_atual_anual, payback['anos'])
        
        # 5. Projeções de 25 anos
        projecoes = self.calcular_projecoes_25_anos(dados)
        
        # 6. Resultado final
        resultado = {
            # Dados básicos
            'cliente_nome': dados.cliente_nome,
            'cidade': dados.cidade,
            'potencia_sistema': dados.potencia_sistema,
            'quantidade_placas': dados.quantidade_placas,
            'potencia_placa_w': dados.potencia_placa_w,
            
            # Custos detalhados
            'custo_equipamentos': custos['custo_equipamentos'],
            'custo_instalacao': custos['custo_instalacao'],
            'custo_ca_aterramento': custos['custo_ca_aterramento'],
            'custo_homologacao': custos['custo_homologacao'],
            'custo_plaquinhas': custos['custo_plaquinhas'],
            'custo_obra': custos['custo_obra'],
            'custo_total': custos['custo_total'],
            
            # Preços
            'preco_venda': preco_venda,
            'comissao_vendedor': dados.comissao_vendedor,
            'margem_desejada': round((25 + dados.comissao_vendedor) / 100 * 100, 1),
            
            # Financeiro atual
            'conta_atual_anual': conta_atual_anual,
            'economia_mensal_estimada': economia_mensal,
            'economia_anual_estimada': economia_mensal * 12,
            
            # Payback
            'anos_payback': payback['anos'],
            'payback_meses': payback['meses'],
            'gasto_acumulado_payback': gasto_acumulado,
            
            # Projeções
            'economia_total_25_anos': projecoes['economia_total_25_anos'],
            'geracao_media_mensal': projecoes['geracao_media_mensal'],
            
            # Dados técnicos
            'irradiacao_media': dados.irradiacao_media,
            'eficiencia_sistema': self.configuracoes['eficiencia_sistema'],
            'tarifa_energia': dados.tarifa_energia,
            'consumo_mensal_kwh': dados.consumo_mensal_kwh
        }
        
        print(f"✅ Projeto calculado com sucesso!")
        print(f"   - Preço de venda: R$ {preco_venda:,.2f}")
        print(f"   - Payback: {payback['anos']:.1f} anos ({payback['meses']:.0f} meses)")
        print(f"   - Economia total 25 anos: R$ {projecoes['economia_total_25_anos']:,.2f}")
        
        return resultado

# ===== FUNÇÃO PRINCIPAL PARA TESTE =====

def testar_calculadora():
    """Função para testar a calculadora com dados de exemplo"""
    
    # Criar dados de teste
    dados_teste = DadosProjeto(
        cliente_nome="João Silva",
        cidade="São José dos Campos",
        estado="SP",
        consumo_mensal_kwh=300,
        tarifa_energia=0.75,
        potencia_sistema=2.925,
        potencia_placa_w=600,
        custo_equipamentos=4961.5,
        comissao_vendedor=5.0,
        irradiacao_media=5.15
    )
    
    # Criar calculadora e executar cálculos
    calc = CalculadoraSolar()
    resultado = calc.calcular_projeto_completo(dados_teste)
    
    # Exibir resultado
    print("\n" + "="*60)
    print("RESULTADO DO CÁLCULO COMPLETO")
    print("="*60)
    print(json.dumps(resultado, indent=2, ensure_ascii=False))
    
    return resultado

if __name__ == "__main__":
    testar_calculadora()
