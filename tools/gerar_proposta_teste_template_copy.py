import random
import sys
from datetime import datetime
from pathlib import Path

# Garantir que o root do projeto esteja no sys.path (para importar servidor_proposta.py)
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Importa a função real do backend para renderizar o HTML final
from servidor_proposta import process_template_html


def _fmt_brl(v: float) -> str:
    s = f"R$ {v:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _parcelas_html(valor_total: float, max_parcelas: int = 18, taxa_base_pct: float = 3.16) -> str:
    # Simples: taxa cresce um pouco por parcela, só para demo visual
    out = []
    for p in range(1, max_parcelas + 1):
        taxa = taxa_base_pct + max(0, p - 1) * 0.65
        valor_com_taxa = valor_total * (1 + taxa / 100.0)
        out.append(
            f'<div class="parcela-item"><span class="parcela-numero">{p}x de </span>'
            f'<span class="parcela-valor">{_fmt_brl(valor_com_taxa / p)}</span></div>'
        )
    return "".join(out)


def _parcelas_fin_html(valor_total: float) -> tuple[str, str]:
    # Simples (Price com juros fixos), só para demo
    opcoes = [
        (12, 1.95),
        (24, 1.95),
        (36, 1.95),
        (48, 1.95),
        (60, 1.95),
        (72, 1.95),
    ]
    menor = None
    cards = []
    for n, taxa_pct in opcoes:
        i = (taxa_pct / 100.0)
        if i > 0:
            parcela = valor_total * (i * (1 + i) ** n) / ((1 + i) ** n - 1)
        else:
            parcela = valor_total / n
        menor = parcela if (menor is None or parcela < menor) else menor
        cards.append(
            f'<div class="parcela-item"><span class="parcela-numero">{n}x de </span>'
            f'<span class="parcela-valor">{_fmt_brl(parcela)}</span></div>'
        )
    return "".join(cards), _fmt_brl(menor or 0.0)


def main():
    random.seed(42)

    # Cliente fictício (coerente)
    cliente_nome = "Cliente Fictício (Teste) - Ana Souza"
    cidade = "Campinas"
    investimento_avista = 24990.00

    # Consumo mês a mês (para testar gráfico e labels)
    meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    consumo_mes_a_mes = []
    base = 310
    for idx, m in enumerate(meses, start=1):
        # sazonalidade leve
        kwh = base + (25 if m in ("Dez", "Jan") else 0) + (10 if m in ("Jul", "Ago") else 0) - (15 if m in ("Mar", "Abr") else 0)
        consumo_mes_a_mes.append({"mes": m, "kwh": float(kwh)})

    consumo_kwh_medio = sum(x["kwh"] for x in consumo_mes_a_mes) / 12.0
    tarifa = 0.95
    economia_mensal = min(consumo_kwh_medio, 360) * tarifa  # só para demo
    economia_ano_1 = economia_mensal * 12

    # Payback aproximado (demo)
    anos_payback = max(2.5, min(8.5, investimento_avista / max(economia_ano_1, 1)))
    gasto_acumulado_payback = (consumo_kwh_medio * tarifa * 12) * anos_payback

    # Cartão/financiamento (demo)
    parcelas_cartao = _parcelas_html(investimento_avista, max_parcelas=18, taxa_base_pct=3.16)
    parcelas_fin, menor_parcela = _parcelas_fin_html(investimento_avista)
    valor_avista_cartao = _fmt_brl(investimento_avista * (1 + 3.16 / 100.0))

    proposta_data = {
        # Identidade
        "cliente_nome": cliente_nome,
        "cliente_endereco": "Rua Fictícia, 123 - Jardim Teste",
        "cidade": cidade,
        "cliente_telefone": "(19) 99999-0000",
        # Vendedor
        "vendedor_nome": "João Vendedor (Teste)",
        "vendedor_cargo": "Especialista em Energia Solar",
        "vendedor_telefone": "(19) 98888-1111",
        "vendedor_email": "vendas@fohat.com",
        "data_proposta": datetime.now().strftime("%d/%m/%Y"),
        # Dimensionamento / kit (usados nos novos blocos do template copy)
        "potencia_sistema": 3.74,  # kWp
        "quantidade_placas": 8,
        "potencia_placa_w": 585,
        "area_necessaria": 20.0,
        # Financeiro base
        "preco_venda": investimento_avista,
        "preco_final": investimento_avista,
        "conta_atual_anual": float(consumo_kwh_medio * tarifa * 12),
        "anos_payback": float(round(anos_payback, 1)),
        # IMPORTANTE: estes campos precisam ser numéricos porque o backend formata com :,.2f
        "gasto_acumulado_payback": float(gasto_acumulado_payback),
        "conta_futura_25_anos": float(consumo_kwh_medio * tarifa * 12) * 4.2,  # demo
        "economia_mensal_estimada": float(economia_mensal),
        "economia_mensal": float(economia_mensal),
        "economia_ano_1": float(economia_ano_1),
        "economia_total_25_anos": float(economia_ano_1 * 25 - investimento_avista),
        "payback_anos": float(round(anos_payback, 1)),
        "payback_meses": int(round(anos_payback * 12)),
        # Campos usados pelo core/gráficos
        "consumo_mensal_kwh": float(consumo_kwh_medio),
        "consumo_mes_a_mes": consumo_mes_a_mes,
        "tarifa_energia": float(tarifa),
        "irradiacao_media": 5.15,
        # Equipamentos (marca/modelo/tipo) — para validar o Slide 8
        "modulo_marca": "JA Solar",
        "modulo_modelo": "JAM72S30 585W",
        "inversor_marca": "Growatt",
        "inversor_modelo": "MIN 4000TL-X",
        "tipo_inversor": "String",
        # Pagamentos (persistidos -> slide 10)
        "parcelas_cartao": parcelas_cartao,
        "parcelas_financiamento": parcelas_fin,
        "valor_avista_cartao": valor_avista_cartao,
        "menor_parcela_financiamento": menor_parcela,
    }

    html = process_template_html(proposta_data, template_filename="template copy.html")
    out_path = Path(__file__).resolve().parent.parent / "public" / "proposta_teste_template_copy_rendered.html"
    out_path.write_text(html, encoding="utf-8")

    print(f"✅ Proposta teste gerada em: {out_path}")


if __name__ == "__main__":
    main()


