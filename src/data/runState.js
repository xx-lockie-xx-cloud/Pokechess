// Gestion de l'état global d'une run

export const BANK_MAX_SIZE = 6;

// Slots débloqués selon les arènes vaincues :
//   Départ    → 3 slots (rangée 0 complète)
//   Arène 2   → 4 slots (+1 rangée 1 col 0)
//   Arène 4   → 5 slots (+1 rangée 1 col 1)
//   Arène 6   → 6 slots (+1 rangée 1 col 2, terrain complet)
// Slots débloqués après chaque badge (2e, 4e, 6e arène)
// Correspond à badgesEarned.length dans runState
export const SLOT_UNLOCK_MAP = {
  2: 4,   // 2 badges → 4 slots
  4: 5,   // 4 badges → 5 slots
  6: 6,   // 6 badges → 6 slots
};

// Multiplicateur de stats ennemies par map (progression exponentielle douce)
// map 0 → ×1.00 | map 4 → ×1.48 | map 7 → ×1.84
export function getEnemyMultiplier(mapIndex, loopCount = 0) {
  // Maps 0-8 : progression normale
  // Mode infini (mapIndex > 8) : chaque boucle complète ajoute +30% de difficulté de base
  const loopBonus = loopCount * 0.30;
  const mapBonus  = Math.min(mapIndex, 8) * 0.12;
  // Au-delà de la map 8, chaque map supplémentaire ajoute encore +8%
  const infiniteBonus = mapIndex > 8 ? (mapIndex - 8) * 0.08 : 0;
  return Number((1 + mapBonus + infiniteBonus + loopBonus).toFixed(2));
}

export function initRun(registry, starterPokemon) {
  const uid     = `${starterPokemon.id}_starter_${Date.now()}`;
  const starter = { ...starterPokemon, uid, isInTeam: true, col: 0, row: 0 };

  registry.set('runState', {
    currentMap:    0,
    coins:         5,
    inventory:     [],
    playerBank:    [],
    unlockedSlots: 3,
    seenPokemon:   [],      // IDs des pokémons rencontrés
    loopCount:     0,       // nombre de fois que la ligue a été battue (mode infini)
  });

  registry.set('playerUnits', [starter]);
}

export function getRunState(registry) {
  return registry.get('runState') ?? {};
}

export function setRunState(registry, updates) {
  const current = getRunState(registry);
  registry.set('runState', { ...current, ...updates });
}

// ── Slots débloqués ────────────────────────────────────────────────────────
export function getUnlockedSlots(registry) {
  return getRunState(registry).unlockedSlots ?? 3;
}

// Appelé depuis ArenaVictoryUI après la victoire.
// arenaNumber = numéro humain de l'arène vaincue (1-8).
// Retourne true si un slot a été débloqué.
export function tryUnlockSlot(registry, arenaNumber) {
  const newCount = SLOT_UNLOCK_MAP[arenaNumber];
  if (!newCount) return false;
  const current = getUnlockedSlots(registry);
  if (current >= newCount) return false;
  setRunState(registry, { unlockedSlots: newCount });
  return true;
}

// ── PokéBalls supprimées — achat direct en pièces (voir WildUI) ───────────

// ── Inventaire ─────────────────────────────────────────────────────────────
export function addToInventory(registry, itemId) {
  const state = getRunState(registry);
  const inv   = [...(state.inventory ?? [])];
  inv.push(itemId);
  setRunState(registry, { inventory: inv });
}
export function removeFromInventory(registry, itemId) {
  const state = getRunState(registry);
  const inv   = [...(state.inventory ?? [])];
  const idx   = inv.indexOf(itemId);
  if (idx === -1) return false;
  inv.splice(idx, 1);
  setRunState(registry, { inventory: inv });
  return true;
}
export function getInventory(registry) {
  return getRunState(registry).inventory ?? [];
}

// ── Coins ──────────────────────────────────────────────────────────────────
export function addCoins(registry, amount) {
  const state = getRunState(registry);
  setRunState(registry, { coins: (state.coins ?? 0) + amount });
}
export function removeCoins(registry, amount) {
  const state = getRunState(registry);
  setRunState(registry, { coins: Math.max(0, (state.coins ?? 0) - amount) });
}

// ── Banque ─────────────────────────────────────────────────────────────────
export function addToBank(registry, pokemon) {
  const state = getRunState(registry);
  const bank  = state.playerBank ?? [];
  if (bank.length >= BANK_MAX_SIZE) return false;
  const uid = `${pokemon.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  bank.push({ ...pokemon, uid, isInTeam: true });
  setRunState(registry, { playerBank: bank });
  return true;
}
export function removeFromBank(registry, pokemonId) {
  const state = getRunState(registry);
  const bank  = state.playerBank ?? [];
  const idx   = bank.findIndex(p => p.id === pokemonId);
  if (idx === -1) return null;
  const removed = bank.splice(idx, 1)[0];
  setRunState(registry, { playerBank: bank });
  return removed;
}

// ── Budget map (conservé pour les ennemis) ────────────────────────────────
export function getMapBudget(mapIndex) {
  const MIN_BUDGET = 150;
  const MAX_BUDGET = 1200;
  const ratio = mapIndex / 8;
  return Math.round(MIN_BUDGET + (MAX_BUDGET - MIN_BUDGET) * ratio);
}

// ── Tiers BST ─────────────────────────────────────────────────────────────
// T1: 180-310  T2: 311-390  T3: 391-470  T4: 471-550  T5: 551+
export function getBSTTier(pokemon) {
  const bst = pokemon.stats.hp  + pokemon.stats.atk + pokemon.stats.spa +
              pokemon.stats.def + pokemon.stats.spd_def + pokemon.stats.spd;
  if (bst <= 308) return 1;  // Salamèche (309) passe en T2
  if (bst <= 390) return 2;
  if (bst <= 470) return 3;
  if (bst <= 550) return 4;
  return 5;
}

// Taux de tirage par map (index 0-8) × tier (1-5), en %
// Cible finale map 8 : 0/10/40/40/10
const TIER_RATES = [
  //  T1   T2   T3   T4   T5
  [   65,  30,   5,   0,   0 ],  // map 0
  [   50,  35,  13,   2,   0 ],  // map 1
  [   32,  35,  24,   8,   1 ],  // map 2
  [   18,  27,  36,  16,   3 ],  // map 3
  [    6,  17,  40,  32,   5 ],  // map 4
  [    1,  12,  40,  40,   7 ],  // map 5
  [    0,  10,  40,  43,   7 ],  // map 6
  [    0,  10,  40,  41,   9 ],  // map 7
  [    0,  10,  40,  40,  10 ],  // map 8
];

// Tire un pokémon selon les poids pondérés de la map courante
// Retourne un pokémon (pas un index) ou null si pool vide
export function weightedWildDraw(registry, POKEMONS, rng = null) {
  const state    = getRunState(registry);
  const mapIdx   = Math.min(state.currentMap ?? 0, TIER_RATES.length - 1);
  const rates    = TIER_RATES[mapIdx];
  const rand     = rng ?? Math.random.bind(Math);

  const weighted = POKEMONS.map(p => {
    const tier   = getBSTTier(p);
    const weight = rates[tier - 1];
    return { p, weight };
  }).filter(x => x.weight > 0);

  if (!weighted.length) return null;

  const total = weighted.reduce((s, x) => s + x.weight, 0);
  let   roll  = rand() * total;
  for (const { p, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return p;
  }
  return weighted[weighted.length - 1].p;
}

// Conservé pour compatibilité (utilisé par les ennemis)
export function getWildPool(registry, POKEMONS) {
  const state      = getRunState(registry);
  const mapIndex   = state.currentMap ?? 0;
  const budget     = getMapBudget(mapIndex);
  const maxStatSum = budget / 2;
  return POKEMONS.filter(p => {
    const statSum = p.stats.hp + p.stats.atk + p.stats.spa +
                    p.stats.def + p.stats.spd_def + p.stats.spd;
    return statSum <= maxStatSum;
  });
}

// ── Pokédex — pokémons rencontrés ──────────────────────────────────────────
export function addSeenPokemon(registry, pokemonId) {
  const state = getRunState(registry);
  const seen  = state.seenPokemon ?? [];
  if (!seen.includes(pokemonId)) {
    setRunState(registry, { seenPokemon: [...seen, pokemonId] });
  }
}

export function getSeenPokemon(registry) {
  const state = getRunState(registry);
  return new Set(state.seenPokemon ?? []);
}

// ── Layout de map ──────────────────────────────────────────────────────────
// Sauve le layout complet (nœuds avec état visited/available) + nœud courant
export function saveMapLayout(registry, mapNodes, startNode, lastNodeCol = null) {
  const update = {
    mapLayout: mapNodes,
    mapStart:  startNode,
  };
  if (lastNodeCol !== null) update.lastNodeCol = lastNodeCol;
  setRunState(registry, update);
}

export function getMapLayout(registry) {
  const state = getRunState(registry);
  return {
    mapNodes:    state.mapLayout  ?? null,
    startNode:   state.mapStart   ?? null,
    lastNodeCol: state.lastNodeCol ?? 0,
  };
}

// ── Sauvegarde de la progression sur la map ────────────────────────────────
export function saveMapProgress(registry, seed, visitedNodes, availableNodes, col = 0) {
  setRunState(registry, {
    mapSeed:      seed,
    mapVisited:   visitedNodes,
    mapAvailable: availableNodes,
    lastNodeCol:  col,
  });
}

export function getMapProgress(registry) {
  const state = getRunState(registry);
  return {
    seed:      state.mapSeed      ?? null,
    visited:   state.mapVisited   ?? [],
    available: state.mapAvailable ?? [],
    col:       state.lastNodeCol  ?? 0,
  };
}
