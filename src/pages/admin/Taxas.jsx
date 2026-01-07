import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const API_BASE = () => {
  const host = window.location.hostname;
  // Porta padrão do backend Flask (ajuste se diferente)
  return `http://${host}:8000`;
};

export default function AdminTaxas() {
  const base = useMemo(() => API_BASE(), []);
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
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

  useEffect(() => { carregar(); }, []);

  const salvar = async (slug) => {
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

  const carregarPadrao = async () => {
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

  return (
    <div className="h-full w-full p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Admin • Taxas de Distribuição</h1>
        <div className="flex gap-2">
          <Button onClick={carregarPadrao} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? "Carregando..." : "Carregar Concessionárias"}
          </Button>
          <Button onClick={atualizarANEEL} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? "Atualizando..." : "Atualizar pela ANEEL"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cadastro por Concessionária</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(items).length === 0 && <div className="text-gray-500">Nenhuma taxa cadastrada.</div>}

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
                    <Button onClick={() => salvar(slug)} className="w-full bg-fohat-blue hover:bg-fohat-dark">Salvar</Button>
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
    </div>
  );
}



