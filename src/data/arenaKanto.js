// ─────────────────────────────────────────────────────────────────────────────
// arenaKanto.js — Données des 8 arènes de Kanto + maître de la Ligue
//
// Données pures, aucun import : les équipes sont générées dynamiquement par
// arenas.js à partir du `type` de chaque arène.
// ─────────────────────────────────────────────────────────────────────────────

export const ARENAS_KANTO = [
  { id: 1, city: 'Argenta',        champion: 'Pierre',    type: 'Roche',
    badgeName: 'Badge Pierre',      badgeEmoji: '🪨',
    badgeSprite:          'assets/badges/kanto/pierre_b.png',
    championSprite:       'assets/trainers/map/champions/kanto/pierre.png',
    championSpriteCombat: 'assets/trainers/combat/champions/kanto/pierre_c.png' },

  { id: 2, city: 'Azuria',         champion: 'Ondine',    type: 'Eau',
    badgeName: 'Badge Cascade',     badgeEmoji: '💧',
    badgeSprite:          'assets/badges/kanto/misty_b.png',
    championSprite:       'assets/trainers/map/champions/kanto/misty.png',
    championSpriteCombat: 'assets/trainers/combat/champions/kanto/misty_c.png' },

  { id: 3, city: 'Carmin sur Mer', champion: 'Lt. Surge', type: 'Électrik',
    badgeName: 'Badge Foudre',      badgeEmoji: '⚡',
    badgeSprite:          'assets/badges/kanto/surge_b.png',
    championSprite:       'assets/trainers/map/champions/kanto/surge.png',
    championSpriteCombat: 'assets/trainers/combat/champions/kanto/surge_c.png' },

  { id: 4, city: 'Céladopole',     champion: 'Erika',     type: 'Plante',
    badgeName: 'Badge Arc-en-Ciel', badgeEmoji: '🌿',
    badgeSprite:          'assets/badges/kanto/erika_b.png',
    championSprite:       'assets/trainers/map/champions/kanto/erika.png',
    championSpriteCombat: 'assets/trainers/combat/champions/kanto/erika_c.png' },

  { id: 5, city: 'Parmanie',       champion: 'Koga',      type: 'Poison',
    badgeName: 'Badge Âme',         badgeEmoji: '☠️',
    badgeSprite:          'assets/badges/kanto/koga_b.png',
    championSprite:       'assets/trainers/map/champions/kanto/koga.png',
    championSpriteCombat: 'assets/trainers/combat/champions/kanto/koga_c.png' },

  { id: 6, city: 'Safrania',       champion: 'Sabrina',   type: 'Psy',
    badgeName: 'Badge Marbre',      badgeEmoji: '🔮',
    badgeSprite:          'assets/badges/kanto/sabrina_b.png',
    championSprite:       'assets/trainers/map/champions/kanto/sabrina.png',
    championSpriteCombat: 'assets/trainers/combat/champions/kanto/sabrina_c.png' },

  { id: 7, city: 'Cramois\'île',   champion: 'Auguste',   type: 'Feu',
    badgeName: 'Badge Volcan',      badgeEmoji: '🔥',
    badgeSprite:          'assets/badges/kanto/auguste_b.png',
    championSprite:       'assets/trainers/map/champions/kanto/auguste.png',
    championSpriteCombat: 'assets/trainers/combat/champions/kanto/auguste_c.png' },

  { id: 8, city: 'Jadielle',       champion: 'Giovanni',  type: 'Sol',
    badgeName: 'Badge Terre',       badgeEmoji: '🏔',
    badgeSprite:          'assets/badges/kanto/giovanni_b.png',
    championSprite:       'assets/trainers/map/champions/kanto/giovanni.png',
    championSpriteCombat: 'assets/trainers/combat/champions/kanto/giovanni_c.png' },
];

// Maître de la Ligue de Kanto
export const MASTER_KANTO = {
  name:         'Peter',
  title:        'Maître de la Ligue',
  city:         'Plateau Indigo',
  sprite:               'assets/trainers/map/champions/kanto/peter.png',
  spriteCombat:         'assets/trainers/combat/champions/kanto/peter_c.png',
  championSprite:       'assets/trainers/map/champions/kanto/peter.png',
  championSpriteCombat: 'assets/trainers/combat/champions/kanto/peter_c.png',
};