// ─────────────────────────────────────────────────────────────────────────────
// playerProfile.js — Identité du JOUEUR et paquet de statistiques pour le ladder.
//
// A ne pas confondre avec trainers.js, qui decrit les dresseurs ENNEMIS
// (archetypes et generation de leurs equipes). Ici il s'agit du profil du
// joueur : identifiant local, nom de dresseur affiche, donnees de classement.
//
// L'identifiant local est un UUID genere une seule fois et conserve dans la
// meta. Il ne sert qu'a relier les envois d'un meme joueur : le nom de dresseur
// est purement affiche, donc modifiable sans creer de doublon dans le ladder.
// ─────────────────────────────────────────────────────────────────────────────

import { SaveManager } from '../SaveManager.js';

export const TRAINER_NAME_MAX = 16;

function _uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = Math.random() * 16 | 0;
    return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Identifiant local, cree au premier appel puis stable.
export function getTrainerId() {
  const meta = SaveManager.loadMeta() ?? {};
  if (meta.trainerId) return meta.trainerId;
  const id = _uuid();
  SaveManager.saveMeta({ ...meta, trainerId: id });
  return id;
}

export function getTrainerName() {
  return SaveManager.loadMeta()?.trainerName ?? null;
}

// Nettoie le nom : espaces normalises, longueur bornee, caracteres de controle
// retires. Renvoie null si le resultat est vide.
export function sanitizeTrainerName(raw) {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TRAINER_NAME_MAX);
  return s.length ? s : null;
}

export function setTrainerName(raw) {
  const name = sanitizeTrainerName(raw);
  if (!name) return null;
  const meta = SaveManager.loadMeta() ?? {};
  SaveManager.saveMeta({ ...meta, trainerName: name, trainerNamePrompted: true });
  return name;
}

// Marque l'appel comme vu, meme si le joueur a passe la saisie : on ne le
// relance pas a chaque lancement.
export function markNamePrompted() {
  const meta = SaveManager.loadMeta() ?? {};
  SaveManager.saveMeta({ ...meta, trainerNamePrompted: true });
}

// Le joueur a-t-il deja une progression ? Sert a distinguer un nouveau joueur
// d'un joueur existant au moment de l'appel unique.
export function hasProgress(meta = null) {
  const m = meta ?? SaveManager.loadMeta() ?? {};
  return (m.totalRuns ?? 0) > 0
      || (m.badgesEarned?.length ?? 0) > 0
      || (m.caughtPokemon?.length ?? 0) > 0;
}

export function shouldPromptName(meta = null) {
  const m = meta ?? SaveManager.loadMeta() ?? {};
  return !m.trainerName && !m.trainerNamePrompted;
}

// ── Paquet envoye au ladder ─────────────────────────────────────────────────
// Une ligne par joueur (upsert sur trainer_id) : le classement se fait ensuite
// par simple tri de colonne, un onglet par metrique.
export function buildLadderPayload() {
  const meta  = SaveManager.loadMeta() ?? {};
  const stats = SaveManager.getRunStats(meta);
  const wins  = stats.totalWins ?? 0;
  const total = wins + (stats.totalLosses ?? 0);
  const inRange = (list, a, b) => (list ?? []).filter(id => id >= a && id <= b).length;

  return {
    trainer_id:    getTrainerId(),
    trainer_name:  meta.trainerName ?? 'Dresseur',
    updated_at:    new Date().toISOString(),

    leagues_beaten:  stats.leaguesBeaten ?? 0,
    badges:          stats.badges ?? 0,
    total_wins:      wins,
    total_losses:    stats.totalLosses ?? 0,
    win_rate:        total > 0 ? Math.round(wins / total * 100) : 0,
    pokemon_caught:  stats.pokemonCaptured ?? 0,
    max_level_count: SaveManager.countMaxLevelPokemon?.(meta) ?? 0,
    achievements:    Object.keys(meta.achievements ?? {}).length,
    playtime_ms:     stats.playtimeMs ?? 0,

    total_runs:      meta.totalRuns ?? 0,
    completed_runs:  meta.completedRuns ?? 0,
    best_map:        meta.bestMap ?? 0,
    dex_seen:        (meta.seenPokemon ?? []).length,
    dex_caught:      (meta.caughtPokemon ?? []).length,
    dex_seen_gen1:   inRange(meta.seenPokemon, 1, 151),
    dex_seen_gen2:   inRange(meta.seenPokemon, 152, 251),
    dex_seen_gen3:   inRange(meta.seenPokemon, 252, 386),
  };
}