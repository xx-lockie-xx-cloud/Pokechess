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

// ═══════════════════════════════════════════════════════════════════════════
// PASSIFS DE NIVEAU — débloqués à Nv.35 et Nv.70
// Structure : { kind, ...params }
// Kinds : regen_self | stat_boost | on_attack_proc | fury | intimidate |
//         drain_attack | on_death_aoe | damage_absorb | revive |
//         aoe_start_status | on_ko_boost | counter | dot_target | priority_once
// ═══════════════════════════════════════════════════════════════════════════
export const POKEMON_PASSIVES = {
  // ── Starters Plante ──────────────────────────────────────────────────────
  1:  { 35: { id:'seve',         name:'Sève',          desc:'Soigne 5% HP à chaque action',
               effect:{ kind:'regen_self', rate:0.05 } },
        70: { id:'chlorophylle', name:'Chlorophylle',  desc:'+20% VIT passif',
               effect:{ kind:'stat_boost', stat:'spd', mult:1.20 } } },
  2:  { 35: { id:'poudre_toxik', name:'Poudre Toxik',  desc:'20% empoisonner en attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:0.20 } },
        70: { id:'symbiose',     name:'Symbiose',       desc:'Soigne 10% HP à l\'allié le plus blessé/8 actions',
               effect:{ kind:'regen_ally', rate:0.10, period:8 } } },
  3:  { 35: { id:'enracinement', name:'Enracinement',  desc:'Absorbe 8% des dégâts reçus',
               effect:{ kind:'drain_on_receive', rate:0.08 } },
        70: { id:'mega_drain_p', name:'Méga-Sangsue',  desc:'Drain 15% des dégâts infligés',
               effect:{ kind:'drain_attack', rate:0.15 } } },
  // ── Starters Feu ─────────────────────────────────────────────────────────
  4:  { 35: { id:'brasier',      name:'Brasier',        desc:'Si PV<50% → +20% ATK',
               effect:{ kind:'fury', stat:'atk', mult:1.20, threshold:0.50 } },
        70: { id:'torche',       name:'Torche',          desc:'Immunisé brûlure, absorbe dégâts Feu',
               effect:{ kind:'type_immunity', type:'Feu' } } },
  5:  { 35: { id:'brasier_plus', name:'Brasier+',       desc:'Si PV<50% → +35% ATK et SP.ATK',
               effect:{ kind:'fury_dual', stats:['atk','spa'], mult:1.35, threshold:0.50 } },
        70: { id:'combustion',   name:'Combustion',     desc:'Chaque attaque brûle la cible 1 tour',
               effect:{ kind:'on_attack_proc', status:'burn', chance:1.0, turns:1 } } },
  6:  { 35: { id:'feu_sacre',    name:'Feu Sacré',      desc:'30% brûle en attaque',
               effect:{ kind:'on_attack_proc', status:'burn', chance:0.30, turns:3 } },
        70: { id:'pression_feu', name:'Pression',       desc:'-20% ATK et SP.DEF ennemis au début',
               effect:{ kind:'intimidate', stats:['atk','spd_def'], mult:0.80 } } },
  // ── Starters Eau ─────────────────────────────────────────────────────────
  7:  { 35: { id:'carapace',     name:'Carapace',       desc:'-20% dégâts reçus',
               effect:{ kind:'damage_reduction', mult:0.80 } },
        70: { id:'turbo_cara',   name:'Turbo-Carapace', desc:'Premier coup absorbé chaque combat',
               effect:{ kind:'damage_absorb' } } },
  8:  { 35: { id:'carapace_plus',name:'Carapace+',      desc:'-25% dégâts + riposte 30%',
               effect:{ kind:'damage_reduction_counter', mult:0.75, counter:0.30 } },
        70: { id:'mur_eau',      name:'Mur d\'Eau',     desc:'-15% dégâts reçus par alliés adjacents',
               effect:{ kind:'damage_reduction_aura', mult:0.85 } } },
  9:  { 35: { id:'canon_eau',    name:'Canon Eau',      desc:'+20% dégâts à chaque attaque',
               effect:{ kind:'stat_boost', stat:'spa', mult:1.20 } },
        70: { id:'forteresse',   name:'Forteresse',     desc:'Immunisé recul + absorbe 1er coup',
               effect:{ kind:'tank_passive' } } },
  // ── Chenilles & Papillons ─────────────────────────────────────────────────
  10: { 35: { id:'ficelle',      name:'Ficelle',        desc:'-10% VIT cible en attaque',
               effect:{ kind:'on_hit_debuff', stat:'spd', mult:0.90 } },
        70: { id:'cocon',        name:'Cocon',           desc:'-30% dégâts reçus',
               effect:{ kind:'damage_reduction', mult:0.70 } } },
  11: { 35: { id:'armure_chry',  name:'Armure',         desc:'Absorbe 1 coup',
               effect:{ kind:'damage_absorb' } },
        70: { id:'transf_chry',  name:'Transformation', desc:'-50% dégâts reçus (chrysalide)',
               effect:{ kind:'damage_reduction', mult:0.50 } } },
  12: { 35: { id:'ecailles',     name:'Écailles',       desc:'20% esquive',
               effect:{ kind:'evasion', chance:0.20 } },
        70: { id:'danse_papillon',name:'Danse Papillon', desc:'+20% SP.ATK et SP.DEF',
               effect:{ kind:'dual_stat_boost', stats:['spa','spd_def'], mult:1.20 } } },
  13: { 35: { id:'dard_asp',     name:'Dard Venin',     desc:'30% poison en attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:0.30 } },
        70: { id:'essaim_asp',   name:'Essaim',          desc:'+20% ATK par allié Insecte',
               effect:{ kind:'stack_per_ally', type:'Insecte', stat:'atk', per_ally:0.08 } } },
  14: { 35: { id:'carapace_coco',name:'Carapace',       desc:'Absorbe 1 coup',
               effect:{ kind:'damage_absorb' } },
        70: { id:'mue',          name:'Mue',              desc:'Récupère 30% HP après 8 actions',
               effect:{ kind:'regen_self_period', rate:0.30, period:8 } } },
  15: { 35: { id:'vol_venimeux', name:'Vol Venimeux',   desc:'AoE front + poison 25%',
               effect:{ kind:'aoe_proc', status:'poison', chance:0.25, row:'front' } },
        70: { id:'noeud_poison', name:'Nœud Poison',    desc:'+1 stack poison/attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:1.0, stacks:1 } } },
  // ── Roucool ligne ─────────────────────────────────────────────────────────
  16: { 35: { id:'esquive_r',    name:'Esquive',        desc:'20% esquive',
               effect:{ kind:'evasion', chance:0.20 } },
        70: { id:'vent_r',       name:'Vent',            desc:'-10% précision ennemis',
               effect:{ kind:'intimidate', stats:['spd'], mult:0.90 } } },
  17: { 35: { id:'tornade_r',    name:'Tornade',        desc:'AoE Vol rangée avant',
               effect:{ kind:'aoe_attack_type', type:'Vol', row:'front' } },
        70: { id:'rafale',       name:'Rafale',           desc:'+20% VIT si aucun allié K.O.',
               effect:{ kind:'conditional_boost', condition:'no_ko', stat:'spd', mult:1.20 } } },
  18: { 35: { id:'acrobatie',    name:'Acrobatie',      desc:'+30% VIT',
               effect:{ kind:'stat_boost', stat:'spd', mult:1.30 } },
        70: { id:'oeil_faucon',  name:'Œil de Faucon',  desc:'Ignore esquive ennemis',
               effect:{ kind:'ignore_evasion' } } },
  // ── Rattata ligne ─────────────────────────────────────────────────────────
  19: { 35: { id:'mordant',      name:'Mordant',        desc:'20% stun 1 action',
               effect:{ kind:'on_attack_proc', status:'stun', chance:0.20, turns:1 } },
        70: { id:'agilite_r',    name:'Agilité',        desc:'+20% VIT',
               effect:{ kind:'stat_boost', stat:'spd', mult:1.20 } } },
  20: { 35: { id:'hyperdent',    name:'Hyperdent',      desc:'3 frappes (40% puissance)',
               effect:{ kind:'multi_hit', hits:3, mult:0.40 } },
        70: { id:'furie_r',      name:'Furie',           desc:'+30% ATK si PV<30%',
               effect:{ kind:'fury', stat:'atk', mult:1.30, threshold:0.30 } } },
  // ── Piafabec ligne ────────────────────────────────────────────────────────
  21: { 35: { id:'bec',          name:'Bec',             desc:'2 frappes par attaque',
               effect:{ kind:'multi_hit', hits:2, mult:0.60 } },
        70: { id:'becquetage',   name:'Becquetage',     desc:'-5% ATK ennemi/frappe',
               effect:{ kind:'on_hit_debuff', stat:'atk', mult:0.95 } } },
  22: { 35: { id:'serres',       name:'Serres',          desc:'Stun 20% 1 action',
               effect:{ kind:'on_attack_proc', status:'stun', chance:0.20, turns:1 } },
        70: { id:'predateur',    name:'Prédateur',       desc:'+20% dégâts sur cible avec statut',
               effect:{ kind:'bonus_vs_status', mult:1.20 } } },
  // ── Abo/Arbok ─────────────────────────────────────────────────────────────
  23: { 35: { id:'acide_abo',    name:'Acide',           desc:'30% empoisonne en attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:0.30 } },
        70: { id:'venin_mortel', name:'Venin Mortel',   desc:'Poison inflige ×2 sur cibles déjà empoisonnées',
               effect:{ kind:'double_poison_dmg' } } },
  24: { 35: { id:'effroi',       name:'Effroi',          desc:'-20% ATK ennemis au début',
               effect:{ kind:'intimidate', stats:['atk'], mult:0.80 } },
        70: { id:'etranglement', name:'Étranglement',   desc:'Cible empoisonnée → -20% VIT',
               effect:{ kind:'poison_slow', mult:0.80 } } },
  // ── Pikachu/Raichu ────────────────────────────────────────────────────────
  25: { 35: { id:'statik',       name:'Statik',          desc:'30% paralysie en attaque',
               effect:{ kind:'on_attack_proc', status:'paralyze', chance:0.30 } },
        70: { id:'surfeur',      name:'Surfeur',          desc:'+15% VIT si allié Eau présent',
               effect:{ kind:'conditional_boost_ally_type', type:'Eau', stat:'spd', mult:1.15 } } },
  26: { 35: { id:'coup_foudre',  name:'Coup de Foudre',  desc:'1 action/5 : AoE foudre',
               effect:{ kind:'periodic_aoe', period:5, type:'Électrik' } },
        70: { id:'surchauffe_r', name:'Surchauffe',      desc:'+40% SP.ATK, perd 5% HP/action',
               effect:{ kind:'berserker', spa_mult:1.40, hp_cost:0.05 } } },
  // ── Sabelette/Sablaireau ──────────────────────────────────────────────────
  27: { 35: { id:'sable',        name:'Sable',           desc:'+15% dégâts Sol',
               effect:{ kind:'type_damage_boost', type:'Sol', mult:1.15 } },
        70: { id:'tempete_s',    name:'Tempête',          desc:'-10% précision ennemis',
               effect:{ kind:'intimidate', stats:['spd'], mult:0.90 } } },
  28: { 35: { id:'griffe_s',     name:'Griffe',           desc:'2 frappes par attaque',
               effect:{ kind:'multi_hit', hits:2, mult:0.60 } },
        70: { id:'tranchant_s',  name:'Tranchant',        desc:'+30% ATK physique',
               effect:{ kind:'stat_boost', stat:'atk', mult:1.30 } } },
  // ── Nidoran lignes ────────────────────────────────────────────────────────
  29: { 35: { id:'dard_nido_f',  name:'Dard Venin',      desc:'25% poison en attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:0.25 } },
        70: { id:'morsure_tox',  name:'Morsure Toxique', desc:'2 stacks poison en attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:1.0, stacks:2 } } },
  30: { 35: { id:'venin_corr',   name:'Venin Corrosif',  desc:'Poison inflige +50% dégâts',
               effect:{ kind:'poison_dmg_boost', mult:1.50 } },
        70: { id:'mur_acide',    name:'Mur Acide',        desc:'-15% DEF ennemis/action',
               effect:{ kind:'on_hit_debuff', stat:'def', mult:0.93 } } },
  31: { 35: { id:'reine',        name:'Reine',            desc:'+10% stats alliés Poison',
               effect:{ kind:'aura_type_boost', type:'Poison', mult:1.10 } },
        70: { id:'domination_n', name:'Domination',       desc:'K.O. ennemi → -15% ATK AoE',
               effect:{ kind:'on_ko_debuff_aoe', stat:'atk', mult:0.85 } } },
  32: { 35: { id:'corne_tox',    name:'Corne Toxique',   desc:'30% poison en attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:0.30 } },
        70: { id:'antidote',     name:'Antidote',          desc:'Immunisé à tous les statuts',
               effect:{ kind:'status_immunity' } } },
  33: { 35: { id:'corne_venin',  name:'Corne Venin',     desc:'2 stacks poison direct',
               effect:{ kind:'on_attack_proc', status:'poison', chance:1.0, stacks:2 } },
        70: { id:'percee',       name:'Percée',            desc:'Ignore 25% DEF cible',
               effect:{ kind:'ignore_def', pct:0.25 } } },
  34: { 35: { id:'roi_nido',     name:'Roi',              desc:'+15% ATK et SP.ATK passif',
               effect:{ kind:'dual_stat_boost', stats:['atk','spa'], mult:1.15 } },
        70: { id:'fureur_roy',   name:'Fureur Royale',    desc:'+10% ATK par ennemi empoisonné',
               effect:{ kind:'stack_per_enemy_status', status:'poison', stat:'atk', per_enemy:0.10 } } },
  // ── Mélofée/Mélodelfe ─────────────────────────────────────────────────────
  35: { 35: { id:'charme_mel',   name:'Charme',           desc:'-20% ATK ennemis',
               effect:{ kind:'intimidate', stats:['atk'], mult:0.80 } },
        70: { id:'enchantement', name:'Enchantement',     desc:'Immunisé Dragon',
               effect:{ kind:'type_immunity', type:'Dragon' } } },
  36: { 35: { id:'charme_plus',  name:'Charme+',          desc:'-25% ATK + confusion 20%',
               effect:{ kind:'intimidate_proc', stats:['atk'], mult:0.75, status:'confuse', chance:0.20 } },
        70: { id:'fee_doree',    name:'Fée Dorée',        desc:'+20% stats alliés Fée',
               effect:{ kind:'aura_type_boost', type:'Fée', mult:1.20 } } },
  // ── Goupix/Feunard ────────────────────────────────────────────────────────
  37: { 35: { id:'malefice',     name:'Maléfice',         desc:'Cibles avec statut prennent ×1.5 dégâts',
               effect:{ kind:'bonus_vs_status', mult:1.50 } },
        70: { id:'feu_follet',   name:'Feu Follet',       desc:'30% brûle en attaque normale',
               effect:{ kind:'on_attack_proc', status:'burn', chance:0.30, turns:3 } } },
  38: { 35: { id:'tromperie',    name:'Tromperie',        desc:'Copie l\'ATK de la cible si supérieure',
               effect:{ kind:'copy_stat_if_higher', stat:'atk' } },
        70: { id:'illusion_ard', name:'Illusion Ardente', desc:'40% confusion en attaque',
               effect:{ kind:'on_attack_proc', status:'confuse', chance:0.40, turns:3 } } },
  // ── Rondoudou/Grodoudou ───────────────────────────────────────────────────
  39: { 35: { id:'berceuse',     name:'Berceuse',         desc:'30% sommeil en attaque',
               effect:{ kind:'on_attack_proc', status:'sleep', chance:0.30, turns:2 } },
        70: { id:'voix_mag',     name:'Voix Magique',     desc:'Endort AoE rangée avant au début',
               effect:{ kind:'aoe_start_status', status:'sleep', turns:2, row:'front' } } },
  40: { 35: { id:'berceuse_plus',name:'Berceuse+',        desc:'40% sommeil + drain HP',
               effect:{ kind:'on_attack_proc_drain', status:'sleep', chance:0.40, drain:0.10 } },
        70: { id:'chant_fatal',  name:'Chant Fatal',      desc:'Sommeil AoE + drain 10%/action',
               effect:{ kind:'aoe_start_status_dot', status:'sleep', turns:3, dot:0.10 } } },
  // ── Nosferapti/Nosferalto ─────────────────────────────────────────────────
  41: { 35: { id:'vampirisme_n', name:'Vampirisme',       desc:'Drain 15% des dégâts infligés',
               effect:{ kind:'drain_attack', rate:0.15 } },
        70: { id:'ultrason',     name:'Ultrason',          desc:'25% confusion en attaque',
               effect:{ kind:'on_attack_proc', status:'confuse', chance:0.25, turns:2 } } },
  42: { 35: { id:'mega_drain_n', name:'Méga-Drain',       desc:'Drain 25% des dégâts',
               effect:{ kind:'drain_attack', rate:0.25 } },
        70: { id:'cri_effroi',   name:'Cri d\'Effroi',   desc:'Confusion AoE rangée avant au début',
               effect:{ kind:'aoe_start_status', status:'confuse', turns:2, row:'front' } } },
  // ── Mystherbe ligne ───────────────────────────────────────────────────────
  43: { 35: { id:'spore_myst',   name:'Spore',            desc:'15% confusion en attaque',
               effect:{ kind:'on_attack_proc', status:'confuse', chance:0.15, turns:2 } },
        70: { id:'para_spore',   name:'Para-Spore',       desc:'15% paralysie en attaque',
               effect:{ kind:'on_attack_proc', status:'paralyze', chance:0.15 } } },
  44: { 35: { id:'poudre_dodo',  name:'Poudre Dodo',     desc:'20% sommeil en attaque',
               effect:{ kind:'on_attack_proc', status:'sleep', chance:0.20, turns:2 } },
        70: { id:'pollen',       name:'Pollen',            desc:'-15% VIT ennemis au début',
               effect:{ kind:'intimidate', stats:['spd'], mult:0.85 } } },
  45: { 35: { id:'fetide',       name:'Fétide',           desc:'-15% ATK ennemis au début',
               effect:{ kind:'intimidate', stats:['atk'], mult:0.85 } },
        70: { id:'arome',        name:'Arôme',             desc:'Alliés Plante immunisés statuts',
               effect:{ kind:'aura_type_immunity', type:'Plante' } } },
  // ── Paras/Parasect ────────────────────────────────────────────────────────
  46: { 35: { id:'spore_par',    name:'Spore',            desc:'30% sommeil en attaque',
               effect:{ kind:'on_attack_proc', status:'sleep', chance:0.30, turns:2 } },
        70: { id:'parasite',     name:'Parasite',          desc:'Drain 10% HP ennemi/action',
               effect:{ kind:'dot_drain', rate:0.10 } } },
  47: { 35: { id:'mycelium',     name:'Mycélium',         desc:'Zone spore AoE au début',
               effect:{ kind:'aoe_start_status', status:'sleep', turns:2, row:'all' } },
        70: { id:'zombie',       name:'Zombie',            desc:'Ressuscite 1 fois avec 20% HP',
               effect:{ kind:'revive', rate:0.20 } } },
  // ── Mimitoss/Aéromite ─────────────────────────────────────────────────────
  48: { 35: { id:'poudre_conf',  name:'Poudre',           desc:'AoE confusion 20%',
               effect:{ kind:'aoe_proc_passive', status:'confuse', chance:0.20 } },
        70: { id:'danse_mim',    name:'Danse',             desc:'+15% ATK à chaque action',
               effect:{ kind:'ramp_stat', stat:'atk', per_action:0.05, max:0.30 } } },
  49: { 35: { id:'vole_ecaille', name:'Vole-Écaille',    desc:'-15% DEF ennemis',
               effect:{ kind:'intimidate', stats:['def'], mult:0.85 } },
        70: { id:'cyclone',      name:'Cyclone',           desc:'AoE Vol sur tous les ennemis',
               effect:{ kind:'aoe_type', type:'Vol' } } },
  // ── Taupiqueur/Triopikeur ─────────────────────────────────────────────────
  50: { 35: { id:'tunnel',       name:'Tunnel',           desc:'Intouchable 1 action/5',
               effect:{ kind:'periodic_untargetable', period:5 } },
        70: { id:'seisme_t',     name:'Séisme',           desc:'Sort du sol → AoE 80%',
               effect:{ kind:'emerge_aoe', mult:0.80 } } },
  51: { 35: { id:'tunnel_3',     name:'Tunnel×3',        desc:'3 frappes (30% puissance)',
               effect:{ kind:'multi_hit', hits:3, mult:0.30 } },
        70: { id:'tremblement_t',name:'Tremblement',      desc:'-15% VIT tous ennemis',
               effect:{ kind:'intimidate', stats:['spd'], mult:0.85 } } },
  // ── Miaouss/Persian ───────────────────────────────────────────────────────
  52: { 35: { id:'jackpot',      name:'Jackpot',          desc:'+1 pièce par K.O.',
               effect:{ kind:'coins_on_ko', amount:1 } },
        70: { id:'malin',        name:'Malin',             desc:'Copie l\'objet ennemi',
               effect:{ kind:'copy_enemy_item' } } },
  53: { 35: { id:'griffe_per',   name:'Griffe',           desc:'2 frappes + -10% DEF',
               effect:{ kind:'multi_hit_debuff', hits:2, mult:0.60, stat:'def', debuff:0.90 } },
        70: { id:'elegance',     name:'Élégance',          desc:'+30% VIT si seul de son type',
               effect:{ kind:'lone_type_boost', stat:'spd', mult:1.30 } } },
  // ── Psykokwak/Akwakwak ────────────────────────────────────────────────────
  54: { 35: { id:'migraine',     name:'Migraine',         desc:'25% confusion sur attaque reçue',
               effect:{ kind:'on_receive_proc', status:'confuse', chance:0.25, turns:2 } },
        70: { id:'zen',          name:'Zen',               desc:'Si confus → +40% SP.ATK',
               effect:{ kind:'status_buff', status:'confuse', stat:'spa', mult:1.40 } } },
  55: { 35: { id:'hydrochoc',    name:'Hydrochoc',        desc:'-15% SP.DEF ennemis/action',
               effect:{ kind:'on_hit_debuff', stat:'spd_def', mult:0.93 } },
        70: { id:'deluge',       name:'Déluge',            desc:'Zone eau frappe toute la rangée',
               effect:{ kind:'aoe_attack_type', type:'Eau', row:'primary' } } },
  // ── Férosinge/Colossinge ──────────────────────────────────────────────────
  56: { 35: { id:'rage_fer',     name:'Rage',             desc:'+5% ATK par coup reçu',
               effect:{ kind:'rage_stack', stat:'atk', per_hit:0.05, max:0.40 } },
        70: { id:'fureur_fer',   name:'Fureur',           desc:'Double la rage si PV<50%',
               effect:{ kind:'rage_double_threshold', threshold:0.50 } } },
  57: { 35: { id:'mach_punch',   name:'Mach Punch',      desc:'Priorité sur 1 attaque/combat',
               effect:{ kind:'priority_once' } },
        70: { id:'uppercut',     name:'Uppercut',          desc:'30% stun 1 action',
               effect:{ kind:'on_attack_proc', status:'stun', chance:0.30, turns:1 } } },
  // ── Caninos/Arcanin ───────────────────────────────────────────────────────
  58: { 35: { id:'intimidation_c',name:'Intimidation',   desc:'-15% ATK ennemis au début',
               effect:{ kind:'intimidate', stats:['atk'], mult:0.85 } },
        70: { id:'crocs_feu_p',  name:'Crocs de Feu+',  desc:'35% brûle en attaque normale',
               effect:{ kind:'on_attack_proc', status:'burn', chance:0.35, turns:3 } } },
  59: { 35: { id:'vitesse_ext',  name:'Vitesse Extrême', desc:'Toujours en premier si même tick ATB',
               effect:{ kind:'priority_always' } },
        70: { id:'agilite_c',    name:'Agilité',          desc:'+30% VIT permanent',
               effect:{ kind:'stat_boost', stat:'spd', mult:1.30 } } },
  // ── Ptitard ligne ─────────────────────────────────────────────────────────
  60: { 35: { id:'hypnose_pt',   name:'Hypnose',         desc:'20% sommeil en attaque',
               effect:{ kind:'on_attack_proc', status:'sleep', chance:0.20, turns:2 } },
        70: { id:'onde_son',     name:'Onde Sonique',    desc:'Paralyse rangée avant au début',
               effect:{ kind:'aoe_start_status', status:'paralyze', row:'front' } } },
  61: { 35: { id:'vague',        name:'Vague',            desc:'+10% dégâts par allié Eau',
               effect:{ kind:'stack_per_ally', type:'Eau', stat:'spa', per_ally:0.05 } },
        70: { id:'mur_liquide',  name:'Mur Liquide',     desc:'-5% dégâts par allié vivant',
               effect:{ kind:'damage_reduction_per_ally', per_ally:0.05, max:0.25 } } },
  62: { 35: { id:'poing_kara',   name:'Poing Karaté',   desc:'Ignore DEF physique à 30%',
               effect:{ kind:'ignore_def_chance', chance:0.30, pct:1.0 } },
        70: { id:'barriere_t',   name:'Barrière',        desc:'+50% DEF pendant 3 premières actions',
               effect:{ kind:'temporary_boost', stat:'def', mult:1.50, duration:3 } } },
  // ── Abra ligne ────────────────────────────────────────────────────────────
  63: { 35: { id:'teleport_a',   name:'Téléport',        desc:'Esquive 1 attaque/combat',
               effect:{ kind:'dodge_once' } },
        70: { id:'prescience',   name:'Prescience',       desc:'+20% SP.ATK passif',
               effect:{ kind:'stat_boost', stat:'spa', mult:1.20 } } },
  64: { 35: { id:'synchronie',   name:'Synchronie',      desc:'Renvoie les statuts subis 50%',
               effect:{ kind:'status_reflect', chance:0.50 } },
        70: { id:'clairvoyance', name:'Clairvoyance',    desc:'+20% SP.ATK si ennemi a un statut',
               effect:{ kind:'bonus_vs_status', stat:'spa', mult:1.20 } } },
  65: { 35: { id:'magie_rebond', name:'Magie Rebond',   desc:'Reflète 1 statut/combat',
               effect:{ kind:'status_reflect_once' } },
        70: { id:'telepathie',   name:'Télépathie',       desc:'Ignore les effets AoE alliés',
               effect:{ kind:'ignore_friendly_aoe' } } },
  // ── Machoc ligne ──────────────────────────────────────────────────────────
  66: { 35: { id:'sismopoing',   name:'Sismopoing',      desc:'Ignore 20% DEF',
               effect:{ kind:'ignore_def', pct:0.20 } },
        70: { id:'halt',         name:'Haltères',         desc:'+10% ATK par allié Combat',
               effect:{ kind:'stack_per_ally', type:'Combat', stat:'atk', per_ally:0.10 } } },
  67: { 35: { id:'force_m',      name:'Force',           desc:'+25% dégâts si PV>75%',
               effect:{ kind:'conditional_boost', condition:'hp_above', threshold:0.75, stat:'atk', mult:1.25 } },
        70: { id:'crc',          name:'Combat Rapproché', desc:'-30% DEF ennemi après chaque frappe',
               effect:{ kind:'on_hit_debuff', stat:'def', mult:0.90 } } },
  68: { 35: { id:'force_col',    name:'Force Colossale', desc:'Ignore 35% DEF',
               effect:{ kind:'ignore_def', pct:0.35 } },
        70: { id:'dynamique',    name:'Dynamique',        desc:'+10% ATK à chaque frappe (cumul)',
               effect:{ kind:'ramp_stat', stat:'atk', per_action:0.10, max:0.50 } } },
  // ── Chétiflor ligne ───────────────────────────────────────────────────────
  69: { 35: { id:'acide_chet',   name:'Acide',           desc:'25% brûlure en attaque',
               effect:{ kind:'on_attack_proc', status:'burn', chance:0.25, turns:3 } },
        70: { id:'englout',      name:'Engloutissement', desc:'Drain 15% des dégâts',
               effect:{ kind:'drain_attack', rate:0.15 } } },
  70: { 35: { id:'acide_bous',   name:'Acide+',          desc:'30% empoisonne en attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:0.30 } },
        70: { id:'digestion',    name:'Digestion',        desc:'Soigne 20% HP après chaque K.O.',
               effect:{ kind:'heal_on_ko', rate:0.20 } } },
  71: { 35: { id:'capture_emp',  name:'Capture',         desc:'Immobilise cible 1 action 25%',
               effect:{ kind:'on_attack_proc', status:'stun', chance:0.25, turns:1 } },
        70: { id:'vrille',       name:'Vrille',           desc:'Cible immobilisée perd 15% HP/action',
               effect:{ kind:'dot_on_stun', rate:0.15 } } },
  // ── Tentacool/Tentacruel ──────────────────────────────────────────────────
  72: { 35: { id:'venin_tent',   name:'Venin',           desc:'25% poison en attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:0.25 } },
        70: { id:'para_tent',    name:'Paralysie Tentaculaire', desc:'25% paralysie en attaque',
               effect:{ kind:'on_attack_proc', status:'paralyze', chance:0.25 } } },
  73: { 35: { id:'tentacules',   name:'Tentacules',      desc:'AoE arrière + poison 30%',
               effect:{ kind:'aoe_proc', status:'poison', chance:0.30, row:'back' } },
        70: { id:'liquidation',  name:'Liquidation',      desc:'-20% DEF cible après chaque frappe',
               effect:{ kind:'on_hit_debuff', stat:'def', mult:0.85 } } },
  // ── Racaillou ligne ───────────────────────────────────────────────────────
  74: { 35: { id:'robustesse',   name:'Robustesse',      desc:'Survit 1 coup fatal avec 1HP',
               effect:{ kind:'sturdy' } },
        70: { id:'roc',          name:'Roc',              desc:'Absorbe 20% dégâts si PV>50%',
               effect:{ kind:'conditional_absorb', threshold:0.50, pct:0.20 } } },
  75: { 35: { id:'eboulement',   name:'Éboulement',      desc:'Stun AoE 20%',
               effect:{ kind:'aoe_proc_passive', status:'stun', chance:0.20, turns:1 } },
        70: { id:'armure_roche', name:'Armure Roche',    desc:'-25% dégâts physiques',
               effect:{ kind:'damage_reduction_physical', mult:0.75 } } },
  76: { 35: { id:'explosion_g',  name:'Explosion',       desc:'À la mort → 80% HP AoE',
               effect:{ kind:'on_death_aoe', rate:0.80 } },
        70: { id:'geant',        name:'Géant',            desc:'Immunisé recul et stun',
               effect:{ kind:'status_immunity_types', statuses:['stun','push_back'] } } },
  // ── Ponyta/Galopa ─────────────────────────────────────────────────────────
  77: { 35: { id:'flamme_sacree',name:'Flamme Sacrée',  desc:'Immunisé paralysie',
               effect:{ kind:'status_immunity_types', statuses:['paralyze'] } },
        70: { id:'galop_feu',    name:'Galop de Feu',   desc:'+20% VIT après chaque K.O. allié',
               effect:{ kind:'on_ko_boost', stat:'spd', mult:0.20 } } },
  78: { 35: { id:'course_folle', name:'Course Folle',  desc:'+15% VIT à chaque tick ATB',
               effect:{ kind:'ramp_stat', stat:'spd', per_action:0.05, max:0.30 } },
        70: { id:'pietinement',  name:'Piétinement',    desc:'AoE front row à chaque attaque',
               effect:{ kind:'splash_damage', row:'front', mult:0.30 } } },
  // ── Ramoloss/Flagadoss ────────────────────────────────────────────────────
  79: { 35: { id:'amnesie',      name:'Amnésie',         desc:'+40% SP.DEF passif',
               effect:{ kind:'stat_boost', stat:'spd_def', mult:1.40 } },
        70: { id:'regression',   name:'Régression',      desc:'Soigne 5% HP à chaque action',
               effect:{ kind:'regen_self', rate:0.05 } } },
  80: { 35: { id:'mega_drain_f', name:'Méga-Drain',      desc:'Drain 30% des dégâts',
               effect:{ kind:'drain_attack', rate:0.30 } },
        70: { id:'assimilation', name:'Assimilation',    desc:'+20% SP.ATK au début passif',
               effect:{ kind:'stat_boost', stat:'spa', mult:1.20 } } },
  // ── Magnéti/Magnéton ──────────────────────────────────────────────────────
  81: { 35: { id:'magnetisme',   name:'Magnétisme',      desc:'-10% VIT ennemis',
               effect:{ kind:'intimidate', stats:['spd'], mult:0.90 } },
        70: { id:'champ_mag',    name:'Champ Magnétique',desc:'Immunisé aux projectiles (-20% dégâts Vol)',
               effect:{ kind:'type_resistance', type:'Vol', mult:0.80 } } },
  82: { 35: { id:'tri_attaque',  name:'Tri-Attaque',     desc:'33% brûle/gèle/paralyse aléatoire',
               effect:{ kind:'random_status', statuses:['burn','freeze','paralyze'], chance:0.33 } },
        70: { id:'levitation',   name:'Lévitation',       desc:'Immunisé attaques Sol',
               effect:{ kind:'type_immunity', type:'Sol' } } },
  // ── Canarticho ───────────────────────────────────────────────────────────
  83: { 35: { id:'poireau',      name:'Poireau',          desc:'+20% taux critique',
               effect:{ kind:'crit_boost', chance:0.20 } },
        70: { id:'sabre',        name:'Sabre',             desc:'Crit garanti si PV>75%',
               effect:{ kind:'guaranteed_crit_threshold', threshold:0.75 } } },
  // ── Doduo/Dodrio ─────────────────────────────────────────────────────────
  84: { 35: { id:'bi_attaque',   name:'Bi-Attaque',      desc:'2 frappes par action',
               effect:{ kind:'multi_hit', hits:2, mult:0.60 } },
        70: { id:'tetes_doubles',name:'Têtes Doubles',   desc:'Attaque 2 cibles différentes',
               effect:{ kind:'hit_two_targets' } } },
  85: { 35: { id:'tri_attaque_d',name:'Tri-Attaque',     desc:'3 frappes (50% puissance)',
               effect:{ kind:'multi_hit', hits:3, mult:0.50 } },
        70: { id:'mach_speed',   name:'Mach Speed',      desc:'+30% VIT permanent',
               effect:{ kind:'stat_boost', stat:'spd', mult:1.30 } } },
  // ── Otaria/Lamantine ─────────────────────────────────────────────────────
  86: { 35: { id:'rugissement',  name:'Rugissement',     desc:'-10% ATK ennemis/action',
               effect:{ kind:'on_hit_debuff', stat:'atk', mult:0.93 } },
        70: { id:'chant_sed',    name:'Chant Séducteur', desc:'30% confusion rangée avant',
               effect:{ kind:'aoe_proc', status:'confuse', chance:0.30, row:'front' } } },
  87: { 35: { id:'blizzard_l',   name:'Blizzard',        desc:'20% gel en attaque',
               effect:{ kind:'on_attack_proc', status:'freeze', chance:0.20 } },
        70: { id:'armure_glace', name:'Armure de Glace', desc:'+30% DEF passif',
               effect:{ kind:'stat_boost', stat:'def', mult:1.30 } } },
  // ── Tadmorv/Grotadmorv ────────────────────────────────────────────────────
  88: { 35: { id:'miasmes',      name:'Miasmes',          desc:'Empoisonne automatiquement/4 actions',
               effect:{ kind:'periodic_aoe_status', status:'poison', period:4 } },
        70: { id:'pestilence_t', name:'Pestilence',       desc:'Poison sur tous les ennemis au début',
               effect:{ kind:'aoe_start_status', status:'poison', row:'all' } } },
  89: { 35: { id:'acide_sulf',   name:'Acide Sulfurique',desc:'Poison inflige 6% au lieu de 3%',
               effect:{ kind:'poison_dmg_flat', rate:0.06 } },
        70: { id:'dissolution',  name:'Dissolution',      desc:'-30% DEF ennemis empoisonnés',
               effect:{ kind:'debuff_on_status', status:'poison', stat:'def', mult:0.70 } } },
  // ── Kokiyas/Crustabri ─────────────────────────────────────────────────────
  90: { 35: { id:'armure_kok',   name:'Armure',           desc:'Absorbe 1 coup',
               effect:{ kind:'damage_absorb' } },
        70: { id:'claquement',   name:'Claquement',       desc:'Riposte 50% dégâts reçus',
               effect:{ kind:'counter', rate:0.50 } } },
  91: { 35: { id:'gel_crus',     name:'Gel',              desc:'25% immobilise en attaque',
               effect:{ kind:'on_attack_proc', status:'freeze', chance:0.25 } },
        70: { id:'carapace_gl',  name:'Carapace de Glace',desc:'Immunisé brûlure + -30% dégâts Feu',
               effect:{ kind:'type_resistance_immunity', immune:'burn', resist_type:'Feu', mult:0.70 } } },
  // ── Fantominus/Spectrum/Ectoplasma ────────────────────────────────────────
  92: { 35: { id:'incorporel',   name:'Incorporel',       desc:'25% esquive',
               effect:{ kind:'evasion', chance:0.25 } },
        70: { id:'malédiction_f',name:'Malédiction',      desc:'À la mort → 30% HP dégâts à un ennemi',
               effect:{ kind:'on_death_target', rate:0.30 } } },
  93: { 35: { id:'ombre',        name:'Ombre',            desc:'30% esquive',
               effect:{ kind:'evasion', chance:0.30 } },
        70: { id:'possession',   name:'Possession',       desc:'Ennemi agit pour nous 1 action',
               effect:{ kind:'possess_chance', chance:0.20 } } },
  94: { 35: { id:'tenebres',     name:'Ténèbres',         desc:'Ignore DEF/SP.DEF à 25%',
               effect:{ kind:'ignore_def_chance', chance:0.25, pct:1.0 } },
        70: { id:'cauchemar_et', name:'Cauchemar Éternel',desc:'À la mort → tous les ennemis -20% HP',
               effect:{ kind:'on_death_aoe_pct', rate:0.20 } } },
  // ── Onix ────────────────────────────────────────────────────────────────
  95: { 35: { id:'mur_pierre',   name:'Mur de Pierre',   desc:'-30% dégâts reçus',
               effect:{ kind:'damage_reduction', mult:0.70 } },
        70: { id:'force_tit',    name:'Force Titanesque', desc:'+10% ATK par ennemi K.O.',
               effect:{ kind:'on_enemy_ko_boost', stat:'atk', per_ko:0.10 } } },
  // ── Soporifik/Hypnomade ───────────────────────────────────────────────────
  96: { 35: { id:'hypnose_so',   name:'Hypnose',          desc:'30% sommeil en attaque',
               effect:{ kind:'on_attack_proc', status:'sleep', chance:0.30, turns:2 } },
        70: { id:'reve_abs',     name:'Rêve Absorbant',  desc:'HP drainés = dégâts sur cibles endormies',
               effect:{ kind:'drain_vs_sleep', rate:1.0 } } },
  97: { 35: { id:'hypnose_plus', name:'Hypnose+',        desc:'35% sommeil + drain 15%',
               effect:{ kind:'on_attack_proc_drain', status:'sleep', chance:0.35, drain:0.15 } },
        70: { id:'cauchemar_h',  name:'Cauchemar',        desc:'Cibles endormies perdent 10% HP/action',
               effect:{ kind:'dot_on_sleep', rate:0.10 } } },
  // ── Krabby/Krabboss ───────────────────────────────────────────────────────
  98: { 35: { id:'tenailles',    name:'Tenailles',        desc:'20% stun 1 action',
               effect:{ kind:'on_attack_proc', status:'stun', chance:0.20, turns:1 } },
        70: { id:'etreinte_k',   name:'Étreinte',         desc:'Cible stun perd 15% HP/action',
               effect:{ kind:'dot_on_stun', rate:0.15 } } },
  99: { 35: { id:'hyper_ten',    name:'Hyper Tenailles', desc:'30% stun + -20% ATK',
               effect:{ kind:'on_attack_proc_debuff', status:'stun', chance:0.30, turns:1, stat:'atk', debuff:0.80 } },
        70: { id:'crabe_geant',  name:'Crabe Géant',     desc:'+1 portée, cible rangée arrière',
               effect:{ kind:'gain_range' } } },
  // ── Voltorbe/Électrode ───────────────────────────────────────────────────
  100:{ 35: { id:'explosion_im', name:'Explosion Imminente', desc:'Si PV<30% → +50% ATK',
               effect:{ kind:'fury', stat:'atk', mult:1.50, threshold:0.30 } },
        70: { id:'autodestruct', name:'Autodestruction', desc:'À la mort → AoE 80% HP en dégâts',
               effect:{ kind:'on_death_aoe', rate:0.80 } } },
  101:{ 35: { id:'ultrarapide',  name:'Ultrarapide',     desc:'+25% VIT passif',
               effect:{ kind:'stat_boost', stat:'spd', mult:1.25 } },
        70: { id:'bang',         name:'Bang',             desc:'À la mort → KO instante 20% sur 1 ennemi',
               effect:{ kind:'on_death_ko_chance', chance:0.20 } } },
  // ── Nœunœuf/Noadkoko ─────────────────────────────────────────────────────
  102:{ 35: { id:'telepathie_n', name:'Télépathie',      desc:'+10% SP.ATK par allié vivant',
               effect:{ kind:'stack_per_ally', type:'all', stat:'spa', per_ally:0.05 } },
        70: { id:'spore_sol',    name:'Spore Solaire',   desc:'Zone Poudre Dodo au début',
               effect:{ kind:'aoe_start_status', status:'sleep', turns:2, row:'all', chance:0.30 } } },
  103:{ 35: { id:'melodie_n',    name:'Mélodie',          desc:'Soigne 10% HP tous alliés/8 actions',
               effect:{ kind:'regen_all_period', rate:0.10, period:8 } },
        70: { id:'hypnose_fl',   name:'Hypnose Florale', desc:'Endort 1 ennemi aléatoire au début',
               effect:{ kind:'sleep_one_start', turns:2 } } },
  // ── Osselait/Ossatueur ───────────────────────────────────────────────────
  104:{ 35: { id:'os',           name:'Os',               desc:'+20% ATK physique',
               effect:{ kind:'stat_boost', stat:'atk', mult:1.20 } },
        70: { id:'malediction_o',name:'Malédiction',      desc:'Cible frappée perd 8% HP/action',
               effect:{ kind:'dot_target', rate:0.08 } } },
  105:{ 35: { id:'danse_os',     name:'Danse des Os',    desc:'+10% ATK à chaque frappe (cumul)',
               effect:{ kind:'ramp_stat', stat:'atk', per_action:0.10, max:0.50 } },
        70: { id:'squelette_m',  name:'Squelette Maudit',desc:'Renvoie 30% dégâts physiques',
               effect:{ kind:'counter', rate:0.30, only_physical:true } } },
  // ── Kicklee/Tygnon ────────────────────────────────────────────────────────
  106:{ 35: { id:'coud_pied',    name:'Coud\'Pied',      desc:'2e attaque à 50% puissance',
               effect:{ kind:'bonus_hit', chance:1.0, mult:0.50 } },
        70: { id:'contre',       name:'Contre',            desc:'Renvoie 60% dégâts physiques',
               effect:{ kind:'counter', rate:0.60, only_physical:true } } },
  107:{ 35: { id:'crochet',      name:'Crochet',          desc:'+20% dégâts physiques',
               effect:{ kind:'stat_boost', stat:'atk', mult:1.20 } },
        70: { id:'tir_prec',     name:'Tir de Précision', desc:'Ignore esquive et DEF à 25%',
               effect:{ kind:'ignore_def_chance', chance:0.25, pct:1.0 } } },
  // ── Excelangue ────────────────────────────────────────────────────────────
  108:{ 35: { id:'lechouille',   name:'Léchouille',       desc:'Drain 20% des dégâts',
               effect:{ kind:'drain_attack', rate:0.20 } },
        70: { id:'langue_coll',  name:'Langue Collante',  desc:'Stun cible 2 actions 20%',
               effect:{ kind:'on_attack_proc', status:'stun', chance:0.20, turns:2 } } },
  // ── Smogo/Smogogo ─────────────────────────────────────────────────────────
  109:{ 35: { id:'nuage_tox',    name:'Nuage Toxique',   desc:'AoE poison au début',
               effect:{ kind:'aoe_start_status', status:'poison', row:'all' } },
        70: { id:'corrosion',    name:'Corrosion',        desc:'Empoisonne même les types immunisés',
               effect:{ kind:'ignore_poison_immunity' } } },
  110:{ 35: { id:'double_gaz',   name:'Double Gaz',      desc:'2 stacks poison par attaque',
               effect:{ kind:'on_attack_proc', status:'poison', chance:1.0, stacks:2 } },
        70: { id:'toxines',      name:'Toxines',           desc:'Poison réduit aussi VIT de 20%',
               effect:{ kind:'poison_slow', mult:0.80 } } },
  // ── Rhinocorne/Rhinoféros ─────────────────────────────────────────────────
  111:{ 35: { id:'corne_r',      name:'Corne',            desc:'Ignore 20% DEF',
               effect:{ kind:'ignore_def', pct:0.20 } },
        70: { id:'charge_r',     name:'Charge',           desc:'Premier coup du combat ×2',
               effect:{ kind:'first_hit_boost', mult:2.0 } } },
  112:{ 35: { id:'furie_r2',     name:'Furie',            desc:'+5% ATK par coup reçu',
               effect:{ kind:'rage_stack', stat:'atk', per_hit:0.05, max:0.50 } },
        70: { id:'foulee_lourde',name:'Foulée Lourde',   desc:'AoE front row + stun 20%',
               effect:{ kind:'splash_damage_proc', row:'front', mult:0.40, status:'stun', chance:0.20 } } },
  // ── Leveinard ─────────────────────────────────────────────────────────────
  113:{ 35: { id:'soin_lev',     name:'Soin',             desc:'Soigne 10% HP alliés/8 actions',
               effect:{ kind:'regen_all_period', rate:0.10, period:8 } },
        70: { id:'dévouement',   name:'Dévouement',       desc:'Absorbe 30% dégâts reçus par alliés',
               effect:{ kind:'damage_share_absorb', pct:0.30 } } },
  // ── Saquedeneu ────────────────────────────────────────────────────────────
  114:{ 35: { id:'lianes_sq',    name:'Lianes',           desc:'+15% ATK par allié vivant',
               effect:{ kind:'stack_per_ally', type:'all', stat:'atk', per_ally:0.05 } },
        70: { id:'regeneration', name:'Régénération',     desc:'Soigne 5% HP à chaque action',
               effect:{ kind:'regen_self', rate:0.05 } } },
  // ── Kangourex ─────────────────────────────────────────────────────────────
  115:{ 35: { id:'joey',         name:'Joey',             desc:'Invoque copie à 50% stats si PV<50%',
               effect:{ kind:'summon_copy_threshold', threshold:0.50, stat_mult:0.50 } },
        70: { id:'maman',        name:'Maman',            desc:'+30% HP passif',
               effect:{ kind:'stat_boost', stat:'hp', mult:1.30 } } },
  // ── Hypotrempe/Hypocéan ───────────────────────────────────────────────────
  116:{ 35: { id:'rapide_h',     name:'Rapide',           desc:'+20% VIT passif',
               effect:{ kind:'stat_boost', stat:'spd', mult:1.20 } },
        70: { id:'danse_lames_h',name:'Danse-Lames',      desc:'+10% ATK à chaque attaque',
               effect:{ kind:'ramp_stat', stat:'atk', per_action:0.10, max:0.60 } } },
  117:{ 35: { id:'jet_eau',      name:'Jet d\'Eau',       desc:'2 cibles à chaque attaque',
               effect:{ kind:'hit_two_targets' } },
        70: { id:'dragon_marin', name:'Dragon Marin',     desc:'Résiste 30% dégâts Dragon',
               effect:{ kind:'type_resistance', type:'Dragon', mult:0.70 } } },
  // ── Poissirène/Poissoroy ──────────────────────────────────────────────────
  118:{ 35: { id:'nage_rapide',  name:'Nage Rapide',     desc:'+15% VIT',
               effect:{ kind:'stat_boost', stat:'spd', mult:1.15 } },
        70: { id:'plongeon',     name:'Plongeon',          desc:'Esquive 1 attaque/combat',
               effect:{ kind:'dodge_once' } } },
  119:{ 35: { id:'reflet_p',     name:'Reflet',           desc:'Copie dernier buff ennemi reçu',
               effect:{ kind:'copy_last_buff' } },
        70: { id:'royal',        name:'Royal',             desc:'+20% stats à tous les alliés au début',
               effect:{ kind:'aura_all_boost', mult:1.10 } } },
  // ── Stari/Staross ────────────────────────────────────────────────────────
  120:{ 35: { id:'etoile',       name:'Étoile',           desc:'Soigne 5% HP à chaque allié/8 actions',
               effect:{ kind:'regen_all_period', rate:0.05, period:8 } },
        70: { id:'recuperation', name:'Récupération',     desc:'Restaure 20% HP si PV<25%',
               effect:{ kind:'emergency_heal', threshold:0.25, rate:0.20 } } },
  121:{ 35: { id:'rayonnement',  name:'Rayonnement',      desc:'Soin 8% HP tous alliés/8 actions',
               effect:{ kind:'regen_all_period', rate:0.08, period:8 } },
        70: { id:'teleportation',name:'Téléportation',    desc:'Esquive la première attaque reçue',
               effect:{ kind:'dodge_once' } } },
  // ── M. Mime ───────────────────────────────────────────────────────────────
  122:{ 35: { id:'barriere_m',   name:'Barrière',         desc:'Bloque 1 attaque/combat',
               effect:{ kind:'damage_absorb' } },
        70: { id:'mime',         name:'Mime',              desc:'Copie dernier buff ennemi',
               effect:{ kind:'copy_last_buff' } } },
  // ── Insécateur ────────────────────────────────────────────────────────────
  123:{ 35: { id:'lames_ins',    name:'Lames',            desc:'2 frappes physiques',
               effect:{ kind:'multi_hit', hits:2, mult:0.60 } },
        70: { id:'danse_lames_i',name:'Danse-Lames',      desc:'+20% ATK à chaque frappe',
               effect:{ kind:'ramp_stat', stat:'atk', per_action:0.10, max:0.60 } } },
  // ── Lippoutou ─────────────────────────────────────────────────────────────
  124:{ 35: { id:'baiser_glace', name:'Baiser Glacé',    desc:'30% gel en attaque',
               effect:{ kind:'on_attack_proc', status:'freeze', chance:0.30 } },
        70: { id:'charme_l',     name:'Charme',           desc:'Ennemis attaquent 30% moins souvent',
               effect:{ kind:'slow_enemy_atb', mult:0.70 } } },
  // ── Élektek ───────────────────────────────────────────────────────────────
  125:{ 35: { id:'dynamopoing',  name:'Dynamopoing',      desc:'Ignore 30% DEF physique',
               effect:{ kind:'ignore_def', pct:0.30 } },
        70: { id:'moteur',       name:'Moteur',            desc:'+5% VIT à chaque coup reçu',
               effect:{ kind:'rage_stack', stat:'spd', per_hit:0.05, max:0.30 } } },
  // ── Magmar ────────────────────────────────────────────────────────────────
  126:{ 35: { id:'smog_mag',     name:'Smog Toxique',    desc:'Empoisonne en attaque 30%',
               effect:{ kind:'on_attack_proc', status:'poison', chance:0.30 } },
        70: { id:'fusion_mag',   name:'Fusion',           desc:'+25% SP.ATK si allié Feu présent',
               effect:{ kind:'conditional_boost_ally_type', type:'Feu', stat:'spa', mult:1.25 } } },
  // ── Scarabrute ────────────────────────────────────────────────────────────
  127:{ 35: { id:'armure_sca',   name:'Armure',           desc:'-25% dégâts reçus',
               effect:{ kind:'damage_reduction', mult:0.75 } },
        70: { id:'emprise',      name:'Emprise',           desc:'Cible immobilisée prend ×1.5 dégâts',
               effect:{ kind:'bonus_vs_stun', mult:1.50 } } },
  // ── Tauros ────────────────────────────────────────────────────────────────
  128:{ 35: { id:'charge_t',     name:'Charge',           desc:'Premier coup ×2',
               effect:{ kind:'first_hit_boost', mult:2.0 } },
        70: { id:'troupeau',     name:'Troupeau',          desc:'+10% ATK par allié Normal',
               effect:{ kind:'stack_per_ally', type:'Normal', stat:'atk', per_ally:0.10 } } },
  // ── Magicarpe/Léviator ────────────────────────────────────────────────────
  129:{ 35: { id:'tenace_m',     name:'Tenace',           desc:'Survit 1 coup fatal avec 1HP',
               effect:{ kind:'sturdy' } },
        70: { id:'evo_imm',      name:'Évolution Imminente', desc:'+50% ATK si PV<20%',
               effect:{ kind:'fury', stat:'atk', mult:1.50, threshold:0.20 } } },
  130:{ 35: { id:'intimidation_l',name:'Intimidation',   desc:'-20% ATK ennemis',
               effect:{ kind:'intimidate', stats:['atk'], mult:0.80 } },
        70: { id:'colere_l',     name:'Colère',           desc:'+10% ATK par allié K.O.',
               effect:{ kind:'on_ko_boost', stat:'atk', mult:0.10 } } },
  // ── Lokhlass ─────────────────────────────────────────────────────────────
  131:{ 35: { id:'ecran_brume',  name:'Écran de Brume',  desc:'-20% dégâts spéciaux reçus',
               effect:{ kind:'damage_reduction_special', mult:0.80 } },
        70: { id:'chant_opera',  name:'Chant d\'Opéra',  desc:'Endort 2 ennemis aléatoires au début',
               effect:{ kind:'sleep_n_start', count:2, turns:2 } } },
  // ── Métamorph ─────────────────────────────────────────────────────────────
  132:{ 35: { id:'copie_m',      name:'Copie',            desc:'Copie stats du pokémon le plus fort',
               effect:{ kind:'copy_strongest_stats' } },
        70: { id:'metamorphe',   name:'Métamorphe',       desc:'Copie aussi passifs et ultime',
               effect:{ kind:'copy_strongest_full' } } },
  // ── Évoli ─────────────────────────────────────────────────────────────────
  133:{ 35: { id:'adaptabilite', name:'Adaptabilité',    desc:'+20% à la stat la plus élevée',
               effect:{ kind:'boost_highest_stat', mult:1.20 } },
        70: { id:'potentiel',    name:'Potentiel',         desc:'Immunisé statuts + +10% toutes stats',
               effect:{ kind:'status_immunity_boost', mult:1.10 } } },
  // ── Aquali/Voltali/Pyroli ─────────────────────────────────────────────────
  134:{ 35: { id:'absorb_eau',   name:'Absorption Eau',  desc:'Immunisé dégâts Eau, soigné à la place',
               effect:{ kind:'type_absorb', type:'Eau' } },
        70: { id:'hydrojet',     name:'Hydrojet',          desc:'+30% VIT pour 3 premières actions',
               effect:{ kind:'temporary_boost', stat:'spd', mult:1.30, duration:3 } } },
  135:{ 35: { id:'plasma',       name:'Plasma',           desc:'40% paralysie en attaque',
               effect:{ kind:'on_attack_proc', status:'paralyze', chance:0.40 } },
        70: { id:'ionisation',   name:'Ionisation',        desc:'-15% VIT tous ennemis permanent',
               effect:{ kind:'intimidate', stats:['spd'], mult:0.85 } } },
  136:{ 35: { id:'chaleur_p',    name:'Chaleur',          desc:'Si PV>75% → +25% SP.ATK',
               effect:{ kind:'conditional_boost', condition:'hp_above', threshold:0.75, stat:'spa', mult:1.25 } },
        70: { id:'feu_sacre_p',  name:'Feu Sacré',        desc:'Absorbe 50% des soins reçus par ennemis',
               effect:{ kind:'negate_enemy_heals', pct:0.50 } } },
  // ── Porygon ───────────────────────────────────────────────────────────────
  137:{ 35: { id:'analyse',      name:'Analyse',          desc:'+5% dégâts par attaque reçue',
               effect:{ kind:'rage_stack', stat:'spa', per_hit:0.05, max:0.40 } },
        70: { id:'code_viral',   name:'Code Viral',       desc:'20% appliquer statut aléatoire',
               effect:{ kind:'random_status', statuses:['burn','poison','paralyze','freeze','confuse'], chance:0.20 } } },
  // ── Fossiles ──────────────────────────────────────────────────────────────
  138:{ 35: { id:'carapace_am',  name:'Carapace',         desc:'-20% dégâts reçus',
               effect:{ kind:'damage_reduction', mult:0.80 } },
        70: { id:'resurgence',   name:'Résurgence',       desc:'Ressuscite 1 fois avec 25% HP',
               effect:{ kind:'revive', rate:0.25 } } },
  139:{ 35: { id:'armure_fos',   name:'Armure Fossile',  desc:'Absorbe 1 coup + -20% dégâts',
               effect:{ kind:'damage_absorb_reduction', mult:0.80 } },
        70: { id:'frappe_fos',   name:'Frappe Fossile',  desc:'Ignore 30% DEF',
               effect:{ kind:'ignore_def', pct:0.30 } } },
  140:{ 35: { id:'dur',          name:'Dur',              desc:'-25% dégâts',
               effect:{ kind:'damage_reduction', mult:0.75 } },
        70: { id:'jet_rochers',  name:'Jet de Rochers',  desc:'AoE front row',
               effect:{ kind:'splash_damage', row:'front', mult:0.40 } } },
  141:{ 35: { id:'tranchant_k',  name:'Tranchant',        desc:'+30% ATK physique',
               effect:{ kind:'stat_boost', stat:'atk', mult:1.30 } },
        70: { id:'faucille',     name:'Faucille',          desc:'Drain 30% des dégâts infligés',
               effect:{ kind:'drain_attack', rate:0.30 } } },
  // ── Ptéra ─────────────────────────────────────────────────────────────────
  142:{ 35: { id:'agilite_pt',   name:'Agilité',          desc:'+20% VIT à chaque action',
               effect:{ kind:'ramp_stat', stat:'spd', per_action:0.05, max:0.40 } },
        70: { id:'ere_ancienne', name:'Ère Ancienne',     desc:'+20% ATK et DEF passif',
               effect:{ kind:'dual_stat_boost', stats:['atk','def'], mult:1.20 } } },
  // ── Ronflex ───────────────────────────────────────────────────────────────
  143:{ 35: { id:'estomac',      name:'Estomac',          desc:'+10% HP max passif',
               effect:{ kind:'stat_boost', stat:'hp', mult:1.10 } },
        70: { id:'corps_lourd',  name:'Corps Lourd',      desc:'Immunisé recul + riposte 20%',
               effect:{ kind:'counter_immune_pushback', counter:0.20 } } },
  // ── Légendaires ───────────────────────────────────────────────────────────
  144:{ 35: { id:'vent_glace',   name:'Vent Glacé',       desc:'-15% VIT ennemis AoE',
               effect:{ kind:'intimidate', stats:['spd'], mult:0.85 } },
        70: { id:'blizzard_div', name:'Blizzard Divin',   desc:'Zone gel 40% au début',
               effect:{ kind:'aoe_start_status', status:'freeze', chance:0.40, row:'all' } } },
  145:{ 35: { id:'tonnerre_div', name:'Tonnerre Divin',   desc:'Paralyse AoE 30%',
               effect:{ kind:'aoe_start_status', status:'paralyze', chance:0.30, row:'all' } },
        70: { id:'tempete_elec', name:'Tempête Électrique',desc:'Zone foudre chaque 8 actions',
               effect:{ kind:'periodic_aoe_status', status:'paralyze', period:8, chance:0.30 } } },
  146:{ 35: { id:'chaleur_ecr',  name:'Chaleur Écrasante',desc:'Brûlure AoE 35% + stack brûlure supplémentaire',
               effect:{ kind:'aoe_start_status_stack', status:'burn', chance:0.35, turns:3, row:'all', stacks:1 } },
        70: { id:'phenix_ardent',name:'Phénix Ardent',    desc:'Ressuscite 1 fois à 50% HP',
               effect:{ kind:'revive', rate:0.50 } } },
  147:{ 35: { id:'draco_min',    name:'Draco',            desc:'+10% ATK par allié Dragon',
               effect:{ kind:'stack_per_ally', type:'Dragon', stat:'atk', per_ally:0.10 } },
        70: { id:'vague_dragon', name:'Vague Dragon',     desc:'-20% stats ennemis au début',
               effect:{ kind:'intimidate', stats:['atk','spa','spd'], mult:0.85 } } },
  148:{ 35: { id:'colere_drag',  name:'Colère Dragon',    desc:'+40 dégâts fixes extra',
               effect:{ kind:'flat_bonus_dmg', amount:40 } },
        70: { id:'danse_draco',  name:'Danse Draco',      desc:'+15% ATK/VIT à chaque frappe',
               effect:{ kind:'ramp_dual', stats:['atk','spd'], per_action:0.08, max:0.40 } } },
  149:{ 35: { id:'vitesse_drag', name:'Vitesse du Dragon',desc:'+30% VIT',
               effect:{ kind:'stat_boost', stat:'spd', mult:1.30 } },
        70: { id:'domination_dr',name:'Domination',        desc:'-20% toutes stats ennemis au début',
               effect:{ kind:'intimidate', stats:['atk','spa','def','spd_def','spd'], mult:0.85 } } },
  150:{ 35: { id:'pression_mew', name:'Pression',         desc:'-50% gains mana ennemis',
               effect:{ kind:'reduce_enemy_mana_gain', mult:0.50 } },
        70: { id:'domination_m', name:'Domination Psychique', desc:'+20% à toutes les stats',
               effect:{ kind:'boost_all_stats', mult:1.20 } } },
  151:{ 35: { id:'transformation_mew', name:'Transformation', desc:'Gagne 1/3 des stats du pokémon le plus puissant en combat (allié ou ennemi)',
               effect:{ kind:'boost_from_strongest', ratio:1/3 } },
        70: { id:'metronome',    name:'Métronome',         desc:'Passif aléatoire parmi tous les existants',
               effect:{ kind:'random_passive' } } },
};

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
export function getPokemonPassive(pokemonId, level) {
  const passives = POKEMON_PASSIVES[pokemonId];
  if (!passives) return null;
  if (level >= 70 && passives[70]) return passives[70];
  if (level >= 35 && passives[35]) return passives[35];
  return null;
}

// Retourne les nœuds débloqués d'un arbre de talent pour un type
export function getUnlockedTalents(meta, type) {
  const tree   = TALENT_TREES[type];
  if (!tree) return [];
  const unlocked = meta?.talentTree?.[type] ?? [];
  return tree.filter((_, i) => unlocked[i]);
}

// Coût total pour débloquer le nœud N d'un type
export function getTalentCost(type, nodeIndex) {
  return TALENT_TREES[type]?.[nodeIndex]?.cost ?? 99;
}

// Points de talent gagnés en fin de run (1 par arène vaincue)
export function calcTalentPointsGained(badgesEarned = []) {
  return badgesEarned.length;
}