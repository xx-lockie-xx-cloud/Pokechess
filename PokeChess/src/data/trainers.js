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
    pool:  [
      { id: 54,  name: 'Psykokwak', types: ['Eau'],
        stats: { hp: 50, atk: 52, def: 48, spd: 55 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png' },
      { id: 60,  name: 'Ptitard',   types: ['Eau'],
        stats: { hp: 40, atk: 48, def: 43, spd: 65 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/60.png' },
      { id: 61,  name: 'Têtarte',   types: ['Eau'],
        stats: { hp: 75, atk: 65, def: 65, spd: 90 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/61.png' },
      { id: 62,  name: 'Tartard',   types: ['Eau', 'Combat'],
        stats: { hp: 90, atk: 95, def: 95, spd: 70 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/62.png' },
      { id: 7,   name: 'Carapuce',  types: ['Eau'],
        stats: { hp: 44, atk: 48, def: 65, spd: 43 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png' },
      { id: 8,   name: 'Carabaffe', types: ['Eau'],
        stats: { hp: 59, atk: 63, def: 80, spd: 58 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/8.png' },
      { id: 9,   name: 'Tortank',   types: ['Eau'],
        stats: { hp: 79, atk: 83, def: 100, spd: 78 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/9.png' },
    ]
  },
  {
    id:    'telekinesiste',
    name:  'Télékinésiste',
    types: ['Psy'],
    color:       0x9c59d1,
    spriteMap:   'assets/trainers/map/telekinesiste.png',
    spriteCombat:'assets/trainers/combat/telekinesiste_c.png',
    pool:  [
      { id: 63,  name: 'Abra',      types: ['Psy'],
        stats: { hp: 25, atk: 20, def: 15, spd: 90 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/63.png' },
      { id: 64,  name: 'Kadabra',   types: ['Psy'],
        stats: { hp: 40, atk: 35, def: 30, spd: 105 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/64.png' },
      { id: 65,  name: 'Alakazam',  types: ['Psy'],
        stats: { hp: 55, atk: 50, def: 45, spd: 120 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/65.png' },
      { id: 96,  name: 'Soporifik', types: ['Psy'],
        stats: { hp: 60, atk: 48, def: 48, spd: 42 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/96.png' },
      { id: 97,  name: 'Hypnomade', types: ['Psy'],
        stats: { hp: 85, atk: 73, def: 70, spd: 67 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/97.png' },
      { id: 150, name: 'Mewtwo',    types: ['Psy'],
        stats: { hp: 106, atk: 110, def: 90, spd: 130 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png' },
    ]
  },
  {
    id:    'montagnard',
    name:  'Montagnard',
    types: ['Roche', 'Sol'],
    color:       0x8e7348,
    spriteMap:   'assets/trainers/map/montagnard.png',
    spriteCombat:'assets/trainers/combat/montagnard_c.png',
    pool:  [
      { id: 74,  name: 'Racaillou', types: ['Roche', 'Sol'],
        stats: { hp: 40, atk: 80, def: 100, spd: 20 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/74.png' },
      { id: 75,  name: 'Gravalanch', types: ['Roche', 'Sol'],
        stats: { hp: 55, atk: 95, def: 115, spd: 35 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/75.png' },
      { id: 76,  name: 'Grolem',    types: ['Roche', 'Sol'],
        stats: { hp: 80, atk: 120, def: 130, spd: 45 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/76.png' },
      { id: 111, name: 'Rhinocorne', types: ['Sol', 'Roche'],
        stats: { hp: 80, atk: 85, def: 95, spd: 25 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/111.png' },
      { id: 112, name: 'Rhinoféros', types: ['Sol', 'Roche'],
        stats: { hp: 105, atk: 130, def: 120, spd: 40 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/112.png' },
    ]
  },
  {
    id:    'pyromaniac',
    name:  'Pyromaniaque',
    types: ['Feu'],
    color:       0xe84118,
    spriteMap:   'assets/trainers/map/pyromaniac.png',
    spriteCombat:'assets/trainers/combat/pyromaniac_c.png',
    pool:  [
      { id: 4,   name: 'Salamèche', types: ['Feu'],
        stats: { hp: 39, atk: 52, def: 43, spd: 65 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png' },
      { id: 5,   name: 'Reptincel', types: ['Feu'],
        stats: { hp: 58, atk: 64, def: 58, spd: 80 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/5.png' },
      { id: 6,   name: 'Dracaufeu', types: ['Feu', 'Vol'],
        stats: { hp: 78, atk: 84, def: 78, spd: 100 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png' },
      { id: 37,  name: 'Goupix',    types: ['Feu'],
        stats: { hp: 38, atk: 41, def: 40, spd: 65 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/37.png' },
      { id: 38,  name: 'Feunard',   types: ['Feu'],
        stats: { hp: 73, atk: 76, def: 75, spd: 100 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/38.png' },
    ]
  },
  {
    id:    'insectologue',
    name:  'Insectologue',
    types: ['Insecte'],
    color:       0x44bd32,
    spriteMap:   'assets/trainers/map/insectologue.png',
    spriteCombat:'assets/trainers/combat/insectologue_c.png',
    pool:  [
      { id: 10,  name: 'Chenipan',  types: ['Insecte'],
        stats: { hp: 45, atk: 30, def: 35, spd: 45 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10.png' },
      { id: 12,  name: 'Papilusion', types: ['Insecte', 'Vol'],
        stats: { hp: 60, atk: 45, def: 50, spd: 70 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/12.png' },
      { id: 13,  name: 'Aspicot',   types: ['Insecte', 'Poison'],
        stats: { hp: 45, atk: 35, def: 30, spd: 35 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/13.png' },
      { id: 15,  name: 'Dardargnan', types: ['Insecte', 'Poison'],
        stats: { hp: 65, atk: 90, def: 40, spd: 75 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/15.png' },
      { id: 127, name: 'Scarabrute', types: ['Insecte'],
        stats: { hp: 65, atk: 125, def: 100, spd: 85 },
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/127.png' },
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