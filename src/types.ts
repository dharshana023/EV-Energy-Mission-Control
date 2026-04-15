
export interface ChargingStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  dist: number; // km
  speed: number; // kW
  cost: number; // $
  accessibility: number; // 0-1
  reliability: number; // 0-1
  safety: number; // 0-1
  ux: number; // 0-1
  realTime: number; // 0-1
  score?: number;
  marketShare?: number;
  optimalSlots?: number;
  utilization?: number;
  predictedTime?: number;
}

export interface OptimizationWeights {
  speed: number;
  cost: number;
  dist: number;
  accessibility: number;
  reliability: number;
  safety: number;
  ux: number;
  realTime: number;
}

export type OptimizationMethod = "TOPSIS" | "Utility" | "Nash";

export interface EnergyUsageState {
  state: "Low" | "Medium" | "High";
  probability: number;
}

export interface EnergyWeights {
  cost: number;
  comfort: number;
  efficiency: number;
}

export interface EnergyRecommendation {
  id: string;
  action: string;
  impact: string;
  priority: "High" | "Medium" | "Low";
  type: "Grid" | "Peak" | "Efficiency" | "Maintenance" | "EV";
  severity: number; // 1-10
  impactScore: number; // 0-100
}

export interface GridAlert {
  id: string;
  timestamp: string;
  type: 'Critical' | 'Warning' | 'Info' | 'Success';
  source: string;
  message: string;
  value?: string;
  status: 'Active' | 'Resolved' | 'Acknowledged';
}
