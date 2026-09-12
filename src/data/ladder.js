// ─────────────────────────────────────────────────────────────────────────────
// ladder.js — Classement en ligne (Supabase).
//
// Identite : session ANONYME Supabase, creee automatiquement au premier envoi.
// Le joueur n'a rien a faire, et la regle RLS garantit qu'il ne peut ecrire que
// sa propre ligne. La cle publishable est publique par conception : ce sont les
// politiques RLS qui protegent la table, pas le secret de la cle.
//
// Envoi : UPSERT sur user_id, donc une seule ligne par joueur, mise a jour.
// Jamais d'insertion multiple, la table ne gonfle pas.
// ─────────────────────────────────────────────────────────────────────────────

import { buildLadderPayload, getTrainerName } from './playerProfile.js';

const SUPABASE_URL  = 'https://hhjbrijmspaujanzrfns.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_zosRlEGiz13F1HtvYS1NPA_9W8efm6R';
const SDK_URL       = 'https://esm.sh/@supabase/supabase-js@2';
const TABLE         = 'ladder';

// Intervalle mini entre deux envois (evite une requete a chaque changement).
const MIN_PUBLISH_INTERVAL_MS = 120000;   // 2 minutes

// Metriques proposees en onglets. `key` = colonne SQL, `fmt` = affichage.
export const LADDER_METRICS = [
  { key: 'leagues_beaten',  label: 'Ligues',      emoji: '🏆' },
  { key: 'badges',          label: 'Badges',      emoji: '🏅' },
  { key: 'total_wins',      label: 'Victoires',   emoji: '✅' },
  { key: 'win_rate',        label: 'Taux',        emoji: '📈', fmt: v => `${v}%` },
  { key: 'pokemon_caught',  label: 'Captures',    emoji: '🎒' },
  { key: 'max_level_count', label: 'Niveau 100',  emoji: '⭐' },
  { key: 'achievements',    label: 'Succès',      emoji: '🎖' },
  { key: 'dex_caught',      label: 'Pokédex',     emoji: '📖' },
  { key: 'dex_caught_gen1', label: 'Dex Kanto',   emoji: '🌸' },
  { key: 'dex_caught_gen2', label: 'Dex Johto',   emoji: '🌊' },
  { key: 'dex_caught_gen3', label: 'Dex Hoenn',   emoji: '🌋' },
  { key: 'leagues_kanto',   label: 'Ligues Kanto', emoji: '🌸' },
  { key: 'leagues_johto',   label: 'Ligues Johto', emoji: '🌊' },
  { key: 'leagues_hoenn',   label: 'Ligues Hoenn', emoji: '🌋' },
  { key: 'leagues_expert',  label: 'Ligues Expert', emoji: '💀' },
  { key: 'leagues_hard',    label: 'Ligues Difficile', emoji: '🔥' },
  { key: 'playtime_ms',     label: 'Temps de jeu', emoji: '⏱',
    fmt: v => {
      const min = Math.round((v ?? 0) / 60000);
      return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
    } },
];

let _client  = null;
let _lastPub = 0;
let _failed  = false;   // si l'init echoue, on ne reessaie pas en boucle

// Charge le SDK et ouvre une session anonyme. Renvoie null si indisponible
// (hors ligne, CDN bloque) : le jeu ne doit jamais casser pour un classement.
async function getClient() {
  if (_client) return _client;
  if (_failed)  return null;
  try {
    const { createClient } = await import(/* @vite-ignore */ SDK_URL);
    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    const { data } = await client.auth.getSession();
    if (!data?.session) {
      const { error } = await client.auth.signInAnonymously();
      if (error) throw error;
    }
    _client = client;
    return client;
  } catch (e) {
    console.warn('[ladder] indisponible :', e?.message ?? e);
    _failed = true;
    return null;
  }
}

// Envoie (ou met a jour) la ligne du joueur. `force` ignore l'intervalle mini.
export async function publishScore({ force = false } = {}) {
  if (!getTrainerName()) return false;    // pas de nom : pas de publication
  const now = Date.now();
  if (!force && now - _lastPub < MIN_PUBLISH_INTERVAL_MS) return false;

  const client = await getClient();
  if (!client) return false;
  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return false;
    const payload = buildLadderPayload();
    delete payload.trainer_id;             // la cle de ligne est l'id de session
    payload.user_id = user.id;
    const { error } = await client.from(TABLE).upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
    _lastPub = now;
    return true;
  } catch (e) {
    console.warn('[ladder] envoi echoue :', e?.message ?? e);
    return false;
  }
}

// Lit le classement pour une metrique donnee.
export async function fetchLadder(metricKey, limit = 50) {
  const client = await getClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from(TABLE)
      .select(`user_id, trainer_name, ${metricKey}`)
      .order(metricKey, { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('[ladder] lecture echouee :', e?.message ?? e);
    return null;
  }
}

// Identifiant de session, pour surligner la ligne du joueur dans le classement.
export async function getMyUserId() {
  const client = await getClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  return user?.id ?? null;
}
