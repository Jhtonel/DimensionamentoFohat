import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Trash2, CreditCard, Building2, Save } from "lucide-react";
import { getBackendUrl } from "@/services/backendUrl.js";

const API_BASE = () => getBackendUrl();

const getAuthHeaders = () => {
  try {
    const token = localStorage.getItem("app_jwt_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const parseLocaleNumber = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return 0;
  // Aceitar "2,95" e "2.95"
  const normalized = s.replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

// Valores padrão - PoloCombate 50k (VISA/MASTER)
const TAXAS_PADRAO = {
  debito: [
    { tipo: "Débito", taxa: 1.09 },
  ],
  pagseguro: [
    { parcelas: 1, taxa: 3.16, nome: "Crédito à Vista" },
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
};

export default function AdminTaxas() {
  const base = useMemo(() => API_BASE(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estado para Formas de Pagamento
  const [formasPagamento, setFormasPagamento] = useState(TAXAS_PADRAO);

  // Carregar do servidor ou usar padrão
  const carregarPagamento = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${base}/config/formas-pagamento`, {
        headers: { ...getAuthHeaders() },
      });
      const j = await r.json();
      if (j.success && j.formas_pagamento) {
        const dados = j.formas_pagamento;
        // Se veio vazio do servidor, usa os padrões
        if (!dados.pagseguro?.length && !dados.financiamento?.length) {
          setFormasPagamento(TAXAS_PADRAO);
        } else {
          setFormasPagamento({
            debito: dados.debito || TAXAS_PADRAO.debito,
            pagseguro: dados.pagseguro || TAXAS_PADRAO.pagseguro,
            financiamento: dados.financiamento || TAXAS_PADRAO.financiamento
          });
        }
      } else {
        setFormasPagamento(TAXAS_PADRAO);
      }
    } catch (e) {
      console.error(e);
      setFormasPagamento(TAXAS_PADRAO);
    } finally {
      setLoading(false);
    }
  };

  const salvarPagamento = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${base}/config/formas-pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ formas_pagamento: formasPagamento }),
      });
      const j = await r.json();
      if (j.success) {
        alert("Taxas salvas com sucesso!");
      } else {
        alert(j.message || "Erro ao salvar.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setSaving(false);
    }
  };

  const carregarPadrao = () => {
    if (!window.confirm("Isso substituirá as configurações atuais pelos valores padrão (PoloCombate 50k - VISA/MASTER). Continuar?")) return;
    setFormasPagamento(TAXAS_PADRAO);
  };

  const adicionarLinha = (tipo) => {
    setFormasPagamento(prev => ({
      ...prev,
      [tipo]: [...(prev[tipo] || []), { parcelas: 1, taxa: 0 }]
    }));
  };

  const removerLinha = (tipo, index) => {
    setFormasPagamento(prev => ({
      ...prev,
      [tipo]: prev[tipo].filter((_, i) => i !== index)
    }));
  };

  const atualizarLinha = (tipo, index, campo, valor) => {
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
    carregarPagamento();
  }, []);

  if (loading) {
    return (
      <div className="h-full w-full p-4 sm:p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        <span className="ml-2 text-gray-600">Carregando taxas...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin • Taxas de Pagamento</h1>
        <div className="flex gap-2">
          <Button onClick={carregarPadrao} variant="outline">
            Carregar Padrão
          </Button>
          <Button onClick={salvarPagamento} disabled={saving} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Taxas"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cartão de Crédito */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Cartão (PagSeguro - PoloCombate 50k)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Taxa de Débito */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-amber-800">Débito</div>
                  <div className="text-xs text-amber-600">VISA/MASTER</div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formasPagamento.debito?.[0]?.taxa || 1.09}
                    onChange={(e) => {
                      const novaTaxa = parseLocaleNumber(e.target.value);
                      setFormasPagamento(prev => ({
                        ...prev,
                        debito: [{ tipo: "Débito", taxa: novaTaxa }]
                      }));
                    }}
                    className="h-9 w-24"
                  />
                  <span className="text-sm text-amber-700">%</span>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500">
              Taxas de parcelamento no crédito (VISA/MASTER).
            </div>
            
            <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-500 pb-2 border-b">
              <div>Parcelas</div>
              <div>Taxa (%)</div>
              <div>Ex: R$10k</div>
              <div></div>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {formasPagamento.pagseguro.map((item, index) => (
                <div key={index} className="grid grid-cols-4 gap-2 items-center">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      value={item.parcelas}
                      onChange={(e) => atualizarLinha('pagseguro', index, 'parcelas', parseInt(e.target.value) || 1)}
                      className="h-9"
                    />
                    {item.parcelas === 1 && <span className="text-xs text-green-600">à vista</span>}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.taxa}
                    onChange={(e) => atualizarLinha('pagseguro', index, 'taxa', parseLocaleNumber(e.target.value))}
                    className="h-9"
                  />
                  <div className="text-sm font-medium text-gray-700">
                    {calcularParcela(valorExemplo, item.parcelas, item.taxa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removerLinha('pagseguro', index)}
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
              onClick={() => adicionarLinha('pagseguro')}
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

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
                      onChange={(e) => atualizarLinha('financiamento', index, 'parcelas', parseInt(e.target.value) || 1)}
                      className="h-9"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.taxa}
                      onChange={(e) => atualizarLinha('financiamento', index, 'taxa', parseLocaleNumber(e.target.value))}
                      className="h-9"
                    />
                    <div className="text-sm font-medium text-gray-700">
                      {parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removerLinha('financiamento', index)}
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
              onClick={() => adicionarLinha('financiamento')}
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
                {/* Débito */}
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Débito</span>
                  <span>
                    {(valorExemplo * (1 + (formasPagamento.debito?.[0]?.taxa || 1.09) / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <hr className="my-2" />
                {/* Crédito */}
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
    </div>
  );
}
