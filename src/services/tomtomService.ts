/**
 * TomTom Traffic API Service
 * Fetches real-time traffic flow and density to correlate with grid load.
 */

const TOMTOM_BASE_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

export interface TrafficFlowData {
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime: number;
  freeFlowTravelTime: number;
  confidence: number;
  roadClosure: boolean;
}

export async function getTrafficFlow(lat: number, lon: number): Promise<TrafficFlowData | null> {
  if (!API_KEY) {
    console.warn('TomTom API Key is missing. Please add VITE_TOMTOM_API_KEY to your environment.');
    return null;
  }

  try {
    const response = await fetch(`${TOMTOM_BASE_URL}?key=${API_KEY}&point=${lat},${lon}`);
    if (!response.ok) {
      throw new Error(`TomTom API Error: ${response.statusText}`);
    }
    const data = await response.json();
    
    if (data.flowSegmentData) {
      const { currentSpeed, freeFlowSpeed, currentTravelTime, freeFlowTravelTime, confidence, roadClosure } = data.flowSegmentData;
      return {
        currentSpeed,
        freeFlowSpeed,
        currentTravelTime,
        freeFlowTravelTime,
        confidence,
        roadClosure
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching TomTom traffic data:', error);
    return null;
  }
}

/**
 * Calculates a congestion index (0-100)
 * 0 = Free flow, 100 = Gridlock
 */
export function calculateCongestionIndex(data: TrafficFlowData): number {
  if (data.freeFlowSpeed === 0) return 0;
  const ratio = data.currentSpeed / data.freeFlowSpeed;
  const index = Math.max(0, Math.min(100, (1 - ratio) * 100));
  return Math.round(index);
}
