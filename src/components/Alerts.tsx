
import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, ShieldAlert, Filter, Trash2, Check, Clock, Activity, Zap, Cpu } from 'lucide-react';
import { GridAlert } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlerts } from '../contexts/AlertContext';

export default function Alerts() {
  const { 
    alerts, 
    acknowledgeAlert, 
    resolveAlert, 
    deleteAlert, 
    clearAll,
    isLive,
    setIsLive 
  } = useAlerts();
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Warning' | 'Info' | 'Success'>('All');

  const filteredAlerts = alerts.filter(a => filter === 'All' || a.type === filter);

  const stats = {
    critical: alerts.filter(a => a.type === 'Critical' && a.status !== 'Resolved').length,
    warning: alerts.filter(a => a.type === 'Warning' && a.status !== 'Resolved').length,
    active: alerts.filter(a => a.status === 'Active').length
  };

  return (
    <div className="space-y-6">
      {/* Alert Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#151619] p-4 rounded-2xl border border-white/10 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <ShieldAlert size={60} />
          </div>
          <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20">
            <ShieldAlert className="text-red-500" size={24} />
          </div>
          <div>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Critical Alerts</p>
            <h3 className="text-2xl font-bold font-mono text-white">{stats.critical}</h3>
          </div>
        </div>

        <div className="bg-[#151619] p-4 rounded-2xl border border-white/10 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <AlertTriangle size={60} />
          </div>
          <div className="p-3 bg-yellow-500/10 rounded-full border border-yellow-500/20">
            <AlertTriangle className="text-yellow-500" size={24} />
          </div>
          <div>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Warnings</p>
            <h3 className="text-2xl font-bold font-mono text-white">{stats.warning}</h3>
          </div>
        </div>

        <div className="bg-[#151619] p-4 rounded-2xl border border-white/10 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Activity size={60} />
          </div>
          <div className="p-3 bg-blue-500/10 rounded-full border border-blue-500/20">
            <Activity className="text-blue-500" size={24} />
          </div>
          <div>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Active Events</p>
            <h3 className="text-2xl font-bold font-mono text-white">{stats.active}</h3>
          </div>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="bg-[#151619] p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-white/40" />
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            {['All', 'Critical', 'Warning', 'Info', 'Success'].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t as any)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase transition-all ${
                  filter === t ? 'bg-white/10 text-white font-bold' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
            <span className="text-[10px] font-mono text-white/40 uppercase">Live Monitoring</span>
            <button 
              onClick={() => setIsLive(!isLive)}
              className={`px-3 py-1 rounded-lg text-[10px] font-mono uppercase border transition-all ${
                isLive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'
              }`}
            >
              {isLive ? 'Active' : 'Paused'}
            </button>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <button 
            onClick={clearAll}
            className="p-2 hover:bg-red-500/10 text-white/40 hover:text-red-400 rounded-lg transition-all"
            title="Clear All"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filteredAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-[#151619] rounded-2xl border transition-all overflow-hidden ${
                alert.status === 'Resolved' ? 'border-white/5 opacity-60' : 
                alert.type === 'Critical' ? 'border-red-500/30' : 
                alert.type === 'Warning' ? 'border-yellow-500/30' : 'border-white/10'
              }`}
            >
              <div className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className={`p-2 rounded-xl border shrink-0 ${
                  alert.type === 'Critical' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                  alert.type === 'Warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                  alert.type === 'Success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                  'bg-blue-500/10 border-blue-500/20 text-blue-500'
                }`}>
                  {alert.type === 'Critical' ? <ShieldAlert size={20} /> :
                   alert.type === 'Warning' ? <AlertTriangle size={20} /> :
                   alert.type === 'Success' ? <CheckCircle size={20} /> :
                   <Info size={20} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${
                      alert.type === 'Critical' ? 'text-red-500' :
                      alert.type === 'Warning' ? 'text-yellow-500' :
                      alert.type === 'Success' ? 'text-emerald-500' :
                      'text-blue-500'
                    }`}>
                      {alert.type} EVENT
                    </span>
                    <span className="text-[10px] font-mono text-white/20 uppercase">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                    {alert.status !== 'Active' && (
                      <span className="text-[8px] font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-white/40 uppercase">
                        {alert.status}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white mb-0.5 truncate">{alert.source}</h4>
                  <p className="text-xs text-white/50 font-mono leading-relaxed">{alert.message}</p>
                </div>

                {alert.value && (
                  <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 shrink-0">
                    <span className="block text-[8px] text-white/30 uppercase font-mono mb-0.5">Telemetry</span>
                    <span className={`text-sm font-bold font-mono ${alert.type === 'Critical' ? 'text-red-400' : 'text-white'}`}>
                      {alert.value}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                  {alert.status === 'Active' && (
                    <button 
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono border border-white/10 transition-all"
                    >
                      <Check size={12} /> ACK
                    </button>
                  )}
                  {alert.status !== 'Resolved' && (
                    <button 
                      onClick={() => resolveAlert(alert.id)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono border border-emerald-500/20 transition-all"
                    >
                      <CheckCircle size={12} /> RESOLVE
                    </button>
                  )}
                  <button 
                    onClick={() => deleteAlert(alert.id)}
                    className="p-1.5 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredAlerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
            <Bell size={40} className="text-white/10 mb-4" />
            <p className="text-sm font-mono text-white/30 uppercase">No alerts found in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}
