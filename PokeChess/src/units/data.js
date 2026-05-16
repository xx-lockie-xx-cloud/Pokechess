// Données de base des monstres (Gen 1, V1 — 6 monstres pour commencer)
// Structure : id, nom, type(s), stats, sprite (via PokeAPI)

export const MONSTERS = [
  {
    id: 1,
    name: "Bulbizarre",
    types: ["Plante", "Poison"],
    tier: 1,
    stats: { hp: 45, atk: 49, def: 49, spd: 45 },
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png"
  },
  {
    id: 4,
    name: "Salamèche",
    types: ["Feu"],
    tier: 1,
    stats: { hp: 39, atk: 52, def: 43, spd: 65 },
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png"
  },
  {
    id: 7,
    name: "Carapuce",
    types: ["Eau"],
    tier: 1,
    stats: { hp: 44, atk: 48, def: 65, spd: 43 },
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png"
  },
  {
    id: 25,
    name: "Pikachu",
    types: ["Électrik"],
    tier: 1,
    stats: { hp: 35, atk: 55, def: 40, spd: 90 },
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png"
  },
  {
    id: 39,
    name: "Rondoudou",
    types: ["Normal", "Fée"],
    tier: 1,
    stats: { hp: 115, atk: 45, def: 20, spd: 20 },
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png"
  },
  {
    id: 52,
    name: "Miaouss",
    types: ["Normal"],
    tier: 1,
    stats: { hp: 40, atk: 45, def: 35, spd: 90 },
    spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/52.png"
  }
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
};