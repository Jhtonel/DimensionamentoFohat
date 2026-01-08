#!/usr/bin/env python3
"""
dimensionamento_core.py
=======================
Fonte ÚNICA da verdade para o dimensionamento, KPIs financeiros e (opcionalmente)
as tabelas/gráficos usados na proposta.

ATUALIZADO PARA 2026 - Conforme:
- Lei 14.300/2022 (Marco Legal da Geração Distribuída)
- Resolução Normativa ANEEL 1000/2023
- Regulamentos estaduais de ICMS (SP)
- Normas ABNT NBR 16690 e NBR 5410

Objetivos:
- Reproduzir as regras da planilha (prompt único) para valores de proposta
- Gerar as mesmas métricas usadas na aba de custos (payback = preço venda / economia mensal)
- Fornecer, quando necessário, as tabelas de 25 anos e gráficos base64
- Decompor a tarifa em TE, TUSD compensável, TUSD Fio B, PIS, COFINS e ICMS
- Aplicar regras de compensação conforme Lei 14.300/2022
- Considerar degradação anual do sistema fotovoltaico
- Incluir custos de manutenção e substituição de equipamentos
"""
from __future__ import annotations

from typing import Dict, List, Any, Optional
from math import isfinite
import math

# ========================
# PARÂMETROS LEI 14.300/2022
# ========================
# Percentual da TUSD que é compensável (varia por concessionária e data de instalação)
# Para sistemas instalados após 07/01/2023: transição gradual até 2029
# 2024: 15% da TUSD Fio B cobrada | 2025: 30% | 2026: 45% | 2027: 60% | 2028: 75% | 2029+: 90%
TUSD_FIO_B_COBRANCA_2026 = 0.45  # 45% da TUSD Fio B é cobrada em 2026

# Percentual da tarifa que é efetivamente compensável
# TE: 100% compensável
# TUSD: parcialmente compensável (depende da regra de transição)
PERCENTUAL_TE_COMPENSAVEL = 1.0  # 100%
PERCENTUAL_TUSD_COMPENSAVEL_2026 = 0.55  # 55% em 2026 (100% - 45% Fio B)

# ICMS: Em SP, a compensação de ICMS é permitida para GD
ICMS_COMPENSAVEL_SP = True

# Validade dos créditos de energia (Lei 14.300)
VALIDADE_CREDITOS_MESES = 60  # 5 anos

# Degradação anual do sistema fotovoltaico
TAXA_DEGRADACAO_ANUAL_PADRAO = 0.0075  # 0.75% ao ano (valor realista)

# Custos anuais de manutenção (% do investimento inicial)
CUSTO_MANUTENCAO_ANUAL_PERCENTUAL = 0.01  # 1% ao ano

# Substituição do inversor (geralmente entre ano 10-15)
ANO_SUBSTITUICAO_INVERSOR = 12
CUSTO_SUBSTITUICAO_INVERSOR_PERCENTUAL = 0.15  # 15% do investimento inicial

# ------------------------
# Utilitários básicos
# ------------------------
def _to_float(v: Any, d: float = 0.0) -> float:
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

# ------------------------
# Decomposição da Tarifa (Lei 14.300/2022)
# ------------------------
def calcular_decomposicao_tarifa(tarifa_total: float, consumo_kwh: float, ano: int = 2026) -> Dict[str, Any]:
    """
    Decompõe a tarifa de energia em seus componentes conforme Lei 14.300/2022.
    
    Componentes:
    - TE (Tarifa de Energia): ~45% da tarifa base - 100% COMPENSÁVEL
    - TUSD Compensável: parte da TUSD que pode ser compensada
    - TUSD Fio B: parte da TUSD que NÃO é compensável (cresce gradualmente até 2029)
    - PIS: 1.65%
    - COFINS: 7.6%
    - ICMS: 18% (SP) - compensável em SP
    
    Regra de transição Lei 14.300 (TUSD Fio B cobrada):
    - 2024: 15% | 2025: 30% | 2026: 45% | 2027: 60% | 2028: 75% | 2029+: 90%
    """
    if tarifa_total <= 0:
        return {
            "tarifa_total": 0,
            "tarifa_base": 0,
            "te": {"valor_kwh": 0, "total": 0, "compensavel": True, "percentual": 0.545},
            "tusd_compensavel": {"valor_kwh": 0, "total": 0, "compensavel": True},
            "tusd_fio_b": {"valor_kwh": 0, "total": 0, "compensavel": False},
            "pis": {"aliquota": 0.0165, "valor_kwh": 0, "total": 0, "compensavel": True},
            "cofins": {"aliquota": 0.076, "valor_kwh": 0, "total": 0, "compensavel": True},
            "icms": {"aliquota": 0.18, "valor_kwh": 0, "total": 0, "compensavel": True},
            "total_compensavel": 0,
            "total_nao_compensavel": 0,
            "economia_real": 0,
            "custo_residual": 0,
            "total_impostos": 0,
            "total_sem_impostos": 0,
            "total_final": 0,
        }
    
    # Definir percentual de TUSD Fio B cobrada conforme ano (Lei 14.300)
    tusd_fio_b_cobranca = {
        2024: 0.15,
        2025: 0.30,
        2026: 0.45,
        2027: 0.60,
        2028: 0.75,
    }.get(ano, 0.90)  # 2029+ = 90%
    
    # Alíquotas de impostos (SP)
    pis_aliquota = 0.0165
    cofins_aliquota = 0.076
    icms_aliquota = 0.18
    
    # A tarifa total já inclui os impostos
    fator_impostos = 1 + pis_aliquota + cofins_aliquota + icms_aliquota
    
    # Tarifa base (TE + TUSD) sem impostos
    tarifa_base = tarifa_total / fator_impostos
    
    # TE (Tarifa de Energia) - aproximadamente 54.5% da tarifa base - 100% COMPENSÁVEL
    te_percentual = 0.545
    te_valor_kwh = tarifa_base * te_percentual
    
    # TUSD Total - aproximadamente 45.5% da tarifa base
    tusd_total_percentual = 0.455
    tusd_valor_kwh_total = tarifa_base * tusd_total_percentual
    
    # TUSD Fio B (NÃO compensável) - parte da TUSD cobrada conforme Lei 14.300
    tusd_fio_b_valor_kwh = tusd_valor_kwh_total * tusd_fio_b_cobranca
    
    # TUSD Compensável - parte da TUSD que pode ser compensada
    tusd_compensavel_valor_kwh = tusd_valor_kwh_total * (1 - tusd_fio_b_cobranca)
    
    # Valores dos impostos por kWh
    pis_valor_kwh = tarifa_base * pis_aliquota
    cofins_valor_kwh = tarifa_base * cofins_aliquota
    icms_valor_kwh = tarifa_base * icms_aliquota
    
    # Totais baseados no consumo
    te_total = te_valor_kwh * consumo_kwh
    tusd_compensavel_total = tusd_compensavel_valor_kwh * consumo_kwh
    tusd_fio_b_total = tusd_fio_b_valor_kwh * consumo_kwh
    pis_total = pis_valor_kwh * consumo_kwh
    cofins_total = cofins_valor_kwh * consumo_kwh
    icms_total = icms_valor_kwh * consumo_kwh
    
    # Total de impostos
    total_impostos = pis_total + cofins_total + icms_total
    total_sem_impostos = tarifa_base * consumo_kwh
    total_final = tarifa_total * consumo_kwh
    
    # ECONOMIA REAL (Lei 14.300) - apenas componentes compensáveis
    # Em SP: TE + TUSD compensável + PIS + COFINS + ICMS são compensáveis
    total_compensavel = te_total + tusd_compensavel_total + pis_total + cofins_total + icms_total
    
    # Custo residual (TUSD Fio B) - sempre será pago mesmo com solar
    total_nao_compensavel = tusd_fio_b_total
    
    # Economia real = o que você deixa de pagar
    economia_real = total_compensavel
    
    # Percentual de economia sobre a conta total
    percentual_economia = (economia_real / total_final * 100) if total_final > 0 else 0
    
    return {
        "tarifa_total": tarifa_total,
        "tarifa_base": round(tarifa_base, 4),
        "ano_referencia": ano,
        "tusd_fio_b_cobranca_percentual": tusd_fio_b_cobranca,
        "te": {
            "valor_kwh": round(te_valor_kwh, 4),
            "total": round(te_total, 2),
            "percentual": te_percentual,
            "compensavel": True,
            "descricao": "Tarifa de Energia (TE) - 100% compensável"
        },
        "tusd_compensavel": {
            "valor_kwh": round(tusd_compensavel_valor_kwh, 4),
            "total": round(tusd_compensavel_total, 2),
            "percentual": 1 - tusd_fio_b_cobranca,
            "compensavel": True,
            "descricao": f"TUSD Compensável ({int((1-tusd_fio_b_cobranca)*100)}% em {ano})"
        },
        "tusd_fio_b": {
            "valor_kwh": round(tusd_fio_b_valor_kwh, 4),
            "total": round(tusd_fio_b_total, 2),
            "percentual": tusd_fio_b_cobranca,
            "compensavel": False,
            "descricao": f"TUSD Fio B - NÃO compensável ({int(tusd_fio_b_cobranca*100)}% em {ano} - Lei 14.300)"
        },
        "pis": {
            "aliquota": pis_aliquota,
            "valor_kwh": round(pis_valor_kwh, 4),
            "total": round(pis_total, 2),
            "compensavel": True,
            "descricao": "PIS - Programa de Integração Social"
        },
        "cofins": {
            "aliquota": cofins_aliquota,
            "valor_kwh": round(cofins_valor_kwh, 4),
            "total": round(cofins_total, 2),
            "compensavel": True,
            "descricao": "COFINS - Contribuição para Financiamento da Seguridade Social"
        },
        "icms": {
            "aliquota": icms_aliquota,
            "valor_kwh": round(icms_valor_kwh, 4),
            "total": round(icms_total, 2),
            "compensavel": ICMS_COMPENSAVEL_SP,
            "descricao": "ICMS - Imposto Estadual (compensável em SP)"
        },
        # Resumos Lei 14.300
        "total_compensavel": round(total_compensavel, 2),
        "total_nao_compensavel": round(total_nao_compensavel, 2),
        "economia_real": round(economia_real, 2),
        "custo_residual": round(total_nao_compensavel, 2),
        "percentual_economia": round(percentual_economia, 1),
        # Totais gerais
        "total_impostos": round(total_impostos, 2),
        "total_sem_impostos": round(total_sem_impostos, 2),
        "total_final": round(total_final, 2),
    }

# ------------------------
# Cálculos de KPIs (Lei 14.300/2022)
# ------------------------
def calcular_kpis(payload: Dict[str, Any]) -> Dict[str, float]:
    """
    KPIs alinhados com Lei 14.300/2022:
      - economia_mensal_real: economia REAL considerando apenas parcelas compensáveis
      - economia_mensal_bruta: economia se 100% fosse compensável (para comparação)
      - custo_residual_mensal: TUSD Fio B que sempre será pago
      - conta_atual_anual: consumo (R$ ou kWh*tarifa) * 12
      - payback_meses: calculado com economia REAL + custos de manutenção
      - payback_anos: payback_meses / 12
      - gasto_acumulado_payback: conta_atual_anual * payback_anos
      - decomposicao_tarifa: detalhamento TE, TUSD compensável, TUSD Fio B, impostos
    """
    consumo_reais = _to_float(payload.get('consumo_mensal_reais', 0), 0.0)
    consumo_kwh = _to_float(payload.get('consumo_mensal_kwh', 0), 0.0)
    tarifa = _to_float(payload.get('tarifa_energia', payload.get('tarifa_kwh', 0)), 0.0)
    preco_venda = _to_float(payload.get('preco_venda', payload.get('preco_final', 0)), 0.0)
    ano_referencia = int(payload.get('ano_instalacao', 2026))

    # Converter kWh quando veio apenas R$
    if consumo_kwh <= 0 and consumo_reais > 0 and tarifa > 0:
        consumo_kwh = consumo_reais / tarifa

    # Economia mensal BRUTA (se 100% fosse compensável - modelo antigo)
    if consumo_reais > 0:
        economia_mensal_bruta = consumo_reais
    else:
        economia_mensal_bruta = consumo_kwh * tarifa

    # Calcular decomposição da tarifa conforme Lei 14.300
    decomposicao = calcular_decomposicao_tarifa(tarifa, consumo_kwh, ano_referencia)
    
    # ECONOMIA REAL (Lei 14.300) - apenas componentes compensáveis
    economia_mensal_real = decomposicao["economia_real"]
    custo_residual_mensal = decomposicao["custo_residual"]
    
    # Conta atual anual (sem solar)
    conta_atual_anual = (consumo_reais * 12.0) if consumo_reais > 0 else (consumo_kwh * tarifa * 12.0)
    conta_atual_anual = conta_atual_anual if isfinite(conta_atual_anual) else 0.0

    # Custo anual de manutenção (1% do investimento)
    custo_manutencao_anual = preco_venda * CUSTO_MANUTENCAO_ANUAL_PERCENTUAL
    
    # Economia líquida anual (economia real - manutenção - custo residual TUSD Fio B)
    economia_liquida_anual = (economia_mensal_real * 12) - custo_manutencao_anual - (custo_residual_mensal * 12)
    economia_liquida_mensal = economia_liquida_anual / 12 if economia_liquida_anual > 0 else 0

    # PAYBACK REAL (considerando economia líquida)
    payback_meses_real = (preco_venda / economia_liquida_mensal) if economia_liquida_mensal > 0 else 0.0
    payback_anos_real = payback_meses_real / 12.0 if payback_meses_real > 0 else 0.0
    payback_anos_real = round(payback_anos_real, 1)
    payback_meses_real = int(round(payback_meses_real))
    
    # Payback otimista (sem considerar custos - para comparação)
    payback_meses_otimista = (preco_venda / economia_mensal_real) if economia_mensal_real > 0 else 0.0
    payback_anos_otimista = payback_meses_otimista / 12.0 if payback_meses_otimista > 0 else 0.0
    payback_anos_otimista = round(payback_anos_otimista, 1)

    gasto_acumulado_payback = conta_atual_anual * payback_anos_real if (conta_atual_anual > 0 and payback_anos_real > 0) else 0.0
    
    # Economia detalhada por componente (mensal)
    economia_te_mensal = decomposicao["te"]["total"]
    economia_tusd_compensavel_mensal = decomposicao["tusd_compensavel"]["total"]
    economia_pis_mensal = decomposicao["pis"]["total"]
    economia_cofins_mensal = decomposicao["cofins"]["total"]
    economia_icms_mensal = decomposicao["icms"]["total"]
    economia_impostos_mensal = decomposicao["total_impostos"]
    
    # Economia detalhada por componente (anual)
    economia_te_anual = economia_te_mensal * 12
    economia_tusd_compensavel_anual = economia_tusd_compensavel_mensal * 12
    economia_pis_anual = economia_pis_mensal * 12
    economia_cofins_anual = economia_cofins_mensal * 12
    economia_icms_anual = economia_icms_mensal * 12
    economia_impostos_anual = economia_impostos_mensal * 12
    
    # Economia em 25 anos (simplificada, sem inflação)
    economia_25_anos_bruta = economia_mensal_bruta * 12 * 25
    economia_25_anos_real = economia_mensal_real * 12 * 25
    economia_impostos_25_anos = economia_impostos_mensal * 12 * 25
    
    # Custo total de TUSD Fio B em 25 anos (sempre pago)
    custo_tusd_fio_b_25_anos = custo_residual_mensal * 12 * 25

    return {
        # Economia conforme Lei 14.300
        "economia_mensal_real": round(economia_mensal_real, 2),
        "economia_mensal_bruta": round(economia_mensal_bruta, 2),
        "economia_liquida_mensal": round(economia_liquida_mensal, 2),
        "custo_residual_mensal": round(custo_residual_mensal, 2),
        "custo_manutencao_mensal": round(custo_manutencao_anual / 12, 2),
        
        # Valores anuais
        "economia_anual_real": round(economia_mensal_real * 12, 2),
        "economia_anual_bruta": round(economia_mensal_bruta * 12, 2),
        "economia_liquida_anual": round(economia_liquida_anual, 2),
        "custo_residual_anual": round(custo_residual_mensal * 12, 2),
        "custo_manutencao_anual": round(custo_manutencao_anual, 2),
        
        # Compatibilidade com modelo anterior
        "economia_mensal_estimada": round(economia_mensal_real, 2),
        "economia_anual_estimada": round(economia_mensal_real * 12, 2),
        "conta_atual_anual": conta_atual_anual,
        "preco_venda": preco_venda,
        
        # Payback
        "payback_meses": payback_meses_real,
        "payback_meses_real": payback_meses_real,
        "payback_meses_otimista": int(round(payback_meses_otimista)),
        "anos_payback": payback_anos_real,
        "anos_payback_real": payback_anos_real,
        "anos_payback_otimista": payback_anos_otimista,
        "gasto_acumulado_payback": gasto_acumulado_payback,
        
        # Decomposição da tarifa (Lei 14.300)
        "decomposicao_tarifa": decomposicao,
        "percentual_economia": decomposicao["percentual_economia"],
        "ano_referencia_lei14300": ano_referencia,
        
        # Economia por componente (mensal)
        "economia_te_mensal": round(economia_te_mensal, 2),
        "economia_tusd_compensavel_mensal": round(economia_tusd_compensavel_mensal, 2),
        "economia_tusd_mensal": round(economia_tusd_compensavel_mensal, 2),  # Compatibilidade
        "economia_pis_mensal": round(economia_pis_mensal, 2),
        "economia_cofins_mensal": round(economia_cofins_mensal, 2),
        "economia_icms_mensal": round(economia_icms_mensal, 2),
        "economia_impostos_mensal": round(economia_impostos_mensal, 2),
        
        # Economia por componente (anual)
        "economia_te_anual": round(economia_te_anual, 2),
        "economia_tusd_compensavel_anual": round(economia_tusd_compensavel_anual, 2),
        "economia_tusd_anual": round(economia_tusd_compensavel_anual, 2),  # Compatibilidade
        "economia_pis_anual": round(economia_pis_anual, 2),
        "economia_cofins_anual": round(economia_cofins_anual, 2),
        "economia_icms_anual": round(economia_icms_anual, 2),
        "economia_impostos_anual": round(economia_impostos_anual, 2),
        
        # Economia em 25 anos
        "economia_25_anos_bruta": round(economia_25_anos_bruta, 2),
        "economia_25_anos_real": round(economia_25_anos_real, 2),
        "economia_25_anos_simplificada": round(economia_25_anos_real, 2),  # Compatibilidade
        "economia_impostos_25_anos": round(economia_impostos_25_anos, 2),
        "custo_tusd_fio_b_25_anos": round(custo_tusd_fio_b_25_anos, 2),
    }

# ------------------------
# Tabelas 25 anos (Lei 14.300/2022)
# ------------------------
def calcular_tabelas_25_anos(consumo_kwh_mes: float,
                             tarifa_atual_r_kwh: float,
                             potencia_kwp: float,
                             irradiancia_mensal_kwh_m2_dia: List[float],
                             valor_usina: float,
                             *,
                             ano_instalacao: int = 2026,
                             taxa_crescimento_consumo_anual: float = 0.0034,
                             taxa_reajuste_tarifa_anual: float = 0.05,  # 5% (cenário realista)
                             taxa_degradacao_pv_anual: float = TAXA_DEGRADACAO_ANUAL_PADRAO,  # 0.75%
                             performance_ratio: float = 0.82,
                             demanda_min_kwh_mes: float = 50.0,
                             horizonte_anos: int = 25,
                             incluir_manutencao: bool = True,
                             incluir_substituicao_inversor: bool = True,
                             taxa_desconto_vpl: float = 0.08) -> Dict[str, List[float]]:
    """
    Calcula tabelas de 25 anos conforme Lei 14.300/2022.
    
    Inclui:
    - Degradação anual do sistema (0.75% padrão)
    - Custos de manutenção (1% ao ano)
    - Substituição do inversor (ano 12)
    - TUSD Fio B crescente conforme regra de transição
    - Economia real (apenas componentes compensáveis)
    - VPL (Valor Presente Líquido)
    """
    anos = list(range(1, horizonte_anos + 1))
    anos_calendario = [ano_instalacao + i - 1 for i in anos]  # Ex: 2026, 2027, 2028...
    
    consumo_mensal_kwh: List[float] = []
    tarifa_r_kwh: List[float] = []
    conta_media_mensal_r: List[float] = []

    for i, _ in enumerate(anos):
        if i == 0:
            c = consumo_kwh_mes
            t = tarifa_atual_r_kwh
        else:
            c = consumo_mensal_kwh[i - 1] * (1.0 + taxa_crescimento_consumo_anual)
            t = tarifa_r_kwh[i - 1] * (1.0 + taxa_reajuste_tarifa_anual)
        consumo_mensal_kwh.append(c)
        tarifa_r_kwh.append(t)
        conta_media_mensal_r.append(c * t)

    custo_anual_sem_solar_r: List[float] = [m * 12.0 for m in conta_media_mensal_r]
    custo_acumulado_sem_solar_r: List[float] = []
    acc = 0.0
    for v in custo_anual_sem_solar_r:
        acc += v
        custo_acumulado_sem_solar_r.append(acc)

    # Produção mensal (baseada diretamente na irradiância CSV mês a mês)
    try:
        dias_mes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        producao_mensal_kwh_ano1: List[float] = [
            potencia_kwp * float(irradiancia_mensal_kwh_m2_dia[m]) * dias_mes[m] * performance_ratio
            for m in range(12)
        ]
        producao_mensal_r_ano1: List[float] = [
            producao_mensal_kwh_ano1[m] * tarifa_r_kwh[0] for m in range(12)
        ]
    except Exception:
        producao_mensal_kwh_ano1 = []
        producao_mensal_r_ano1 = []

    # Produção anual com degradação (Lei 14.300: 0.75% ao ano recomendado)
    # Fórmula: Produção ano N = Produção ano 1 × (1 - taxa_degradacao)^(N-1)
    producao_anual_kwh: List[float] = []
    for i, _ in enumerate(anos):
        if i == 0:
            kwh_ano = sum(producao_mensal_kwh_ano1)
        else:
            fator_deg = (1.0 - taxa_degradacao_pv_anual) ** i
            kwh_ano = sum(v * fator_deg for v in producao_mensal_kwh_ano1)
        producao_anual_kwh.append(kwh_ano)

    # Taxa mínima de disponibilidade (50 kWh - custo fixo TUSD)
    taxa_distribuicao_anual_r: List[float] = []
    for i, _ in enumerate(anos):
        if i == 0:
            td = demanda_min_kwh_mes * tarifa_r_kwh[0] * 12.0
        else:
            td = taxa_distribuicao_anual_r[i - 1] * (1.0 + taxa_reajuste_tarifa_anual)
        taxa_distribuicao_anual_r.append(td)

    # =====================================
    # LEI 14.300/2022 - CÁLCULOS DETALHADOS
    # =====================================
    pis_aliquota = 0.0165
    cofins_aliquota = 0.076
    icms_aliquota = 0.18
    fator_impostos = 1 + pis_aliquota + cofins_aliquota + icms_aliquota
    
    # TUSD Fio B cobrada por ano (Lei 14.300 - regra de transição)
    tusd_fio_b_cobranca_por_ano = {
        2024: 0.15, 2025: 0.30, 2026: 0.45, 2027: 0.60, 2028: 0.75
    }
    
    # Listas para cálculos detalhados
    economia_te_anual_r: List[float] = []
    economia_tusd_compensavel_anual_r: List[float] = []
    custo_tusd_fio_b_anual_r: List[float] = []  # TUSD Fio B (não compensável)
    economia_pis_anual_r: List[float] = []
    economia_cofins_anual_r: List[float] = []
    economia_icms_anual_r: List[float] = []
    economia_impostos_anual_r: List[float] = []
    
    # Economia real (Lei 14.300) - apenas componentes compensáveis
    economia_anual_real_r: List[float] = []
    # Economia bruta (se 100% fosse compensável - para comparação)
    economia_anual_bruta_r: List[float] = []
    
    # Custos operacionais
    custo_manutencao_anual_r: List[float] = []
    custo_substituicao_inversor_r: List[float] = []
    
    for i in range(horizonte_anos):
        ano_calendario = anos_calendario[i]
        
        # Percentual de TUSD Fio B cobrada neste ano
        tusd_fio_b_pct = tusd_fio_b_cobranca_por_ano.get(ano_calendario, 0.90)
        tusd_compensavel_pct = 1.0 - tusd_fio_b_pct
        
        # Tarifa base (sem impostos)
        tarifa_base = tarifa_r_kwh[i] / fator_impostos
        
        # Componentes por kWh
        te_pct = 0.545
        tusd_pct = 0.455
        te_kwh = tarifa_base * te_pct
        tusd_kwh_total = tarifa_base * tusd_pct
        tusd_compensavel_kwh = tusd_kwh_total * tusd_compensavel_pct
        tusd_fio_b_kwh = tusd_kwh_total * tusd_fio_b_pct
        
        # Produção do ano em kWh
        prod_kwh = producao_anual_kwh[i]
        
        # Economia bruta (se 100% compensável)
        eco_bruta = prod_kwh * tarifa_r_kwh[i]
        economia_anual_bruta_r.append(round(eco_bruta, 2))
        
        # ECONOMIA REAL (Lei 14.300) - apenas componentes compensáveis
        # TE: 100% compensável
        eco_te = prod_kwh * te_kwh * fator_impostos  # TE + impostos sobre TE
        economia_te_anual_r.append(round(eco_te / fator_impostos * fator_impostos, 2))
        
        # TUSD compensável
        eco_tusd_comp = prod_kwh * tusd_compensavel_kwh * fator_impostos
        economia_tusd_compensavel_anual_r.append(round(eco_tusd_comp / fator_impostos * fator_impostos, 2))
        
        # TUSD Fio B (NÃO compensável - custo que permanece)
        custo_fio_b = prod_kwh * tusd_fio_b_kwh * fator_impostos
        custo_tusd_fio_b_anual_r.append(round(custo_fio_b, 2))
        
        # Impostos (proporcionais à economia compensável)
        base_compensavel = prod_kwh * (te_kwh + tusd_compensavel_kwh)
        eco_pis = base_compensavel * pis_aliquota
        eco_cofins = base_compensavel * cofins_aliquota
        eco_icms = base_compensavel * icms_aliquota
        eco_impostos = eco_pis + eco_cofins + eco_icms
        
        economia_pis_anual_r.append(round(eco_pis, 2))
        economia_cofins_anual_r.append(round(eco_cofins, 2))
        economia_icms_anual_r.append(round(eco_icms, 2))
        economia_impostos_anual_r.append(round(eco_impostos, 2))
        
        # Economia real total (TE + TUSD compensável + impostos)
        eco_real = (te_kwh + tusd_compensavel_kwh) * prod_kwh * fator_impostos
        economia_anual_real_r.append(round(eco_real, 2))
        
        # Custos operacionais
        if incluir_manutencao:
            custo_man = valor_usina * CUSTO_MANUTENCAO_ANUAL_PERCENTUAL * ((1 + taxa_reajuste_tarifa_anual) ** i)
        else:
            custo_man = 0
        custo_manutencao_anual_r.append(round(custo_man, 2))
        
        # Substituição do inversor (geralmente ano 12)
        if incluir_substituicao_inversor and i + 1 == ANO_SUBSTITUICAO_INVERSOR:
            custo_inv = valor_usina * CUSTO_SUBSTITUICAO_INVERSOR_PERCENTUAL
        else:
            custo_inv = 0
        custo_substituicao_inversor_r.append(round(custo_inv, 2))
    
    # Compatibilidade com modelo anterior
    economia_tusd_anual_r = economia_tusd_compensavel_anual_r
    producao_anual_r: List[float] = economia_anual_bruta_r  # Para compatibilidade
    
    # Custo anual COM solar (taxa mínima + TUSD Fio B não compensável + manutenção)
    custo_anual_com_solar_r: List[float] = [
        taxa_distribuicao_anual_r[i] + custo_tusd_fio_b_anual_r[i] + custo_manutencao_anual_r[i] + custo_substituicao_inversor_r[i]
        for i in range(horizonte_anos)
    ]
    custo_acumulado_com_solar_r: List[float] = []
    acc2 = 0.0
    for v in custo_anual_com_solar_r:
        acc2 += v
        custo_acumulado_com_solar_r.append(acc2)

    # Economia anual real (sem solar - com solar)
    economia_anual_r: List[float] = [
        custo_anual_sem_solar_r[i] - custo_anual_com_solar_r[i] for i in range(horizonte_anos)
    ]

    # Economia líquida anual (considerando todos os custos)
    economia_liquida_anual_r: List[float] = [
        economia_anual_real_r[i] - custo_manutencao_anual_r[i] - custo_substituicao_inversor_r[i]
        for i in range(horizonte_anos)
    ]

    # Fluxo de caixa anual (Lei 14.300)
    # FC = Economia Real - Custos operacionais - CAPEX (ano 0)
    fluxo_caixa_anual_r: List[float] = []
    for i, _ in enumerate(anos):
        inv = valor_usina if i == 0 else 0.0
        cf = -inv + economia_liquida_anual_r[i]
        fluxo_caixa_anual_r.append(cf)
    
    fluxo_caixa_acumulado_r: List[float] = []
    acc3 = 0.0
    for v in fluxo_caixa_anual_r:
        acc3 += v
        fluxo_caixa_acumulado_r.append(acc3)
    
    # VPL - Valor Presente Líquido
    # VPL = Σ (FC_N / (1 + i)^N) - Investimento Inicial
    vpl_anual_r: List[float] = []
    vpl_acumulado = -valor_usina  # Investimento inicial (negativo)
    for i in range(horizonte_anos):
        fc_descontado = economia_liquida_anual_r[i] / ((1 + taxa_desconto_vpl) ** (i + 1))
        vpl_acumulado += fc_descontado
        vpl_anual_r.append(round(vpl_acumulado, 2))
    
    # Totais acumulados
    economia_impostos_acumulada_r: List[float] = []
    economia_real_acumulada_r: List[float] = []
    economia_bruta_acumulada_r: List[float] = []
    custo_tusd_fio_b_acumulado_r: List[float] = []
    
    acc_imp = 0.0
    acc_real = 0.0
    acc_bruta = 0.0
    acc_fio_b = 0.0
    for i in range(horizonte_anos):
        acc_imp += economia_impostos_anual_r[i]
        acc_real += economia_anual_real_r[i]
        acc_bruta += economia_anual_bruta_r[i]
        acc_fio_b += custo_tusd_fio_b_anual_r[i]
        economia_impostos_acumulada_r.append(round(acc_imp, 2))
        economia_real_acumulada_r.append(round(acc_real, 2))
        economia_bruta_acumulada_r.append(round(acc_bruta, 2))
        custo_tusd_fio_b_acumulado_r.append(round(acc_fio_b, 2))

    return {
        "ano": anos,
        "ano_calendario": anos_calendario,
        "consumo_mensal_kwh": consumo_mensal_kwh,
        "tarifa_r_kwh": tarifa_r_kwh,
        "conta_media_mensal_r": conta_media_mensal_r,
        "custo_anual_sem_solar_r": custo_anual_sem_solar_r,
        "custo_acumulado_sem_solar_r": custo_acumulado_sem_solar_r,
        "producao_anual_kwh": producao_anual_kwh,
        "producao_anual_r": producao_anual_r,
        "producao_mensal_kwh_ano1": producao_mensal_kwh_ano1,
        "producao_mensal_r_ano1": producao_mensal_r_ano1,
        "taxa_distribuicao_anual_r": taxa_distribuicao_anual_r,
        "custo_anual_com_solar_r": custo_anual_com_solar_r,
        "custo_acumulado_com_solar_r": custo_acumulado_com_solar_r,
        "economia_anual_r": economia_anual_r,
        "fluxo_caixa_anual_r": fluxo_caixa_anual_r,
        "fluxo_caixa_acumulado_r": fluxo_caixa_acumulado_r,
        # Lei 14.300/2022 - Decomposição detalhada
        "economia_anual_real_r": economia_anual_real_r,
        "economia_anual_bruta_r": economia_anual_bruta_r,
        "economia_liquida_anual_r": economia_liquida_anual_r,
        "economia_real_acumulada_r": economia_real_acumulada_r,
        "economia_bruta_acumulada_r": economia_bruta_acumulada_r,
        # Decomposição da economia por componente
        "economia_te_anual_r": economia_te_anual_r,
        "economia_tusd_compensavel_anual_r": economia_tusd_compensavel_anual_r,
        "economia_tusd_anual_r": economia_tusd_anual_r,  # Compatibilidade
        "custo_tusd_fio_b_anual_r": custo_tusd_fio_b_anual_r,
        "custo_tusd_fio_b_acumulado_r": custo_tusd_fio_b_acumulado_r,
        "economia_pis_anual_r": economia_pis_anual_r,
        "economia_cofins_anual_r": economia_cofins_anual_r,
        "economia_icms_anual_r": economia_icms_anual_r,
        "economia_impostos_anual_r": economia_impostos_anual_r,
        "economia_impostos_acumulada_r": economia_impostos_acumulada_r,
        # Custos operacionais
        "custo_manutencao_anual_r": custo_manutencao_anual_r,
        "custo_substituicao_inversor_r": custo_substituicao_inversor_r,
        # VPL
        "vpl_anual_r": vpl_anual_r,
        "vpl_final": vpl_anual_r[-1] if vpl_anual_r else 0,
        # Parâmetros utilizados
        "parametros_lei14300": {
            "ano_instalacao": ano_instalacao,
            "taxa_degradacao_anual": taxa_degradacao_pv_anual,
            "taxa_reajuste_tarifa": taxa_reajuste_tarifa_anual,
            "taxa_desconto_vpl": taxa_desconto_vpl,
            "custo_manutencao_percentual": CUSTO_MANUTENCAO_ANUAL_PERCENTUAL,
            "ano_substituicao_inversor": ANO_SUBSTITUICAO_INVERSOR,
            "custo_substituicao_inversor_percentual": CUSTO_SUBSTITUICAO_INVERSOR_PERCENTUAL,
        },
    }

# ------------------------
# Orquestrador
# ------------------------
def calcular_dimensionamento(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ponto único para calcular (Lei 14.300/2022):
      - KPIs com economia REAL (apenas componentes compensáveis)
      - Tabelas 25 anos com degradação, custos e Lei 14.300
      - VPL (Valor Presente Líquido)
    Retorna {"metrics": {...}, "tabelas": {...}}.
    """
    kpis = calcular_kpis(payload)

    # Preparar dados para tabelas (se possível)
    consumo_kwh = _to_float(payload.get('consumo_mensal_kwh', 0), 0.0)
    if consumo_kwh <= 0:
        # Derivar de R$ quando possível
        consumo_reais = _to_float(payload.get('consumo_mensal_reais', 0), 0.0)
        tarifa = _to_float(payload.get('tarifa_energia', 0), 0.0)
        if consumo_reais > 0 and tarifa > 0:
            consumo_kwh = consumo_reais / tarifa

    tarifa_kwh = _to_float(payload.get('tarifa_energia', 0), 0.0)
    potencia_kwp = _to_float(payload.get('potencia_sistema', payload.get('potencia_kwp', 0)), 0.0)
    irr_vec = payload.get('irradiancia_mensal_kwh_m2_dia')
    if not (isinstance(irr_vec, list) and len(irr_vec) == 12):
        media = _to_float(payload.get('irradiacao_media', 5.15), 5.15)
        irr_vec = [media] * 12
    preco_venda = _to_float(payload.get('preco_venda', payload.get('preco_final', 0)), 0.0)
    
    # Parâmetros Lei 14.300/2022
    ano_instalacao = int(payload.get('ano_instalacao', 2026))
    taxa_reajuste_tarifa = _to_float(payload.get('taxa_reajuste_tarifa', 0.05), 0.05)  # 5% padrão
    taxa_degradacao = _to_float(payload.get('taxa_degradacao', TAXA_DEGRADACAO_ANUAL_PADRAO), TAXA_DEGRADACAO_ANUAL_PADRAO)
    incluir_manutencao = payload.get('incluir_manutencao', True)
    incluir_substituicao_inversor = payload.get('incluir_substituicao_inversor', True)
    taxa_desconto_vpl = _to_float(payload.get('taxa_desconto_vpl', 0.08), 0.08)

    tabelas = {}
    if consumo_kwh > 0 and tarifa_kwh > 0 and potencia_kwp > 0 and preco_venda > 0:
        tabelas = calcular_tabelas_25_anos(
            consumo_kwh_mes=consumo_kwh,
            tarifa_atual_r_kwh=tarifa_kwh,
            potencia_kwp=potencia_kwp,
            irradiancia_mensal_kwh_m2_dia=irr_vec,
            valor_usina=preco_venda,
            ano_instalacao=ano_instalacao,
            taxa_reajuste_tarifa_anual=taxa_reajuste_tarifa,
            taxa_degradacao_pv_anual=taxa_degradacao,
            incluir_manutencao=incluir_manutencao,
            incluir_substituicao_inversor=incluir_substituicao_inversor,
            taxa_desconto_vpl=taxa_desconto_vpl,
        )
        # Se houver fluxo de caixa acumulado, calcular payback por cruzamento do zero
        try:
            fca = tabelas.get("fluxo_caixa_acumulado_r") or []
            if isinstance(fca, list) and len(fca) > 0:
                payback_fluxo_anos = 0.0
                for idx, v in enumerate(fca):
                    if v >= 0:
                        if idx == 0:
                            # já positivo no ano 1
                            payback_fluxo_anos = 0.0 if fca[0] == 0 else min(1.0, 0.0)
                        else:
                            v_prev = fca[idx - 1]
                            v_curr = v
                            # Interpolação linear entre os anos (idx-1 -> idx)
                            # anos são base 1, portanto o ano anterior é (idx) e o atual é (idx+1)
                            # fração dentro do intervalo:
                            denom = (v_curr - v_prev)
                            frac = 0.0 if denom == 0 else (-v_prev) / denom
                            payback_fluxo_anos = (idx) + frac  # idx é ano anterior (base 1) porque lista começa em 0
                        break
                if payback_fluxo_anos >= 0:
                    # Sempre usar o payback do fluxo de caixa como referência principal
                    kpis["anos_payback_fluxo"] = round(payback_fluxo_anos, 1)
                    kpis["payback_meses_fluxo"] = int(round(payback_fluxo_anos * 12))
                    kpis["anos_payback"] = kpis["anos_payback_fluxo"]
                    kpis["payback_meses"] = kpis["payback_meses_fluxo"]
                    # Recalcular gasto acumulado usando o payback do fluxo (consistência visual)
                    try:
                        conta_atual_anual = float(kpis.get("conta_atual_anual", 0) or 0)
                        anos_pb = float(kpis.get("anos_payback", 0) or 0)
                        kpis["gasto_acumulado_payback"] = conta_atual_anual * anos_pb if (conta_atual_anual > 0 and anos_pb > 0) else 0.0
                    except Exception:
                        pass
        except Exception:
            # Não falhar se interpolação falhar
            pass

    # Expor também entradas normalizadas úteis para o frontend
    try:
        kpis["consumo_medio_kwh_mes"] = float(consumo_kwh)
    except Exception:
        kpis["consumo_medio_kwh_mes"] = 0.0
    try:
        kpis["tarifa_energia"] = float(tarifa_kwh)
    except Exception:
        pass

    return {"metrics": kpis, "tabelas": tabelas}


