
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GridAlert } from '../types';

interface AlertContextType {
  alerts: GridAlert[];
  addAlert: (alert: Omit<GridAlert, 'id' | 'timestamp' | 'status'>) => void;
  acknowledgeAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  deleteAlert: (id: string) => void;
  clearAll: () => void;
  isLive: boolean;
  setIsLive: (isLive: boolean) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

const INITIAL_ALERTS: GridAlert[] = [
  {
    id: `initial-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    type: 'Critical',
    source: 'Grid Transformer T-42',
    message: 'Thermal overload detected. Automatic cooling system failure.',
    value: '105°C',
    status: 'Active'
  },
  {
    id: `initial-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    type: 'Warning',
    source: 'EV Cluster A-1',
    message: 'Unexpected surge in charging demand. Voltage drop imminent.',
    value: '215V',
    status: 'Active'
  }
];

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<GridAlert[]>(INITIAL_ALERTS);
  const [isLive, setIsLive] = useState(true);

  const addAlert = useCallback((newAlertData: Omit<GridAlert, 'id' | 'timestamp' | 'status'>) => {
    const newAlert: GridAlert = {
      ...newAlertData,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      status: 'Active'
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 50));
  }, []);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, status: 'Acknowledged' } : alert
    ));
  }, []);

  const resolveAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, status: 'Resolved' } : alert
    ));
  }, []);

  const deleteAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
  }, []);

  // Simulated Real-time Alert Generation
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      if (Math.random() > 0.9) {
        const types: GridAlert['type'][] = ['Critical', 'Warning', 'Info', 'Success'];
        const type = types[Math.floor(Math.random() * types.length)];
        const sources = ['Substation 7', 'Wind Farm Alpha', 'Battery Array B', 'Main Controller', 'EV Hub Central'];
        const source = sources[Math.floor(Math.random() * sources.length)];
        
        addAlert({
          type,
          source,
          message: `Automated ${type.toLowerCase()} event detected at ${source}. System protocols initiated.`,
          value: type === 'Critical' ? `${(Math.random() * 50 + 100).toFixed(1)}%` : undefined
        });
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isLive, addAlert]);

  const value = React.useMemo(() => ({
    alerts, 
    addAlert, 
    acknowledgeAlert, 
    resolveAlert, 
    deleteAlert, 
    clearAll,
    isLive,
    setIsLive
  }), [alerts, addAlert, acknowledgeAlert, resolveAlert, deleteAlert, clearAll, isLive]);

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
}
