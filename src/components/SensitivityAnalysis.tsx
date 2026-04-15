
import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { ChargingStation, OptimizationWeights } from '../types';
import { applyTopsis } from '../services/evService';
import { Activity, Info } from 'lucide-react';

interface Props {
  stations: ChargingStation[];
  baseWeights: OptimizationWeights;
}

export default function SensitivityAnalysis({ stations, baseWeights }: Props) {
  const [targetWeight, setTargetWeight] = useState<keyof OptimizationWeights>('speed');
  const [perturbationRange, setPerturbationRange] = useState(0.5); // +/- 50%

  const criteria: (keyof OptimizationWeights)[] = ['speed', 'cost', 'dist', 'accessibility', 'reliability', 'safety', 'ux', 'realTime'];

  const sensitivityData = useMemo(() => {
    if (stations.length === 0) return [];

    const steps = 11; // -50% to +50% with 10% steps
    const data = [];

    for (let i = 0; i < steps; i++) {
      const factor = 1 + (i / (steps - 1) - 0.5) * 2 * perturbationRange;
      const perturbedWeights = { ...baseWeights };
      perturbedWeights[targetWeight] = Math.max(0, Math.min(1, baseWeights[targetWeight] * factor));

      const results = applyTopsis(stations, perturbedWeights);
      
      const entry: any = {
        perturbation: `${Math.round((factor - 1) * 100)}%`,
        factor: factor
      };

      // Track top 5 stations from the base ranking
      const baseResults = applyTopsis(stations, baseWeights);
      const top5Ids = baseResults.slice(0, 5).map(s => s.id);

      results.forEach((s, index) => {
        if (top5Ids.includes(s.id)) {
          entry[s.id] = index + 1; // Rank (1-indexed)
        }
      });

      data.push(entry);
    }

    return data;
  }, [stations, baseWeights, targetWeight, perturbationRange]);

  const topStations = useMemo(() => {
    if (stations.length === 0) return [];
    const baseResults = applyTopsis(stations, baseWeights);
    return baseResults.slice(0, 5).map(s => ({ id: s.id, name: s.name }));
  }, [stations, baseWeights]);

  const COLORS = ['#fbbf24', '#60a5fa', '#34d399', '#a78bfa', '#f87171'];

  return (
    <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-mono uppercase tracking-widest font-bold flex items-center gap-2">
            <Activity className="text-yellow-500" size={16} /> TOPSIS Sensitivity Analysis
          </h3>
          <p className="text-[10px] text-white/40 font-mono uppercase mt-1">
            Analyzing rank stability under weight perturbation
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-mono text-white/30 uppercase">Target Metric</span>
            <select 
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value as keyof OptimizationWeights)}
              className="bg-[#151619] border border-white/10 rounded px-2 py-1 text-[10px] font-mono uppercase text-white/80 focus:outline-none focus:border-yellow-500"
            >
              {criteria.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-mono text-white/30 uppercase">Range: ±{Math.round(perturbationRange * 100)}%</span>
            <input 
              type="range" min="0.1" max="1" step="0.1"
              value={perturbationRange}
              onChange={(e) => setPerturbationRange(parseFloat(e.target.value))}
              className="w-24 accent-yellow-500"
            />
          </div>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sensitivityData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis 
              dataKey="perturbation" 
              tick={{ fontSize: 10, fill: '#888' }}
              axisLine={{ stroke: '#333' }}
            />
            <YAxis 
              reversed 
              domain={[1, 'dataMax']} 
              tick={{ fontSize: 10, fill: '#888' }}
              axisLine={{ stroke: '#333' }}
              label={{ value: 'Rank', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 10 }}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#151619', border: '1px solid #333', borderRadius: '8px' }}
              itemStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
              labelStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#888', marginBottom: '4px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', paddingTop: '20px' }}
            />
            {topStations.map((s, i) => (
              <Line 
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                animationDuration={1000}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-lg flex gap-3">
        <Info className="text-blue-400 shrink-0" size={16} />
        <div className="space-y-1">
          <h4 className="text-[10px] font-mono text-blue-400 uppercase font-bold">Understanding the Chart</h4>
          <p className="text-[10px] font-mono text-white/50 leading-relaxed">
            This chart shows how the **Rank** of the top 5 charging stations (based on current weights) changes as you vary the weight of the selected metric. 
            A flat line indicates **Rank Stability**, meaning the station's position is robust to changes in that specific weight. 
            Crossing lines indicate **Rank Reversals**, where a different station becomes more optimal as priorities shift.
          </p>
        </div>
      </div>
    </div>
  );
}
