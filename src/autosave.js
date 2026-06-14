const DATABASE_NAME = "vt-spotmakehelper";
const DATABASE_VERSION = 1;
const STORE_NAME = "autosave";
const RECORD_KEY = "current";

export async function loadAutosave() {
  return withStore("readonly", store => requestResult(store.get(RECORD_KEY)));
}

export async function saveAutosave(state) {
  const record = {
    id: RECORD_KEY,
    version: 1,
    savedAt: new Date().toISOString(),
    state,
  };
  await withStore("readwrite", store => requestResult(store.put(record)));
  return record;
}

export async function deleteAutosave() {
  await withStore("readwrite", store => requestResult(store.delete(RECORD_KEY)));
}

export function supportsAutosave() {
  return typeof indexedDB !== "undefined";
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!supportsAutosave()) {
      reject(new Error("このブラウザはIndexedDBに対応していません"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("自動保存データベースを開けませんでした"));
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const done = transactionDone(transaction);
    const [result] = await Promise.all([
      operation(transaction.objectStore(STORE_NAME)),
      done,
    ]);
    return result;
  } finally {
    database.close();
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
