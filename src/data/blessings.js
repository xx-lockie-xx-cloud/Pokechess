// ─────────────────────────────────────────────────────────────────────────────
// blessings.js — Bénédictions du Sanctuaire ⛩️
//
// Une bénédiction dure DURATION combats, puis disparaît. Contrairement aux
// reliques (toute l'épopée) et aux objets (permanents mais liés à un porteur),
// elle s'applique à TOUTE l'équipe pendant une fenêtre limitée : c'est un coup
// de pouce ponctuel, pas une orientation de build.
//
// `statMult` réutilise le mécanisme des totems ; `weather` celui des roches ;
// `flags` s'appliquent au setup du combat. Rien de nouveau côté moteur.
//
// Aucun import : module de données pur.
// ─────────────────────────────────────────────────────────────────────────────

export const BLESSING_DURATION = 5;

export const BLESSINGS = {
  fortune: {
    id: 'fortune', name: 'Faveur de Fortune', emoji: '💰', color: '#ffd700',
    desc: '+2 pièces à chaque combat gagné.',
    bonusCoins: 2,
  },
  savoir: {
    id: 'savoir', name: 'Bénédiction du Savoir', emoji: '📖', color: '#74b9ff',
    desc: '+2 niveaux supplémentaires à chaque combat.',
    bonusLevels: 2,
  },
  celerite: {
    id: 'celerite', name: 'Souffle de Célérité', emoji: '🌪️', color: '#55efc4',
    desc: '+20% PV et Vitesse à toute l\'équipe.',
    statMult: { hp: 1.20, spd: 1.20 },
  },
  vigueur: {
    id: 'vigueur', name: 'Vigueur du Colosse', emoji: '💪', color: '#e17055',
    desc: '+20% ATK et DEF à toute l\'équipe.',
    statMult: { atk: 1.20, def: 1.20 },
  },
  esprit: {
    id: 'esprit', name: 'Clarté d\'Esprit', emoji: '🔮', color: '#a29bfe',
    desc: '+20% ATK.SPÉ et DEF.SPÉ à toute l\'équipe.',
    statMult: { spa: 1.20, spd_def: 1.20 },
  },

  // ── Ajouts : mécaniques existantes réutilisées ──────────────────────────
  egide: {
    id: 'egide', name: 'Égide du Gardien', emoji: '🛡️', color: '#4a9eff',
    desc: 'Bouclier de 20% des PV max au début de chaque combat.',
    flags: { shieldRate: 0.20 },
  },
  purete: {
    id: 'purete', name: 'Rituel de Pureté', emoji: '✨', color: '#ffeaa7',
    desc: 'Votre équipe est immunisée aux altérations d\'état.',
    flags: { statusImmune: true },
  },
  renaissance: {
    id: 'renaissance', name: 'Braise de Renaissance', emoji: '🔥', color: '#fd79a8',
    desc: 'Le premier allié à tomber revient avec 40% de ses PV.',
    flags: { reviveRate: 0.40 },
  },
  vengeance: {
    id: 'vengeance', name: 'Serment de Vengeance', emoji: '⚔️', color: '#d63031',
    desc: 'Chaque allié tombé donne +15% ATK aux survivants.',
    flags: { atkOnAllyKo: 0.15 },
  },
};

export function getBlessing(id) {
  return BLESSINGS[id] ?? null;
}

// Tire `count` bénédictions distinctes, en évitant celles déjà actives
export function drawBlessings(count = 3, activeIds = [], rng = Math.random) {
  const pool = Object.values(BLESSINGS).filter(b => !activeIds.includes(b.id));
  const out  = [];
  const copy = [...pool];
  while (out.length < count && copy.length) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

// Multiplicateur cumulé des bénédictions actives pour une stat donnée
export function blessingStatMult(active = [], stat) {
  let mult = 1;
  active.forEach(a => {
    const b = BLESSINGS[a.id];
    const m = b?.statMult?.[stat];
    if (m) mult *= m;
  });
  return mult;
}

// Agrège les flags des bénédictions actives
export function blessingFlags(active = []) {
  const out = {};
  active.forEach(a => Object.assign(out, BLESSINGS[a.id]?.flags ?? {}));
  return out;
}

// Total des bonus numériques (pièces, niveaux)
export function blessingBonus(active = [], key) {
  return active.reduce((sum, a) => sum + (BLESSINGS[a.id]?.[key] ?? 0), 0);
}