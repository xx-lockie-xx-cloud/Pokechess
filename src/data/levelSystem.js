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