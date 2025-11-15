import React, { useState, useEffect } from "react";
import { Configuracao } from "@/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Plus, Trash2, Save } from "lucide-react";
import { motion } from "framer-motion";

export default function Configuracoes() {
  const [configs, setConfigs] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [equipamentos, setEquipamentos] = useState({});
  const [propostaConfigs, setPropostaConfigs] = useState({});
  const [loading, setLoading] = useState(false);
  const [novaTarifa, setNovaTarifa] = useState({ concessionaria: "", tarifa_kwh: "" });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    const configsData = await Configuracao.list();
    setConfigs(configsData);
    
    const tarifasData = configsData.filter(c => c.tipo === "tarifa");
    setTarifas(tarifasData);

    const equipConfig = configsData.find(c => c.chave === "potencia_placa");
    if (equipConfig) {
      setEquipamentos(equipConfig);
    } else {
      const newEquip = {
        chave: "potencia_placa",
        tipo: "equipamento",
        potencia_placa_padrao_w: 600
      };
      setEquipamentos(newEquip);
    }

    const eficConfig = configsData.find(c => c.chave === "eficiencia_sistema");
    if (!eficConfig) {
      await Configuracao.create({
        chave: "eficiencia_sistema",
        tipo: "equipamento",
        eficiencia_sistema: 0.80
      });
    }

    // Carregar configurações de proposta
    const propostaConfig = configsData.find(c => c.chave === "proposta_configs");
    if (propostaConfig) {
      setPropostaConfigs(propostaConfig);
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
        homologacao_ate_5_kwp: 465,
        homologacao_ate_10_kwp: 565,
        homologacao_ate_20_kwp: 765,
        homologacao_ate_50_kwp: 865,
        homologacao_ate_75_kwp: 1065,
        vendedor_nome: "Representante Comercial",
        vendedor_cargo: "Especialista em Energia Solar",
        vendedor_telefone: "(11) 99999-9999",
        vendedor_email: "contato@empresa.com"
      };
      setPropostaConfigs(newPropostaConfig);
    }
  };

  const handleSavePropostaConfigs = async () => {
    setLoading(true);
    try {
      if (propostaConfigs.id) {
        await Configuracao.update(propostaConfigs.id, propostaConfigs);
      } else {
        await Configuracao.create(propostaConfigs);
      }
      alert('Configurações de proposta salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações de proposta:', error);
      alert('Erro ao salvar configurações de proposta');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEquipamentos = async () => {
    setLoading(true);
    try {
      // Salvar configuração de equipamentos (ex.: potência padrão)
      if (equipamentos.id) {
        await Configuracao.update(equipamentos.id, equipamentos);
      } else {
        await Configuracao.create(equipamentos);
      }
      // Salvar custos e percentuais editáveis ligados à proposta
      if (propostaConfigs.id) {
        await Configuracao.update(propostaConfigs.id, propostaConfigs);
      } else {
        await Configuracao.create(propostaConfigs);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddTarifa = async () => {
    if (!novaTarifa.concessionaria || !novaTarifa.tarifa_kwh) return;
    
    setLoading(true);
    
    await Configuracao.create({
      chave: `tarifa_${novaTarifa.concessionaria.toLowerCase().replace(/\s+/g, '_')}`,
      tipo: "tarifa",
      concessionaria: novaTarifa.concessionaria,
      tarifa_kwh: parseFloat(novaTarifa.tarifa_kwh)
    });
    
    setNovaTarifa({ concessionaria: "", tarifa_kwh: "" });
    loadConfigs();
    setLoading(false);
  };

  const handleDeleteTarifa = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta tarifa?")) {
      await Configuracao.delete(id);
      loadConfigs();
    }
  };

  const handleUpdateTarifa = async (tarifa) => {
    await Configuracao.update(tarifa.id, tarifa);
    loadConfigs();
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
              <CardTitle className="text-2xl font-bold text-sky-700 flex items-center justify-between">
                <span>Tarifas das Concessionárias</span>
                <span className="text-sm font-normal text-gray-600 bg-sky-100 px-3 py-1 rounded-full">
                  {tarifas.length} concessionárias
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <Card className="bg-sky-50 border-sky-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sky-700">
                    <Plus className="w-5 h-5" />
                    Adicionar Nova Tarifa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Concessionária</Label>
                      <Input
                        value={novaTarifa.concessionaria}
                        onChange={(e) => setNovaTarifa(prev => ({ ...prev, concessionaria: e.target.value }))}
                        placeholder="Ex: CPFL Paulista"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tarifa (R$/kWh)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={novaTarifa.tarifa_kwh}
                        onChange={(e) => setNovaTarifa(prev => ({ ...prev, tarifa_kwh: e.target.value }))}
                        placeholder="0.750"
                        className="bg-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={handleAddTarifa}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-sky-500 to-sky-600"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {tarifas.map((tarifa) => (
                  <Card key={tarifa.id} className="bg-white border-sky-200 hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 truncate" title={tarifa.concessionaria}>
                            {tarifa.concessionaria}
                          </h4>
                          <p className="text-2xl font-bold text-sky-600 mt-1">
                            R$ {tarifa.tarifa_kwh?.toFixed(3)}
                          </p>
                          <p className="text-xs text-gray-500">por kWh</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTarifa(tarifa.id)}
                          className="text-red-600 hover:bg-red-50 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.001"
                          value={tarifa.tarifa_kwh}
                          onChange={(e) => {
                            const updated = { ...tarifa, tarifa_kwh: parseFloat(e.target.value) };
                            setTarifas(prev => prev.map(t => t.id === tarifa.id ? updated : t));
                          }}
                          className="bg-gray-50 flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleUpdateTarifa(tarifa)}
                          className="bg-green-600 hover:bg-green-700 flex-shrink-0"
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

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
                      <Label>até 20 kWp (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.homologacao_ate_20_kwp ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, homologacao_ate_20_kwp: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>até 50 kWp (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.homologacao_ate_50_kwp ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, homologacao_ate_50_kwp: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label>até 75 kWp (R$)</Label>
                      <Input
                        type="number"
                        value={propostaConfigs.homologacao_ate_75_kwp ?? 0}
                        onChange={(e) => setPropostaConfigs(prev => ({ ...prev, homologacao_ate_75_kwp: parseFloat(e.target.value) }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gray-50 border-gray-200">
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-gray-900">Parâmetros de Equipamento</h4>
                  <div>
                    <Label>Potência Padrão da Placa (W)</Label>
                    <Input
                      type="number"
                      value={equipamentos.potencia_placa_padrao_w || 600}
                      onChange={(e) => setEquipamentos(prev => ({ ...prev, potencia_placa_padrao_w: parseFloat(e.target.value) }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveEquipamentos}
                  disabled={loading}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Equipamentos
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

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">Dados do Vendedor</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome do Vendedor</Label>
                    <Input
                      value={propostaConfigs.vendedor_nome || "Representante Comercial"}
                      onChange={(e) => setPropostaConfigs(prev => ({ ...prev, vendedor_nome: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Cargo</Label>
                    <Input
                      value={propostaConfigs.vendedor_cargo || "Especialista em Energia Solar"}
                      onChange={(e) => setPropostaConfigs(prev => ({ ...prev, vendedor_cargo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={propostaConfigs.vendedor_telefone || "(11) 99999-9999"}
                      onChange={(e) => setPropostaConfigs(prev => ({ ...prev, vendedor_telefone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input
                      value={propostaConfigs.vendedor_email || "contato@empresa.com"}
                      onChange={(e) => setPropostaConfigs(prev => ({ ...prev, vendedor_email: e.target.value }))}
                    />
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