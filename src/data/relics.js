// ─────────────────────────────────────────────────────────────────────────────
// relics.js — Définition des 20 reliques
// ─────────────────────────────────────────────────────────────────────────────

export const RELICS = {

  // ── Économie & Boutique ────────────────────────────────────────────────────
  loupe: {
    id: 'loupe', name: 'Loupe', icon: '🔍',
    desc: '4 objets proposés en boutique au lieu de 3.',
    category: 'economy',
    unlockAchievement: 'curieux',
    apply: { kind: 'shop_slots', value: 4 },
  },

  bourse_doree: {
    id: 'bourse_doree', name: 'Bourse Dorée', icon: '💰',
    desc: '+2 pièces après chaque victoire.',
    category: 'economy',
    unlockAchievement: 'riche',
    apply: { kind: 'coins_per_win', value: 2 },
  },

  braderie: {
    id: 'braderie', name: 'Braderie', icon: '🔄',
    desc: 'Les objets peuvent être revendus à leur prix d\'achat complet.',
    category: 'economy',
    unlockAchievement: 'collectionneur',
    apply: { kind: 'sell_full_price' },
  },

  pochette_surprise: {
    id: 'pochette_surprise', name: 'Pochette Surprise', icon: '🎰',
    desc: 'Reçois un objet aléatoire gratuit au début de la run.',
    category: 'economy',
    unlockAchievement: 'coup_de_chance',
    apply: { kind: 'start_random_item' },
  },

  // ── Combat Symétrique ──────────────────────────────────────────────────────
  condensateur: {
    id: 'condensateur', name: 'Condensateur', icon: '🔋',
    desc: 'Toute unité démarre chaque combat avec 50 mana. Les ultimes arrivent plus vite pour tout le monde.',
    category: 'combat',
    unlockAchievement: 'ultime',
    apply: { kind: 'start_mana', value: 50, symmetric: true },
  },

  pacte_de_sang: {
    id: 'pacte_de_sang', name: 'Pacte de Sang', icon: '💀',
    desc: 'Toutes les unités ont -20% HP max mais +30% ATK et SP.ATK. Combats plus rapides et plus létaux.',
    category: 'combat',
    unlockAchievement: 'sacrifice',
    apply: { kind: 'stat_modifier', stats: { hp: 0.80, atk: 1.30, spa: 1.30 }, symmetric: true },
  },

  de_maudit: {
    id: 'de_maudit', name: 'Dé Maudit', icon: '🎲',
    desc: '1 pokémon aléatoire de chaque camp démarre chaque combat à 50% HP.',
    category: 'combat',
    unlockAchievement: 'empoisonneur',
    apply: { kind: 'random_unit_half_hp', symmetric: true },
  },

  sablier: {
    id: 'sablier', name: 'Sablier', icon: '⏱',
    desc: 'Combat limité à 25 actions par camp. Le camp avec le plus de HP restants gagne.',
    category: 'combat',
    unlockAchievement: 'synergiste',
    apply: { kind: 'action_limit', value: 25, symmetric: true },
  },

  benediction: {
    id: 'benediction', name: 'Bénédiction', icon: '🩹',
    desc: 'Toutes les unités ont +30% HP max mais -25% ATK et SP.ATK. Combats longs et défensifs.',
    category: 'combat',
    unlockAchievement: 'exterminateur',
    apply: { kind: 'stat_modifier', stats: { hp: 1.30, atk: 0.75, spa: 0.75 }, symmetric: true },
  },

  revanche: {
    id: 'revanche', name: 'Revanche', icon: '🔁',
    desc: 'Toute unité (les deux camps) déclenche son ultime à 0 HP si sa mana est ≥50.',
    category: 'combat',
    unlockAchievement: 'lv100_eau_1',
    apply: { kind: 'death_ultimate', mana_threshold: 50, symmetric: true },
  },

  contrat_maudit: {
    id: 'contrat_maudit', name: 'Contrat Maudit', icon: '🩸',
    desc: '+8 pièces au départ, mais toutes les unités ont -10% HP max sur toute la run.',
    category: 'combat',
    unlockAchievement: 'premier_badge',
    apply: { kind: 'start_coins_hp_penalty', coins: 8, hp_mult: 0.90, symmetric: true },
  },

  // ── Synergies ──────────────────────────────────────────────────────────────
  catalyseur: {
    id: 'catalyseur', name: 'Catalyseur', icon: '⚗️',
    desc: 'Les synergies s\'activent avec 1 pokémon de moins pour les deux camps.',
    category: 'synergy',
    unlockAchievement: 'lv100',
    apply: { kind: 'synergy_threshold', delta: -1, symmetric: true },
  },

  miroir: {
    id: 'miroir', name: 'Miroir', icon: '🪞',
    desc: 'La synergie la plus forte de chaque équipe est multipliée ×1.5.',
    category: 'synergy',
    unlockAchievement: 'champion_kanto',
    apply: { kind: 'top_synergy_boost', mult: 1.5, symmetric: true },
  },

  cristal_pur: {
    id: 'cristal_pur', name: 'Cristal Pur', icon: '🧩',
    desc: 'Toute unité monotype compte pour 2 dans le calcul des synergies (les deux camps).',
    category: 'synergy',
    unlockAchievement: 'legendaire_team',
    apply: { kind: 'monotype_double', symmetric: true },
  },

  couronne: {
    id: 'couronne', name: 'Couronne', icon: '👑',
    desc: 'Le pokémon au BST le plus élevé de chaque équipe bénéficie des bonus de synergie en double.',
    category: 'synergy',
    unlockAchievement: 'league_feu',
    apply: { kind: 'top_bst_double_synergy', symmetric: true },
  },

  // ── Progression & Information ──────────────────────────────────────────────
  encyclopedie: {
    id: 'encyclopedie', name: 'Encyclopédie', icon: '📖',
    desc: 'Les stats et l\'ultime des ennemis sont visibles avant chaque combat.',
    category: 'info',
    unlockAchievement: 'encyclopedie',
    apply: { kind: 'show_enemy_stats' },
  },

  aimant: {
    id: 'aimant', name: 'Aimant', icon: '🧲',
    desc: 'Les rencontres sauvages proposent 4 pokémons au lieu de 3.',
    category: 'info',
    unlockAchievement: 'lv25',
    apply: { kind: 'wild_slots', value: 4 },
  },

  etoile_montante: {
    id: 'etoile_montante', name: 'Étoile Montante', icon: '⭐',
    desc: 'Après avoir choisi ton starter, tu reçois automatiquement un second exemplaire identique.',
    category: 'progression',
    unlockAchievement: 'reptincel_100',
    apply: { kind: 'double_starter' },
  },

  medaille: {
    id: 'medaille', name: 'Médaille', icon: '🏅',
    desc: 'Chaque arène vaincue donne +1 niveau à tous tes pokémons.',
    category: 'progression',
    unlockAchievement: 'lv50',
    apply: { kind: 'level_per_arena', value: 1 },
  },

  // ── Challenge Unique ───────────────────────────────────────────────────────
  anomalie: {
    id: 'anomalie', name: 'Anomalie', icon: '🌀',
    desc: 'Au lancement de la run, chaque pokémon reçoit 2 types aléatoires définis par la seed. Types uniques pour toute la run.',
    category: 'challenge',
    unlockAchievement: 'lv100_feu_1',
    apply: { kind: 'random_types', symmetric: true },
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
export function getRelicById(id) {
  return RELICS[id] ?? null;
}

export function getUnlockedRelics(meta) {
  const ach = meta?.achievements ?? {};
  return Object.values(RELICS).filter(r =>
    !r.unlockAchievement || ach[r.unlockAchievement]
  );
}

export function isRelicUnlocked(meta, relicId) {
  const relic = RELICS[relicId];
  if (!relic) return false;
  if (!relic.unlockAchievement) return true;
  return !!(meta?.achievements?.[relic.unlockAchievement]);
}
