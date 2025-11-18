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

  return (
    <div className="h-full w-full p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Admin • Taxas de Distribuição</h1>
        <Button onClick={atualizarANEEL} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          {loading ? "Atualizando..." : "Atualizar pela ANEEL"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cadastro por Concessionária</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(items).length === 0 && <div className="text-gray-500">Nenhuma taxa cadastrada.</div>}

          <div className="space-y-3">
            {Object.entries(items).map(([slug, row]) => (
              <div key={slug} className="p-3 border rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div className="md:col-span-2">
                    <Label>Concessionária</Label>
                    <Input value={row?.nome || ""} onChange={e => setItems(prev => ({ ...prev, [slug]: { ...row, nome: e.target.value } }))} />
                  </div>
                  <div>
                    <Label>Monofásica (R$/mês)</Label>
                    <Input type="number" step="0.01" value={row?.monofasica ?? 0}
                      onChange={e => setItems(prev => ({ ...prev, [slug]: { ...row, monofasica: parseFloat(e.target.value || 0) } }))} />
                  </div>
                  <div>
                    <Label>Bifásica (R$/mês)</Label>
                    <Input type="number" step="0.01" value={row?.bifasica ?? 0}
                      onChange={e => setItems(prev => ({ ...prev, [slug]: { ...row, bifasica: parseFloat(e.target.value || 0) } }))} />
                  </div>
                  <div>
                    <Label>Trifásica (R$/mês)</Label>
                    <Input type="number" step="0.01" value={row?.trifasica ?? 0}
                      onChange={e => setItems(prev => ({ ...prev, [slug]: { ...row, trifasica: parseFloat(e.target.value || 0) } }))} />
                  </div>
                  <div>
                    <Button onClick={() => salvar(slug)} className="w-full bg-green-600 hover:bg-green-700">Salvar</Button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">Fonte: {row?.fonte || "Admin"}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
