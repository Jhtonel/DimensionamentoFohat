/**
 * Componente de Configurações (apenas para admins)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from "../../services/authService.jsx";
import { getBackendUrl } from "../../services/backendUrl.js";
import { useToast } from "@/hooks/useToast";

const Configuracoes = () => {
  const { toast } = useToast();
  const { getAuthToken } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    custo_instalacao_por_kw: 800.0,
    custo_ca_aterramento: 500.0,
    custo_homologacao: 300.0,
    custo_plaquinhas: 200.0,
    custo_obra_por_kw: 400.0,
    margem_desejada: 0.3,
    comissao_vendedor: 0.05,
    eficiencia_sistema: 0.85,
    degradacao_anual: 0.005,
    tarifas_concessionarias: {}
  });

  // Carregar configurações
  const loadConfig = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getBackendUrl()}/api/configuracao`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setFormData({
          ...data.configuracao_calculo,
          tarifas_concessionarias: data.configuracao_calculo.tarifas_concessionarias || {}
        });
      } else {
        console.error('Erro ao carregar configurações');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Salvar configurações
  const saveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = await getAuthToken();
      const response = await fetch(`${getBackendUrl()}/api/configuracao`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        toast({ title: "Sucesso", description: "Configurações salvas com sucesso!", variant: "success" });
      } else {
        const error = await response.json();
        toast({ title: "Erro", description: `Erro: ${error.error}`, variant: "destructive" });
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({ title: "Erro", description: 'Erro ao salvar configurações', variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Atualizar tarifa de concessionária
  const updateTarifa = (concessionaria, valor) => {
    setFormData({
      ...formData,
      tarifas_concessionarias: {
        ...formData.tarifas_concessionarias,
        [concessionaria]: parseFloat(valor) || 0
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h2>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={saveConfig} className="space-y-6">
          {/* Custos Operacionais */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Custos Operacionais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Custo de Instalação por kW (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={formData.custo_instalacao_por_kw}
                  onChange={(e) => setFormData({...formData, custo_instalacao_por_kw: parseFloat(e.target.value) || 0})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Custo CA + Aterramento (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={formData.custo_ca_aterramento}
                  onChange={(e) => setFormData({...formData, custo_ca_aterramento: parseFloat(e.target.value) || 0})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Custo de Homologação (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={formData.custo_homologacao}
                  onChange={(e) => setFormData({...formData, custo_homologacao: parseFloat(e.target.value) || 0})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Custo de Plaquinhas (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={formData.custo_plaquinhas}
                  onChange={(e) => setFormData({...formData, custo_plaquinhas: parseFloat(e.target.value) || 0})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Custo de Obra por kW (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={formData.custo_obra_por_kw}
                  onChange={(e) => setFormData({...formData, custo_obra_por_kw: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>

          {/* Margens e Comissões */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Margens e Comissões</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Margem Desejada (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={formData.margem_desejada}
                  onChange={(e) => setFormData({...formData, margem_desejada: parseFloat(e.target.value) || 0})}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Ex: 0.3 = 30%
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Comissão do Vendedor (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={formData.comissao_vendedor}
                  onChange={(e) => setFormData({...formData, comissao_vendedor: parseFloat(e.target.value) || 0})}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Ex: 0.05 = 5%
                </p>
              </div>
            </div>
          </div>

          {/* Eficiência e Degradação */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Eficiência e Degradação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Eficiência do Sistema (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={formData.eficiencia_sistema}
                  onChange={(e) => setFormData({...formData, eficiencia_sistema: parseFloat(e.target.value) || 0})}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Ex: 0.85 = 85%
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Degradação Anual (%)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="0.1"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  value={formData.degradacao_anual}
                  onChange={(e) => setFormData({...formData, degradacao_anual: parseFloat(e.target.value) || 0})}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Ex: 0.005 = 0.5% ao ano
                </p>
              </div>
            </div>
          </div>

          {/* Tarifas por Concessionária */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Tarifas por Concessionária</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(formData.tarifas_concessionarias).map(([concessionaria, tarifa]) => (
                <div key={concessionaria}>
                  <label className="block text-sm font-medium text-gray-700">
                    {concessionaria} (R$/kWh)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={tarifa}
                    onChange={(e) => updateTarifa(concessionaria, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Configuracoes;
