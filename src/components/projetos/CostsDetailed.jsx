import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { propostaService } from '../../services/propostaService.js';
import { Configuracao } from '../../entities/index.js';

// UI base usada no projeto
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card.jsx';

function formatCurrency(value) {
  const v = Number(value || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Aba de Custos – detalhamento do cálculo
 * - Não executa nenhum cálculo financeiro local relevante
 * - Busca KPIs + Tabelas no backend núcleo único (/dimensionamento/excel-calculo)
 * - Exibe fórmulas substituídas por números, resultados e as tabelas de 25 anos
 */
export default function CostsDetailed({
  formData,
  resumoCalculos,
  quantidadesCalculadas,
  kitSelecionado,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [core, setCore] = useState({ metrics: {}, tabelas: {} });
  const [tarifaResolvida, setTarifaResolvida] = useState(0);

  // Resolver tarifa a partir da concessionária quando não vier no form
  useEffect(() => {
    let abort = false;
    const resolveTarifa = async () => {
      try {
        let t = Number(formData?.tarifa_energia || 0) || 0;
        if ((!t || t <= 0 || t > 10) && formData?.concessionaria) {
          try {
            t = await Configuracao.getTarifaByConcessionaria(formData.concessionaria);
          } catch (_) {
            // mantém t como 0 se não conseguir resolver
          }
        }
        if (!abort) setTarifaResolvida(Number(t || 0));
      } catch (_) {
        if (!abort) setTarifaResolvida(0);
      }
    };
    resolveTarifa();
    return () => { abort = true; };
  }, [formData?.tarifa_energia, formData?.concessionaria]);

  const payload = useMemo(() => {
    // Preços/custos calculados previamente na mesma aba
    const quantidadePlacas = quantidadesCalculadas?.paineis || 0;
    const potenciaKwp = Number(formData?.potencia_kw || formData?.potencia_kwp || 0) || 0;
    const custoEquipamentos = kitSelecionado?.precoTotal || resumoCalculos?.custoEquipamentos || 0;
    const custoOp = resumoCalculos?.custoOp || {
      equipamentos: custoEquipamentos,
      instalacao: (quantidadePlacas || 0) * 200,
      caAterramento: (quantidadePlacas || 0) * 100,
      homologacao: 400,
      placasSinalizacao: 60,
      despesasGerais: ((quantidadePlacas || 0) * 200) * 0.1, // 10% sobre instalação
      total:
        (custoEquipamentos || 0) +
        ((quantidadePlacas || 0) * 200) +
        ((quantidadePlacas || 0) * 100) +
        400 +
        60 +
        (((quantidadePlacas || 0) * 200) * 0.1),
    };

    const precoVenda = Number(resumoCalculos?.precoVenda || formData?.preco_venda || formData?.preco_final || 0) || 0;

    // Consumo: usa como enviado na tela; não calcula fallback aqui
    // Consumo mensal em R$: preferir o informado; se 0, derivar de kWh × tarifa
    let consumoMensalReais = Number(formData?.consumo_mensal_reais || 0) || 0;
    // Consumo mensal em kWh: preferir média do vetor mês a mês quando informado
    let consumoMensalKwh = Number(formData?.consumo_mensal_kwh || 0) || 0;
    if ((!consumoMensalKwh || consumoMensalKwh <= 0) && Array.isArray(formData?.consumo_mes_a_mes) && formData.consumo_mes_a_mes.length > 0) {
      try {
        const soma = formData.consumo_mes_a_mes.reduce((acc, item) => acc + (Number((item && item.kwh) || 0) || 0), 0);
        const media = soma / 12;
        if (media > 0) consumoMensalKwh = media;
      } catch (_) {}
    }
    const tarifa = Number(tarifaResolvida || formData?.tarifa_energia || 0) || 0;
    const irrMedia = Number(formData?.irradiacao_media || 5.15) || 5.15;

    if ((!consumoMensalReais || consumoMensalReais <= 0) && consumoMensalKwh > 0 && tarifa > 0) {
      consumoMensalReais = consumoMensalKwh * tarifa;
    }

    return {
      consumo_mensal_reais: consumoMensalReais,
      consumo_mensal_kwh: consumoMensalKwh,
      tarifa_energia: tarifa,
      potencia_sistema: potenciaKwp,
      preco_venda: precoVenda,
      irradiacao_media: irrMedia,
      // vetor mensal opcional (se não vier, backend usa média)
      ...(Array.isArray(formData?.consumo_mes_a_mes) && formData.consumo_mes_a_mes.length > 0
        ? {
            consumo_mensal_kwh_meses: formData.consumo_mes_a_mes.map(m => Number((m && m.kwh) || 0)),
          }
        : {})
    };
  }, [formData, resumoCalculos, quantidadesCalculadas, kitSelecionado, tarifaResolvida]);

  useEffect(() => {
    // Para KPIs, basta ter consumo (R$ ou kWh) e preço de venda.
    // O backend só gerará tabelas se também houver tarifa>0 e potência>0 (o que é OK).
    const canCall =
      (payload?.preco_venda || 0) > 0 &&
      (((payload?.consumo_mensal_kwh || 0) > 0) || ((payload?.consumo_mensal_reais || 0) > 0));
    if (!canCall) {
      setCore({ metrics: {}, tabelas: {} });
      return;
    }
    let abort = false;
    setLoading(true);
    setError('');
    propostaService
      .calcularNucleo(payload)
      .then((res) => {
        if (abort) return;
        if (!res?.success) {
          setError(res?.message || 'Falha ao calcular no backend');
          setCore({ metrics: {}, tabelas: {} });
          return;
        }
        setCore(res.resultado || { metrics: {}, tabelas: {} });
      })
      .catch((e) => {
        if (abort) return;
        setError(e?.message || 'Erro ao calcular');
        setCore({ metrics: {}, tabelas: {} });
      })
      .finally(() => !abort && setLoading(false));
    return () => {
      abort = true;
    };
  }, [payload]);

  const m = core?.metrics || {};
  const t = core?.tabelas || {};
  // Exibição do consumo em kWh: usar o derivado do backend quando não veio em kWh
  const consumoKwhDerivado = Number(
    (payload?.consumo_mensal_kwh && payload.consumo_mensal_kwh > 0)
      ? payload.consumo_mensal_kwh
      : (m?.consumo_medio_kwh_mes || 0)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-amber-600">🔎</span>
          Detalhamento completo (cálculos do backend)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-gray-600">Calculando no backend...</div>
        ) : error ? (
          <div className="text-sm text-red-600">Erro: {error}</div>
        ) : (
          <div className="space-y-8">
            {/* Entradas consolidadas */}
            <section className="space-y-2">
              <h4 className="font-semibold">Entradas usadas no cálculo</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Consumo mensal (R$):</span>
                  <span className="font-medium">{formatCurrency(payload.consumo_mensal_reais)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Consumo mensal (kWh):</span>
                  <span className="font-medium">
                    {consumoKwhDerivado.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tarifa (R$/kWh):</span>
                  <span className="font-medium">{formatCurrency(tarifaResolvida || payload.tarifa_energia)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Potência do sistema (kWp):</span>
                  <span className="font-medium">{Number(payload.potencia_sistema || 0).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Preço de venda (CAPEX):</span>
                  <span className="font-semibold text-blue-700">{formatCurrency(payload.preco_venda)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Irradiação média (kWh/m²·dia):</span>
                  <span className="font-medium">{Number(payload.irradiacao_media || 0).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </section>

            {/* Fórmulas com substituição */}
            <section className="space-y-3">
              <h4 className="font-semibold">Fórmulas aplicadas (núcleo)</h4>
              <div className="text-xs text-gray-600">
                Abaixo mostramos a fórmula e, em seguida, a substituição com os valores usados.
              </div>
              <div className="space-y-2 text-sm">
                <div className="p-3 rounded border bg-gray-50">
                  <div className="font-medium">Economia mensal</div>
                  <div>Se houver consumo em R$: economia_mensal = consumo_reais</div>
                  <div>Senão: economia_mensal = consumo_kWh × tarifa</div>
                  <div className="mt-1 text-gray-700">
                    Substituição: {payload.consumo_mensal_reais > 0
                      ? `economia_mensal = ${formatCurrency(payload.consumo_mensal_reais)}`
                      : `economia_mensal = ${Number(payload.consumo_mensal_kwh || 0).toLocaleString('pt-BR')} × ${formatCurrency(payload.tarifa_energia)} = ${formatCurrency(m.economia_mensal_estimada)}`
                    }
                  </div>
                </div>
                <div className="p-3 rounded border bg-gray-50">
                  <div className="font-medium">Conta anual atual</div>
                  <div>conta_anual = economia_mensal × 12</div>
                  <div className="mt-1 text-gray-700">
                    Substituição: {formatCurrency(m.economia_mensal_estimada || 0)} × 12 = {formatCurrency(m.conta_atual_anual || 0)}
                  </div>
                </div>
                <div className="p-3 rounded border bg-gray-50">
                  <div className="font-medium">Payback (fluxo de caixa)</div>
                  <div>É o ponto onde o fluxo de caixa acumulado cruza zero.</div>
                  <div>Interpolação linear entre os anos N e N+1 quando há troca de sinal:</div>
                  <div className="text-xs">
                    fração = -FC_acum(N) ÷ (FC_acum(N+1) - FC_acum(N)); payback_anos = N + fração
                  </div>
                  <div className="mt-1 text-gray-700">
                    Resultado: {(m.anos_payback || 0).toFixed?.(1) || m.anos_payback} anos
                  </div>
                </div>
                <div className="p-3 rounded border bg-gray-50">
                  <div className="font-medium">Gasto acumulado até o payback</div>
                  <div>gasto_acumulado_payback = conta_anual × payback_anos</div>
                  <div className="mt-1 text-gray-700">
                    Substituição: {formatCurrency(m.conta_atual_anual || 0)} × {(m.anos_payback || 0).toFixed?.(1) || m.anos_payback} = {formatCurrency(m.gasto_acumulado_payback || 0)}
                  </div>
                </div>
              </div>
            </section>

            {/* Tabelas 25 anos */}
            <section className="space-y-3">
              <h4 className="font-semibold">Tabelas de 25 anos (núcleo)</h4>
              {!t || Object.keys(t).length === 0 ? (
                <div className="text-sm text-gray-600">Preencha consumo, tarifa, potência e preço para gerar as tabelas.</div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-auto border rounded">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Ano</th>
                          <th className="p-2 text-right">Tarifa (R$/kWh)</th>
                          <th className="p-2 text-right">Conta anual sem solar</th>
                          <th className="p-2 text-right">Acumulado sem solar</th>
                          <th className="p-2 text-right">Taxa de distribuição</th>
                          <th className="p-2 text-right">Conta anual com solar</th>
                          <th className="p-2 text-right">Economia anual</th>
                          <th className="p-2 text-right">Fluxo caixa anual</th>
                          <th className="p-2 text-right">Fluxo caixa acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(t.ano || []).map((_, idx) => (
                          <tr key={idx} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-2">{t.ano[idx]}</td>
                            <td className="p-2 text-right">{formatCurrency(t.tarifa_r_kwh?.[idx] || 0)}</td>
                            <td className="p-2 text-right">{formatCurrency(t.custo_anual_sem_solar_r?.[idx] || 0)}</td>
                            <td className="p-2 text-right">{formatCurrency(t.custo_acumulado_sem_solar_r?.[idx] || 0)}</td>
                            <td className="p-2 text-right">{formatCurrency(t.taxa_distribuicao_anual_r?.[idx] || 0)}</td>
                            <td className="p-2 text-right">{formatCurrency(t.custo_anual_com_solar_r?.[idx] || 0)}</td>
                            <td className="p-2 text-right">{formatCurrency(t.economia_anual_r?.[idx] || 0)}</td>
                            <td className="p-2 text-right">{formatCurrency(t.fluxo_caixa_anual_r?.[idx] || 0)}</td>
                            <td className="p-2 text-right">{formatCurrency(t.fluxo_caixa_acumulado_r?.[idx] || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Nova tabela: Geração anual (kWh e R$) */}
                  <div className="overflow-auto border rounded">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Ano</th>
                          <th className="p-2 text-right">Produção anual (kWh)</th>
                          <th className="p-2 text-right">Produção anual (R$)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(t.ano || []).map((_, idx) => (
                          <tr key={`prod-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-2">{t.ano[idx]}</td>
                            <td className="p-2 text-right">
                              {Number(t.producao_anual_kwh?.[idx] || 0).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-2 text-right">
                              {formatCurrency(t.producao_anual_r?.[idx] || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Nova tabela: Produção mensal (kWh e R$) - Ano 1 distribuída por irradiância mensal */}
                  <div className="overflow-auto border rounded">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Mês (ano 1)</th>
                          <th className="p-2 text-right">Produção mensal (kWh)</th>
                          <th className="p-2 text-right">Produção mensal (R$)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                          const kwh = t.producao_mensal_kwh_ano1 || [];
                          const r$ = t.producao_mensal_r_ano1 || [];
                          return meses.map((mes, idx) => (
                            <tr key={`prod-mes-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="p-2">{mes}</td>
                              <td className="p-2 text-right">{Number(kwh?.[idx] || 0).toLocaleString('pt-BR')}</td>
                              <td className="p-2 text-right">{formatCurrency(r$?.[idx] || 0)}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


