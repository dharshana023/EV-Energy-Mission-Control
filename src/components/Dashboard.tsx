
import React, { useState, useEffect } from 'react';
import { Zap, Cpu, LayoutDashboard, Settings, Info, Activity, Globe, ShieldCheck, Clock, MapPin, ShieldAlert, Dices, Gamepad2, BookOpen } from 'lucide-react';
import EVOptimizer from './EVOptimizer';
import EnergyOptimizer from './EnergyOptimizer';
import Analytics from './Analytics';
import EVStations from './EVStations';
import Alerts from './Alerts';
import GambitGame from './GambitGame';
import BoardGames from './BoardGames';
import Documentation from './Documentation';
import { AlertProvider, useAlerts } from '../contexts/AlertContext';
import AlertToast from './AlertToast';

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<'ev' | 'energy' | 'analytics' | 'stations' | 'alerts' | 'game' | 'board' | 'docs'>('ev');
  const { alerts } = useAlerts();
  const [stats, setStats] = useState({
    nodes: 1284,
    sessions: 42,
    uptime: 99.99,
    throughput: 2.4
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        nodes: prev.nodes + (Math.random() > 0.7 ? 1 : Math.random() < 0.3 ? -1 : 0),
        sessions: Math.max(10, prev.sessions + (Math.random() > 0.5 ? 1 : -1)),
        uptime: Math.min(100, Math.max(99.95, prev.uptime + (Math.random() * 0.02 - 0.01))),
        throughput: Math.max(1.5, Math.min(5.0, prev.throughput + (Math.random() * 0.4 - 0.2)))
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const criticalCount = alerts.filter(a => a.type === 'Critical' && a.status === 'Active').length;

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white font-sans selection:bg-yellow-500/30">
      <AlertToast />
      {/* Top Navigation Bar */}
      <nav className="h-16 border-b border-white/10 bg-[#151619] flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Activity className="text-black" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">OPTIMA MISSION CONTROL</h1>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Advanced Optimization Suite v2.4.0</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-white/50 uppercase">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Online</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe size={12} />
              <span>Global Node: Asia-East1</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>Secure Session</span>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <button className="p-2 hover:bg-white/5 rounded-full transition-all text-white/60">
            <Settings size={20} />
          </button>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-20 md:w-64 border-r border-white/10 h-[calc(100vh-64px)] bg-[#0f1012] sticky top-16 flex flex-col">
          <div className="p-4 space-y-2 flex-1">
            <button 
              onClick={() => setActiveTab('ev')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all group ${
                activeTab === 'ev' ? 'bg-yellow-500 text-black font-bold shadow-lg shadow-yellow-500/10' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <Zap size={20} className={activeTab === 'ev' ? 'text-black' : 'group-hover:text-yellow-500'} />
              <span className="hidden md:inline text-sm font-mono uppercase tracking-wider">EV Network</span>
            </button>

            <button 
              onClick={() => setActiveTab('energy')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all group ${
                activeTab === 'energy' ? 'bg-blue-500 text-black font-bold shadow-lg shadow-blue-500/10' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <Cpu size={20} className={activeTab === 'energy' ? 'text-black' : 'group-hover:text-blue-500'} />
              <span className="hidden md:inline text-sm font-mono uppercase tracking-wider">Energy Grid</span>
            </button>

            <button 
              onClick={() => setActiveTab('game')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all group ${
                activeTab === 'game' ? 'bg-purple-500 text-black font-bold shadow-lg shadow-purple-500/10' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <Dices size={20} className={activeTab === 'game' ? 'text-black' : 'group-hover:text-purple-500'} />
              <span className="hidden md:inline text-sm font-mono uppercase tracking-wider">Game Theory Simulations</span>
            </button>

            <button 
              onClick={() => setActiveTab('board')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all group ${
                activeTab === 'board' ? 'bg-orange-500 text-black font-bold shadow-lg shadow-orange-500/10' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <Gamepad2 size={20} className={activeTab === 'board' ? 'text-black' : 'group-hover:text-orange-500'} />
              <span className="hidden md:inline text-sm font-mono uppercase tracking-wider">Sudo Go</span>
            </button>

            <div className="pt-4 mt-4 border-t border-white/5">
              <button 
                onClick={() => setActiveTab('docs')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all group ${
                  activeTab === 'docs' ? 'bg-white text-black font-bold shadow-lg shadow-white/10' : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <BookOpen size={20} className={activeTab === 'docs' ? 'text-black' : 'group-hover:text-white'} />
                <span className="hidden md:inline text-sm font-mono uppercase tracking-wider">Documentation</span>
              </button>
            </div>

            <button 
              onClick={() => setActiveTab('stations')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all group ${
                activeTab === 'stations' ? 'bg-emerald-500 text-black font-bold shadow-lg shadow-emerald-500/10' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <MapPin size={20} className={activeTab === 'stations' ? 'text-black' : 'group-hover:text-emerald-500'} />
              <span className="hidden md:inline text-sm font-mono uppercase tracking-wider">Nearest Stations</span>
            </button>

            <button 
              onClick={() => setActiveTab('alerts')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all group relative ${
                activeTab === 'alerts' ? 'bg-red-500 text-black font-bold shadow-lg shadow-red-500/10' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <Activity size={20} className={activeTab === 'alerts' ? 'text-black' : 'group-hover:text-red-500'} />
              <span className="hidden md:inline text-sm font-mono uppercase tracking-wider">Alerts</span>
              {criticalCount > 0 && (
                <div className="absolute top-2 right-2 flex items-center justify-center min-w-[18px] h-[18px] bg-red-500 text-white text-[8px] font-bold rounded-full border-2 border-[#0f1012] animate-pulse">
                  {criticalCount}
                </div>
              )}
            </button>

            <div className="pt-4 mt-4 border-t border-white/5">
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all group ${
                  activeTab === 'analytics' ? 'bg-indigo-500 text-black font-bold shadow-lg shadow-indigo-500/10' : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <LayoutDashboard size={20} className={activeTab === 'analytics' ? 'text-black' : 'group-hover:text-indigo-500'} />
                <span className="hidden md:inline text-sm font-mono uppercase tracking-wider">Analytics</span>
              </button>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg text-white/40 hover:bg-white/5 transition-all">
                <Info size={20} />
                <span className="hidden md:inline text-sm font-mono uppercase tracking-wider">Documentation</span>
              </button>
            </div>
          </div>

          <div className="p-4 border-t border-white/10">
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase mb-2">
                <span>CPU Load</span>
                <span>24%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 w-[24%]" />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto h-[calc(100vh-64px)]">
          <div className="max-w-7xl mx-auto space-y-6">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  {activeTab === 'ev' ? 'EV Network Optimization' : activeTab === 'energy' ? 'Smart Energy Grid Management' : activeTab === 'game' ? 'Game Theory Simulations' : activeTab === 'board' ? 'Sudo Go: Strategic Logic' : activeTab === 'stations' ? 'Real-time Station Locator' : activeTab === 'alerts' ? 'Real-time Grid Alerts' : activeTab === 'docs' ? 'Technical Documentation' : 'Deep Analytical Deep Dive'}
                </h2>
                <p className="text-white/50 text-sm mt-1">
                  {activeTab === 'ev' 
                    ? 'Multi-criteria decision analysis for electric vehicle charging infrastructure.' 
                    : activeTab === 'energy' 
                    ? 'Predictive modeling and load balancing for building energy efficiency.'
                    : activeTab === 'game'
                    ? 'Interactive game theory simulations and strategic modeling for autonomous agents.'
                    : activeTab === 'board'
                    ? 'Interactive Sudoku and Go strategy modules for logical training and strategic recreation.'
                    : activeTab === 'stations'
                    ? 'Real-time geolocation and availability tracking for nearest charging nodes.'
                    : activeTab === 'alerts'
                    ? 'Live monitoring of grid events, critical failures, and system status updates.'
                    : activeTab === 'docs'
                    ? 'Comprehensive technical manual and architectural flow documentation.'
                    : 'Advanced statistical analysis and correlation modeling for grid stability.'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <Clock size={12} className="text-yellow-500" />
                <span className="text-white/60 uppercase">Last Update: {new Date().toLocaleTimeString()}</span>
              </div>
            </header>

            {/* Content Switch */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {activeTab === 'ev' ? <EVOptimizer /> : activeTab === 'energy' ? <EnergyOptimizer /> : activeTab === 'game' ? <GambitGame /> : activeTab === 'board' ? <BoardGames /> : activeTab === 'stations' ? <EVStations /> : activeTab === 'alerts' ? <Alerts /> : activeTab === 'docs' ? <Documentation /> : <Analytics />}
            </div>


            {/* Footer Stats */}
            <footer className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-12">
              {[
                { label: 'Total Nodes', value: stats.nodes.toLocaleString(), color: 'text-blue-400' },
                { label: 'Active Sessions', value: stats.sessions.toString(), color: 'text-emerald-400' },
                { label: 'System Uptime', value: `${stats.uptime.toFixed(2)}%`, color: 'text-yellow-400' },
                { label: 'Data Throughput', value: `${stats.throughput.toFixed(1)} GB/s`, color: 'text-purple-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-[#151619] p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all">
                  <span className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">{stat.label}</span>
                  <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AlertProvider>
      <DashboardContent />
    </AlertProvider>
  );
}
