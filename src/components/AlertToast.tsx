
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, X, Bell } from 'lucide-react';
import { useAlerts } from '../contexts/AlertContext';
import { GridAlert } from '../types';

export default function AlertToast() {
  const { alerts, deleteAlert } = useAlerts();
  const [visibleAlerts, setVisibleAlerts] = useState<GridAlert[]>([]);

  // Only show critical and warning alerts as toasts
  useEffect(() => {
    setVisibleAlerts(prev => {
      const newAlerts = alerts.filter(a => 
        (a.type === 'Critical' || a.type === 'Warning') && 
        a.status === 'Active' &&
        !prev.find(va => va.id === a.id)
      );
      
      if (newAlerts.length === 0) return prev;
      return [...newAlerts, ...prev].slice(0, 3);
    });
  }, [alerts]);

  const removeToast = (id: string) => {
    setVisibleAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {visibleAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className={`pointer-events-auto w-80 bg-[#151619] border rounded-2xl p-4 shadow-2xl ${
              alert.type === 'Critical' ? 'border-red-500/50 shadow-red-500/10' : 'border-yellow-500/50 shadow-yellow-500/10'
            }`}
          >
            <div className="flex gap-3">
              <div className={`p-2 rounded-xl border shrink-0 ${
                alert.type === 'Critical' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
              }`}>
                {alert.type === 'Critical' ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${
                    alert.type === 'Critical' ? 'text-red-500' : 'text-yellow-500'
                  }`}>
                    {alert.type} ALERT
                  </span>
                  <button 
                    onClick={() => removeToast(alert.id)}
                    className="text-white/20 hover:text-white/60 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <h4 className="text-xs font-bold text-white mb-0.5 truncate">{alert.source}</h4>
                <p className="text-[10px] text-white/50 font-mono leading-relaxed line-clamp-2">{alert.message}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[8px] font-mono text-white/20 uppercase">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
              <button 
                onClick={() => removeToast(alert.id)}
                className="text-[9px] font-bold font-mono text-white/60 hover:text-white uppercase tracking-wider"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
