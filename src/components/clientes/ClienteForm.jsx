import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { X, Save } from "lucide-react";
import cepService from "@/services/cepService.js";
export default function ClienteForm({ cliente, onSave, onCancel, usuarios, currentUser }) {
  const [formData, setFormData] = useState(cliente || {
    nome: "",
    telefone: "",
    email: "",
    endereco_completo: "",
    cep: "",
    tipo: "residencial",
    observacoes: "",
    created_by: currentUser?.uid || ""
  });
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepHint, setCepHint] = useState("");

  const cepValido = useMemo(() => {
    try {
      return formData?.cep ? cepService.validarCEP(formData.cep) : false;
    } catch {
      return false;
    }
  }, [formData?.cep]);

  const handleBuscarCEP = async () => {
    setCepHint("");
    if (!formData?.cep || !cepService.validarCEP(formData.cep)) {
      setCepHint("Digite um CEP válido (8 dígitos).");
      return;
    }
    setLoadingCep(true);
    try {
      const dados = await cepService.buscarCEP(formData.cep);
      setFormData(prev => ({
        ...prev,
        cep: cepService.formatarCEP(dados.cep),
        endereco_completo: cepService.montarEnderecoCompleto(dados),
      }));
      setCepHint("CEP encontrado e endereço preenchido.");
    } catch (e) {
      setCepHint(e?.message ? `Erro ao buscar CEP: ${e.message}` : "Erro ao buscar CEP.");
    } finally {
      setLoadingCep(false);
    }
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="glass-card border-0 shadow-2xl">
        <CardHeader className="border-b border-sky-100">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">
              {cliente ? "Editar Cliente" : "Novo Cliente"}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleChange("nome", e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="bg-white/50 border-sky-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(value) => handleChange("tipo", value)}>
                  <SelectTrigger className="bg-white/50 border-sky-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residencial">Residencial</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentUser?.role === 'admin' && (
                <div className="space-y-2">
                  <Label htmlFor="created_by">Responsável (Admin)</Label>
                  <Select value={formData.created_by || currentUser?.uid} onValueChange={(value) => handleChange("created_by", value)}>
                    <SelectTrigger className="bg-white/50 border-sky-200">
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios?.map(u => (
                        <SelectItem key={u.uid} value={u.uid}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleChange("telefone", e.target.value)}
                  placeholder="(00) 00000-0000"
                  required
                  className="bg-white/50 border-sky-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="email@exemplo.com"
                  className="bg-white/50 border-sky-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => handleChange("cep", e.target.value)}
                    onBlur={() => {
                      // UX: se o usuário digitou um CEP completo, já tenta buscar ao sair do campo
                      if (cepService.validarCEP(formData.cep)) handleBuscarCEP();
                    }}
                    placeholder="00000-000"
                    className="bg-white/50 border-sky-200"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBuscarCEP}
                    disabled={loadingCep || !cepValido}
                    className="shrink-0"
                    title={!cepValido ? "Digite um CEP válido" : "Buscar CEP"}
                  >
                    {loadingCep ? "Buscando..." : "Buscar CEP"}
                  </Button>
                </div>
                {cepHint ? (
                  <p className={`text-xs ${cepHint.startsWith("Erro") ? "text-red-600" : "text-gray-600"}`}>
                    {cepHint}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco_completo">Endereço Completo</Label>
                <Input
                  id="endereco_completo"
                  value={formData.endereco_completo}
                  onChange={(e) => handleChange("endereco_completo", e.target.value)}
                  placeholder="Rua - Bairro, Cidade/UF"
                  className="bg-white/50 border-sky-200"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleChange("observacoes", e.target.value)}
                  placeholder="Observações sobre o cliente..."
                  className="bg-white/50 border-sky-200 h-24"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button 
                type="submit"
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}