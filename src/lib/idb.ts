import type { AnalyzeRequest, ImagePromptSpec, RoomAnalysis, StyleFilters, StylePreset } from "@/lib/types";

export const MAX_STORED_IMAGES = 30;

export type StudioMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type StudioResult = {
  id: string;
  url: string;
  seed: number;
  spec: ImagePromptSpec;
  createdAt: string;
};

export type StudioSession = {
  id: string;
  createdAt: string;
  thumbnail: string | null;
  analysis: RoomAnalysis | null;
  messages: StudioMessage[];
  results: StudioResult[];
  imageBase64?: string;
  mimeType?: AnalyzeRequest["mimeType"];
  dimensions: { length: string; width: string; height: string };
  styleQuery: string;
  /** Derived from `styleFilters`; kept so the API contract stays single-preset friendly. */
  stylePreset?: StylePreset;
  styleFilters: StyleFilters;
};

const DB_NAME = "room-creator";
const DB_VERSION = 1;
const STORE = "sessions";
const ACTIVE_KEY = "room-creator:active-session";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB недоступен"));
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Ошибка IndexedDB"));
  });
}

export function createSession(): StudioSession {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    thumbnail: null,
    analysis: null,
    messages: [],
    results: [],
    dimensions: { length: "", width: "", height: "" },
    styleQuery: "",
    styleFilters: {},
  };
}

/** Sessions stored before multi-select only had `stylePreset`. */
function migrateSession(session: StudioSession): StudioSession {
  if (session.styleFilters) return session;
  return {
    ...session,
    styleFilters: session.stylePreset ? { [session.stylePreset]: "include" } : {},
  };
}

export function capResults(results: StudioResult[]): StudioResult[] {
  if (results.length <= MAX_STORED_IMAGES) return results;
  return results.slice(results.length - MAX_STORED_IMAGES);
}

export async function saveSession(session: StudioSession): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await idbRequest(tx.objectStore(STORE).put({ ...session, results: capResults(session.results) }));
    localStorage.setItem(ACTIVE_KEY, session.id);
  } finally {
    db.close();
  }
}

export async function loadSession(id: string): Promise<StudioSession | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const value = await idbRequest<StudioSession | undefined>(tx.objectStore(STORE).get(id));
    return value ? migrateSession(value) : null;
  } finally {
    db.close();
  }
}

export async function clearAllSessions(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await idbRequest(tx.objectStore(STORE).clear());
    localStorage.removeItem(ACTIVE_KEY);
  } finally {
    db.close();
  }
}

export async function loadActiveSession(): Promise<StudioSession | null> {
  if (typeof indexedDB === "undefined") return null;
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (activeId) {
    const existing = await loadSession(activeId);
    if (existing) return existing;
  }

  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const all = await idbRequest<StudioSession[]>(tx.objectStore(STORE).getAll());
    const sorted = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted[0] ? migrateSession(sorted[0]) : null;
  } finally {
    db.close();
  }
}
