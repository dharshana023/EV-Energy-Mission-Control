
import { ChargingStation, OptimizationWeights } from "../types";

export type GameType = 'charging' | 'v2g_coop' | 'grid_hawk_dove' | 'public_goods' | 'grid_sharing' | 'waiting_dilemma' | 'classic_pd' | 'classic_bos' | 'classic_mp' | 'classic_sh' | 'classic_chicken' | 'classic_coord' | 'custom';

export interface GameState {
  type: GameType;
  players: number;
  strategies: string[];
  payoffMatrix: number[][][]; // [player][strategy_combination][payoff]
  probabilities: number[]; // Strategy distribution
  regretSum: number[];
  strategySum: number[];
  playerTypes: ('standard' | 'priority')[];
  evolutionHistory: number[][]; // [step][strategy_prob]
  customPayoffs?: { [key: string]: [number, number] }; // For 'custom' game type
}

export function initializeGame(playerCount: number = 10, type: GameType = 'charging'): GameState {
  const playerTypes: ('standard' | 'priority')[] = new Array(playerCount).fill('standard');
  // Make 20% of players priority
  for (let i = 0; i < Math.floor(playerCount * 0.2); i++) {
    playerTypes[i] = 'priority';
  }

  const strategies = type === 'charging' ? ["Charge Now", "Wait"] : 
                    type === 'v2g_coop' ? ["Cooperate", "Defect"] :
                    type === 'grid_hawk_dove' ? ["Hawk (Aggressive)", "Dove (Passive)"] :
                    type === 'public_goods' ? ["Contribute", "Free-ride"] :
                    type === 'grid_sharing' ? ["Share", "Hoard"] :
                    type === 'waiting_dilemma' ? ["Fast Lane (Pay)", "Standard (Wait)"] :
                    type === 'classic_pd' ? ["Cooperate", "Defect"] :
                    type === 'classic_bos' ? ["Opera", "Football"] :
                    type === 'classic_mp' ? ["Heads", "Tails"] :
                    type === 'classic_sh' ? ["Stag", "Hare"] :
                    type === 'classic_chicken' ? ["Swerve", "Straight"] :
                    type === 'classic_coord' ? ["Option A", "Option B"] :
                    type === 'custom' ? ["Strategy 1", "Strategy 2"] :
                    ["Strategy A", "Strategy B"];

  const customPayoffs = type === 'custom' ? {
    '0-0': [50, 50] as [number, number],
    '0-1': [0, 100] as [number, number],
    '1-0': [100, 0] as [number, number],
    '1-1': [-50, -50] as [number, number]
  } : undefined;

  return {
    type,
    players: playerCount,
    strategies,
    payoffMatrix: [],
    probabilities: new Array(2).fill(0.5),
    regretSum: new Array(2).fill(0),
    strategySum: new Array(2).fill(0),
    playerTypes,
    evolutionHistory: [[0.5, 0.5]],
    customPayoffs,
  };
}

/**
 * Calculates the payoff for a single player based on game type and congestion.
 */
export function getPayoff(
  strategy: number, 
  othersCharging: number, 
  gridLoad: number, 
  gameType: GameType = 'charging',
  isPriority: boolean = false
): number {
  const BASE_UTILITY = isPriority ? 120 : 100;
  const CONGESTION_PENALTY = 15;
  const PRICE_PENALTY = gridLoad * 40;

  if (gameType === 'charging') {
    if (strategy === 0) { // Charge Now
      return BASE_UTILITY - (othersCharging * CONGESTION_PENALTY) - PRICE_PENALTY;
    } else { // Wait
      return (BASE_UTILITY * 0.6) - (othersCharging * 2);
    }
  } 
  
  if (gameType === 'v2g_coop') {
    // Stag Hunt variation for V2G
    // (0,0) = High stability (100, 100)
    // (0,1) = Cooperator loses (0, 80)
    // (1,0) = Defector wins (80, 0)
    // (1,1) = Low stability (40, 40)
    if (strategy === 0) { // Cooperate
      return othersCharging > 0 ? 100 : 0;
    } else { // Defect
      return othersCharging > 0 ? 80 : 40;
    }
  }

  if (gameType === 'grid_hawk_dove') {
    // Hawk-Dove for grid access
    // (0,0) = Conflict (-50, -50)
    // (0,1) = Hawk wins (100, 0)
    // (1,0) = Dove loses (0, 100)
    // (1,1) = Shared (50, 50)
    if (strategy === 0) { // Hawk
      return othersCharging > 0 ? -50 : 100;
    } else { // Dove
      return othersCharging > 0 ? 0 : 50;
    }
  }

  if (gameType === 'public_goods') {
    // Public Goods Game for grid maintenance
    const COST = 20;
    const MULTIPLIER = 1.6;
    const totalContribution = (strategy === 0 ? 1 : 0) + othersCharging;
    const pool = (totalContribution * COST * MULTIPLIER) / 10; // Normalized for 10 players
    
    return strategy === 0 ? pool - COST : pool;
  }

  if (gameType === 'waiting_dilemma') {
    // The Waiting Dilemma: Pay to skip or wait in line
    const FAST_LANE_FEE = 30;
    const TOTAL_PLAYERS = 10;
    const othersWaiting = TOTAL_PLAYERS - 1 - othersCharging; // othersCharging is count of others in strategy 0 (Fast)
    
    if (strategy === 0) { // Fast Lane
      // Congestion in fast lane is exponential if too many people skip
      const fastCongestion = Math.pow(othersCharging + 1, 1.5) * 5;
      return 150 - FAST_LANE_FEE - fastCongestion;
    } else { // Standard Lane
      // Congestion in standard lane is linear but starts higher
      const standardCongestion = (othersWaiting + 1) * 12;
      return 100 - standardCongestion;
    }
  }

  if (gameType === 'grid_sharing') {
    // Prisoner's Dilemma for grid sharing
    // (0,0) = Both share (70, 70)
    // (0,1) = Sharer loses (20, 100)
    // (1,0) = Hoarder wins (100, 20)
    // (1,1) = Both hoard (40, 40)
    if (strategy === 0) { // Share
      return othersCharging > 0 ? 70 : 20;
    } else { // Hoard
      return othersCharging > 0 ? 100 : 40;
    }
  }

  if (gameType === 'classic_pd') {
    // Classic Prisoner's Dilemma
    // (0,0) = (3,3), (0,1) = (0,5), (1,0) = (5,0), (1,1) = (1,1)
    if (strategy === 0) { // Cooperate
      return othersCharging > 0 ? 30 : 0;
    } else { // Defect
      return othersCharging > 0 ? 50 : 10;
    }
  }

  if (gameType === 'classic_bos') {
    // Battle of the Sexes
    // (0,0) = (3,2), (0,1) = (0,0), (1,0) = (0,0), (1,1) = (2,3)
    if (strategy === 0) { // Opera
      return othersCharging > 0 ? 30 : 0;
    } else { // Football
      return othersCharging > 0 ? 0 : 20;
    }
  }

  if (gameType === 'classic_mp') {
    // Matching Pennies (Zero-sum)
    // P1 wants to match, P2 wants to mismatch
    // (0,0) = (1,-1), (0,1) = (-1,1), (1,0) = (-1,1), (1,1) = (1,-1)
    if (strategy === 0) { // Heads
      return othersCharging > 0 ? 100 : -100;
    } else { // Tails
      return othersCharging > 0 ? -100 : 100;
    }
  }

  if (gameType === 'classic_sh') {
    // Stag Hunt
    // (0,0) = (5,5), (0,1) = (0,3), (1,0) = (3,0), (1,1) = (3,3)
    if (strategy === 0) { // Stag
      return othersCharging > 0 ? 50 : 0;
    } else { // Hare
      return othersCharging > 0 ? 30 : 30;
    }
  }

  if (gameType === 'classic_chicken') {
    // Game of Chicken
    // (0,0) = (0,0), (0,1) = (-1,1), (1,0) = (1,-1), (1,1) = (-10,-10)
    if (strategy === 0) { // Swerve
      return othersCharging > 0 ? 0 : -10;
    } else { // Straight
      return othersCharging > 0 ? 10 : -100;
    }
  }

  if (gameType === 'classic_coord') {
    // Pure Coordination
    // (0,0) = (10,10), (0,1) = (0,0), (1,0) = (0,0), (1,1) = (10,10)
    if (strategy === 0) { // Option A
      return othersCharging > 0 ? 100 : 0;
    } else { // Option B
      return othersCharging > 0 ? 0 : 100;
    }
  }

  return 0;
}

/**
 * Regret Matching Algorithm (Simulating Gambit's iterative solvers)
 */
export function trainStep(state: GameState, gridLoad: number): GameState {
  const { probabilities, regretSum, strategySum, type, playerTypes, customPayoffs } = state;
  
  // 1. Get current strategy based on regrets
  const currentStrategy = getStrategy(regretSum);
  
  // 2. Compute payoffs for all actions
  let actionPayoffs: number[];
  
  if (type === 'custom' && customPayoffs) {
    const otherStrategy = Math.random() < probabilities[0] ? 0 : 1;
    actionPayoffs = [
      customPayoffs[`0-${otherStrategy}`][0],
      customPayoffs[`1-${otherStrategy}`][0]
    ];
  } else {
    const isPriority = playerTypes[Math.floor(Math.random() * playerTypes.length)] === 'priority';
    const othersCharging = Math.floor(Math.random() * (state.players - 1));
    
    actionPayoffs = [
      getPayoff(0, othersCharging, gridLoad, type, isPriority),
      getPayoff(1, othersCharging, gridLoad, type, isPriority)
    ];
  }
  
  const realizedPayoff = actionPayoffs[currentStrategy];
  
  // 3. Update regrets
  const nextRegretSum = [...regretSum];
  const nextStrategySum = [...strategySum];
  
  for (let i = 0; i < 2; i++) {
    nextRegretSum[i] += actionPayoffs[i] - realizedPayoff;
    nextStrategySum[i] += (i === currentStrategy ? 1 : 0);
  }
  
  return {
    ...state,
    regretSum: nextRegretSum,
    strategySum: nextStrategySum,
    probabilities: getAverageStrategy(nextStrategySum)
  };
}

function getStrategy(regretSum: number[]): number {
  let sumPosRegrets = 0;
  for (let i = 0; i < 2; i++) {
    if (regretSum[i] > 0) sumPosRegrets += regretSum[i];
  }
  
  if (sumPosRegrets > 0) {
    let rand = Math.random() * sumPosRegrets;
    for (let i = 0; i < 2; i++) {
      if (regretSum[i] > 0) {
        rand -= regretSum[i];
        if (rand <= 0) return i;
      }
    }
  }
  return Math.floor(Math.random() * 2);
}

function getAverageStrategy(strategySum: number[]): number[] {
  const sum = strategySum.reduce((a, b) => a + b, 0);
  if (sum > 0) {
    return strategySum.map(s => s / sum);
  }
  return [0.5, 0.5];
}

/**
 * Replicator Dynamics Step (Evolutionary Game Theory)
 * dx_i/dt = x_i * (f_i(x) - avg_f(x))
 */
export function replicatorStep(state: GameState, gridLoad: number): GameState {
  const { probabilities, type, customPayoffs } = state;
  const dt = 0.1; // Time step
  
  // Calculate fitness for each strategy
  let f0: number, f1: number;
  
  if (type === 'custom' && customPayoffs) {
    f0 = probabilities[0] * customPayoffs['0-0'][0] + probabilities[1] * customPayoffs['0-1'][0];
    f1 = probabilities[0] * customPayoffs['1-0'][0] + probabilities[1] * customPayoffs['1-1'][0];
  } else {
    f0 = getPayoff(0, (state.players - 1) * probabilities[0], gridLoad, type);
    f1 = getPayoff(1, (state.players - 1) * probabilities[0], gridLoad, type);
  }
  
  const avgFitness = probabilities[0] * f0 + probabilities[1] * f1;
  
  // Update probabilities
  let nextP0 = probabilities[0] + probabilities[0] * (f0 - avgFitness) * dt;
  let nextP1 = probabilities[1] + probabilities[1] * (f1 - avgFitness) * dt;
  
  // Normalize and clamp
  const sum = nextP0 + nextP1;
  nextP0 = Math.max(0.001, Math.min(0.999, nextP0 / sum));
  nextP1 = 1 - nextP0;
  
  const nextProbabilities = [nextP0, nextP1];
  
  return {
    ...state,
    probabilities: nextProbabilities,
    evolutionHistory: [...state.evolutionHistory.slice(-99), nextProbabilities]
  };
}

/**
 * Calculates Quantal Response Equilibrium (QRE) for a 2x2 symmetric game
 * p = exp(lambda * EU(0)) / (exp(lambda * EU(0)) + exp(lambda * EU(1)))
 * where EU(0) = p*a + (1-p)*b and EU(1) = p*c + (1-p)*d
 */
export function calculateQRE(gridLoad: number, type: GameType, lambda: number, customPayoffs?: { [key: string]: [number, number] }): number {
  const m = customPayoffs || generatePayoffMatrix(gridLoad, type);
  const a = m['0-0'][0];
  const b = m['0-1'][0];
  const c = m['1-0'][0];
  const d = m['1-1'][0];

  // We solve for p such that p = f(p) where f is the logit response
  // We use fixed-point iteration
  let p = 0.5;
  for (let i = 0; i < 20; i++) {
    const eu0 = p * a + (1 - p) * b;
    const eu1 = p * c + (1 - p) * d;
    
    // Logit response
    const exp0 = Math.exp(Math.min(700, lambda * eu0 / 100)); // Scaled for stability
    const exp1 = Math.exp(Math.min(700, lambda * eu1 / 100));
    
    p = exp0 / (exp0 + exp1);
  }
  
  return p;
}

/**
 * Finds Nash Equilibria for a 2x2 symmetric game
 */
export function findNashEquilibria(gridLoad: number, type: GameType, customPayoffs?: { [key: string]: [number, number] }): { type: 'pure' | 'mixed', strategies: number[][] }[] {
  const m = customPayoffs || generatePayoffMatrix(gridLoad, type);
  const equilibria: any[] = [];
  
  // Pure Strategy Nash Equilibria
  // (0,0)
  if (m['0-0'][0] >= m['1-0'][0] && m['0-0'][1] >= m['0-1'][1]) {
    equilibria.push({ type: 'pure', strategies: [[1, 0], [1, 0]] });
  }
  // (1,1)
  if (m['1-1'][0] >= m['0-1'][0] && m['1-1'][1] >= m['1-0'][1]) {
    equilibria.push({ type: 'pure', strategies: [[0, 1], [0, 1]] });
  }
  // (0,1)
  if (m['0-1'][0] >= m['1-1'][0] && m['0-1'][1] >= m['0-0'][1]) {
    equilibria.push({ type: 'pure', strategies: [[1, 0], [0, 1]] });
  }
  // (1,0)
  if (m['1-0'][0] >= m['0-0'][0] && m['1-0'][1] >= m['1-1'][1]) {
    equilibria.push({ type: 'pure', strategies: [[0, 1], [1, 0]] });
  }
  
  // Mixed Strategy Nash Equilibrium (for 2x2 symmetric)
  // p* = (d-b) / (a-c+d-b) where matrix is [[a,b],[c,d]]
  const a = m['0-0'][0];
  const b = m['0-1'][0];
  const c = m['1-0'][0];
  const d = m['1-1'][0];
  
  const numerator = d - b;
  const denominator = (a - c) + (d - b);
  
  if (denominator !== 0) {
    const p = numerator / denominator;
    if (p > 0 && p < 1) {
      equilibria.push({ type: 'mixed', strategies: [[p, 1-p], [p, 1-p]] });
    }
  }
  
  return equilibria;
}

/**
 * Generates a 2x2 Payoff Matrix for visualization (Driver A vs Driver B)
 */
export function generatePayoffMatrix(gridLoad: number, type: GameType = 'charging', customPayoffs?: { [key: string]: [number, number] }): any {
  if (type === 'custom' && customPayoffs) return customPayoffs;
  
  const strategies = [0, 1];
  const matrix: any = {};

  strategies.forEach((i) => {
    strategies.forEach((j) => {
      const p1 = getPayoff(i, j === 0 ? 1 : 0, gridLoad, type);
      const p2 = getPayoff(j, i === 0 ? 1 : 0, gridLoad, type);
      matrix[`${i}-${j}`] = [Math.floor(p1), Math.floor(p2)];
    });
  });

  return matrix;
}

/**
 * Exports the game to Gambit's .nfg (Normal Form Game) format
 */
export function exportToNFG(gridLoad: number, type: GameType = 'charging', customPayoffs?: { [key: string]: [number, number] }): string {
  const matrix = customPayoffs || generatePayoffMatrix(gridLoad, type);
  const strategies = type === 'charging' ? ["Charge", "Wait"] : 
                    type === 'v2g_coop' ? ["Cooperate", "Defect"] :
                    type === 'grid_hawk_dove' ? ["Hawk", "Dove"] :
                    type === 'public_goods' ? ["Contribute", "Free-ride"] :
                    type === 'grid_sharing' ? ["Share", "Hoard"] :
                    type === 'waiting_dilemma' ? ["Fast", "Standard"] :
                    type === 'classic_pd' ? ["Cooperate", "Defect"] :
                    type === 'classic_bos' ? ["Opera", "Football"] :
                    type === 'classic_mp' ? ["Heads", "Tails"] :
                    type === 'classic_sh' ? ["Stag", "Hare"] :
                    type === 'classic_chicken' ? ["Swerve", "Straight"] :
                    type === 'classic_coord' ? ["Option A", "Option B"] :
                    ["Strategy A", "Strategy B"];
  
  const payoffs = [
    matrix['0-0'][0], matrix['0-0'][1],
    matrix['0-1'][0], matrix['0-1'][1],
    matrix['1-0'][0], matrix['1-0'][1],
    matrix['1-1'][0], matrix['1-1'][1]
  ].join(' ');

  return `NFG 1 R "Energy Game: ${type}" { "Player 1" "Player 2" } { ${strategies.length} ${strategies.length} }
"${strategies[0]}" "${strategies[1]}"
"${strategies[0]}" "${strategies[1]}"
${payoffs}`;
}
