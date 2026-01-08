import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function ConversionDoughnut({
  valuePct = 0,
  label = "Conversão",
  height = 220,
}) {
  const pct = Number(valuePct) || 0;
  const clamped = Math.max(0, Math.min(100, pct));

  const data = useMemo(
    () => ({
      labels: [label, "Restante"],
      datasets: [
        {
          data: [clamped, 100 - clamped],
          backgroundColor: ["rgba(34, 197, 94, 0.85)", "rgba(229, 231, 235, 1)"],
          borderWidth: 0,
          hoverOffset: 6,
          cutout: "72%",
        },
      ],
    }),
    [clamped, label]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          bodyFont: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 14, weight: "600" },
          titleFont: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 13, weight: "700" },
          padding: 12,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toFixed(1)}%`,
          },
        },
      },
    }),
    []
  );

  return (
    <div className="relative" style={{ height }}>
      <Doughnut data={data} options={options} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-extrabold text-slate-900">{clamped.toFixed(1)}%</div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}


