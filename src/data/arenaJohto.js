// ─────────────────────────────────────────────────────────────────────────────
// arenaJohto.js — Données des 8 arènes de Johto + maître de la Ligue
//
// Données pures, aucun import. Ordre officiel des arènes de Johto.
// Le maître de région est Red, affronté au Mont Argent (et non Peter, qui
// reste le maître de Kanto).
// ─────────────────────────────────────────────────────────────────────────────

export const ARENAS_JOHTO = [
  { id: 1, city: 'Mauville',       champion: 'Albert',    type: 'Vol',
    badgeName: 'Badge Zéphyr',      badgeEmoji: '🕊️',
    badgeSprite:          'assets/badges/johto/albert_b.png',
    championSprite:       'assets/trainers/map/champions/johto/albert.png',
    championSpriteCombat: 'assets/trainers/combat/champions/johto/albert_c.png' },

  { id: 2, city: 'Écorcia',        champion: 'Hector',    type: 'Insecte',
    badgeName: 'Badge Essaim',      badgeEmoji: '🐛',
    badgeSprite:          'assets/badges/johto/hector_b.png',
    championSprite:       'assets/trainers/map/champions/johto/hector.png',
    championSpriteCombat: 'assets/trainers/combat/champions/johto/hector_c.png' },

  { id: 3, city: 'Doublonville',   champion: 'Blanche',   type: 'Normal',
    badgeName: 'Badge Prisme',      badgeEmoji: '🌈',
    badgeSprite:          'assets/badges/johto/blanche_b.png',
    championSprite:       'assets/trainers/map/champions/johto/blanche.png',
    championSpriteCombat: 'assets/trainers/combat/champions/johto/blanche_c.png' },

  { id: 4, city: 'Rosalia',        champion: 'Mortimer',  type: 'Spectre',
    badgeName: 'Badge Brume',       badgeEmoji: '👻',
    badgeSprite:          'assets/badges/johto/mortimer_b.png',
    championSprite:       'assets/trainers/map/champions/johto/mortimer.png',
    championSpriteCombat: 'assets/trainers/combat/champions/johto/mortimer_c.png' },

  { id: 5, city: 'Irisia',         champion: 'Chuck',     type: 'Combat',
    badgeName: 'Badge Orage',       badgeEmoji: '👊',
    badgeSprite:          'assets/badges/johto/chuck_b.png',
    championSprite:       'assets/trainers/map/champions/johto/chuck.png',
    championSpriteCombat: 'assets/trainers/combat/champions/johto/chuck_c.png' },

  { id: 6, city: 'Oliville',       champion: 'Jasmine',   type: 'Acier',
    badgeName: 'Badge Minérale',    badgeEmoji: '⚙️',
    badgeSprite:          'assets/badges/johto/jasmine_b.png',
    championSprite:       'assets/trainers/map/champions/johto/jasmine.png',
    championSpriteCombat: 'assets/trainers/combat/champions/johto/jasmine_c.png' },

  { id: 7, city: 'Mayolia',        champion: 'Frédo',     type: 'Glace',
    badgeName: 'Badge Glacier',     badgeEmoji: '❄️',
    badgeSprite:          'assets/badges/johto/fredo_b.png',
    championSprite:       'assets/trainers/map/champions/johto/fredo.png',
    championSpriteCombat: 'assets/trainers/combat/champions/johto/fredo_c.png' },

  { id: 8, city: 'Ébènelle',       champion: 'Sandra',    type: 'Dragon',
    badgeName: 'Badge Ascension',   badgeEmoji: '🐉',
    badgeSprite:          'assets/badges/johto/sandra_b.png',
    championSprite:       'assets/trainers/map/champions/johto/sandra.png',
    championSpriteCombat: 'assets/trainers/combat/champions/johto/sandra_c.png' },
];

// Maître de la région : Red, au sommet du Mont Argent
export const MASTER_JOHTO = {
  name:         'Red',
  title:        'Dresseur du Mont Argenté',
  city:         'Mont Argenté',
  sprite:       'assets/trainers/map/champions/johto/red.png',
  spriteCombat: 'assets/trainers/combat/champions/johto/red_c.png',
};

// ─────────────────────────────────────────────────────────────────────────────
// Équipe FIXE de Red (contrairement aux champions, dont l'équipe est générée).
// Positions : row 0 = première ligne (front), row 1 = seconde ligne (back).
// Les stats sont lues depuis pokemons.js à la génération, puis multipliées par
// le coefficient de difficulté "Maître".
// ─────────────────────────────────────────────────────────────────────────────
export const RED_TEAM = [
  // Front : les encaisseurs
  { id: 143, col: 0, row: 0 },   // Ronflex
  { id:   3, col: 1, row: 0 },   // Florizarre
  { id:   9, col: 2, row: 0 },   // Tortank
  // Back : les frappeurs
  { id:   6, col: 0, row: 1 },   // Dracaufeu
  { id:  25, col: 1, row: 1 },   // Pikachu
  { id: 131, col: 2, row: 1 },   // Lokhlass
];