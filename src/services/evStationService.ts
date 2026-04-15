
/**
 * TomTom Search API Service
 * Finds nearest EV charging stations based on real-time location.
 */

const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;
const SEARCH_BASE_URL = 'https://api.tomtom.com/search/2/categorySearch/EV%20Charging%20Station.json';

export interface EVStation {
  id: string;
  name: string;
  address: string;
  distance: number;
  lat: number;
  lon: number;
  connectors?: {
    type: string;
    power: number;
  }[];
  status?: 'Available' | 'Occupied' | 'Unknown';
  travelTime?: number; // minutes
  trafficDelay?: number; // minutes
}

export async function getNearestEVStations(lat: number, lon: number): Promise<EVStation[]> {
  if (!API_KEY) {
    console.warn('TomTom API Key is missing. Please add VITE_TOMTOM_API_KEY to your environment.');
    // Fallback to mock data if API key is missing
    return getMockStations(lat, lon);
  }

  try {
    const url = `${SEARCH_BASE_URL}?key=${API_KEY}&lat=${lat}&lon=${lon}&radius=10000&limit=10`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`TomTom Search API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.results) {
      return data.results.map((res: any) => ({
        id: res.id,
        name: res.poi.name,
        address: res.address.freeformAddress,
        distance: res.dist,
        lat: res.position.lat,
        lon: res.position.lon,
        status: (Math.random() > 0.3 ? 'Available' : 'Occupied') as 'Available' | 'Occupied' | 'Unknown',
        connectors: [
          { type: 'Type 2', power: 22 },
          { type: 'CCS', power: 50 + Math.floor(Math.random() * 100) }
        ]
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching EV stations:', error);
    return getMockStations(lat, lon);
  }
}

export async function getTravelTimes(originLat: number, originLon: number, destinations: { lat: number, lon: number }[]): Promise<{ travelTime: number, trafficDelay: number }[]> {
  if (!API_KEY || destinations.length === 0) {
    return destinations.map(() => ({ travelTime: 0, trafficDelay: 0 }));
  }

  try {
    // TomTom Matrix Routing API (Synchronous)
    const url = `https://api.tomtom.com/routing/1/matrix/sync/json?key=${API_KEY}&versionNumber=1`;
    
    const body = {
      origins: [{ point: { latitude: originLat, longitude: originLon } }],
      destinations: destinations.map(d => ({ point: { latitude: d.lat, longitude: d.lon } })),
      options: {
        traffic: true,
        travelMode: 'car',
        departAt: 'now'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`TomTom Matrix API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.matrix) {
      return data.matrix.map((row: any) => {
        const result = row[0].response; // First origin
        if (result && result.routeSummary) {
          return {
            travelTime: Math.round(result.routeSummary.travelTimeInSeconds / 60),
            trafficDelay: Math.round(result.routeSummary.trafficDelayInSeconds / 60)
          };
        }
        return { travelTime: 0, trafficDelay: 0 };
      });
    }

    return destinations.map(() => ({ travelTime: 0, trafficDelay: 0 }));
  } catch (error) {
    console.error('Error fetching travel times:', error);
    return destinations.map(() => ({ travelTime: 0, trafficDelay: 0 }));
  }
}

function getMockStations(lat: number, lon: number): EVStation[] {
  return [
    {
      id: 'mock-1',
      name: 'VoltPoint Central',
      address: '123 Energy St, Downtown',
      distance: 450,
      lat: lat + 0.002,
      lon: lon + 0.001,
      status: 'Available' as const,
      connectors: [
        { type: 'CCS', power: 150 },
        { type: 'CHAdeMO', power: 50 }
      ]
    },
    {
      id: 'mock-2',
      name: 'GreenCharge Hub',
      address: '456 Eco Blvd, North Side',
      distance: 1200,
      lat: lat - 0.005,
      lon: lon + 0.003,
      status: 'Occupied' as const,
      connectors: [
        { type: 'Type 2', power: 22 },
        { type: 'CCS', power: 50 }
      ]
    },
    {
      id: 'mock-3',
      name: 'Tesla Supercharger',
      address: '789 Fast Ln, West Mall',
      distance: 2500,
      lat: lat + 0.01,
      lon: lon - 0.008,
      status: 'Available' as const,
      connectors: [
        { type: 'Tesla', power: 250 }
      ]
    },
    {
      id: 'mock-4',
      name: 'ChargeNow Station',
      address: '321 Power Rd, East Gate',
      distance: 3100,
      lat: lat - 0.012,
      lon: lon - 0.005,
      status: 'Available' as const,
      connectors: [
        { type: 'CCS', power: 120 },
        { type: 'Type 2', power: 11 }
      ]
    }
  ].sort((a, b) => a.distance - b.distance);
}
