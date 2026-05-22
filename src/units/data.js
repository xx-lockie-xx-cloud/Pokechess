// Données de base des monstres (Gen 1, V1 — 6 monstres pour commencer)
// Structure : id, nom, type(s), stats, sprite (via PokeAPI)

export const MONSTERS = [
  {
    id: 1, name: "Bulbizarre", types: ["Plante", "Poison"],
    attackType: 'special',   // ← attaque spéciale
    tier: 1,
    stats: { hp: 45, atk: 49, spa: 65, def: 49, spd_def: 65, spd: 45 },
    attributes: [],
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png"
  },
  {
    id: 4, name: "Salamèche", types: ["Feu"],
    attackType: 'physical',
    tier: 1,
    stats: { hp: 39, atk: 52, spa: 60, def: 43, spd_def: 50, spd: 65 },
    attributes: [],
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png"
  },
  {
    id: 7, name: "Carapuce", types: ["Eau"],
    attackType: 'physical',
    tier: 1,
    stats: { hp: 44, atk: 48, spa: 50, def: 65, spd_def: 64, spd: 43 },
    attributes: [],
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png"
  },
  {
    id: 25, name: "Pikachu", types: ["Électrik"],
    attackType: 'special',
    tier: 1,
    stats: { hp: 35, atk: 55, spa: 50, def: 40, spd_def: 50, spd: 90 },
    attributes: [],
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png"
  },
  {
    id: 39, name: "Rondoudou", types: ["Normal", "Fée"],
    attackType: 'special',
    tier: 1,
    stats: { hp: 115, atk: 45, spa: 45, def: 20, spd_def: 25, spd: 20 },
    attributes: [],
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png"
  },
  {
    id: 52, name: "Miaouss", types: ["Normal"],
    attackType: 'physical',
    tier: 1,
    stats: { hp: 40, atk: 45, spa: 40, def: 35, spd_def: 40, spd: 90 },
    attributes: [],
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/52.png"
  },
];

// Types et leurs couleurs d'affichage
export const TYPE_COLORS = {
  "Feu":      0xe84118,
  "Eau":      0x0097e6,
  "Plante":   0x44bd32,
  "Électrik": 0xfbc531,
  "Normal":   0xa5a5a5,
  "Poison":   0x9c59d1,
  "Fée":      0xf78fb3,
  "Spectre":  0x7038f8,
};