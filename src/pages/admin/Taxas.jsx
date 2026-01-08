import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, CreditCard, Building2, Save, Zap } from "lucide-react";

const API_BASE = () => {
  const host = window.location.hostname;
  return `http://${host}:8000`;
};

export default function AdminTaxas() {
  const base = useMemo(() => API_BASE(), []);
  const [activeTab, setActiveTab] = useState("distribuicao");
  
  // Estado para Taxas de Distribuição
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(false);

  // Estado para Formas de Pagamento
  const [formasPagamento, setFormasPagamento] = useState({
    pagseguro: [],
    financiamento: []
  });
  const [savingPagamento, setSavingPagamento] = useState(false);

  // ====== TAXAS DE DISTRIBUIÇÃO ======
  const carregarDistribuicao = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${base}/config/taxas-distribuicao`);
      const j = await r.json();
      if (j.success) setItems(j.items || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const salvarDistribuicao = async (slug) => {
    const row = items[slug];
    const body = {
      concessionaria: slug,
      nome: row?.nome || slug,
      monofasica: row?.monofasica || 0,
      bifasica: row?.bifasica || 0,
      trifasica: row?.trifasica || 0,
      fonte: row?.fonte || "Admin",
    };
    const r = await fetch(`${base}/config/taxas-distribuicao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.success) setItems(j.items || {});
    else alert(j.message || "Erro ao salvar.");
  };

  const atualizarANEEL = async () => {
    if (!window.confirm("Atualizar automaticamente pela ANEEL?")) return;
    setLoading(true);
    try {
      const r = await fetch(`${base}/config/taxas-distribuicao/atualizar-aneel`, { method: "POST" });
      const j = await r.json();
      if (j.success) setItems(j.items || {});
      else alert(j.message || "Erro ao atualizar pela ANEEL.");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const carregarPadraoDistribuicao = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${base}/config/taxas-distribuicao/popular-padrao`, { method: "POST" });
      const j = await r.json();
      if (j.success) {
        setItems(j.items || {});
        alert(j.message || "Concessionárias carregadas com sucesso!");
      }
      else alert(j.message || "Erro ao carregar concessionárias.");
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // ====== FORMAS DE PAGAMENTO ======
  const carregarPagamento = async () => {
    try {
      const r = await fetch(`${base}/config/formas-pagamento`);
      const j = await r.json();
      if (j.success) {
        setFormasPagamento(j.formas_pagamento || { pagseguro: [], financiamento: [] });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const salvarPagamento = async () => {
    setSavingPagamento(true);
    try {
      const r = await fetch(`${base}/config/formas-pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formas_pagamento: formasPagamento }),
      });
      const j = await r.json();
      if (j.success) {
        alert("Taxas de pagamento salvas com sucesso!");
      } else {
        alert(j.message || "Erro ao salvar.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setSavingPagamento(false);
    }
  };

  const carregarPadraoPagamento = () => {
    if (!window.confirm("Isso substituirá as configurações atuais pelos valores padrão. Continuar?")) return;
    
    setFormasPagamento({
      pagseguro: [
        { parcelas: 1, taxa: 3.16 },
        { parcelas: 2, taxa: 4.57 },
        { parcelas: 3, taxa: 5.38 },
        { parcelas: 4, taxa: 6.18 },
        { parcelas: 5, taxa: 6.97 },
        { parcelas: 6, taxa: 7.75 },
        { parcelas: 7, taxa: 8.92 },
        { parcelas: 8, taxa: 9.68 },
        { parcelas: 9, taxa: 10.44 },
        { parcelas: 10, taxa: 11.19 },
        { parcelas: 11, taxa: 11.93 },
        { parcelas: 12, taxa: 12.66 },
        { parcelas: 13, taxa: 13.89 },
        { parcelas: 14, taxa: 14.60 },
        { parcelas: 15, taxa: 15.31 },
        { parcelas: 16, taxa: 16.01 },
        { parcelas: 17, taxa: 16.70 },
        { parcelas: 18, taxa: 17.39 },
      ],
      financiamento: [
        { parcelas: 12, taxa: 1.95 },
        { parcelas: 24, taxa: 1.95 },
        { parcelas: 36, taxa: 1.95 },
        { parcelas: 48, taxa: 1.95 },
        { parcelas: 60, taxa: 1.95 },
        { parcelas: 72, taxa: 1.95 },
        { parcelas: 84, taxa: 1.95 },
        { parcelas: 96, taxa: 1.95 },
      ]
    });
  };

  const adicionarLinhaPagamento = (tipo) => {
    setFormasPagamento(prev => ({
      ...prev,
      [tipo]: [...prev[tipo], { parcelas: 1, taxa: 0 }]
    }));
  };

  const removerLinhaPagamento = (tipo, index) => {
    setFormasPagamento(prev => ({
      ...prev,
      [tipo]: prev[tipo].filter((_, i) => i !== index)
    }));
  };

  const atualizarLinhaPagamento = (tipo, index, campo, valor) => {
    setFormasPagamento(prev => ({
      ...prev,
      [tipo]: prev[tipo].map((item, i) => 
        i === index ? { ...item, [campo]: valor } : item
      )
    }));
  };

  const calcularParcela = (valor, parcelas, taxa) => {
    if (!valor || !parcelas || taxa === undefined) return 0;
    const valorComTaxa = valor * (1 + taxa / 100);
    return valorComTaxa / parcelas;
  };

  const valorExemplo = 10000;

  useEffect(() => {
    carregarDistribuicao();
    carregarPagamento();
  }, []);

  return (
    <div className="h-full w-full p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin • Taxas e Pagamentos</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="distribuicao" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Distribuição
          </TabsTrigger>
          <TabsTrigger value="pagamento" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Pagamento
          </TabsTrigger>
        </TabsList>

        {/* TAB: Taxas de Distribuição */}
        <TabsContent value="distribuicao" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={carregarPadraoDistribuicao} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? "Carregando..." : "Carregar Concessionárias"}
            </Button>
            <Button onClick={atualizarANEEL} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "Atualizando..." : "Atualizar pela ANEEL"}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Taxas de Distribuição por Concessionária</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(items).length === 0 && (
                <div className="text-gray-500 text-center py-8">
                  Nenhuma taxa cadastrada. Clique em "Carregar Concessionárias" para começar.
                </div>
              )}

              <div className="space-y-3">
                {Object.entries(items).map(([slug, row]) => (
                  <div key={slug} className="p-4 border rounded-lg bg-gray-50 hover:bg-white transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                      <div className="md:col-span-2">
                        <Label className="text-xs text-gray-500">Concessionária</Label>
                        <Input value={row?.nome || ""} className="font-medium" onChange={e => setItems(prev => ({ ...prev, [slug]: { ...row, nome: e.target.value } }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Tarifa (R$/kWh)</Label>
                        <Input type="number" step="0.001" value={row?.tarifa_kwh ?? 0} className="bg-blue-50"
                          onChange={e => {
                            const tarifa = parseFloat(e.target.value || 0);
                            setItems(prev => ({ 
                              ...prev, 
                              [slug]: { 
                                ...row, 
                                tarifa_kwh: tarifa,
                                monofasica: Math.round(tarifa * 30 * 100) / 100,
                                bifasica: Math.round(tarifa * 50 * 100) / 100,
                                trifasica: Math.round(tarifa * 100 * 100) / 100
                              } 
                            }));
                          }} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Monofásica (R$)</Label>
                        <Input type="number" step="0.01" value={row?.monofasica ?? 0}
                          onChange={e => setItems(prev => ({ ...prev, [slug]: { ...row, monofasica: parseFloat(e.target.value || 0) } }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Bifásica (R$)</Label>
                        <Input type="number" step="0.01" value={row?.bifasica ?? 0}
                          onChange={e => setItems(prev => ({ ...prev, [slug]: { ...row, bifasica: parseFloat(e.target.value || 0) } }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Trifásica (R$)</Label>
                        <Input type="number" step="0.01" value={row?.trifasica ?? 0}
                          onChange={e => setItems(prev => ({ ...prev, [slug]: { ...row, trifasica: parseFloat(e.target.value || 0) } }))} />
                      </div>
                      <div>
                        <Button onClick={() => salvarDistribuicao(slug)} className="w-full bg-sky-600 hover:bg-sky-700">Salvar</Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>📋 {row?.fonte || "Admin"}</span>
                      {row?.vigencia && <span>📅 Vigência: {row.vigencia}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Formas de Pagamento */}
        <TabsContent value="pagamento" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={carregarPadraoPagamento} variant="outline">
              Carregar Padrão
            </Button>
            <Button onClick={salvarPagamento} disabled={savingPagamento} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />
              {savingPagamento ? "Salvando..." : "Salvar Taxas"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PagSeguro */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Cartão de Crédito (PagSeguro)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="text-sm text-gray-500 mb-2">
                  Taxas de parcelamento no cartão de crédito. A taxa é aplicada sobre o valor total.
                </div>
                
                <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-500 pb-2 border-b">
                  <div>Parcelas</div>
                  <div>Taxa (%)</div>
                  <div>Ex: R$10k</div>
                  <div></div>
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {formasPagamento.pagseguro.map((item, index) => (
                    <div key={index} className="grid grid-cols-4 gap-2 items-center">
                      <Input
                        type="number"
                        min="1"
                        max="24"
                        value={item.parcelas}
                        onChange={(e) => atualizarLinhaPagamento('pagseguro', index, 'parcelas', parseInt(e.target.value) || 1)}
                        className="h-9"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.taxa}
                        onChange={(e) => atualizarLinhaPagamento('pagseguro', index, 'taxa', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                      <div className="text-sm font-medium text-gray-700">
                        {calcularParcela(valorExemplo, item.parcelas, item.taxa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removerLinhaPagamento('pagseguro', index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adicionarLinhaPagamento('pagseguro')}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Parcela
                </Button>
              </CardContent>
            </Card>

            {/* Financiamento */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Financiamento Bancário
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="text-sm text-gray-500 mb-2">
                  Taxas de financiamento bancário (juros mensais - tabela Price).
                </div>
                
                <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-500 pb-2 border-b">
                  <div>Parcelas</div>
                  <div>Taxa a.m. (%)</div>
                  <div>Ex: R$10k</div>
                  <div></div>
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {formasPagamento.financiamento.map((item, index) => {
                    const taxaMensal = item.taxa / 100;
                    const parcela = taxaMensal > 0 
                      ? valorExemplo * (taxaMensal * Math.pow(1 + taxaMensal, item.parcelas)) / (Math.pow(1 + taxaMensal, item.parcelas) - 1)
                      : valorExemplo / item.parcelas;
                    
                    return (
                      <div key={index} className="grid grid-cols-4 gap-2 items-center">
                        <Input
                          type="number"
                          min="1"
                          max="120"
                          value={item.parcelas}
                          onChange={(e) => atualizarLinhaPagamento('financiamento', index, 'parcelas', parseInt(e.target.value) || 1)}
                          className="h-9"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.taxa}
                          onChange={(e) => atualizarLinhaPagamento('financiamento', index, 'taxa', parseFloat(e.target.value) || 0)}
                          className="h-9"
                        />
                        <div className="text-sm font-medium text-gray-700">
                          {parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerLinhaPagamento('financiamento', index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adicionarLinhaPagamento('financiamento')}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Parcela
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview da Proposta (exemplo: R$ 10.000,00)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                  <h4 className="font-bold text-green-700 mb-3 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Cartão de Crédito
                  </h4>
                  <div className="space-y-1 text-sm">
                    {formasPagamento.pagseguro.slice(0, 6).map((item, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{item.parcelas}x de</span>
                        <span className="font-semibold">
                          {calcularParcela(valorExemplo, item.parcelas, item.taxa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    ))}
                    {formasPagamento.pagseguro.length > 6 && (
                      <div className="text-gray-500 text-xs mt-2">... e mais {formasPagamento.pagseguro.length - 6} opções</div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                  <h4 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Financiamento Bancário
                  </h4>
                  <div className="space-y-1 text-sm">
                    {formasPagamento.financiamento.map((item, index) => {
                      const taxaMensal = item.taxa / 100;
                      const parcela = taxaMensal > 0 
                        ? valorExemplo * (taxaMensal * Math.pow(1 + taxaMensal, item.parcelas)) / (Math.pow(1 + taxaMensal, item.parcelas) - 1)
                        : valorExemplo / item.parcelas;
                      
                      return (
                        <div key={index} className="flex justify-between">
                          <span>{item.parcelas}x de</span>
                          <span className="font-semibold">
                            {parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
