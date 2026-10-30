/* global Cypress, cy */

const DB_NAME = 'AuraTrackDB';
const DB_VERSION = 130; // Dexie version 13 × 10

const STORE_DEFINITIONS = {
  events: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: ['uuid', 'startTime'],
  },
  settings: {
    options: { keyPath: 'key' },
    indexes: [],
  },
  medications: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: ['uuid'],
  },
  medicationLogs: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: ['uuid', 'medicationId', 'medicationUuid', 'takenAt'],
  },
  medicationChanges: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: ['uuid', 'medicationId', 'medicationUuid', 'effectiveAt'],
  },
  eegSessions: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: ['uuid', 'startTime', 'status'],
  },
  eegActivities: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: ['uuid', 'sessionId', 'startTime', 'linkedEventId'],
  },
  wellbeingEntries: {
    options: { keyPath: 'id', autoIncrement: true },
    indexes: ['uuid', 'recordedAt'],
  },
  tombstones: {
    options: { keyPath: 'uuid' },
    indexes: ['table', 'deletedAt'],
  },
};

function ensureDatabase(indexedDB) {
  return new Cypress.Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      Object.entries(STORE_DEFINITIONS).forEach(([storeName, definition]) => {
        const store = db.objectStoreNames.contains(storeName)
          ? request.transaction.objectStore(storeName)
          : db.createObjectStore(storeName, definition.options);
        definition.indexes.forEach((indexName) => {
          if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, indexName, { unique: false });
          }
        });
      });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export function clearAndSeedDatabase(win, seed) {
  return ensureDatabase(win.indexedDB).then((db) => {
    const payload = {
      events: seed.events ?? [],
      settings: seed.settings ?? [],
      medications: seed.medications ?? [],
      medicationLogs: seed.medicationLogs ?? [],
      medicationChanges: seed.medicationChanges ?? [],
      eegSessions: seed.eegSessions ?? [],
      eegActivities: seed.eegActivities ?? [],
      wellbeingEntries: seed.wellbeingEntries ?? [],
      tombstones: seed.tombstones ?? [],
    };

    return new Cypress.Promise((resolve, reject) => {
      const storeNames = Object.keys(STORE_DEFINITIONS);
      const tx = db.transaction(storeNames, 'readwrite');
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      win.localStorage.clear();
      win.sessionStorage.clear();

      storeNames.forEach((storeName) => {
        const store = tx.objectStore(storeName);
        store.clear();
        payload[storeName].forEach((row) => store.add(row));
      });
    });
  });
}

export function launchAuraTrackWithState(seed = {}) {
  return cy.visit('/', {
    onBeforeLoad(win) {
      return clearAndSeedDatabase(win, seed);
    },
  });
}

export function countRowsInStore(win, storeName) {
  return ensureDatabase(win.indexedDB).then((db) => new Cypress.Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).count();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
  }));
}
