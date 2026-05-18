// Gestion de l'état global d'une run
// Stocké dans le registre Phaser pour persister entre les scènes

export const BANK_MAX_SIZE = 6;  // slots max dans la banque

// Initialise une nouvelle run dans le registre
export function initRun(registry, starterPokemon) {
  const uid = `${starterPokemon.id}_starter`;
  registry.set('runState', {
    currentMap:  0,
    coins:       5,          // 5 pièces pour démarrer
    pokeballs:   2,          // ← 2 pokéballs de départ
    inventory:   [],         // objets consommables en stock
    playerBank:  [{ ...starterPokemon, uid, isInTeam: true }],
  });
}

// Helpers pour lire/modifier le runState
export function getRunState(registry) {
  return registry.get('runState') ?? {};
}

export function setRunState(registry, updates) {
  const current = getRunState(registry);
  registry.set('runState', { ...current, ...updates });
}

// ── PokéBalls ──────────────────────────────────────────────────────────────
export function getPokeballs(registry) {
  return getRunState(registry).pokeballs ?? 0;
}

export function addPokeballs(registry, amount) {
  const state = getRunState(registry);
  setRunState(registry, { pokeballs: (state.pokeballs ?? 0) + amount });
}

export function removePokeball(registry) {
  const state = getRunState(registry);
  const current = state.pokeballs ?? 0;
  if (current <= 0) return false;
  setRunState(registry, { pokeballs: current - 1 });
  return true;
}

// ── Inventaire (objets consommables) ──────────────────────────────────────
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
// ──────────────────────────────────────
export function addCoins(registry, amount) {
  const state = getRunState(registry);
  setRunState(registry, { coins: (state.coins ?? 0) + amount });
}

export function removeCoins(registry, amount) {
  const state = getRunState(registry);
  setRunState(registry, { coins: Math.max(0, (state.coins ?? 0) - amount) });
}

export function addToBank(registry, pokemon) {
  const state = getRunState(registry);
  const bank  = state.playerBank ?? [];
  if (bank.length >= BANK_MAX_SIZE) return false;

  // Génère un uid unique pour éviter les collisions de clé
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

// Budget de la map actuelle (détermine la force des ennemis et du carrousel)
export function getMapBudget(mapIndex) {
  const MIN_BUDGET = 150;
  const MAX_BUDGET = 1200;
  const ratio = mapIndex / 8;  // 9 maps : 0 à 8
  return Math.round(MIN_BUDGET + (MAX_BUDGET - MIN_BUDGET) * ratio);
}

// Pool de pokémons filtrés selon le budget de la map
// Retourne les pokémons dont la somme des stats est <= budget/2
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