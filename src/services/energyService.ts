
import * as math from 'mathjs';
import solver from 'javascript-lp-solver';
import { EnergyUsageState, EnergyRecommendation, EnergyWeights } from '../types';

// Transition Matrix P for states: [Low, Medium, High]
export const TRANSITION_MATRIX = [
  [0.7, 0.2, 0.1], // From Low
  [0.3, 0.5, 0.2], // From Medium
  [0.1, 0.3, 0.6]  // From High
];

export function predictUsage(initialState: number[], steps: number = 1): EnergyUsageState[] {
  const matrix = math.matrix(TRANSITION_MATRIX);
  let resultMatrix = matrix;
  
  for (let i = 1; i < steps; i++) {
    resultMatrix = math.multiply(resultMatrix, matrix) as math.Matrix;
  }
  
  const initial = math.matrix(initialState);
  const prediction = math.multiply(initial, resultMatrix).toArray() as number[];
  
  return [
    { state: "Low", probability: prediction[0] },
    { state: "Medium", probability: prediction[1] },
    { state: "High", probability: prediction[2] }
  ];
}

/**
 * Calculates the steady-state (equilibrium) distribution of the Markov Chain.
 * Uses power iteration for simplicity.
 */
export function calculateEquilibrium(): number[] {
  const matrix = math.matrix(TRANSITION_MATRIX);
  let v = math.matrix([1/3, 1/3, 1/3]);
  
  // Power iteration to find the stationary distribution
  for (let i = 0; i < 100; i++) {
    v = math.multiply(v, matrix) as math.Matrix;
  }
  
  return v.toArray() as number[];
}

/**
 * Calculates the Shannon Entropy of a probability distribution.
 * Higher entropy means higher uncertainty.
 */
export function calculateEntropy(probabilities: number[]): number {
  return -probabilities.reduce((acc, p) => {
    if (p <= 0) return acc;
    return acc + p * Math.log2(p);
  }, 0);
}

/**
 * Performs a sensitivity analysis on the optimization weights.
 * Returns how the objective value changes as we perturb each weight.
 */
export function performSensitivityAnalysis(currentWeights: EnergyWeights) {
  const keys = ['cost', 'comfort', 'efficiency'] as const;
  const results: any[] = [];
  const perturbation = 0.1;

  keys.forEach(key => {
    const plusWeights = { ...currentWeights, [key]: Math.min(1, currentWeights[key] + perturbation) };
    const minusWeights = { ...currentWeights, [key]: Math.max(0, currentWeights[key] - perturbation) };
    
    const plusOpt = optimizeEnergy(plusWeights);
    const minusOpt = optimizeEnergy(minusWeights);
    
    results.push({
      metric: key.toUpperCase(),
      sensitivity: (plusOpt.result - minusOpt.result) / (2 * perturbation)
    });
  });

  return results;
}

/**
 * Calculates Sigma (σ) - Fluctuation in power consumption
 * Based on the variance of the predicted state probabilities
 */
export function calculateSigma(prediction: EnergyUsageState[]): number {
  const values = prediction.map(p => p.probability);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export const GOAL_COEFFICIENTS = {
  hvac: { comfort: 1.5, efficiency: 0.5, cost: 1.2, usage: 1 },
  lighting: { comfort: 0.8, efficiency: 1.2, cost: 0.3, usage: 0.5 },
  appliances: { comfort: 0.5, efficiency: 1.5, cost: 0.6, usage: 0.8 },
  evCharging: { comfort: 1.2, efficiency: 0.3, cost: 1.5, usage: 1.5 },
  industrialLoads: { comfort: 0.2, efficiency: 1.8, cost: 2.5, usage: 2.0 }
};

/**
 * Goal Programming Optimization
 * 
 * Formal Goal Programming approach:
 * 1. Define targets (goals) for Cost, Comfort, and Efficiency.
 * 2. Minimize the weighted sum of deviations from these targets.
 * 
 * Target Values:
 * - Cost: Minimize (Target: 0)
 * - Comfort: Maximize (Target: 100)
 * - Efficiency: Maximize (Target: 100)
 */
export function optimizeEnergy(weights: EnergyWeights, totalLimit: number = 100): any {
  // We define a model where we minimize the 'weighted deviation' from our goals.
  // The weights determine the priority of each goal.
  const model = {
    optimize: "deviation",
    opType: "min" as const,
    constraints: {
      // Hard physical constraints
      usage: { max: totalLimit },
      // Minimum safety/operational thresholds
      comfort: { min: 40 }, 
      efficiency: { min: 30 }
    },
    variables: {
      // Each variable represents an energy-consuming system.
      // Its contribution to the overall goals is defined by its properties.
      hvac: { 
        ...GOAL_COEFFICIENTS.hvac,
        deviation: (weights.cost * GOAL_COEFFICIENTS.hvac.cost - weights.comfort * GOAL_COEFFICIENTS.hvac.comfort - weights.efficiency * GOAL_COEFFICIENTS.hvac.efficiency)
      },
      lighting: { 
        ...GOAL_COEFFICIENTS.lighting,
        deviation: (weights.cost * GOAL_COEFFICIENTS.lighting.cost - weights.comfort * GOAL_COEFFICIENTS.lighting.comfort - weights.efficiency * GOAL_COEFFICIENTS.lighting.efficiency)
      },
      appliances: { 
        ...GOAL_COEFFICIENTS.appliances,
        deviation: (weights.cost * GOAL_COEFFICIENTS.appliances.cost - weights.comfort * GOAL_COEFFICIENTS.appliances.comfort - weights.efficiency * GOAL_COEFFICIENTS.appliances.efficiency)
      },
      evCharging: { 
        ...GOAL_COEFFICIENTS.evCharging,
        deviation: (weights.cost * GOAL_COEFFICIENTS.evCharging.cost - weights.comfort * GOAL_COEFFICIENTS.evCharging.comfort - weights.efficiency * GOAL_COEFFICIENTS.evCharging.efficiency)
      },
      industrialLoads: {
        ...GOAL_COEFFICIENTS.industrialLoads,
        deviation: (weights.cost * GOAL_COEFFICIENTS.industrialLoads.cost - weights.comfort * GOAL_COEFFICIENTS.industrialLoads.comfort - weights.efficiency * GOAL_COEFFICIENTS.industrialLoads.efficiency)
      }
    }
  };
  
  const result = solver.Solve(model);
  return result;
}

export function getRecommendations(
  prediction: EnergyUsageState[], 
  sigma: number, 
  congestionIndex: number = 0,
  feedbackMap: Record<string, 'helpful' | 'not-helpful'> = {},
  lat: number = 37.7749,
  lon: number = -122.4194
): EnergyRecommendation[] {
  const highProb = prediction.find(p => p.state === "High")?.probability || 0;
  const mediumProb = prediction.find(p => p.state === "Medium")?.probability || 0;
  const lowProb = prediction.find(p => p.state === "Low")?.probability || 0;
  
  const recs: EnergyRecommendation[] = [];
  
  const evDemandData = getPredictedEVDemand(lat, lon);
  const currentEVDemand = evDemandData[0]?.demand || 0;
  const evCapacity = evDemandData[0]?.capacity || 100;
  const evLoadRatio = currentEVDemand / evCapacity;

  const addRec = (rec: Omit<EnergyRecommendation, 'id'>) => {
    const id = rec.action.toLowerCase().replace(/\s+/g, '-');
    let impactScore = rec.impactScore;
    
    // Adjust score based on feedback
    if (feedbackMap[id] === 'helpful') {
      impactScore = Math.min(100, impactScore + 15);
    } else if (feedbackMap[id] === 'not-helpful') {
      impactScore = Math.max(0, impactScore - 25);
    }
    
    // Suppress if consistently marked as not helpful and score is low
    if (feedbackMap[id] === 'not-helpful' && impactScore < 15) {
      return;
    }
    
    recs.push({ ...rec, id, impactScore });
  };
  
  // 1. Grid Stability (Sigma-based)
  if (sigma > 0.3) {
    addRec({
      action: "Dynamic Grid Balancing",
      impact: `Critical instability (σ=${sigma.toFixed(3)}). Activating fast-response battery storage.`,
      priority: "High",
      type: "Grid",
      severity: 9,
      impactScore: 95
    });
  } else if (sigma > 0.1) {
    addRec({
      action: "Load Smoothing",
      impact: "Minor fluctuation detected. Throttling non-critical industrial loads.",
      priority: "Medium",
      type: "Grid",
      severity: 5,
      impactScore: 60
    });
  }

  // 2. Peak Demand Management (High State Probability)
  if (highProb > 0.6) {
    addRec({
      action: "Emergency Load Shedding",
      impact: "Immediate 20% reduction in non-essential sector power.",
      priority: "High",
      type: "Peak",
      severity: 10,
      impactScore: 100
    });
  } else if (highProb > 0.25) {
    addRec({
      action: "Peak Shaving Strategy",
      impact: "Dispatching distributed energy resources (DERs) to offset load.",
      priority: "High",
      type: "Peak",
      severity: 7,
      impactScore: 80
    });
    addRec({
      action: "Pre-cooling Protocol",
      impact: "Aggressive thermal storage charging to shift 30kWh load.",
      priority: "Medium",
      type: "Peak",
      severity: 6,
      impactScore: 70
    });
  }

  // 3. Efficiency Optimization (Medium State Probability)
  if (mediumProb > 0.4) {
    addRec({
      action: "HVAC Setpoint Optimization",
      impact: "Adjusting thermostat by 2°F to save 8% system energy.",
      priority: "Medium",
      type: "Efficiency",
      severity: 4,
      impactScore: 50
    });
  }
  
  if (mediumProb > 0.2) {
    addRec({
      action: "Lighting Dimming",
      impact: "Reducing auxiliary lighting by 30% in low-occupancy zones.",
      priority: "Low",
      type: "Efficiency",
      severity: 2,
      impactScore: 30
    });
  }

  // 4. Maintenance & Baseline (Low State Probability)
  if (lowProb > 0.5) {
    addRec({
      action: "System Health Diagnostics",
      impact: "Running deep-cycle maintenance on idle storage units.",
      priority: "Low",
      type: "Maintenance",
      severity: 1,
      impactScore: 15
    });
  }

  // 5. EV Charging Correlation (Contextual + Traffic + Demand)
  if (congestionIndex > 60 && evLoadRatio < 0.4) {
    addRec({
      action: "Congestion-Aware Charging Delay",
      impact: `High traffic (${congestionIndex}%) but low local EV demand. Deferring non-essential charging to avoid future peak overlap.`,
      priority: "Medium",
      type: "EV",
      severity: 6,
      impactScore: 75
    });
  } else if (congestionIndex > 40) {
    addRec({
      action: "EV Demand Throttling",
      impact: `Traffic congestion (${congestionIndex}%) detected. Limiting public EV charging to 50kW to prevent local grid overload.`,
      priority: "High",
      type: "EV",
      severity: 8,
      impactScore: 88
    });
  } else if (congestionIndex > 20) {
    addRec({
      action: "Smart EV Scheduling",
      impact: "Incentivizing EV charging delays via dynamic pricing due to rising traffic flow.",
      priority: "Medium",
      type: "EV",
      severity: 5,
      impactScore: 65
    });
  }

  // 6. Baseline Recommendation (Always present if list is small)
  if (recs.length < 2) {
    addRec({
      action: "Baseline Efficiency Audit",
      impact: "System operating within nominal parameters. Performing background telemetry sync.",
      priority: "Low",
      type: "Efficiency",
      severity: 1,
      impactScore: 10
    });
  }

  if (highProb > 0.7 && sigma > 0.3 && evLoadRatio > 0.7) {
    addRec({
      action: "V2G Critical Grid Support",
      impact: "Grid load critical and EV demand at peak. Activating V2G to supply 15kW back to the local cluster.",
      priority: "High",
      type: "EV",
      severity: 10,
      impactScore: 98
    });
  } else if (highProb > 0.5 && sigma > 0.25) {
    addRec({
      action: "V2G (Vehicle-to-Grid) Activation",
      impact: "Drawing 5kWh from connected EVs to stabilize local transformer.",
      priority: "High",
      type: "EV",
      severity: 8,
      impactScore: 85
    });
  }

  // 8. V2G Service Recommendation (Grid Load + EV Availability)
  const availableEVs = evCapacity - currentEVDemand;
  if (highProb > 0.45 && availableEVs > 50) {
    addRec({
      action: "V2G Community Energy Sharing",
      impact: `Grid load is elevated (${(highProb * 100).toFixed(0)}%) and ${availableEVs.toFixed(0)}kW of EV capacity is idle. Activating community V2G sharing protocols.`,
      priority: "High",
      type: "EV",
      severity: 8,
      impactScore: 90
    });
  }

  // 9. Critical Multi-Factor Rule
  if (highProb > 0.6 && sigma > 0.3 && congestionIndex > 70) {
    addRec({
      action: "Grid-Critical EV Load Shedding",
      impact: "Simultaneous high grid stress and traffic congestion. Mandatory suspension of all non-emergency EV charging.",
      priority: "High",
      type: "Peak",
      severity: 10,
      impactScore: 98
    });
  }

  // Sort by severity and impactScore descending
  return recs.sort((a, b) => {
    const scoreA = a.severity * a.impactScore;
    const scoreB = b.severity * b.impactScore;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.severity - a.severity;
  });
}

/**
 * Generates mock historical energy data for a given date range.
 * Includes daily consumption, peak load, and efficiency metrics.
 */
export function getHistoricalData(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  const data = Array.from({ length: days }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    
    // Add some "seasonality" and random noise
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseLoad = isWeekend ? 350 : 450;
    const seasonality = Math.sin((date.getMonth() / 12) * Math.PI) * 50;
    const noise = Math.random() * 100 - 50;
    
    const consumption = Math.max(200, Math.floor(baseLoad + seasonality + noise));
    const peakLoad = Math.floor(consumption * (1.2 + Math.random() * 0.4));
    const efficiency = 85 + Math.random() * 10;
    
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: date.toISOString().split('T')[0],
      consumption,
      peakLoad,
      efficiency: parseFloat(efficiency.toFixed(1))
    };
  });

  const totalConsumption = data.reduce((acc, curr) => acc + curr.consumption, 0);
  const averageConsumption = data.length > 0 ? totalConsumption / data.length : 0;
  const maxPeak = data.length > 0 ? Math.max(...data.map(d => d.peakLoad)) : 0;
  const avgEfficiency = data.length > 0 ? data.reduce((acc, curr) => acc + curr.efficiency, 0) / data.length : 0;
  const loadFactor = maxPeak > 0 ? (averageConsumption / maxPeak) * 100 : 0;

  return {
    data,
    metrics: {
      total: totalConsumption,
      average: averageConsumption,
      peak: maxPeak,
      efficiency: avgEfficiency,
      loadFactor
    }
  };
}

/**
 * Generates mock historical Markov state probabilities for the last 24 hours.
 */
export function getHistoricalMarkovStates() {
  const data = [];
  const now = new Date();
  
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hour = time.getHours();
    
    // Base probabilities based on typical daily load curves
    let low = 0.3, medium = 0.4, high = 0.3;
    
    if (hour >= 23 || hour <= 5) {
      low = 0.7; medium = 0.2; high = 0.1;
    } else if (hour >= 8 && hour <= 10) {
      low = 0.1; medium = 0.3; high = 0.6;
    } else if (hour >= 17 && hour <= 21) {
      low = 0.05; medium = 0.25; high = 0.7;
    }
    
    // Add some noise and normalize
    const noiseL = Math.random() * 0.1 - 0.05;
    const noiseM = Math.random() * 0.1 - 0.05;
    const noiseH = Math.random() * 0.1 - 0.05;
    
    let nL = Math.max(0, low + noiseL);
    let nM = Math.max(0, medium + noiseM);
    let nH = Math.max(0, high + noiseH);
    const sum = nL + nM + nH;
    
    data.push({
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      Low: nL / sum,
      Medium: nM / sum,
      High: nH / sum
    });
  }
  
  return data;
}

/**
 * Generates mock predicted EV charging demand for the next few hours.
 * Based on time of day and some random factors.
 */
export function getPredictedEVDemand(lat: number, lon: number) {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Use lat/lon to seed some "local" variation
  const seed = Math.abs(lat + lon);
  
  return Array.from({ length: 6 }, (_, i) => {
    const hour = (currentHour + i) % 24;
    const timeLabel = `${hour}:00`;
    
    // Typical EV demand curve: peaks in morning (8-10) and evening (17-21)
    let baseDemand = 20; // kW
    if (hour >= 7 && hour <= 10) baseDemand = 65;
    if (hour >= 17 && hour <= 22) baseDemand = 85;
    if (hour >= 23 || hour <= 5) baseDemand = 15;
    
    // Add some variation based on location seed and random noise
    const variation = Math.sin(seed + i) * 10;
    const noise = Math.random() * 5;
    
    const demand = Math.max(5, Math.floor(baseDemand + variation + noise));
    
    return {
      time: timeLabel,
      demand,
      capacity: 120 // Max capacity of the local cluster
    };
  });
}
