import React from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const OPTIONS = [
  { value: "all", label: "Todo período" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "month", label: "Este mês" },
];

export default function DateRangeSelect({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-44 border-gray-200 focus:ring-fohat-blue">
        <SelectValue placeholder="Período" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


