
import { ChargingStation, OptimizationWeights } from "../types";

const TOMTOM_API_KEY = "hq92jWWbgvNAvCG6P5Er25R0kPrwddTe";

export async function getChargingStations(lat: number, lon: number, radius: number = 5000): Promise<ChargingStation[]> {
  const url = `https://api.tomtom.com/search/2/poiSearch/electric%20vehicle%20station.json?key=${TOMTOM_API_KEY}&lat=${lat}&lon=${lon}&radius=${radius}&limit=25`;
  
  try {
    const response = await fetch(url);
    const result = await response.json();
    const results = result.results || [];
    
    return results.map((s: any) => {
      const connectors = s.poi.chargingPark?.connectors || [];
      const speed = connectors.length > 0 
        ? Math.max(...connectors.map((c: any) => c.maxPowerKW || 22)) 
        : 22;
        
      return {
        id: s.id,
        name: s.poi.name,
        lat: s.position.lat,
        lon: s.position.lon,
        dist: Number((s.dist / 1000).toFixed(2)),
        speed: speed,
        cost: Number((0.5 + speed * 0.01).toFixed(2)),
        accessibility: Math.random() * 0.4 + 0.6,
        reliability: Math.random() * 0.5 + 0.5,
        safety: Math.random() * 0.4 + 0.6,
        ux: Math.random() * 0.5 + 0.5,
        realTime: Math.random() * 0.5 + 0.5,
      };
    });
  } catch (error) {
    console.error("TomTom API Error:", error);
    return [];
  }
}

export function filterDominance(stations: ChargingStation[]): ChargingStation[] {
  return stations.filter((row, i) => {
    let dominated = false;
    for (let j = 0; j < stations.length; j++) {
      if (i === j) continue;
      const other = stations[j];
      
      const betterEqual = (
        other.speed >= row.speed &&
        other.cost <= row.cost &&
        other.dist <= row.dist &&
        other.accessibility >= row.accessibility &&
        other.reliability >= row.reliability &&
        other.safety >= row.safety &&
        other.ux >= row.ux &&
        other.realTime >= row.realTime
      );
      
      const strictlyBetter = (
        other.speed > row.speed ||
        other.cost < row.cost ||
        other.dist < row.dist ||
        other.accessibility > row.accessibility ||
        other.reliability > row.reliability ||
        other.safety > row.safety ||
        other.ux > row.ux ||
        other.realTime > row.realTime
      );
      
      if (betterEqual && strictlyBetter) {
        dominated = true;
        break;
      }
    }
    return !dominated;
  });
}

export function applyTopsis(stations: ChargingStation[], weights: OptimizationWeights): ChargingStation[] {
  const criteria: (keyof OptimizationWeights)[] = ['speed', 'cost', 'dist', 'accessibility', 'reliability', 'safety', 'ux', 'realTime'];
  const data = [...stations];
  
  // Normalization
  const denoms: Record<string, number> = {};
  criteria.forEach(col => {
    denoms[col] = Math.sqrt(data.reduce((acc, row) => acc + Math.pow(row[col] as number, 2), 0));
  });
  
  const normalized = data.map(row => {
    const nRow: any = { ...row };
    criteria.forEach(col => {
      nRow[col] = denoms[col] !== 0 ? (row[col] as number) / denoms[col] : 0;
      nRow[col] *= weights[col];
    });
    return nRow;
  });
  
  const vPlus: any = {};
  const vMinus: any = {};
  
  criteria.forEach(col => {
    const values = normalized.map(r => r[col]);
    if (col === 'cost' || col === 'dist') {
      vPlus[col] = Math.min(...values);
      vMinus[col] = Math.max(...values);
    } else {
      vPlus[col] = Math.max(...values);
      vMinus[col] = Math.min(...values);
    }
  });
  
  const results = normalized.map((row, i) => {
    const sPlus = Math.sqrt(criteria.reduce((acc, col) => acc + Math.pow(row[col] - vPlus[col], 2), 0));
    const sMinus = Math.sqrt(criteria.reduce((acc, col) => acc + Math.pow(row[col] - vMinus[col], 2), 0));
    const score = sMinus / (sPlus + sMinus);
    return { ...data[i], score };
  });
  
  return results.sort((a, b) => (b.score || 0) - (a.score || 0));
}

export function applyNashEquilibrium(stations: ChargingStation[], weights: OptimizationWeights): ChargingStation[] {
  const criteria: (keyof OptimizationWeights)[] = ['speed', 'cost', 'dist', 'accessibility', 'reliability', 'safety', 'ux', 'realTime'];
  const data = [...stations];
  
  const normalized = data.map(row => {
    const nRow: any = { ...row };
    criteria.forEach(col => {
      const values = data.map(r => r[col] as number);
      const max = Math.max(...values);
      const min = Math.min(...values);
      if (max !== min) {
        nRow[col] = ((row[col] as number) - min) / (max - min);
      } else {
        nRow[col] = 0.5;
      }
    });
    nRow.cost = 1 - nRow.cost;
    nRow.dist = 1 - nRow.dist;
    return nRow;
  });
  
  const payoffs = normalized.map(row => {
    return criteria.reduce((acc, col) => acc + weights[col] * row[col], 0);
  });
  
  const totalPayoff = payoffs.reduce((a, b) => a + b, 0);
  
  const results = data.map((row, i) => ({
    ...row,
    score: totalPayoff !== 0 ? payoffs[i] / totalPayoff : 0
  }));
  
  return results.sort((a, b) => (b.score || 0) - (a.score || 0));
}
