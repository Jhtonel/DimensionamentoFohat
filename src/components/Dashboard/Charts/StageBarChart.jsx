import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function StageBarChart({
  labels = [],
  values = [],
  metaValues = [], // ex.: valores em R$ por estágio (mesmo índice)
  height = 220,
}) {
  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Projetos",
          data: values,
          backgroundColor: "rgba(0, 87, 146, 0.75)",
          borderColor: "rgba(0, 87, 146, 1)",
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 44,
        },
      ],
    }),
    [labels, values]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 8, bottom: 0, left: 6 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          bodyFont: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 14, weight: "600" },
          titleFont: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 13, weight: "700" },
          padding: 12,
          boxPadding: 6,
          callbacks: {
            label: (ctx) => {
              const i = ctx.dataIndex;
              const qtd = ctx.parsed.y ?? 0;
              const meta = Number(metaValues?.[i] ?? 0);
              const metaTxt =
                meta > 0
                  ? ` | ${meta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                  : "";
              return ` ${qtd} projeto(s)${metaTxt}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            color: "rgba(51, 65, 85, 0.9)",
            font: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 13, weight: "600" },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: "rgba(51, 65, 85, 0.9)",
            font: { family: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 13, weight: "600" },
          },
          grid: { color: "rgba(148, 163, 184, 0.25)" },
        },
      },
    }),
    [metaValues]
  );

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
}


