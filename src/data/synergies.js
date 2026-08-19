// ─────────────────────────────────────────────────────────────────────────────
// synergies.js
// ─────────────────────────────────────────────────────────────────────────────

import { getEffectiveStats, getTeamAuras } from './items.js';
import { getBSTTier }       from './runState.js';
import { GRID_COLS, GRID_ROWS } from '../board.js';

// ─────────────────────────────────────────────────────────────────────────────
// SYSTÈME DE COINS (corners) — base du nouveau système de synergies par placement
// Chaque carte a 4 coins colorés par type, indexés dans le sens horaire :
//   [0]=haut-gauche (TL), [1]=haut-droit (TR), [2]=bas-droit (BR), [3]=bas-gauche (BL)
//   - Monotype  : les 4 coins = le type
//   - Bi-type   : 2 coins de chaque type, répartis ALÉATOIREMENT sur les 4 positions
// Les coins sont (re)tirés à la création (starter/capture) et à l'évolution.
// ─────────────────────────────────────────────────────────────────────────────
export function assignCorners(unit, rng = Math.random) {
  const types = unit?.types ?? [];
  let pool;
  if (types.length >= 2) {
    pool = [types[0], types[0], types[1], types[1]];
  } else {
    const t = types[0] ?? 'Normal';
    pool = [t, t, t, t];
  }
  // Mélange Fisher-Yates (seul utile pour les bi-types)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;   // [TL, TR, BR, BL]
}

// S'assure qu'une unité a des coins (rétro-compat : assigne si absent). Ne re-tire PAS.
export function ensureCorners(unit, rng = Math.random) {
  if (unit && (!Array.isArray(unit.corners) || unit.corners.length !== 4)) {
    unit.corners = assignCorners(unit, rng);
  }
  return unit?.corners ?? null;
}

export const SYNERGIES = {
  "Feu": {
    icon: "🔥", color: 0xf08030,
    seuil2: { label: "+15% ATK + SP.ATK", statBonus: { atk: 1.15, spa: 1.15 }, effect: null },
    seuil3: { label: "+30% ATK + SP.ATK + Brûlure", statBonus: { atk: 1.30, spa: 1.30 }, effect: "burn" },
  },
  "Eau": {
    icon: "💧", color: 0x6890f0,
    seuil2: { label: "+15% DEF + SP.DEF", statBonus: { def: 1.15, spd_def: 1.15 }, effect: null },
    seuil3: { label: "+30% DEF + SP.DEF + Régén.", statBonus: { def: 1.30, spd_def: 1.30 }, effect: "regen" },
  },
  "Plante": {
    icon: "🌿", color: 0x78c850,
    seuil2: { label: "+15% HP", statBonus: { hp: 1.15 }, effect: null },
    seuil3: { label: "+30% HP + Poison", statBonus: { hp: 1.30 }, effect: "poison" },
  },
  "Électrik": {
    icon: "⚡", color: 0xf8d030,
    seuil2: { label: "+15% VIT", statBonus: { spd: 1.15 }, effect: null },
    seuil3: { label: "+30% VIT + Paralysie", statBonus: { spd: 1.30 }, effect: "paralyze" },
  },
  "Psy": {
    icon: "🔮", color: 0xf85888,
    seuil2: { label: "+15% SP.ATK", statBonus: { spa: 1.15 }, effect: null },
    seuil3: { label: "+30% SP.ATK + Confusion", statBonus: { spa: 1.30 }, effect: "confuse" },
  },
  "Roche": {
    icon: "🪨", color: 0xb8a038,
    seuil2: { label: "+20% DEF", statBonus: { def: 1.20 }, effect: null },
    seuil3: { label: "+40% DEF + Bouclier d'équipe", statBonus: { def: 1.40 }, effect: "armor" },
  },
  "Sol": {
    icon: "🏔", color: 0xe0c068,
    seuil2: { label: "+15% DEF + HP", statBonus: { def: 1.15, hp: 1.10 }, effect: null },
    seuil3: { label: "+25% DEF + HP + Tremblement", statBonus: { def: 1.25, hp: 1.20 }, effect: "quake" },
  },
  "Vol": {
    icon: "🦅", color: 0xa890f0,
    seuil2: { label: "+20% VIT", statBonus: { spd: 1.20 }, effect: null },
    seuil3: { label: "+35% VIT + Esquive", statBonus: { spd: 1.35 }, effect: "dodge" },
  },
  "Combat": {
    icon: "🥊", color: 0xc03028,
    seuil2: { label: "+20% ATK", statBonus: { atk: 1.20 }, effect: null },
    seuil3: { label: "+40% ATK + Coup Critique", statBonus: { atk: 1.40 }, effect: "crit" },
  },
  "Poison": {
    icon: "☠️", color: 0xa040a0,
    seuil2: { label: "+15% SP.ATK", statBonus: { spa: 1.15 }, effect: null },
    seuil3: { label: "+25% SP.ATK + Poison", statBonus: { spa: 1.25 }, effect: "poison" },
  },
  "Glace": {
    icon: "❄️", color: 0x98d8d8,
    seuil2: { label: "+15% SP.DEF", statBonus: { spd_def: 1.15 }, effect: null },
    seuil3: { label: "+30% SP.DEF + Gel", statBonus: { spd_def: 1.30 }, effect: "freeze" },
  },
  "Spectre": {
    icon: "👻", color: 0x705898,
    seuil2: { label: "+20% SP.ATK", statBonus: { spa: 1.20 }, effect: null },
    seuil3: { label: "+35% SP.ATK + Malédiction", statBonus: { spa: 1.35 }, effect: "curse" },
  },
  "Dragon": {
    icon: "🐉", color: 0x7038f8,
    seuil2: { label: "+20% ATK + SP.ATK", statBonus: { atk: 1.20, spa: 1.20 }, effect: null },
    seuil3: { label: "+35% ATK + SP.ATK + Rage", statBonus: { atk: 1.35, spa: 1.35 }, effect: "rage" },
  },
  "Normal": {
    icon: "⭐", color: 0xa8a878,
    seuil2: { label: "+10% toutes stats", statBonus: { hp:1.10, atk:1.10, spa:1.10, def:1.10, spd_def:1.10, spd:1.10 }, effect: null },
    seuil3: { label: "+20% toutes stats", statBonus: { hp:1.20, atk:1.20, spa:1.20, def:1.20, spd_def:1.20, spd:1.20 }, effect: null },
  },
  "Fée": {
    icon: "🧚", color: 0xee99ac,
    seuil2: { label: "+15% SP.DEF + HP", statBonus: { spd_def: 1.15, hp: 1.10 }, effect: null },
    seuil3: { label: "+25% SP.DEF + HP + Charme", statBonus: { spd_def: 1.25, hp: 1.20 }, effect: "charm" },
  },
  "Insecte": {
    icon: "🦋", color: 0xa8b820,
    // Bonus tous-stats additionnel par palier (1★/2★/3★) pour compenser leurs stats faibles
    allStatsPerTier: [1.05, 1.10, 1.15],
    seuil2: { label: "+15% VIT + ATK", statBonus: { spd: 1.15, atk: 1.15 }, effect: null },
    seuil3: { label: "+25% VIT + ATK + Essaim", statBonus: { spd: 1.25, atk: 1.25 }, effect: "swarm" },
  },
  "Acier": {
    icon: "⚙️", color: 0xb8b8d0,
    seuil2: { label: "+25% DEF", statBonus: { def: 1.25 }, effect: null },
    seuil3: { label: "+40% DEF + SP.DEF + Armure", statBonus: { def: 1.40, spd_def: 1.30 }, effect: "iron" },
  },
  "Ténèbres": {
    icon: "🌑", color: 0x705848,
    seuil2: { label: "+20% ATK", statBonus: { atk: 1.20 }, effect: null },
    seuil3: { label: "+35% ATK + Intimidation", statBonus: { atk: 1.35 }, effect: "intimidate" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dérive les données d'un palier (1★/2★/3★) depuis seuil2/seuil3.
//   1★ = ancien seuil2 (inchangé)
//   3★ = ancien seuil3, bonus légèrement renforcé (+15% sur la part de bonus) + effet
//   2★ = interpolation entre les deux (pas d'effet spécial)
// ─────────────────────────────────────────────────────────────────────────────
const STAT_LABELS = { hp:'PV', atk:'ATK', spa:'SP.ATK', def:'DEF', spd_def:'SP.DEF', spd:'VIT' };

// Équilibrage : sauf Normal/Insecte/Dragon, chaque synergie booste 2 stats
// identiques à 10/25/35 % (1★/2★/3★). L'effet spécial reste au 3★.
const UNIFORM_TIERS = [1.10, 1.25, 1.35];
const SYNERGY_STAT_PAIRS = {
  "Feu":      ['atk', 'spa'],
  "Eau":      ['def', 'spd_def'],
  "Plante":   ['hp',  'def'],
  "Électrik": ['spd', 'spa'],
  "Psy":      ['spa', 'spd_def'],
  "Roche":    ['def', 'hp'],
  "Sol":      ['def', 'hp'],
  "Vol":      ['spd', 'atk'],
  "Combat":   ['atk', 'def'],
  "Poison":   ['spa', 'def'],
  "Glace":    ['spd_def', 'spa'],
  "Spectre":  ['spa', 'spd'],
  "Fée":      ['spd_def', 'hp'],
  "Acier":    ['def', 'spd_def'],
  "Ténèbres": ['atk', 'spd'],
};

function _interp(a, b, t) { return a + (b - a) * t; }

function _deriveTierData(synergy, tier, type = null) {
  const s2 = synergy.seuil2 ?? { statBonus:{}, effect:null };
  const s3 = synergy.seuil3 ?? s2;
  let statBonus = {};
  let effect = null;

  const pair = type ? SYNERGY_STAT_PAIRS[type] : null;
  if (pair) {
    // Synergie équilibrée : 2 stats à la valeur uniforme du palier
    const mult = UNIFORM_TIERS[tier - 1] ?? 1;
    pair.forEach(k => { statBonus[k] = mult; });
    if (tier === 3) effect = s3.effect ?? null;
  } else if (tier === 1) {
    statBonus = { ...(s2.statBonus ?? {}) };
  } else if (tier === 3) {
    // 3★ : seuil3 renforcé de 15 % sur la part de bonus
    Object.entries(s3.statBonus ?? {}).forEach(([k, v]) => {
      statBonus[k] = Math.round((1 + (v - 1) * 1.15) * 1000) / 1000;
    });
    effect = s3.effect ?? null;
  } else {
    // 2★ : interpolation entre seuil2 et seuil3
    const keys = new Set([...Object.keys(s2.statBonus ?? {}), ...Object.keys(s3.statBonus ?? {})]);
    keys.forEach(k => {
      const a = s2.statBonus?.[k] ?? 1;
      const b = s3.statBonus?.[k] ?? 1;
      statBonus[k] = Math.round(_interp(a, b, 0.5) * 1000) / 1000;
    });
  }

  // Bonus tous-stats additionnel par palier (ex. Insecte : 1★+10% / 2★+20% / 3★+30%)
  const allMult = synergy.allStatsPerTier?.[tier - 1];
  if (allMult && allMult !== 1) {
    const ALL = ['hp', 'atk', 'spa', 'def', 'spd_def', 'spd'];
    ALL.forEach(k => {
      const cur = statBonus[k] ?? 1;
      statBonus[k] = Math.round(cur * allMult * 1000) / 1000;  // se combine au bonus existant
    });
  }

  // Libellé généré depuis statBonus
  const parts = Object.entries(statBonus).map(([k, v]) => {
    const pct = Math.round((v - 1) * 100);
    return `+${pct}% ${STAT_LABELS[k] ?? k}`;
  });
  if (effect) parts.push(_effectLabel(effect));
  return { statBonus, effect, label: parts.join(', ') || '—' };
}

function _effectLabel(effect) {
  const M = { burn:'Brûlure', freeze:'Gel', poison:'Poison', paralyze:'Paralysie',
    stun:'Étourdissement', heal:'Soin', shield:'Bouclier', intimidate:'Intimidation' };
  return M[effect] ?? effect;
}

// Bonus d'un type à un palier donné (1/2/3★), valeurs rééquilibrées incluses.
// Utilisé par l'encyclopédie pour afficher des bonus toujours à jour.
export function getSynergyTierData(type, tier) {
  const synergy = SYNERGIES[type];
  if (!synergy) return null;
  return _deriveTierData(synergy, tier, type);
}

// ─────────────────────────────────────────────────────────────────────────────
// getActiveSynergies — synergies par PLACEMENT (contacts entre coins)
//   Contact = un couple de coins du même type qui se touchent (adjacence
//   horizontale, verticale ou diagonale). Les contacts s'accumulent sur tout
//   le plateau : 1 contact → 1★ · 2 → 2★ · 4 → 3★  (catalyseur abaisse le 3★).
//   Repli temporaire sur le comptage pour les unités sans position (ennemis Ph.3).
// ─────────────────────────────────────────────────────────────────────────────
export function getActiveSynergies(fieldUnits, relicId = null) {
  const units = (fieldUnits ?? []).filter(Boolean);

  // Seuils de contacts (1 contact → 1★, 2 → 2★, 4 → 3★ ; catalyseur abaisse le 3★)
  const need = relicId === 'catalyseur'
    ? { t1: 1, t2: 2, t3: 3 }
    : { t1: 1, t2: 2, t3: 4 };

  // Unités positionnées sur la grille (col/row numériques)
  const positioned = units.filter(u =>
    Number.isInteger(u.col) && Number.isInteger(u.row));

  // ── Repli : aucune position fiable → ancien comptage (ennemis avant Ph.3) ──
  if (positioned.length < 2) {
    return _legacyCountSynergies(units, relicId);
  }

  // Construit la grille [col][row]
  const grid = {};
  positioned.forEach(u => {
    grid[u.col] = grid[u.col] ?? {};
    grid[u.col][u.row] = u;
  });

  // Pour chaque type, calcule la convergence MAX à un sommet de la grille
  const cornerOf = (u, idx) => {
    const c = ensureCorners(u);
    return c?.[idx] ?? null;
  };
  // Cristal Pur : un contact impliquant un monotype compte double
  const isMono = (u) => new Set(u.types ?? []).size === 1;
  const contactWeight = (a, b) =>
    (relicId === 'cristal_pur' && (isMono(a) || isMono(b))) ? 2 : 1;

  // Compte les CONTACTS : couples de coins du même type qui se touchent.
  // Chaque adjacence (horizontale, verticale, diagonale) est examinée une seule fois
  // depuis la carte en haut/gauche du couple.
  const contacts = {};  // type -> nombre de contacts (pondérés)
  const addContact = (a, b, ca, cb) => {
    const ta = cornerOf(a, ca), tb = cornerOf(b, cb);
    if (ta && ta === tb) contacts[ta] = (contacts[ta] ?? 0) + contactWeight(a, b);
  };

  positioned.forEach(a => {
    const cx = a.col, cy = a.row;
    const right = grid[cx + 1]?.[cy];
    const down  = grid[cx]?.[cy + 1];
    const dr    = grid[cx + 1]?.[cy + 1];
    const dl    = grid[cx - 1]?.[cy + 1];
    if (right) { addContact(a, right, 1, 0); addContact(a, right, 2, 3); } // TR↔TL, BR↔BL
    if (down)  { addContact(a, down,  3, 0); addContact(a, down,  2, 1); } // BL↔TL, BR↔TR
    if (dr)    { addContact(a, dr,    2, 0); }                              // BR↔TL (diag ↘)
    if (dl)    { addContact(a, dl,    3, 1); }                              // BL↔TR (diag ↙)
  });

  // Contacts → palier
  const active = [];
  Object.entries(contacts).forEach(([type, n]) => {
    const synergy = SYNERGIES[type];
    if (!synergy) return;
    let tier = 0;
    if (n >= need.t3) tier = 3;
    else if (n >= need.t2) tier = 2;
    else if (n >= need.t1) tier = 1;
    if (tier === 0) return;
    const data = _deriveTierData(synergy, tier, type);
    active.push({
      type, icon: synergy.icon, color: synergy.color,
      count: n, tier,
      label: data.label, statBonus: data.statBonus, effect: data.effect,
    });
  });
  return active;
}

// Ancien système de comptage (repli pour unités sans position)
function _legacyCountSynergies(units, relicId = null) {
  const typeCounts = {};
  units.forEach(unit => {
    const weight = getBSTTier(unit) >= 5 ? 2 : 1;
    const isMono = new Set(unit.types ?? []).size === 1;
    const cristalBonus = (relicId === 'cristal_pur' && isMono) ? 1 : 0;
    (unit.types ?? []).forEach(type => {
      typeCounts[type] = (typeCounts[type] ?? 0) + weight + cristalBonus;
    });
  });
  const need = relicId === 'catalyseur' ? { t1: 1, t2: 2, t3: 3 } : { t1: 2, t2: 3, t3: 4 };
  const active = [];
  Object.entries(typeCounts).forEach(([type, count]) => {
    const synergy = SYNERGIES[type];
    if (!synergy) return;
    let tier = 0;
    if (count >= need.t3) tier = 3;
    else if (count >= need.t2) tier = 2;
    else if (count >= need.t1) tier = 1;
    if (tier === 0) return;
    const data = _deriveTierData(synergy, tier, type);
    active.push({
      type, icon: synergy.icon, color: synergy.color,
      count, tier,
      label: data.label, statBonus: data.statBonus, effect: data.effect,
    });
  });
  return active;
}

// ─────────────────────────────────────────────────────────────────────────────
// getFullStats — empile base → objet → synergies
// Retourne les trois niveaux + métadonnées pour la toile SVG
// ─────────────────────────────────────────────────────────────────────────────
export function getFullStats(unit, fieldUnits = [], meta = null, relicId = null, talentEffects = []) {
  const base     = { ...(unit.stats ?? {}) };
  const withItem = getEffectiveStats(unit, meta);   // base + niveau + objet

  // ── Couche AURA D'OBJET (totems : bonus à toute l'équipe) ──────────────────
  // Appliquée après l'objet personnel et avant les synergies. Les auras sont
  // apportées par les objets portés par N'IMPORTE QUELLE unité du terrain, y
  // compris celle-ci.
  const teamAuras = getTeamAuras(fieldUnits.filter(Boolean));
  const auraBoosted = new Set();
  Object.entries(teamAuras).forEach(([stat, mult]) => {
    if (withItem[stat] != null) {
      withItem[stat] = Math.round(withItem[stat] * mult);
      auraBoosted.add(stat);
    }
  });

  // Bonus de synergies applicables à cette unité
  // (relicId pour que catalyseur/cristal_pur affectent les seuils)
  const rid        = relicId ?? unit._relicId ?? null;
  const activeSyns = getActiveSynergies(fieldUnits.filter(Boolean), rid);
  const synBonus   = {};

  // Bonus de synergies appliqués à TOUTE la composition
  // (pas seulement aux pokémons du type déclencheur)
  activeSyns.forEach(syn => {
    if (!syn.statBonus) return;
    Object.entries(syn.statBonus).forEach(([stat, mult]) => {
      synBonus[stat] = (synBonus[stat] ?? 1) * mult;
    });
  });

  const withSynergy   = { ...withItem };
  const synergyBoosted = new Set();

  // Miroir : ×1.5 sur tous les bonus synergies
  // Couronne : ×2 sur les bonus synergies du top BST
  const miroirMult   = unit._relicId === 'miroir' ? 1.5 : 1;
  const couronneMult = unit._doubleSynergyBonus   ? 2   : 1;
  Object.entries(synBonus).forEach(([stat, mult]) => {
    if (withSynergy[stat] != null) {
      const finalMult = 1 + (mult - 1) * miroirMult * couronneMult;
      withSynergy[stat] = Math.round(withSynergy[stat] * finalMult);
      synergyBoosted.add(stat);
    }
  });

  const itemBoosted = new Set(
    Object.keys(withItem).filter(k => withItem[k] !== base[k])
  );

  // ── Couche TALENT (affichage prép ; en combat le moteur applique les talents) ──
  // On ne l'applique que si des effets de talents sont fournis (prép). En combat,
  // talentEffects est vide → withTalent == withSynergy, et le moteur applique seul.
  const withTalent    = { ...withSynergy };
  const talentBoosted = new Set();
  const ALL_STATS = ['hp','atk','spa','def','spd_def','spd'];
  const tMult = {};
  const addT = (stat, m) => { tMult[stat] = (tMult[stat] ?? 1) * m; };
  (talentEffects ?? []).forEach(e => {
    if (!e || !(unit.types ?? []).includes(e.type)) return;
    switch (e.kind) {
      case 'type_stat':       addT(e.stat, e.mult); break;
      case 'type_dual_stat':  (e.stats ?? []).forEach(s => addT(s, e.mult)); break;
      case 'type_boost_highest': {
        const top = Object.entries(base).sort((a,b) => b[1]-a[1])[0]?.[0];
        if (top) addT(top, e.mult);
        break;
      }
      case 'type_stack_per_type': {
        const distinct = new Set(fieldUnits.filter(Boolean).flatMap(u => u.types ?? [])).size;
        ALL_STATS.forEach(s => addT(s, 1 + (e.per_type ?? 0) * distinct));
        break;
      }
      case 'type_stack_per_ally': {
        const allies = fieldUnits.filter(Boolean).filter(u => (u.types ?? []).includes(e.type)).length;
        ALL_STATS.forEach(s => addT(s, 1 + (e.per ?? e.per_ally ?? 0) * allies));
        break;
      }
      // Les autres effets (proc, regen, revive, resilience, conditionnels…) sont
      // dynamiques et gérés en combat, pas affichés comme bonus de stat fixe.
    }
  });
  Object.entries(tMult).forEach(([stat, m]) => {
    if (m !== 1 && withTalent[stat] != null) {
      withTalent[stat] = Math.round(withTalent[stat] * m);
      talentBoosted.add(stat);
    }
  });

  // Couleur de synergies dominante (premier type synergique actif pour cette unité)
  const activeSynForUnit = activeSyns.filter(s => unit.types?.includes(s.type));
  const synColor = activeSynForUnit.length
    ? '#' + activeSynForUnit[0].color.toString(16).padStart(6, '0')
    : null;

  return {
    base,
    withItem,
    withSynergy,       // stats finales pour le combat (synergie seule ; talents appliqués par le moteur)
    withTalent,        // synergie + talents (pour l'affichage en prép)
    itemBoosted,       // Set<statKey>
    synergyBoosted,    // Set<statKey>
    talentBoosted,     // Set<statKey>
    synColor,          // CSS color string ou null
    activeSynForUnit,  // synergies actives pour cette unité
  };
}