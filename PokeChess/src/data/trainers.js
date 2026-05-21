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
        stats: { hp: 95, atk: 75, spa: 100, def: 110, spd_def: 80, spd: 30 },
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
      { id: 118, name: "Poisson-Rouge", types: ["Eau"],
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
        stats: { hp: 95, atk: 75, spa: 100, def: 110, spd_def: 80, spd: 30 },
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
      { id:  51, name: "Dugtrio", types: ["Sol"],
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
export function generateEnemyTeam(archetype, targetBudget, maxUnits = 6) {
  const pool    = [...archetype.pool];
  const team    = [];
  let   budget  = 0;
  let   attempts = 0;

  while (budget < targetBudget && team.length < maxUnits && attempts < 50) {
    attempts++;

    // Filtre les pokémons qui ne font pas exploser le budget
    const remaining  = targetBudget - budget;
    const affordable = pool.filter(p => {
      const cost = p.stats.hp + p.stats.atk + p.stats.def + p.stats.spd;
      return cost <= remaining + 50;  // petite tolérance
    });

    if (affordable.length === 0) break;

    // Pioche un pokémon aléatoire dans les abordables
    const pick = affordable[Math.floor(Math.random() * affordable.length)];
    const cost = pick.stats.hp + pick.stats.atk + pick.stats.def + pick.stats.spd;

    // Position aléatoire sur la grille 3x2
    const availableCells = [];
    for (let col = 0; col < 3; col++)
      for (let row = 0; row < 2; row++)
        if (!team.find(u => u.col === col && u.row === row))
          availableCells.push({ col, row });

    if (availableCells.length === 0) break;

    const cell = availableCells[Math.floor(Math.random() * availableCells.length)];
    team.push({ ...pick, col: cell.col, row: cell.row, attributes: [] });
    budget += cost;
  }

  return team;
}