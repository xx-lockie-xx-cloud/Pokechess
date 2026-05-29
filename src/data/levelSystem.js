// ─────────────────────────────────────────────────────────────────────────────
// levelSystem.js — Système de niveaux persistants entre les runs
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_LEVEL      = 100;
export const BONUS_PER_LEVEL = 0.005;  // +0.5% par niveau

// ─────────────────────────────────────────────────────────────────────────────
// getLevelBonus(level) → multiplicateur de stats
// Niveau 1 = ×1.005 | Niveau 50 = ×1.25 | Niveau 100 = ×1.50
// ─────────────────────────────────────────────────────────────────────────────
export function getLevelBonus(level) {
  return 1 + Math.max(0, (level - 1)) * BONUS_PER_LEVEL;
}

// ─────────────────────────────────────────────────────────────────────────────
// getPokemonLevel(meta, pokemonId) → niveau actuel (1 minimum)
// ─────────────────────────────────────────────────────────────────────────────
export function getPokemonLevel(meta, pokemonId) {
  return meta?.pokemonLevels?.[pokemonId] ?? 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// applyLevelBonus(baseStats, level) → stats avec bonus de niveau appliqué
// ─────────────────────────────────────────────────────────────────────────────
export function applyLevelBonus(baseStats, level) {
  if (!level || level <= 1) return { ...baseStats };
  const mult = getLevelBonus(level);
  const result = {};
  for (const [k, v] of Object.entries(baseStats)) {
    result[k] = Math.round(v * mult);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// gainLevel(meta, pokemonId) → { meta, gained, newLevel }
// Incrémente le niveau d'un pokémon dans la meta save
// ─────────────────────────────────────────────────────────────────────────────
export function gainLevel(meta, pokemonId) {
  const current  = getPokemonLevel(meta, pokemonId);
  if (current >= MAX_LEVEL) return { meta, gained: false, newLevel: MAX_LEVEL };
  const newLevel = current + 1;
  const newMeta  = {
    ...meta,
    pokemonLevels: {
      ...(meta.pokemonLevels ?? {}),
      [pokemonId]: newLevel,
    },
  };
  return { meta: newMeta, gained: true, newLevel };
}

// ─────────────────────────────────────────────────────────────────────────────
// getLevelColor(level) → couleur CSS selon le palier de niveau
// ─────────────────────────────────────────────────────────────────────────────
export function getLevelColor(level) {
  if (level >= 100) return '#ffd700';  // doré — max
  if (level >= 75)  return '#a29bfe';  // violet — élite
  if (level >= 50)  return '#74b9ff';  // bleu — vétéran
  if (level >= 25)  return '#55efc4';  // vert — expérimenté
  return '#a0aec0';                    // gris — débutant
}

// ─────────────────────────────────────────────────────────────────────────────
// getLevelBadgeHTML(level) → HTML du badge niveau
// ─────────────────────────────────────────────────────────────────────────────
export function getLevelBadgeHTML(level) {
  const color = getLevelColor(level);
  return `<span class="level-badge" style="color:${color};border-color:${color}">Nv.${level}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIFFICULTY SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
export const DIFFICULTIES = [
  {
    id:       'easy',
    label:    '🌿 Facile',
    desc:     'Ennemis à -20%. Idéal pour découvrir.',
    mult:     0.8,
    unlockAt: 0,  // toujours disponible
  },
  {
    id:       'normal',
    label:    '⚔️ Normal',
    desc:     'L\'expérience de base.',
    mult:     1.0,
    unlockAt: 0,
  },
  {
    id:       'hard',
    label:    '🔥 Difficile',
    desc:     'Ennemis à +30%. Débloqué après 1 run complète.',
    mult:     1.3,
    unlockAt: 1,  // après 1 run complète (toutes les arènes)
  },
  {
    id:       'expert',
    label:    '💀 Expert',
    desc:     'Ennemis à +70%. Requiert 3 succès Ligue.',
    mult:     1.7,
    unlockAt: 3,
    unlockType: 'league_achievements',  // 3 succès "Ligue" requis
  },
];

export function getDifficulty(id) {
  return DIFFICULTIES.find(d => d.id === id) ?? DIFFICULTIES[1];
}

export function getUnlockedDifficulties(meta) {
  const completedRuns = meta?.completedRuns ?? 0;
  return DIFFICULTIES.filter(d => completedRuns >= d.unlockAt);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACHIEVEMENTS — Définitions
// ─────────────────────────────────────────────────────────────────────────────
const TYPES_LIST = [
  'Feu','Eau','Plante','Électrik','Psy','Glace','Combat','Poison',
  'Sol','Vol','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée','Normal',
];

const TYPE_ICONS = {
  Feu:'🔥', Eau:'💧', Plante:'🌿', Électrik:'⚡', Psy:'🔮', Glace:'❄️',
  Combat:'🥊', Poison:'☠️', Sol:'🏔', Vol:'🦅', Insecte:'🦋', Roche:'🪨',
  Spectre:'👻', Dragon:'🐉', Ténèbres:'🌑', Acier:'⚙️', Fée:'🧚', Normal:'⭐',
};

export const ACHIEVEMENTS = {
  // ── Ligue par type (6 pokémons du même type pour finir) ────────────────────
  ...Object.fromEntries(TYPES_LIST.map(t => [
    `league_${t.toLowerCase()}`,
    {
      id:       `league_${t.toLowerCase()}`,
      label:    `${TYPE_ICONS[t]} Champion ${t}`,
      desc:     `Finir la ligue avec 6 pokémons de type ${t}`,
      category: 'league',
      isLeague: true,
    }
  ])),

  // ── Progression ────────────────────────────────────────────────────────────
  premier_badge: {
    id: 'premier_badge', label: '🏅 Premier Pas',
    desc: 'Vaincre ta première arène', category: 'progression',
  },
  champion_kanto: {
    id: 'champion_kanto', label: '🏆 Champion de Kanto',
    desc: 'Battre les 8 arènes en une run', category: 'progression',
  },

  // ── Collection / Pokédex ───────────────────────────────────────────────────
  curieux: {
    id: 'curieux', label: '📖 Curieux',
    desc: 'Rencontrer 50 pokémons différents', category: 'collection',
  },
  encyclopedie: {
    id: 'encyclopedie', label: '📖 Encyclopédie',
    desc: 'Rencontrer les 151 pokémons', category: 'collection',
  },
  coup_de_chance: {
    id: 'coup_de_chance', label: '⭐ Coup de Chance',
    desc: 'Capturer un pokémon T5 (légendaire)', category: 'collection',
  },

  // ── Niveaux ────────────────────────────────────────────────────────────────
  lv25: {
    id: 'lv25', label: '⬆ Vétéran',
    desc: 'Monter un pokémon au niveau 25', category: 'level',
  },
  lv50: {
    id: 'lv50', label: '⬆ Expérimenté',
    desc: 'Monter un pokémon au niveau 50', category: 'level',
  },
  lv100: {
    id: 'lv100', label: '👑 Maître',
    desc: 'Monter un pokémon au niveau 100', category: 'level',
  },
  reptincel_100: {
    id: 'reptincel_100', label: "🔥 L'Amour du Feu",
    desc: 'Monter Reptincel au niveau 100', category: 'level',
  },

  // ── Combat ─────────────────────────────────────────────────────────────────
  ultime: {
    id: 'ultime', label: '⚡ Ultime !',
    desc: 'Déclencher une capacité ultime', category: 'combat',
  },
  exterminateur: {
    id: 'exterminateur', label: '💀 Exterminateur',
    desc: 'Gagner un combat sans perdre un pokémon', category: 'combat',
  },
  synergiste: {
    id: 'synergiste', label: '🔗 Synergiste',
    desc: 'Activer 3 synergies différentes simultanément', category: 'combat',
  },
  empoisonneur: {
    id: 'empoisonneur', label: '🌀 Empoisonneur',
    desc: 'Empoisonner 5 stacks en un combat', category: 'combat',
  },
  sacrifice: {
    id: 'sacrifice', label: '💥 Sacrifice Héroïque',
    desc: 'Gagner un combat grâce à une Explosion', category: 'combat',
  },
  riche: {
    id: 'riche', label: '💰 Riche',
    desc: 'Finir une arène avec 20 pièces ou plus', category: 'roguelite',
  },
  legendaire_team: {
    id: 'legendaire_team', label: '👑 Légendaire',
    desc: 'Avoir 2 pokémons T5 dans son équipe', category: 'roguelite',
  },

  lv100_feu_1: {
    id: 'lv100_feu_1', label: '🔥 Maître Feu',
    desc: 'Monter 1 pokémon de type Feu au niveau 100', category: 'level',
    typeFilter: 'Feu', countNeeded: 1,
  },
  lv100_feu_3: {
    id: 'lv100_feu_3', label: '🔥 Grand Maître Feu',
    desc: 'Monter 3 pokémons de type Feu au niveau 100', category: 'level',
    typeFilter: 'Feu', countNeeded: 3,
  },
  lv100_eau_1: {
    id: 'lv100_eau_1', label: '💧 Maître Eau',
    desc: 'Monter 1 pokémon de type Eau au niveau 100', category: 'level',
    typeFilter: 'Eau', countNeeded: 1,
  },
  lv100_eau_3: {
    id: 'lv100_eau_3', label: '💧 Grand Maître Eau',
    desc: 'Monter 3 pokémons de type Eau au niveau 100', category: 'level',
    typeFilter: 'Eau', countNeeded: 3,
  },
  lv100_plante_1: {
    id: 'lv100_plante_1', label: '🌿 Maître Plante',
    desc: 'Monter 1 pokémon de type Plante au niveau 100', category: 'level',
    typeFilter: 'Plante', countNeeded: 1,
  },
  lv100_plante_3: {
    id: 'lv100_plante_3', label: '🌿 Grand Maître Plante',
    desc: 'Monter 3 pokémons de type Plante au niveau 100', category: 'level',
    typeFilter: 'Plante', countNeeded: 3,
  },
  lv100_electrik_1: {
    id: 'lv100_electrik_1', label: '⚡ Maître Électrik',
    desc: 'Monter 1 pokémon de type Électrik au niveau 100', category: 'level',
    typeFilter: 'Électrik', countNeeded: 1,
  },
  lv100_electrik_3: {
    id: 'lv100_electrik_3', label: '⚡ Grand Maître Électrik',
    desc: 'Monter 3 pokémons de type Électrik au niveau 100', category: 'level',
    typeFilter: 'Électrik', countNeeded: 3,
  },
  lv100_psy_1: {
    id: 'lv100_psy_1', label: '🔮 Maître Psy',
    desc: 'Monter 1 pokémon de type Psy au niveau 100', category: 'level',
    typeFilter: 'Psy', countNeeded: 1,
  },
  lv100_psy_3: {
    id: 'lv100_psy_3', label: '🔮 Grand Maître Psy',
    desc: 'Monter 3 pokémons de type Psy au niveau 100', category: 'level',
    typeFilter: 'Psy', countNeeded: 3,
  },
  lv100_glace_1: {
    id: 'lv100_glace_1', label: '❄️ Maître Glace',
    desc: 'Monter 1 pokémon de type Glace au niveau 100', category: 'level',
    typeFilter: 'Glace', countNeeded: 1,
  },
  lv100_glace_3: {
    id: 'lv100_glace_3', label: '❄️ Grand Maître Glace',
    desc: 'Monter 3 pokémons de type Glace au niveau 100', category: 'level',
    typeFilter: 'Glace', countNeeded: 3,
  },
  lv100_combat_1: {
    id: 'lv100_combat_1', label: '🥊 Maître Combat',
    desc: 'Monter 1 pokémon de type Combat au niveau 100', category: 'level',
    typeFilter: 'Combat', countNeeded: 1,
  },
  lv100_combat_3: {
    id: 'lv100_combat_3', label: '🥊 Grand Maître Combat',
    desc: 'Monter 3 pokémons de type Combat au niveau 100', category: 'level',
    typeFilter: 'Combat', countNeeded: 3,
  },
  lv100_poison_1: {
    id: 'lv100_poison_1', label: '☠️ Maître Poison',
    desc: 'Monter 1 pokémon de type Poison au niveau 100', category: 'level',
    typeFilter: 'Poison', countNeeded: 1,
  },
  lv100_poison_3: {
    id: 'lv100_poison_3', label: '☠️ Grand Maître Poison',
    desc: 'Monter 3 pokémons de type Poison au niveau 100', category: 'level',
    typeFilter: 'Poison', countNeeded: 3,
  },
  lv100_sol_1: {
    id: 'lv100_sol_1', label: '🏔 Maître Sol',
    desc: 'Monter 1 pokémon de type Sol au niveau 100', category: 'level',
    typeFilter: 'Sol', countNeeded: 1,
  },
  lv100_sol_3: {
    id: 'lv100_sol_3', label: '🏔 Grand Maître Sol',
    desc: 'Monter 3 pokémons de type Sol au niveau 100', category: 'level',
    typeFilter: 'Sol', countNeeded: 3,
  },
  lv100_vol_1: {
    id: 'lv100_vol_1', label: '🦅 Maître Vol',
    desc: 'Monter 1 pokémon de type Vol au niveau 100', category: 'level',
    typeFilter: 'Vol', countNeeded: 1,
  },
  lv100_vol_3: {
    id: 'lv100_vol_3', label: '🦅 Grand Maître Vol',
    desc: 'Monter 3 pokémons de type Vol au niveau 100', category: 'level',
    typeFilter: 'Vol', countNeeded: 3,
  },
  lv100_insecte_1: {
    id: 'lv100_insecte_1', label: '🦋 Maître Insecte',
    desc: 'Monter 1 pokémon de type Insecte au niveau 100', category: 'level',
    typeFilter: 'Insecte', countNeeded: 1,
  },
  lv100_insecte_3: {
    id: 'lv100_insecte_3', label: '🦋 Grand Maître Insecte',
    desc: 'Monter 3 pokémons de type Insecte au niveau 100', category: 'level',
    typeFilter: 'Insecte', countNeeded: 3,
  },
  lv100_roche_1: {
    id: 'lv100_roche_1', label: '🪨 Maître Roche',
    desc: 'Monter 1 pokémon de type Roche au niveau 100', category: 'level',
    typeFilter: 'Roche', countNeeded: 1,
  },
  lv100_roche_3: {
    id: 'lv100_roche_3', label: '🪨 Grand Maître Roche',
    desc: 'Monter 3 pokémons de type Roche au niveau 100', category: 'level',
    typeFilter: 'Roche', countNeeded: 3,
  },
  lv100_spectre_1: {
    id: 'lv100_spectre_1', label: '👻 Maître Spectre',
    desc: 'Monter 1 pokémon de type Spectre au niveau 100', category: 'level',
    typeFilter: 'Spectre', countNeeded: 1,
  },
  lv100_spectre_3: {
    id: 'lv100_spectre_3', label: '👻 Grand Maître Spectre',
    desc: 'Monter 3 pokémons de type Spectre au niveau 100', category: 'level',
    typeFilter: 'Spectre', countNeeded: 3,
  },
  lv100_dragon_1: {
    id: 'lv100_dragon_1', label: '🐉 Maître Dragon',
    desc: 'Monter 1 pokémon de type Dragon au niveau 100', category: 'level',
    typeFilter: 'Dragon', countNeeded: 1,
  },
  lv100_dragon_3: {
    id: 'lv100_dragon_3', label: '🐉 Grand Maître Dragon',
    desc: 'Monter 3 pokémons de type Dragon au niveau 100', category: 'level',
    typeFilter: 'Dragon', countNeeded: 3,
  },
  lv100_tenebres_1: {
    id: 'lv100_tenebres_1', label: '🌑 Maître Ténèbres',
    desc: 'Monter 1 pokémon de type Ténèbres au niveau 100', category: 'level',
    typeFilter: 'Ténèbres', countNeeded: 1,
  },
  lv100_tenebres_3: {
    id: 'lv100_tenebres_3', label: '🌑 Grand Maître Ténèbres',
    desc: 'Monter 3 pokémons de type Ténèbres au niveau 100', category: 'level',
    typeFilter: 'Ténèbres', countNeeded: 3,
  },
  lv100_acier_1: {
    id: 'lv100_acier_1', label: '⚙️ Maître Acier',
    desc: 'Monter 1 pokémon de type Acier au niveau 100', category: 'level',
    typeFilter: 'Acier', countNeeded: 1,
  },
  lv100_acier_3: {
    id: 'lv100_acier_3', label: '⚙️ Grand Maître Acier',
    desc: 'Monter 3 pokémons de type Acier au niveau 100', category: 'level',
    typeFilter: 'Acier', countNeeded: 3,
  },
  lv100_fee_1: {
    id: 'lv100_fee_1', label: '🧚 Maître Fée',
    desc: 'Monter 1 pokémon de type Fée au niveau 100', category: 'level',
    typeFilter: 'Fée', countNeeded: 1,
  },
  lv100_fee_3: {
    id: 'lv100_fee_3', label: '🧚 Grand Maître Fée',
    desc: 'Monter 3 pokémons de type Fée au niveau 100', category: 'level',
    typeFilter: 'Fée', countNeeded: 3,
  },
  lv100_normal_1: {
    id: 'lv100_normal_1', label: '⭐ Maître Normal',
    desc: 'Monter 1 pokémon de type Normal au niveau 100', category: 'level',
    typeFilter: 'Normal', countNeeded: 1,
  },
  lv100_normal_3: {
    id: 'lv100_normal_3', label: '⭐ Grand Maître Normal',
    desc: 'Monter 3 pokémons de type Normal au niveau 100', category: 'level',
    typeFilter: 'Normal', countNeeded: 3,
  },
};

// Compte les achievements de catégorie "league"
export function countLeagueAchievements(meta) {
  const unlocked = meta?.achievements ?? {};
  return Object.values(ACHIEVEMENTS)
    .filter(a => a.isLeague && unlocked[a.id]?.unlocked)
    .length;
}

// Met à jour getUnlockedDifficulties pour utiliser countLeagueAchievements
export function getUnlockedDifficultiesWithMeta(meta) {
  const leagueCount   = countLeagueAchievements(meta);
  const completedRuns = meta?.completedRuns ?? 0;
  return DIFFICULTIES.filter(d => {
    if (d.unlockType === 'league_achievements') return leagueCount >= d.unlockAt;
    return completedRuns >= d.unlockAt;
  });
}

// Passifs de niveau — maintenant dans passiveHooks.js
// Re-export pour compatibilité
export { POKEMON_PASSIVES, getUnitPassives, getPokemonPassive }
  from './passiveHooks.js';

// ═══════════════════════════════════════════════════════════════════════════
// ARBRES DE TALENTS — 18 types × 3 nœuds (coûts 1pt / 2pt / 3pt)
// Les talents s'appliquent à TOUS les pokémons du type dans l'équipe
// ═══════════════════════════════════════════════════════════════════════════
export const TALENT_TREES = {
  Feu: [
    { id:'feu_1', name:'Chaleur',    cost:1, desc:'+10% ATK pokémons Feu',
      effect:{ kind:'type_stat', type:'Feu', stat:'atk', mult:1.10 } },
    { id:'feu_2', name:'Embrasement',cost:2, desc:'Brûlure 25% en attaque normale (Feu)',
      effect:{ kind:'type_proc', type:'Feu', status:'burn', chance:0.25, turns:3 } },
    { id:'feu_3', name:'Phénix',     cost:3, desc:'1 pokémon Feu ressuscite à 30% HP',
      effect:{ kind:'type_revive', type:'Feu', rate:0.30 } },
  ],
  Eau: [
    { id:'eau_1', name:'Courant',    cost:1, desc:'+10% DEF et SP.DEF pokémons Eau',
      effect:{ kind:'type_dual_stat', type:'Eau', stats:['def','spd_def'], mult:1.10 } },
    { id:'eau_2', name:'Marée',      cost:2, desc:'Régén. 3% HP tous alliés / 8 actions',
      effect:{ kind:'type_regen_all', type:'Eau', rate:0.03, period:8 } },
    { id:'eau_3', name:'Déluge',     cost:3, desc:'Attaques Eau frappent toute la rangée ennemie',
      effect:{ kind:'type_aoe_row', type:'Eau', row:'primary' } },
  ],
  Plante: [
    { id:'plante_1', name:'Sève Vitale', cost:1, desc:'+10% HP pokémons Plante',
      effect:{ kind:'type_stat', type:'Plante', stat:'hp', mult:1.10 } },
    { id:'plante_2', name:'Photosynthèse', cost:2, desc:'Soin 5% HP tous alliés / 8 actions',
      effect:{ kind:'type_regen_all', type:'Plante', rate:0.05, period:8 } },
    { id:'plante_3', name:'Forêt',    cost:3, desc:'Alliés Plante immunisés poison',
      effect:{ kind:'type_status_immunity', type:'Plante', status:'poison' } },
  ],
  Électrik: [
    { id:'elec_1', name:'Dynamo',    cost:1, desc:'+10% VIT pokémons Électrik',
      effect:{ kind:'type_stat', type:'Électrik', stat:'spd', mult:1.10 } },
    { id:'elec_2', name:'Décharge',  cost:2, desc:'Paralysie 20% en attaque (Électrik)',
      effect:{ kind:'type_proc', type:'Électrik', status:'paralyze', chance:0.20 } },
    { id:'elec_3', name:'Tempête',   cost:3, desc:'1×/combat : AoE paralysie toute équipe ennemie',
      effect:{ kind:'type_once_aoe', type:'Électrik', status:'paralyze', row:'all' } },
  ],
  Psy: [
    { id:'psy_1', name:'Concentration', cost:1, desc:'+10% SP.ATK pokémons Psy',
      effect:{ kind:'type_stat', type:'Psy', stat:'spa', mult:1.10 } },
    { id:'psy_2', name:'Vague Mentale', cost:2, desc:'Confusion 20% en attaque (Psy)',
      effect:{ kind:'type_proc', type:'Psy', status:'confuse', chance:0.20, turns:2 } },
    { id:'psy_3', name:'Télépathie',  cost:3, desc:'Pokémons Psy ignorent les effets AoE ennemis',
      effect:{ kind:'type_aoe_immunity', type:'Psy' } },
  ],
  Combat: [
    { id:'combat_1', name:'Endurance', cost:1, desc:'+10% ATK pokémons Combat',
      effect:{ kind:'type_stat', type:'Combat', stat:'atk', mult:1.10 } },
    { id:'combat_2', name:'Percée',   cost:2, desc:'Ignore 15% DEF ennemis (Combat)',
      effect:{ kind:'type_ignore_def', type:'Combat', pct:0.15 } },
    { id:'combat_3', name:'Contre',   cost:3, desc:'Pokémons Combat ripostent 50% dégâts physiques',
      effect:{ kind:'type_counter', type:'Combat', rate:0.50, only_physical:true } },
  ],
  Poison: [
    { id:'poison_1', name:'Virulence', cost:1, desc:'+10% durée poison appliqué',
      effect:{ kind:'type_status_boost', type:'Poison', status:'poison', mult:1.10 } },
    { id:'poison_2', name:'Toxémie',  cost:2, desc:'Tous ennemis démarrent avec 1 stack poison',
      effect:{ kind:'type_start_status', type:'Poison', status:'poison', stacks:1 } },
    { id:'poison_3', name:'Pestilence', cost:3, desc:'Poison inflige +50% dégâts supplémentaires',
      effect:{ kind:'type_dot_boost', type:'Poison', status:'poison', mult:1.50 } },
  ],
  Sol: [
    { id:'sol_1', name:'Terrain',   cost:1, desc:'+10% ATK si ennemi en rang avant (Sol)',
      effect:{ kind:'type_conditional_stat', type:'Sol', condition:'enemy_front', stat:'atk', mult:1.10 } },
    { id:'sol_2', name:'Secousse',  cost:2, desc:'10% stun en attaque (Sol)',
      effect:{ kind:'type_proc', type:'Sol', status:'stun', chance:0.10, turns:1 } },
    { id:'sol_3', name:'Séisme',    cost:3, desc:'1×/combat : AoE Sol sur tous les ennemis',
      effect:{ kind:'type_once_aoe', type:'Sol', row:'all' } },
  ],
  Vol: [
    { id:'vol_1', name:'Agilité',   cost:1, desc:'+10% esquive pokémons Vol',
      effect:{ kind:'type_evasion', type:'Vol', chance:0.10 } },
    { id:'vol_2', name:'Bourrasque', cost:2, desc:'+15% VIT pokémons Vol',
      effect:{ kind:'type_stat', type:'Vol', stat:'spd', mult:1.15 } },
    { id:'vol_3', name:'Tourbillon', cost:3, desc:'1×/combat : tous les ennemis en rang avant',
      effect:{ kind:'type_once_push_front', type:'Vol' } },
  ],
  Insecte: [
    { id:'insecte_1', name:'Essaim Actif', cost:1, desc:'+10% ATK si synergie Insecte active',
      effect:{ kind:'type_stat', type:'Insecte', stat:'atk', mult:1.10 } },
    { id:'insecte_2', name:'Ruche',  cost:2, desc:'Essaim proc à 25% (au lieu de 15%)',
      effect:{ kind:'type_swarm_boost', type:'Insecte', chance:0.25 } },
    { id:'insecte_3', name:'Colonie', cost:3, desc:'Chaque K.O. ennemi déclenche Essaim auto',
      effect:{ kind:'type_swarm_on_ko', type:'Insecte' } },
  ],
  Roche: [
    { id:'roche_1', name:'Roc Solide', cost:1, desc:'+10% DEF pokémons Roche',
      effect:{ kind:'type_stat', type:'Roche', stat:'def', mult:1.10 } },
    { id:'roche_2', name:'Granite',  cost:2, desc:'Absorbe 1 coup au début du combat (Roche)',
      effect:{ kind:'type_start_shield', type:'Roche' } },
    { id:'roche_3', name:'Forteresse', cost:3, desc:'-30% dégâts si 3+ pokémons Roche présents',
      effect:{ kind:'type_group_reduction', type:'Roche', count:3, mult:0.70 } },
  ],
  Spectre: [
    { id:'spectre_1', name:'Présence', cost:1, desc:'+10% esquive pokémons Spectre',
      effect:{ kind:'type_evasion', type:'Spectre', chance:0.10 } },
    { id:'spectre_2', name:'Malédiction', cost:2, desc:'20% malédiction en attaque (Spectre)',
      effect:{ kind:'type_proc', type:'Spectre', status:'curse_dot', chance:0.20 } },
    { id:'spectre_3', name:'Plan Astral', cost:3, desc:'1×/combat : tous les Spectre immunisés 1 action',
      effect:{ kind:'type_once_untargetable', type:'Spectre', turns:1 } },
  ],
  Dragon: [
    { id:'dragon_1', name:'Écailles',  cost:1, desc:'+15% ATK et SP.ATK pokémons Dragon',
      effect:{ kind:'type_dual_stat', type:'Dragon', stats:['atk','spa'], mult:1.10 } },
    { id:'dragon_2', name:'Fureur',    cost:2, desc:'+10% dégâts par allié Dragon vivant',
      effect:{ kind:'type_stack_per_ally', type:'Dragon', mult:0.10 } },
    { id:'dragon_3', name:'Maître Dragon', cost:3, desc:'Pokémons Dragon ignorent les résistances',
      effect:{ kind:'type_ignore_resistance', type:'Dragon' } },
  ],
  Glace: [
    { id:'glace_1', name:'Froid',    cost:1, desc:'+10% dégâts Glace',
      effect:{ kind:'type_stat', type:'Glace', stat:'spa', mult:1.10 } },
    { id:'glace_2', name:'Givre',    cost:2, desc:'Gel 20% en attaque (Glace)',
      effect:{ kind:'type_proc', type:'Glace', status:'freeze', chance:0.20 } },
    { id:'glace_3', name:'Grand Froid', cost:3, desc:'-15% VIT tous ennemis permanent',
      effect:{ kind:'type_start_debuff', type:'Glace', stat:'spd', mult:0.85 } },
  ],
  Acier: [
    { id:'acier_1', name:'Alliage',  cost:1, desc:'+10% DEF pokémons Acier',
      effect:{ kind:'type_stat', type:'Acier', stat:'def', mult:1.10 } },
    { id:'acier_2', name:'Trempe',   cost:2, desc:'Immunisé poison pokémons Acier',
      effect:{ kind:'type_status_immunity', type:'Acier', status:'poison' } },
    { id:'acier_3', name:'Métal Dur', cost:3, desc:'-30% dégâts spéciaux reçus (Acier)',
      effect:{ kind:'type_damage_reduction_special', type:'Acier', mult:0.70 } },
  ],
  Fée: [
    { id:'fee_1', name:'Enchantement', cost:1, desc:'+10% SP.ATK pokémons Fée',
      effect:{ kind:'type_stat', type:'Fée', stat:'spa', mult:1.10 } },
    { id:'fee_2', name:'Féerie',  cost:2, desc:'Confusion AoE rangée avant au début (si Fée présente)',
      effect:{ kind:'type_start_aoe_status', type:'Fée', status:'confuse', row:'front', chance:0.40 } },
    { id:'fee_3', name:'Rempart Fée', cost:3, desc:'Alliés immunisés aux effets Dragon',
      effect:{ kind:'all_immunity_type', immune_type:'Dragon' } },
  ],
  Normal: [
    { id:'normal_1', name:'Polyvalence', cost:1, desc:'+10% à la stat dominante (Normal)',
      effect:{ kind:'type_boost_highest', type:'Normal', mult:1.10 } },
    { id:'normal_2', name:'Diversité', cost:2, desc:'+5% stats par type différent dans l\'équipe',
      effect:{ kind:'type_stack_per_type', type:'Normal', per_type:0.05 } },
    { id:'normal_3', name:'Touche à Tout', cost:3, desc:'+1 emplacement terrain bonus',
      effect:{ kind:'bonus_slot', amount:1 } },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────
// Retourne le passif d'un pokémon pour un niveau donné (ou null)

// ── Helpers Talents ───────────────────────────────────────────────────────
export function getTalentCost(type, nodeIndex) {
  return TALENT_TREES[type]?.[nodeIndex]?.cost ?? 99;
}

export function getUnlockedTalents(meta, type) {
  const tree    = TALENT_TREES[type];
  if (!tree) return [];
  const unlocked = meta?.talentTree?.[type] ?? [];
  return tree.filter((_, i) => unlocked[i]);
}

export function calcTalentPointsGained(badgesEarned = []) {
  return badgesEarned.length;
}
