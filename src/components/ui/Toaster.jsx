import React from 'react';
import { useToast } from '../../hooks/useToast';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../utils';

const icons = {
  default: <Info className="w-5 h-5 text-blue-500" />,
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  destructive: <AlertCircle className="w-5 h-5 text-red-500" />,
};

const bgColors = {
  default: 'bg-white border-gray-200',
  success: 'bg-white border-green-200',
  error: 'bg-white border-red-200',
  warning: 'bg-white border-yellow-200',
  destructive: 'bg-white border-red-200',
};

export function Toaster() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            layout
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-lg border",
              bgColors[toast.variant] || bgColors.default,
              toast.className // Allow custom classes
            )}
          >
            <div className="shrink-0 mt-0.5">
              {icons[toast.variant] || icons.default}
            </div>
            <div className="flex-1 grid gap-1">
              {toast.title && (
                <div className="text-sm font-semibold text-gray-900">
                  {toast.title}
                </div>
              )}
              {toast.description && (
                <div className="text-sm text-gray-600">
                  {toast.description}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

