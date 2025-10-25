import React, { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
export default function ConsumoMesAMes({ consumos, onChange }) {
  useEffect(() => {
    if (!consumos || consumos.length === 0) {
      const initialConsumos = meses.map(mes => ({ mes, kwh: "" }));
      onChange(initialConsumos);
    }
  }, [consumos?.length]);
  const handleChange = (index, value) => {
    const newConsumos = [...(consumos || [])];
    newConsumos[index] = { mes: meses[index], kwh: value };
    onChange(newConsumos);
  };

  const possuiCamposVazios = () => {
    const arr = consumos && consumos.length > 0 ? consumos : meses.map(mes => ({ mes, kwh: '' }));
    return arr.some(item => item.kwh === '' || item.kwh == null);
  };
  const consumosArray = consumos && consumos.length > 0 ? consumos : meses.map(mes => ({ mes, kwh: "" }));
  return (
    <Card className="bg-white/80 mt-4">
      <CardContent className="p-4">
        {possuiCamposVazios() && (
          <div className="mb-3 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
            Preencha todos os meses para continuar.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {meses.map((mes, index) => (
            <div key={mes} className="space-y-2">
              <Label className="text-sm">{mes}</Label>
              <Input
                type="number"
                value={consumosArray[index]?.kwh || ""}
                onChange={(e) => handleChange(index, e.target.value)}
                placeholder="kWh"
                className="bg-white"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}