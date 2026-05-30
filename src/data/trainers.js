// Définition des archétypes de dresseurs et leurs pools de pokémons par type
// La difficulté est calculée dynamiquement via la somme des stats (budget)

export const TRAINER_ARCHETYPES = [
  {
    id:    'pecheur',
    name:  'Pêcheur',
    types: ['Eau'],
    color:       0x0097e6,
    spriteMap:   'assets/trainers/map/pecheur.png',
    spriteCombat:'assets/trainers/combat/pecheur_c.png',
    pool: [
      { id:   7, name: "Carapuce", types: ["Eau"],
        stats: { hp: 44, atk: 48, spa: 50, def: 65, spd_def: 64, spd: 43 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png" },
      { id:   8, name: "Carabaffe", types: ["Eau"],
        stats: { hp: 59, atk: 63, spa: 65, def: 80, spd_def: 80, spd: 58 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/8.png" },
      { id:   9, name: "Tortank", types: ["Eau"],
        stats: { hp: 79, atk: 83, spa: 85, def: 100, spd_def: 105, spd: 78 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/9.png" },
      { id:  54, name: "Psykokwak", types: ["Eau"],
        stats: { hp: 50, atk: 52, spa: 65, def: 48, spd_def: 50, spd: 55 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png" },
      { id:  55, name: "Akwakwak", types: ["Eau"],
        stats: { hp: 80, atk: 82, spa: 95, def: 78, spd_def: 80, spd: 85 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/55.png" },
      { id:  60, name: "Ptitard", types: ["Eau"],
        stats: { hp: 40, atk: 48, spa: 45, def: 43, spd_def: 43, spd: 65 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/60.png" },
      { id:  61, name: "Têtarte", types: ["Eau"],
        stats: { hp: 75, atk: 65, spa: 70, def: 65, spd_def: 70, spd: 90 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/61.png" },
      { id:  62, name: "Tartard", types: ["Eau", "Combat"],
        stats: { hp: 90, atk: 95, spa: 70, def: 95, spd_def: 90, spd: 70 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/62.png" },
      { id:  72, name: "Tentacool", types: ["Eau", "Poison"],
        stats: { hp: 40, atk: 40, spa: 50, def: 35, spd_def: 100, spd: 70 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/72.png" },
      { id:  73, name: "Tentacruel", types: ["Eau", "Poison"],
        stats: { hp: 80, atk: 70, spa: 80, def: 65, spd_def: 120, spd: 100 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/73.png" },
      { id:  79, name: "Ramoloss", types: ["Eau", "Psy"],
        stats: { hp: 65, atk: 65, spa: 40, def: 65, spd_def: 40, spd: 15 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/79.png" },
      { id:  80, name: "Flagadoss", types: ["Eau", "Psy"],
        stats: { hp: 95, atk: 75, spa: 100, def: 110, spd_def: 80, spd: 30 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/80.png" },
      { id:  86, name: "Otaria", types: ["Eau"],
        stats: { hp: 65, atk: 45, spa: 45, def: 55, spd_def: 70, spd: 45 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/86.png" },
      { id:  87, name: "Lamantine", types: ["Eau", "Glace"],
        stats: { hp: 90, atk: 70, spa: 70, def: 80, spd_def: 95, spd: 70 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/87.png" },
      { id:  90, name: "Kokiyas", types: ["Eau"],
        stats: { hp: 30, atk: 65, spa: 45, def: 100, spd_def: 25, spd: 40 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/90.png" },
      { id:  91, name: "Crustabri", types: ["Eau", "Glace"],
        stats: { hp: 50, atk: 95, spa: 85, def: 180, spd_def: 45, spd: 70 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/91.png" },
      { id:  98, name: "Krabby", types: ["Eau"],
        stats: { hp: 30, atk: 105, spa: 25, def: 90, spd_def: 25, spd: 50 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/98.png" },
      { id:  99, name: "Krabboss", types: ["Eau"],
        stats: { hp: 55, atk: 130, spa: 50, def: 115, spd_def: 50, spd: 75 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/99.png" },
      { id: 116, name: "Hypotrempe", types: ["Eau"],
        stats: { hp: 45, atk: 67, spa: 58, def: 35, spd_def: 50, spd: 45 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/116.png" },
      { id: 117, name: "Hypocéan", types: ["Eau"],
        stats: { hp: 75, atk: 95, spa: 95, def: 95, spd_def: 95, spd: 85 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/117.png" },
      { id: 118, name: "Poissirène", types: ["Eau"],
        stats: { hp: 45, atk: 67, spa: 35, def: 60, spd_def: 50, spd: 63 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/118.png" },
      { id: 119, name: "Poissoroy", types: ["Eau"],
        stats: { hp: 80, atk: 92, spa: 65, def: 65, spd_def: 80, spd: 68 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/119.png" },
      { id: 120, name: "Stari", types: ["Eau"],
        stats: { hp: 30, atk: 45, spa: 70, def: 55, spd_def: 55, spd: 85 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/120.png" },
      { id: 121, name: "Staross", types: ["Eau", "Psy"],
        stats: { hp: 60, atk: 75, spa: 100, def: 85, spd_def: 85, spd: 115 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/121.png" },
      { id: 129, name: "Magicarpe", types: ["Eau"],
        stats: { hp: 20, atk: 10, spa: 15, def: 55, spd_def: 20, spd: 80 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/129.png" },
      { id: 130, name: "Léviator", types: ["Eau", "Vol"],
        stats: { hp: 95, atk: 125, spa: 60, def: 79, spd_def: 100, spd: 81 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/130.png" },
      { id: 131, name: "Lokhlass", types: ["Eau", "Glace"],
        stats: { hp: 130, atk: 85, spa: 85, def: 80, spd_def: 95, spd: 60 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/131.png" },
      { id: 134, name: "Aquali", types: ["Eau"],
        stats: { hp: 130, atk: 65, spa: 110, def: 60, spd_def: 95, spd: 65 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/134.png" },
      { id: 138, name: "Amonita", types: ["Roche", "Eau"],
        stats: { hp: 35, atk: 40, spa: 60, def: 100, spd_def: 55, spd: 35 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/138.png" },
      { id: 139, name: "Amonistar", types: ["Roche", "Eau"],
        stats: { hp: 60, atk: 70, spa: 80, def: 125, spd_def: 70, spd: 55 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/139.png" },
      { id: 140, name: "Kabuto", types: ["Roche", "Eau"],
        stats: { hp: 30, atk: 80, spa: 45, def: 90, spd_def: 55, spd: 55 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/140.png" },
      { id: 141, name: "Kabutops", types: ["Roche", "Eau"],
        stats: { hp: 60, atk: 115, spa: 65, def: 105, spd_def: 70, spd: 80 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/141.png" }
    ]
  },
  {
    id:    'telekinesiste',
    name:  'Télékinésiste',
    types: ['Psy'],
    color:       0x9c59d1,
    spriteMap:   'assets/trainers/map/telekinesiste.png',
    spriteCombat:'assets/trainers/combat/telekinesiste_c.png',
    pool: [
      { id:  63, name: "Abra", types: ["Psy"],
        stats: { hp: 25, atk: 20, spa: 105, def: 15, spd_def: 55, spd: 90 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/63.png" },
      { id:  64, name: "Kadabra", types: ["Psy"],
        stats: { hp: 40, atk: 35, spa: 120, def: 30, spd_def: 70, spd: 105 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/64.png" },
      { id:  65, name: "Alakazam", types: ["Psy"],
        stats: { hp: 55, atk: 50, spa: 135, def: 45, spd_def: 95, spd: 120 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/65.png" },
      { id:  79, name: "Ramoloss", types: ["Eau", "Psy"],
        stats: { hp: 65, atk: 65, spa: 40, def: 65, spd_def: 40, spd: 15 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/79.png" },
      { id:  80, name: "Flagadoss", types: ["Eau", "Psy"],
        stats: { hp: 95, atk: 75, spa: 100, def: 110, spd_def: 80, spd: 30 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/80.png" },
      { id:  96, name: "Soporifik", types: ["Psy"],
        stats: { hp: 60, atk: 48, spa: 80, def: 48, spd_def: 48, spd: 42 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/96.png" },
      { id:  97, name: "Hypnomade", types: ["Psy"],
        stats: { hp: 85, atk: 73, spa: 115, def: 70, spd_def: 55, spd: 67 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/97.png" },
      { id: 102, name: "Nœunœuf", types: ["Plante", "Psy"],
        stats: { hp: 60, atk: 40, spa: 60, def: 80, spd_def: 45, spd: 40 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/102.png" },
      { id: 103, name: "Noadkoko", types: ["Plante", "Psy"],
        stats: { hp: 95, atk: 95, spa: 100, def: 85, spd_def: 80, spd: 55 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/103.png" },
      { id: 121, name: "Staross", types: ["Eau", "Psy"],
        stats: { hp: 60, atk: 75, spa: 100, def: 85, spd_def: 85, spd: 115 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/121.png" },
      { id: 122, name: "M. Mime", types: ["Psy", "Fée"],
        stats: { hp: 40, atk: 45, spa: 100, def: 65, spd_def: 120, spd: 90 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/122.png" },
      { id: 124, name: "Lippoutou", types: ["Glace", "Psy"],
        stats: { hp: 65, atk: 50, spa: 115, def: 35, spd_def: 95, spd: 95 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/124.png" }
    ]
  },
  {
    id:    'montagnard',
    name:  'Montagnard',
    types: ['Roche', 'Sol'],
    color:       0x8e7348,
    spriteMap:   'assets/trainers/map/montagnard.png',
    spriteCombat:'assets/trainers/combat/montagnard_c.png',
    pool: [
      { id:  27, name: "Sabelette", types: ["Sol"],
        stats: { hp: 50, atk: 75, spa: 40, def: 85, spd_def: 30, spd: 40 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/27.png" },
      { id:  28, name: "Sablaireau", types: ["Sol"],
        stats: { hp: 75, atk: 100, spa: 45, def: 110, spd_def: 55, spd: 65 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/28.png" },
      { id:  31, name: "Nidoqueen", types: ["Poison", "Sol"],
        stats: { hp: 90, atk: 92, spa: 75, def: 87, spd_def: 85, spd: 76 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/31.png" },
      { id:  34, name: "Nidoking", types: ["Poison", "Sol"],
        stats: { hp: 81, atk: 102, spa: 85, def: 77, spd_def: 75, spd: 85 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/34.png" },
      { id:  50, name: "Taupiqueur", types: ["Sol"],
        stats: { hp: 10, atk: 55, spa: 35, def: 25, spd_def: 45, spd: 95 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/50.png" },
      { id:  51, name: "Triopikeur", types: ["Sol"],
        stats: { hp: 35, atk: 100, spa: 50, def: 50, spd_def: 70, spd: 120 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/51.png" },
      { id:  74, name: "Racaillou", types: ["Roche", "Sol"],
        stats: { hp: 40, atk: 80, spa: 30, def: 100, spd_def: 30, spd: 20 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/74.png" },
      { id:  75, name: "Gravalanch", types: ["Roche", "Sol"],
        stats: { hp: 55, atk: 95, spa: 45, def: 115, spd_def: 45, spd: 35 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/75.png" },
      { id:  76, name: "Grolem", types: ["Roche", "Sol"],
        stats: { hp: 80, atk: 120, spa: 55, def: 130, spd_def: 65, spd: 45 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/76.png" },
      { id:  95, name: "Onix", types: ["Roche", "Sol"],
        stats: { hp: 35, atk: 45, spa: 30, def: 160, spd_def: 45, spd: 70 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/95.png" },
      { id: 104, name: "Osselait", types: ["Sol"],
        stats: { hp: 50, atk: 50, spa: 40, def: 95, spd_def: 40, spd: 35 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/104.png" },
      { id: 105, name: "Ossatueur", types: ["Sol"],
        stats: { hp: 60, atk: 80, spa: 45, def: 110, spd_def: 55, spd: 45 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/105.png" },
      { id: 111, name: "Rhinocorne", types: ["Sol", "Roche"],
        stats: { hp: 80, atk: 85, spa: 30, def: 95, spd_def: 30, spd: 25 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/111.png" },
      { id: 112, name: "Rhinoféros", types: ["Sol", "Roche"],
        stats: { hp: 105, atk: 130, spa: 45, def: 120, spd_def: 45, spd: 40 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/112.png" },
      { id: 138, name: "Amonita", types: ["Roche", "Eau"],
        stats: { hp: 35, atk: 40, spa: 60, def: 100, spd_def: 55, spd: 35 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/138.png" },
      { id: 139, name: "Amonistar", types: ["Roche", "Eau"],
        stats: { hp: 60, atk: 70, spa: 80, def: 125, spd_def: 70, spd: 55 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/139.png" },
      { id: 140, name: "Kabuto", types: ["Roche", "Eau"],
        stats: { hp: 30, atk: 80, spa: 45, def: 90, spd_def: 55, spd: 55 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/140.png" },
      { id: 141, name: "Kabutops", types: ["Roche", "Eau"],
        stats: { hp: 60, atk: 115, spa: 65, def: 105, spd_def: 70, spd: 80 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/141.png" },
      { id: 142, name: "Ptéra", types: ["Roche", "Vol"],
        stats: { hp: 80, atk: 105, spa: 60, def: 65, spd_def: 75, spd: 130 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/142.png" }
    ]
  },
  {
    id:    'pyromaniac',
    name:  'Pyromaniaque',
    types: ['Feu'],
    color:       0xe84118,
    spriteMap:   'assets/trainers/map/pyromaniac.png',
    spriteCombat:'assets/trainers/combat/pyromaniac_c.png',
    pool: [
      { id:   4, name: "Salamèche", types: ["Feu"],
        stats: { hp: 39, atk: 52, spa: 60, def: 43, spd_def: 50, spd: 65 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png" },
      { id:   5, name: "Reptincel", types: ["Feu"],
        stats: { hp: 58, atk: 64, spa: 80, def: 58, spd_def: 65, spd: 80 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/5.png" },
      { id:   6, name: "Dracaufeu", types: ["Feu", "Vol"],
        stats: { hp: 78, atk: 84, spa: 109, def: 78, spd_def: 85, spd: 100 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png" },
      { id:  37, name: "Goupix", types: ["Feu"],
        stats: { hp: 38, atk: 41, spa: 50, def: 40, spd_def: 65, spd: 65 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/37.png" },
      { id:  38, name: "Feunard", types: ["Feu"],
        stats: { hp: 73, atk: 76, spa: 81, def: 75, spd_def: 100, spd: 100 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/38.png" },
      { id:  58, name: "Caninos", types: ["Feu"],
        stats: { hp: 55, atk: 70, spa: 45, def: 45, spd_def: 50, spd: 60 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/58.png" },
      { id:  59, name: "Arcanin", types: ["Feu"],
        stats: { hp: 90, atk: 110, spa: 80, def: 80, spd_def: 80, spd: 95 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/59.png" },
      { id:  77, name: "Ponyta", types: ["Feu"],
        stats: { hp: 50, atk: 85, spa: 65, def: 55, spd_def: 65, spd: 90 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/77.png" },
      { id:  78, name: "Galopa", types: ["Feu"],
        stats: { hp: 65, atk: 100, spa: 80, def: 70, spd_def: 80, spd: 105 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/78.png" },
      { id: 126, name: "Magmar", types: ["Feu"],
        stats: { hp: 65, atk: 95, spa: 100, def: 57, spd_def: 85, spd: 93 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/126.png" },
      { id: 136, name: "Pyroli", types: ["Feu"],
        stats: { hp: 65, atk: 130, spa: 95, def: 60, spd_def: 110, spd: 65 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/136.png" }
    ]
  },
  {
    id:    'insectologue',
    name:  'Insectologue',
    types: ['Insecte'],
    color:       0x44bd32,
    spriteMap:   'assets/trainers/map/insectologue.png',
    spriteCombat:'assets/trainers/combat/insectologue_c.png',
    pool: [
      { id:  10, name: "Chenipan", types: ["Insecte"],
        stats: { hp: 45, atk: 30, spa: 25, def: 35, spd_def: 25, spd: 45 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10.png" },
      { id:  11, name: "Chrysacier", types: ["Insecte"],
        stats: { hp: 50, atk: 25, spa: 25, def: 55, spd_def: 25, spd: 30 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/11.png" },
      { id:  12, name: "Papilusion", types: ["Insecte", "Vol"],
        stats: { hp: 60, atk: 45, spa: 90, def: 50, spd_def: 80, spd: 70 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/12.png" },
      { id:  13, name: "Aspicot", types: ["Insecte", "Poison"],
        stats: { hp: 40, atk: 35, spa: 20, def: 30, spd_def: 20, spd: 35 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/13.png" },
      { id:  14, name: "Coconfort", types: ["Insecte", "Poison"],
        stats: { hp: 45, atk: 25, spa: 25, def: 50, spd_def: 25, spd: 15 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/14.png" },
      { id:  15, name: "Dardargnan", types: ["Insecte", "Poison"],
        stats: { hp: 65, atk: 90, spa: 45, def: 40, spd_def: 80, spd: 75 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/15.png" },
      { id:  46, name: "Paras", types: ["Insecte", "Plante"],
        stats: { hp: 35, atk: 70, spa: 45, def: 55, spd_def: 55, spd: 25 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/46.png" },
      { id:  47, name: "Parasect", types: ["Insecte", "Plante"],
        stats: { hp: 60, atk: 95, spa: 60, def: 80, spd_def: 80, spd: 30 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/47.png" },
      { id:  48, name: "Mimitoss", types: ["Insecte", "Poison"],
        stats: { hp: 60, atk: 55, spa: 40, def: 50, spd_def: 55, spd: 45 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/48.png" },
      { id:  49, name: "Aéromite", types: ["Insecte", "Poison"],
        stats: { hp: 70, atk: 65, spa: 90, def: 60, spd_def: 90, spd: 90 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/49.png" },
      { id: 123, name: "Insécateur", types: ["Insecte", "Vol"],
        stats: { hp: 70, atk: 110, spa: 55, def: 80, spd_def: 80, spd: 105 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/123.png" },
      { id: 127, name: "Scarabrute", types: ["Insecte"],
        stats: { hp: 65, atk: 125, spa: 40, def: 100, spd_def: 55, spd: 85 },
        spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/127.png" }
    ]
  },
];

// Calcule la valeur totale d'une équipe (somme de toutes les stats)
export function teamBudget(units) {
  return units.reduce((total, u) => {
    const s = u.stats;
    return total + s.hp + s.atk + s.def + s.spd;
  }, 0);
}

// Génère une équipe ennemie pour un archétype donné avec un budget cible
// On pioche des pokémons aléatoirement jusqu'à atteindre le budget
// maxUnits : nombre max de pokémon sur le terrain (1-6)
// BST complet (6 stats) — utilisé pour le budget et le tirage pondéré
function getBST(p) {
  const s = p.stats;
  return (s.hp ?? 0) + (s.atk ?? 0) + (s.spa ?? 0)
       + (s.def ?? 0) + (s.spd_def ?? 0) + (s.spd ?? 0);
}

const TIER_RATES = [
  [65, 30,  5,  0,  0],
  [50, 35, 13,  2,  0],
  [32, 35, 24,  8,  1],
  [18, 27, 36, 16,  3],
  [ 6, 17, 40, 32,  5],
  [ 1, 12, 40, 40,  7],
  [ 0, 10, 40, 43,  7],
  [ 0, 10, 40, 41,  9],
  [ 0, 10, 40, 40, 10],
];

function pokemonTier(p) {
  const b = getBST(p);
  if (b <= 308) return 1;
  if (b <= 390) return 2;
  if (b <= 470) return 3;
  if (b <= 550) return 4;
  return 5;
}

// rng : fonction seeded (ou Math.random si non fournie)
function weightedPick(pool, mapIndex, rng = Math.random.bind(Math)) {
  const rates    = TIER_RATES[Math.min(mapIndex ?? 0, 8)];
  const weighted = pool.map(p => ({ p, w: rates[pokemonTier(p) - 1] ?? 0 }))
                       .filter(x => x.w > 0);
  if (!weighted.length) return pool[Math.floor(rng() * pool.length)];
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let   roll  = rng() * total;
  for (const { p, w } of weighted) { roll -= w; if (roll <= 0) return p; }
  return weighted[weighted.length - 1].p;
}

// rng : passé depuis MapGenerator pour le déterminisme complet
export function generateEnemyTeam(archetype, targetBudget, maxUnits = 6, mapIndex = 0, rng = Math.random.bind(Math)) {
  const pool  = [...archetype.pool];
  const team  = [];
  let   spent = 0;
  let   tries = 0;

  // Cellules disponibles (mélangées)
  const allCells = [];
  for (let col = 0; col < 3; col++)
    for (let row = 0; row < 2; row++)
      allCells.push({ col, row });
  for (let i = allCells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }

  while (team.length < maxUnits && spent < targetBudget && tries < 60) {
    tries++;
    const remaining = targetBudget - spent;

    // Filtre le pool selon le budget restant ET les taux de tirage par tier/mapIndex
    const rates    = TIER_RATES[Math.min(mapIndex ?? 0, 8)];
    const weighted = pool
      .map(p => ({ p, w: rates[pokemonTier(p) - 1] ?? 0 }))
      .filter(x => x.w > 0 && getBST(x.p) <= remaining + 50);

    // Si rien d'éligible par les taux → prend le moins cher du pool abordable
    let pick;
    if (!weighted.length) {
      const affordable = pool.filter(p => getBST(p) <= remaining + 50)
        .sort((a, b) => getBST(a) - getBST(b));
      if (!affordable.length) break; // plus rien d'abordable
      pick = affordable[0];
    } else {
      const total = weighted.reduce((s, x) => s + x.w, 0);
      let   roll  = rng() * total;
      pick = weighted[weighted.length - 1].p;
      for (const { p, w } of weighted) { roll -= w; if (roll <= 0) { pick = p; break; } }
    }

    const cell = allCells[team.length];
    spent += getBST(pick);
    team.push({ ...pick, col: cell.col, row: cell.row, attributes: [] });
  }

  return team;
}

// Export TIER_RATES pour runState.weightedWildDraw
export { TIER_RATES, pokemonTier };
// ─────────────────────────────────────────────────────────────────────────────
// Nouveaux archétypes de dresseurs
// Sprites à remplacer par les assets définitifs
// ─────────────────────────────────────────────────────────────────────────────

export const TRAINER_ARCHETYPES_EXTRA = [
  {
    id:    'karateka',
    name:  'Karatéka',
    types: ['Combat'],
    color:       0xc0392b,
    spriteMap:    'assets/trainers/map/karateka.png',      // placeholder
    spriteCombat: 'assets/trainers/combat/karateka_c.png', // placeholder
    pool: [
      { id: 56,  name: 'Férosinge',  types: ['Combat'],
        stats: { hp: 40, atk: 80, def: 35, spd: 76 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/56.png' },
      { id: 57,  name: 'Colossinge', types: ['Combat'],
        stats: { hp: 65, atk: 105, def: 60, spd: 95 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/57.png' },
      { id: 66,  name: 'Machoc',     types: ['Combat'],
        stats: { hp: 70, atk: 80, def: 50, spd: 35 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/66.png' },
      { id: 67,  name: 'Machopeur',  types: ['Combat'],
        stats: { hp: 80, atk: 100, def: 70, spd: 45 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/67.png' },
      { id: 68,  name: 'Mackogneur', types: ['Combat'],
        stats: { hp: 90, atk: 130, def: 80, spd: 55 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/68.png' },
      { id: 106, name: 'Kicklee',    types: ['Combat'],
        stats: { hp: 50, atk: 120, def: 53, spd: 87 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/106.png' },
      { id: 107, name: 'Tygnon',     types: ['Combat'],
        stats: { hp: 50, atk: 105, def: 79, spd: 76 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/107.png' },
    ]
  },

  {
    id:    'ornithologue',
    name:  'Ornithologue',
    types: ['Vol'],
    color:       0x74b9ff,
    spriteMap:    'assets/trainers/map/ornithologue.png',
    spriteCombat: 'assets/trainers/combat/ornithologue_c.png',
    pool: [
      { id: 16,  name: 'Roucool',    types: ['Normal', 'Vol'],
        stats: { hp: 40, atk: 45, def: 40, spd: 56 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/16.png' },
      { id: 17,  name: 'Roucoups',   types: ['Normal', 'Vol'],
        stats: { hp: 63, atk: 60, def: 55, spd: 71 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/17.png' },
      { id: 18,  name: 'Roucarnage', types: ['Normal', 'Vol'],
        stats: { hp: 83, atk: 80, def: 75, spd: 101 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/18.png' },
      { id: 21,  name: 'Piafabec',   types: ['Normal', 'Vol'],
        stats: { hp: 40, atk: 60, def: 30, spd: 70 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/21.png' },
      { id: 22,  name: 'Rapasdepic', types: ['Normal', 'Vol'],
        stats: { hp: 65, atk: 90, def: 65, spd: 100 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/22.png' },
      { id: 83,  name: 'Canarticho', types: ['Normal', 'Vol'],
        stats: { hp: 52, atk: 65, def: 55, spd: 60 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/83.png' },
      { id: 84,  name: 'Doduo',      types: ['Normal', 'Vol'],
        stats: { hp: 35, atk: 85, def: 45, spd: 75 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/84.png' },
      { id: 85,  name: 'Dodrio',     types: ['Normal', 'Vol'],
        stats: { hp: 60, atk: 110, def: 70, spd: 110 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/85.png' },
      { id: 142, name: 'Ptéra',      types: ['Roche', 'Vol'],
        stats: { hp: 80, atk: 105, def: 65, spd: 130 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/142.png' },
    ]
  },

  {
    id:    'scientifique',
    name:  'Scientifique',
    types: ['Électrik', 'Poison'],
    color:       0xf9ca24,
    spriteMap:    'assets/trainers/map/scientifique.png',
    spriteCombat: 'assets/trainers/combat/scientifique_c.png',
    pool: [
      { id: 25,  name: 'Pikachu',    types: ['Électrik'],
        stats: { hp: 35, atk: 55, def: 30, spd: 90 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' },
      { id: 26,  name: 'Raichu',     types: ['Électrik'],
        stats: { hp: 60, atk: 90, def: 55, spd: 110 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/26.png' },
      { id: 81,  name: 'Magnéti',    types: ['Électrik'],
        stats: { hp: 25, atk: 35, def: 70, spd: 45 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/81.png' },
      { id: 82,  name: 'Magnéton',   types: ['Électrik'],
        stats: { hp: 50, atk: 60, def: 95, spd: 70 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/82.png' },
      { id: 88,  name: 'Tadmorv',    types: ['Poison'],
        stats: { hp: 80, atk: 80, def: 50, spd: 25 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/88.png' },
      { id: 89,  name: 'Grotadmorv', types: ['Poison'],
        stats: { hp: 105, atk: 105, def: 75, spd: 50 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/89.png' },
      { id: 100, name: 'Voltorbe',   types: ['Électrik'],
        stats: { hp: 40, atk: 30, def: 50, spd: 100 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/100.png' },
      { id: 101, name: 'Électrode',  types: ['Électrik'],
        stats: { hp: 60, atk: 50, def: 70, spd: 150 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/101.png' },
      { id: 110, name: 'Smogogo',    types: ['Poison'],
        stats: { hp: 65, atk: 90, def: 65, spd: 60 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/110.png' },
      { id: 125, name: 'Élektek',    types: ['Électrik'],
        stats: { hp: 65, atk: 83, def: 57, spd: 105 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/125.png' },
    ]
  },

  {
    id:    'gamin',
    name:  'Gamin',
    types: ['Normal'], // pool varié, 1ers stades uniquement
    color:       0xffeaa7,
    spriteMap:    'assets/trainers/map/gamin.png',
    spriteCombat: 'assets/trainers/combat/gamin_c.png',
    // Pokémons au 1er stade d'évolution (ou pas d'évolution)
    pool: [
      { id: 1,   name: 'Bulbizarre',  types: ['Plante','Poison'],
        stats: { hp: 45, atk: 49, def: 49, spd: 45 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png' },
      { id: 4,   name: 'Salamèche',   types: ['Feu'],
        stats: { hp: 39, atk: 52, def: 43, spd: 65 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png' },
      { id: 7,   name: 'Carapuce',    types: ['Eau'],
        stats: { hp: 44, atk: 48, def: 65, spd: 43 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png' },
      { id: 25,  name: 'Pikachu',     types: ['Électrik'],
        stats: { hp: 35, atk: 55, def: 30, spd: 90 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' },
      { id: 35,  name: 'Mélofée',     types: ['Normal'],
        stats: { hp: 70, atk: 45, def: 48, spd: 35 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/35.png' },
      { id: 39,  name: 'Rondoudou',   types: ['Normal','Fée'],
        stats: { hp: 115, atk: 45, def: 20, spd: 20 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png' },
      { id: 52,  name: 'Miaouss',     types: ['Normal'],
        stats: { hp: 40, atk: 45, def: 35, spd: 90 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/52.png' },
      { id: 54,  name: 'Psykokwak',   types: ['Eau'],
        stats: { hp: 50, atk: 52, def: 48, spd: 55 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png' },
      { id: 60,  name: 'Ptitard',     types: ['Eau'],
        stats: { hp: 40, atk: 48, def: 43, spd: 65 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/60.png' },
      { id: 63,  name: 'Abra',        types: ['Psy'],
        stats: { hp: 25, atk: 20, def: 15, spd: 90 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/63.png' },
      { id: 74,  name: 'Racaillou',   types: ['Roche','Sol'],
        stats: { hp: 40, atk: 80, def: 100, spd: 20 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/74.png' },
      { id: 92,  name: 'Fantominus',  types: ['Spectre','Poison'],
        stats: { hp: 30, atk: 35, def: 30, spd: 80 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/92.png' },
    ]
  },

  {
    id:    'topdresseur',
    name:  'TopDresseur',
    types: ['Normal'],
    color:       0x6c5ce7,
    spriteMap:    'assets/trainers/map/topdresseur.png',
    spriteCombat: 'assets/trainers/combat/topdresseur_c.png',
    minMap: { easy: 5, normal: 4, hard: 3, expert: 3 },
    pool: [
      { id: 3,   name: 'Florizarre',  types: ['Plante','Poison'],
        stats: { hp: 80, atk: 82, def: 83, spd: 80 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/3.png' },
      { id: 6,   name: 'Dracaufeu',   types: ['Feu','Vol'],
        stats: { hp: 78, atk: 84, def: 78, spd: 100 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png' },
      { id: 9,   name: 'Tortank',     types: ['Eau'],
        stats: { hp: 79, atk: 83, def: 100, spd: 78 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/9.png' },
      { id: 36,  name: 'Mélodelfe',   types: ['Normal','Fée'],
        stats: { hp: 95, atk: 70, def: 73, spd: 60 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/36.png' },
      { id: 59,  name: 'Arcanin',     types: ['Feu'],
        stats: { hp: 90, atk: 110, def: 80, spd: 95 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/59.png' },
      { id: 62,  name: 'Tartard',     types: ['Eau','Combat'],
        stats: { hp: 90, atk: 95, def: 95, spd: 70 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/62.png' },
      { id: 65,  name: 'Alakazam',    types: ['Psy'],
        stats: { hp: 55, atk: 50, def: 45, spd: 120 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/65.png' },
      { id: 76,  name: 'Grolem',      types: ['Roche','Sol'],
        stats: { hp: 80, atk: 120, def: 130, spd: 45 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/76.png' },
      { id: 103, name: 'Noadkoko',    types: ['Plante','Psy'],
        stats: { hp: 95, atk: 95, def: 85, spd: 100 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/103.png' },
      { id: 130, name: 'Léviator',    types: ['Eau'],
        stats: { hp: 95, atk: 125, def: 79, spd: 81 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/130.png' },
      { id: 149, name: 'Dracolosse',  types: ['Dragon','Vol'],
        stats: { hp: 91, atk: 134, def: 95, spd: 80 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/149.png' },
    ]
  },

  {
    id:    'sbire_rocket',
    name:  'Sbire Team Rocket',
    types: ['Poison', 'Normal'],
    color:       0x2d3436,
    spriteMap:    'assets/trainers/map/sbire_rocket.png',
    spriteCombat: 'assets/trainers/combat/sbire_rocket_c.png',
    minMap: { easy: 2, normal: 2, hard: 1, expert: 1 },
    // Pokémons associés à la Team Rocket (Jessie, James, Giovanni)
    pool: [
      { id: 23,  name: 'Abo',         types: ['Poison'],
        stats: { hp: 35, atk: 60, def: 44, spd: 55 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/23.png' },
      { id: 24,  name: 'Arbok',       types: ['Poison'],
        stats: { hp: 60, atk: 95, def: 69, spd: 80 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/24.png' },
      { id: 52,  name: 'Miaouss',     types: ['Normal'],
        stats: { hp: 40, atk: 45, def: 35, spd: 90 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/52.png' },
      { id: 53,  name: 'Persian',     types: ['Normal'],
        stats: { hp: 65, atk: 70, def: 60, spd: 115 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/53.png' },
      { id: 88,  name: 'Tadmorv',     types: ['Poison'],
        stats: { hp: 80, atk: 80, def: 50, spd: 25 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/88.png' },
      { id: 89,  name: 'Grotadmorv',  types: ['Poison'],
        stats: { hp: 105, atk: 105, def: 75, spd: 50 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/89.png' },
      { id: 109, name: 'Smogo',       types: ['Poison'],
        stats: { hp: 40, atk: 65, def: 95, spd: 35 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/109.png' },
      { id: 110, name: 'Smogogo',     types: ['Poison'],
        stats: { hp: 65, atk: 90, def: 65, spd: 60 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/110.png' },
      { id: 112, name: 'Rhinoféros',  types: ['Sol','Roche'],
        stats: { hp: 105, atk: 130, def: 120, spd: 40 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/112.png' },
      { id: 31,  name: 'Nidoqueen',   types: ['Poison','Sol'],
        stats: { hp: 90, atk: 92, def: 87, spd: 76 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/31.png' },
      { id: 34,  name: 'Nidoking',    types: ['Poison','Sol'],
        stats: { hp: 81, atk: 102, def: 77, spd: 85 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/34.png' },
    ]
  },

  {
    id:    'vieillard',
    name:  'Vieillard',
    types: ['Fée', 'Roche'], // Fée et fossiles
    color:       0xdfe6e9,
    spriteMap:    'assets/trainers/map/vieillard.png',
    spriteCombat: 'assets/trainers/combat/vieillard_c.png',
    pool: [
      // Fée
      { id: 35,  name: 'Mélofée',     types: ['Normal'],
        stats: { hp: 70, atk: 45, def: 48, spd: 35 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/35.png' },
      { id: 36,  name: 'Mélodelfe',   types: ['Normal','Fée'],
        stats: { hp: 95, atk: 70, def: 73, spd: 60 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/36.png' },
      { id: 39,  name: 'Rondoudou',   types: ['Normal','Fée'],
        stats: { hp: 115, atk: 45, def: 20, spd: 20 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png' },
      { id: 40,  name: 'Grodoudou',   types: ['Normal','Fée'],
        stats: { hp: 140, atk: 70, def: 45, spd: 45 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/40.png' },
      // Fossiles
      { id: 138, name: 'Amonita',     types: ['Roche','Eau'],
        stats: { hp: 35, atk: 40, def: 100, spd: 35 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/138.png' },
      { id: 139, name: 'Amonistar',   types: ['Roche','Eau'],
        stats: { hp: 60, atk: 105, def: 100, spd: 45 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/139.png' },
      { id: 140, name: 'Kabuto',      types: ['Roche','Eau'],
        stats: { hp: 30, atk: 80, def: 90, spd: 55 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/140.png' },
      { id: 141, name: 'Kabutops',    types: ['Roche','Eau'],
        stats: { hp: 60, atk: 115, def: 105, spd: 80 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/141.png' },
      { id: 142, name: 'Ptéra',       types: ['Roche','Vol'],
        stats: { hp: 80, atk: 105, def: 65, spd: 130 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/142.png' },
    ]
  },
];

// Fusionne les deux listes pour usage dans les arènes/map
export const ALL_TRAINER_ARCHETYPES = [
  ...TRAINER_ARCHETYPES,
  ...TRAINER_ARCHETYPES_EXTRA,
];
