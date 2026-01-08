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

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
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
      // Se não existir "até 5", usar o mesmo de "até 10" (mantém consistência com a tabela)
      if (normalized.homologacao_ate_5_kwp == null && normalized.homologacao_ate_10_kwp != null) {
        normalized.homologacao_ate_5_kwp = normalized.homologacao_ate_10_kwp;
      }
      setPropostaConfigs(normalized);
    } else {
      const newPropostaConfig = {
        chave: "proposta_configs",
        tipo: "proposta",
        aumento_anual_energia: 4.1,
        margem_base: 25,
        comissao_vendedor_padrao: 5,
        custo_instalacao_por_placa: 200,
        custo_ca_aterramento_por_placa: 100,
        custo_placas_sinalizacao: 60,
        percentual_obra_instalacao: 10,
        percentual_despesas_gerais: 10,
        percentual_despesas_diretoria: 1,
        percentual_impostos: 3.3,
        percentual_divisao_lucro: 40,
        percentual_fundo_caixa: 20,
        // Tabela Fohat (homologação por faixa)
        homologacao_ate_5_kwp: 500,
        homologacao_ate_10_kwp: 500,
        homologacao_ate_25_kwp: 1000,
        homologacao_ate_50_kwp: 1500,
        homologacao_ate_75_kwp: 2000,
        // Compatibilidade com chave antiga
        homologacao_ate_20_kwp: 1000
      };
      setPropostaConfigs(newPropostaConfig);
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
        await Configuracao.update(payload.id, payload);
      } else {
        await Configuracao.create(payload);
      }
      alert('Configurações de proposta salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações de proposta:', error);
      alert('Erro ao salvar configurações de proposta');
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
                      <Label>Custo Instalação por Placa (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.custo_instalacao_por_placa ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, custo_instalacao_por_placa: parseFloat(e.target.value) }))}
                      />
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
                      <Label>até 5 kWp (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.homologacao_ate_5_kwp ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, homologacao_ate_5_kwp: parseFloat(e.target.value) }))}
                      />
                    </div>
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
                      <Label>Custo Instalação por Placa (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.custo_instalacao_por_placa || 200}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, custo_instalacao_por_placa: parseFloat(e.target.value) }))}
                      />
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