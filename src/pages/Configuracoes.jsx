import React, { useState, useEffect } from "react";
import { Configuracao } from "@/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save } from "lucide-react";
import { motion } from "framer-motion";

export default function Configuracoes() {
  const [configs, setConfigs] = useState([]);
  const [propostaConfigs, setPropostaConfigs] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const instalacaoFaixas = [
    { key: "instalacao_faixa_1_5_base", label: "1–5" },
    { key: "instalacao_faixa_6_10_base", label: "6–10" },
    { key: "instalacao_faixa_11_20_base", label: "11–20" },
    { key: "instalacao_faixa_21_40_base", label: "21–40" },
    { key: "instalacao_faixa_41_80_base", label: "41–80" },
  ];

  const renderInstalacaoPorFaixa = () => {
    // Mantemos +10% de segurança como padrão de cálculo, mas UI mostra apenas faixa + preço final.
    const pct = Number(propostaConfigs.instalacao_percentual_seguranca ?? 10) || 10;
    const calc = (base) => {
      const b = Number(base || 0) || 0;
      const add = b * (pct / 100);
      const fin = b + add;
      const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
      return { base: r2(b), add: r2(add), fin: r2(fin) };
    };
    const inv = (final) => {
      const fin = Number(final || 0) || 0;
      const denom = 1 + (pct / 100);
      const base = denom > 0 ? fin / denom : fin;
      const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
      return { base: r2(base), fin: r2(fin) };
    };

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-blue-200 overflow-hidden bg-white">
          <div className="grid grid-cols-2 gap-0 bg-blue-100 text-blue-900 text-sm font-semibold">
            <div className="px-3 py-2">Faixa (placas)</div>
            <div className="px-3 py-2">Final (R$/placa)</div>
          </div>
          {instalacaoFaixas.map((f) => {
            const baseValue =
              propostaConfigs?.[f.key] ??
              ({
                instalacao_faixa_1_5_base: 400,
                instalacao_faixa_6_10_base: 199.31,
                instalacao_faixa_11_20_base: 150,
                instalacao_faixa_21_40_base: 140,
                instalacao_faixa_41_80_base: 125,
              }[f.key] ?? 0);
            const { fin } = calc(baseValue);
            return (
              <div key={f.key} className="grid grid-cols-2 gap-0 border-t border-blue-100 text-sm">
                <div className="px-3 py-2 text-gray-700">{f.label}</div>
                <div className="px-3 py-1.5">
                  <Input
                    type="number"
                    step="0.01"
                    value={fin}
                    onChange={(e) => {
                      const nextFinal = parseFloat(e.target.value);
                      const { base: nextBase } = inv(nextFinal);
                      setPropostaConfigs((prev) => ({
                        ...prev,
                        // garantir que pct exista mesmo que nunca tenha sido salvo
                        instalacao_percentual_seguranca: prev?.instalacao_percentual_seguranca ?? 10,
                        [f.key]: nextBase,
                      }));
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoadError("");
    try {
      const configsData = await Configuracao.list();
      setConfigs(configsData);

      // Carregar configurações de proposta
      const propostaConfig = configsData.find(c => c.chave === "proposta_configs");
      if (propostaConfig) {
        // Compatibilidade: se vier config antiga (até 20), expor também o campo novo (até 25)
        const normalized = { ...propostaConfig };
        if (normalized.homologacao_ate_25_kwp == null && normalized.homologacao_ate_20_kwp != null) {
          normalized.homologacao_ate_25_kwp = normalized.homologacao_ate_20_kwp;
        }
        setPropostaConfigs(normalized);
      } else {
        const newPropostaConfig = {
          chave: "proposta_configs",
          tipo: "proposta",
          aumento_anual_energia: 4.1,
          margem_base: 25,
          comissao_vendedor_padrao: 5,
          // Instalação por placa (por faixa) + segurança
          instalacao_percentual_seguranca: 10,
          instalacao_faixa_1_5_base: 400,
          instalacao_faixa_6_10_base: 199.31,
          instalacao_faixa_11_20_base: 150,
          instalacao_faixa_21_40_base: 140,
          instalacao_faixa_41_80_base: 125,
          custo_ca_aterramento_por_placa: 100,
          custo_placas_sinalizacao: 60,
          percentual_obra_instalacao: 10,
          percentual_despesas_gerais: 10,
          percentual_despesas_diretoria: 1,
          percentual_impostos: 3.3,
          percentual_divisao_lucro: 40,
          percentual_fundo_caixa: 20,
          // Tabela Fohat (homologação por faixa)
          homologacao_ate_10_kwp: 500,
          homologacao_ate_25_kwp: 1000,
          homologacao_ate_50_kwp: 1500,
          homologacao_ate_75_kwp: 2000,
          // Compatibilidade com chave antiga
          homologacao_ate_20_kwp: 1000
        };
        setPropostaConfigs(newPropostaConfig);
      }
    } catch (e) {
      console.error("Erro ao carregar configurações:", e);
      setLoadError(e?.message || "Erro ao carregar configurações");
      setConfigs([]);
    }
  };

  const handleSavePropostaConfigs = async () => {
    setLoading(true);
    try {
      // Garantir compatibilidade: persistir também a chave antiga (ate_20) com o valor do ate_25
      const payload = {
        ...propostaConfigs,
        homologacao_ate_20_kwp: propostaConfigs.homologacao_ate_25_kwp ?? propostaConfigs.homologacao_ate_20_kwp
      };
      if (payload.id) {
        const saved = await Configuracao.update(payload.id, payload);
        if (saved) setPropostaConfigs(saved);
      } else {
        const saved = await Configuracao.create(payload);
        if (saved) setPropostaConfigs(saved);
      }
      alert('Configurações de proposta salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações de proposta:', error);
      alert(error?.message || 'Erro ao salvar configurações de proposta');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      <div className="w-full space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-600 to-orange-500 bg-clip-text text-transparent flex items-center gap-3">
            <Settings className="w-10 h-10 text-sky-600" />
            Configurações
          </h1>
          <p className="text-gray-600 mt-2">Configure tarifas e equipamentos</p>
        </motion.div>

        <div className="space-y-6">
          {loadError ? (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700">Erro ao carregar/salvar configurações</CardTitle>
              </CardHeader>
              <CardContent className="text-red-700">
                {loadError}
              </CardContent>
            </Card>
          ) : null}
          <Card className="glass-card border-0 shadow-2xl">
            <CardHeader className="border-b border-sky-100">
              <CardTitle className="text-2xl font-bold text-sky-700">Equipamentos</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="font-semibold text-blue-900">Custos do Projeto</h4>
                    <div>
                      <Label>Instalação por placa (por faixa)</Label>
                      {renderInstalacaoPorFaixa()}
                    </div>
                    <div>
                      <Label>Custo CA/Aterramento por Placa (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.custo_ca_aterramento_por_placa ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, custo_ca_aterramento_por_placa: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Custo Placas Sinalização (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.custo_placas_sinalizacao ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, custo_placas_sinalizacao: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Obra (% sobre instalação)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={propostaConfigs.percentual_obra_instalacao ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, percentual_obra_instalacao: parseFloat(e.target.value) }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="font-semibold text-blue-900">Homologação (por faixa)</h4>
                    <div>
                      <Label>até 10 kWp (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.homologacao_ate_10_kwp ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, homologacao_ate_10_kwp: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>10,1 até 25 kWp (R$)</Label>
                      <Input
                        type="number"
                        value={(propostaConfigs.homologacao_ate_25_kwp ?? propostaConfigs.homologacao_ate_20_kwp) ?? 0}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setPropostaConfigs(prev => ({ ...prev, homologacao_ate_25_kwp: v, homologacao_ate_20_kwp: v }));
                        }}
                      />
                    </div>
                    <div>
                      <Label>25,1 até 50 kWp (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.homologacao_ate_50_kwp ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, homologacao_ate_50_kwp: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>50,1 até 75 kWp (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.homologacao_ate_75_kwp ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, homologacao_ate_75_kwp: parseFloat(e.target.value) }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSavePropostaConfigs}
                  disabled={loading}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Custos
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 shadow-2xl">
            <CardHeader className="border-b border-sky-100">
              <CardTitle className="text-2xl font-bold text-sky-700">Configurações de Proposta</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700">Parâmetros Financeiros</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Aumento Anual da Energia (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={propostaConfigs.aumento_anual_energia || 4.1}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, aumento_anual_energia: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Margem Base (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={propostaConfigs.margem_base || 25}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, margem_base: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Comissão Vendedor Padrão (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={propostaConfigs.comissao_vendedor_padrao || 5}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, comissao_vendedor_padrao: parseFloat(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700">Custos Operacionais</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Instalação por placa (por faixa)</Label>
                      {renderInstalacaoPorFaixa()}
                    </div>
                    <div>
                      <Label>Custo CA/Aterramento por Placa (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.custo_ca_aterramento_por_placa || 100}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, custo_ca_aterramento_por_placa: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Custo Placas Sinalização (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.custo_placas_sinalizacao || 60}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, custo_placas_sinalizacao: parseFloat(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700">Percentuais DRE</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Despesas Gerais (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={propostaConfigs.percentual_despesas_gerais || 10}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, percentual_despesas_gerais: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Despesas Diretoria (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={propostaConfigs.percentual_despesas_diretoria || 1}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, percentual_despesas_diretoria: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Impostos (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={propostaConfigs.percentual_impostos || 3.3}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, percentual_impostos: parseFloat(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700">Distribuição de Lucro</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Divisão de Lucro (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={propostaConfigs.percentual_divisao_lucro || 40}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, percentual_divisao_lucro: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>Fundo Caixa (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={propostaConfigs.percentual_fundo_caixa || 20}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, percentual_fundo_caixa: parseFloat(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSavePropostaConfigs} 
                  disabled={loading}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}