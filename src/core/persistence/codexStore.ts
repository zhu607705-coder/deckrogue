export type CodexCategory = 'relics' | 'potions' | 'cards' | 'enemies' | 'elites' | 'events';

export interface CodexUnlockRecord {
  firstSeenAt: number;
  lastSeenAt: number;
  seenCount: number;
}

export interface CodexSyncMeta {
  exportedAt?: number;
  importedAt?: number;
  sourceDevice?: string;
}

export interface CodexProfile {
  version: number;
  unlocked: Record<CodexCategory, Record<string, CodexUnlockRecord>>;
  favorites: string[];
  updatedAt: number;
  sync: CodexSyncMeta;
}

const CODEX_PROFILE_KEY = 'deckrogue_codex_profile_v1';
const CODEX_UPDATED_EVENT = 'deckrogue:codex-updated';
const CODEX_VERSION = 1;

const CODEX_CATEGORIES: CodexCategory[] = ['relics', 'potions', 'cards', 'enemies', 'elites', 'events'];

function now(): number {
  return Date.now();
}

function createUnlockMap(): Record<CodexCategory, Record<string, CodexUnlockRecord>> {
  return {
    relics: {},
    potions: {},
    cards: {},
    enemies: {},
    elites: {},
    events: {}
  };
}

export function createDefaultCodexProfile(): CodexProfile {
  return {
    version: CODEX_VERSION,
    unlocked: createUnlockMap(),
    favorites: [],
    updatedAt: now(),
    sync: {}
  };
}

function safeRecord(raw: any): CodexUnlockRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const firstSeenAt = Math.max(0, Math.floor(Number(raw.firstSeenAt || 0)));
  const lastSeenAt = Math.max(firstSeenAt, Math.floor(Number(raw.lastSeenAt || firstSeenAt)));
  const seenCount = Math.max(1, Math.floor(Number(raw.seenCount || 1)));
  return { firstSeenAt, lastSeenAt, seenCount };
}

function normalizeProfile(raw: any): CodexProfile {
  const base = createDefaultCodexProfile();
  const unlocked = createUnlockMap();
  for (const category of CODEX_CATEGORIES) {
    const source = raw?.unlocked?.[category];
    if (!source || typeof source !== 'object') continue;
    for (const [id, rec] of Object.entries(source)) {
      if (typeof id !== 'string' || !id) continue;
      const parsed = safeRecord(rec);
      if (parsed) unlocked[category][id] = parsed;
    }
  }

  const favorites = Array.isArray(raw?.favorites)
    ? (Array.from(new Set((raw.favorites as any[]).filter((x: any) => typeof x === 'string' && x.includes(':')))) as string[])
    : base.favorites;

  return {
    version: CODEX_VERSION,
    unlocked,
    favorites,
    updatedAt: Math.max(0, Math.floor(Number(raw?.updatedAt || base.updatedAt))),
    sync: {
      exportedAt: raw?.sync?.exportedAt ? Math.max(0, Math.floor(Number(raw.sync.exportedAt))) : undefined,
      importedAt: raw?.sync?.importedAt ? Math.max(0, Math.floor(Number(raw.sync.importedAt))) : undefined,
      sourceDevice: typeof raw?.sync?.sourceDevice === 'string' ? raw.sync.sourceDevice : undefined
    }
  };
}

function emitCodexUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CODEX_UPDATED_EVENT));
}

function getStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof localStorage === 'undefined' || !localStorage) return null;
  if (typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') return null;
  return localStorage;
}

export function getCodexUpdateEventName(): string {
  return CODEX_UPDATED_EVENT;
}

export function getCodexProfileStorageKey(): string {
  return CODEX_PROFILE_KEY;
}

export function loadCodexProfile(): CodexProfile {
  const storage = getStorage();
  if (!storage) return createDefaultCodexProfile();
  try {
    const raw = storage.getItem(CODEX_PROFILE_KEY);
    if (!raw) return createDefaultCodexProfile();
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return createDefaultCodexProfile();
  }
}

export function saveCodexProfile(profile: CodexProfile, { silent = false }: { silent?: boolean } = {}): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(CODEX_PROFILE_KEY, JSON.stringify(profile));
    if (!silent) emitCodexUpdated();
    return true;
  } catch (error) {
    console.error('[Codex] Failed to save profile:', error);
    return false;
  }
}

export function getCodexEntryKey(category: CodexCategory, id: string): string {
  return `${category}:${id}`;
}

export function isCodexEntryUnlocked(profile: CodexProfile, category: CodexCategory, id: string): boolean {
  return !!profile.unlocked?.[category]?.[id];
}

export function unlockCodexEntry(category: CodexCategory, id: string): boolean {
  if (!id) return false;
  const profile = loadCodexProfile();
  const existing = profile.unlocked[category][id];
  const t = now();
  if (existing) {
    profile.unlocked[category][id] = {
      ...existing,
      lastSeenAt: t,
      seenCount: Math.max(1, existing.seenCount || 1) + 1
    };
    profile.updatedAt = t;
    saveCodexProfile(profile);
    return false;
  }
  profile.unlocked[category][id] = { firstSeenAt: t, lastSeenAt: t, seenCount: 1 };
  profile.updatedAt = t;
  saveCodexProfile(profile);
  return true;
}

export function unlockManyCodexEntries(category: CodexCategory, ids: Array<string | null | undefined>): number {
  const filtered = Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && !!id)));
  if (filtered.length === 0) return 0;
  const profile = loadCodexProfile();
  const t = now();
  let unlockedCount = 0;
  for (const id of filtered) {
    const existing = profile.unlocked[category][id];
    if (existing) {
      profile.unlocked[category][id] = {
        ...existing,
        lastSeenAt: t,
        seenCount: Math.max(1, existing.seenCount || 1) + 1
      };
      continue;
    }
    profile.unlocked[category][id] = { firstSeenAt: t, lastSeenAt: t, seenCount: 1 };
    unlockedCount += 1;
  }
  profile.updatedAt = t;
  saveCodexProfile(profile);
  return unlockedCount;
}

export function toggleCodexFavorite(category: CodexCategory, id: string): boolean {
  const key = getCodexEntryKey(category, id);
  const profile = loadCodexProfile();
  const set = new Set(profile.favorites);
  let active: boolean;
  if (set.has(key)) {
    set.delete(key);
    active = false;
  } else {
    set.add(key);
    active = true;
  }
  profile.favorites = [...set];
  profile.updatedAt = now();
  saveCodexProfile(profile);
  return active;
}

export function exportCodexProfileJson(): string {
  const profile = loadCodexProfile();
  profile.sync = {
    ...profile.sync,
    exportedAt: now(),
    sourceDevice: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.slice(0, 80) : 'unknown'
  };
  profile.updatedAt = now();
  saveCodexProfile(profile, { silent: true });
  return JSON.stringify(profile, null, 2);
}

export function importCodexProfileJson(json: string): { ok: boolean; message: string } {
  try {
    const parsed = JSON.parse(json);
    const incoming = normalizeProfile(parsed);
    const current = loadCodexProfile();
    const merged = createDefaultCodexProfile();
    merged.favorites = Array.from(new Set([...(current.favorites || []), ...(incoming.favorites || [])]));
    merged.updatedAt = Math.max(current.updatedAt || 0, incoming.updatedAt || 0, now());
    merged.sync = {
      ...current.sync,
      ...incoming.sync,
      importedAt: now()
    };

    for (const category of CODEX_CATEGORIES) {
      const combined = { ...(current.unlocked?.[category] || {}) };
      for (const [id, rec] of Object.entries(incoming.unlocked?.[category] || {})) {
        const currentRec = combined[id];
        if (!currentRec) {
          combined[id] = rec as CodexUnlockRecord;
          continue;
        }
        combined[id] = {
          firstSeenAt: Math.min(currentRec.firstSeenAt, (rec as CodexUnlockRecord).firstSeenAt),
          lastSeenAt: Math.max(currentRec.lastSeenAt, (rec as CodexUnlockRecord).lastSeenAt),
          seenCount: Math.max(1, currentRec.seenCount) + Math.max(1, (rec as CodexUnlockRecord).seenCount)
        };
      }
      merged.unlocked[category] = combined;
    }

    saveCodexProfile(merged);
    return { ok: true, message: '图鉴数据已导入并合并。' };
  } catch (error) {
    return { ok: false, message: `导入失败：${error instanceof Error ? error.message : 'Invalid JSON'}` };
  }
}

export function getCodexUnlockedCount(profile: CodexProfile, category?: CodexCategory): number {
  if (category) return Object.keys(profile.unlocked?.[category] || {}).length;
  return CODEX_CATEGORIES.reduce((sum, cat) => sum + Object.keys(profile.unlocked?.[cat] || {}).length, 0);
}
