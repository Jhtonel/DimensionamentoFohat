import React, { useEffect, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function StatsCard({ title, value, icon: Icon, gradient, trend }) {
  const valueRef = useRef(null);
  const isNumeric = typeof value === "number" && Number.isFinite(value);

  const formattedStatic = useMemo(() => {
    if (isNumeric) {
      return new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value;
  }, [isNumeric, value]);

  useEffect(() => {
    if (!isNumeric || !valueRef.current) return;
    const el = valueRef.current;
    const obj = { v: 0 };
    const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
    const tween = gsap.to(obj, {
      v: value,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = fmt.format(obj.v);
      },
    });
    return () => tween.kill();
  }, [isNumeric, value]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group min-w-0">
        <CardContent className="p-3 sm:p-3 lg:p-4 relative">
          <div className="flex justify-between items-start mb-1 sm:mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs sm:text-xs font-medium text-gray-600 uppercase tracking-wide truncate">{title}</p>
                <TooltipProvider delayDuration={250}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                        aria-label={`Info: ${title}`}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{title}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-base sm:text-lg lg:text-xl font-bold mt-1 sm:mt-1 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                <span ref={valueRef}>{formattedStatic}</span>
              </p>
            </div>
            <div className={`p-2 sm:p-2 rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} shadow-lg flex-shrink-0 ml-2`}>
              <Icon className="w-4 h-4 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" />
            </div>
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-xs sm:text-xs">
              <TrendingUp className="w-3 h-3 sm:w-3 sm:h-3 text-green-500 flex-shrink-0" />
              <span className="text-green-600 font-medium truncate">{trend}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}