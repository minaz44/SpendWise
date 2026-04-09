// frontend/src/services/syncService.js

import transactionAPI from '../api/transaction.api';
import {
  getPendingTransactions,
  markAsSynced,
  deletePendingTransaction,
  cacheTransactions,
  clearCachedTransactions,
  getSyncQueue,
  clearSyncQueue,
} from './offlineStorage';

//─────────────────────────────────────
// CONFLICT RESOLUTION
//─────────────────────────────────────

/**
 * Resolve conflict between local and server transaction
 * Strategy: Server wins for updates, local wins for new creates
 */
const resolveConflict = (local, server) => {
  // If server version is newer → server wins
  if (server && new Date(server.updatedAt) > new Date(local.createdAt)) {
    return { winner: 'server', data: server };
  }
  // Local is newer → local wins
  return { winner: 'local', data: local };
};

//─────────────────────────────────────
// SYNC PENDING TRANSACTIONS
//─────────────────────────────────────

export const syncPendingTransactions = async () => {
  const pending = await getPendingTransactions();

  if (pending.length === 0) return { synced: 0, failed: 0, conflicts: 0 };

  let synced    = 0;
  let failed    = 0;
  let conflicts = 0;

  for (const txn of pending) {
    try {
      const { localId, synced: isSynced, syncError, ...data } = txn;

      // Try to create on server
      const response = await transactionAPI.create(data);

      if (response.success) {
        await markAsSynced(localId);
        await deletePendingTransaction(localId);
        synced++;
      }
    } catch (error) {
      // Conflict — transaction might already exist
      if (error.status === 409) {
        conflicts++;
        await deletePendingTransaction(txn.localId);
      } else {
        failed++;
      }
    }
  }

  return { synced, failed, conflicts };
};

//─────────────────────────────────────
// SYNC QUEUE (replay operations)
//─────────────────────────────────────

export const processSyncQueue = async () => {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { processed: 0 };

  let processed = 0;

  for (const op of queue) {
    try {
      if (op.type === 'CREATE') {
        await transactionAPI.create(op.data);
      } else if (op.type === 'UPDATE') {
        await transactionAPI.update(op.id, op.data);
      } else if (op.type === 'DELETE') {
        await transactionAPI.remove(op.id);
      }
      processed++;
    } catch (_) {}
  }

  await clearSyncQueue();
  return { processed };
};

//─────────────────────────────────────
// FULL SYNC
//─────────────────────────────────────

export const performFullSync = async () => {
  if (!navigator.onLine) {
    return { success: false, message: 'No internet connection.' };
  }

  try {
    // 1. Sync pending transactions
    const pendingResult = await syncPendingTransactions();

    // 2. Process sync queue
    const queueResult = await processSyncQueue();

    // 3. Refresh cache from server
    const response = await transactionAPI.getAll({ limit: 100 });
    if (response?.data?.transactions) {
      await clearCachedTransactions();
      await cacheTransactions(response.data.transactions);
    }

    return {
      success:   true,
      synced:    pendingResult.synced,
      failed:    pendingResult.failed,
      conflicts: pendingResult.conflicts,
      processed: queueResult.processed,
      message:   `Sync complete. ${pendingResult.synced} transactions uploaded.`,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

//─────────────────────────────────────
// AUTO SYNC on reconnect
//─────────────────────────────────────

let syncInProgress = false;

export const setupAutoSync = (onSyncComplete) => {
  const handleOnline = async () => {
    if (syncInProgress) return;
    syncInProgress = true;

    try {
      const result = await performFullSync();
      if (onSyncComplete) onSyncComplete(result);
    } finally {
      syncInProgress = false;
    }
  };

  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => window.removeEventListener('online', handleOnline);
};