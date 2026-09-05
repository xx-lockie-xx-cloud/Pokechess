// ─────────────────────────────────────────────────────────────────────────────
// metaTree.js — Arbre transversal de méta-progression (Destin).
//
// Débloqué quand les 18 arbres de type sont complets. Même monnaie
// (meta.talentPoints, +1 par arène vaincue). Stockage : meta.metaTree.
//
// STRUCTURE : 3 branches x 5 paliers. Chaque palier = 5 petits nœuds cumulables
// puis 1 milestone qui change la façon de jouer (30 nœuds par branche, 90 au total).
// COÛTS (constantes ci-dessous) : petits 1/2/3/4/5, milestones 6/10/14/20/28.
//   -> 153 points par branche, 459 pour l'arbre, 567 avec les arbres de type.
// Pour retoucher l'équilibrage, il suffit de changer SMALL_COSTS/MILESTONE_COSTS
// ou les valeurs des paliers : les nœuds sont générés à partir de cette spec.
// ─────────────────────────────────────────────────────────────────────────────

import { TALENT_TREES } from './levelSystem.js';

const SMALL_COSTS     = [1, 2, 3, 4, 5];        // coût d'un petit nœud, par palier
const MILESTONE_COSTS = [6, 10, 14, 20, 28];   // coût du milestone, par palier
const SMALLS_PER_TIER = 5;

// Spécification des branches. Chaque palier : 5 petits nœuds (soit `small`
// répété, soit `smalls` explicite pour alterner deux effets), puis 1 milestone.
const SPEC = [
  {
    id: 'fortune', name: 'Fortune', emoji: '🍀', desc: "L'aléatoire qui vous sert",
    tiers: [
      { small: { name: 'Trèfle',         desc: '+1 Chance', effect: { kind: 'luck', value: 1 } },
        milestone: { name: 'Trouvaille', desc: '+1 objet proposé au nœud objet',
                     effect: { kind: 'itemChoices', value: 1 } } },
      { small: { name: 'Porte-Bonheur',  desc: '+1 Chance', effect: { kind: 'luck', value: 1 } },
        milestone: { name: 'Main du Destin', desc: 'Les objets de la boutique ne sont jamais de rareté normale',
                     effect: { kind: 'shopMinRare', value: 1 } } },
      { small: { name: 'Fer à Cheval',   desc: '+1 Chance', effect: { kind: 'luck', value: 1 } },
        milestone: { name: 'Aubaine',    desc: '+2 Chance', effect: { kind: 'luck', value: 2 } } },
      { small: { name: 'Étoile Filante', desc: '+1 Chance', effect: { kind: 'luck', value: 1 } },
        milestone: { name: 'Fouille',    desc: '+1 objet proposé au nœud objet',
                     effect: { kind: 'itemChoices', value: 1 } } },
      { small: { name: 'Providence',     desc: '+1 Chance', effect: { kind: 'luck', value: 1 } },
        milestone: { name: 'Élu du Destin', desc: '+3 Chance', effect: { kind: 'luck', value: 3 } } },
    ],
  },
  {
    id: 'instinct', name: 'Instinct', emoji: '🎯', desc: "L'aléatoire au combat",
    tiers: [
      { small: { name: 'Précision',   desc: '+0.5% de coup critique', effect: { kind: 'critChance', value: 0.005 } },
        milestone: { name: 'Œil du Prédateur', desc: '+3% de coup critique',
                     effect: { kind: 'critChance', value: 0.03 } } },
      { small: { name: 'Affûtage',    desc: '+0.5% de coup critique', effect: { kind: 'critChance', value: 0.005 } },
        milestone: { name: 'Impact',  desc: 'Dégâts critiques +15%', effect: { kind: 'critMult', value: 0.15 } } },
      { small: { name: 'Réflexe',     desc: '+0.5% de coup critique', effect: { kind: 'critChance', value: 0.005 } },
        milestone: { name: 'Coup du Sort', desc: 'La première attaque de chaque combat est un coup critique',
                     effect: { kind: 'firstHitCrit', value: 1 } } },
      { small: { name: 'Anticipation', desc: '+0.4% d\'esquive', effect: { kind: 'evasion', value: 0.004 } },
        milestone: { name: 'Insaisissable', desc: '+2% d\'esquive', effect: { kind: 'evasion', value: 0.02 } } },
      { small: { name: 'Maîtrise',    desc: '+0.5% de coup critique', effect: { kind: 'critChance', value: 0.005 } },
        milestone: { name: 'Perfection', desc: 'Dégâts critiques +25%', effect: { kind: 'critMult', value: 0.25 } } },
    ],
  },
  {
    id: 'prosperite', name: 'Prospérité', emoji: '💰', desc: "L'économie de la run",
    tiers: [
      { small: { name: 'Épargne',     desc: '+2% de pièces gagnées', effect: { kind: 'coinMult', value: 0.02 } },
        milestone: { name: 'Bourse',  desc: '+5 pièces au début de la run',
                     effect: { kind: 'startCoins', value: 5 } } },
      { small: { name: 'Marchandage', desc: '-1% sur les prix de la boutique', effect: { kind: 'shopDiscount', value: 0.01 } },
        milestone: { name: 'Étal',    desc: '+1 emplacement en boutique', effect: { kind: 'shopSlots', value: 1 } } },
      { small: { name: 'Rendement',   desc: '+2% de pièces gagnées', effect: { kind: 'coinMult', value: 0.02 } },
        milestone: { name: 'Second Souffle', desc: 'Un rafraîchissement gratuit de la boutique par visite',
                     effect: { kind: 'shopReroll', value: 1 } } },
      { small: { name: 'Négociant',   desc: '-1% sur les prix de la boutique', effect: { kind: 'shopDiscount', value: 0.01 } },
        milestone: { name: 'Pécule',  desc: '+5 pièces au début de la run',
                     effect: { kind: 'startCoins', value: 5 } } },
      { small: { name: 'Magnat',      desc: '+2% de pièces gagnées', effect: { kind: 'coinMult', value: 0.02 } },
        milestone: { name: 'Comptoir', desc: '+1 emplacement en boutique', effect: { kind: 'shopSlots', value: 1 } } },
    ],
  },
];

// ── Génération des nœuds depuis la spec ─────────────────────────────────────
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export const META_BRANCHES = SPEC.map(branch => {
  const nodes = [];
  branch.tiers.forEach((tier, t) => {
    for (let i = 0; i < SMALLS_PER_TIER; i++) {
      nodes.push({
        id:   `${branch.id}_t${t + 1}_s${i + 1}`,
        name: `${tier.small.name} ${ROMAN[i]}`,
        desc: tier.small.desc,
        cost: SMALL_COSTS[t],
        tier: t + 1,
        effect: { ...tier.small.effect },
      });
    }
    nodes.push({
      id:   `${branch.id}_t${t + 1}_m`,
      name: tier.milestone.name,
      desc: tier.milestone.desc,
      cost: MILESTONE_COSTS[t],
      tier: t + 1,
      keystone: true,
      effect: { ...tier.milestone.effect },
    });
  });
  return { id: branch.id, name: branch.name, emoji: branch.emoji, desc: branch.desc, nodes };
});

export const META_TREE_TOTAL_COST =
  META_BRANCHES.reduce((s, b) => s + b.nodes.reduce((t, n) => t + n.cost, 0), 0);

// ── Déblocage : les 18 arbres de type doivent être complets ─────────────────
export function isMetaTreeUnlocked(meta) {
  if (!meta) return false;
  return Object.entries(TALENT_TREES).every(([type, tree]) => {
    const unlocked = meta.talentTree?.[type] ?? [];
    return tree.every((_, i) => unlocked[i] === true);
  });
}

export function getTypeTreeProgress(meta) {
  let done = 0, total = 0;
  Object.entries(TALENT_TREES).forEach(([type, tree]) => {
    const unlocked = meta?.talentTree?.[type] ?? [];
    tree.forEach((_, i) => { total++; if (unlocked[i] === true) done++; });
  });
  return { done, total };
}

export function getBranch(branchId) {
  return META_BRANCHES.find(b => b.id === branchId) ?? null;
}

// Progression dans l'arbre transversal : { done, total, spent }
export function getMetaProgress(meta) {
  let done = 0, total = 0, spent = 0;
  META_BRANCHES.forEach(b => {
    const unlocked = meta?.metaTree?.[b.id] ?? [];
    b.nodes.forEach((n, i) => {
      total++;
      if (unlocked[i] === true) { done++; spent += n.cost; }
    });
  });
  return { done, total, spent };
}

// Un nœud n'est disponible que si le précédent de sa branche est pris.
export function isNodeAvailable(meta, branchId, index) {
  const unlocked = meta?.metaTree?.[branchId] ?? [];
  if (unlocked[index] === true) return false;
  return index === 0 || unlocked[index - 1] === true;
}

// ── Agrégation des effets actifs ────────────────────────────────────────────
export function getMetaEffects(meta) {
  const out = {
    luck: 0, critChance: 0, critMult: 0, evasion: 0, coinMult: 0,
    shopDiscount: 0, shopSlots: 0, itemChoices: 0, startCoins: 0,
    shopMinRare: false, firstHitCrit: false, shopReroll: false,
  };
  if (!meta?.metaTree) return out;
  for (const branch of META_BRANCHES) {
    const unlocked = meta.metaTree[branch.id] ?? [];
    branch.nodes.forEach((node, i) => {
      if (unlocked[i] !== true) return;
      const e = node.effect;
      if (!e) return;
      if (typeof out[e.kind] === 'number')       out[e.kind] += e.value;
      else if (typeof out[e.kind] === 'boolean') out[e.kind]  = true;
    });
  }
  // Arrondis : evite les 0.045000000000000005 dans l'affichage
  out.critChance   = +out.critChance.toFixed(4);
  out.critMult     = +out.critMult.toFixed(4);
  out.evasion      = +out.evasion.toFixed(4);
  out.coinMult     = +out.coinMult.toFixed(4);
  out.shopDiscount = +out.shopDiscount.toFixed(4);
  return out;
}