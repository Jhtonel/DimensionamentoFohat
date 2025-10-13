import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export default function StatsCard({ title, value, icon: Icon, gradient, trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group min-w-0">
        <div className={`absolute top-0 right-0 w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 bg-gradient-to-br ${gradient} opacity-10 rounded-full transform translate-x-8 -translate-y-8 sm:translate-x-10 sm:-translate-y-10 lg:translate-x-12 lg:-translate-y-12 group-hover:scale-150 transition-transform duration-500`} />
        <CardContent className="p-3 sm:p-4 lg:p-6 relative">
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide truncate">{title}</p>
              <p className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold mt-1 sm:mt-2 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {value}
              </p>
            </div>
            <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} shadow-lg flex-shrink-0 ml-2`}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
            </div>
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-xs sm:text-sm">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
              <span className="text-green-600 font-medium truncate">{trend}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}