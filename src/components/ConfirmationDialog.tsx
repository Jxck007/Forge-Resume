import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X, RefreshCw, Layers } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}: ConfirmationDialogProps) {
  
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 className="h-6 w-6 text-rose-500" />;
      case 'info':
        return <Layers className="h-6 w-6 text-indigo-500" />;
      case 'warning':
      default:
        return <AlertTriangle className="h-6 w-6 text-amber-500" />;
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 text-white';
      case 'info':
        return 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white';
      case 'warning':
      default:
        return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop wrapper */}
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-[#090A0F]/80 backdrop-blur-xs transition-opacity"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#13151A] p-6 text-left shadow-2xl transition-all"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-650 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-start gap-4 mt-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                  {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-950 dark:text-zinc-100 leading-tight">
                    {title}
                  </h3>
                  <p className="mt-2 text-xs md:text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {message}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`w-full sm:w-auto inline-flex justify-center items-center rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-colors cursor-pointer ${getButtonClass()}`}
                >
                  {confirmText}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-[#0F1115] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  {cancelText}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
