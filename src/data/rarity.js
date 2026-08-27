// ─────────────────────────────────────────────────────────────────────────────
// rarity.js — Système de rareté partagé (objets + runes)
// Source unique des paliers, facteurs de scaling, poids de tirage et couleurs.
// ─────────────────────────────────────────────────────────────────────────────
//
// Règle de scaling (validée) : le facteur multiplie la MAGNITUDE du bonus,
// c'est-à-dire la seule part qui représente le boost.
//   - statBonus / teamAura, stockés sous forme 1+d  ->  1 + d * facteur
//     ex. 1.30 (delta 0.30) en légendaire : 1 + 0.30*1.3 = 1.39
//   - champ "taux", où la valeur EST la magnitude (reviveRate 0.50, rate 0.25)
//     -> valeur * facteur, plafonné à 1.0
//     ex. 0.50 -> 0.65,  0.25 -> 0.325
// Ne jamais toucher : les conditions de déclenchement (threshold), les filtres
// (typeFilter), les déclencheurs booléens (setsWeather, levelBonus).

// ── Paliers, dans l'ordre croissant ─────────────────────────────────────────
export const RARITY_TIERS = ['normal', 'rare', 'epique', 'legendaire'];

// ── Facteur de scaling appliqué à la magnitude ──────────────────────────────
export const RARITY_FACTOR = {
  normal:     1.0,
  rare:       1.1,
  epique:     1.2,
  legendaire: 1.3,
};

// ── Métadonnées d'affichage ─────────────────────────────────────────────────
// Le liseré coloré est le socle, empilé par palier côté CSS. `pips` est l'indice
// redondant non-coloré (1 à 4) pour l'accessibilité daltonienne.
export const RARITY_META = {
  normal:     { label: 'Normal',     color: '#9aa0a6', pips: 1 },
  rare:       { label: 'Rare',       color: '#4a90d9', pips: 2 },
  epique:     { label: 'Épique',     color: '#9b59b6', pips: 3 },
  legendaire: { label: 'Légendaire', color: '#ffd700', pips: 4 },
};

// ── Rareté des RUNES : déterministe selon la difficulté de la run terminée ───
// (Choix de design : finir en X garantit le palier correspondant.)
export const RUNE_RARITY_BY_DIFFICULTY = {
  easy:   'normal',
  normal: 'rare',
  hard:   'epique',
  expert: 'legendaire',
};

// ── Tirage de rareté des OBJETS à la génération ─────────────────────────────
// Poids de base. La stat de chance décale les poids vers le haut.
export const RARITY_WEIGHTS_BASE = {
  normal:     60,
  rare:       28,
  epique:     10,
  legendaire: 2,
};

// Déplacement de poids par point de chance (documenté, pas de nombre magique).
export const LUCK_SHIFT = {
  normalPerPoint:     3,   // retiré du poids "normal" par point de chance
  rarePerPoint:       2,   // ajouté au poids "rare"
  epiquePerPoint:     1,   // ajouté au poids "épique"
  legendairePer2Pts:  1,   // +1 poids "légendaire" tous les 2 points
};
// Plafond dur du poids légendaire : la chance ne doit jamais banaliser le doré.
export const LEGENDARY_WEIGHT_CAP = 12;

// ── Champs traités comme des "taux" (la valeur entière est la magnitude) ─────
const RATE_FIELDS = ['reviveRate', 'regenRate'];

// ── Objets exemptés de rareté (effet booléen sans magnitude scalable) ───────
// super_bonbon : +20 niveaux, pas de magnitude à scaler.
// Les roches météo ne portent aucun champ scalable (durée fixée dans weather.js) :
// tant qu'on ne leur ajoute pas un champ `weatherTurns`, elles restent inchangées.
const RARITY_EXEMPT_IDS = ['super_bonbon'];

// ── Helpers ─────────────────────────────────────────────────────────────────
function scaleMagnitudeMap(map, factor) {
  // { stat: 1+d } -> { stat: 1 + d*factor }
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = 1 + (v - 1) * factor;
  }
  return out;
}

// Tire un palier de rareté. `luck` (>= 0) décale les poids vers le haut.
export function rollRarity(luck = 0) {
  const shift = Math.max(0, luck);
  const w = {
    normal:     Math.max(1, RARITY_WEIGHTS_BASE.normal - shift * LUCK_SHIFT.normalPerPoint),
    rare:       RARITY_WEIGHTS_BASE.rare   + shift * LUCK_SHIFT.rarePerPoint,
    epique:     RARITY_WEIGHTS_BASE.epique + shift * LUCK_SHIFT.epiquePerPoint,
    legendaire: Math.min(
      LEGENDARY_WEIGHT_CAP,
      RARITY_WEIGHTS_BASE.legendaire + Math.floor(shift / 2) * LUCK_SHIFT.legendairePer2Pts,
    ),
  };
  const total = RARITY_TIERS.reduce((s, t) => s + w[t], 0);
  let r = Math.random() * total;
  for (const t of RARITY_TIERS) {
    r -= w[t];
    if (r < 0) return t;
  }
  return 'normal';
}

// ─────────────────────────────────────────────────────────────────────────────
// scaleItemByRarity(def, rarity)
// Renvoie une COPIE de la définition avec les magnitudes scalées par la rareté.
// Ne mute JAMAIS ITEMS[id]. 'normal' et objets exemptés renvoient la def telle
// quelle. Champs figés (threshold, typeFilter, setsWeather, levelBonus, prix,
// méta) : préservés par la copie, jamais scalés.
// ─────────────────────────────────────────────────────────────────────────────
export function scaleItemByRarity(def, rarity = 'normal') {
  if (!def) return def;
  if (rarity === 'normal' || !RARITY_FACTOR[rarity]) return def;
  if (RARITY_EXEMPT_IDS.includes(def.id)) return def;

  const factor = RARITY_FACTOR[rarity];
  const out = { ...def };

  if (def.statBonus) out.statBonus = scaleMagnitudeMap(def.statBonus, factor);
  if (def.teamAura)  out.teamAura  = scaleMagnitudeMap(def.teamAura,  factor);

  for (const f of RATE_FIELDS) {
    if (typeof def[f] === 'number') out[f] = Math.min(1, def[f] * factor);
  }

  // emergencyHeal : on scale `rate`, on fige `threshold` (condition de déclenchement).
  if (def.emergencyHeal && typeof def.emergencyHeal.rate === 'number') {
    out.emergencyHeal = {
      ...def.emergencyHeal,
      rate: Math.min(1, def.emergencyHeal.rate * factor),
    };
  }

  if (typeof def.weatherTurns === 'number') {
    out.weatherTurns = Math.ceil(def.weatherTurns * factor);
  }

  out.rarity = rarity;
  return out;
}