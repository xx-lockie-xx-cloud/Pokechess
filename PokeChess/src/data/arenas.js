// ─────────────────────────────────────────────────────────────────────────────
// arenas.js — Données des 8 arènes de Kanto + Ligue
// Sprites HGSS via archive.org / spriters-resource
// ─────────────────────────────────────────────────────────────────────────────

export const ARENAS = [
  {
    id: 1, city: 'Argenta', champion: 'Pierre', type: 'Roche',
    badgeName: 'Badge Pierre', badgeEmoji: '🪨',
    badgeSprite:          'assets/badges/pierre_b.png',
    championSprite:       'assets/trainers/map/champions/pierre.png',
    championSpriteCombat: 'assets/trainers/combat/champions/pierre_c.png',
    // Pokémons de l'arène (plus forts que les dresseurs normaux de map 1)
    team: [
      { id: 74, name: 'Racaillou',  types: ['Roche','Sol'],  row: 0, col: 0,
        stats: { hp: 50, atk: 90, spa: 35, def: 115, spd_def: 35, spd: 25 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/74.png' },
      { id: 95, name: 'Onix',       types: ['Roche','Sol'],  row: 0, col: 1,
        stats: { hp: 45, atk: 55, spa: 35, def: 170, spd_def: 50, spd: 75 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/95.png' },
    ]
  },
  {
    id: 2, city: 'Azuria', champion: 'Misty', type: 'Eau',
    badgeName: 'Badge Cascade', badgeEmoji: '💧',
    badgeSprite:          'assets/badges/misty_b.png',
    championSprite:       'assets/trainers/map/champions/misty.png',
    championSpriteCombat: 'assets/trainers/combat/champions/misty_c.png',
    team: [
      { id: 120, name: 'Stari',      types: ['Eau'],          row: 0, col: 0,
        stats: { hp: 40, atk: 55, spa: 80, def: 65, spd_def: 65, spd: 95 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/120.png' },
      { id: 121, name: 'Staross',    types: ['Eau','Psy'],    row: 0, col: 1,
        stats: { hp: 70, atk: 85, spa: 110, def: 95, spd_def: 95, spd: 125 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/121.png' },
    ]
  },
  {
    id: 3, city: 'Carmin-sur-Mer', champion: 'Lt. Surge', type: 'Électrik',
    badgeName: 'Badge Tonnerre', badgeEmoji: '⚡',
    badgeSprite:          'assets/badges/surge_b.png',
    championSprite:       'assets/trainers/map/champions/surge.png',
    championSpriteCombat: 'assets/trainers/combat/champions/surge_c.png',
    team: [
      { id: 100, name: 'Voltorbe',   types: ['Électrik'],     row: 0, col: 0,
        stats: { hp: 50, atk: 40, spa: 65, def: 60, spd_def: 65, spd: 110 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/100.png' },
      { id: 26,  name: 'Raichu',     types: ['Électrik'],     row: 0, col: 1,
        stats: { hp: 70, atk: 100, spa: 100, def: 65, spd_def: 90, spd: 120 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/26.png' },
    ]
  },
  {
    id: 4, city: 'Céladopole', champion: 'Erika', type: 'Plante',
    badgeName: 'Badge Arc-en-ciel', badgeEmoji: '🌿',
    badgeSprite:          'assets/badges/erika_b.png',
    championSprite:       'assets/trainers/map/champions/erika.png',
    championSpriteCombat: 'assets/trainers/combat/champions/erika_c.png',
    team: [
      { id: 71,  name: 'Empiflor',   types: ['Plante','Poison'], row: 0, col: 0,
        stats: { hp: 90, atk: 90, spa: 120, def: 95, spd_def: 100, spd: 60 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/71.png' },
      { id: 45,  name: 'Rafflesia',  types: ['Plante','Poison'], row: 0, col: 1,
        stats: { hp: 85, atk: 90, spa: 120, def: 95, spd_def: 100, spd: 60 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/45.png' },
    ]
  },
  {
    id: 5, city: 'Parmanie', champion: 'Koga', type: 'Poison',
    badgeName: 'Badge Âme', badgeEmoji: '☠️',
    badgeSprite:          'assets/badges/koga_b.png',
    championSprite:       'assets/trainers/map/champions/koga.png',
    championSpriteCombat: 'assets/trainers/combat/champions/koga_c.png',
    team: [
      { id: 89,  name: 'Grotadmorv', types: ['Poison'],       row: 0, col: 0,
        stats: { hp: 115, atk: 115, spa: 75, def: 85, spd_def: 110, spd: 60 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/89.png' },
      { id: 49,  name: 'Aéromite',   types: ['Insecte','Poison'], row: 0, col: 1,
        stats: { hp: 80, atk: 75, spa: 100, def: 70, spd_def: 100, spd: 100 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/49.png' },
    ]
  },
  {
    id: 6, city: 'Safrania', champion: 'Sabrina', type: 'Psy',
    badgeName: 'Badge Marais', badgeEmoji: '🔮',
    badgeSprite:          'assets/badges/sabrina_b.png',
    championSprite:       'assets/trainers/map/champions/sabrina.png',
    championSpriteCombat: 'assets/trainers/combat/champions/sabrina_c.png',
    team: [
      { id: 59,  name: 'Arcanin',    types: ['Feu'],          row: 0, col: 0,
        stats: { hp: 100, atk: 120, spa: 90, def: 90, spd_def: 90, spd: 105 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/59.png' },
      { id: 78,  name: 'Galopa',     types: ['Feu'],          row: 0, col: 1,
        stats: { hp: 75, atk: 110, spa: 90, def: 80, spd_def: 90, spd: 115 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/78.png' },
    ]
  },
  {
    id: 7, city: 'Cramois\'île', champion: 'Auguste', type: 'Feu',
    badgeName: 'Badge Volcan', badgeEmoji: '🔥',
    badgeSprite:          'assets/badges/auguste_b.png',
    championSprite:       'assets/trainers/map/champions/auguste.png',
    championSpriteCombat: 'assets/trainers/combat/champions/auguste_c.png',
    team: [
      { id: 65,  name: 'Alakazam',   types: ['Psy'],          row: 0, col: 0,
        stats: { hp: 65, atk: 60, spa: 145, def: 55, spd_def: 105, spd: 130 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/65.png' },
      { id: 97,  name: 'Hypnomade',  types: ['Psy'],          row: 0, col: 1,
        stats: { hp: 95, atk: 83, spa: 125, def: 80, spd_def: 65, spd: 77 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/97.png' },
    ]
  },
  {
    id: 8, city: 'Jadielle', champion: 'Giovanni', type: 'Sol',
    badgeName: 'Badge Terre', badgeEmoji: '🏔',
    championSprite:       'assets/trainers/map/champions/giovanni.png',
    championSpriteCombat: 'assets/trainers/combat/champions/giovanni_c.png',
    team: [
      { id: 112, name: 'Rhinoféros', types: ['Sol','Roche'],  row: 0, col: 0,
        stats: { hp: 115, atk: 140, spa: 55, def: 130, spd_def: 55, spd: 50 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/112.png' },
      { id: 76,  name: 'Grolem',     types: ['Roche','Sol'],  row: 1, col: 0,
        stats: { hp: 90, atk: 130, spa: 65, def: 140, spd_def: 75, spd: 55 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/76.png' },
      { id: 34,  name: 'Nidoking',   types: ['Poison','Sol'], row: 0, col: 1,
        stats: { hp: 91, atk: 112, spa: 95, def: 87, spd_def: 85, spd: 95 },
        attributes: [], spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/34.png' },
    ]
  },
  {
    id: 9, city: 'Indigo', champion: 'Ligue Pokémon', type: 'Mixte',
    badgeName: 'Champion Pokémon', badgeEmoji: '🏆',
    badgeSprite:          'assets/badges/giovanni_b.png',
    championSprite:       null,
    championSpriteCombat: null,
    team:         [],      // généré dynamiquement
    isLeague:     true,
  },
];

// Retourne les données de l'arène pour une map donnée (index 0-7)
export function getArenaForMap(mapIndex) {
  return ARENAS[Math.min(mapIndex, ARENAS.length - 1)] ?? null;
}