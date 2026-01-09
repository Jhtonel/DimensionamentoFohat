import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBackendUrl } from "@/services/backendUrl.js";

const getAuthHeaders = () => {
  try {
    const token = localStorage.getItem("app_jwt_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const pretty = (obj) => {
  try {
    return JSON.stringify(obj ?? null, null, 2);
  } catch {
    return String(obj);
  }
};

export default function AdminCalculos() {
  const base = useMemo(() => getBackendUrl(), []);
  const [propostaId, setPropostaId] = useState("");
  const [includeRender, setIncludeRender] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const fetchReport = async () => {
    const id = String(propostaId || "").trim();
    if (!id) {
      setError("Informe um ID de proposta.");
      return;
    }
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const qs = includeRender ? "?render=1" : "";
      const resp = await fetch(`${base}/admin/propostas/${encodeURIComponent(id)}/calculos${qs}`, {
        headers: { ...getAuthHeaders() },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) {
        throw new Error(json?.message || `Erro ao buscar relatório (${resp.status})`);
      }
      setReport(json?.report || null);
    } catch (e) {
      setError(e?.message || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(pretty(report));
    } catch {
      // fallback silencioso
    }
  };

  const warnings = report?.warnings || [];
  const precoFmt = report?.pricing?.preco_final_formatado;
  const placeholdersLeft = report?.render_diagnostics?.placeholders_remaining_count;

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Admin • Debug de Cálculos da Proposta</CardTitle>
          <p className="text-sm text-gray-600">
            Exibe um relatório completo do que o backend calcula para gerar a proposta (dimensionamento, gráficos, pagamentos e diagnósticos).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">ID da proposta</label>
              <Input
                value={propostaId}
                onChange={(e) => setPropostaId(e.target.value)}
                placeholder="Ex.: 2f5c7c3a-..."
                autoComplete="off"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
              <input
                type="checkbox"
                checked={includeRender}
                onChange={(e) => setIncludeRender(e.target.checked)}
              />
              Incluir diagnóstico de render (placeholders)
            </label>
            <div className="flex gap-2">
              <Button onClick={fetchReport} disabled={loading}>
                {loading ? "Buscando..." : "Buscar"}
              </Button>
              <Button variant="secondary" onClick={copyAll} disabled={!report}>
                Copiar JSON
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {report && (
            <div className="flex flex-wrap gap-2 pt-1">
              {precoFmt && <Badge variant="secondary">Preço: {precoFmt}</Badge>}
              <Badge variant={warnings.length ? "destructive" : "secondary"}>
                Warnings: {warnings.length}
              </Badge>
              {includeRender && typeof placeholdersLeft === "number" && (
                <Badge variant={placeholdersLeft ? "destructive" : "secondary"}>
                  Placeholders não substituídos: {placeholdersLeft}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="resumo">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="dimensionamento">Dimensionamento</TabsTrigger>
                <TabsTrigger value="graficos">Gráficos</TabsTrigger>
                <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
                <TabsTrigger value="payload">Payload</TabsTrigger>
                <TabsTrigger value="json">JSON completo</TabsTrigger>
              </TabsList>

              <TabsContent value="resumo" className="space-y-3">
                {warnings?.length > 0 && (
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                    <div className="text-sm font-semibold text-yellow-900 mb-2">Warnings</div>
                    <ul className="list-disc pl-5 text-sm text-yellow-900 space-y-1">
                      {warnings.map((w, i) => (
                        <li key={i}>{String(w)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {includeRender && report?.render_diagnostics && (
                  <div className="rounded-md border bg-white p-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Diagnóstico de render</div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div>HTML (chars): {report.render_diagnostics.html_size_chars}</div>
                      <div>Placeholders restantes: {report.render_diagnostics.placeholders_remaining_count}</div>
                    </div>
                    {report.render_diagnostics.placeholders_remaining_unique?.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-sky-700">
                          Ver placeholders restantes (únicos)
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-50 p-3 text-xs">
                          {pretty(report.render_diagnostics.placeholders_remaining_unique)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                <pre className="max-h-[520px] overflow-auto rounded bg-gray-50 p-4 text-xs">
                  {pretty({
                    meta: report?.meta,
                    pricing: report?.pricing,
                  })}
                </pre>
              </TabsContent>

              <TabsContent value="dimensionamento" className="space-y-3">
                <details open className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">HTML (placeholders)</summary>
                  <pre className="mt-2 max-h-[520px] overflow-auto rounded bg-gray-50 p-3 text-xs">
                    {pretty(report?.dimensionamento?.html)}
                  </pre>
                </details>
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Charts (com irradiância mensal)</summary>
                  <pre className="mt-2 max-h-[520px] overflow-auto rounded bg-gray-50 p-3 text-xs">
                    {pretty(report?.dimensionamento?.charts)}
                  </pre>
                </details>
              </TabsContent>

              <TabsContent value="graficos" className="space-y-3">
                <pre className="max-h-[620px] overflow-auto rounded bg-gray-50 p-4 text-xs">
                  {pretty(report?.graficos)}
                </pre>
              </TabsContent>

              <TabsContent value="pagamentos" className="space-y-3">
                <details open className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Persistidos no payload</summary>
                  <pre className="mt-2 max-h-[520px] overflow-auto rounded bg-gray-50 p-3 text-xs">
                    {pretty(report?.pagamentos?.persistidos_no_payload)}
                  </pre>
                </details>
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Formas de pagamento (config)</summary>
                  <pre className="mt-2 max-h-[520px] overflow-auto rounded bg-gray-50 p-3 text-xs">
                    {pretty(report?.pagamentos?.formas_pagamento)}
                  </pre>
                </details>
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Calculado no backend (HTML de parcelas)</summary>
                  <pre className="mt-2 max-h-[520px] overflow-auto rounded bg-gray-50 p-3 text-xs">
                    {pretty(report?.pagamentos?.calculado_no_backend)}
                  </pre>
                </details>
              </TabsContent>

              <TabsContent value="payload" className="space-y-3">
                <pre className="max-h-[720px] overflow-auto rounded bg-gray-50 p-4 text-xs">
                  {pretty(report?.payload_raw)}
                </pre>
              </TabsContent>

              <TabsContent value="json" className="space-y-3">
                <pre className="max-h-[720px] overflow-auto rounded bg-gray-50 p-4 text-xs">
                  {pretty(report)}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


