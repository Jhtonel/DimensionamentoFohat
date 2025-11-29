#!/usr/bin/env python3
"""
dimensionamento_core.py
=======================
Fonte ÚNICA da verdade para o dimensionamento, KPIs financeiros e (opcionalmente)
as tabelas/gráficos usados na proposta.

Objetivos:
- Reproduzir as regras da planilha (prompt único) para valores de proposta
- Gerar as mesmas métricas usadas na aba de custos (payback = preço venda / economia mensal)
- Fornecer, quando necessário, as tabelas de 25 anos e gráficos base64
"""
from __future__ import annotations

from typing import Dict, List, Any, Optional
from math import isfinite
import math

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
# Cálculos de KPIs (planilha)
# ------------------------
def calcular_kpis(payload: Dict[str, Any]) -> Dict[str, float]:
    """
    KPIs alinhados com a aba de custos e com a planilha:
      - economia_mensal_estimada: consumo em R$/mês (se enviado), senão kWh*tarifa
      - conta_atual_anual: consumo (R$ ou kWh*tarifa) * 12
      - payback_meses: preco_venda / economia_mensal_estimada
      - payback_anos: payback_meses / 12
      - gasto_acumulado_payback: conta_atual_anual * payback_anos
    """
    consumo_reais = _to_float(payload.get('consumo_mensal_reais', 0), 0.0)
    consumo_kwh = _to_float(payload.get('consumo_mensal_kwh', 0), 0.0)
    tarifa = _to_float(payload.get('tarifa_energia', payload.get('tarifa_kwh', 0)), 0.0)
    preco_venda = _to_float(payload.get('preco_venda', payload.get('preco_final', 0)), 0.0)

    # Converter kWh quando veio apenas R$
    if consumo_kwh <= 0 and consumo_reais > 0 and tarifa > 0:
        consumo_kwh = consumo_reais / tarifa

    # Economia mensal (planilha): se houver em R$, é o valor; senão kWh*tarifa
    if consumo_reais > 0:
        economia_mensal = consumo_reais
    else:
        economia_mensal = consumo_kwh * tarifa

    conta_atual_anual = (consumo_reais * 12.0) if consumo_reais > 0 else (consumo_kwh * tarifa * 12.0)
    conta_atual_anual = conta_atual_anual if isfinite(conta_atual_anual) else 0.0

    payback_meses = (preco_venda / economia_mensal) if (preco_venda > 0 and economia_mensal > 0) else 0.0
    payback_anos = payback_meses / 12.0 if payback_meses > 0 else 0.0
    # Arredondamentos conforme padrões visuais usados
    payback_anos = round(payback_anos, 1)
    payback_meses = int(round(payback_meses))

    gasto_acumulado_payback = conta_atual_anual * payback_anos if (conta_atual_anual > 0 and payback_anos > 0) else 0.0

    return {
        "economia_mensal_estimada": economia_mensal,
        "economia_anual_estimada": economia_mensal * 12.0,
        "conta_atual_anual": conta_atual_anual,
        "preco_venda": preco_venda,
        "payback_meses": payback_meses,
        "anos_payback": payback_anos,
        "gasto_acumulado_payback": gasto_acumulado_payback,
    }

# ------------------------
# Tabelas 25 anos (simplificadas, compatíveis com o backend anterior)
# ------------------------
def calcular_tabelas_25_anos(consumo_kwh_mes: float,
                             tarifa_atual_r_kwh: float,
                             potencia_kwp: float,
                             irradiancia_mensal_kwh_m2_dia: List[float],
                             valor_usina: float,
                             *,
                             taxa_crescimento_consumo_anual: float = 0.0034,
                             taxa_reajuste_tarifa_anual: float = 0.0484,
                             taxa_degradacao_pv_anual: float = 0.008,
                             performance_ratio: float = 0.82,
                             demanda_min_kwh_mes: float = 50.0,
                             horizonte_anos: int = 25) -> Dict[str, List[float]]:
    anos = list(range(1, horizonte_anos + 1))
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
        # dias de cada mês (não considera bissexto; suficiente para projeção)
        dias_mes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        # kWh do ano 1 por mês: P[kWp] × irradiância_mensal[kWh/m²/dia] × dias × PR
        producao_mensal_kwh_ano1: List[float] = [
            potencia_kwp * float(irradiancia_mensal_kwh_m2_dia[m]) * dias_mes[m] * performance_ratio
            for m in range(12)
        ]
        producao_mensal_r_ano1: List[float] = [
            producao_mensal_kwh_ano1[m] * tarifa_r_kwh[0] for m in range(12)
        ]
    except Exception:
        # fallback seguro
        producao_mensal_kwh_ano1 = []
        producao_mensal_r_ano1 = []

    # Produção anual: soma do mês a mês (ano 1) e aplicação da degradação anual
    producao_anual_kwh: List[float] = []
    for i, _ in enumerate(anos):
        if i == 0:
            kwh_ano = sum(producao_mensal_kwh_ano1)
        else:
            fator_deg = (1.0 - taxa_degradacao_pv_anual) ** i
            kwh_ano = sum(v * fator_deg for v in producao_mensal_kwh_ano1)
        producao_anual_kwh.append(kwh_ano)
    producao_anual_r: List[float] = [producao_anual_kwh[i] * tarifa_r_kwh[i] for i in range(horizonte_anos)]

    taxa_distribuicao_anual_r: List[float] = []
    for i, _ in enumerate(anos):
        if i == 0:
            td = demanda_min_kwh_mes * tarifa_r_kwh[0] * 12.0
        else:
            td = taxa_distribuicao_anual_r[i - 1] * (1.0 + taxa_reajuste_tarifa_anual)
        taxa_distribuicao_anual_r.append(td)

    custo_anual_com_solar_r: List[float] = list(taxa_distribuicao_anual_r)
    custo_acumulado_com_solar_r: List[float] = []
    acc2 = 0.0
    for v in custo_anual_com_solar_r:
        acc2 += v
        custo_acumulado_com_solar_r.append(acc2)

    economia_anual_r: List[float] = [
        custo_anual_sem_solar_r[i] - custo_anual_com_solar_r[i] for i in range(horizonte_anos)
    ]

    # Fluxo de caixa anual simplificado: receita (produção em R$) - taxa de distribuição - CAPEX (no ano 1)
    fluxo_caixa_anual_r: List[float] = []
    for i, _ in enumerate(anos):
        inv = valor_usina if i == 0 else 0.0
        cf = -inv + producao_anual_r[i] - taxa_distribuicao_anual_r[i]
        fluxo_caixa_anual_r.append(cf)
    fluxo_caixa_acumulado_r: List[float] = []
    acc3 = 0.0
    for v in fluxo_caixa_anual_r:
        acc3 += v
        fluxo_caixa_acumulado_r.append(acc3)

    return {
        "ano": anos,
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
    }

# ------------------------
# Orquestrador
# ------------------------
def calcular_dimensionamento(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ponto único para calcular:
      - KPIs (planilha) usados na aba de custos e proposta
      - Tabelas 25 anos (quando houver dados suficientes)
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

    tabelas = {}
    if consumo_kwh > 0 and tarifa_kwh > 0 and potencia_kwp > 0 and preco_venda > 0:
        tabelas = calcular_tabelas_25_anos(
            consumo_kwh_mes=consumo_kwh,
            tarifa_atual_r_kwh=tarifa_kwh,
            potencia_kwp=potencia_kwp,
            irradiancia_mensal_kwh_m2_dia=irr_vec,
            valor_usina=preco_venda,
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


