// ─────────────────────────────────────────────────────────────────────────────
// RelicEngine.js — Application des effets de relique
// Utilisé par CombatEngine, CombatUI, WildUI, ShopUI, StarterUI
// ─────────────────────────────────────────────────────────────────────────────
import { getRelicById } from '../data/relics.js';
import { POKEMONS }     from '../data/pokemons.js';

// ── Helpers RNG déterministe (seed string → [0,1)) ────────────────────────
function seedRng(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return ((s >>> 0) / 0xFFFFFFFF);
  };
}

// Types disponibles pour l'Anomalie
const ALL_TYPES = [
  'Feu','Eau','Plante','Électrik','Psy','Glace','Combat','Poison',
  'Sol','Vol','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée','Normal',
];

export const RelicEngine = {

  // ── Génère le mapping pokémonId → [type1, type2] pour l'Anomalie ─────────
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

  // ── Applique les types Anomalie à une unité ────────────────────────────────
  applyAnomalyTypes(unit, anomalyTypes) {
    if (!anomalyTypes?.[unit.id]) return;
    unit.types = anomalyTypes[unit.id];
  },

  // ── Applique les effets de la relique avant le combat ─────────────────────
  // Appelé dans CombatEngine._setupPreCombat
  applyPreCombat(relicId, playerUnits, enemyUnits) {
    const relic = getRelicById(relicId);
    if (!relic) return;
    const e = relic.apply;

    switch (e.kind) {
      case 'start_mana':
        [...playerUnits, ...enemyUnits].forEach(u => {
          u.mana = Math.max(u.mana ?? 0, e.value);
        });
        break;

      case 'stat_modifier':
      case 'start_coins_hp_penalty':
        // Stat modifier symétrique — appliqué via _applyRelicStats dans _copyUnit
        // géré séparément pour ne pas conflicture avec les passifs
        break;

      case 'random_unit_half_hp': {
        // 1 aléatoire de chaque camp démarre à 50% HP
        const pickRandom = (units) => {
          const alive = units.filter(u => u.hp > 0);
          return alive[Math.floor(Math.random() * alive.length)];
        };
        const pu = pickRandom(playerUnits);
        const eu = pickRandom(enemyUnits);
        if (pu) { pu.hp = Math.max(1, Math.ceil(pu.maxHp * 0.50)); }
        if (eu) { eu.hp = Math.max(1, Math.ceil(eu.maxHp * 0.50)); }
        break;
      }

      case 'top_bst_double_synergy':
        // Marqué sur l'unité — utilisé dans CombatEngine._applyPreEffects
        const bst = (u) => (u.atk??0)+(u.spa??0)+(u.def??0)+(u.spd_def??0)+(u.spd??0)+(u.hp??0);
        const topP = [...playerUnits].sort((a,b) => bst(b)-bst(a))[0];
        const topE = [...enemyUnits].sort((a,b) => bst(b)-bst(a))[0];
        if (topP) topP._doubleSynergyBonus = true;
        if (topE) topE._doubleSynergyBonus = true;
        break;
    }
  },

  // ── Applique les modificateurs de stats de la relique sur une unité ────────
  // Appelé dans CombatUI juste avant de passer les unités au moteur
  applyStatModifier(relicId, unit) {
    const relic = getRelicById(relicId);
    if (!relic) return;
    const e = relic.apply;

    if (e.kind === 'stat_modifier' || e.kind === 'start_coins_hp_penalty') {
      const stats = e.stats ?? {};
      Object.entries(stats).forEach(([s, mult]) => {
        if (s === 'hp') {
          unit.hp     = Math.max(1, Math.round(unit.hp * mult));
          unit.maxHp  = unit.hp;
        } else {
          unit[s] = Math.max(1, Math.round((unit[s] ?? 0) * mult));
        }
      });
    }
  },

  // ── Modifie getActiveSynergies selon la relique ────────────────────────────
  // Retourne les synergies avec les modifications de la relique appliquées
  modifySynergies(relicId, synergies, fieldUnits) {
    const relic = getRelicById(relicId);
    if (!relic) return synergies;
    const e = relic.apply;

    switch (e.kind) {
      case 'top_synergy_boost': {
        // La synergie avec le tier le plus élevé est boostée ×1.5
        if (!synergies.length) return synergies;
        const sorted  = [...synergies].sort((a,b) => (b.tier - a.tier) || (b.count - a.count));
        const topType = sorted[0].type;
        return synergies.map(s => s.type === topType
          ? { ...s, _relicBoost: e.mult ?? 1.5 }
          : s);
      }

      case 'synergy_threshold': {
        // Seuils réduits de |delta| — recalcule les tiers
        const delta = Math.abs(e.delta ?? 1);
        return synergies.map(s => {
          const newCount = s.count + delta;
          const newTier  = newCount >= 3 ? 3 : newCount >= 2 ? 2 : s.tier;
          return newTier > s.tier ? { ...s, tier: newTier } : s;
        });
      }

      default:
        return synergies;
    }
  },

  // ── Calcule les counts de synergies avec monotype_double ──────────────────
  modifyTypeCounts(relicId, typeCounts, fieldUnits) {
    const relic = getRelicById(relicId);
    if (!relic) return typeCounts;
    if (relic.apply.kind !== 'monotype_double') return typeCounts;

    const result = { ...typeCounts };
    fieldUnits.filter(Boolean).forEach(unit => {
      // Monotype = un seul type unique
      const unique = [...new Set(unit.types)];
      if (unique.length === 1) {
        result[unique[0]] = (result[unique[0]] ?? 0) + 1; // compte +1 de plus
      }
    });
    return result;
  },

  // ── Sablier : vérifie si le combat doit s'arrêter ─────────────────────────
  checkActionLimit(relicId, actionCount, playerUnits, enemyUnits) {
    const relic = getRelicById(relicId);
    if (!relic || relic.apply.kind !== 'action_limit') return null;
    const limit = relic.apply.value ?? 25;
    if (actionCount < limit) return null;

    // Calcule HP restants de chaque camp
    const playerHp = playerUnits.reduce((s, u) => s + Math.max(0, u.hp), 0);
    const enemyHp  = enemyUnits.reduce((s, u) => s + Math.max(0, u.hp), 0);

    if (playerHp > enemyHp) return 'player';
    if (enemyHp > playerHp) return 'enemy';
    return 'draw'; // Égalité → défaite du joueur
  },

  // ── Revanche : déclenche l'ultime si mana ≥ seuil à la mort ───────────────
  checkDeathUltimate(relicId, unit) {
    const relic = getRelicById(relicId);
    if (!relic || relic.apply.kind !== 'death_ultimate') return false;
    return (unit.mana ?? 0) >= (relic.apply.mana_threshold ?? 50);
  },
};
