// ─────────────────────────────────────────────────────────────────────────────
// regions.js — Régions jouables (Kanto, Johto, ...)
//
// Une région porte : ses 8 arènes, son maître de ligue, les difficultés
// autorisées, les générations de Pokémon disponibles et sa condition de
// déblocage. Ajouter une région future (Hoenn...) revient à ajouter une entrée.
//
// Les données d'arènes vivent dans arenaKanto.js / arenaJohto.js (fichiers de
// données purs, sans import), ce qui évite tout cycle de dépendances.
// ─────────────────────────────────────────────────────────────────────────────

import { ARENAS_KANTO, MASTER_KANTO } from './arenaKanto.js';
import { ARENAS_JOHTO, MASTER_JOHTO, RED_TEAM } from './arenaJohto.js';
import { ARENAS_HOENN, MASTER_HOENN, ELITES_HOENN,
         pickHoennMaster, buildHoennMaster } from './arenaHoenn.js';

// Ré-export pour que les consommateurs n'aient qu'un point d'entrée
export { ARENAS_KANTO, ARENAS_JOHTO, MASTER_KANTO, MASTER_JOHTO, RED_TEAM };
export { ARENAS_HOENN, MASTER_HOENN, ELITES_HOENN, pickHoennMaster, buildHoennMaster };


// ── Régions ──────────────────────────────────────────────────────────────────
export const REGIONS = {
  kanto: {
    id:            'kanto',
    name:          'Kanto',
    emoji:         '🌸',
    image:         'assets/regions/kanto.png',
    subtitle:      'La région d\'origine',
    arenas:        ARENAS_KANTO,
    difficulties:  ['easy', 'normal', 'hard', 'expert'],
    gens:          [1],                 // générations de base (voir getAllowedGens)
    signatureGen:  null,                // Kanto : aucun biais de génération
    // Starters proposés en début d'épopée (Bulbizarre, Salamèche, Carapuce,
    // plus les deux emblèmes de la région)
    starterIds:    [1, 4, 7, 25, 133],
    master:        MASTER_KANTO,
    unlockedBy:    null,                // toujours disponible
    unlockHint:    '',
  },
  johto: {
    id:            'johto',
    name:          'Johto',
    emoji:         '🌊',
    image:         'assets/regions/johto.png',
    subtitle:      'Nouveaux champions, nouveaux Pokémon',
    arenas:        ARENAS_JOHTO,
    difficulties:  ['normal', 'hard', 'expert'],   // pas de mode Facile
    gens:          [1, 2],
    signatureGen:  2,                   // 1er Pokémon de chaque champion garanti gen 2
    masterTeam:    RED_TEAM,            // équipe fixe du maître (pas de tirage)
    // Starters de Johto : Germignon, Héricendre, Kaiminus, plus Togepi
    // (l'œuf mystère, emblème de la région). Quatre choix au lieu de cinq.
    starterIds:    [152, 155, 158, 175],
    master:        MASTER_JOHTO,
    // Débloqué en terminant Kanto en Normal ou plus difficile
    unlockedBy:    { region: 'kanto', minDifficulty: 'normal' },
    unlockHint:    'Terminez la Ligue de Kanto en Normal ou plus',
  },
  hoenn: {
    id:            'hoenn',
    name:          'Hoenn',
    emoji:         '🌋',
    image:         'assets/regions/hoenn.png',
    subtitle:      'Terre, mer et ciel',
    arenas:        ARENAS_HOENN,
    difficulties:  ['normal', 'hard', 'expert'],   // pas de mode Facile
    gens:          [1, 2, 3],
    signatureGen:  3,                   // 1er Pokémon de chaque champion garanti gen 3
    // Starters de Hoenn : Arcko, Poussifeu, Gobou, plus Tarsal (emblème régional)
    starterIds:    [252, 255, 258, 280],
    master:        MASTER_HOENN,        // repli : le maître réel est tiré par pickHoennMaster()
    masterPool:    ELITES_HOENN,        // le maître est tiré au hasard parmi la Ligue
    randomMaster:  true,
    // Débloqué en terminant Johto en Normal ou plus difficile
    unlockedBy:    { region: 'johto', minDifficulty: 'normal' },
    unlockHint:    'Terminez la Ligue de Johto en Normal ou plus',
  },
};

export const DEFAULT_REGION = 'kanto';

// Ordre croissant de difficulté (sert aux comparaisons "Normal ou supérieur")
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'expert'];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getRegion(regionId) {
  return REGIONS[regionId] ?? REGIONS[DEFAULT_REGION];
}

export function getRegionArenas(regionId) {
  return getRegion(regionId).arenas;
}

// Starters proposés au début d'une épopée dans cette région
export function getRegionStarterIds(regionId) {
  return getRegion(regionId).starterIds ?? REGIONS[DEFAULT_REGION].starterIds;
}

// Une ligue terminée est enregistrée dans meta.runStats.leaguesByRegion[region][difficulty]
function leagueCount(meta, regionId, difficulty) {
  const byRegion = meta?.runStats?.leaguesByRegion ?? {};
  return byRegion?.[regionId]?.[difficulty] ?? 0;
}

// La région est-elle débloquée ? (Kanto toujours ; Johto après Kanto en Normal ou +)
export function isRegionUnlocked(regionId, meta) {
  if (meta?.devMode) return true;          // mode dev : tout est ouvert
  const region = getRegion(regionId);
  if (!region.unlockedBy) return true;
  const { region: reqRegion, minDifficulty } = region.unlockedBy;
  const minIdx = DIFFICULTY_ORDER.indexOf(minDifficulty);
  // "Normal ou supérieur" : on accepte toute difficulté de rang >= minDifficulty
  return DIFFICULTY_ORDER
    .slice(Math.max(0, minIdx))
    .some(d => leagueCount(meta, reqRegion, d) > 0);
}

// Difficultés proposées pour une région, avec leur état de déblocage.
// La chaîne interne reste identique à celle de Kanto : chaque difficulté se
// débloque en terminant la précédente DANS CETTE région.
export function getRegionDifficulties(regionId, meta) {
  const region = getRegion(regionId);
  const dev    = !!meta?.devMode;
  // Succès historiques de déblocage (antérieurs au système de régions) :
  // ils restent valables, notamment parce que le mode dev les octroie tous.
  const ach    = meta?.achievements ?? {};
  const ACH_FOR = { normal:'ligue_easy', hard:'ligue_normal', expert:'ligue_hard_relic' };
  return region.difficulties.map((id, i) => {
    if (dev) return { id, unlocked: true, requires: null };
    if (i === 0) return { id, unlocked: true, requires: null };
    if (ACH_FOR[id] && ach[ACH_FOR[id]]) return { id, unlocked: true, requires: null };
    const prev = region.difficulties[i - 1];
    // Cumulatif : terminer la difficulté précédente OU n'importe quelle
    // difficulté supérieure suffit (robuste si une sauvegarde est incomplète).
    const prevIdx = DIFFICULTY_ORDER.indexOf(prev);
    const unlocked = DIFFICULTY_ORDER
      .slice(Math.max(0, prevIdx))
      .some(d => leagueCount(meta, regionId, d) > 0);
    return { id, unlocked, requires: prev };
  });
}

// Générations utilisables. La gen 2 est une récompense GLOBALE : une fois la
// Ligue de Kanto terminée en Normal ou plus, elle est disponible dans toutes
// les régions, Kanto compris.
export function getAllowedGens(regionId, meta) {
  const base = new Set(getRegion(regionId).gens);
  if (isRegionUnlocked('johto', meta)) base.add(2);
  if (isRegionUnlocked('hoenn', meta)) base.add(3);
  return [...base].sort((a, b) => a - b);
}

// Bornes d'ID du Pokédex correspondant aux générations autorisées
export const GEN_RANGES = { 1: [1, 151], 2: [152, 251], 3: [252, 386] };

export function getAllowedPokemonIds(regionId, meta) {
  const gens = getAllowedGens(regionId, meta);
  const ids = [];
  gens.forEach(g => {
    const range = GEN_RANGES[g];
    if (!range) return;
    for (let i = range[0]; i <= range[1]; i++) ids.push(i);
  });
  return ids;
}

// Filtre pratique : un Pokémon est-il jouable dans ce contexte ?
export function isPokemonAllowed(pokemonId, regionId, meta) {
  const gens = getAllowedGens(regionId, meta);
  return gens.some(g => {
    const r = GEN_RANGES[g];
    return r && pokemonId >= r[0] && pokemonId <= r[1];
  });
}

// Liste ordonnée des régions avec leur état, pour l'affichage du sélecteur
export function getRegionList(meta) {
  return Object.values(REGIONS).map(r => ({
    id:         r.id,
    name:       r.name,
    emoji:      r.emoji,
    image:      r.image ?? null,
    subtitle:   r.subtitle,
    unlocked:   isRegionUnlocked(r.id, meta),
    unlockHint: r.unlockHint,
  }));
}