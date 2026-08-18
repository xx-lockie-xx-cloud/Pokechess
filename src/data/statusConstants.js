// ─────────────────────────────────────────────────────────────────────────────
// statusConstants.js — Source UNIQUE des valeurs de statuts et d'effets de synergie
//
// Le moteur (CombatEngine) et l'affichage (PokedexUI) lisent tous deux ces
// constantes : modifier une valeur ici mettra à jour le comportement ET le texte
// affiché, sans risque de désynchronisation.
// Aucun import → module sûr, importable partout.
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_VALUES = {
  // Dégâts sur la durée (fraction des PV max, par stack et par tour)
  burnDmgPerStack:   0.04,
  poisonDmgPerStack: 0.04,
  burnAtkMult:       0.90,   // brûlure : ATK ×0.90 (synergie Feu)

  // Probabilités d'action perdue
  paralyzeSkipChance: 0.25,
  confuseHitAllyChance: 0.20,

  // Gel : ralentit puis se dissipe après N actions du porteur
  freezeSpdMult:  0.75,
  freezeActions:  2,

  // Plafonds de cumul
  maxStacks: 10,
};

export const SYNERGY_VALUES = {
  regenPerTurn:     0.04,   // Eau : PV régénérés / tour
  regenTurns:       5,
  dodgeChance:      0.20,   // Vol
  critChance:       0.30,   // Combat
  critMult:         1.5,
  swarmChance:      0.15,   // Insecte
  swarmMaxPerTurn:  2,
  quakeHpLoss:      0.05,   // Sol : PV max retirés au début
  curseHpPerTurn:   0.10,   // Spectre
  intimidateMult:   0.85,   // Ténèbres : ATK/SP.ATK ennemies
  ironDmgTaken:     0.80,   // Acier : dégâts reçus
  rageDmgPerKo:     0.10,   // Dragon : dégâts par allié KO
  rockShieldRate:   0.05,   // Roche : bouclier d'équipe, au tour 0 puis toutes les 8 actions
};

// ─────────────────────────────────────────────────────────────────────────────
// Descriptions générées à partir des valeurs ci-dessus (toujours synchronisées)
// ─────────────────────────────────────────────────────────────────────────────
const pct = (v) => `${Math.round(v * 100)}%`;
const inv = (v) => `${Math.round((1 - v) * 100)}%`;   // 0.90 → "10%" (de malus)

export const EFFECT_DESCRIPTIONS = {
  burn:   `🔥 Brûlure : -${inv(STATUS_VALUES.burnAtkMult)} ATK + ${pct(STATUS_VALUES.burnDmgPerStack)} HP/tour par stack`,
  poison: `☠️ Poison : ${pct(STATUS_VALUES.poisonDmgPerStack)} HP max/tour par stack (max ${STATUS_VALUES.maxStacks})`,
  paralyze: `⚡ Paralysie : ${pct(STATUS_VALUES.paralyzeSkipChance)} de chance de perdre son tour`,
  confuse:  `😵 Confusion : ${pct(STATUS_VALUES.confuseHitAllyChance)} de chance de frapper un allié`,
  freeze:   `❄️ Gel : VIT -${inv(STATUS_VALUES.freezeSpdMult)}, se dissipe après ${STATUS_VALUES.freezeActions} actions`,

  regen:  `💧 Régénération : +${pct(SYNERGY_VALUES.regenPerTurn)} HP/tour pour les alliés Eau (${SYNERGY_VALUES.regenTurns} tours)`,
  dodge:  `🦅 Esquive : ${pct(SYNERGY_VALUES.dodgeChance)} d'esquive pour les unités Vol`,
  crit:   `🎯 Coup Critique : +${pct(SYNERGY_VALUES.critChance)} chances de crit (×${SYNERGY_VALUES.critMult} dégâts)`,
  swarm:  `🦋 Essaim : ${pct(SYNERGY_VALUES.swarmChance)} qu'un autre Insecte enchaîne (max ${SYNERGY_VALUES.swarmMaxPerTurn}/tour)`,
  quake:  `🏔 Tremblement : -${pct(SYNERGY_VALUES.quakeHpLoss)} HP max sur tous les ennemis au début`,
  curse:  `👻 Malédiction : l'ennemi avec le + de HP perd ${pct(SYNERGY_VALUES.curseHpPerTurn)} HP/tour`,
  intimidate: `🌑 Intimidation : -${inv(SYNERGY_VALUES.intimidateMult)} ATK + SP.ATK ennemies au début`,
  iron:   `⚙️ Armure Acier : -${inv(SYNERGY_VALUES.ironDmgTaken)} dégâts reçus pour les Acier`,
  rage:   `🐉 Rage : +${pct(SYNERGY_VALUES.rageDmgPerKo)} dégâts par allié Dragon KO`,
  armor:  `🪨 Armure Roche : bouclier de ${Math.round(SYNERGY_VALUES.rockShieldRate*100)}% des PV à toute l'équipe, renouvelé toutes les 8 actions`,
  charm:  `🧚 Charme : les ennemis ciblent toujours le + défensif`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Libellés COURTS (badges de synergie en préparation) — mêmes valeurs source
// ─────────────────────────────────────────────────────────────────────────────
export const EFFECT_LABELS_SHORT = {
  burn:     `🔥 Brûlure ennemie`,
  regen:    `💧 Régénération (+${Math.round(SYNERGY_VALUES.regenPerTurn*100)}%/tour)`,
  poison:   `☠️ Empoisonnement`,
  paralyze: `⚡ Paralysie ennemie`,
  confuse:  `😵 Confusion ennemie`,
  freeze:   `❄️ Gel ennemi (VIT -${Math.round((1-STATUS_VALUES.freezeSpdMult)*100)}%)`,
  dodge:    `🦅 Esquive ${Math.round(SYNERGY_VALUES.dodgeChance*100)}%`,
  crit:     `🎯 Crit +${Math.round(SYNERGY_VALUES.critChance*100)}%`,
  swarm:    `🦋 Essaim ${Math.round(SYNERGY_VALUES.swarmChance*100)}%`,
  quake:    `🏔 Tremblement -${Math.round(SYNERGY_VALUES.quakeHpLoss*100)}% HP`,
  curse:    `👻 Malédiction ${Math.round(SYNERGY_VALUES.curseHpPerTurn*100)}%/tour`,
  intimidate: `🌑 Intimidation -${Math.round((1-SYNERGY_VALUES.intimidateMult)*100)}%`,
  armor:    `🪨 Bouclier ${Math.round(SYNERGY_VALUES.rockShieldRate*100)}%`,
  charm:    `🧚 Charme (ciblage)`,
  rage:     `🐉 Rage (+${Math.round(SYNERGY_VALUES.rageDmgPerKo*100)}%/mort)`,
  iron:     `⚙️ Armure Acier -${Math.round((1-SYNERGY_VALUES.ironDmgTaken)*100)}%`,
};