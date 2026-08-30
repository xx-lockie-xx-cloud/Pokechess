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
  109: 110,  // Smogo → Smogogo
  111: 112,  // Rhinocorne → Rhinoféros
  116: 117,  // Hypotrempe → Hypocéan
  118: 119,  // Poissirène → Poissoroy
  120: 121,  // Stari → Staross
  129: 130,  // Magicarpe → Léviator
  133: 134,  // Évoli → Aquali  (par défaut Eau, à tuner)
  138: 139,  // Amonita → Amonistar
  140: 141,  // Kabuto → Kabutops
  147: 148,  // Minidraco → Draco
  148: 149,  // Draco → Dracolosse

  // ── Génération 2 ────────────────────────────────────────────────────────
  42:  169,
  113: 242,
  152: 153,
  153: 154,
  155: 156,
  156: 157,
  158: 159,
  159: 160,
  161: 162,
  163: 164,
  165: 166,
  167: 168,
  170: 171,
  172: 25,
  173: 35,
  174: 39,
  175: 176,
  177: 178,
  179: 180,
  180: 181,
  183: 184,
  187: 188,
  188: 189,
  191: 192,
  194: 195,
  204: 205,
  209: 210,
  216: 217,
  218: 219,
  220: 221,
  223: 224,
  228: 229,
  231: 232,
  236: 237,
  238: 124,
  239: 125,
  240: 126,
  246: 247,
  247: 248,

  // Evolutions Gen 2 inter-generationnelles (ajouts)
  117: 230,  // Hypocean -> Hyporoi
  95:  208,  // Onix -> Steelix
  123: 212,  // Insecateur -> Cizayox
  137: 233,  // Porygon -> Porygon2

  // ── Génération 3 (Hoenn) ──
  // Branchantes gérées par BRANCHING_EVOLUTIONS dans PrepUI :
  // Chenipotte 265 -> Armulys 266 / Blindalys 268
  // Nincada 290 -> Ninjask 291 (Munja 292 est un bonus, pas une branche)
  252: 253,
  253: 254,
  255: 256,
  256: 257,
  258: 259,
  259: 260,
  261: 262,
  263: 264,
  265: 266,
  266: 267,
  268: 269,
  270: 271,
  271: 272,
  273: 274,
  274: 275,
  276: 277,
  278: 279,
  280: 281,
  281: 282,
  283: 284,
  285: 286,
  287: 288,
  288: 289,
  290: 291,
  293: 294,
  294: 295,
  296: 297,
  298: 183,
  300: 301,
  304: 305,
  305: 306,
  307: 308,
  309: 310,
  316: 317,
  318: 319,
  320: 321,
  322: 323,
  325: 326,
  328: 329,
  329: 330,
  331: 332,
  333: 334,
  339: 340,
  341: 342,
  343: 344,
  345: 346,
  347: 348,
  349: 350,
  353: 354,
  355: 356,
  361: 362,
  363: 364,
  364: 365,
  366: 367,
  371: 372,
  372: 373,
  374: 375,
  375: 376,
};

// Vérifie si un pokémon peut évoluer
export function canEvolve(pokemonId) {
  return EVOLUTION_CHAIN[pokemonId] !== undefined;
}

// Retourne l'id de l'évolution suivante
export function getEvolutionId(pokemonId) {
  return EVOLUTION_CHAIN[pokemonId] ?? null;
}