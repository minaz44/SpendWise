// frontend/src/services/offlineStorage.js
const DB_NAME = 'spendwise_offline';
const DB_VERSION = 1;

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onerror = () => reject(req.error);
  req.onsuccess = () => resolve(req.result);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('pendingTransactions'))
      db.createObjectStore('pendingTransactions', { keyPath: 'localId' });
    if (!db.objectStoreNames.contains('cachedTransactions'))
      db.createObjectStore('cachedTransactions', { keyPath: '_id' });
    if (!db.objectStoreNames.contains('syncQueue'))
      db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
  };
});

export const savePendingTransaction = async (transaction) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pendingTransactions', 'readwrite');
      const entry = { ...transaction, localId: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString(), synced: false };
      const r = tx.objectStore('pendingTransactions').add(entry);
      r.onsuccess = () => resolve(entry);
      r.onerror = () => reject(r.error);
    });
  } catch { return null; }
};

export const getPendingTransactions = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const r = db.transaction('pendingTransactions', 'readonly').objectStore('pendingTransactions').getAll();
      r.onsuccess = () => resolve((r.result || []).filter(x => !x.synced));
      r.onerror = () => resolve([]);
    });
  } catch { return []; }
};

export const markAsSynced = async (localId) => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('pendingTransactions', 'readwrite');
      const store = tx.objectStore('pendingTransactions');
      const get = store.get(localId);
      get.onsuccess = () => { if (get.result) { get.result.synced = true; store.put(get.result); } resolve(); };
      get.onerror = () => resolve();
    });
  } catch { return; }
};

export const deletePendingTransaction = async (localId) => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('pendingTransactions', 'readwrite');
      tx.objectStore('pendingTransactions').delete(localId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { return; }
};

export const cacheTransactions = async (transactions) => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('cachedTransactions', 'readwrite');
      const store = tx.objectStore('cachedTransactions');
      transactions.forEach(t => { if (t._id) store.put(t); });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { return; }
};

export const getCachedTransactions = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const r = db.transaction('cachedTransactions', 'readonly').objectStore('cachedTransactions').getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => resolve([]);
    });
  } catch { return []; }
};

export const clearCachedTransactions = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('cachedTransactions', 'readwrite');
      tx.objectStore('cachedTransactions').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { return; }
};

export const addToSyncQueue = async (op) => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      tx.objectStore('syncQueue').add({ ...op, queuedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { return; }
};

export const getSyncQueue = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const r = db.transaction('syncQueue', 'readonly').objectStore('syncQueue').getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => resolve([]);
    });
  } catch { return []; }
};

export const clearSyncQueue = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      tx.objectStore('syncQueue').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { return; }
};

export const getPendingCount = async () => {
  try { return (await getPendingTransactions()).length; } catch { return 0; }
};