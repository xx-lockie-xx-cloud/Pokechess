// ─────────────────────────────────────────────────────────────────────────────
// arenas.js — 8 arènes de Kanto avec équipes générées dynamiquement
// Les équipes sont créées selon la difficulté et la courbe de progression
// Le joueur ne connaît pas le type adverse avant le combat
// ─────────────────────────────────────────────────────────────────────────────

import { POKEMONS }    from './pokemons.js';
import { getBSTTier }  from './runState.js';
import { TRAINER_ARCHETYPES, TRAINER_ARCHETYPES_EXTRA, generateEnemyTeam } from './trainers.js';
import { getRegionArenas, isPokemonAllowed, DEFAULT_REGION,
         ARENAS_KANTO, REGIONS, GEN_RANGES } from './regions.js';

// ── Métadonnées des 8 arènes (sans équipes statiques) ────────────────────────
// Compatibilité : ARENAS désigne les arènes de Kanto (région par défaut).
// La source de vérité est arenaKanto.js / arenaJohto.js via regions.js.
// Préférer getArenas(regionId) pour du code conscient des régions.
export const ARENAS = ARENAS_KANTO;

// ── Légendaires ──────────────────────────────────────────────────────────────
// VRAIS légendaires : jamais dans une équipe ennemie.
export const LEGENDARIES = new Set([
  144, 145, 146, 150, 151,           // Artikodin, Électhor, Sulfura, Mewtwo, Mew
  243, 244, 245, 249, 250, 251,      // Raikou, Entei, Suicune, Lugia, Ho-Oh, Celebi
]);

// PSEUDO-légendaires : écartés par défaut (trop puissants), mais réintégrés
// quand le pool d'un type devient trop maigre (voir generateArenaTeam).
export const PSEUDO_LEGENDARIES = new Set([
  147, 148, 149,                     // Minidraco, Draco, Dracolosse
  246, 247, 248,                     // Embrylex, Ymphect, Tyranocif
]);

const MIN_ARENA_POOL = 4;

// Nombre maximum d'exemplaires d'un même Pokémon dans une équipe de champion
const MAX_SAME = 2;

// ── Bonus de STATUT (indépendant de la difficulté) ───────────────────────────
// Un champion d'arène et un maître de ligue sont plus forts qu'un dresseur
// ordinaire à budget égal. La DIFFICULTÉ est appliquée séparément par
// DIFF_STAT_MULTS (CombatUI) et par les budgets (MapGenerator) : ne pas la
// remettre ici, sous peine d'empiler trois fois le même effet.
export const ARENA_MULT  = 1.1;   // champions d'arène
export const MASTER_MULT = 1.2;   // maître de la Ligue

// Une équipe FIXE (Red) ne traverse aucune courbe de budget : à difficulté
// croissante, elle ne gagnerait ni unités ni Pokémon plus coûteux. Ce facteur
// reproduit l'effet du budget ET calibre le niveau absolu de l'équipe.
//
// Les valeurs sont inférieures à 1 parce que l'équipe de Red est composée de
// Pokémon à très haut BST (Ronflex, Florizarre, Tortank, Dracaufeu, Lokhlass)
// sur six emplacements toujours remplis : sans correction, elle dépassait
// largement le reste du jeu. La progression reste croissante (×2.46 de Facile
// à Expert) et la marche finale se creuse : ×1.05 en Facile, ×1.21 en Expert.
export const FIXED_TEAM_DIFF = { easy: 0.680, normal: 0.898, hard: 1.027, expert: 1.089 };   // +10% (difficulté Red)

// ── Génère l'équipe du champion selon difficulté et mapIndex ─────────────────
// L'équipe est composée de 6 pokémons partageant tous le type de l'arène
// Budget calibré sur la courbe de difficulté générale
// budget   : somme de stats cible (passé depuis MapGenerator)
// maxUnits : nombre max de pokémons (aligné sur les slots joueur)
export function generateArenaTeam(arena, mapIndex = 0, budget = 800, maxUnits = 3,
                                  rng = Math.random.bind(Math),
                                  regionId = DEFAULT_REGION, meta = null) {
  const type = arena.type;

  // Pool : tous les pokémons non-légendaires du type de l'arène
  // Le pool respecte les générations débloquées : pas de gen 2 chez un champion
  // tant que le joueur ne l'a pas débloquée.
  const pool = POKEMONS.filter(p =>
    !LEGENDARIES.has(p.id) &&
    p.types.includes(type) &&
    isPokemonAllowed(p.id, regionId, meta)
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
  function weightedPick(remaining, fromPool = pool) {
    const rates = RATES[Math.min(mapIndex, 7)];
    // Filtre aussi par budget restant
    const weighted = fromPool
      .map(p => ({ p, w: rates[pokemonTier(p) - 1] ?? 0 }))
      .filter(x => x.w > 0 && pokemonBST(x.p) <= remaining + 50);
    // Si rien d'abordable → prend le moins cher du sous-pool
    if (!weighted.length) {
      const cheapest = fromPool.slice().sort((a, b) => pokemonBST(a) - pokemonBST(b));
      return cheapest[0];
    }
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let   roll  = rng() * total;
    for (const { p, w } of weighted) { roll -= w; if (roll <= 0) return p; }
    return weighted[weighted.length - 1].p;
  }

  // Génère l'équipe dans la limite de maxUnits et du budget
  const team   = [];
  const counts = {};          // occurrences par id, pour le plafond de doublons
  let   spent  = 0;
  const cells  = [];
  for (let col = 0; col < 3; col++)
    for (let row = 0; row < 2; row++)
      cells.push({ col, row });

  // Mélange seeded
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  // Identité régionale : dans une région dont la génération signature est la 2
  // (Johto), le PREMIER Pokémon du champion est garanti gen 2. Sans cela, les
  // tirages au budget favorisent les valeurs sûres de la gen 1 et la région
  // paraît identique à Kanto.
  const signatureGen  = REGIONS[regionId]?.signatureGen ?? null;
  const signaturePool = signatureGen
    ? pool.filter(p => {
        const r = GEN_RANGES[signatureGen];
        return r && p.id >= r[0] && p.id <= r[1];
      })
    : [];

  for (let i = 0; i < maxUnits && spent < budget; i++) {
    const remaining = budget - spent;
    // Premier tirage : puise dans le pool de la génération signature si elle
    // offre un choix abordable, sinon retombe sur le pool complet.
    const useSignature = i === 0 && signaturePool.length > 0;
    let   basePool     = useSignature ? signaturePool : pool;

    // Plafond de doublons : au maximum MAX_SAME exemplaires d'un même Pokémon.
    // Les pools étroits (Dragon, Acier, Spectre) produisaient sinon des équipes
    // du genre "Feuforêve, Feuforêve, Feuforêve".
    const saturated = new Set(
      Object.entries(counts).filter(([, n]) => n >= MAX_SAME).map(([id]) => Number(id))
    );
    if (saturated.size) {
      const filtered = basePool.filter(p => !saturated.has(p.id));
      // On ne filtre que s'il reste de quoi choisir, sinon le doublon est toléré
      if (filtered.length) basePool = filtered;
    }

    const pick      = weightedPick(remaining, basePool);
    if (!pick) break;
    const bst       = pokemonBST(pick);
    spent += bst;
    counts[pick.id] = (counts[pick.id] ?? 0) + 1;

    // Bonus de statut "Champion" appliqué aux stats (le budget, lui, reste
    // calculé sur le BST de base : le champion est plus fort à budget égal).
    const boosted = {};
    Object.entries(pick.stats ?? {}).forEach(([k, v]) => {
      boosted[k] = Math.round(v * ARENA_MULT);
    });

    team.push({ ...pick, stats: boosted, col: cells[i].col, row: cells[i].row,
                attributes: [], _champion: true });
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
export function generateLeagueTeam(mapIndex = 7, difficultyMult = 1.0,
                                   rng = Math.random.bind(Math),
                                   regionId = DEFAULT_REGION, meta = null) {
  const LEGENDARIES = new Set([
    144, 145, 146, 147, 148, 149, 150, 151,          // gen 1
    243, 244, 245, 246, 247, 248, 249, 250, 251,     // gen 2
  ]);

  // Liste des types disponibles (ceux ayant au moins 6 pokémons non-légendaires)
  const typePool = {};
  POKEMONS
    .filter(p => !LEGENDARIES.has(p.id) && !PSEUDO_LEGENDARIES.has(p.id)
                 && isPokemonAllowed(p.id, regionId, meta))
    .forEach(p => {
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

// ── Génère le MAÎTRE de la ligue : archétype aléatoire en version "Maître" ───
// Pioche un archétype connu, construit son équipe (boost de stats lié à la
// difficulté), et renvoie nom/sprite/couleur correspondant à l'archétype.
export function generateLeagueMaster(mapIndex = 8, difficulty = 'normal',
                                     rng = Math.random.bind(Math),
                                     regionId = DEFAULT_REGION, meta = null,
                                     budgetOverride = null) {
  // Bonus de statut "Maître". Pour une équipe générée, la difficulté agit via
  // le budget ; pour une équipe fixe, on la réintroduit ici avec FIXED_TEAM_DIFF.
  const hasFixedTeam = !!REGIONS[regionId]?.masterTeam;
  const mult = MASTER_MULT * (hasFixedTeam ? (FIXED_TEAM_DIFF[difficulty] ?? 1) : 1);

  // Pool d'archétypes : base + extra (avec un pool exploitable)
  const archetypes = [...TRAINER_ARCHETYPES, ...TRAINER_ARCHETYPES_EXTRA]
    .filter(a => Array.isArray(a.pool) && a.pool.length >= 4);
  const arch = archetypes[Math.floor(rng() * archetypes.length)];

  // Johto : le maître est FIXE (Red au Mont Argenté), pas un archétype tiré au
  // sort. Son équipe est libre en type, contrairement aux champions d'arène.
  const master = REGIONS[regionId]?.master ?? null;
  const isFixedMaster = regionId !== DEFAULT_REGION && master;

  // Budget : fourni par MapGenerator (issu de DIFF_BUDGETS, donc cohérent avec
  // les champions). Sans lui, on retombe sur une courbe interne, mais celle-ci
  // ne suit PAS la difficulté : elle ne sert que de garde-fou hors partie.
  const budget = budgetOverride != null
    ? budgetOverride
    : Math.round((1000 + 1600 * Math.pow(Math.min(mapIndex / 8, 1), 1.2)) * mult);

  // Équipe FIXE si la région en déclare une (Red à Johto), sinon tirage depuis
  // le pool de l'archétype (6 unités max).
  const fixedTeam = REGIONS[regionId]?.masterTeam ?? null;
  const rawTeam = fixedTeam
    ? fixedTeam.map(slot => {
        const base = POKEMONS.find(p => p.id === slot.id);
        if (!base) return null;
        return {
          id: base.id, name: base.name, types: base.types,
          col: slot.col, row: slot.row,
          stats: { ...base.stats },
          attributes: [],
          spriteUrl: base.spriteUrl,
        };
      }).filter(Boolean)
    : generateEnemyTeam(arch, budget, 6, Math.min(mapIndex, 8), rng,
                        isPokemonAllowed(152, regionId, meta));

  // Applique le boost "Maître" aux stats de chaque pokémon
  const team = rawTeam.map(u => {
    const boosted = {};
    Object.entries(u.stats ?? {}).forEach(([k, v]) => {
      boosted[k] = Math.round(v * mult);
    });
    return { ...u, stats: boosted, _master: true };
  });

  if (isFixedMaster) {
    return {
      team,
      name:         master.name,
      type:         null,
      color:        0xff3b30,
      spriteCombat: master.spriteCombat ?? null,
      spriteMap:    master.sprite ?? null,
      archetypeId:  null,
    };
  }

  return {
    team,
    name:         `Maître ${arch.name}`,
    type:         arch.types?.[0] ?? null,
    color:        arch.color ?? 0xffd700,
    spriteCombat: arch.spriteCombat ?? null,
    spriteMap:    arch.spriteMap ?? null,
    archetypeId:  arch.id,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getArenaForMap(mapIndex, regionId = DEFAULT_REGION) {
  const list = getRegionArenas(regionId);
  return list[Math.min(mapIndex, list.length - 1)] ?? null;
}

// Comme getArenaForMap, mais renvoie le MAÎTRE de région si la map dépasse les
// arènes (map du maître). Utilisé pour le sprite du nœud boss final (Red / Peter).
export function getBossForMap(mapIndex, regionId = DEFAULT_REGION) {
  const list = getRegionArenas(regionId);
  if (mapIndex >= list.length) return REGIONS[regionId]?.master ?? null;
  return list[mapIndex] ?? null;
}

export function getArenaById(id, regionId = DEFAULT_REGION) {
  return getRegionArenas(regionId).find(a => a.id === id) ?? null;
}

// Liste des arènes d'une région (badges, écran de victoire, carte...)
export function getArenas(regionId = DEFAULT_REGION) {
  return getRegionArenas(regionId);
}

// ── Nom de la destination d'une map ──────────────────────────────────────────
// Les maps 0 à 7 mènent aux 8 arènes de la région ; la map 8 mène au maître
// (Plateau Indigo pour Kanto, Mont Argenté pour Johto). Au-delà, mode endless.
export function getDestinationName(mapIndex, regionId = DEFAULT_REGION) {
  const list = getRegionArenas(regionId);
  if (mapIndex < list.length) return list[mapIndex]?.city ?? `Route ${mapIndex + 1}`;
  const master = REGIONS[regionId]?.master;
  return master?.city ?? 'Plateau Indigo';
}