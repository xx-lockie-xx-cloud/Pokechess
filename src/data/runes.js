// ─────────────────────────────────────────────────────────────────────────────
// runes.js — Les 13 runes (méta-ressource), sur deux déclencheurs.
// La rareté multiplie la magnitude (mag) par le facteur partagé avec les objets.
// ─────────────────────────────────────────────────────────────────────────────

import { RARITY_FACTOR } from './rarity.js';

// Chaque rune : id, name, trigger ('onAttack' | 'onHitReceived'), desc, et un
// effect { kind, mag, ... }. `mag` est la seule valeur scalée par la rareté
// (chance de proc, taux, ou pourcentage). Les champs fixes (status, stacks,
// fromStat) ne sont pas scalés.
export const RUNES = {
  // ── onAttack ───────────────────────────────────────────────────────────────
  violent: {
    id: 'violent', name: 'Violent', trigger: 'onAttack',
    desc: 'Chance de rejouer une attaque immédiatement.',
    effect: { kind: 'replay', mag: 0.15 },   // % de rejeu (cap anti-chaîne côté moteur)
  },
  vampire: {
    id: 'vampire', name: 'Vampire', trigger: 'onAttack',
    desc: 'Soigne une partie des dégâts infligés.',
    effect: { kind: 'lifesteal', mag: 0.25 },   // % des dégâts rendus en PV
  },
  effroi: {
    id: 'effroi', name: 'Effroi', trigger: 'onAttack',
    desc: 'Chance d\'étourdir la cible.',
    effect: { kind: 'stun', mag: 0.20 },   // % de proc, via trap côté moteur
  },
  rempart_vital: {
    id: 'rempart_vital', name: 'Rempart Vital', trigger: 'onAttack',
    desc: 'Génère un bouclier basé sur les PV max.',
    effect: { kind: 'shield', fromStat: 'hp', mag: 0.15 },   // % de la stat en bouclier
  },
  rempart_offensif: {
    id: 'rempart_offensif', name: 'Rempart Offensif', trigger: 'onAttack',
    desc: 'Génère un bouclier basé sur l\'attaque dominante.',
    effect: { kind: 'shield', fromStat: 'atk', mag: 0.15 },   // atk ou spa (dominante)
  },
  rempart_defensif: {
    id: 'rempart_defensif', name: 'Rempart Défensif', trigger: 'onAttack',
    desc: 'Génère un bouclier basé sur la défense dominante.',
    effect: { kind: 'shield', fromStat: 'def', mag: 0.15 },   // def ou spd_def (dominante)
  },
  panacee: {
    id: 'panacee', name: 'Panacée', trigger: 'onAttack',
    desc: 'Soigne l\'allié le plus blessé.',
    effect: { kind: 'heal_most_wounded', mag: 0.05 },   // % des PV max de l'allié soigné
  },

  // ── onHitReceived ────────────────────────────────────────────────────────────
  revanche: {
    id: 'revanche', name: 'Revanche', trigger: 'onHitReceived',
    desc: 'Chance de contre-attaquer quand on est touché.',
    effect: { kind: 'counter', mag: 0.20 },   // % de proc, via counter_burst
  },
  epines: {
    id: 'epines', name: 'Épines', trigger: 'onHitReceived',
    desc: 'Renvoie une partie des dégâts reçus.',
    effect: { kind: 'reflect', mag: 0.20 },   // % des dégâts renvoyés
  },
  paralysie: {
    id: 'paralysie', name: 'Paralysie', trigger: 'onHitReceived',
    desc: 'Chance de paralyser l\'attaquant.',
    effect: { kind: 'status', status: 'paralyze', mag: 0.20 },   // chance scalée
  },
  toxine: {
    id: 'toxine', name: 'Toxine', trigger: 'onHitReceived',
    desc: 'Chance d\'empoisonner l\'attaquant (5 stacks).',
    effect: { kind: 'status', status: 'poison', stacks: 5, mag: 0.20 },
  },
  combustion: {
    id: 'combustion', name: 'Combustion', trigger: 'onHitReceived',
    desc: 'Chance de brûler l\'attaquant (5 stacks, plafonné par le moteur).',
    effect: { kind: 'status', status: 'burn', stacks: 5, mag: 0.20 },
  },
  confusion: {
    id: 'confusion', name: 'Confusion', trigger: 'onHitReceived',
    desc: 'Chance de confondre l\'attaquant.',
    effect: { kind: 'status', status: 'confuse', mag: 0.20 },
  },
};

export const RUNE_IDS = Object.keys(RUNES);

// Renvoie une COPIE de la rune avec sa magnitude scalée par la rareté.
// Les chances/taux/pourcentages sont plafonnés à 1.0.
export function scaleRune(runeId, rarity = 'normal') {
  const base = RUNES[runeId];
  if (!base) return null;
  const factor = RARITY_FACTOR[rarity] ?? 1;
  const effect = { ...base.effect };
  effect.mag = Math.min(1, +(effect.mag * factor).toFixed(4));
  return { ...base, rarity, effect };
}

// Tire un type de rune au hasard (le type est aléatoire au drop).
export function randomRuneId() {
  return RUNE_IDS[Math.floor(Math.random() * RUNE_IDS.length)];
}