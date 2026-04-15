
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { Activity, TrendingUp, Zap, BarChart3, PieChart as PieIcon, Share2, AlertCircle, Clock, ArrowUpRight, Calendar, Filter, Download, RotateCcw, LayoutGrid, LayoutList, Info, ArrowRight, ShieldAlert } from 'lucide-react';
import { predictUsage, calculateSigma, getHistoricalData, TRANSITION_MATRIX } from '../services/energyService';
import { useAlerts } from '../contexts/AlertContext';

const COLORS = ['#3b82f6', '#fbbf24', '#ef4444', '#10b981', '#8b5cf6'];

export default function Analytics() {
  const { addAlert } = useAlerts();
  const [predictionData, setPredictionData] = useState<any[]>([]);
  const [steadyState, setSteadyState] = useState<any[]>([]);
  const [correlationData, setCorrelationData] = useState<any[]>([]);
  const [currentInitial, setCurrentInitial] = useState<number[]>([0.5, 0.3, 0.2]);
  
  // Historical Data States
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, average: 0, peak: 0, efficiency: 0, loadFactor: 0 });
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [isDownloading, setIsDownloading] = useState(false);
  const [stateHistory, setStateHistory] = useState<any[]>([]);
  const [isChanging, setIsChanging] = useState(false);
  const lastAlerted = React.useRef<boolean>(false);

  const peakProb = predictionData.find(p => p.state === 'High')?.probability || 0;

  useEffect(() => {
    const { data, metrics: m } = getHistoricalData(dateRange.start, dateRange.end);
    setHistoricalData(data);
    setMetrics(m);

    // Generate some mock historical correlation data
    const mockCorrelation = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      congestion: Math.floor(Math.random() * 60) + 20,
      evDemand: Math.floor(Math.random() * 40) + 10 + (i > 7 && i < 10 ? 30 : 0) + (i > 16 && i < 20 ? 40 : 0),
      gridLoad: Math.floor(Math.random() * 50) + 30
    }));
    setCorrelationData(mockCorrelation);

    // Markov Chain Steady State (Mock calculation for visualization)
    setSteadyState([
      { name: 'Low Usage', value: 45, color: '#3b82f6', range: '< 30% Load' },
      { name: 'Medium Usage', value: 35, color: '#fbbf24', range: '30% - 70% Load' },
      { name: 'High Usage', value: 20, color: '#ef4444', range: '> 70% Load' },
    ]);

    // Generate simulated state history for the last 24 hours
    const states = ['Low', 'Medium', 'High'];
    let currentStateIdx = 0;
    const history = Array.from({ length: 24 }, (_, i) => {
      const time = `${(i + 8) % 24}:00`;
      // Use transition matrix logic for a more realistic walk
      const r = Math.random();
      const row = TRANSITION_MATRIX[currentStateIdx];
      if (r < row[0]) currentStateIdx = 0;
      else if (r < row[0] + row[1]) currentStateIdx = 1;
      else currentStateIdx = 2;

      return {
        time,
        state: states[currentStateIdx],
        value: currentStateIdx + 1, // 1, 2, 3 for visualization
        color: currentStateIdx === 0 ? '#3b82f6' : currentStateIdx === 1 ? '#fbbf24' : '#ef4444'
      };
    });
    setStateHistory(history);
  }, [dateRange]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setIsChanging(true);
      // Slightly fluctuate the initial state to simulate changing conditions
      setCurrentInitial(prev => {
        const next = prev.map(v => Math.max(0.1, Math.min(0.8, v + (Math.random() - 0.5) * 0.1)));
        const sum = next.reduce((a, b) => a + b, 0);
        return next.map(v => v / sum);
      });
      setTimeout(() => setIsChanging(false), 2000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pred = predictUsage(currentInitial, 12);
    setPredictionData(pred);
  }, [currentInitial]);

  // Alert System
  useEffect(() => {
    if (peakProb > 0.85) {
      if (!lastAlerted.current) {
        addAlert({
          type: 'Critical',
          source: 'Analytics Engine',
          message: `CRITICAL LOAD RISK: Peak probability reached ${(peakProb * 100).toFixed(1)}%. Grid stability compromised.`,
          value: `${(peakProb * 100).toFixed(1)}%`
        });
        lastAlerted.current = true;
      }
    } else {
      lastAlerted.current = false;
    }
  }, [peakProb, addAlert]);

  const handleDownloadReport = () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      alert('Report generated and downloaded successfully.');
    }, 1500);
  };

  const resetDateRange = () => {
    setDateRange({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="space-y-6 pb-12 relative">
      {/* Analytics Header Stats */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <BarChart3 size={20} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight uppercase font-mono">System Analytics</h2>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Real-time Markov Chain & Grid Stability Metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isChanging ? 'bg-red-500 animate-ping' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
          <span className={`text-[10px] font-mono uppercase tracking-widest ${isChanging ? 'text-red-400' : 'text-emerald-400'}`}>
            {isChanging ? 'Processing Stream...' : 'Live Data Stable'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mb-2 block">Markov Stability</span>
            <h4 className="text-3xl font-bold text-blue-400 tracking-tight">0.842</h4>
            <p className="text-[10px] text-emerald-500 mt-2 flex items-center gap-1 font-mono">
              <ArrowUpRight size={12} /> +2.4% FROM LAST CYCLE
            </p>
          </div>
        </div>

        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mb-2 block">Grid Efficiency</span>
            <h4 className="text-3xl font-bold text-emerald-400 tracking-tight">96.8%</h4>
            <p className="text-[10px] text-emerald-500 mt-2 flex items-center gap-1 font-mono">
              <ArrowUpRight size={12} /> OPTIMAL RANGE
            </p>
          </div>
        </div>

        <div className={`bg-[#151619] p-6 rounded-2xl border transition-all duration-500 relative overflow-hidden group ${peakProb > 0.25 ? 'border-red-500 shadow-lg shadow-red-500/10' : 'border-white/10'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mb-2 block">Peak Probability</span>
            <h4 className={`text-3xl font-bold tracking-tight transition-colors ${peakProb > 0.25 ? 'text-red-500' : 'text-blue-400'}`}>
              {(peakProb * 100).toFixed(1)}%
            </h4>
            <p className={`text-[10px] mt-2 flex items-center gap-1 font-mono ${peakProb > 0.25 ? 'text-red-400 animate-pulse' : 'text-white/30'}`}>
              <AlertCircle size={12} /> {peakProb > 0.25 ? 'HIGH LOAD ALERT' : 'NORMAL LOAD'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Markov Chain Deep Dive */}
        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest flex items-center gap-2">
                <Share2 size={14} /> Markov State Analysis
              </h3>
              <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Steady-State Distribution & State Definitions</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 text-[10px] text-white/40">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> Low
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/40">
                <div className="w-2 h-2 rounded-full bg-yellow-500" /> Med
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/40">
                <div className="w-2 h-2 rounded-full bg-red-500" /> High
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            <div className="h-[250px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={steadyState}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {steadyState.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#151619', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-[8px] font-mono text-white/30 uppercase">Convergence</span>
                <span className="text-xl font-bold">98.2%</span>
              </div>
            </div>

            <div className="space-y-4 flex flex-col justify-center">
              {steadyState.map((state) => (
                <div key={state.name} className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold font-mono text-white/80 uppercase">{state.name}</span>
                    <span className="text-[10px] font-bold font-mono" style={{ color: state.color }}>{state.value}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-white/30 font-mono italic">{state.range}</span>
                    <div className="flex items-center gap-1">
                      <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full" style={{ backgroundColor: state.color, width: `${state.value}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Info size={12} className="text-blue-400" />
              <span className="text-[10px] font-bold font-mono text-white/60 uppercase">Transition Logic</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-[8px] text-white/30 uppercase font-mono mb-1">Stability</div>
                <div className="text-xs font-bold font-mono text-emerald-400">HIGH</div>
              </div>
              <div className="text-center border-x border-white/5">
                <div className="text-[8px] text-white/30 uppercase font-mono mb-1">Entropy</div>
                <div className="text-xs font-bold font-mono text-blue-400">0.42 bits</div>
              </div>
              <div className="text-center">
                <div className="text-[8px] text-white/30 uppercase font-mono mb-1">Mixing Time</div>
                <div className="text-xs font-bold font-mono text-yellow-400">4.2 Steps</div>
              </div>
            </div>
          </div>
        </div>

        {/* Markov State History */}
        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} /> Markov State History
              </h3>
              <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">24-Hour Usage State Transitions</p>
            </div>
            <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10 text-[9px] font-mono text-white/40">
              LIVE_FEED_ACTIVE
            </div>
          </div>
          
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stateHistory}>
                <defs>
                  <linearGradient id="colorState" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis 
                  domain={[0.5, 3.5]} 
                  ticks={[1, 2, 3]} 
                  tickFormatter={(val) => val === 1 ? 'LOW' : val === 2 ? 'MED' : 'HIGH'}
                  tick={{ fontSize: 9, fill: '#888' }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#151619] border border-white/10 p-2 rounded-lg shadow-xl font-mono">
                          <p className="text-[10px] text-white/40 mb-1">{data.time}</p>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                            <span className="text-xs font-bold" style={{ color: data.color }}>{data.state} USAGE</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="stepAfter" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  fillOpacity={1} 
                  fill="url(#colorState)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[8px] text-white/30 uppercase font-mono">Dominant State</span>
                <span className="text-xs font-bold font-mono text-blue-400">LOW (45.8%)</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[8px] text-white/30 uppercase font-mono">Transitions</span>
                <span className="text-xs font-bold font-mono text-white">14 / 24h</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400">
              <Activity size={12} className="animate-pulse" />
              <span>STABLE</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Historical Consumption Analysis */}
        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <Clock size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest flex items-center gap-2">
                  Historical Consumption Analysis
                </h3>
                <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Retrospective Grid Load & Performance Metrics</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
              <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                <Calendar size={14} className="text-blue-400" />
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="bg-transparent text-[11px] font-mono text-white/70 outline-none cursor-pointer"
                />
                <span className="text-white/20 text-[11px]">→</span>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="bg-transparent text-[11px] font-mono text-white/70 outline-none cursor-pointer"
                />
                <button 
                  onClick={resetDateRange}
                  className="ml-2 p-1 hover:bg-white/10 rounded transition-colors text-white/30 hover:text-white/60"
                  title="Reset Range"
                >
                  <RotateCcw size={12} />
                </button>
              </div>

              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                <button 
                  onClick={() => setChartType('line')}
                  className={`p-2 rounded-lg transition-all ${chartType === 'line' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-white/30 hover:text-white/60'}`}
                >
                  <LayoutList size={14} />
                </button>
                <button 
                  onClick={() => setChartType('bar')}
                  className={`p-2 rounded-lg transition-all ${chartType === 'bar' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-white/30 hover:text-white/60'}`}
                >
                  <LayoutGrid size={14} />
                </button>
              </div>

              <button 
                onClick={handleDownloadReport}
                disabled={isDownloading}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-[11px] font-bold font-mono transition-all shadow-lg shadow-blue-500/20"
              >
                {isDownloading ? (
                  <span className="animate-pulse">GENERATING...</span>
                ) : (
                  <>
                    <Download size={14} /> DOWNLOAD REPORT
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Total Energy', value: `${metrics.total.toLocaleString()} kWh`, color: 'text-white' },
              { label: 'Daily Average', value: `${metrics.average.toFixed(1)} kWh`, color: 'text-blue-400' },
              { label: 'Peak Load', value: `${metrics.peak} kWh`, color: 'text-red-400' },
              { label: 'Avg Efficiency', value: `${metrics.efficiency.toFixed(1)}%`, color: 'text-emerald-400' },
              { label: 'Load Factor', value: `${metrics.loadFactor.toFixed(1)}%`, color: 'text-yellow-400' },
            ].map((m, i) => (
              <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5">
                <span className="block text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">{m.label}</span>
                <span className={`text-lg font-bold font-mono ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#151619', border: '1px solid #333', borderRadius: '12px', fontSize: '11px' }}
                    itemStyle={{ padding: '2px 0' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="consumption" 
                    name="Daily Consumption (kWh)" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="peakLoad" 
                    name="Peak Load (kWh)" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              ) : (
                <BarChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#151619', border: '1px solid #333', borderRadius: '12px', fontSize: '11px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  <Bar dataKey="consumption" name="Daily Consumption (kWh)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="peakLoad" name="Peak Load (kWh)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Multi-Objective Optimization Sensitivity */}
        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={14} /> Optimization Sensitivity Analysis
              </h3>
              <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Impact of Goal Programming Weights on System Utility</p>
            </div>
            <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10 text-[10px] font-mono text-white/50">
              MODE: SENSITIVITY_SCAN_ACTIVE
            </div>
          </div>
          
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Cost Priority', utility: 85, efficiency: 92, comfort: 65 },
                { name: 'Balanced', utility: 92, efficiency: 88, comfort: 85 },
                { name: 'Comfort Priority', utility: 78, efficiency: 75, comfort: 98 },
                { name: 'Efficiency Priority', utility: 88, efficiency: 98, comfort: 70 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #333', borderRadius: '8px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                <Bar dataKey="utility" name="Overall Utility" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="efficiency" name="System Efficiency" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="comfort" name="User Comfort" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
