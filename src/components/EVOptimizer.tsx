
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { MapPin, Zap, DollarSign, Navigation, Shield, User, Activity, Clock, TrendingUp, AlertCircle, RefreshCw, Play, CheckCircle2 } from 'lucide-react';
import { getChargingStations, filterDominance, applyTopsis, applyNashEquilibrium } from '../services/evService';
import { getPredictedEVDemand } from '../services/energyService';
import { ChargingStation, OptimizationWeights, OptimizationMethod } from '../types';
import { useAlerts } from '../contexts/AlertContext';
import SensitivityAnalysis from './SensitivityAnalysis';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function EVOptimizer() {
  const { addAlert } = useAlerts();
  const [stations, setStations] = useState<ChargingStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<OptimizationMethod>("TOPSIS");
  const [weights, setWeights] = useState<OptimizationWeights>({
    speed: 0.8, cost: 0.6, dist: 0.7, accessibility: 0.5,
    reliability: 0.6, safety: 0.6, ux: 0.5, realTime: 0.7
  });
  const [useDominance, setUseDominance] = useState(true);
  const [gridLoad, setGridLoad] = useState(45); // 0-100%
  const [evDemand, setEvDemand] = useState(30); // 0-100%
  const [isDynamic, setIsDynamic] = useState(true);
  const [isChanging, setIsChanging] = useState(false);
  const lastAlerted = React.useRef<{ grid: string | null, ev: string | null }>({ grid: null, ev: null });
  const [thresholds, setThresholds] = useState({
    gridWarning: 80,
    gridCritical: 90,
    evWarning: 70,
    evCritical: 85
  });

  const handleOptimize = async () => {
    setLoading(true);
    // Default to Chennai coordinates
    const lat = 13.0827;
    const lon = 80.2707;
    const raw = await getChargingStations(lat, lon);
    
    // Get predicted demand for the current hour to influence dynamic adjustments
    const predictions = getPredictedEVDemand(lat, lon);
    const peakPredictedDemand = Math.max(...predictions.map(p => p.demand));
    const avgPredictedDemand = predictions.reduce((acc, p) => acc + p.demand, 0) / predictions.length;

    let processed: ChargingStation[] = raw.map(s => {
      let adjustedSpeed = s.speed;
      let adjustedCost = s.cost;

      if (isDynamic) {
        // Grid Load Impact: High load reduces speed
        const gridReduction = gridLoad > 70 ? (gridLoad - 70) / 100 : 0;
        
        // EV Demand Impact: High demand (current or predicted) reduces speed due to shared infrastructure
        const effectiveDemand = (evDemand * 0.7) + (avgPredictedDemand * 0.3);
        const demandReduction = effectiveDemand > 50 ? (effectiveDemand - 50) / 120 : 0;
        
        adjustedSpeed = s.speed * (1 - gridReduction - demandReduction);
        
        // Surge Pricing
        const loadSurge = gridLoad > 50 ? (gridLoad - 50) / 50 : 0;
        const demandSurge = Math.max(evDemand, peakPredictedDemand) > 40 
          ? (Math.max(evDemand, peakPredictedDemand) - 40) / 40 
          : 0;
          
        adjustedCost = s.cost * (1 + loadSurge + demandSurge);
      }

      const finalSpeed = Math.max(10, Number(adjustedSpeed.toFixed(1)));
      
      // Predict charging time for a standard 50kWh charge (20% to 80% on a 83kWh battery)
      // Time (hours) = Energy (kWh) / Power (kW)
      const energyNeeded = 50; 
      const predictedTimeMinutes = (energyNeeded / finalSpeed) * 60;

      return {
        ...s,
        speed: finalSpeed,
        cost: Number(adjustedCost.toFixed(2)),
        predictedTime: Math.round(predictedTimeMinutes)
      };
    });

    processed = useDominance ? filterDominance(processed) : processed;
    
    if (method === "TOPSIS") {
      processed = applyTopsis(processed, weights);
    } else if (method === "Nash") {
      processed = applyNashEquilibrium(processed, weights);
    } else {
      // Simple utility model
      processed = processed.map(s => ({
        ...s,
        score: (weights.speed * (s.speed / 350) - weights.cost * (s.cost / 5) - weights.dist * (s.dist / 10))
      })).sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    
    setStations(processed);
    setLoading(false);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setIsChanging(true);
      
      let nextGridLoad = 0;
      setGridLoad(prev => {
        const delta = Math.random() * 10 - 5;
        nextGridLoad = Math.max(10, Math.min(95, prev + delta));
        return nextGridLoad;
      });

      let nextEvDemand = 0;
      setEvDemand(prev => {
        const delta = Math.random() * 8 - 4;
        nextEvDemand = Math.max(5, Math.min(90, prev + delta));
        return nextEvDemand;
      });
      
      // Trigger alerts based on thresholds with guards
      if (nextGridLoad > thresholds.gridCritical) {
        if (lastAlerted.current.grid !== 'critical') {
          addAlert({
            type: 'Critical',
            source: 'Grid Monitor (EV)',
            message: `CRITICAL grid load: ${nextGridLoad.toFixed(1)}%. Threshold: ${thresholds.gridCritical}%. Emergency throttling initiated.`,
            value: `${nextGridLoad.toFixed(1)}%`
          });
          lastAlerted.current.grid = 'critical';
        }
      } else if (nextGridLoad > thresholds.gridWarning) {
        if (lastAlerted.current.grid !== 'warning') {
          addAlert({
            type: 'Warning',
            source: 'Grid Monitor (EV)',
            message: `High grid load detected: ${nextGridLoad.toFixed(1)}%. Threshold: ${thresholds.gridWarning}%. Optimization recommended.`,
            value: `${nextGridLoad.toFixed(1)}%`
          });
          lastAlerted.current.grid = 'warning';
        }
      } else {
        lastAlerted.current.grid = null;
      }
      
      if (nextEvDemand > thresholds.evCritical) {
        if (lastAlerted.current.ev !== 'critical') {
          addAlert({
            type: 'Critical',
            source: 'Demand Monitor (EV)',
            message: `CRITICAL EV demand: ${nextEvDemand.toFixed(1)}%. Threshold: ${thresholds.evCritical}%. Grid stability at risk.`,
            value: `${nextEvDemand.toFixed(1)}%`
          });
          lastAlerted.current.ev = 'critical';
        }
      } else if (nextEvDemand > thresholds.evWarning) {
        if (lastAlerted.current.ev !== 'warning') {
          addAlert({
            type: 'Warning',
            source: 'Demand Monitor (EV)',
            message: `High EV demand detected: ${nextEvDemand.toFixed(1)}%. Threshold: ${thresholds.evWarning}%.`,
            value: `${nextEvDemand.toFixed(1)}%`
          });
          lastAlerted.current.ev = 'warning';
        }
      } else {
        lastAlerted.current.ev = null;
      }

      // Reset changing state after a pulse
      setTimeout(() => setIsChanging(false), 2000);
    }, 5000);

    return () => clearInterval(interval);
  }, [addAlert, thresholds]);

  useEffect(() => {
    handleOptimize();
  }, [gridLoad, evDemand, isDynamic, method, useDominance]);

  const top10 = stations.slice(0, 10);
  const top5 = stations.slice(0, 5);
  const radarData = stations.length > 0 ? [
    { subject: 'Speed', A: stations[0].speed / 100, fullMark: 1 },
    { subject: 'Cost', A: (1 - stations[0].cost / 10), fullMark: 1 },
    { subject: 'Dist', A: (1 - stations[0].dist / 10), fullMark: 1 },
    { subject: 'Safety', A: stations[0].safety, fullMark: 1 },
    { subject: 'UX', A: stations[0].ux, fullMark: 1 },
    { subject: 'Real-Time', A: stations[0].realTime, fullMark: 1 },
  ] : [];

  return (
    <div className="space-y-6 p-4 bg-[#151619] text-white rounded-xl border border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 className="text-xl font-mono tracking-wider flex items-center gap-2">
          <Zap className="text-yellow-400" /> EV NETWORK OPTIMIZER
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isChanging ? 'bg-red-500 animate-ping' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-widest ${isChanging ? 'text-red-400' : 'text-emerald-400'}`}>
              {isChanging ? 'Syncing Data...' : 'Data Stable'}
            </span>
          </div>
          <button 
            onClick={handleOptimize}
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded font-bold transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Activity className="animate-spin" size={16} /> : <Zap size={16} />}
            {loading ? "PROCESSING..." : "RUN OPTIMIZATION"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <div className="space-y-4 bg-white/5 p-4 rounded-lg border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-mono text-white/50 uppercase tracking-widest">Real-Time Context</h3>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${gridLoad > 70 ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-[8px] font-mono text-white/30">LIVE</span>
            </div>
          </div>

          <div className="space-y-4 p-3 bg-black/20 rounded border border-white/5">
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-mono uppercase text-white/40">
                <span>Grid Load</span>
                <span className={gridLoad > 70 ? 'text-red-400' : 'text-blue-400'}>{gridLoad.toFixed(1)}%</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full transition-all duration-1000 ${gridLoad > thresholds.gridWarning ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${gridLoad}%` }}
                />
                {/* Threshold Markers */}
                <div className="absolute top-0 h-full w-0.5 bg-yellow-500/50" style={{ left: `${thresholds.gridWarning}%` }} title="Warning Threshold" />
                <div className="absolute top-0 h-full w-0.5 bg-red-500" style={{ left: `${thresholds.gridCritical}%` }} title="Critical Threshold" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-mono uppercase text-white/40">
                <span>EV Demand</span>
                <span className="text-yellow-400">{evDemand.toFixed(1)}%</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden relative">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-1000"
                  style={{ width: `${evDemand}%` }}
                />
                {/* Threshold Markers */}
                <div className="absolute top-0 h-full w-0.5 bg-orange-500/50" style={{ left: `${thresholds.evWarning}%` }} title="Warning Threshold" />
                <div className="absolute top-0 h-full w-0.5 bg-red-500" style={{ left: `${thresholds.evCritical}%` }} title="Critical Threshold" />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-[10px] font-mono cursor-pointer">
                <input 
                  type="checkbox" checked={isDynamic} 
                  onChange={(e) => setIsDynamic(e.target.checked)}
                  className="accent-yellow-500"
                />
                DYNAMIC ADJUSTMENT
              </label>
            </div>
          </div>

          <h3 className="text-xs font-mono text-white/50 uppercase tracking-widest mt-6 mb-4">Alert Configuration</h3>
          <div className="space-y-4 p-3 bg-black/20 rounded border border-white/5">
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono uppercase text-white/40">
                  <span>Grid Warning</span>
                  <span>{thresholds.gridWarning}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={thresholds.gridWarning}
                  onChange={(e) => setThresholds({...thresholds, gridWarning: parseInt(e.target.value)})}
                  className="w-full accent-yellow-500 h-1"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono uppercase text-white/40">
                  <span>Grid Critical</span>
                  <span>{thresholds.gridCritical}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={thresholds.gridCritical}
                  onChange={(e) => setThresholds({...thresholds, gridCritical: parseInt(e.target.value)})}
                  className="w-full accent-red-500 h-1"
                />
              </div>
              <div className="h-px bg-white/5 my-2" />
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono uppercase text-white/40">
                  <span>EV Warning</span>
                  <span>{thresholds.evWarning}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={thresholds.evWarning}
                  onChange={(e) => setThresholds({...thresholds, evWarning: parseInt(e.target.value)})}
                  className="w-full accent-orange-500 h-1"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono uppercase text-white/40">
                  <span>EV Critical</span>
                  <span>{thresholds.evCritical}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={thresholds.evCritical}
                  onChange={(e) => setThresholds({...thresholds, evCritical: parseInt(e.target.value)})}
                  className="w-full accent-red-500 h-1"
                />
              </div>
            </div>
          </div>

          <h3 className="text-xs font-mono text-white/50 uppercase tracking-widest mt-6 mb-4">Parameters</h3>
          
          <div className="space-y-4">
            {Object.keys(weights).map((key) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span>{key}</span>
                  <span>{weights[key as keyof OptimizationWeights].toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={weights[key as keyof OptimizationWeights]}
                  onChange={(e) => setWeights({...weights, [key]: parseFloat(e.target.value)})}
                  className="w-full accent-yellow-500"
                />
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-white/10">
            <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
              <input 
                type="checkbox" checked={useDominance} 
                onChange={(e) => setUseDominance(e.target.checked)}
                className="accent-yellow-500"
              />
              PARETO FILTER (DOMINANCE)
            </label>
          </div>

          <div className="space-y-2 pt-4">
            <span className="text-[10px] font-mono text-white/50 uppercase">Methodology</span>
            {["TOPSIS", "Utility", "Nash"].map((m) => (
              <button 
                key={m}
                onClick={() => setMethod(m as OptimizationMethod)}
                className={`w-full text-left px-3 py-2 rounded text-xs font-mono transition-all ${method === m ? 'bg-yellow-500 text-black' : 'hover:bg-white/10'}`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <div className="bg-white/5 p-4 rounded-lg border border-white/5 h-[300px]">
              <h4 className="text-xs font-mono text-white/50 uppercase mb-4">Top 10 Performance Scores</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#151619', border: '1px solid #333' }}
                    itemStyle={{ color: '#fbbf24' }}
                  />
                  <Bar dataKey="score" fill="#fbbf24" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar Chart */}
            <div className="bg-white/5 p-4 rounded-lg border border-white/5 h-[300px]">
              <h4 className="text-xs font-mono text-white/50 uppercase mb-4">Multi-Criteria Radar (Top Station)</h4>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#888' }} />
                  <Radar name="Station A" dataKey="A" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table View */}
          <div className="bg-white/5 rounded-lg border border-white/5 overflow-hidden">
            <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <h4 className="text-xs font-mono text-white/50 uppercase">Network Status Matrix</h4>
              {isDynamic && (gridLoad > 70 || evDemand > 60) && (
                <div className="flex items-center gap-2 text-[9px] font-mono text-red-400 animate-pulse">
                  <AlertCircle size={12} />
                  <span>SURGE PRICING ACTIVE</span>
                </div>
              )}
            </div>
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/10 text-white/50 uppercase">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Speed (kW)</th>
                  <th className="p-3">Est. Time</th>
                  <th className="p-3">Cost ($)</th>
                  <th className="p-3">Dist (km)</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((s, i) => (
                  <tr key={`${s.id}-${i}`} className="border-t border-white/5 hover:bg-white/5 transition-all">
                    <td className="p-3 text-yellow-500 font-bold">#{i + 1}</td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span>{s.name}</span>
                        {isDynamic && (gridLoad > 70 || evDemand > 60) && (
                          <span className="text-[8px] text-red-400/60 uppercase">
                            {gridLoad > 70 && evDemand > 60 ? 'Grid & Demand Throttled' : gridLoad > 70 ? 'Throttled by Grid' : 'Demand Throttling Active'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{(s.score || 0).toFixed(3)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {s.speed}
                        {isDynamic && gridLoad > 70 && <TrendingUp size={10} className="text-red-400 rotate-180" />}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-blue-400">
                        <Clock size={12} />
                        <span>{(s as any).predictedTime} min</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {s.cost}
                        {isDynamic && (gridLoad > 50 || evDemand > 30) && <TrendingUp size={10} className="text-red-400" />}
                      </div>
                    </td>
                    <td className="p-3">{s.dist}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sensitivity Analysis Section */}
          {method === "TOPSIS" && stations.length > 0 && (
            <SensitivityAnalysis stations={stations} baseWeights={weights} />
          )}
        </div>
      </div>
    </div>
  );
}
