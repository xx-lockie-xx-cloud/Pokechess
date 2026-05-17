// Chaînes d'évolution Gen 1
// format : id → id de l'évolution suivante
// Les pokémons sans évolution n'apparaissent pas ici

export const EVOLUTION_CHAIN = {
  1:   2,    // Bulbizarre → Herbizarre
  2:   3,    // Herbizarre → Florizarre
  4:   5,    // Salamèche → Reptincel
  5:   6,    // Reptincel → Dracaufeu
  7:   8,    // Carapuce → Carabaffe
  8:   9,    // Carabaffe → Tortank
  10:  11,   // Chenipan → Chrysacier
  11:  12,   // Chrysacier → Papilusion
  13:  14,   // Aspicot → Coconfort
  14:  15,   // Coconfort → Dardargnan
  16:  17,   // Roucool → Roucoups
  17:  18,   // Roucoups → Roucarnage
  19:  20,   // Rattata → Rattatac
  21:  22,   // Piafabec → Rapasdepic
  23:  24,   // Abo → Arbok
  25:  26,   // Pikachu → Raichu
  27:  28,   // Sabelette → Sablaireau
  29:  30,   // Nidoran♀ → Nidorina
  30:  31,   // Nidorina → Nidoqueen
  32:  33,   // Nidoran♂ → Nidorino
  33:  34,   // Nidorino → Nidoking
  35:  36,   // Mélofée → Mélodelfe
  37:  38,   // Goupix → Feunard
  39:  40,   // Rondoudou → Grodoudou
  41:  42,   // Nosferapti → Nosferalto
  43:  44,   // Mystherbe → Ortide
  44:  45,   // Ortide → Rafflesia
  46:  47,   // Paras → Parasect
  48:  49,   // Mimitoss → Aéromite
  50:  51,   // Taupiqueur → Dugtrio
  52:  53,   // Miaouss → Persian
  54:  55,   // Psykokwak → Akwakwak
  56:  57,   // Férosinge → Colossinge
  58:  59,   // Caninos → Arcanin
  60:  61,   // Ptitard → Têtarte
  61:  62,   // Têtarte → Tartard
  63:  64,   // Abra → Kadabra
  64:  65,   // Kadabra → Alakazam
  66:  67,   // Machoc → Machopeur
  67:  68,   // Machopeur → Mackogneur
  69:  70,   // Chétiflor → Boustiflor
  70:  71,   // Boustiflor → Empiflor
  72:  73,   // Tentacool → Tentacruel
  74:  75,   // Racaillou → Gravalanch
  75:  76,   // Gravalanch → Grolem
  77:  78,   // Ponyta → Galopa
  79:  80,   // Ramoloss → Flagadoss
  81:  82,   // Magnéti → Magnéton
  84:  85,   // Doduo → Dodrio
  86:  87,   // Otaria → Lamantine
  88:  89,   // Tadmorv → Grotadmorv
  90:  91,   // Kokiyas → Crustabri
  92:  93,   // Fantominus → Spectrum
  93:  94,   // Spectrum → Ectoplasma
  96:  97,   // Soporifik → Hypnomade
  98:  99,   // Krabby → Krabboss
  100: 101,  // Voltorbe → Électrode
  102: 103,  // Nœunœuf → Noadkoko
  104: 105,  // Osselait → Ossatueur
  111: 112,  // Rhinocorne → Rhinoféros
  116: 117,  // Hypotrempe → Hypocéan
  118: 119,  // Poisson-Rouge → Poissoroy
  120: 121,  // Stari → Staross
  129: 130,  // Magicarpe → Léviator
  133: 134,  // Évoli → Aquali  (par défaut Eau, à tuner)
  138: 139,  // Amonita → Amonistar
  140: 141,  // Kabuto → Kabutops
  147: 148,  // Minidraco → Draco
  148: 149,  // Draco → Dracolosse
};

// Vérifie si un pokémon peut évoluer
export function canEvolve(pokemonId) {
  return EVOLUTION_CHAIN[pokemonId] !== undefined;
}

// Retourne l'id de l'évolution suivante
export function getEvolutionId(pokemonId) {
  return EVOLUTION_CHAIN[pokemonId] ?? null;
}