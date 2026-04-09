// frontend/src/context/SyncContext.jsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { performFullSync, setupAutoSync } from '../services/syncService';
import { getPendingCount } from '../services/offlineStorage';
import toast from 'react-hot-toast';

const SyncContext = createContext();

export const SyncProvider = ({ children }) => {
  const [isOnline, setIsOnline]         = useState(navigator.onLine);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSynced, setLastSynced]     = useState(null);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // Manual sync
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);

    try {
      const result = await performFullSync();
      if (result.success) {
        setLastSynced(new Date());
        await refreshPendingCount();
        if (result.synced > 0) {
          toast.success(`✅ Synced ${result.synced} transaction(s)`);
        }
      } else {
        toast.error(`Sync failed: ${result.message}`);
      }
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, refreshPendingCount]);

  useEffect(() => {
    // Online/offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🌐 Back online — syncing...', { duration: 2000 });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast('📴 You are offline. Changes will sync when reconnected.', {
        icon: '📴',
        duration: 3000,
      });
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto sync setup
    const cleanup = setupAutoSync(async (result) => {
      setLastSynced(new Date());
      await refreshPendingCount();
      if (result.synced > 0) {
        toast.success(`✅ Auto-synced ${result.synced} transaction(s)`);
      }
    });

    // Initial pending count
    refreshPendingCount();

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanup();
    };
  }, [refreshPendingCount]);

  return (
    <SyncContext.Provider value={{
      isOnline,
      isSyncing,
      pendingCount,
      lastSynced,
      syncNow,
      refreshPendingCount,
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within SyncProvider');
  return context;
};