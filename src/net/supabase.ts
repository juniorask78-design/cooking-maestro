/**
 * COMPTES & CLOUD (Supabase) — optionnel, chargé uniquement si les variables d'environnement existent.
 * Schéma SQL : supabase/schema.sql.  Plan détaillé : docs/ARCHITECTURE.md.
 */
import type { SaveData } from '../core/progress';

export interface CloudBackend {
  userId(): Promise<string | null>;
  signInWithEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
  loadSave(): Promise<SaveData | null>;
  storeSave(data: SaveData): Promise<void>;
}

export const cloudEnabled = () => !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function createCloudBackend(): Promise<CloudBackend | null> {
  if (!cloudEnabled()) return null;
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  const userId = async () => (await sb.auth.getUser()).data.user?.id ?? null;
  return {
    userId,
    async signInWithEmail(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
      if (error) throw error;
    },
    async signOut() { await sb.auth.signOut(); },
    async loadSave() {
      const uid = await userId();
      if (!uid) return null;
      const { data, error } = await sb.from('saves').select('data').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      return (data?.data as SaveData) ?? null;
    },
    async storeSave(save) {
      const uid = await userId();
      if (!uid) return;
      const { error } = await sb.from('saves').upsert({ user_id: uid, data: save, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
  };
}
