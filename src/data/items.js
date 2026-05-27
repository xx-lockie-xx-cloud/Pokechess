// ─────────────────────────────────────────────────────────────────────────────
// items.js — Catalogue des objets achetables et équipables
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// getEffectiveStats(unit, meta?) — stats avec bonus niveau + bonus objet.
// Chaîne : base → ×niveau → ×objet
// ─────────────────────────────────────────────────────────────────────────────
export function getEffectiveStats(unit, meta = null) {
  const base = { ...(unit.stats ?? {}) };

  // Bonus de niveau (persistant entre les runs)
  const level     = meta?.pokemonLevels?.[unit.id] ?? unit.level ?? 1;
  const levelMult = level > 1 ? 1 + (level - 1) * 0.005 : 1;
  const withLevel = {};
  for (const [k, v] of Object.entries(base)) {
    withLevel[k] = level > 1 ? Math.round(v * levelMult) : v;
  }

  const item = unit.heldItem;
  if (!item?.statBonus) return withLevel;

  if (item.typeFilter) {
    const types = unit.types ?? [];
    if (!types.includes(item.typeFilter)) return withLevel;
  }

  const result = { ...withLevel };
  for (const [stat, mult] of Object.entries(item.statBonus)) {
    if (result[stat] != null) {
      result[stat] = Math.round(result[stat] * mult);
    }
  }
  return result;
}

export const ITEMS = {

  // ── Consommables ────────────────────────────────────────────────────────────
  // (Poké Ball supprimée — achat direct en pièces selon le tier du pokémon)
  rappel: {
    id: 'rappel', name: 'Rappel', emoji: '💊', price: 5,
    type: 'consumable',
    description: 'Ranime un Pokémon K.O. avec 50% HP.',
  },
  super_bonbon: {
    id: 'super_bonbon', name: 'Super Bonbon', emoji: '🍬', price: 6,
    type: 'consumable',
    description: 'Fait évoluer un Pokémon immédiatement.',
  },

  // ── Objets typés (+30% ATK et SP.ATK pour le bon type) ─────────────────────
  eau_mystique: {
    id: 'eau_mystique', name: 'Eau Mystique', emoji: '🌊', price: 4,
    type: 'equippable', typeFilter: 'Eau',
    description: '+30% ATK et SP.ATK (type Eau).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  charbon: {
    id: 'charbon', name: 'Charbon', emoji: '🔥', price: 4,
    type: 'equippable', typeFilter: 'Feu',
    description: '+30% ATK et SP.ATK (type Feu).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  poudre_de_feuille: {
    id: 'poudre_de_feuille', name: 'Encens Fleur', emoji: '🍃', price: 4,
    type: 'equippable', typeFilter: 'Plante',
    description: '+30% ATK et SP.ATK (type Plante).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  aimant: {
    id: 'aimant', name: 'Aimant', emoji: '🧲', price: 4,
    type: 'equippable', typeFilter: 'Électrik',
    description: '+30% ATK et SP.ATK (type Électrik).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  os_dur: {
    id: 'os_dur', name: 'Os Dur', emoji: '🦴', price: 4,
    type: 'equippable', typeFilter: 'Normal',
    description: '+30% ATK et SP.ATK (type Normal).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  venin_toxique: {
    id: 'venin_toxique', name: 'Venin Toxique', emoji: '☠️', price: 4,
    type: 'equippable', typeFilter: 'Poison',
    description: '+30% ATK et SP.ATK (type Poison).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  sable_doux: {
    id: 'sable_doux', name: 'Sable Doux', emoji: '🏜️', price: 4,
    type: 'equippable', typeFilter: 'Sol',
    description: '+30% ATK et SP.ATK (type Sol).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  plaque_mentale: {
    id: 'plaque_mentale', name: 'Plaque Mentale', emoji: '🔮', price: 4,
    type: 'equippable', typeFilter: 'Psy',
    description: '+30% ATK et SP.ATK (type Psy).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  griffe_dure: {
    id: 'griffe_dure', name: 'Griffe Dure', emoji: '🦅', price: 4,
    type: 'equippable', typeFilter: 'Vol',
    description: '+30% ATK et SP.ATK (type Vol).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },

  // ── Objets génériques (stat unique +30%) ────────────────────────────────────
  ceinture_choix: {
    id: 'ceinture_choix', name: 'Ceinture Choix', emoji: '🥊', price: 5,
    type: 'equippable',
    description: '+30% ATK, +15% VIT.',
    statBonus: { atk: 1.30, spd: 1.15 },
  },
  lunettes_choix: {
    id: 'lunettes_choix', name: 'Lunettes Choix', emoji: '🔭', price: 5,
    type: 'equippable',
    description: '+30% SP.ATK, +15% VIT.',
    statBonus: { spa: 1.30, spd: 1.15 },
  },
  bouclier_acier: {
    id: 'bouclier_acier', name: 'Bouclier Acier', emoji: '🛡️', price: 4,
    type: 'equippable',
    description: '+30% DEF.',
    statBonus: { def: 1.30 },
  },
  voile_special: {
    id: 'voile_special', name: 'Voile Spécial', emoji: '💠', price: 4,
    type: 'equippable',
    description: '+30% SP.DEF.',
    statBonus: { spd_def: 1.30 },
  },
  semelles_vitesse: {
    id: 'semelles_vitesse', name: 'Semelles Vitesse', emoji: '👟', price: 4,
    type: 'equippable',
    description: '+30% VIT.',
    statBonus: { spd: 1.30 },
  },

  // ── Objets à effet spécial ──────────────────────────────────────────────────
  restes: {
    id: 'restes', name: 'Restes', emoji: '🍖', price: 4,
    type: 'equippable',
    description: 'Restaure 10% HP max à chaque fin de tour.',
    effect: 'regen', regenRate: 0.10,
  },
  ceinture_expert: {
    id: 'ceinture_expert', name: 'Ceinture Expert', emoji: '🎖️', price: 5,
    type: 'equippable',
    description: '+30% dégâts super efficaces.',
    effect: 'super_effective_boost',
    statBonus: {},
  },
};