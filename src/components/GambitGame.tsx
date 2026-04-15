
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Users, TrendingUp, Info, ShieldAlert, Cpu, GitBranch, Table, Download, Zap, Trophy, User, Activity, Target, Terminal, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { initializeGame, trainStep, GameState, generatePayoffMatrix, GameType, exportToNFG, getPayoff, replicatorStep, findNashEquilibria, calculateQRE } from '../services/gambitService';
import { predictUsage } from '../services/energyService';
import { motion, AnimatePresence } from 'framer-motion';

export default function GambitGame() {
  const [gameState, setGameState] = useState<GameState>(initializeGame(10, 'charging'));
  const [isSimulating, setIsSimulating] = useState(false);
  const [iterations, setIterations] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'solver' | 'matrix' | 'tree' | 'challenge' | 'evolution' | 'logit'>('solver');
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'success' | 'warn' }[]>([]);
  const [lambda, setLambda] = useState(5); // Rationality parameter for QRE
  const [challengeState, setChallengeState] = useState<{
    score: number;
    round: number;
    lastPayoff: number | null;
    aiChoice: number | null;
    history: { round: number; choice: string; payoff: number }[];
  }>({
    score: 0,
    round: 0,
    lastPayoff: null,
    aiChoice: null,
    history: []
  });
  
  // Link to actual energy prediction
  const energyPrediction = predictUsage([0.2, 0.5, 0.3], 1);
  const gridLoad = energyPrediction.find(p => p.state === "High")?.probability || 0.4;
  
  const payoffMatrix = generatePayoffMatrix(gridLoad, gameState.type, gameState.customPayoffs);
  const nashEquilibria = findNashEquilibria(gridLoad, gameState.type, gameState.customPayoffs);
  const qreProb = calculateQRE(gridLoad, gameState.type, lambda, gameState.customPayoffs);
  
  const getDominantStrategy = () => {
    const m = payoffMatrix;
    // For symmetric games, we only check for Player A
    const s0Dominant = m['0-0'][0] > m['1-0'][0] && m['0-1'][0] > m['1-1'][0];
    const s1Dominant = m['1-0'][0] > m['0-0'][0] && m['1-1'][0] > m['0-1'][0];
    
    if (s0Dominant) return gameState.strategies[0];
    if (s1Dominant) return gameState.strategies[1];
    return null;
  };

  const dominantStrategy = getDominantStrategy();
  const simRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (msg: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setLogs(prev => [{ msg, type }, ...prev].slice(0, 50));
  };

  const handleGameTypeChange = (type: GameType) => {
    setIsSimulating(false);
    const players = (type.startsWith('classic_') || type === 'custom') ? 2 : gameState.players;
    setGameState(initializeGame(players, type));
    setIterations(0);
    setHistory([]);
    addLog(`Switched to ${type.toUpperCase()} game model`, 'info');
    addLog(`Initialized ${players} autonomous agents`, 'success');
  };

  const downloadNFG = () => {
    const content = exportToNFG(gridLoad, gameState.type, gameState.customPayoffs);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game_${gameState.type}.nfg`;
    a.click();
    addLog(`Exported game to Gambit .nfg format`, 'success');
  };

  const playRound = (userChoice: number) => {
    // AI agents choose based on current probabilities
    const othersCharging = gameState.players - 1;
    const aiChargingCount = Array.from({ length: othersCharging }).filter(() => Math.random() < gameState.probabilities[0]).length;
    
    const payoff = gameState.type === 'custom' && gameState.customPayoffs 
      ? gameState.customPayoffs[`${userChoice}-${aiChargingCount > 0 ? 0 : 1}`][0]
      : getPayoff(userChoice, aiChargingCount, gridLoad, gameState.type);
    
    setChallengeState(prev => ({
      score: prev.score + Math.floor(payoff),
      round: prev.round + 1,
      lastPayoff: Math.floor(payoff),
      aiChoice: aiChargingCount,
      history: [{ 
        round: prev.round + 1, 
        choice: gameState.strategies[userChoice], 
        payoff: Math.floor(payoff) 
      }, ...prev.history].slice(0, 5)
    }));
  };

  const resetChallenge = () => {
    setChallengeState({
      score: 0,
      round: 0,
      lastPayoff: null,
      aiChoice: null,
      history: []
    });
  };

  useEffect(() => {
    if (isSimulating) {
      addLog(`Starting ${viewMode === 'evolution' ? 'Replicator Dynamics' : 'Regret Matching'} solver...`, 'info');
      simRef.current = setInterval(() => {
        setGameState(prev => {
          const next = viewMode === 'evolution' 
            ? replicatorStep(prev, gridLoad)
            : trainStep(prev, gridLoad);
            
          setIterations(i => {
            const nextI = i + 1;
            if (nextI % 100 === 0) {
              addLog(`Iteration ${nextI}: Convergence error < ${(1/Math.sqrt(nextI)).toFixed(4)}`, 'info');
            }
            return nextI;
          });
          
          if (iterations % 5 === 0) {
            setHistory(h => [...h.slice(-19), {
              iter: iterations,
              charge: next.probabilities[0] * 100,
              wait: next.probabilities[1] * 100,
              load: gridLoad * 100
            }]);
          }
          return next;
        });
      }, 50);
    } else {
      if (simRef.current) {
        clearInterval(simRef.current);
        addLog(`Solver halted at iteration ${iterations}`, 'warn');
      }
    }
    return () => { if (simRef.current) clearInterval(simRef.current); };
  }, [isSimulating, iterations, gridLoad, viewMode]);

  const reset = () => {
    setGameState(initializeGame(10));
    setIterations(0);
    setHistory([]);
    setIsSimulating(false);
    setLogs([]);
    addLog("System reset. Ready for new simulation.", "success");
  };

  const COLORS = ['#eab308', '#3b82f6'];

  return (
    <div className="space-y-6">
      {/* Game Type & View Switcher */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest ml-1">Energy Domain Games</span>
          <div className="flex bg-[#151619] p-1 rounded-xl border border-white/10 w-fit overflow-x-auto">
            {[
              { id: 'charging', label: 'Charging' },
              { id: 'v2g_coop', label: 'V2G Coop' },
              { id: 'grid_hawk_dove', label: 'Hawk-Dove' },
              { id: 'public_goods', label: 'Public Goods' },
              { id: 'grid_sharing', label: 'Grid Sharing' },
              { id: 'waiting_dilemma', label: 'Waiting Dilemma' }
            ].map(game => (
              <button
                key={game.id}
                onClick={() => handleGameTypeChange(game.id as GameType)}
                className={`px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider whitespace-nowrap transition-all ${
                  gameState.type === game.id ? 'bg-blue-500 text-white font-bold' : 'text-white/40 hover:bg-white/5'
                }`}
              >
                {game.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest ml-1">Classic Normal Games</span>
            <div className="flex bg-[#151619] p-1 rounded-xl border border-white/10 w-fit overflow-x-auto">
              {[
                { id: 'classic_pd', label: 'Prisoner\'s Dilemma' },
                { id: 'classic_bos', label: 'Battle of Sexes' },
                { id: 'classic_mp', label: 'Matching Pennies' },
                { id: 'classic_sh', label: 'Stag Hunt' },
                { id: 'classic_chicken', label: 'Chicken' },
                { id: 'classic_coord', label: 'Coordination' },
                { id: 'custom', label: 'Custom Game' }
              ].map(game => (
                <button
                  key={game.id}
                  onClick={() => handleGameTypeChange(game.id as GameType)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider whitespace-nowrap transition-all ${
                    gameState.type === game.id ? 'bg-emerald-500 text-white font-bold' : 'text-white/40 hover:bg-white/5'
                  }`}
                >
                  {game.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex bg-[#151619] p-1 rounded-xl border border-white/10 w-fit overflow-x-auto">
            {[
              { id: 'solver', icon: Cpu, label: 'Solver' },
              { id: 'evolution', icon: Activity, label: 'Evolution' },
              { id: 'logit', icon: TrendingUp, label: 'Logit' },
              { id: 'matrix', icon: Table, label: 'Matrix' },
              { id: 'tree', icon: GitBranch, label: 'Tree' },
              { id: 'challenge', icon: Trophy, label: 'Challenge' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider whitespace-nowrap transition-all ${
                  viewMode === mode.id ? 'bg-yellow-500 text-black font-bold' : 'text-white/40 hover:bg-white/5'
                }`}
              >
                <mode.icon size={14} />
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rationality Settings (Visible in Logit/Matrix/Evolution) */}
      {(viewMode === 'logit' || viewMode === 'matrix' || viewMode === 'evolution') && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#151619] p-4 rounded-2xl border border-white/10"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h3 className="font-medium text-white">Rationality Parameter (λ)</h3>
            </div>
            <span className="text-blue-400 font-mono font-bold">{lambda.toFixed(1)}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="20" 
            step="0.5" 
            value={lambda} 
            onChange={(e) => setLambda(parseFloat(e.target.value))}
            className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-xs text-white/40 mt-2 italic">
            λ models the "precision" of players. Higher λ means players are more likely to choose the best response (approaching Nash). Lower λ means more random behavior.
          </p>
        </motion.div>
      )}

      {/* Custom Payoff Editor */}
      {gameState.type === 'custom' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#151619] p-6 rounded-2xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-6">
            <Table className="w-5 h-5 text-emerald-400" />
            <h3 className="font-medium text-white">Custom Payoff Matrix (2x2 Symmetric)</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(gameState.customPayoffs || {}).map(([key, payoffs]) => (
              <div key={key} className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                    {key === '0-0' ? 'Both Strategy 1' : 
                     key === '0-1' ? 'S1 vs S2' : 
                     key === '1-0' ? 'S2 vs S1' : 'Both Strategy 2'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono text-white/20 uppercase">Player A</label>
                    <input 
                      type="number"
                      value={payoffs[0]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setGameState(prev => ({
                          ...prev,
                          customPayoffs: {
                            ...prev.customPayoffs,
                            [key]: [val, prev.customPayoffs![key][1]]
                          }
                        }))
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono text-white/20 uppercase">Player B</label>
                    <input 
                      type="number"
                      value={payoffs[1]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setGameState(prev => ({
                          ...prev,
                          customPayoffs: {
                            ...prev.customPayoffs,
                            [key]: [prev.customPayoffs![key][0], val]
                          }
                        }))
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-blue-400 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {viewMode === 'solver' && (
          <motion.div 
            key="solver"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Control Panel */}
            <div className="bg-[#151619] p-6 rounded-2xl border border-white/10 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="text-yellow-500" size={20} />
                  <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Solver Config</h3>
                </div>
                <button 
                  onClick={downloadNFG}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/40 hover:text-white transition-all"
                  title="Export to Gambit .nfg"
                >
                  <Download size={14} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-white/40 uppercase mb-2">
                    {gameState.type.startsWith('classic_') ? 'Fixed Players (Classic)' : 'Active Agents (N-Players)'}
                  </label>
                  <input 
                    type="range" min="2" max="50" step="1" 
                    disabled={gameState.type.startsWith('classic_') || gameState.type === 'custom'}
                    value={gameState.players}
                    onChange={(e) => setGameState(prev => ({ ...prev, players: parseInt(e.target.value) }))}
                    className={`w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500 ${gameState.type.startsWith('classic_') || gameState.type === 'custom' ? 'opacity-30 cursor-not-allowed' : ''}`}
                  />
                  <div className="flex justify-between text-[10px] font-mono mt-1 text-white/60">
                    <span>2</span>
                    <span className="text-yellow-500 font-bold">
                      {gameState.type.startsWith('classic_') || gameState.type === 'custom' ? '2 Players' : `${gameState.players} Drivers`}
                    </span>
                    <span>50</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-white/40 uppercase">Grid Load (Live)</span>
                    <span className="text-[10px] font-mono text-blue-500 font-bold">{(gridLoad * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${gridLoad * 100}%` }} />
                  </div>
                  <p className="text-[8px] text-white/30 font-mono mt-2 uppercase">Linked to Markov Chain Prediction</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsSimulating(!isSimulating)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                    isSimulating ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                  }`}
                >
                  {isSimulating ? <Pause size={18} /> : <Play size={18} />}
                  {isSimulating ? 'HALT' : 'SOLVE'}
                </button>
                <button 
                  onClick={reset}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white/60"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {/* Strategy Distribution */}
            <div className="bg-[#151619] p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-6 left-6 flex items-center gap-2">
                <Users className="text-blue-500" size={20} />
                <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Equilibrium State</h3>
              </div>
              
              <div className="w-full h-64 mt-8">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Charge Now', value: gameState.probabilities[0] },
                        { name: 'Wait', value: gameState.probabilities[1] }
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151619', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-8 w-full mt-4">
                <div className="text-center">
                  <span className="block text-[10px] font-mono text-white/40 uppercase mb-1">{gameState.strategies[0]}</span>
                  <span className="text-2xl font-bold text-yellow-500">{(gameState.probabilities[0] * 100).toFixed(1)}%</span>
                </div>
                <div className="text-center">
                  <span className="block text-[10px] font-mono text-white/40 uppercase mb-1">{gameState.strategies[1]}</span>
                  <span className="text-2xl font-bold text-blue-500">{(gameState.probabilities[1] * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Convergence Chart */}
            <div className="bg-[#151619] p-6 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-purple-500" size={20} />
                  <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Convergence Curve</h3>
                </div>
                <div className="text-[10px] font-mono text-white/40">
                  ITER: {iterations.toLocaleString()}
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="iter" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151619', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      labelStyle={{ display: 'none' }}
                      itemStyle={{ fontSize: '10px', textTransform: 'uppercase' }}
                    />
                    <Line type="monotone" dataKey="charge" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="wait" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'matrix' && (
          <motion.div 
            key="matrix"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#151619] p-8 rounded-2xl border border-white/10"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Normal Form: {gameState.type.replace('_', ' ').toUpperCase()}</h3>
                <p className="text-white/40 text-[10px] font-mono uppercase">Player A vs Player B (Symmetric Model)</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {nashEquilibria.map((eq, idx) => (
                  <div key={idx} className="bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 text-[10px] font-mono text-green-500 uppercase flex items-center gap-1">
                    <Target size={10} />
                    {eq.type === 'pure' ? 'Pure Nash' : `Mixed Nash (${(eq.strategies[0][0] * 100).toFixed(0)}%)`}
                  </div>
                ))}
                <div className="bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 text-[10px] font-mono text-purple-500 uppercase">
                  Dominant: {getDominantStrategy()}
                </div>
                <div className="bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20 text-[10px] font-mono text-yellow-500 uppercase">
                  Grid Load: {(gridLoad * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div />
              <div className="text-center text-[10px] font-mono text-white/40 uppercase py-2">B: {gameState.strategies[0]}</div>
              <div className="text-center text-[10px] font-mono text-white/40 uppercase py-2">B: {gameState.strategies[1]}</div>

              <div className="flex items-center justify-center text-[10px] font-mono text-white/40 uppercase [writing-mode:vertical-rl] rotate-180">A: {gameState.strategies[0]}</div>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-center group hover:bg-yellow-500/10 transition-all">
                <div className="text-xl font-bold text-yellow-500">{payoffMatrix['0-0'][0]}</div>
                <div className="w-full h-px bg-white/10 my-2" />
                <div className="text-xl font-bold text-blue-500">{payoffMatrix['0-0'][1]}</div>
              </div>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-center group hover:bg-yellow-500/10 transition-all">
                <div className="text-xl font-bold text-yellow-500">{payoffMatrix['0-1'][0]}</div>
                <div className="w-full h-px bg-white/10 my-2" />
                <div className="text-xl font-bold text-blue-500">{payoffMatrix['0-1'][1]}</div>
              </div>

              <div className="flex items-center justify-center text-[10px] font-mono text-white/40 uppercase [writing-mode:vertical-rl] rotate-180">A: {gameState.strategies[1]}</div>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-center group hover:bg-yellow-500/10 transition-all">
                <div className="text-xl font-bold text-yellow-500">{payoffMatrix['1-0'][0]}</div>
                <div className="w-full h-px bg-white/10 my-2" />
                <div className="text-xl font-bold text-blue-500">{payoffMatrix['1-0'][1]}</div>
              </div>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-center group hover:bg-yellow-500/10 transition-all">
                <div className="text-xl font-bold text-yellow-500">{payoffMatrix['1-1'][0]}</div>
                <div className="w-full h-px bg-white/10 my-2" />
                <div className="text-xl font-bold text-blue-500">{payoffMatrix['1-1'][1]}</div>
              </div>
            </div>

            {/* QRE Overlay */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Quantal Response Equilibrium (QRE)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60">Expected Strategy Distribution:</span>
                <span className="text-sm font-mono text-white">
                  {(qreProb * 100).toFixed(1)}% {gameState.strategies[0]} / {((1 - qreProb) * 100).toFixed(1)}% {gameState.strategies[1]}
                </span>
              </div>
            </div>

            {/* Dominant Strategy Indicator */}
            {dominantStrategy && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-500">Dominant Strategy Detected</span>
                </div>
                <p className="text-[10px] text-white/60 font-mono uppercase">
                  Strategy <span className="text-yellow-500 font-bold">"{dominantStrategy}"</span> is dominant. 
                  Rational players will always choose this regardless of the opponent.
                </p>
              </motion.div>
            )}

            <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-4">
              <Info size={20} className="text-blue-500" />
              <p className="text-[10px] text-white/60 font-mono uppercase leading-relaxed">
                The matrix shows the utility (payoff) for Player A (yellow) and Player B (blue). 
                The values depend on the chosen strategies and current grid load.
              </p>
            </div>
          </motion.div>
        )}

        {viewMode === 'tree' && (
          <motion.div 
            key="tree"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#151619] p-8 rounded-2xl border border-white/10"
          >
            <div className="flex items-center justify-between mb-12">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Extensive Form: {gameState.type.replace('_', ' ').toUpperCase()}</h3>
                <p className="text-white/40 text-[10px] font-mono uppercase">Sequential Decision Tree Visualization</p>
              </div>
              <div className="bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20 text-[10px] font-mono text-yellow-500 uppercase">
                Perfect Information Model
              </div>
            </div>

            <div className="relative h-[400px] flex items-center justify-center">
              {/* Root Node */}
              <div className="absolute top-0 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-xs shadow-lg shadow-yellow-500/20 z-10">A</div>
                <div className="text-[10px] font-mono text-white/40 mt-2 uppercase">Player A</div>
                
                {/* Branches from A */}
                <div className="flex gap-40 mt-12 relative">
                  {/* Left Branch (Charge) */}
                  <div className="flex flex-col items-center">
                    <div className="absolute top-[-48px] left-[50%] w-[1px] h-12 bg-white/20 -translate-x-20 -rotate-45 origin-top" />
                    <div className="text-[8px] font-mono text-yellow-500 mb-2 uppercase tracking-tighter">{gameState.strategies[0]}</div>
                    <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-blue-500 font-bold text-[10px] z-10 bg-[#151619]">B</div>
                    
                    {/* Branches from B (after A charged) */}
                    <div className="flex gap-16 mt-12 relative">
                      <div className="flex flex-col items-center">
                        <div className="absolute top-[-48px] left-[50%] w-[1px] h-12 bg-white/10 -translate-x-8 -rotate-45 origin-top" />
                        <div className="text-[8px] font-mono text-blue-500 mb-1 uppercase tracking-tighter">{gameState.strategies[0]}</div>
                        <div className="p-2 bg-white/5 rounded border border-white/10 text-[10px] font-mono">
                          <span className="text-yellow-500">{payoffMatrix['0-0'][0]}</span>, <span className="text-blue-500">{payoffMatrix['0-0'][1]}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="absolute top-[-48px] left-[50%] w-[1px] h-12 bg-white/10 translate-x-8 rotate-45 origin-top" />
                        <div className="text-[8px] font-mono text-blue-500 mb-1 uppercase tracking-tighter">{gameState.strategies[1]}</div>
                        <div className="p-2 bg-white/5 rounded border border-white/10 text-[10px] font-mono">
                          <span className="text-yellow-500">{payoffMatrix['0-1'][0]}</span>, <span className="text-blue-500">{payoffMatrix['0-1'][1]}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Branch (Wait) */}
                  <div className="flex flex-col items-center">
                    <div className="absolute top-[-48px] left-[50%] w-[1px] h-12 bg-white/20 translate-x-20 rotate-45 origin-top" />
                    <div className="text-[8px] font-mono text-yellow-500 mb-2 uppercase tracking-tighter">{gameState.strategies[1]}</div>
                    <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-blue-500 font-bold text-[10px] z-10 bg-[#151619]">B</div>

                    {/* Branches from B (after A waited) */}
                    <div className="flex gap-16 mt-12 relative">
                      <div className="flex flex-col items-center">
                        <div className="absolute top-[-48px] left-[50%] w-[1px] h-12 bg-white/10 -translate-x-8 -rotate-45 origin-top" />
                        <div className="text-[8px] font-mono text-blue-500 mb-1 uppercase tracking-tighter">{gameState.strategies[0]}</div>
                        <div className="p-2 bg-white/5 rounded border border-white/10 text-[10px] font-mono">
                          <span className="text-yellow-500">{payoffMatrix['1-0'][0]}</span>, <span className="text-blue-500">{payoffMatrix['1-0'][1]}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="absolute top-[-48px] left-[50%] w-[1px] h-12 bg-white/10 translate-x-8 rotate-45 origin-top" />
                        <div className="text-[8px] font-mono text-blue-500 mb-1 uppercase tracking-tighter">{gameState.strategies[1]}</div>
                        <div className="p-2 bg-white/5 rounded border border-white/10 text-[10px] font-mono">
                          <span className="text-yellow-500">{payoffMatrix['1-1'][0]}</span>, <span className="text-blue-500">{payoffMatrix['1-1'][1]}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-4">
              <GitBranch size={20} className="text-yellow-500" />
              <p className="text-[10px] text-white/60 font-mono uppercase leading-relaxed">
                The extensive form represents the game as a sequence of moves. Player A moves first, followed by Player B. 
                This visualization helps identify subgame perfect equilibria.
              </p>
            </div>
          </motion.div>
        )}

        {viewMode === 'logit' && (
          <motion.div
            key="logit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 bg-[#151619] p-6 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Logit Response Curve</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-white/60">Response Prob</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-xs text-white/60">Fixed Point (QRE)</span>
                  </div>
                </div>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={Array.from({ length: 21 }, (_, i) => {
                    const p = i / 20;
                    const m = generatePayoffMatrix(gridLoad, gameState.type);
                    const eu0 = p * m['0-0'][0] + (1 - p) * m['0-1'][0];
                    const eu1 = p * m['1-0'][0] + (1 - p) * m['1-1'][0];
                    const exp0 = Math.exp(Math.min(700, lambda * eu0 / 100));
                    const exp1 = Math.exp(Math.min(700, lambda * eu1 / 100));
                    const response = exp0 / (exp0 + exp1);
                    return { p, response, diagonal: p };
                  })}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="p" 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={10} 
                      label={{ value: 'Prob(Strategy 1)', position: 'insideBottom', offset: -5, fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={10}
                      label={{ value: 'Response Prob', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="response" stroke="#3b82f6" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="diagonal" stroke="rgba(255,255,255,0.2)" strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-white/40 mt-4 text-center italic">
                The intersection of the blue curve and the dashed diagonal represents the Quantal Response Equilibrium.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-[#151619] p-6 rounded-2xl border border-white/10">
                <h4 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">QRE Analysis</h4>
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-2xl font-mono font-bold text-blue-400">{(qreProb * 100).toFixed(1)}%</div>
                    <div className="text-xs text-white/40 mt-1">Equilibrium Prob for {gameState.strategies[0]}</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-2xl font-mono font-bold text-yellow-400">{lambda.toFixed(1)}</div>
                    <div className="text-xs text-white/40 mt-1">Rationality Level (λ)</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 p-6 rounded-2xl border border-blue-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-blue-400" />
                  <h4 className="text-sm font-medium text-blue-400">What is QRE?</h4>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Quantal Response Equilibrium (QRE) is a generalization of Nash Equilibrium. It assumes players are "boundedly rational"—they make better choices more often, but occasionally make mistakes. As λ increases, players become more rational.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'evolution' && (
          <motion.div 
            key="evolution"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="bg-[#151619] p-6 rounded-2xl border border-white/10 space-y-6">
              <div className="flex items-center gap-2">
                <Activity className="text-blue-500" size={20} />
                <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Evolutionary Dynamics</h3>
              </div>
              <p className="text-[10px] text-white/40 font-mono uppercase leading-relaxed">
                Simulating Replicator Dynamics. Strategies with higher fitness (payoff) grow in the population, while others decline.
              </p>
              <div className="space-y-4 pt-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <span className="block text-[10px] font-mono text-white/40 uppercase mb-2">Initial Population</span>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden flex">
                      <div className="h-full bg-yellow-500" style={{ width: `${gameState.probabilities[0] * 100}%` }} />
                      <div className="h-full bg-blue-500" style={{ width: `${gameState.probabilities[1] * 100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsSimulating(!isSimulating)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                      isSimulating ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    }`}
                  >
                    {isSimulating ? <Pause size={18} /> : <Play size={18} />}
                    {isSimulating ? 'PAUSE' : 'EVOLVE'}
                  </button>
                  <button onClick={reset} className="p-3 bg-white/5 rounded-xl border border-white/10 text-white/60"><RefreshCw size={18} /></button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#151619] p-6 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Population Frequency</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-[8px] font-mono text-white/40 uppercase">{gameState.strategies[0]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[8px] font-mono text-white/40 uppercase">{gameState.strategies[1]}</span>
                  </div>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gameState.evolutionHistory.map((p, i) => ({ step: i, p0: p[0] * 100, p1: p[1] * 100 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="step" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151619', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '10px', textTransform: 'uppercase' }}
                    />
                    <Area type="monotone" dataKey="p0" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.2} isAnimationActive={false} />
                    <Area type="monotone" dataKey="p1" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'challenge' && (
          <motion.div 
            key="challenge"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-[#151619] p-8 rounded-2xl border border-white/10 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight">Strategic Challenge</h3>
                  <p className="text-white/40 text-[10px] font-mono uppercase">You vs {gameState.players - 1} AI Agents</p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-mono text-white/40 uppercase">Total Score</span>
                  <span className="text-2xl font-bold text-yellow-500">{challengeState.score}</span>
                </div>
              </div>

              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-center">
                <p className="text-sm text-white/60 mb-6 font-mono uppercase">Round {challengeState.round + 1}: Choose your strategy</p>
                
                {gameState.type === 'waiting_dilemma' && (
                  <div className="mb-8 p-6 bg-white/5 rounded-2xl border border-white/10 overflow-hidden relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Activity size={16} className="text-blue-500" />
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Queue Dynamics</h4>
                      </div>
                      <div className="px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                        <span className="text-[10px] font-mono text-blue-500 font-bold uppercase">
                          Est. Wait: {((gameState.players - (challengeState.aiChoice || 0)) * 2.5).toFixed(1)} mins
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-6">
                      {/* Fast Lane */}
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-yellow-500 uppercase font-bold">Fast Lane (Pay)</span>
                          <span className="text-[10px] font-mono text-white/40 uppercase">{challengeState.aiChoice || 0} AI Agents</span>
                        </div>
                        <div className="h-12 bg-black/40 rounded-xl border border-dashed border-white/10 flex items-center px-4 gap-2 overflow-hidden">
                          {Array.from({ length: (challengeState.aiChoice || 0) + (challengeState.history[0]?.choice.includes('Fast') ? 1 : 0) }).map((_, i) => (
                            <motion.div 
                              initial={{ x: -50, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              key={i} 
                              className="w-8 h-6 bg-yellow-500/20 border border-yellow-500/40 rounded flex items-center justify-center"
                            >
                              <Zap size={10} className="text-yellow-500" />
                            </motion.div>
                          ))}
                          {challengeState.history.length === 0 && <span className="text-[8px] font-mono text-white/20 uppercase">Empty</span>}
                        </div>
                      </div>

                      {/* Standard Lane */}
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-blue-500 uppercase font-bold">Standard Lane (Wait)</span>
                          <span className="text-[10px] font-mono text-white/40 uppercase">{gameState.players - 1 - (challengeState.aiChoice || 0)} AI Agents</span>
                        </div>
                        <div className="h-12 bg-black/40 rounded-xl border border-dashed border-white/10 flex items-center px-4 gap-2 overflow-hidden">
                          {Array.from({ length: (gameState.players - 1 - (challengeState.aiChoice || 0)) + (challengeState.history[0]?.choice.includes('Standard') ? 1 : 0) }).map((_, i) => (
                            <motion.div 
                              initial={{ x: -50, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              key={i} 
                              className="w-8 h-6 bg-blue-500/20 border border-blue-500/40 rounded flex items-center justify-center"
                            >
                              <Pause size={10} className="text-blue-500" />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 p-2">
                      <div className="flex items-center gap-1 text-[8px] font-mono text-white/20 uppercase">
                        <Activity size={10} /> Live Queue
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {gameState.strategies.map((strat, i) => (
                    <button
                      key={strat}
                      onClick={() => playRound(i)}
                      className="group p-6 bg-black/40 hover:bg-yellow-500/10 rounded-xl border border-white/10 hover:border-yellow-500/50 transition-all text-center"
                    >
                      <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${i === 0 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-500'}`}>
                        {i === 0 ? <Zap size={24} /> : <Pause size={24} />}
                      </div>
                      <span className="block text-xs font-bold uppercase tracking-widest group-hover:text-yellow-500 transition-colors">{strat}</span>
                    </button>
                  ))}
                </div>
              </div>

              {challengeState.lastPayoff !== null && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Trophy className="text-green-500" size={20} />
                    <span className="text-xs font-mono uppercase text-white/80">Last Payoff: <span className="text-green-500 font-bold">+{challengeState.lastPayoff} Units</span></span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 uppercase">{challengeState.aiChoice} AI agents chose {gameState.strategies[0]}</span>
                </motion.div>
              )}
            </div>

            <div className="bg-[#151619] p-8 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Round History</h3>
                <button onClick={resetChallenge} className="text-[10px] font-mono text-white/40 hover:text-white uppercase flex items-center gap-1">
                  <RefreshCw size={10} /> Reset
                </button>
              </div>
              
              <div className="space-y-3">
                {challengeState.history.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-white/20">
                    <GitBranch size={48} className="mb-4 opacity-20" />
                    <p className="text-[10px] font-mono uppercase">No rounds played yet</p>
                  </div>
                ) : (
                  challengeState.history.map((h, i) => (
                    <motion.div 
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      key={h.round}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-mono text-white/20">#{h.round}</span>
                        <span className={`text-xs font-bold uppercase ${h.choice.includes('Charge') || h.choice.includes('Hawk') || h.choice.includes('Fast') ? 'text-yellow-500' : 'text-blue-500'}`}>
                          {h.choice}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-green-500">+{h.payoff}</span>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Theory Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10">
          <h3 className="text-sm font-mono uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
            <Target className="text-blue-500" size={16} /> Strategy Analysis
          </h3>
          <div className="space-y-4">
            {gameState.type === 'waiting_dilemma' ? (
              <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                  <span className="text-blue-500 font-bold">THE WAITING DILEMMA:</span> This is a congestion game. 
                  If everyone chooses the "Fast Lane", the congestion penalty exceeds the benefit of skipping. 
                  The Nash Equilibrium often involves a mixed strategy where players are indifferent between waiting and paying.
                </p>
              </div>
            ) : gameState.type === 'classic_pd' ? (
              <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                  <span className="text-emerald-500 font-bold">PRISONER'S DILEMMA:</span> The most famous game in game theory. 
                  Individual rationality leads to a sub-optimal outcome for both players. 
                  Mutual cooperation is better than mutual defection, but defection is a dominant strategy.
                </p>
              </div>
            ) : gameState.type === 'classic_bos' ? (
              <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                  <span className="text-emerald-500 font-bold">BATTLE OF THE SEXES:</span> A coordination game with conflict. 
                  Players want to coordinate on the same activity but have different preferences for which activity.
                </p>
              </div>
            ) : gameState.type === 'classic_mp' ? (
              <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                  <span className="text-emerald-500 font-bold">MATCHING PENNIES:</span> A classic zero-sum game. 
                  One player wants to match strategies, while the other wants to mismatch. 
                  There is no pure strategy Nash equilibrium, only a mixed one.
                </p>
              </div>
            ) : gameState.type === 'classic_sh' ? (
              <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                  <span className="text-emerald-500 font-bold">STAG HUNT:</span> A coordination game that models trust. 
                  Cooperation (hunting stag) is the Pareto-efficient equilibrium, but requires trust. 
                  Hunting hare is a risk-dominant but less efficient equilibrium.
                </p>
              </div>
            ) : gameState.type === 'classic_chicken' ? (
              <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                  <span className="text-emerald-500 font-bold">GAME OF CHICKEN:</span> A game of brinkmanship. 
                  The worst outcome is mutual conflict (Straight-Straight). 
                  Players want to yield only if the other doesn't, leading to two pure Nash equilibria where one player "wins" and the other "loses".
                </p>
              </div>
            ) : gameState.type === 'classic_coord' ? (
              <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                  <span className="text-emerald-500 font-bold">COORDINATION GAME:</span> A game where players benefit from choosing the same strategy. 
                  There are multiple Nash equilibria, and the challenge is to pick the same one without communication.
                </p>
              </div>
            ) : gameState.type === 'custom' ? (
              <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                  <span className="text-emerald-500 font-bold">CUSTOM NORMAL FORM:</span> You are defining your own payoff matrix. 
                  The Gambit solver will analyze your specific values to find Nash Equilibria, Dominant Strategies, and Quantal Response Equilibria.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                <p className="text-[10px] font-mono text-white/60 leading-relaxed">
                  <span className="text-yellow-500 font-bold">EQUILIBRIUM DYNAMICS:</span> In {gameState.type.replace('_', ' ')} games, 
                  agents adapt their behavior based on the "Regret" of their previous choices. 
                  The system converges to a point where no agent can improve their payoff by unilaterally changing strategy.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-[#151619] p-6 rounded-2xl border border-white/10">
          <h3 className="text-sm font-mono uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
            <Activity className="text-emerald-500" size={16} /> System Complexity
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="block text-[8px] font-mono text-white/40 uppercase mb-1">State Space</span>
              <span className="text-xs font-mono font-bold text-white">2^{gameState.players}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="block text-[8px] font-mono text-white/40 uppercase mb-1">Complexity</span>
              <span className="text-xs font-mono font-bold text-white">P-Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Solver Console */}
      <div className="bg-[#0f1012] rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-emerald-500" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Gambit Solver Console</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-mono text-emerald-500 uppercase">Kernel v4.1-stable</span>
          </div>
        </div>
        <div className="h-32 p-4 font-mono text-[10px] overflow-y-auto flex flex-col-reverse gap-1 scrollbar-hide">
          {logs.length === 0 ? (
            <div className="text-white/20 italic">Waiting for solver initialization...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                <ChevronRight size={10} className="mt-0.5 text-white/20" />
                <span className={
                  log.type === 'success' ? 'text-emerald-500' : 
                  log.type === 'warn' ? 'text-yellow-500' : 
                  'text-white/60'
                }>
                  [{new Date().toLocaleTimeString()}] {log.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Game Theory Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
          <h4 className="text-xs font-mono uppercase tracking-widest font-bold text-white/60 mb-4 flex items-center gap-2">
            <Info size={14} /> Strategic Payoff Analysis
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
              <span className="text-[10px] font-mono text-white/40 uppercase">Utility ({gameState.strategies[0]})</span>
              <span className="text-sm font-bold text-yellow-500">
                {Math.floor(payoffMatrix['0-0'][0])} Units
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
              <span className="text-[10px] font-mono text-white/40 uppercase">Utility ({gameState.strategies[1]})</span>
              <span className="text-sm font-bold text-blue-500">
                {Math.floor(payoffMatrix['1-1'][0])} Units
              </span>
            </div>
            <div className="p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/10 flex items-center gap-2">
              <Zap size={12} className="text-yellow-500" />
              <span className="text-[8px] font-mono text-white/60 uppercase">
                {gameState.playerTypes.filter(t => t === 'priority').length} Priority Agents Active
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
          <h4 className="text-xs font-mono uppercase tracking-widest font-bold text-white/60 mb-4 flex items-center gap-2">
            <ShieldAlert size={14} /> Complexity Breakdown
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
              <span className="block text-[8px] font-mono text-white/40 uppercase mb-1">Algorithm</span>
              <span className="text-[10px] font-bold text-white">Regret Matching</span>
            </div>
            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
              <span className="block text-[8px] font-mono text-white/40 uppercase mb-1">Complexity Class</span>
              <span className="text-[10px] font-bold text-white">PPAD-Complete</span>
            </div>
            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
              <span className="block text-[8px] font-mono text-white/40 uppercase mb-1">Convergence</span>
              <span className="text-[10px] font-bold text-white">O(1/√T)</span>
            </div>
            <div className="p-3 bg-black/20 rounded-lg border border-white/5">
              <span className="block text-[8px] font-mono text-white/40 uppercase mb-1">Equilibrium Type</span>
              <span className="text-[10px] font-bold text-white">Coarse Correlated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
