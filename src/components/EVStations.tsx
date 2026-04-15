
import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Zap, Battery, Clock, Search, Globe, AlertCircle, RefreshCw, ExternalLink, Activity, BarChart3 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getNearestEVStations, EVStation, getTravelTimes } from '../services/evStationService';
import { getPredictedEVDemand } from '../services/energyService';

// Fix Leaflet marker icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const stationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to update map center when location changes
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 13);
  return null;
}

export default function EVStations() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [stations, setStations] = useState<EVStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [predictedDemand, setPredictedDemand] = useState<any[]>([]);

  // Periodic refresh for demand forecast
  useEffect(() => {
    const interval = setInterval(() => {
      if (location) {
        setPredictedDemand(getPredictedEVDemand(location.lat, location.lon));
      }
    }, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [location]);

  const fetchLocationAndStations = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lon: longitude });
        
        try {
          const data = await getNearestEVStations(latitude, longitude);
          
          // Fetch travel times for all stations
          const travelData = await getTravelTimes(
            latitude, 
            longitude, 
            data.map(s => ({ lat: s.lat, lon: s.lon }))
          );

          const stationsWithTravel = data.map((s, i) => ({
            ...s,
            travelTime: travelData[i].travelTime,
            trafficDelay: travelData[i].trafficDelay
          }));

          setStations(stationsWithTravel);
          setPredictedDemand(getPredictedEVDemand(latitude, longitude));
        } catch (err) {
          setError('Failed to fetch EV stations.');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(`Location access denied: ${err.message}`);
        setLoading(false);
        // Fallback to default location (SF)
        const defaultLat = 37.7749;
        const defaultLon = -122.4194;
        setLocation({ lat: defaultLat, lon: defaultLon });
        fetchStations(defaultLat, defaultLon);
      },
      { timeout: 10000 }
    );
  };

  const fetchStations = async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNearestEVStations(lat, lon);
      
      // Fetch travel times for all stations
      const travelData = await getTravelTimes(
        lat, 
        lon, 
        data.map(s => ({ lat: s.lat, lon: s.lon }))
      );

      const stationsWithTravel = data.map((s, i) => ({
        ...s,
        travelTime: travelData[i].travelTime,
        trafficDelay: travelData[i].trafficDelay
      }));

      setStations(stationsWithTravel);
      setLocation({ lat, lon });
      setPredictedDemand(getPredictedEVDemand(lat, lon));
    } catch (err) {
      setError('Failed to fetch EV stations.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);

    if (isNaN(lat) || isNaN(lon)) {
      setError('Please enter valid numerical values for Latitude and Longitude.');
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError('Coordinates out of range. Lat: [-90, 90], Lon: [-180, 180]');
      return;
    }

    fetchStations(lat, lon);
  };

  useEffect(() => {
    fetchLocationAndStations();
  }, []);

  const filteredStations = stations.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header with Search & Refresh */}
      <div className="flex flex-col gap-4 bg-[#151619] p-4 rounded-2xl border border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input 
              type="text" 
              placeholder="Search stations by name or address..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm font-mono text-white outline-none focus:border-yellow-500/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={fetchLocationAndStations}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white/80 px-4 py-2 rounded-xl text-xs font-bold font-mono border border-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              AUTO-SYNC
            </button>
            <div className="h-8 w-px bg-white/10 hidden md:block" />
            <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase">
              <Globe size={12} className="text-blue-400" />
              <span>{location ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : 'LOCATING...'}</span>
            </div>
          </div>
        </div>

        {/* Manual Coordinate Input */}
        <div className="flex flex-col md:flex-row items-center gap-3 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase min-w-fit">
            <MapPin size={12} className="text-yellow-500" />
            <span>Manual Override:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 flex-1 w-full">
            <input 
              type="text" 
              placeholder="Latitude (e.g. 37.77)" 
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl py-1.5 px-3 text-xs font-mono text-white outline-none focus:border-yellow-500/50 transition-all"
            />
            <input 
              type="text" 
              placeholder="Longitude (e.g. -122.41)" 
              value={manualLon}
              onChange={(e) => setManualLon(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl py-1.5 px-3 text-xs font-mono text-white outline-none focus:border-yellow-500/50 transition-all"
            />
          </div>
          <button 
            onClick={handleManualSearch}
            disabled={loading}
            className="w-full md:w-auto bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1.5 rounded-xl text-[10px] font-bold font-mono transition-all disabled:opacity-50"
          >
            LOCATE NODES
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 text-sm font-mono">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stations List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest flex items-center gap-2">
              <Navigation size={14} className="text-yellow-500" /> Nearest Charging Nodes
            </h3>
            <span className="text-[10px] font-mono text-white/30 uppercase">{filteredStations.length} NODES FOUND</span>
          </div>

          {loading && stations.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 4, 5].map(i => (
                <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredStations.map((station, index) => (
                <div key={`${station.id}-${index}`} className="bg-[#151619] p-5 rounded-2xl border border-white/10 hover:border-yellow-500/30 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap size={60} />
                  </div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${station.status === 'Available' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                      <span className={`text-[9px] font-bold font-mono uppercase ${station.status === 'Available' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {station.status}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-white/30">ID: {station.id.slice(0, 8)}</span>
                  </div>

                  <h4 className="text-lg font-bold text-white mb-1 group-hover:text-yellow-500 transition-colors">{station.name}</h4>
                  <p className="text-xs text-white/40 font-mono mb-4 line-clamp-1">{station.address}</p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-white/20 uppercase font-mono">Distance</span>
                        <span className="text-sm font-bold font-mono text-blue-400">{(station.distance / 1000).toFixed(2)} km</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] text-white/20 uppercase font-mono">Est. Time</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold font-mono text-white">
                            {station.travelTime || Math.round(station.distance / 800)} min
                          </span>
                          {station.trafficDelay && station.trafficDelay > 0 && (
                            <span className="text-[8px] font-bold font-mono text-red-400">
                              (+{station.trafficDelay}m traffic)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`, '_blank')}
                      className="p-2 bg-white/5 hover:bg-yellow-500 hover:text-black rounded-lg transition-all"
                      title="Navigate"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredStations.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
              <Search size={40} className="text-white/10 mb-4" />
              <p className="text-sm font-mono text-white/30 uppercase">No stations match your search criteria</p>
            </div>
          )}

          {/* Predicted Demand Visualization */}
          <div className="bg-[#151619] rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-blue-400" />
                <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Demand Forecast</span>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-[7px] font-mono text-blue-400 uppercase">Live Forecast</span>
                </div>
              </div>
              <span className="text-[8px] font-mono text-white/30 uppercase">Next 6 Hours (kW)</span>
            </div>
            <div className="p-6 h-[200px]">
              {predictedDemand.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={predictedDemand} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 8, fill: '#888' }} 
                      axisLine={false} 
                      tickLine={false}
                      label={{ value: 'Time', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 10 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 8, fill: '#888' }} 
                      axisLine={false} 
                      tickLine={false}
                      label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151619', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="demand" radius={[4, 4, 0, 0]}>
                      {predictedDemand.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.demand > 70 ? '#ef4444' : entry.demand > 40 ? '#fbbf24' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[10px] font-mono text-white/20 uppercase">Awaiting Telemetry...</span>
                </div>
              )}
            </div>
            <div className="px-6 pb-6">
              <div className="flex justify-between items-center text-[8px] font-mono text-white/30 uppercase">
                <span>Peak Load Forecast</span>
                <span className="text-white/60">{Math.max(...predictedDemand.map(d => d.demand), 0)} kW</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-1000" 
                  style={{ width: `${(Math.max(...predictedDemand.map(d => d.demand), 0) / 120) * 100}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Map View */}
          <div className="bg-[#151619] rounded-2xl border border-white/10 h-[400px] relative group overflow-hidden">
            {location ? (
              <MapContainer 
                center={[location.lat, location.lon]} 
                zoom={13} 
                className="w-full h-full z-0"
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ChangeView center={[location.lat, location.lon]} />
                
                {/* User Location Marker */}
                <Marker position={[location.lat, location.lon]} icon={userIcon}>
                  <Popup>
                    <div className="font-mono text-xs">YOUR CURRENT POSITION</div>
                  </Popup>
                </Marker>

                {/* Station Markers */}
                {filteredStations.map((station, index) => (
                  <Marker 
                    key={`${station.id}-${index}`} 
                    position={[station.lat, station.lon]} 
                    icon={stationIcon}
                  >
                    <Popup>
                      <div className="p-1 min-w-[180px]">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-sm text-black">{station.name}</h4>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            station.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {station.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mb-2 leading-tight">{station.address}</p>
                        
                        <div className="flex justify-between items-center mb-3 p-2 bg-gray-50 rounded border border-gray-100">
                          <div className="flex flex-col">
                            <span className="text-[7px] text-gray-400 uppercase font-bold">Travel Time</span>
                            <span className="text-[10px] font-bold text-gray-700">
                              {station.travelTime || Math.round(station.distance / 800)} min
                            </span>
                          </div>
                          {station.trafficDelay && station.trafficDelay > 0 && (
                            <div className="flex flex-col items-end">
                              <span className="text-[7px] text-red-500 uppercase font-bold">Traffic Delay</span>
                              <span className="text-[10px] font-bold text-red-600">+{station.trafficDelay} min</span>
                            </div>
                          )}
                        </div>

                        {station.connectors && station.connectors.length > 0 && (
                          <div className="mb-3 space-y-1">
                            <div className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Available Connectors</div>
                            {station.connectors.map((conn, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-gray-50 p-1 rounded border border-gray-100">
                                <span className="text-[9px] font-bold text-gray-700">{conn.type}</span>
                                <span className="text-[9px] font-mono font-bold text-blue-600">{conn.power} kW</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button 
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`, '_blank')}
                            className="flex-1 text-[9px] bg-yellow-500 hover:bg-yellow-400 text-black py-1.5 rounded font-bold transition-colors uppercase"
                          >
                            Navigate
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20 mb-4 group-hover:scale-110 transition-transform duration-500">
                  <MapPin className="text-yellow-500" size={32} />
                </div>
                <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-widest">Interactive Map</h4>
                <p className="text-[10px] text-white/30 font-mono leading-relaxed">
                  Locating your position to initialize the real-time node map...
                </p>
              </div>
            )}
            
            {/* Mock Radar Animation (only when not loading map) */}
            {!location && (
              <>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-yellow-500/20 rounded-full animate-ping opacity-20" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-yellow-500/40 rounded-full animate-pulse" />
              </>
            )}
          </div>
        </div>

        {/* Real-time Telemetry */}
        <div className="space-y-6">
          <div className="bg-[#151619] rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-emerald-500" />
                <span className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-widest">Network Telemetry</span>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[7px] font-mono text-emerald-400 uppercase">Live Sync</span>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span className="text-white/30">Network Load</span>
                  <span className="text-emerald-400">OPTIMAL</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[34%]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="block text-[8px] text-white/30 uppercase font-mono mb-1">Avg Power</span>
                  <span className="text-lg font-bold font-mono text-blue-400">150kW</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="block text-[8px] text-white/30 uppercase font-mono mb-1">Uptime</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">99.9%</span>
                </div>
              </div>

              <div className="p-4 bg-yellow-500/5 rounded-xl border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Battery size={14} className="text-yellow-500" />
                  <span className="text-[10px] font-bold text-yellow-500 uppercase font-mono">Smart Routing</span>
                </div>
                <p className="text-[10px] text-white/40 leading-relaxed font-mono">
                  AI is currently prioritizing <span className="text-white/80">VoltPoint Central</span> based on current state probabilities and your battery level (82%).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
