// Synergies par type — bonus activés selon le nombre de pokémons du même type sur le terrain
// seuil2 : bonus avec 2 pokémons, seuil3 : bonus avec 3 pokémons
// statBonus : multiplicateurs appliqués aux stats de TOUS les pokémons du type concerné
// effect : description de l'effet spécial futur

export const SYNERGIES = {
  "Feu": {
    icon: "🔥",
    color: 0xf08030,
    seuil2: {
      label: "+15% ATK",
      statBonus: { atk: 1.15, spa: 1.15 },
      effect: null
    },
    seuil3: {
      label: "+30% ATK + Brûlure",
      statBonus: { atk: 1.30, spa: 1.30 },
      effect: "burn"   // à implémenter plus tard
    }
  },
  "Eau": {
    icon: "💧",
    color: 0x6890f0,
    seuil2: {
      label: "+15% DEF",
      statBonus: { def: 1.15, spd_def: 1.15 },
      effect: null
    },
    seuil3: {
      label: "+30% DEF + Régénération",
      statBonus: { def: 1.30, spd_def: 1.30 },
      effect: "regen"
    }
  },
  "Plante": {
    icon: "🌿",
    color: 0x78c850,
    seuil2: {
      label: "+15% HP",
      statBonus: { hp: 1.15 },
      effect: null
    },
    seuil3: {
      label: "+30% HP + Empoisonnement",
      statBonus: { hp: 1.30 },
      effect: "poison"
    }
  },
  "Électrik": {
    icon: "⚡",
    color: 0xf8d030,
    seuil2: {
      label: "+15% VIT",
      statBonus: { spd: 1.15 },
      effect: null
    },
    seuil3: {
      label: "+30% VIT + Paralysie",
      statBonus: { spd: 1.30 },
      effect: "paralyze"
    }
  },
  "Psy": {
    icon: "🔮",
    color: 0xf85888,
    seuil2: {
      label: "+15% SP.ATK",
      statBonus: { spa: 1.15 },
      effect: null
    },
    seuil3: {
      label: "+30% SP.ATK + Confusion",
      statBonus: { spa: 1.30 },
      effect: "confuse"
    }
  },
  "Roche": {
    icon: "🪨",
    color: 0xb8a038,
    seuil2: {
      label: "+20% DEF",
      statBonus: { def: 1.20 },
      effect: null
    },
    seuil3: {
      label: "+40% DEF + Armure",
      statBonus: { def: 1.40 },
      effect: "armor"
    }
  },
  "Sol": {
    icon: "🏔",
    color: 0xe0c068,
    seuil2: {
      label: "+15% DEF + HP",
      statBonus: { def: 1.15, hp: 1.10 },
      effect: null
    },
    seuil3: {
      label: "+25% DEF + HP + Tremblement",
      statBonus: { def: 1.25, hp: 1.20 },
      effect: "quake"
    }
  },
  "Vol": {
    icon: "🦅",
    color: 0xa890f0,
    seuil2: {
      label: "+20% VIT",
      statBonus: { spd: 1.20 },
      effect: null
    },
    seuil3: {
      label: "+35% VIT + Esquive",
      statBonus: { spd: 1.35 },
      effect: "dodge"
    }
  },
  "Combat": {
    icon: "🥊",
    color: 0xc03028,
    seuil2: {
      label: "+20% ATK",
      statBonus: { atk: 1.20 },
      effect: null
    },
    seuil3: {
      label: "+40% ATK + Coup Critique",
      statBonus: { atk: 1.40 },
      effect: "crit"
    }
  },
  "Poison": {
    icon: "☠️",
    color: 0xa040a0,
    seuil2: {
      label: "+15% SP.ATK",
      statBonus: { spa: 1.15 },
      effect: null
    },
    seuil3: {
      label: "+25% SP.ATK + Poison",
      statBonus: { spa: 1.25 },
      effect: "poison"
    }
  },
  "Glace": {
    icon: "❄️",
    color: 0x98d8d8,
    seuil2: {
      label: "+15% SP.DEF",
      statBonus: { spd_def: 1.15 },
      effect: null
    },
    seuil3: {
      label: "+30% SP.DEF + Gel",
      statBonus: { spd_def: 1.30 },
      effect: "freeze"
    }
  },
  "Spectre": {
    icon: "👻",
    color: 0x705898,
    seuil2: {
      label: "+20% SP.ATK",
      statBonus: { spa: 1.20 },
      effect: null
    },
    seuil3: {
      label: "+35% SP.ATK + Malédiction",
      statBonus: { spa: 1.35 },
      effect: "curse"
    }
  },
  "Dragon": {
    icon: "🐉",
    color: 0x7038f8,
    seuil2: {
      label: "+20% ATK + SP.ATK",
      statBonus: { atk: 1.20, spa: 1.20 },
      effect: null
    },
    seuil3: {
      label: "+35% toutes stats offensives",
      statBonus: { atk: 1.35, spa: 1.35 },
      effect: "rage"
    }
  },
  "Normal": {
    icon: "⭐",
    color: 0xa8a878,
    seuil2: {
      label: "+10% toutes stats",
      statBonus: { hp: 1.10, atk: 1.10, spa: 1.10, def: 1.10, spd_def: 1.10, spd: 1.10 },
      effect: null
    },
    seuil3: {
      label: "+20% toutes stats",
      statBonus: { hp: 1.20, atk: 1.20, spa: 1.20, def: 1.20, spd_def: 1.20, spd: 1.20 },
      effect: null
    }
  },
  "Fée": {
    icon: "🧚",
    color: 0xee99ac,
    seuil2: {
      label: "+15% SP.DEF + HP",
      statBonus: { spd_def: 1.15, hp: 1.10 },
      effect: null
    },
    seuil3: {
      label: "+25% SP.DEF + HP + Charme",
      statBonus: { spd_def: 1.25, hp: 1.20 },
      effect: "charm"
    }
  },
  "Insecte": {
    icon: "🦋",
    color: 0xa8b820,
    seuil2: {
      label: "+15% VIT + ATK",
      statBonus: { spd: 1.15, atk: 1.15 },
      effect: null
    },
    seuil3: {
      label: "+25% VIT + ATK + Essaim",
      statBonus: { spd: 1.25, atk: 1.25 },
      effect: "swarm"
    }
  },
  "Acier": {
    icon: "⚙️",
    color: 0xb8b8d0,
    seuil2: {
      label: "+25% DEF",
      statBonus: { def: 1.25 },
      effect: null
    },
    seuil3: {
      label: "+40% DEF + SP.DEF",
      statBonus: { def: 1.40, spd_def: 1.30 },
      effect: "iron"
    }
  },
  "Ténèbres": {
    icon: "🌑",
    color: 0x705848,
    seuil2: {
      label: "+20% ATK",
      statBonus: { atk: 1.20 },
      effect: null
    },
    seuil3: {
      label: "+35% ATK + Intimidation",
      statBonus: { atk: 1.35 },
      effect: "intimidate"
    }
  },
};

// Calcule les synergies actives depuis les unités sur le terrain
export function getActiveSynergies(fieldUnits) {
  const typeCounts = {};

  fieldUnits.filter(Boolean).forEach(unit => {
    unit.types.forEach(type => {
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    });
  });

  const active = [];
  Object.entries(typeCounts).forEach(([type, count]) => {
    if (count < 2) return;
    const synergy = SYNERGIES[type];
    if (!synergy) return;
    const tier = count >= 3 ? 3 : 2;
    const data  = tier === 3 ? synergy.seuil3 : synergy.seuil2;
    active.push({
      type,
      icon:  synergy.icon,
      color: synergy.color,
      count,
      tier,
      label: data.label,
      statBonus: data.statBonus,
      effect: data.effect,
    });
  });

  return active;
}