/**
 * SAUVEGARDE — interface commune à la sauvegarde locale et à la sauvegarde cloud.
 * Le prototype utilise la sauvegarde locale. Si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
 * sont définies, la sauvegarde cloud (Supabase) devient disponible pour les joueurs connectés.
 */
import { newSave, type SaveData } from './progress';

export interface SaveService {
  load(): Promise<SaveData>;
  save(data: SaveData): Promise<void>;
  reset(): Promise<SaveData>;
}

const KEY = 'cooking-maestro/save/v1';

function migrate(raw: unknown): SaveData {
  const base = newSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return { ...base, ...r, look: { ...base.look, ...(r.look ?? {}) }, upgrades: { ...(r.upgrades ?? {}) }, bestStars: { ...(r.bestStars ?? {}) }, version: 1 };
}

export class LocalSaveService implements SaveService {
  async load(): Promise<SaveData> {
    try {
      const txt = localStorage.getItem(KEY);
      return migrate(txt ? JSON.parse(txt) : null);
    } catch {
      return newSave();
    }
  }
  async save(data: SaveData): Promise<void> {
    try { localStorage.setItem(KEY, JSON.stringify({ ...data, updatedAt: Date.now() })); } catch { /* navigation privée */ }
  }
  async reset(): Promise<SaveData> {
    const fresh = newSave();
    await this.save(fresh);
    return fresh;
  }
}

/**
 * Sauvegarde cloud : garde toujours une copie locale, et synchronise avec Supabase
 * quand un joueur est connecté. La version la plus récente (updatedAt) gagne.
 */
export class CloudSaveService implements SaveService {
  private local = new LocalSaveService();
  constructor(private cloud: import('../net/supabase').CloudBackend) {}

  async load(): Promise<SaveData> {
    const local = await this.local.load();
    const remote = await this.cloud.loadSave().catch(() => null);
    if (remote && remote.updatedAt > local.updatedAt) { const m = migrate(remote); await this.local.save(m); return m; }
    return local;
  }
  async save(data: SaveData): Promise<void> {
    await this.local.save(data);
    await this.cloud.storeSave(data).catch(() => undefined);
  }
  async reset(): Promise<SaveData> {
    const fresh = await this.local.reset();
    await this.cloud.storeSave(fresh).catch(() => undefined);
    return fresh;
  }
}
