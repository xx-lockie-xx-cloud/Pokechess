// ─────────────────────────────────────────────────────────────────────────────
// weather.js — Système de météo
//
// Une météo est GLOBALE : elle affecte les deux camps de la même manière.
// Une seule météo peut être active : poser une nouvelle remplace la précédente.
//
// Les bonus sont des multiplicateurs de STATS par type, appliqués dynamiquement
// dans CombatEngine._getStat(). Ils disparaissent donc d'eux-mêmes quand la
// météo change ou expire, sans avoir à défaire quoi que ce soit.
//
// Aucun import : module de données pur.
// ─────────────────────────────────────────────────────────────────────────────

// Durée standard, en TOURS DE POKÉMON (une action = un tour).
// Le compteur décrémente donc à chaque action, ce qui le rend visible.
// Repère : un combat 6v6 dure environ 250 actions. Une durée courte associée à
// une repose espacée fait ALTERNER périodes avec et sans météo, plutôt que de
// la rendre permanente.
export const WEATHER_TURNS = 20;

// Un passif poseur repose sa météo tous les N tours, tant qu'il est en vie.
// Espacer la repose au-delà de la durée crée des fenêtres sans météo.
export const WEATHER_REPOST_EVERY = 50;

export const WEATHERS = {
  sun: {
    id:    'sun',
    name:  'Zénith',
    emoji: '☀️',
    color: '#ffb020',
    short: 'Feu, Plante et Vol renforcés. Eau affaiblie, Glace fragilisée.',
    desc:  'Feu, Plante, Vol : ATK et ATK.SPÉ +25%. Insecte : toutes stats +20%. '
         + 'Fée : DEF et DEF.SPÉ +25%. Eau : ATK et ATK.SPÉ -25%. '
         + 'Glace : DEF -20% et DEF.SPÉ -25%.',
    typeBonus: {
      'Feu':     { atk: 1.25, spa: 1.25 },
      'Plante':  { atk: 1.25, spa: 1.25 },
      'Vol':     { atk: 1.25, spa: 1.25 },
      'Insecte': { atk: 1.20, spa: 1.20, def: 1.20, spd_def: 1.20, spd: 1.20 },
      'Fée':     { def: 1.25, spd_def: 1.25 },
      'Eau':     { atk: 0.75, spa: 0.75 },
      'Glace':   { def: 0.80, spd_def: 0.75 },
    },
    dot: null,
  },

  rain: {
    id:    'rain',
    name:  'Pluie',
    emoji: '🌧️',
    color: '#4a9eff',
    short: 'Eau et Électrik renforcés. Feu affaibli.',
    desc:  'Eau, Électrik : ATK et ATK.SPÉ +25%. Plante : DEF et DEF.SPÉ +20%. '
         + 'Feu : ATK et ATK.SPÉ -25%.',
    typeBonus: {
      'Eau':      { atk: 1.25, spa: 1.25 },
      'Électrik': { atk: 1.25, spa: 1.25 },
      'Plante':   { def: 1.20, spd_def: 1.20 },
      'Feu':      { atk: 0.75, spa: 0.75 },
    },
    dot: null,
  },

  hail: {
    id:    'hail',
    name:  'Grêle',
    emoji: '🌨️',
    color: '#9ad9ff',
    short: 'Glace déchaînée. Blesse les types exposés.',
    desc:  'Glace : ATK, ATK.SPÉ et VIT +25%. Eau : DEF et DEF.SPÉ +20%. '
         + 'Blesse 3% des PV max par tour (5% pour les Vol), '
         + 'sauf les types Glace, Acier et Eau.',
    typeBonus: {
      'Glace': { atk: 1.25, spa: 1.25, spd: 1.25 },
      'Eau':   { def: 1.20, spd_def: 1.20 },
    },
    dot: { rate: 0.03, immuneTypes: ['Glace', 'Acier', 'Eau'], extra: { 'Vol': 0.05 } },
  },

  sandstorm: {
    id:    'sandstorm',
    name:  'Tempête de sable',
    emoji: '🌪️',
    color: '#d4a373',
    short: 'Sol et Roche déchaînés. Blesse les autres types.',
    desc:  'Sol et Roche : ATK, ATK.SPÉ et VIT +25%. '
         + 'Blesse 2% des PV max par tour, sauf Roche, Sol et Acier.',
    typeBonus: {
      'Sol':   { atk: 1.25, spa: 1.25, spd: 1.25 },
      'Roche': { atk: 1.25, spa: 1.25, spd: 1.25 },
    },
    dot: { rate: 0.02, immuneTypes: ['Roche', 'Sol', 'Acier'], extra: {} },
  },

  darkness: {
    id:    'darkness',
    name:  'Nuit Noire',
    emoji: '🌑',
    color: '#a06cd5',
    short: 'Spectre, Ténèbres et Psy renforcés. Plante, Insecte et Fée exposés.',
    desc:  'Spectre, Ténèbres, Psy : ATK, ATK.SPÉ, DEF et DEF.SPÉ +20%. '
         + 'Plante, Insecte, Fée : DEF et DEF.SPÉ -25%.',
    typeBonus: {
      'Spectre':  { atk: 1.20, spa: 1.20, def: 1.20, spd_def: 1.20 },
      'Ténèbres': { atk: 1.20, spa: 1.20, def: 1.20, spd_def: 1.20 },
      'Psy':      { atk: 1.20, spa: 1.20, def: 1.20, spd_def: 1.20 },
      'Plante':   { def: 0.75, spd_def: 0.75 },
      'Insecte':  { def: 0.75, spd_def: 0.75 },
      'Fée':      { def: 0.75, spd_def: 0.75 },
    },
    dot: null,
  },
};

export function getWeather(id) {
  return WEATHERS[id] ?? null;
}

// Score d'un jeu de multiplicateurs : somme des écarts à 1 sur toutes les
// stats. Sert à départager plusieurs bonus applicables. Exemple au Zénith :
// Insecte (5 stats × +20%) marque +1.00, Feu (2 stats × +25%) marque +0.50,
// donc un Feu/Insecte reçoit le bonus Insecte.
function bonusScore(b) {
  return Object.values(b ?? {}).reduce((a, m) => a + (m - 1), 0);
}

// Règle : au maximum UN bonus et UN malus par unité.
// Les bonus ne se cumulent donc pas entre eux (un Feu/Vol au Zénith reçoit un
// seul +25%), mais un bonus et un malus s'appliquent ensemble : Démanta
// (Eau/Vol) au Zénith gagne le bonus Vol ET subit le malus Eau.
// Retourne { bonus, malus } — les entrées de typeBonus retenues.
export function selectWeatherEffects(weatherId, unitTypes = []) {
  const w = WEATHERS[weatherId];
  if (!w?.typeBonus || !unitTypes?.length) return { bonus: null, malus: null };
  let bonus = null, malus = null;
  let bestB = 0, worstM = 0;
  unitTypes.forEach(t => {
    const b = w.typeBonus[t];
    if (!b) return;
    const sc = bonusScore(b);
    if (sc > 0 && sc > bestB)  { bestB = sc;  bonus = b; }
    if (sc < 0 && sc < worstM) { worstM = sc; malus = b; }
  });
  return { bonus, malus };
}

// Multiplicateur appliqué à une stat, après application de la règle ci-dessus.
export function weatherStatMult(weatherId, unitTypes = [], stat) {
  const { bonus, malus } = selectWeatherEffects(weatherId, unitTypes);
  let mult = 1;
  if (bonus?.[stat] != null) mult *= bonus[stat];
  if (malus?.[stat] != null) mult *= malus[stat];
  return mult;
}

// Dégâts résiduels par tour : retourne le taux (0 si immunisé)
export function weatherDotRate(weatherId, unitTypes = []) {
  const w = WEATHERS[weatherId];
  if (!w?.dot) return 0;
  if (unitTypes.some(t => w.dot.immuneTypes.includes(t))) return 0;
  let rate = w.dot.rate;
  unitTypes.forEach(t => {
    const ex = w.dot.extra?.[t];
    if (ex != null) rate = Math.max(rate, ex);
  });
  return rate;
}

// Infobulle du bandeau de combat
export function weatherTooltip(weatherId, turnsLeft = null) {
  const w = WEATHERS[weatherId];
  if (!w) return '';
  const t = turnsLeft != null ? ` (${turnsLeft} tour${turnsLeft > 1 ? 's' : ''})` : '';
  return `${w.name}${t} : ${w.desc}`;
}