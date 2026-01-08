import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { propostaService } from '../../services/propostaService.js';
import { Configuracao } from '../../entities/index.js';
import { calcularInstalacaoPorPlaca } from '../../utils/calculosSolares.js';
import { calcularDecomposicaoTarifa } from '../../data/concessionariasSP.js';

// UI base usada no projeto
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card.jsx';

function formatCurrency(value) {
  const v = Number(value || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value) {
  const v = Number(value || 0);
  return v.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 1 });
}

/**
 * Aba de Custos – detalhamento do cálculo (Lei 14.300/2022)
 * 
 * ATUALIZADO PARA 2026 - Conforme:
 * - Lei 14.300/2022 (Marco Legal da Geração Distribuída)
 * - Resolução Normativa ANEEL 1000/2023
 * 
 * Inclui:
 * - Economia REAL (apenas componentes compensáveis)
 * - TUSD Fio B (não compensável - regra de transição)
 * - Degradação anual do sistema
 * - Custos de manutenção e substituição do inversor
 * - VPL (Valor Presente Líquido)
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
    const fallbackInst = calcularInstalacaoPorPlaca(quantidadePlacas || 0, {});
    const fallbackInstTotal = (quantidadePlacas || 0) * (fallbackInst?.final_por_placa || 0);
    const custoOp = resumoCalculos?.custoOp || {
      equipamentos: custoEquipamentos,
      instalacao: fallbackInstTotal,
      caAterramento: (quantidadePlacas || 0) * 100,
      homologacao: 500,
      placasSinalizacao: 60,
      despesasGerais: fallbackInstTotal * 0.1, // 10% sobre instalação (fallback)
      total:
        (custoEquipamentos || 0) +
        fallbackInstTotal +
        ((quantidadePlacas || 0) * 100) +
        500 +
        60 +
        (fallbackInstTotal * 0.1),
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

            {/* Decomposição da Tarifa de Energia (Lei 14.300/2022) */}
            <section className="space-y-3">
              <h4 className="font-semibold">📊 Decomposição da Tarifa de Energia (Lei 14.300/2022)</h4>
              <div className="text-xs text-gray-600 mb-2">
                Detalhamento dos componentes que formam a tarifa de energia elétrica, conforme Lei 14.300/2022.
              </div>
              {(() => {
                const decomp = calcularDecomposicaoTarifa(
                  consumoKwhDerivado,
                  formData?.concessionaria || '',
                  'residencial',
                  'verde',
                  2026 // Ano de referência para Lei 14.300
                );
                return (
                  <div className="space-y-4">
                    {/* Aviso Lei 14.300 */}
                    <div className="p-3 rounded-lg border-2 border-yellow-300 bg-yellow-50">
                      <div className="font-medium text-yellow-800 mb-1">⚠️ Lei 14.300/2022 - Marco Legal da Geração Distribuída</div>
                      <div className="text-xs text-yellow-700">
                        {decomp.lei14300?.descricao || `Em 2026, ${(decomp.lei14300?.tusdFioBCobranca * 100 || 45).toFixed(0)}% da TUSD (Fio B) não é compensável.`}
                      </div>
                    </div>
                    
                    {/* Componentes da Tarifa - TE e TUSD separados */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* TE - 100% Compensável */}
                      <div className="p-3 rounded border-2 bg-green-50 border-green-300">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">✓</span>
                          <span className="font-medium text-green-800">TE - Tarifa de Energia</span>
                        </div>
                        <div className="text-xs text-green-600 mb-1">100% COMPENSÁVEL</div>
                        <div className="flex justify-between text-sm">
                          <span>Valor por kWh:</span>
                          <span className="font-medium">R$ {decomp.te.valor.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total:</span>
                          <span className="font-semibold text-green-700">{formatCurrency(decomp.te.total)}</span>
                        </div>
                      </div>
                      
                      {/* TUSD Compensável */}
                      <div className="p-3 rounded border-2 bg-blue-50 border-blue-300">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600">✓</span>
                          <span className="font-medium text-blue-800">TUSD Compensável</span>
                        </div>
                        <div className="text-xs text-blue-600 mb-1">{((decomp.lei14300?.tusdCompensavelPct || 0.55) * 100).toFixed(0)}% da TUSD</div>
                        <div className="flex justify-between text-sm">
                          <span>Valor por kWh:</span>
                          <span className="font-medium">R$ {(decomp.tusdCompensavel?.valor || 0).toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total:</span>
                          <span className="font-semibold text-blue-700">{formatCurrency(decomp.tusdCompensavel?.total || 0)}</span>
                        </div>
                      </div>
                      
                      {/* TUSD Fio B - NÃO Compensável */}
                      <div className="p-3 rounded border-2 bg-red-50 border-red-300">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600">✗</span>
                          <span className="font-medium text-red-800">TUSD Fio B</span>
                        </div>
                        <div className="text-xs text-red-600 mb-1">NÃO compensável ({((decomp.lei14300?.tusdFioBCobranca || 0.45) * 100).toFixed(0)}% da TUSD)</div>
                        <div className="flex justify-between text-sm">
                          <span>Valor por kWh:</span>
                          <span className="font-medium">R$ {(decomp.tusdFioB?.valor || 0).toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total:</span>
                          <span className="font-semibold text-red-700">{formatCurrency(decomp.tusdFioB?.total || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Impostos */}
                    <div className="p-3 rounded border bg-orange-50 border-orange-200">
                      <div className="font-medium text-orange-800 mb-2">Impostos e Contribuições (Compensáveis em SP)</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            <span className="text-green-600 text-xs">✓</span> PIS
                          </div>
                          <div className="text-xs text-gray-600">Programa de Integração Social</div>
                          <div className="flex justify-between">
                            <span>Alíquota:</span>
                            <span>{(decomp.pis.aliquota * 100).toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total:</span>
                            <span className="font-medium">{formatCurrency(decomp.pis.total)}</span>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            <span className="text-green-600 text-xs">✓</span> COFINS
                          </div>
                          <div className="text-xs text-gray-600">Contrib. Financ. Seguridade Social</div>
                          <div className="flex justify-between">
                            <span>Alíquota:</span>
                            <span>{(decomp.cofins.aliquota * 100).toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total:</span>
                            <span className="font-medium">{formatCurrency(decomp.cofins.total)}</span>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            <span className="text-green-600 text-xs">✓</span> ICMS
                          </div>
                          <div className="text-xs text-gray-600">Imposto Estadual (SP - compensável)</div>
                          <div className="flex justify-between">
                            <span>Alíquota:</span>
                            <span>{(decomp.icms.aliquota * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total:</span>
                            <span className="font-medium">{formatCurrency(decomp.icms.total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resumo Lei 14.300 */}
                    <div className="p-4 rounded-lg border-2 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                      <div className="font-medium text-green-800 mb-3">📊 Resumo da Conta (Lei 14.300/2022)</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-gray-600">Tarifa Base</div>
                          <div className="font-semibold">{formatCurrency(decomp.tarifaBase.total)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Total Impostos</div>
                          <div className="font-semibold">{formatCurrency(decomp.totalImpostos)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Total da Conta</div>
                          <div className="font-bold">{formatCurrency(decomp.totalFinal)}</div>
                        </div>
                        <div className="bg-green-100 p-2 rounded">
                          <div className="text-xs text-green-700">✓ Economia REAL</div>
                          <div className="font-bold text-green-700">{formatCurrency(decomp.totalCompensavel || 0)}</div>
                        </div>
                        <div className="bg-red-100 p-2 rounded">
                          <div className="text-xs text-red-700">✗ Custo Residual</div>
                          <div className="font-bold text-red-700">{formatCurrency(decomp.totalNaoCompensavel || 0)}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-green-200 flex justify-between items-center">
                        <span className="text-sm text-gray-600">Percentual da conta que pode ser economizado:</span>
                        <span className="text-xl font-bold text-green-600">{decomp.percentualEconomia || '0'}%</span>
                      </div>
                    </div>

                    {/* Economia Real vs Modelo Antigo */}
                    <div className="p-3 rounded border bg-amber-50 border-amber-200">
                      <div className="font-medium text-amber-800 mb-2">💡 Impacto da Lei 14.300 na Economia</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-2 bg-gray-100 rounded">
                          <div className="text-xs text-gray-600">Modelo Antigo (100% compensável)</div>
                          <div className="font-bold text-gray-700">{formatCurrency(decomp.totalFinal)}/mês</div>
                          <div className="text-xs text-gray-500">Em 25 anos: {formatCurrency(decomp.totalFinal * 12 * 25)}</div>
                        </div>
                        <div className="p-2 bg-green-100 rounded">
                          <div className="text-xs text-green-700">Lei 14.300 (economia real)</div>
                          <div className="font-bold text-green-700">{formatCurrency(decomp.totalCompensavel || 0)}/mês</div>
                          <div className="text-xs text-green-600">Em 25 anos: {formatCurrency((decomp.totalCompensavel || 0) * 12 * 25)}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-amber-700">
                        <strong>Diferença:</strong> {formatCurrency((decomp.totalFinal || 0) - (decomp.totalCompensavel || 0))}/mês a menos devido à TUSD Fio B não compensável.
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* Lei 14.300/2022 - Economia Real vs Bruta */}
            {(m.economia_mensal_real || m.economia_mensal_bruta) && (
              <section className="space-y-3">
                <h4 className="font-semibold">⚖️ Lei 14.300/2022 - Economia Real vs Bruta</h4>
                <div className="text-xs text-gray-600 mb-2">
                  A Lei 14.300/2022 estabelece que nem toda a tarifa é compensável. A economia REAL considera apenas 
                  os componentes que podem ser efetivamente compensados pela energia solar gerada.
                </div>
                
                {/* Comparação Economia Real vs Bruta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border-2 border-red-200 bg-red-50">
                    <div className="font-medium text-red-800 mb-2">❌ Economia BRUTA (modelo antigo)</div>
                    <div className="text-xs text-red-600 mb-2">
                      Assumia 100% da tarifa como compensável - incorreto após Lei 14.300
                    </div>
                    <div className="text-2xl font-bold text-red-700">
                      {formatCurrency(m.economia_mensal_bruta)}/mês
                    </div>
                    <div className="text-sm text-red-600 mt-1">
                      {formatCurrency((m.economia_mensal_bruta || 0) * 12)}/ano
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50">
                    <div className="font-medium text-green-800 mb-2">✅ Economia REAL (Lei 14.300)</div>
                    <div className="text-xs text-green-600 mb-2">
                      Considera apenas componentes compensáveis + custos operacionais
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrency(m.economia_mensal_real)}/mês
                    </div>
                    <div className="text-sm text-green-600 mt-1">
                      {formatCurrency((m.economia_mensal_real || 0) * 12)}/ano
                    </div>
                  </div>
                </div>
                
                {/* TUSD Fio B */}
                <div className="p-4 rounded-lg border border-orange-200 bg-orange-50">
                  <div className="font-medium text-orange-800 mb-2">⚠️ TUSD Fio B - Custo NÃO compensável</div>
                  <div className="text-xs text-orange-600 mb-2">
                    Conforme Lei 14.300, a TUSD Fio B não é compensável e cresce gradualmente até 2029.
                    Em {m.ano_referencia_lei14300 || 2026}, {((m.decomposicao_tarifa?.tusd_fio_b_cobranca_percentual || 0.45) * 100).toFixed(0)}% da TUSD é cobrada.
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xs text-gray-600">Custo mensal</div>
                      <div className="font-bold text-orange-700">{formatCurrency(m.custo_residual_mensal)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Custo anual</div>
                      <div className="font-bold text-orange-700">{formatCurrency(m.custo_residual_anual)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Custo em 25 anos</div>
                      <div className="font-bold text-orange-700">{formatCurrency(m.custo_tusd_fio_b_25_anos)}</div>
                    </div>
                  </div>
                </div>
                
                {/* Custos Operacionais */}
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                  <div className="font-medium text-blue-800 mb-2">🔧 Custos Operacionais (incluídos no cálculo)</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-600">Manutenção anual (1% do investimento)</div>
                      <div className="font-semibold text-blue-700">{formatCurrency(m.custo_manutencao_anual)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Economia líquida anual</div>
                      <div className="font-bold text-blue-700">{formatCurrency(m.economia_liquida_anual)}</div>
                    </div>
                  </div>
                </div>
                
                {/* Comparação de Payback */}
                <div className="p-4 rounded-lg border border-purple-200 bg-purple-50">
                  <div className="font-medium text-purple-800 mb-2">📊 Comparação de Payback</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-600">Payback OTIMISTA (sem custos)</div>
                      <div className="font-semibold text-purple-600">{m.anos_payback_otimista || m.anos_payback} anos</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Payback REAL (Lei 14.300)</div>
                      <div className="font-bold text-purple-800">{m.anos_payback_real || m.anos_payback} anos</div>
                    </div>
                  </div>
                  <div className="text-xs text-purple-600 mt-2">
                    O payback real considera: economia compensável, TUSD Fio B, manutenção e degradação.
                  </div>
                </div>
                
                {/* Percentual de Economia */}
                {m.percentual_economia > 0 && (
                  <div className="p-3 rounded border bg-gray-50">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Percentual da conta que pode ser economizado:</span>
                      <span className="text-xl font-bold text-green-600">{m.percentual_economia}%</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Os outros {(100 - m.percentual_economia).toFixed(1)}% são custos fixos (TUSD Fio B) que permanecerão mesmo com energia solar.
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Fórmulas com substituição (Lei 14.300) */}
            <section className="space-y-3">
              <h4 className="font-semibold">Fórmulas aplicadas (Lei 14.300/2022)</h4>
              <div className="text-xs text-gray-600">
                Cálculos atualizados conforme Lei 14.300/2022 e Resolução ANEEL 1000/2023.
              </div>
              <div className="space-y-2 text-sm">
                <div className="p-3 rounded border bg-gray-50">
                  <div className="font-medium">Economia Real (Lei 14.300)</div>
                  <div>economia_real = (TE + TUSD_compensável + PIS + COFINS + ICMS) × produção_kWh</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Onde TUSD_compensável = TUSD_total × (1 - %_Fio_B_cobrada)
                  </div>
                  <div className="mt-1 text-gray-700">
                    Resultado: {formatCurrency(m.economia_mensal_real)}/mês
                  </div>
                </div>
                <div className="p-3 rounded border bg-gray-50">
                  <div className="font-medium">Degradação anual do sistema</div>
                  <div>Produção(ano N) = Produção(ano 1) × (1 - 0,75%)^(N-1)</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Taxa de degradação padrão: 0,75% ao ano (conforme garantia dos fabricantes)
                  </div>
                </div>
                <div className="p-3 rounded border bg-gray-50">
                  <div className="font-medium">Fluxo de caixa anual</div>
                  <div>FC_anual = Economia_real - Custo_TUSD_Fio_B - Custo_manutenção - CAPEX(ano 0)</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Manutenção: 1% do investimento/ano | Substituição inversor: ano 12 (15% do investimento)
                  </div>
                </div>
                <div className="p-3 rounded border bg-gray-50">
                  <div className="font-medium">Payback Real</div>
                  <div>Payback = menor N onde Σ FC_acumulado ≥ 0</div>
                  <div className="mt-1 text-gray-700">
                    Resultado: {(m.anos_payback_real || m.anos_payback || 0).toFixed?.(1)} anos
                  </div>
                </div>
                <div className="p-3 rounded border bg-gray-50">
                  <div className="font-medium">Conta anual atual</div>
                  <div>conta_anual = economia_mensal_bruta × 12</div>
                  <div className="mt-1 text-gray-700">
                    Substituição: {formatCurrency(m.economia_mensal_bruta || 0)} × 12 = {formatCurrency(m.conta_atual_anual || 0)}
                  </div>
                </div>
              </div>
            </section>

            {/* Tabelas 25 anos (Lei 14.300/2022) */}
            <section className="space-y-3">
              <h4 className="font-semibold">Tabelas de 25 anos (Lei 14.300/2022)</h4>
              {!t || Object.keys(t).length === 0 ? (
                <div className="text-sm text-gray-600">Preencha consumo, tarifa, potência e preço para gerar as tabelas.</div>
              ) : (
                <div className="space-y-4">
                  {/* VPL Final */}
                  {t.vpl_final !== undefined && (
                    <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-green-800">📈 VPL (Valor Presente Líquido) em 25 anos</div>
                          <div className="text-xs text-green-600">Taxa de desconto: {((t.parametros_lei14300?.taxa_desconto_vpl || 0.08) * 100).toFixed(0)}% a.a.</div>
                        </div>
                        <div className="text-2xl font-bold text-green-700">
                          {formatCurrency(t.vpl_final)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mt-2">
                        VPL = Σ (FC_N / (1 + taxa_desconto)^N) - Investimento Inicial
                      </div>
                    </div>
                  )}
                  
                  {/* Tabela principal com Lei 14.300 */}
                  <div className="overflow-auto border rounded">
                    <div className="bg-blue-50 p-2 font-medium text-blue-800 text-sm">
                      📊 Fluxo de Caixa - Lei 14.300/2022 (com degradação, manutenção e TUSD Fio B)
                    </div>
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Ano</th>
                          <th className="p-2 text-left">Calendário</th>
                          <th className="p-2 text-right">Tarifa</th>
                          <th className="p-2 text-right">Sem Solar</th>
                          <th className="p-2 text-right">Eco. Real</th>
                          <th className="p-2 text-right">TUSD Fio B</th>
                          <th className="p-2 text-right">Manutenção</th>
                          <th className="p-2 text-right">Com Solar</th>
                          <th className="p-2 text-right">FC Anual</th>
                          <th className="p-2 text-right">FC Acum.</th>
                          <th className="p-2 text-right">VPL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(t.ano || []).map((_, idx) => {
                          const isPaybackYear = t.fluxo_caixa_acumulado_r?.[idx] >= 0 && (idx === 0 || t.fluxo_caixa_acumulado_r?.[idx-1] < 0);
                          const hasInverterReplacement = (t.custo_substituicao_inversor_r?.[idx] || 0) > 0;
                          return (
                            <tr key={idx} className={`${idx % 2 ? 'bg-white' : 'bg-gray-50'} ${isPaybackYear ? 'bg-green-100 font-bold' : ''} ${hasInverterReplacement ? 'bg-orange-100' : ''}`}>
                            <td className="p-2">{t.ano[idx]}</td>
                              <td className="p-2">{t.ano_calendario?.[idx] || ''}</td>
                            <td className="p-2 text-right">{formatCurrency(t.tarifa_r_kwh?.[idx] || 0)}</td>
                            <td className="p-2 text-right">{formatCurrency(t.custo_anual_sem_solar_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right text-green-700">{formatCurrency(t.economia_anual_real_r?.[idx] || t.economia_anual_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right text-orange-600">{formatCurrency(t.custo_tusd_fio_b_anual_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right text-blue-600">
                                {formatCurrency((t.custo_manutencao_anual_r?.[idx] || 0) + (t.custo_substituicao_inversor_r?.[idx] || 0))}
                                {hasInverterReplacement && <span className="text-xs ml-1">🔧</span>}
                              </td>
                            <td className="p-2 text-right">{formatCurrency(t.custo_anual_com_solar_r?.[idx] || 0)}</td>
                            <td className="p-2 text-right">{formatCurrency(t.fluxo_caixa_anual_r?.[idx] || 0)}</td>
                              <td className={`p-2 text-right ${(t.fluxo_caixa_acumulado_r?.[idx] || 0) >= 0 ? 'text-green-700 font-bold' : 'text-red-600'}`}>
                                {formatCurrency(t.fluxo_caixa_acumulado_r?.[idx] || 0)}
                              </td>
                              <td className="p-2 text-right">{formatCurrency(t.vpl_anual_r?.[idx] || 0)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Legenda */}
                  <div className="text-xs text-gray-500 flex gap-4 flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 border rounded"></span> Ano do payback</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-100 border rounded"></span> Substituição do inversor</span>
                    <span className="text-green-700">■</span> Eco. Real = Economia compensável
                    <span className="text-orange-600">■</span> TUSD Fio B = Não compensável
                  </div>
                  
                  {/* Tabela de Produção com Degradação */}
                  <div className="overflow-auto border rounded">
                    <div className="bg-purple-50 p-2 font-medium text-purple-800 text-sm">
                      📉 Produção Anual com Degradação ({((t.parametros_lei14300?.taxa_degradacao_anual || 0.0075) * 100).toFixed(2)}% ao ano)
                    </div>
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Ano</th>
                          <th className="p-2 text-right">Produção (kWh)</th>
                          <th className="p-2 text-right">Eco. Bruta (R$)</th>
                          <th className="p-2 text-right">Eco. Real (R$)</th>
                          <th className="p-2 text-right">Degradação Acum.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(t.ano || []).map((_, idx) => {
                          const prod1 = t.producao_anual_kwh?.[0] || 0;
                          const prodN = t.producao_anual_kwh?.[idx] || 0;
                          const degradacaoPct = prod1 > 0 ? ((1 - prodN / prod1) * 100).toFixed(1) : '0';
                          return (
                          <tr key={`prod-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-2">{t.ano[idx]}</td>
                              <td className="p-2 text-right">{Number(t.producao_anual_kwh?.[idx] || 0).toLocaleString('pt-BR')}</td>
                              <td className="p-2 text-right text-gray-500">{formatCurrency(t.economia_anual_bruta_r?.[idx] || t.producao_anual_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right text-green-700 font-medium">{formatCurrency(t.economia_anual_real_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right text-purple-600">-{degradacaoPct}%</td>
                          </tr>
                          );
                        })}
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

                  {/* Nova tabela: Economia de Impostos por Ano */}
                  {(t.economia_impostos_anual_r && t.economia_impostos_anual_r.length > 0) && (
                    <div className="overflow-auto border rounded border-amber-200">
                      <div className="bg-amber-50 p-2 font-medium text-amber-800 text-sm">
                        💰 Economia de Impostos por Ano (PIS + COFINS + ICMS)
                      </div>
                      <table className="min-w-full text-xs">
                        <thead className="bg-amber-50">
                          <tr>
                            <th className="p-2 text-left">Ano</th>
                            <th className="p-2 text-right">Eco. TE</th>
                            <th className="p-2 text-right">Eco. TUSD</th>
                            <th className="p-2 text-right">Eco. PIS</th>
                            <th className="p-2 text-right">Eco. COFINS</th>
                            <th className="p-2 text-right">Eco. ICMS</th>
                            <th className="p-2 text-right">Total Impostos</th>
                            <th className="p-2 text-right">Acum. Impostos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(t.ano || []).map((_, idx) => (
                            <tr key={`imp-${idx}`} className={idx % 2 ? 'bg-white' : 'bg-amber-50/30'}>
                              <td className="p-2">{t.ano[idx]}</td>
                              <td className="p-2 text-right">{formatCurrency(t.economia_te_anual_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right">{formatCurrency(t.economia_tusd_anual_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right">{formatCurrency(t.economia_pis_anual_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right">{formatCurrency(t.economia_cofins_anual_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right">{formatCurrency(t.economia_icms_anual_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(t.economia_impostos_anual_r?.[idx] || 0)}</td>
                              <td className="p-2 text-right font-semibold text-amber-700">{formatCurrency(t.economia_impostos_acumulada_r?.[idx] || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


