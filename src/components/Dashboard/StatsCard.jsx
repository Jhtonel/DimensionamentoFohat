import React, { useEffect, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function StatsCard({ title, value, icon: Icon, gradient, trend, trendValue, trendDirection }) {
  const valueRef = useRef(null);
  // Detectar se value é numérico puro ou string formatada
  const isNumeric = typeof value === "number" && Number.isFinite(value);
  const numericValue = isNumeric ? value : parseFloat(String(value).replace(/[^\d.-]/g, '')) || 0;

  // Formatação inicial estática para evitar flash
  const formattedStatic = useMemo(() => {
    // Se veio string (ex: "R$ 1.000,00" ou "15%"), manter como está se não for animar
    if (!isNumeric) return value;
      return new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 0,
      }).format(value);
  }, [isNumeric, value]);

  useEffect(() => {
    // Apenas animar se tivermos um valor numérico válido e referência
    if (!valueRef.current) return;
    
    // Se o valor passado não for numérico (ex: string formatada com R$), não animamos com GSAP
    if (!isNumeric && typeof value === 'string') {
        valueRef.current.textContent = value;
        return;
    }

    const obj = { v: 0 };
    // Tentar preservar formatação se o value original era string (ex: currency)
    const isCurrency = String(value).includes('R$');
    const isPercent = String(value).includes('%');

    const fmt = new Intl.NumberFormat("pt-BR", { 
        maximumFractionDigits: isCurrency ? 2 : 0,
        minimumFractionDigits: isCurrency ? 2 : 0
    });

    const tween = gsap.to(obj, {
      v: numericValue,
      duration: 1.2,
      ease: "power3.out",
      onUpdate: () => {
        let val = fmt.format(obj.v);
        if (isCurrency) val = `R$ ${val}`;
        if (isPercent) val = `${val}%`;
        // Se o value original era string customizada, pode quebrar. 
        // Simplificação: Se não é numérico puro, não anima, renderiza direto.
        valueRef.current.textContent = val;
      },
    });
    return () => tween.kill();
  }, [numericValue, isNumeric, value]);

  // Extrair cor base do gradiente para o background sutil (hack simples)
  // Ex: "from-blue-500 ..." -> "bg-blue-50 text-blue-600"
  let colorClass = "bg-slate-100 text-slate-600";
  if (gradient?.includes("blue") || gradient?.includes("fohat-blue")) colorClass = "bg-blue-50 text-blue-600";
  else if (gradient?.includes("orange") || gradient?.includes("fohat-orange")) colorClass = "bg-orange-50 text-orange-600";
  else if (gradient?.includes("green") || gradient?.includes("emerald")) colorClass = "bg-emerald-50 text-emerald-600";
  else if (gradient?.includes("purple")) colorClass = "bg-purple-50 text-purple-600";
  else if (gradient?.includes("red") || gradient?.includes("rose")) colorClass = "bg-rose-50 text-rose-600";
  else if (gradient?.includes("yellow") || gradient?.includes("amber")) colorClass = "bg-amber-50 text-amber-600";
  else if (gradient?.includes("cyan")) colorClass = "bg-cyan-50 text-cyan-600";
  else if (gradient?.includes("indigo")) colorClass = "bg-indigo-50 text-indigo-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 p-4 h-full flex flex-col justify-between group">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
                {title}
              </span>
              <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent>
                    <p className="text-xs">{title}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            <div className="text-2xl font-bold text-slate-800 tracking-tight break-words">
              {/* Se for numérico, usa ref para animação. Se string complexa, renderiza direto */}
              {isNumeric ? <span ref={valueRef}>{formattedStatic}</span> : value}
            </div>
          </div>
          <div className={`p-2.5 rounded-lg shrink-0 ${colorClass} transition-colors group-hover:scale-110 duration-300`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {/* Área de Trend (Opcional) */}
        {(trend || trendValue) && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
             {trendDirection === 'up' ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
             ) : trendDirection === 'down' ? (
                <TrendingDown className="w-3 h-3 text-rose-500" />
             ) : (
                <Minus className="w-3 h-3 text-slate-400" />
             )}
             <span className={`text-xs font-medium ${
                trendDirection === 'up' ? 'text-emerald-600' : 
                trendDirection === 'down' ? 'text-rose-600' : 'text-slate-500'
             }`}>
                {trendValue || trend}
             </span>
             <span className="text-xs text-slate-400 ml-auto">vs mês ant.</span>
            </div>
          )}
      </div>
    </motion.div>
  );
}
