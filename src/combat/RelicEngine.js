// ─────────────────────────────────────────────────────────────────────────────
// RelicEngine.js — Système de hooks pour les reliques
// Chaque relique déclare ses `hooks` dans relics.js ; ce moteur les dispatche.
// Les méthodes publiques historiques (applyPreCombat, applyStatModifier, etc.)
// sont conservées comme wrappers pour ne casser aucun appelant existant.
// ─────────────────────────────────────────────────────────────────────────────
import { getRelicById } from '../data/relics.js';
import { POKEMONS }     from '../data/pokemons.js';

// ── Helpers RNG déterministe (seed string → [0,1)) ────────────────────────
function seedRng(seed) {
  let s = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) s = (Math.imul(31, s) + str.charCodeAt(i)) | 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return ((s >>> 0) / 0xFFFFFFFF);
  };
}

const ALL_TYPES = [
  'Feu','Eau','Plante','Électrik','Psy','Glace','Combat','Poison',
  'Sol','Vol','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée','Normal',
];

// ── Lit la valeur d'un hook pour une relique donnée ──────────────────────────
function getHook(relicId, hookName) {
  const relic = getRelicById(relicId);
  if (!relic?.hooks) return undefined;
  return relic.hooks[hookName];
}

export const RelicEngine = {

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOK READERS — API générique
  // ═══════════════════════════════════════════════════════════════════════════

  // Retourne la valeur d'un hook (ou undefined si la relique ne l'a pas)
  hook(relicId, hookName) {
    return getHook(relicId, hookName);
  },

  // True si la relique possède ce hook
  has(relicId, hookName) {
    return getHook(relicId, hookName) !== undefined;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉCONOMIE / META
  // ═══════════════════════════════════════════════════════════════════════════

  // Nombre de slots boutique (loupe) — défaut 3
  shopSlots(relicId, base = 3) {
    return getHook(relicId, 'ECON_SHOP_SLOTS') ?? base;
  },

  // Nombre de pokémons sauvages (aimant) — défaut 3
  wildSlots(relicId, base = 3) {
    return getHook(relicId, 'ECON_WILD_SLOTS') ?? base;
  },

  // Multiplicateur de prix de vente (braderie) — défaut 0.5
  sellMult(relicId, base = 0.5) {
    return getHook(relicId, 'ECON_SELL_MULT') ?? base;
  },

  // Pièces bonus par victoire (bourse_doree) — défaut 0
  winCoins(relicId) {
    return getHook(relicId, 'ECON_WIN_COINS') ?? 0;
  },

  // Niveaux gagnés par arène (medaille) — défaut 0
  arenaLevels(relicId) {
    return getHook(relicId, 'ECON_ARENA_LEVEL') ?? 0;
  },

  // Multiplicateur de capture (doppelganger) : combien d'exemplaires + coût ×
  captureMult(relicId) {
    return getHook(relicId, 'ECON_CAPTURE') ?? 1;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN START
  // ═══════════════════════════════════════════════════════════════════════════

  // Pièces de départ bonus (contrat_maudit)
  startCoins(relicId) {
    return getHook(relicId, 'RUN_START_COINS') ?? 0;
  },

  // True si la relique donne un objet aléatoire au départ
  givesStartItem(relicId) {
    return getHook(relicId, 'RUN_START_ITEM') === true;
  },

  // True si la relique offre un objet TYPÉ à chaque Pokémon capturé
  // (pochette_surprise) : l'objet correspond à un type du Pokémon obtenu.
  givesItemOnCatch(relicId) {
    return getHook(relicId, 'ITEM_ON_CATCH') === true;
  },

  // True si la relique randomise les types (anomalie)
  randomizesTypes(relicId) {
    return getHook(relicId, 'RUN_START_TYPES') === true;
  },

  // Génère le mapping pokémonId → [type1, type2] pour l'Anomalie
  generateAnomalyTypes(runSeed) {
    const rng = seedRng('anomalie_' + runSeed);
    const map = {};
    POKEMONS.forEach(p => {
      const t1 = ALL_TYPES[Math.floor(rng() * ALL_TYPES.length)];
      const t2 = ALL_TYPES[Math.floor(rng() * ALL_TYPES.length)];
      map[p.id] = [t1, t2];
    });
    return map;
  },

  applyAnomalyTypes(unit, anomalyTypes) {
    if (!anomalyTypes?.[unit.id]) return;
    unit.types = anomalyTypes[unit.id];
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT SETUP (avant chaque combat, symétrique)
  // ═══════════════════════════════════════════════════════════════════════════

  applyPreCombat(relicId, playerUnits, enemyUnits) {
    if (!relicId) return;

    // PRE_MANA : mana de départ (condensateur)
    const mana = getHook(relicId, 'PRE_MANA');
    if (mana != null) {
      [...playerUnits, ...enemyUnits].forEach(u => {
        u.mana = Math.max(u.mana ?? 0, mana);
      });
    }

    // PRE_HALF_HP : 1 unité aléatoire de chaque camp à X% HP (de_maudit)
    const halfHp = getHook(relicId, 'PRE_HALF_HP');
    if (halfHp != null) {
      const pick = (units) => {
        const alive = units.filter(u => u.hp > 0);
        return alive[Math.floor(Math.random() * alive.length)];
      };
      const pu = pick(playerUnits);
      const eu = pick(enemyUnits);
      if (pu) pu.hp = Math.max(1, Math.ceil(pu.maxHp * halfHp));
      if (eu) eu.hp = Math.max(1, Math.ceil(eu.maxHp * halfHp));
    }

    // PRE_MARK_TOP_BST : le marquage de la Couronne est géré par CombatUI
    // AVANT getFullStats (avec bonus de niveau), pour que le ×2 synergie s'applique.
    // Ici on ne refait rien pour éviter un double marquage incohérent.
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STAT MODIFIER (par unité)
  // ═══════════════════════════════════════════════════════════════════════════

  applyStatModifier(relicId, unit) {
    const mults = getHook(relicId, 'STAT_MULT');
    if (!mults) return;
    Object.entries(mults).forEach(([s, mult]) => {
      if (unit.stats && unit.stats[s] !== undefined) {
        unit.stats[s] = Math.max(1, Math.round(unit.stats[s] * mult));
      }
      if (unit[s] !== undefined) {
        unit[s] = Math.max(1, Math.round((unit[s] ?? 0) * mult));
      }
      if (s === 'hp' && unit.maxHp !== undefined) {
        unit.maxHp = unit.stats?.hp ?? unit.hp;
      }
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNERGIES
  // ═══════════════════════════════════════════════════════════════════════════

  // Modifie la liste de synergies (miroir: boost)
  // Note : le catalyseur (SYN_THRESHOLD) est géré directement dans
  // getActiveSynergies (abaissement des seuils), pas ici.
  modifySynergies(relicId, synergies, fieldUnits) {
    if (!relicId || !synergies?.length) return synergies;

    // SYN_ALL_BOOST : marque toutes les synergies pour le boost (miroir)
    const boost = getHook(relicId, 'SYN_ALL_BOOST');
    if (boost != null) {
      synergies = synergies.map(s => ({ ...s, _relicBoost: boost }));
    }

    return synergies;
  },

  // SYN_MONOTYPE : les monotypes comptent ×N (cristal_pur)
  modifyTypeCounts(relicId, typeCounts, fieldUnits) {
    const mono = getHook(relicId, 'SYN_MONOTYPE');
    if (mono == null) return typeCounts;

    const result = { ...typeCounts };
    fieldUnits.filter(Boolean).forEach(unit => {
      const unique = [...new Set(unit.types)];
      if (unique.length === 1) {
        // +（N-1) puisque le pokémon est déjà compté 1 fois normalement
        result[unique[0]] = (result[unique[0]] ?? 0) + (mono - 1);
      }
    });
    return result;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PENDANT LE COMBAT
  // ═══════════════════════════════════════════════════════════════════════════

  // TICK_ACTION_LIMIT : Sablier — vérifie si le combat doit s'arrêter
  checkActionLimit(relicId, actionCount, playerUnits, enemyUnits) {
    const limit = getHook(relicId, 'TICK_ACTION_LIMIT');
    if (limit == null || actionCount < limit) return null;

    const playerHp = playerUnits.reduce((s, u) => s + Math.max(0, u.hp), 0);
    const enemyHp  = enemyUnits.reduce((s, u) => s + Math.max(0, u.hp), 0);
    if (playerHp > enemyHp) return 'player';
    if (enemyHp > playerHp) return 'enemy';
    return 'draw';
  },

  // ON_DEATH_ULTIMATE : Revanche — déclenche l'ultime à la mort si mana ≥ seuil
  checkDeathUltimate(relicId, unit) {
    const threshold = getHook(relicId, 'ON_DEATH_ULTIMATE');
    if (threshold == null) return false;
    return (unit.mana ?? 0) >= threshold;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AFFICHAGE
  // ═══════════════════════════════════════════════════════════════════════════

  showsEnemyStats(relicId) {
    return getHook(relicId, 'DISPLAY_ENEMY_STATS') === true;
  },

  masksWild(relicId) {
    return getHook(relicId, 'DISPLAY_MASK_WILD') === true;
  },
};