// ─────────────────────────────────────────────────────────────────────────────
// items.js — Catalogue des objets achetables et équipables
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// getEffectiveStats(unit, meta?) — stats avec bonus niveau + bonus objet.
// Chaîne : base → ×niveau → ×objet
// ─────────────────────────────────────────────────────────────────────────────
export function getEffectiveStats(unit, meta = null) {
  const base = { ...(unit.stats ?? {}) };

  // Bonus de niveau (persistant entre les runs), plus les niveaux TEMPORAIRES
  // accordés par un objet (Super Bonbon). Ces derniers ne sont pas sauvegardés
  // et disparaissent si l'objet est retiré.
  //
  // Le total peut DÉPASSER 100 (un Pokémon niveau 100 avec un Super Bonbon
  // compte comme 120) : le plafond de 100 ne concerne que le niveau ACQUIS,
  // appliqué dans SaveManager.gainPokemonLevel. Un Pokémon niveau 90 équipé
  // affiche donc 110 tout en pouvant encore progresser jusqu'à 100.
  const baseLevel = meta?.pokemonLevels?.[unit.id] ?? unit.level ?? 1;
  const itemLevel = unit.heldItem?.levelBonus ?? 0;
  const level     = baseLevel + itemLevel;
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
    description: 'Ranime une fois par combat le porteur K.O. avec 50% HP.',
    reviveRate: 0.50,   // effet lu par CombatEngine (résurrection unique, objet non consommé)
  },
  super_bonbon: {
    id: 'super_bonbon', name: 'Super Bonbon', emoji: '🍬', price: 3,
    type: 'equippable',
    description: '+20 niveaux au porteur tant qu\'il est équipé.',
    // Niveaux TEMPORAIRES : appliqués dans getEffectiveStats via levelBonus,
    // donc perdus dès que l'objet change de porteur ou est retiré. Rien n'est
    // écrit dans meta.pokemonLevels.
    levelBonus: 20,
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
  // ── Objets d'aura d'équipe (bonus à TOUS les alliés) ────────────────────
  // Prix plus élevé que les objets typés : +10% sur 6 unités pèse plus lourd
  // qu'un +30% sur une seule. Deux exemplaires du MÊME objet ne se cumulent
  // pas (voir getTeamAuras), mais les trois objets différents se cumulent.
  totem_offensif: {
    id: 'totem_offensif', name: 'Totem de Force', emoji: '🗿', price: 7,
    type: 'equippable',
    description: '+10% ATK et DEF à toute l\'équipe.',
    teamAura: { atk: 1.10, def: 1.10 },
  },
  totem_mental: {
    id: 'totem_mental', name: 'Totem Mental', emoji: '🔯', price: 7,
    type: 'equippable',
    description: '+10% SP.ATK et SP.DEF à toute l\'équipe.',
    teamAura: { spa: 1.10, spd_def: 1.10 },
  },
  totem_vital: {
    id: 'totem_vital', name: 'Totem Vital', emoji: '🌀', price: 7,
    type: 'equippable',
    description: '+10% PV et VIT à toute l\'équipe.',
    teamAura: { hp: 1.10, spd: 1.10 },
  },

  // ── Baie de secours ─────────────────────────────────────────────────────
  baie_sitrus: {
    id: 'baie_sitrus', name: 'Baie Sitrus', emoji: '🍊', price: 5,
    type: 'equippable',
    description: 'Rend 25% des PV max en passant sous 50% de PV (une fois).',
    emergencyHeal: { threshold: 0.50, rate: 0.25 },
  },

  // ── Roches météo : posent une météo globale au début du combat ──────────
  roche_chaude: {
    id: 'roche_chaude', name: 'Roche Chaude', emoji: '☀️', price: 6,
    type: 'equippable',
    description: 'Déclenche Zénith au début du combat (10 tours).',
    setsWeather: 'sun',
  },
  roche_humide: {
    id: 'roche_humide', name: 'Roche Humide', emoji: '💧', price: 6,
    type: 'equippable',
    description: 'Déclenche Pluie au début du combat (10 tours).',
    setsWeather: 'rain',
  },
  roche_lisse: {
    id: 'roche_lisse', name: 'Roche Lisse', emoji: '🏜️', price: 6,
    type: 'equippable',
    description: 'Déclenche Tempête de sable au début du combat (10 tours).',
    setsWeather: 'sandstorm',
  },
  roche_glace: {
    id: 'roche_glace', name: 'Roche Glace', emoji: '🧊', price: 6,
    type: 'equippable',
    description: 'Déclenche Grêle au début du combat (10 tours).',
    setsWeather: 'hail',
  },
  roche_obscure: {
    id: 'roche_obscure', name: 'Roche Obscure', emoji: '🌑', price: 6,
    type: 'equippable',
    description: 'Déclenche Nuit Noire au début du combat (10 tours).',
    setsWeather: 'darkness',
  },

  // ── Objets typés complémentaires (uniformisation des 18 types) ──────────
  glacon_eternel: {
    id: 'glacon_eternel', name: 'Glaçon Éternel', emoji: '❄️', price: 4,
    type: 'equippable', typeFilter: 'Glace',
    description: '+30% ATK et SP.ATK (type Glace).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  ceinture_noire: {
    id: 'ceinture_noire', name: 'Ceinture Noire', emoji: '🥋', price: 4,
    type: 'equippable', typeFilter: 'Combat',
    description: '+30% ATK et SP.ATK (type Combat).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  poudre_argentee: {
    id: 'poudre_argentee', name: 'Poudre Argentée', emoji: '🪲', price: 4,
    type: 'equippable', typeFilter: 'Insecte',
    description: '+30% ATK et SP.ATK (type Insecte).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  pierre_dure: {
    id: 'pierre_dure', name: 'Pierre Dure', emoji: '🪨', price: 4,
    type: 'equippable', typeFilter: 'Roche',
    description: '+30% ATK et SP.ATK (type Roche).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  rune_magique: {
    id: 'rune_magique', name: 'Rune Magique', emoji: '👻', price: 4,
    type: 'equippable', typeFilter: 'Spectre',
    description: '+30% ATK et SP.ATK (type Spectre).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  croc_dragon: {
    id: 'croc_dragon', name: 'Croc Dragon', emoji: '🐉', price: 4,
    type: 'equippable', typeFilter: 'Dragon',
    description: '+30% ATK et SP.ATK (type Dragon).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  lunettes_noires: {
    id: 'lunettes_noires', name: 'Lunettes Noires', emoji: '🕶️', price: 4,
    type: 'equippable', typeFilter: 'Ténèbres',
    description: '+30% ATK et SP.ATK (type Ténèbres).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  peau_metal: {
    id: 'peau_metal', name: 'Peau Métal', emoji: '⚙️', price: 4,
    type: 'equippable', typeFilter: 'Acier',
    description: '+30% ATK et SP.ATK (type Acier).',
    statBonus: { atk: 1.30, spa: 1.30 },
  },
  plume_enchantee: {
    id: 'plume_enchantee', name: 'Plume Enchantée', emoji: '🧚', price: 4,
    type: 'equippable', typeFilter: 'Fée',
    description: '+30% ATK et SP.ATK (type Fée).',
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

// ─────────────────────────────────────────────────────────────────────────────
// pickEquippableItems(count, playerUnits, options)
//
// Tirage PONDÉRÉ des objets équipables. Avec 18 objets typés (un par type),
// un tirage uniforme proposerait le plus souvent des objets inutilisables :
// une équipe couvre en moyenne 6 types sur 18. On favorise donc les objets
// dont le type est représenté dans l'équipe, sans jamais exclure les autres
// (un objet "hors type" reste utile en prévision d'une évolution ou d'un achat).
// ─────────────────────────────────────────────────────────────────────────────
export const ITEM_PICK_WEIGHTS = {
  matchingType: 3.0,   // objet typé correspondant à un Pokémon de l'équipe
  universal:    1.5,   // objet sans filtre de type (toujours utilisable)
  offType:      0.4,   // objet typé sans correspondance dans l'équipe
};

export function pickEquippableItems(count = 3, playerUnits = [], options = {}) {
  const { exclude = [], rng = Math.random } = options;

  const teamTypes = new Set();
  (playerUnits ?? []).forEach(u => (u?.types ?? []).forEach(t => teamTypes.add(t)));

  const pool = Object.values(ITEMS).filter(i =>
    i.type === 'equippable' && !exclude.includes(i.id));

  const weightOf = (item) => {
    if (!item.typeFilter)                return ITEM_PICK_WEIGHTS.universal;
    if (teamTypes.has(item.typeFilter))  return ITEM_PICK_WEIGHTS.matchingType;
    return ITEM_PICK_WEIGHTS.offType;
  };

  // Tirage sans remise, pondéré
  const remaining = pool.map(i => ({ item: i, w: weightOf(i) }));
  const picked    = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((a, e) => a + e.w, 0);
    let r = rng() * total;
    let idx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      r -= remaining[i].w;
      if (r <= 0) { idx = i; break; }
    }
    picked.push(remaining[idx].item);
    remaining.splice(idx, 1);
  }
  return picked;
}

// ─────────────────────────────────────────────────────────────────────────────
// getTeamAuras(fieldUnits) — multiplicateurs d'aura apportés par les objets
// portés sur le terrain.
//
// Règle anti-abus : deux exemplaires du MÊME totem ne se cumulent pas (on ne
// compte chaque objet qu'une fois). En revanche, deux totems DIFFÉRENTS se
// cumulent, puisqu'ils touchent des statistiques distinctes.
// ─────────────────────────────────────────────────────────────────────────────
export function getTeamAuras(fieldUnits = []) {
  const seen  = new Set();
  const auras = {};
  (fieldUnits ?? []).forEach(u => {
    const aura = u?.heldItem?.teamAura;
    const id   = u?.heldItem?.id;
    if (!aura || !id || seen.has(id)) return;
    seen.add(id);
    Object.entries(aura).forEach(([stat, mult]) => {
      auras[stat] = (auras[stat] ?? 1) * mult;
    });
  });
  return auras;
}