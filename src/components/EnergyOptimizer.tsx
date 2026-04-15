
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { Cpu, Wind, Lightbulb, Zap, TrendingUp, AlertTriangle, CheckCircle, Gauge, Scale, MapPin, Activity, Settings, Car, ArrowRight, ShieldCheck, Target, RotateCcw, BarChart3, Binary, Layers, ThumbsUp, ThumbsDown, History } from 'lucide-react';
import { predictUsage, optimizeEnergy, getRecommendations, calculateSigma, TRANSITION_MATRIX, GOAL_COEFFICIENTS, calculateEquilibrium, calculateEntropy, performSensitivityAnalysis, getHistoricalMarkovStates } from '../services/energyService';
import { getTrafficFlow, calculateCongestionIndex, TrafficFlowData } from '../services/tomtomService';
import { EnergyUsageState, EnergyRecommendation, EnergyWeights } from '../types';
import { useAlerts } from '../contexts/AlertContext';

export default function EnergyOptimizer() {
  const { addAlert } = useAlerts();
  const [prediction, setPrediction] = useState<EnergyUsageState[]>([]);
  const [steps, setSteps] = useState(3);
  const [sigma, setSigma] = useState(0);
  const [optimization, setOptimization] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<EnergyRecommendation[]>([]);
  const [weights, setWeights] = useState<EnergyWeights>({
    cost: 0.7,
    comfort: 0.8,
    efficiency: 0.6
  });
  const [initialState, setInitialState] = useState<number[]>([0.5, 0.3, 0.2]); // [Low, Medium, High]
  const [traffic, setTraffic] = useState<TrafficFlowData | null>(null);
  const [congestion, setCongestion] = useState<number>(0);
  const [loadingTraffic, setLoadingTraffic] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [telemetry, setTelemetry] = useState({
    frequency: 60.00,
    voltage: 230.1,
    load: 450.5,
    timestamp: new Date().toISOString()
  });
  const [loadHistory, setLoadHistory] = useState<{time: string, load: number, freq: number}[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'helpful' | 'not-helpful'>>(() => {
    const saved = localStorage.getItem('energy-feedback');
    return saved ? JSON.parse(saved) : {};
  });
  const [sensitivity, setSensitivity] = useState<any[]>([]);
  const [paretoData, setParetoData] = useState<any[]>([]);
  const [entropyHistory, setEntropyHistory] = useState<any[]>([]);
  const [historicalMarkovData, setHistoricalMarkovData] = useState<any[]>([]);
  const lastAlerted = React.useRef<{ freq: boolean, load: boolean }>({ freq: false, load: false });

  // Real-time Telemetry Simulation
  useEffect(() => {
    const interval = setInterval(() => {
      const newFreq = 60 + (Math.random() * 0.04 - 0.02);
      const newVolt = 230 + (Math.random() * 2 - 1);
      const newLoad = 450 + (Math.random() * 10 - 5);
      const now = new Date();
      
      setTelemetry({
        frequency: newFreq,
        voltage: newVolt,
        load: newLoad,
        timestamp: now.toISOString()
      });

      // Trigger alerts based on thresholds with guards
      if (Math.abs(newFreq - 60) > 0.015) {
        if (!lastAlerted.current.freq) {
          addAlert({
            type: 'Warning',
            source: 'Frequency Monitor',
            message: `Grid frequency deviation detected: ${newFreq.toFixed(3)} Hz. Stability protocols active.`,
            value: `${newFreq.toFixed(3)} Hz`
          });
          lastAlerted.current.freq = true;
        }
      } else {
        lastAlerted.current.freq = false;
      }

      if (newLoad > 458) {
        if (!lastAlerted.current.load) {
          addAlert({
            type: 'Info',
            source: 'Load Balancer',
            message: `Grid load peaking at ${newLoad.toFixed(1)} kW. Shifting non-critical loads.`,
            value: `${newLoad.toFixed(1)} kW`
          });
          lastAlerted.current.load = true;
        }
      } else {
        lastAlerted.current.load = false;
      }

      setLoadHistory(prev => {
        const next = [...prev, { 
          time: now.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }), 
          load: newLoad,
          freq: newFreq
        }];
        if (next.length > 20) return next.slice(1);
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('energy-feedback', JSON.stringify(feedbackMap));
  }, [feedbackMap]);

  const handleUpdate = async () => {
    // Normalize initial state to ensure sum is 1.0
    const sum = initialState.reduce((a, b) => a + b, 0);
    const normalizedInitial = sum > 0 ? initialState.map(v => v / sum) : [1, 0, 0];
    
    const pred = predictUsage(normalizedInitial, steps);
    setPrediction(pred);
    
    const s = calculateSigma(pred);
    setSigma(s);
    
    const opt = optimizeEnergy(weights);
    setOptimization(opt);

    // Sensitivity Analysis
    const sens = performSensitivityAnalysis(weights);
    setSensitivity(sens);

    // Generate Pareto Frontier (Sampled)
    const pareto = [];
    for (let c = 0; c <= 1; c += 0.2) {
      for (let f = 0; f <= 1; f += 0.2) {
        const o = optimizeEnergy({ cost: c, comfort: f, efficiency: 0.5 });
        const costVal = Object.keys(GOAL_COEFFICIENTS).reduce((acc, key) => acc + (o[key] || 0) * (GOAL_COEFFICIENTS as any)[key].cost, 0);
        const comfortVal = Object.keys(GOAL_COEFFICIENTS).reduce((acc, key) => acc + (o[key] || 0) * (GOAL_COEFFICIENTS as any)[key].comfort, 0);
        pareto.push({ cost: costVal, comfort: comfortVal, weightCost: c, weightComfort: f });
      }
    }
    setParetoData(pareto);

    // Fetch TomTom Traffic Data based on current location
    setLoadingTraffic(true);
    let lat = 37.7749; // Default: SF
    let lon = -122.4194;

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch (err) {
        console.warn('Geolocation failed, falling back to default coordinates.', err);
      }
    }

    const trafficData = await getTrafficFlow(lat, lon);
    let currentCongestion = 0;
    if (trafficData) {
      setTraffic(trafficData);
      currentCongestion = calculateCongestionIndex(trafficData);
      setCongestion(currentCongestion);
    }
    setLoadingTraffic(false);
    
    setLoadingRecs(true);
    const recs = getRecommendations(pred, s, currentCongestion, feedbackMap, lat, lon);
    setRecommendations(recs);
    setLoadingRecs(false);

    setHistoricalMarkovData(getHistoricalMarkovStates());
  };

  useEffect(() => {
    handleUpdate();
  }, [steps, weights, initialState, feedbackMap]);

  const optData = optimization ? [
    { name: 'HVAC', value: optimization.hvac || 0 },
    { name: 'Lighting', value: optimization.lighting || 0 },
    { name: 'Appliances', value: optimization.appliances || 0 },
    { name: 'EV Charging', value: optimization.evCharging || 0 },
    { name: 'Industrial', value: optimization.industrialLoads || 0 },
  ] : [];

  // Calculate Radar Data for Trade-offs
  const radarData = optimization ? [
    {
      subject: 'Comfort',
      A: Object.keys(GOAL_COEFFICIENTS).reduce((acc, key) => acc + (optimization[key] || 0) * (GOAL_COEFFICIENTS as any)[key].comfort, 0),
      fullMark: 150,
    },
    {
      subject: 'Efficiency',
      A: Object.keys(GOAL_COEFFICIENTS).reduce((acc, key) => acc + (optimization[key] || 0) * (GOAL_COEFFICIENTS as any)[key].efficiency, 0),
      fullMark: 150,
    },
    {
      subject: 'Cost Savings',
      // Inverting cost for radar chart (higher is better savings)
      A: 200 - Object.keys(GOAL_COEFFICIENTS).reduce((acc, key) => acc + (optimization[key] || 0) * (GOAL_COEFFICIENTS as any)[key].cost, 0),
      fullMark: 200,
    },
  ] : [];

  // Generate timeline data for n-step prediction
  const timelineData = Array.from({ length: steps }, (_, i) => {
    const sum = initialState.reduce((a, b) => a + b, 0);
    const normalizedInitial = sum > 0 ? initialState.map(v => v / sum) : [1, 0, 0];
    const p = predictUsage(normalizedInitial, i + 1);
    const entropy = calculateEntropy(p.map(item => item.probability));
    return {
      step: `T+${i + 1}`,
      Low: p[0].probability,
      Medium: p[1].probability,
      High: p[2].probability,
      entropy: entropy
    };
  });

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="bg-[#151619] p-4 rounded-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Cpu className="text-blue-400" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold font-mono tracking-widest uppercase">Grid Optimizer</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] text-white/40 font-mono">LIVE TELEMETRY: {new Date(telemetry.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Telemetry Ticker */}
          <div className="hidden xl:flex items-center gap-6 bg-white/5 px-4 py-2 rounded border border-white/10 mr-4">
            <div className="flex flex-col">
              <span className="text-[8px] text-white/40 font-mono uppercase">Frequency</span>
              <span className="text-xs font-bold font-mono text-blue-400">{telemetry.frequency.toFixed(3)} Hz</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-white/40 font-mono uppercase">Voltage</span>
              <span className="text-xs font-bold font-mono text-blue-400">{telemetry.voltage.toFixed(1)} V</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-white/40 font-mono uppercase">Grid Load</span>
              <span className="text-xs font-bold font-mono text-blue-400">{telemetry.load.toFixed(1)} MW</span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded border border-white/10">
            <div className="flex flex-col">
              <span className="text-[8px] text-white/40 font-mono uppercase">Sigma (σ)</span>
              <span className="text-sm font-bold font-mono text-blue-400">{sigma.toFixed(3)}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[8px] text-white/40 font-mono uppercase">Congestion</span>
              <span className={`text-sm font-bold font-mono ${congestion > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                {congestion}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded border border-white/10">
            <span className="text-[8px] text-white/40 font-mono uppercase">Steps (N)</span>
            <input 
              type="number" min="1" max="10" value={steps}
              onChange={(e) => setSteps(parseInt(e.target.value))}
              className="bg-transparent border-b border-blue-500/30 focus:border-blue-500 outline-none w-10 text-center text-sm font-bold text-blue-400 font-mono"
            />
          </div>

          <button 
            onClick={handleUpdate}
            className="bg-blue-500 hover:bg-blue-600 text-black px-6 py-2 rounded font-bold transition-all text-[10px] uppercase tracking-widest flex items-center gap-2"
          >
            <Activity size={14} />
            Recalculate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Parameters */}
        <div className="lg:col-span-3 space-y-6">
          {/* Initial State */}
          <section className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden">
            <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Initial State</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const eq = calculateEquilibrium();
                    setInitialState(eq);
                  }}
                  className="text-[8px] text-emerald-400 hover:underline font-mono"
                >
                  EQUILIBRIUM
                </button>
                <button 
                  onClick={() => {
                    const sum = initialState.reduce((a, b) => a + b, 0);
                    if (sum > 0) setInitialState(initialState.map(v => v / sum));
                    else setInitialState([1, 0, 0]);
                  }}
                  className="text-[8px] text-blue-400 hover:underline font-mono"
                >
                  NORMALIZE
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {['Low', 'Medium', 'High'].map((label, idx) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-mono uppercase text-white/40">
                    <span>{label}</span>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" step="0.01" min="0" max="1"
                        value={initialState[idx].toFixed(2)}
                        onChange={(e) => {
                          const next = [...initialState];
                          next[idx] = parseFloat(e.target.value) || 0;
                          setInitialState(next);
                        }}
                        className="bg-transparent border-b border-blue-500/30 w-10 text-right text-blue-400 font-bold outline-none"
                      />
                    </div>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01" 
                    value={initialState[idx]}
                    onChange={(e) => {
                      const next = [...initialState];
                      next[idx] = parseFloat(e.target.value);
                      setInitialState(next);
                    }}
                    className="w-full accent-blue-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* MCDA Weights */}
          <section className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden">
            <div className="p-3 bg-white/5 border-b border-white/10 flex items-center gap-2">
              <Scale size={14} className="text-emerald-400" />
              <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">MCDA Priorities</span>
            </div>
            <div className="p-4 space-y-5">
              {[
                { label: 'Minimize Bill', key: 'cost', color: 'accent-blue-500', text: 'text-blue-400' },
                { label: 'Maintain Comfort', key: 'comfort', color: 'accent-emerald-500', text: 'text-emerald-400' },
                { label: 'System Efficiency', key: 'efficiency', color: 'accent-purple-500', text: 'text-purple-400' }
              ].map((w) => (
                <div key={w.key} className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-mono uppercase text-white/40">
                    <span>{w.label}</span>
                    <span className={`${w.text} font-bold`}>{weights[w.key as keyof EnergyWeights].toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.1" 
                    value={weights[w.key as keyof EnergyWeights]}
                    onChange={(e) => setWeights({...weights, [w.key]: parseFloat(e.target.value)})}
                    className={`w-full ${w.color} h-1 bg-white/10 rounded-full appearance-none cursor-pointer`}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Goal Programming Context */}
          <div className="p-4 bg-blue-500/5 rounded-xl border border-dashed border-blue-500/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2">
                <ShieldCheck size={12} /> Goal Programming Engine
              </h4>
              <div className="flex items-center gap-1 px-1 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[6px] font-mono text-blue-400 uppercase">Optimizing</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[9px] text-white/40 leading-relaxed font-mono">
                Objective: Minimize deviations from targets (Cost: 0, Comfort: 100, Efficiency: 100).
              </p>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-[8px] text-white/30 uppercase font-mono">Weighted Deviation</span>
                <span className="text-[10px] font-bold font-mono text-emerald-400">
                  {optimization?.result ? optimization.result.toFixed(4) : '0.0000'}
                </span>
              </div>
              <p className="text-[8px] text-white/20 italic font-mono">
                Status: <span className="text-emerald-400">Optimal Solution Found</span>
              </p>
            </div>
          </div>
        </div>

        {/* Center/Right: Data Visualization */}
        <div className="lg:col-span-9 space-y-6">
          {/* Live Grid Health Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#151619] p-4 rounded-xl border border-white/10 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full border border-blue-500/20">
                <Activity className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[8px] text-white/40 font-mono uppercase">Frequency Stability</p>
                <h3 className="text-lg font-bold font-mono text-white">{telemetry.frequency.toFixed(3)} <span className="text-[10px] text-white/40">Hz</span></h3>
                <div className="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${Math.max(0, Math.min(100, ((telemetry.frequency - 59.9) / 0.2) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-[#151619] p-4 rounded-xl border border-white/10 flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <Zap className="text-emerald-400" size={20} />
              </div>
              <div>
                <p className="text-[8px] text-white/40 font-mono uppercase">Voltage Regulation</p>
                <h3 className="text-lg font-bold font-mono text-white">{telemetry.voltage.toFixed(1)} <span className="text-[10px] text-white/40">V</span></h3>
                <div className="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${Math.max(0, Math.min(100, ((telemetry.voltage - 220) / 20) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#151619] p-4 rounded-xl border border-white/10 flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                <Gauge className="text-yellow-400" size={20} />
              </div>
              <div>
                <p className="text-[8px] text-white/40 font-mono uppercase">Active Grid Load</p>
                <h3 className="text-lg font-bold font-mono text-white">{telemetry.load.toFixed(1)} <span className="text-[10px] text-white/40">MW</span></h3>
                <div className="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 transition-all duration-500" 
                    style={{ width: `${Math.max(0, Math.min(100, (telemetry.load / 600) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#151619] p-4 rounded-xl border border-white/10 flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-full border border-purple-500/20">
                <ShieldCheck className="text-purple-400" size={20} />
              </div>
              <div>
                <p className="text-[8px] text-white/40 font-mono uppercase">Stability Index</p>
                <h3 className="text-lg font-bold font-mono text-white">
                  {(100 - (Math.abs(telemetry.frequency - 60) * 500) - (Math.abs(telemetry.voltage - 230) * 5)).toFixed(1)}%
                </h3>
                <div className="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-500" 
                    style={{ width: `${Math.max(0, Math.min(100, (100 - (Math.abs(telemetry.frequency - 60) * 500) - (Math.abs(telemetry.voltage - 230) * 5))))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Telemetry History Row */}
          <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
            <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-blue-400" />
                <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Live Load Profile (Real-time Stream)</span>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-[7px] font-mono text-blue-400 uppercase">Streaming</span>
                </div>
              </div>
              <span className="text-[8px] font-mono text-white/30 uppercase tracking-tighter">Rolling 40s Window</span>
            </div>
            <div className="p-4 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={loadHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="time" stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '9px' }}
                    labelStyle={{ color: '#60a5fa' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="load" 
                    stroke="#fbbf24" 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="freq" 
                    stroke="#3b82f6" 
                    strokeWidth={1} 
                    dot={false} 
                    isAnimationActive={false}
                    yAxisId="freq"
                  />
                  <YAxis yAxisId="freq" hide domain={[59.8, 60.2]} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical Markov State Transitions */}
          <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
            <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={14} className="text-purple-400" />
                <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Historical State Probabilities</span>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded">
                  <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse" />
                  <span className="text-[7px] font-mono text-purple-400 uppercase">24H Retrospective</span>
                </div>
              </div>
              <span className="text-[8px] font-mono text-white/30 uppercase tracking-tighter">Markov Chain Analysis</span>
            </div>
            <div className="p-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalMarkovData}>
                  <defs>
                    <linearGradient id="histHigh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="histMed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="histLow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#ffffff20" 
                    fontSize={8} 
                    tickLine={false} 
                    axisLine={false}
                    interval={3}
                  />
                  <YAxis stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '10px' }}
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="High" stroke="#ef4444" fill="url(#histHigh)" strokeWidth={2} stackId="1" />
                  <Area type="monotone" dataKey="Medium" stroke="#fbbf24" fill="url(#histMed)" strokeWidth={2} stackId="1" />
                  <Area type="monotone" dataKey="Low" stroke="#3b82f6" fill="url(#histLow)" strokeWidth={2} stackId="1" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Markov Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Usage Prediction Timeline</span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded">
                    <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-[7px] font-mono text-red-400 uppercase">Live Stream</span>
                  </div>
                </div>
                <span className="text-[8px] font-mono text-white/30">T+0 → T+{steps}</span>
              </div>
              <div className="p-4 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="step" stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '10px' }}
                    />
                    <Area type="monotone" dataKey="High" stroke="#ef4444" fill="url(#colorHigh)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Medium" stroke="#fbbf24" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="Low" stroke="#3b82f6" fill="transparent" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Markov State Projection Analysis */}
            <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-purple-400" />
                  <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Markov Projection Analysis</span>
                </div>
                <span className="text-[8px] font-mono text-white/30 uppercase">Step N Analysis</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {prediction.map((p, i) => (
                    <div key={p.state} className="bg-white/5 p-2 rounded border border-white/5 text-center">
                      <span className="block text-[8px] text-white/30 uppercase font-mono mb-1">{p.state}</span>
                      <span className={`text-sm font-bold font-mono ${
                        p.state === 'High' ? 'text-red-400' : 
                        p.state === 'Medium' ? 'text-yellow-400' : 'text-blue-400'
                      }`}>
                        {(p.probability * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-mono uppercase text-white/40">
                    <span>Projection Confidence</span>
                    <span className="text-emerald-400">{(100 - sigma * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000"
                      style={{ width: `${Math.max(0, 100 - sigma * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <p className="text-[9px] text-white/40 leading-relaxed font-mono italic">
                    The system predicts a {(prediction.find(p => p.state === 'High')?.probability || 0) > 0.5 ? 'High' : 'Stable'} load state at T+{steps} based on the current transition matrix.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[8px] text-white/20 uppercase font-mono">Convergence Status</span>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
                    <div className="w-1 h-1 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-[7px] font-mono text-purple-400 uppercase">Analyzing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Transition Heatmap Row */}
          <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
            <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Transition Heatmap</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500/10 border border-white/10"></div>
                  <span className="text-[8px] text-white/30">0.0</span>
                  <div className="w-2 h-2 bg-blue-500"></div>
                  <span className="text-[8px] text-white/30">1.0</span>
                </div>
              </div>
              <div className="p-6 flex flex-col items-center justify-center flex-1">
                <div className="grid grid-cols-4 gap-1.5 w-full max-w-[320px]">
                  <div className="text-[8px] text-white/20 flex items-center justify-center italic font-mono">FROM \ TO</div>
                  <div className="text-[9px] text-blue-400 font-mono text-center pb-2">LOW</div>
                  <div className="text-[9px] text-emerald-400 font-mono text-center pb-2">MED</div>
                  <div className="text-[9px] text-red-400 font-mono text-center pb-2">HIGH</div>
                  
                  {['LOW', 'MED', 'HIGH'].map((rowLabel, i) => {
                    const currentState = telemetry.load > 455 ? 2 : telemetry.load < 445 ? 0 : 1;
                    const isCurrentRow = i === currentState;
                    
                    return (
                      <React.Fragment key={rowLabel}>
                        <div className={`text-[9px] font-mono flex items-center pr-3 transition-colors duration-500 ${isCurrentRow ? 'text-blue-400 font-bold' : 'text-white/40'}`}>
                          {rowLabel}
                          {isCurrentRow && <div className="ml-1 w-1 h-1 bg-blue-400 rounded-full animate-ping" />}
                        </div>
                        {TRANSITION_MATRIX[i].map((val, j) => (
                          <div 
                            key={j} 
                            className={`aspect-square flex items-center justify-center rounded border transition-all hover:scale-110 cursor-default group relative ${isCurrentRow ? 'ring-1 ring-blue-500/30' : ''}`}
                            style={{ 
                              backgroundColor: `rgba(59, 130, 246, ${val * 0.8 + 0.05})`,
                              borderColor: val > 0.5 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'
                            }}
                          >
                            <span className={`text-[10px] font-bold font-mono ${val > 0.4 ? 'text-white' : 'text-white/60'}`}>
                              {val.toFixed(2)}
                            </span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1b1e] border border-white/20 rounded text-[8px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-mono shadow-xl">
                              {rowLabel} → {['LOW', 'MED', 'HIGH'][j]}: {(val * 100).toFixed(0)}%
                            </div>
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

          {/* Traffic & Optimization Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Traffic Correlation</span>
                {loadingTraffic && <span className="animate-pulse text-blue-400 text-[8px] font-mono">SYNCING...</span>}
              </div>
              <div className="p-4 grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <Activity className="text-blue-400" size={18} />
                    </div>
                    <div>
                      <div className="text-[9px] text-white/40 uppercase font-mono">Congestion</div>
                      <div className="text-xl font-bold font-mono text-blue-400">{congestion}%</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-mono uppercase">
                      <span className="text-white/30">Status</span>
                      <span className={congestion > 50 ? 'text-red-400' : 'text-emerald-400'}>
                        {congestion > 50 ? 'CRITICAL' : 'NOMINAL'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full transition-all duration-1000 ${congestion > 50 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${congestion}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-[9px] font-mono border-l border-white/10 pl-6">
                  <div className="flex justify-between">
                    <span className="text-white/30">SPEED:</span>
                    <span className="text-white/80">{traffic?.currentSpeed || 0} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">FLOW:</span>
                    <span className="text-white/80">{traffic?.freeFlowSpeed || 0} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">TIME:</span>
                    <span className="text-white/80">{Math.round((traffic?.currentTravelTime || 0) / 60)} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">CONF:</span>
                    <span className="text-blue-400">{(traffic?.confidence || 0) * 100}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Load Allocation</span>
                <span className="text-[8px] font-mono text-emerald-400">OPTIMIZED</span>
              </div>
              <div className="p-4 h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={optData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', fontSize: '9px' }} />
                    <Bar dataKey="value" fill="#10b981" radius={[2, 2, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Objective Trade-offs Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-[#151619] rounded-xl border border-white/10 overflow-hidden">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-blue-400" />
                  <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Objective Trade-offs</span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[7px] font-mono text-blue-400 uppercase">Live Analysis</span>
                  </div>
                </div>
                <span className="text-[8px] font-mono text-white/20 uppercase">Multidimensional Goal Analysis</span>
              </div>
              <div className="p-4 h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#ffffff10" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#ffffff40', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 200]} tick={false} axisLine={false} />
                    <Radar
                      name="System State"
                      dataKey="A"
                      stroke="#60a5fa"
                      fill="#60a5fa"
                      fillOpacity={0.5}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '10px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="p-3 bg-white/5 border-b border-white/10">
                <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Goal Metrics</span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-center space-y-6">
                {radarData.map((d) => (
                  <div key={d.subject} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider">{d.subject}</span>
                      <span className="text-lg font-bold font-mono text-white">{d.A.toFixed(1)}</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-1000"
                        style={{ width: `${(d.A / d.fullMark) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-white/5">
                  <p className="text-[9px] text-white/20 font-mono leading-relaxed italic">
                    * Metrics represent aggregated weighted performance across all energy systems.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Analytical Deep Dive Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Prediction Entropy / Uncertainty */}
            <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Binary size={14} className="text-purple-400" />
                  <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Prediction Entropy</span>
                </div>
                <span className="text-[8px] font-mono text-white/20 uppercase">Uncertainty Growth</span>
              </div>
              <div className="p-4 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="step" stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff20" fontSize={8} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '9px' }}
                    />
                    <Line type="monotone" dataKey="entropy" stroke="#a855f7" strokeWidth={2} dot={{ r: 2, fill: '#a855f7' }} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[8px] text-white/20 font-mono mt-2 text-center">
                  Higher entropy indicates lower confidence in long-term state prediction.
                </p>
              </div>
            </div>

            {/* Sensitivity Analysis */}
            <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-blue-400" />
                  <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Weight Sensitivity</span>
                </div>
                <span className="text-[8px] font-mono text-white/20 uppercase">Local Gradient</span>
              </div>
              <div className="p-4 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sensitivity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                    <XAxis type="number" stroke="#ffffff20" fontSize={8} hide />
                    <YAxis dataKey="metric" type="category" stroke="#ffffff40" fontSize={8} width={60} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '9px' }}
                    />
                    <Bar dataKey="sensitivity" fill="#3b82f6" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[8px] text-white/20 font-mono mt-2 text-center">
                  Impact of a 10% change in weight on the objective function.
                </p>
              </div>
            </div>

            {/* Pareto Frontier Trade-off */}
            <div className="bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Pareto Frontier</span>
                </div>
                <span className="text-[8px] font-mono text-white/20 uppercase">Cost vs Comfort</span>
              </div>
              <div className="p-4 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                    <XAxis type="number" dataKey="cost" name="Cost" stroke="#ffffff20" fontSize={8} unit="$" />
                    <YAxis type="number" dataKey="comfort" name="Comfort" stroke="#ffffff20" fontSize={8} unit="%" />
                    <ZAxis type="number" range={[20, 20]} />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '9px' }}
                    />
                    <Scatter name="Solutions" data={paretoData} fill="#10b981" opacity={0.6} />
                    {/* Highlight current solution */}
                    {optimization && (
                      <Scatter 
                        name="Current" 
                        data={[{ 
                          cost: Object.keys(GOAL_COEFFICIENTS).reduce((acc, key) => acc + (optimization[key] || 0) * (GOAL_COEFFICIENTS as any)[key].cost, 0),
                          comfort: Object.keys(GOAL_COEFFICIENTS).reduce((acc, key) => acc + (optimization[key] || 0) * (GOAL_COEFFICIENTS as any)[key].comfort, 0)
                        }]} 
                        fill="#ef4444" 
                        shape="star"
                      />
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
                <p className="text-[8px] text-white/20 font-mono mt-2 text-center">
                  Trade-off space between operational cost and user comfort.
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations & Detailed Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recommendations */}
            <div className="lg:col-span-1 bg-[#151619] rounded-xl border border-white/10 overflow-hidden flex flex-col">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-yellow-500" />
                  <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">AI Directives</span>
                  {loadingRecs && <span className="animate-pulse text-blue-400 text-[8px] font-mono">CALCULATING...</span>}
                </div>
                <div className="flex items-center gap-2">
                  {Object.keys(feedbackMap).length > 0 && (
                    <button 
                      onClick={() => {
                        if (confirm('Reset all learned preferences?')) {
                          setFeedbackMap({});
                        }
                      }}
                      className="p-1.5 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 rounded-lg text-white/30 hover:text-red-400 transition-all"
                      title="Reset Learning"
                    >
                      <RotateCcw size={10} />
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-mono text-emerald-400 uppercase">Learning Active</span>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                {recommendations.length === 0 && !loadingRecs && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <ShieldCheck size={24} className="text-white/10 mb-2" />
                    <p className="text-[10px] text-white/30 font-mono">NO CRITICAL DIRECTIVES<br/>SYSTEM NOMINAL</p>
                  </div>
                )}
                {recommendations.map((rec) => {
                  const getIcon = () => {
                    switch(rec.type) {
                      case 'Grid': return <Zap size={14} className="text-blue-400" />;
                      case 'Peak': return <TrendingUp size={14} className="text-red-400" />;
                      case 'Efficiency': return <Lightbulb size={14} className="text-yellow-400" />;
                      case 'Maintenance': return <Settings size={14} className="text-gray-400" />;
                      case 'EV': return <Car size={14} className="text-emerald-400" />;
                      default: return <AlertTriangle size={14} />;
                    }
                  };

                  return (
                    <div key={rec.id} className={`bg-white/5 p-3 rounded-lg border-l-2 transition-all hover:bg-white/10 ${
                      rec.priority === 'High' ? 'border-red-500' : 
                      rec.priority === 'Medium' ? 'border-yellow-500' : 'border-blue-500'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {getIcon()}
                          <span className="font-bold text-[10px] uppercase tracking-tight">{rec.action}</span>
                        </div>
                        <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold ${
                          rec.priority === 'High' ? 'bg-red-500/10 text-red-400' : 
                          rec.priority === 'Medium' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-[9px] text-white/50 leading-relaxed mb-3">{rec.impact}</p>
                      
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setFeedbackMap(prev => ({...prev, [rec.id]: 'helpful'}))}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[8px] font-mono transition-all ${
                              feedbackMap[rec.id] === 'helpful' 
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                                : 'bg-white/5 border-white/10 text-white/30 hover:text-emerald-400 hover:border-emerald-500/50'
                            }`}
                          >
                            <ThumbsUp size={10} />
                            {feedbackMap[rec.id] === 'helpful' ? 'HELPFUL' : 'HELPFUL?'}
                          </button>
                          <button 
                            onClick={() => setFeedbackMap(prev => ({...prev, [rec.id]: 'not-helpful'}))}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[8px] font-mono transition-all ${
                              feedbackMap[rec.id] === 'not-helpful' 
                                ? 'bg-red-500/20 border-red-500 text-red-400' 
                                : 'bg-white/5 border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/50'
                            }`}
                          >
                            <ThumbsDown size={10} />
                            {feedbackMap[rec.id] === 'not-helpful' ? 'NOT HELPFUL' : 'NOT HELPFUL?'}
                          </button>
                        </div>
                        <div className="text-[7px] font-mono text-white/20">
                          SEV: {rec.severity} | IMP: {rec.impactScore}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Live System Log */}
              <div className="mt-auto bg-black/40 border-t border-white/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-bold font-mono text-white/30 uppercase tracking-widest flex items-center gap-2">
                    <Activity size={10} /> Live System Log
                  </span>
                  <span className="text-[7px] font-mono text-white/20 uppercase tracking-widest">Buffer: 1024KB</span>
                </div>
                <div className="space-y-1 h-20 overflow-hidden font-mono text-[8px]">
                  <div className="flex gap-2 text-emerald-400/60">
                    <span className="text-white/20">[{new Date(telemetry.timestamp).toLocaleTimeString()}]</span>
                    <span>SYS_READY: Grid Telemetry Stream Initialized</span>
                  </div>
                  <div className="flex gap-2 text-blue-400/60">
                    <span className="text-white/20">[{new Date(telemetry.timestamp).toLocaleTimeString()}]</span>
                    <span>MCDA_SYNC: Weights updated (Cost: {weights.cost}, Comfort: {weights.comfort})</span>
                  </div>
                  <div className="flex gap-2 text-yellow-400/60">
                    <span className="text-white/20">[{new Date(telemetry.timestamp).toLocaleTimeString()}]</span>
                    <span>LOAD_WATCH: Frequency fluctuation detected ({telemetry.frequency.toFixed(4)} Hz)</span>
                  </div>
                  <div className="flex gap-2 text-white/30 animate-pulse">
                    <span className="text-white/20">[{new Date(telemetry.timestamp).toLocaleTimeString()}]</span>
                    <span>POLLING: Fetching real-time traffic data...</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="lg:col-span-2 bg-[#151619] rounded-xl border border-white/10 overflow-hidden">
              <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">System Load Matrix</span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[7px] font-mono text-emerald-400 uppercase">Live Sync</span>
                  </div>
                </div>
                <span className="text-[8px] font-mono text-white/30">Unit: kWh</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] font-mono">
                  <thead className="bg-white/5 text-white/30 uppercase border-b border-white/5">
                    <tr>
                      <th className="p-4 font-normal">Load Category</th>
                      <th className="p-4 font-normal">Optimal Allocation</th>
                      <th className="p-4 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {optData.map((item, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-all group">
                        <td className="p-4 text-white/60 group-hover:text-white">{item.name}</td>
                        <td className="p-4 text-emerald-400 font-bold">{item.value.toFixed(1)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-emerald-500/80">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[9px]">NOMINAL</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-white/5 font-bold">
                      <td className="p-4 uppercase tracking-wider">System Objective (Min Deviation)</td>
                      <td className="p-4 text-blue-400 text-sm">{(optimization?.result || 0).toFixed(4)}</td>
                      <td className="p-4 text-white/20 italic font-normal">Algorithm: Simplex (Goal)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
