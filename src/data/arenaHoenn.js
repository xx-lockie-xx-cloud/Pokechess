// ─────────────────────────────────────────────────────────────────────────────
// arenaHoenn.js — Données pures de la région de Hoenn (aucun import).
//
// 8 arènes + le maître de ligue. Particularité de Hoenn : le maître n'est pas
// fixe, il est tiré parmi les membres du Conseil 4 à partir de la seed de la run
// (même seed = même maître, donc reproductible).
//
// Convention de sprites propre à Hoenn (différente de Johto) :
//   map    : assets/trainers/map/champions/hoenn/<fichier>_m.png
//   combat : assets/trainers/combat/champions/hoenn/<fichier>.png
//   Conseil 4 : même schéma, dans le sous-dossier Elite4/
// ─────────────────────────────────────────────────────────────────────────────

const MAP_DIR         = 'assets/trainers/map/champions/hoenn';
const FIGHT_DIR       = 'assets/trainers/combat/champions/hoenn';
const MAP_DIR_ELITE   = `${MAP_DIR}/Elite4`;
const FIGHT_DIR_ELITE = `${FIGHT_DIR}/Elite4`;

export const ARENAS_HOENN = [
  { id: 1, city: 'Mérouville',     champion: 'Roxanne',      type: 'Roche', aceId: 299,
    badgeName: 'Badge Roche',       badgeEmoji: '🪨',
    badgeSprite:          'assets/badges/hoenn/roxanne_b.png',
    championSprite:       `${MAP_DIR}/roxanne_m.png`,
    championSpriteCombat: `${FIGHT_DIR}/roxanne.png` },

  { id: 2, city: 'Myokara',        champion: 'Bastien',      type: 'Combat', aceId: 297,
    badgeName: 'Badge Poing',       badgeEmoji: '🥊',
    badgeSprite:          'assets/badges/hoenn/bastien_b.png',
    championSprite:       `${MAP_DIR}/bastien_m.png`,
    championSpriteCombat: `${FIGHT_DIR}/bastien.png` },

  { id: 3, city: 'Lavandia',       champion: 'Voltère',      type: 'Électrik', aceId: 310,
    badgeName: 'Badge Dynamo',      badgeEmoji: '⚡',
    badgeSprite:          'assets/badges/hoenn/voltere_b.png',
    championSprite:       `${MAP_DIR}/voltere_m.png`,
    championSpriteCombat: `${FIGHT_DIR}/voltere.png` },

  { id: 4, city: 'Vermilava',      champion: 'Adriane',      type: 'Feu', aceId: 324,
    badgeName: 'Badge Chaleur',     badgeEmoji: '🔥',
    badgeSprite:          'assets/badges/hoenn/adriane_b.png',
    championSprite:       `${MAP_DIR}/adriane_m.png`,
    championSpriteCombat: `${FIGHT_DIR}/adriane.png` },

  { id: 5, city: 'Clémenti-Ville', champion: 'Norman',       type: 'Normal', aceId: 289,
    badgeName: 'Badge Balancier',   badgeEmoji: '⚖️',
    badgeSprite:          'assets/badges/hoenn/norman_b.png',
    championSprite:       `${MAP_DIR}/norman_m.png`,
    championSpriteCombat: `${FIGHT_DIR}/norman.png` },

  { id: 6, city: 'Cimetronelle',   champion: 'Alizée',       type: 'Vol', aceId: 334,
    badgeName: 'Badge Plume',       badgeEmoji: '🪶',
    badgeSprite:          'assets/badges/hoenn/alizee_b.png',
    championSprite:       `${MAP_DIR}/alizee_m.png`,
    championSpriteCombat: `${FIGHT_DIR}/alizee.png` },

  { id: 7, city: 'Atalanopolis',   champion: 'Lévy & Tatia', type: 'Psy', aceId: 376,
    badgeName: 'Badge Esprit',      badgeEmoji: '🔮',
    badgeSprite:          'assets/badges/hoenn/levy&tatia_b.png',
    championSprite:       `${MAP_DIR}/levy&tatia_m.png`,
    championSpriteCombat: `${FIGHT_DIR}/levy&tatia.png` },

  { id: 8, city: 'Nénucrique',     champion: 'Marc',         type: 'Eau', aceId: 350,
    badgeName: 'Badge Pluie',       badgeEmoji: '💧',
    badgeSprite:          'assets/badges/hoenn/marc_b.png',
    championSprite:       `${MAP_DIR}/marc_m.png`,
    championSpriteCombat: `${FIGHT_DIR}/marc.png` },
];

// ── Conseil 4 de Hoenn ──────────────────────────────────────────────────────
// Le maître de la région est l'un d'eux, tiré à partir de la seed de la run.
export const ELITES_HOENN = [
  { name: 'Damien',         title: 'Maître des Ténèbres',  type: 'Ténèbres', file: 'damien'  },
  { name: 'Spectra',        title: 'Maîtresse des Spectres', type: 'Spectre', file: 'spectra' },
  { name: 'Glacia',         title: 'Maîtresse des Glaces', type: 'Glace',    file: 'glacia'  },
  { name: 'Aragon',         title: 'Maître des Dragons',   type: 'Dragon',   file: 'aragon'  },
  { name: 'Pierre Rochard', title: 'Maître de la Ligue',   type: 'Acier',    file: 'pierre'  },
];

// Construit un objet maître complet (mêmes champs que MASTER_KANTO / MASTER_JOHTO)
export function buildHoennMaster(elite) {
  const sprite       = `${MAP_DIR_ELITE}/${elite.file}_m.png`;
  const spriteCombat = `${FIGHT_DIR_ELITE}/${elite.file}.png`;
  return {
    name:  elite.name,
    title: elite.title,
    city:  'Ligue Pokémon',
    type:  elite.type,
    sprite, spriteCombat,
    championSprite:       sprite,
    championSpriteCombat: spriteCombat,
  };
}

// Hash déterministe d'une seed (chaîne ou nombre) : même seed, même maître.
function seedHash(seed) {
  const s = String(seed ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Maître de Hoenn pour une run donnée. Sans seed, tirage aléatoire.
export function pickHoennMaster(seed = null) {
  const idx = seed == null
    ? Math.floor(Math.random() * ELITES_HOENN.length)
    : seedHash(seed) % ELITES_HOENN.length;
  return buildHoennMaster(ELITES_HOENN[idx]);
}

// Repli hors run (affichage du menu de sélection de région, par exemple).
export const MASTER_HOENN = buildHoennMaster(ELITES_HOENN[ELITES_HOENN.length - 1]);
