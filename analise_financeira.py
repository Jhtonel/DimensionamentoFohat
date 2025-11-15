#!/usr/bin/env python3
"""
Análise Financeira e Geração de Gráficos para Proposta Solar
============================================================

Este módulo calcula as tabelas financeiras (25 anos) e gera 5 gráficos
conforme especificação, usando apenas bibliotecas padrão + pandas + matplotlib.

Execução:
    python analise_financeira.py
Gera:
    grafico1.png ... grafico5.png
"""

from typing import Dict, List, Optional
import os
import math
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # backend não interativo para geração de imagens
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

# =========================
# CONSTANTES CONFIGURÁVEIS
# =========================
# Deixe fácil de ajustar aqui:
taxa_crescimento_consumo_anual: float = 0.0034     # 0,34% a.a.
taxa_reajuste_tarifa_anual: float = 0.0484         # 4,84% a.a. (planilha D52)
taxa_degradacao_pv_anual: float = 0.008            # 0,8% a.a.
performance_ratio: float = 0.82                    # PR típico de usinas FV
demanda_minima_kwh_mes: float = 50.0               # kWh/mês (taxa de disponibilidade)
HORIZONTE_ANOS: int = 25                           # horizonte fixo: 25 anos

# Paleta de cores usada nos gráficos
COR_VERMELHO: str = "#CC0000"
COR_VERDE: str = "#00B398"
COR_LARANJA: str = "#F58634"

# Meses (para Tabela 2.3 / Gráfico 3)
MESES_PT: List[str] = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
                       "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

# =========================
# PARÂMETROS DE EXEMPLO
# =========================
# Ajuste estes valores no topo para testar rapidamente em qualquer ambiente.
consumo_medio_kwh_mes_ex: float = 300.0
tarifa_atual_r_kwh_ex: float = 0.75
potencia_kwp_ex: float = 3.0
# Irradiância média diária por mês (kWh/m²/dia). Exemplo genérico Sudeste-BR.
irradiancia_mensal_kwh_m2_dia_ex: List[float] = [
    5.50, 5.30, 5.00, 4.80, 4.60, 4.30,
    4.40, 4.80, 5.00, 5.20, 5.40, 5.50
]
valor_usina_ex: float = 27000.0


# =========================
# UTILITÁRIOS
# =========================
def formatar_moeda_brl(valor: float) -> str:
    """Formata número em estilo brasileiro: R$ 1.234,56."""
    if valor is None or (isinstance(valor, float) and (math.isnan(valor) or math.isinf(valor))):
        return "R$ 0,00"
    try:
        # Usa locale-like com troca de separadores para BR
        return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return f"R$ {valor:.2f}".replace(".", ",")


def brl_formatter() -> FuncFormatter:
    """Retorna um formatador de eixo Y para Matplotlib em BRL."""
    def _fmt(x, pos):
        return formatar_moeda_brl(x)
    return FuncFormatter(_fmt)


# =========================
# CÁLCULO DAS TABELAS (25 anos)
# =========================
def calcular_tabelas(
    consumo_medio_kwh_mes: float,
    tarifa_atual_r_kwh: float,
    potencia_kwp: float,
    irradiancia_mensal_kwh_m2_dia: List[float],
    valor_usina: float,
    *,
    taxa_cresc_cons_a: float = taxa_crescimento_consumo_anual,
    taxa_reaj_tarifa_a: float = taxa_reajuste_tarifa_anual,
    taxa_degrad_pv_a: float = taxa_degradacao_pv_anual,
    pr: float = performance_ratio,
    demanda_min_kwh_mes: float = demanda_minima_kwh_mes,
    horizonte_anos: int = HORIZONTE_ANOS
) -> Dict[str, pd.DataFrame]:
    """
    Monta as 5 tabelas internas exigidas, retornando DataFrames:
    - sem_solar
    - custo_sem_solar
    - producao_mensal
    - producao_anual
    - fluxo_caixa
    """
    anos = list(range(1, horizonte_anos + 1))

    # 2.1. Tabela “Cenário sem energia solar”
    consumo_mensal_kwh: List[float] = []
    tarifa_r_kwh: List[float] = []
    conta_media_mensal_r: List[float] = []
    for i, ano in enumerate(anos):
        if i == 0:
            c = consumo_medio_kwh_mes
            t = tarifa_atual_r_kwh
        else:
            c = consumo_mensal_kwh[i - 1] * (1.0 + taxa_cresc_cons_a)
            t = tarifa_r_kwh[i - 1] * (1.0 + taxa_reaj_tarifa_a)
        consumo_mensal_kwh.append(c)
        tarifa_r_kwh.append(t)
        conta_media_mensal_r.append(c * t)

    df_sem_solar = pd.DataFrame({
        "ano": anos,
        "consumo_mensal_kwh": consumo_mensal_kwh,
        "tarifa_r_kwh": tarifa_r_kwh,
        "conta_media_mensal_r": conta_media_mensal_r
    })

    # 2.2. Tabela “Custo acumulado sem energia solar”
    custo_anual_sem_solar_r: List[float] = [m * 12.0 for m in conta_media_mensal_r]
    custo_acumulado_sem_solar_r: List[float] = list(pd.Series(custo_anual_sem_solar_r).cumsum())
    investimento: List[float] = [0.0] * horizonte_anos
    investimento[0] = valor_usina  # somente no ano 1

    df_custo_sem_solar = pd.DataFrame({
        "ano": anos,
        "investimento": investimento,
        "custo_anual_sem_solar_r": custo_anual_sem_solar_r,
        "custo_acumulado_sem_solar_r": custo_acumulado_sem_solar_r
    })

    # 2.3. Tabela “Produção mensal x consumo mensal em R$”
    # Produção mensal kWh = kWp * irr_mensal (kWh/m²/dia) * 30,4 * PR
    producao_mensal_kwh: List[float] = [
        potencia_kwp * irr * 30.4 * pr for irr in irradiancia_mensal_kwh_m2_dia
    ]
    producao_mensal_r: List[float] = [k * tarifa_atual_r_kwh for k in producao_mensal_kwh]
    consumo_medio_mensal_r: List[float] = [consumo_medio_kwh_mes * tarifa_atual_r_kwh for _ in range(12)]

    df_producao_mensal = pd.DataFrame({
        "mes": MESES_PT,
        "producao_mensal_kwh": producao_mensal_kwh,
        "producao_mensal_r": producao_mensal_r,
        "consumo_medio_mensal_r": consumo_medio_mensal_r
    })

    # 2.4. Tabela “Produção anual”
    # irradiância anual (kWh/m²/ano) aproximada pela soma (irr_diária_mês * 30,4)
    irradiancia_anual_kwh_m2_ano: float = sum(irradiancia_mensal_kwh_m2_dia) * 30.4
    producao_anual_kwh: List[float] = []
    for i, _ano in enumerate(anos):
        if i == 0:
            kwh = potencia_kwp * irradiancia_anual_kwh_m2_ano * pr
        else:
            kwh = producao_anual_kwh[i - 1] * (1.0 - taxa_degrad_pv_a)
        producao_anual_kwh.append(kwh)

    producao_anual_r: List[float] = [producao_anual_kwh[i] * tarifa_r_kwh[i] for i in range(horizonte_anos)]

    taxa_distribuicao_anual_r: List[float] = []
    for i, _ano in enumerate(anos):
        if i == 0:
            td = demanda_min_kwh_mes * tarifa_r_kwh[0] * 12.0
        else:
            td = taxa_distribuicao_anual_r[i - 1] * (1.0 + taxa_reaj_tarifa_a)
        taxa_distribuicao_anual_r.append(td)

    custo_anual_com_solar_r: List[float] = list(taxa_distribuicao_anual_r)  # conforme regra
    custo_acumulado_com_solar_r: List[float] = list(pd.Series(custo_anual_com_solar_r).cumsum())
    economia_anual_r: List[float] = [
        custo_anual_sem_solar_r[i] - custo_anual_com_solar_r[i] for i in range(horizonte_anos)
    ]

    df_producao_anual = pd.DataFrame({
        "ano": anos,
        "producao_anual_kwh": producao_anual_kwh,
        "producao_anual_r": producao_anual_r,
        "taxa_distribuicao_anual_r": taxa_distribuicao_anual_r,
        "custo_anual_com_solar_r": custo_anual_com_solar_r,
        "custo_acumulado_com_solar_r": custo_acumulado_com_solar_r,
        "economia_anual_r": economia_anual_r
    })

    # 2.5. Tabela “Fluxo de Caixa”
    fluxo_caixa_anual_r: List[float] = []
    for i, _ano in enumerate(anos):
        inv = investimento[i]
        cf = -inv + producao_anual_r[i] - taxa_distribuicao_anual_r[i]
        fluxo_caixa_anual_r.append(cf)
    fluxo_caixa_acumulado_r: List[float] = list(pd.Series(fluxo_caixa_anual_r).cumsum())
    fluxo_caixa_pos_r: List[float] = [v if v > 0 else 0.0 for v in fluxo_caixa_acumulado_r]
    fluxo_caixa_neg_r: List[float] = [v if v < 0 else 0.0 for v in fluxo_caixa_acumulado_r]
    economia_acumulada_r: List[float] = list(fluxo_caixa_acumulado_r)
    custos_sem_solar_neg_r: List[float] = [-v for v in custo_acumulado_sem_solar_r]

    df_fluxo_caixa = pd.DataFrame({
        "ano": anos,
        "fluxo_caixa_anual_r": fluxo_caixa_anual_r,
        "fluxo_caixa_acumulado_r": fluxo_caixa_acumulado_r,
        "fluxo_caixa_pos_r": fluxo_caixa_pos_r,
        "fluxo_caixa_neg_r": fluxo_caixa_neg_r,
        "economia_acumulada_r": economia_acumulada_r,
        "custos_sem_solar_neg_r": custos_sem_solar_neg_r
    })

    return {
        "sem_solar": df_sem_solar,
        "custo_sem_solar": df_custo_sem_solar,
        "producao_mensal": df_producao_mensal,
        "producao_anual": df_producao_anual,
        "fluxo_caixa": df_fluxo_caixa
    }


# =========================
# GERAÇÃO DOS GRÁFICOS
# =========================
def _salvar_fig(fig: plt.Figure, caminho: str):
    os.makedirs(os.path.dirname(os.path.abspath(caminho)), exist_ok=True)
    fig.savefig(caminho, dpi=150, bbox_inches="tight")
    plt.close(fig)


def plotar_graficos(tabelas: Dict[str, pd.DataFrame], pasta_saida: Optional[str] = None, mostrar: bool = False):
    """
    Gera e salva 5 gráficos (grafico1.png..grafico5.png).
    """
    if pasta_saida is None:
        pasta_saida = "."
    yfmt = brl_formatter()

    # Gráfico 1 – Custo acumulado sem solar (barras vermelhas)
    df_custo = tabelas["custo_sem_solar"]
    fig1, ax1 = plt.subplots(figsize=(12, 6))
    ax1.bar(df_custo["ano"], df_custo["custo_acumulado_sem_solar_r"], color=COR_VERMELHO)
    ax1.set_title("Custo acumulado de energia sem energia solar")
    ax1.set_xlabel("Ano")
    ax1.set_ylabel("R$")
    ax1.yaxis.set_major_formatter(yfmt)
    # Rótulos de dados
    for x, y in zip(df_custo["ano"], df_custo["custo_acumulado_sem_solar_r"]):
        ax1.text(x, y * 1.01 if y >= 0 else y * 0.99, formatar_moeda_brl(y),
                 ha="center", va="bottom" if y >= 0 else "top", fontsize=9, rotation=0)
    fig1.tight_layout()
    _salvar_fig(fig1, os.path.join(pasta_saida, "grafico1.png"))
    if mostrar:
        plt.show()

    # Gráfico 2 – Conta média mensal (linha laranja)
    df_sem = tabelas["sem_solar"]
    fig2, ax2 = plt.subplots(figsize=(12, 6))
    ax2.plot(df_sem["ano"], df_sem["conta_media_mensal_r"], color=COR_LARANJA, marker="o")
    ax2.set_title("Evolução da conta média mensal de energia")
    ax2.set_xlabel("Ano")
    ax2.set_ylabel("R$")
    ax2.yaxis.set_major_formatter(yfmt)
    for x, y in zip(df_sem["ano"], df_sem["conta_media_mensal_r"]):
        ax2.annotate(formatar_moeda_brl(y), (x, y), textcoords="offset points", xytext=(0, 8),
                     ha="center", fontsize=9)
    fig2.tight_layout()
    _salvar_fig(fig2, os.path.join(pasta_saida, "grafico2.png"))
    if mostrar:
        plt.show()

    # Gráfico 3 – Produção mensal x Consumo médio mensal (barras agrupadas)
    df_pm = tabelas["producao_mensal"]
    x = range(len(df_pm))
    width = 0.40
    fig3, ax3 = plt.subplots(figsize=(12, 6))
    ax3.bar([i - width / 2 for i in x], df_pm["producao_mensal_r"], width=width, color=COR_VERDE, label="Produção Mensal R$")
    ax3.bar([i + width / 2 for i in x], df_pm["consumo_medio_mensal_r"], width=width, color=COR_VERMELHO, label="Consumo Médio Mensal R$")
    ax3.set_title("Produção mensal estimada x Consumo médio mensal")
    ax3.set_xlabel("Mês")
    ax3.set_ylabel("R$")
    ax3.set_xticks(list(x))
    ax3.set_xticklabels(df_pm["mes"])
    ax3.yaxis.set_major_formatter(yfmt)
    ax3.legend()
    fig3.tight_layout()
    _salvar_fig(fig3, os.path.join(pasta_saida, "grafico3.png"))
    if mostrar:
        plt.show()

    # Gráfico 4 – Fluxo de caixa acumulado (barras pos/neg)
    df_fx = tabelas["fluxo_caixa"]
    fig4, ax4 = plt.subplots(figsize=(12, 6))
    ax4.bar(df_fx["ano"], df_fx["fluxo_caixa_pos_r"], color=COR_VERDE, label="Positivo")
    ax4.bar(df_fx["ano"], df_fx["fluxo_caixa_neg_r"], color=COR_VERMELHO, label="Negativo")
    ax4.axhline(0, color="black", linewidth=1)
    ax4.set_title("Fluxo de caixa acumulado do projeto")
    ax4.set_xlabel("Ano")
    ax4.set_ylabel("R$")
    ax4.yaxis.set_major_formatter(yfmt)
    # Rótulos nos topos (ou bases)
    for x, pos, neg in zip(df_fx["ano"], df_fx["fluxo_caixa_pos_r"], df_fx["fluxo_caixa_neg_r"]):
        if pos > 0:
            ax4.text(x, pos * 1.01, formatar_moeda_brl(pos), ha="center", va="bottom", fontsize=9)
        if neg < 0:
            ax4.text(x, neg * 1.01, formatar_moeda_brl(neg), ha="center", va="top", fontsize=9)
    ax4.legend()
    fig4.tight_layout()
    _salvar_fig(fig4, os.path.join(pasta_saida, "grafico4.png"))
    if mostrar:
        plt.show()

    # Gráfico 5 – Economia (linha verde) x Custos sem solar (linha vermelha negativa)
    fig5, ax5 = plt.subplots(figsize=(12, 6))
    ax5.plot(df_fx["ano"], df_fx["economia_acumulada_r"], color=COR_VERDE, marker="o", label="Economia com Energia Solar")
    ax5.plot(df_fx["ano"], df_fx["custos_sem_solar_neg_r"], color=COR_VERMELHO, marker="o", label="Custos sem Energia Solar")
    ax5.axhline(0, color="black", linewidth=1)
    ax5.set_title("Economia com energia solar x custos sem energia solar")
    ax5.set_xlabel("Ano")
    ax5.set_ylabel("R$")
    ax5.yaxis.set_major_formatter(yfmt)
    ax5.legend()
    # Rótulos em pontos-chave (ano 1, 10, 20, 25) da série verde
    anos_chave = {1, 10, 20, 25}
    for x, y in zip(df_fx["ano"], df_fx["economia_acumulada_r"]):
        if x in anos_chave:
            ax5.annotate(formatar_moeda_brl(y), (x, y), textcoords="offset points", xytext=(0, 8),
                         ha="center", fontsize=9)
    fig5.tight_layout()
    _salvar_fig(fig5, os.path.join(pasta_saida, "grafico5.png"))
    if mostrar:
        plt.show()


# =========================
# EXECUÇÃO EXEMPLO (CLI)
# =========================
def _fig_to_data_uri(fig: plt.Figure) -> str:
    import io, base64
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    buf.seek(0)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    plt.close(fig)
    return f"data:image/png;base64,{b64}"


def gerar_graficos_base64(tabelas: Dict[str, pd.DataFrame]) -> Dict[str, str]:
    """
    Gera os 5 gráficos como imagens base64 (data URI) e retorna em um dicionário:
    - grafico1: Custo acumulado sem solar (barras vermelhas)
    - grafico2: Conta média mensal (linha laranja)
    - grafico3: Produção mensal R$ x Consumo médio mensal R$ (barras agrupadas)
    - grafico4: Fluxo de caixa acumulado (barras pos/neg)
    - grafico5: Economia com solar x Custos sem solar (linhas)
    """
    yfmt = brl_formatter()

    # Gráfico 1
    df_custo = tabelas["custo_sem_solar"]
    fig1, ax1 = plt.subplots(figsize=(12, 6))
    ax1.bar(df_custo["ano"], df_custo["custo_acumulado_sem_solar_r"], color=COR_VERMELHO)
    ax1.set_title("Custo acumulado de energia sem energia solar")
    ax1.set_xlabel("Ano")
    ax1.set_ylabel("R$")
    ax1.yaxis.set_major_formatter(yfmt)
    for x, y in zip(df_custo["ano"], df_custo["custo_acumulado_sem_solar_r"]):
        ax1.text(x, y * 1.01 if y >= 0 else y * 0.99, formatar_moeda_brl(y),
                 ha="center", va="bottom" if y >= 0 else "top", fontsize=9)
    fig1.tight_layout()
    g1 = _fig_to_data_uri(fig1)

    # Gráfico 2
    df_sem = tabelas["sem_solar"]
    fig2, ax2 = plt.subplots(figsize=(12, 6))
    ax2.plot(df_sem["ano"], df_sem["conta_media_mensal_r"], color=COR_LARANJA, marker="o")
    ax2.set_title("Evolução da conta média mensal de energia")
    ax2.set_xlabel("Ano")
    ax2.set_ylabel("R$")
    ax2.yaxis.set_major_formatter(yfmt)
    for x, y in zip(df_sem["ano"], df_sem["conta_media_mensal_r"]):
        ax2.annotate(formatar_moeda_brl(y), (x, y), textcoords="offset points", xytext=(0, 8),
                     ha="center", fontsize=9)
    fig2.tight_layout()
    g2 = _fig_to_data_uri(fig2)

    # Gráfico 3
    df_pm = tabelas["producao_mensal"]
    x = range(len(df_pm))
    width = 0.40
    fig3, ax3 = plt.subplots(figsize=(12, 6))
    ax3.bar([i - width / 2 for i in x], df_pm["producao_mensal_r"], width=width, color=COR_VERDE, label="Produção Mensal R$")
    ax3.bar([i + width / 2 for i in x], df_pm["consumo_medio_mensal_r"], width=width, color=COR_VERMELHO, label="Consumo Médio Mensal R$")
    ax3.set_title("Produção mensal estimada x Consumo médio mensal")
    ax3.set_xlabel("Mês")
    ax3.set_ylabel("R$")
    ax3.set_xticks(list(x))
    ax3.set_xticklabels(df_pm["mes"])
    ax3.yaxis.set_major_formatter(yfmt)
    ax3.legend()
    fig3.tight_layout()
    g3 = _fig_to_data_uri(fig3)

    # Gráfico 4
    df_fx = tabelas["fluxo_caixa"]
    fig4, ax4 = plt.subplots(figsize=(12, 6))
    ax4.bar(df_fx["ano"], df_fx["fluxo_caixa_pos_r"], color=COR_VERDE, label="Positivo")
    ax4.bar(df_fx["ano"], df_fx["fluxo_caixa_neg_r"], color=COR_VERMELHO, label="Negativo")
    ax4.axhline(0, color="black", linewidth=1)
    ax4.set_title("Fluxo de caixa acumulado do projeto")
    ax4.set_xlabel("Ano")
    ax4.set_ylabel("R$")
    ax4.yaxis.set_major_formatter(yfmt)
    for x, pos, neg in zip(df_fx["ano"], df_fx["fluxo_caixa_pos_r"], df_fx["fluxo_caixa_neg_r"]):
        if pos > 0:
            ax4.text(x, pos * 1.01, formatar_moeda_brl(pos), ha="center", va="bottom", fontsize=9)
        if neg < 0:
            ax4.text(x, neg * 1.01, formatar_moeda_brl(neg), ha="center", va="top", fontsize=9)
    ax4.legend()
    fig4.tight_layout()
    g4 = _fig_to_data_uri(fig4)

    # Gráfico 5
    fig5, ax5 = plt.subplots(figsize=(12, 6))
    ax5.plot(df_fx["ano"], df_fx["economia_acumulada_r"], color=COR_VERDE, marker="o", label="Economia com Energia Solar")
    ax5.plot(df_fx["ano"], df_fx["custos_sem_solar_neg_r"], color=COR_VERMELHO, marker="o", label="Custos sem Energia Solar")
    ax5.axhline(0, color="black", linewidth=1)
    ax5.set_title("Economia com energia solar x custos sem energia solar")
    ax5.set_xlabel("Ano")
    ax5.set_ylabel("R$")
    ax5.yaxis.set_major_formatter(yfmt)
    ax5.legend()
    anos_chave = {1, 10, 20, 25}
    for x, y in zip(df_fx["ano"], df_fx["economia_acumulada_r"]):
        if x in anos_chave:
            ax5.annotate(formatar_moeda_brl(y), (x, y), textcoords="offset points", xytext=(0, 8),
                         ha="center", fontsize=9)
    fig5.tight_layout()
    g5 = _fig_to_data_uri(fig5)

    return {
        "grafico1": g1,
        "grafico2": g2,
        "grafico3": g3,
        "grafico4": g4,
        "grafico5": g5,
    }


def main():
    tabelas = calcular_tabelas(
        consumo_medio_kwh_mes=consumo_medio_kwh_mes_ex,
        tarifa_atual_r_kwh=tarifa_atual_r_kwh_ex,
        potencia_kwp=potencia_kwp_ex,
        irradiancia_mensal_kwh_m2_dia=irradiancia_mensal_kwh_m2_dia_ex,
        valor_usina=valor_usina_ex
    )
    plotar_graficos(tabelas, pasta_saida=".", mostrar=False)
    # Log básico
    print("✅ Gráficos gerados com sucesso:")
    for i in range(1, 6):
        print(f"   - grafico{i}.png")


if __name__ == "__main__":
    main()


