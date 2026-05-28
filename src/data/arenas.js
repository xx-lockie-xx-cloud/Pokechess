// ─────────────────────────────────────────────────────────────────────────────
// arenas.js — 8 arènes de Kanto avec équipes générées dynamiquement
// Les équipes sont créées selon la difficulté et la courbe de progression
// Le joueur ne connaît pas le type adverse avant le combat
// ─────────────────────────────────────────────────────────────────────────────

import { POKEMONS }    from './pokemons.js';
import { getBSTTier }  from './runState.js';

// ── Métadonnées des 8 arènes (sans équipes statiques) ────────────────────────
export const ARENAS = [
  { id: 1, city: 'Argenta',        champion: 'Pierre',   type: 'Roche',
    badgeName: 'Badge Pierre',    badgeEmoji: '🪨',
    badgeSprite: 'assets/badges/pierre_b.png',
    championSprite: 'assets/trainers/map/champions/pierre.png',
    championSpriteCombat: 'assets/trainers/combat/champions/pierre_c.png' },
  { id: 2, city: 'Azuria',         champion: 'Ondine',   type: 'Eau',
    badgeName: 'Badge Cascade',   badgeEmoji: '💧',
    badgeSprite: 'assets/badges/misty_b.png',
    championSprite: 'assets/trainers/map/champions/misty.png',
    championSpriteCombat: 'assets/trainers/combat/champions/misty_c.png' },
  { id: 3, city: 'Carmin sur Mer', champion: 'Lt. Surge', type: 'Électrik',
    badgeName: 'Badge Foudre',    badgeEmoji: '⚡',
    badgeSprite: 'assets/badges/surge_b.png',
    championSprite: 'assets/trainers/map/champions/surge.png',
    championSpriteCombat: 'assets/trainers/combat/champions/surge_c.png' },
  { id: 4, city: 'Céladopole',    champion: 'Erika',    type: 'Plante',
    badgeName: 'Badge Arc-en-Ciel', badgeEmoji: '🌿',
    badgeSprite: 'assets/badges/erika_b.png',
    championSprite: 'assets/trainers/map/champions/erika.png',
    championSpriteCombat: 'assets/trainers/combat/champions/erika_c.png' },
  { id: 5, city: 'Parmanie',       champion: 'Koga',     type: 'Poison',
    badgeName: 'Badge Âme',       badgeEmoji: '☠️',
    badgeSprite: 'assets/badges/koga_b.png',
    championSprite: 'assets/trainers/map/champions/koga.png',
    championSpriteCombat: 'assets/trainers/combat/champions/koga_c.png' },
  { id: 6, city: 'Safrania',       champion: 'Sabrina',  type: 'Psy',
    badgeName: 'Badge Marbre',    badgeEmoji: '🔮',
    badgeSprite: 'assets/badges/sabrina_b.png',
    championSprite: 'assets/trainers/map/champions/sabrina.png',
    championSpriteCombat: 'assets/trainers/combat/champions/sabrina_c.png' },
  { id: 7, city: 'Cramois\'île',   champion: 'Auguste',  type: 'Feu',
    badgeName: 'Badge Volcan',    badgeEmoji: '🔥',
    badgeSprite: 'assets/badges/auguste_b.png',
    championSprite: 'assets/trainers/map/champions/auguste.png',
    championSpriteCombat: 'assets/trainers/combat/champions/auguste_c.png' },
  { id: 8, city: 'Jadielle',       champion: 'Giovanni', type: 'Sol',
    badgeName: 'Badge Terre',     badgeEmoji: '🏔',
    badgeSprite: 'assets/badges/giovanni_b.png',
    championSprite: 'assets/trainers/map/champions/giovanni.png',
    championSpriteCombat: 'assets/trainers/combat/champions/giovanni_c.png' },
];

// ── Génère l'équipe du champion selon difficulté et mapIndex ─────────────────
// L'équipe est composée de 6 pokémons partageant tous le type de l'arène
// Budget calibré sur la courbe de difficulté générale
// budget   : somme de stats cible (passé depuis MapGenerator)
// maxUnits : nombre max de pokémons (aligné sur les slots joueur)
export function generateArenaTeam(arena, mapIndex = 0, budget = 800, maxUnits = 3, rng = Math.random.bind(Math)) {
  const type = arena.type;

  // Pool : tous les pokémons non-légendaires du type de l'arène
  const LEGENDARIES = new Set([144, 145, 146, 147, 148, 149, 150, 151]);
  const pool = POKEMONS.filter(p =>
    !LEGENDARIES.has(p.id) && p.types.includes(type)
  );
  if (!pool.length) return [];

  // Taux de tirage par tier selon mapIndex (même table que les dresseurs)
  const RATES = [
    [65, 30,  5,  0,  0],
    [50, 35, 13,  2,  0],
    [32, 35, 24,  8,  1],
    [18, 27, 36, 16,  3],
    [ 6, 17, 40, 32,  5],
    [ 1, 12, 40, 40,  7],
    [ 0, 10, 40, 43,  7],
    [ 0, 10, 40, 40, 10],
  ];

  function pokemonBST(p) {
    const s = p.stats;
    return (s.hp ?? 0) + (s.atk ?? 0) + (s.spa ?? 0)
         + (s.def ?? 0) + (s.spd_def ?? 0) + (s.spd ?? 0);
  }

  function pokemonTier(p) {
    const b = pokemonBST(p);
    if (b <= 308) return 1;
    if (b <= 390) return 2;
    if (b <= 470) return 3;
    if (b <= 550) return 4;
    return 5;
  }

  // Tirage pondéré par tier
  function weightedPick(remaining) {
    const rates = RATES[Math.min(mapIndex, 7)];
    // Filtre aussi par budget restant
    const weighted = pool
      .map(p => ({ p, w: rates[pokemonTier(p) - 1] ?? 0 }))
      .filter(x => x.w > 0 && pokemonBST(x.p) <= remaining + 50);
    // Si rien d'abordable → prend le moins cher du pool
    if (!weighted.length) {
      const cheapest = pool.slice().sort((a, b) => pokemonBST(a) - pokemonBST(b));
      return cheapest[0];
    }
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let   roll  = rng() * total;
    for (const { p, w } of weighted) { roll -= w; if (roll <= 0) return p; }
    return weighted[weighted.length - 1].p;
  }

  // Génère l'équipe dans la limite de maxUnits et du budget
  const team  = [];
  let   spent = 0;
  const cells = [];
  for (let col = 0; col < 3; col++)
    for (let row = 0; row < 2; row++)
      cells.push({ col, row });

  // Mélange seeded
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  for (let i = 0; i < maxUnits && spent < budget; i++) {
    const remaining = budget - spent;
    const pick      = weightedPick(remaining);
    const bst       = pokemonBST(pick);
    spent += bst;
    team.push({ ...pick, col: cells[i].col, row: cells[i].row, attributes: [] });
  }

  return team;
}

// ── Synergy budget (point 8) : chaque synergie compte dans le budget ─────────
export function calculateSynergyBudget(team) {
  const typeCounts = {};
  team.forEach(u => {
    (u.types ?? []).forEach(t => {
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    });
  });
  let bonus = 0;
  Object.values(typeCounts).forEach(count => {
    if (count >= 4) bonus += 200;      // synergie niveau 2
    else if (count >= 2) bonus += 100; // synergie niveau 1
  });
  return bonus;
}

// ── Génère l'équipe de la ligue : type aléatoire + synergie 3★ garantie ──────
// 6 pokémons partageant TOUS un type commun → synergie 3★ (4 même type) assurée
export function generateLeagueTeam(mapIndex = 7, difficultyMult = 1.0, rng = Math.random.bind(Math)) {
  const LEGENDARIES = new Set([144, 145, 146, 147, 148, 149, 150, 151]);

  // Liste des types disponibles (ceux ayant au moins 6 pokémons non-légendaires)
  const typePool = {};
  POKEMONS.filter(p => !LEGENDARIES.has(p.id)).forEach(p => {
    p.types.forEach(t => {
      typePool[t] = (typePool[t] ?? []);
      typePool[t].push(p);
    });
  });
  const validTypes = Object.entries(typePool).filter(([, pool]) => pool.length >= 6);
  if (!validTypes.length) return [];

  // Tire un type aléatoire
  const [chosenType, pool] = validTypes[Math.floor(rng() * validTypes.length)];

  // Budget élevé pour la ligue (difficile)
  const BASE_BUDGET = 800;
  const MAX_BUDGET  = 2400;
  const ratio       = Math.min(mapIndex / 7, 1);
  const curved      = Math.pow(ratio, 1.3);
  const budget      = Math.round(
    (BASE_BUDGET + (MAX_BUDGET - BASE_BUDGET) * curved) * difficultyMult * 1.3
  );

  // Tirage pondéré — favorise les tiers hauts pour la ligue
  const RATES = [[0, 5, 25, 45, 25]]; // map 7+ : beaucoup de T3-T4-T5
  function pokemonBST(p) {
    const s = p.stats;
    return (s.hp ?? 0) + (s.atk ?? 0) + (s.spa ?? 0) + (s.def ?? 0) + (s.spd_def ?? 0) + (s.spd ?? 0);
  }
  function pokemonTier(p) {
    const b = pokemonBST(p);
    if (b <= 308) return 1;
    if (b <= 390) return 2;
    if (b <= 470) return 3;
    if (b <= 550) return 4;
    return 5;
  }
  function weightedPick(remaining) {
    const rates = RATES[0];
    const weighted = pool
      .map(p => ({ p, w: rates[pokemonTier(p) - 1] ?? 0 }))
      .filter(x => x.w > 0 && pokemonBST(x.p) <= remaining + 80);
    if (!weighted.length) return pool[Math.floor(rng() * pool.length)];
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let   roll  = rng() * total;
    for (const { p, w } of weighted) { roll -= w; if (roll <= 0) return p; }
    return weighted[weighted.length - 1].p;
  }

  const team  = [];
  let   spent = 0;
  const cells = [];
  for (let col = 0; col < 3; col++)
    for (let row = 0; row < 2; row++)
      cells.push({ col, row });
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  for (let i = 0; i < 6 && spent < budget; i++) {
    const pick = weightedPick(budget - spent);
    spent += pokemonBST(pick);
    team.push({ ...pick, col: cells[i].col, row: cells[i].row, attributes: [] });
  }

  return { team, type: chosenType };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getArenaForMap(mapIndex) {
  return ARENAS[Math.min(mapIndex, ARENAS.length - 1)] ?? null;
}

export function getArenaById(id) {
  return ARENAS.find(a => a.id === id) ?? null;
}