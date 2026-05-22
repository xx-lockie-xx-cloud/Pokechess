// Table des types officielle Gen 1
// typeChart[attaquant][défenseur] = multiplicateur
// 2 = super efficace, 0.5 = pas très efficace, 0 = immunité, 1 = normal (omis)

export const TYPE_CHART = {
  "Normal":    { "Roche": 0.5, "Spectre": 0, "Acier": 0.5 },
  "Feu":       { "Feu": 0.5, "Eau": 0.5, "Plante": 2, "Glace": 2, "Roche": 0.5, "Dragon": 0.5, "Acier": 2, "Insecte": 2 },
  "Eau":       { "Feu": 2, "Eau": 0.5, "Plante": 0.5, "Sol": 2, "Roche": 2, "Dragon": 0.5 },
  "Électrik":  { "Eau": 2, "Électrik": 0.5, "Plante": 0.5, "Sol": 0, "Vol": 2, "Dragon": 0.5 },
  "Plante":    { "Feu": 0.5, "Eau": 2, "Plante": 0.5, "Poison": 0.5, "Sol": 2, "Vol": 0.5, "Insecte": 0.5, "Roche": 2, "Dragon": 0.5, "Acier": 0.5 },
  "Glace":     { "Eau": 0.5, "Plante": 2, "Glace": 0.5, "Sol": 2, "Vol": 2, "Dragon": 2, "Acier": 0.5 },
  "Combat":    { "Normal": 2, "Glace": 2, "Poison": 0.5, "Vol": 0.5, "Psy": 0.5, "Insecte": 0.5, "Roche": 2, "Fantôme": 0, "Ténèbres": 2, "Acier": 2, "Fée": 0.5 },
  "Poison":    { "Plante": 2, "Poison": 0.5, "Sol": 0.5, "Roche": 0.5, "Fantôme": 0.5, "Acier": 0, "Fée": 2 },
  "Sol":       { "Feu": 2, "Électrik": 2, "Plante": 0.5, "Poison": 2, "Vol": 0, "Insecte": 0.5, "Roche": 2, "Acier": 2 },
  "Vol":       { "Électrik": 0.5, "Plante": 2, "Combat": 2, "Insecte": 2, "Roche": 0.5, "Acier": 0.5 },
  "Psy":       { "Combat": 2, "Poison": 2, "Psy": 0.5, "Ténèbres": 0, "Acier": 0.5 },
  "Insecte":   { "Feu": 0.5, "Plante": 2, "Combat": 0.5, "Poison": 0.5, "Vol": 0.5, "Psy": 2, "Spectre": 0.5, "Ténèbres": 2, "Acier": 0.5, "Fée": 0.5 },
  "Roche":     { "Feu": 2, "Glace": 2, "Combat": 0.5, "Sol": 0.5, "Vol": 2, "Insecte": 2, "Acier": 0.5 },
  "Spectre":   { "Normal": 0, "Psy": 2, "Spectre": 2, "Ténèbres": 0.5 },
  "Dragon":    { "Dragon": 2, "Acier": 0.5, "Fée": 0 },
  "Ténèbres":  { "Combat": 0.5, "Psy": 2, "Spectre": 2, "Ténèbres": 0.5, "Fée": 0.5 },
  "Acier":     { "Feu": 0.5, "Eau": 0.5, "Électrik": 0.5, "Glace": 2, "Roche": 2, "Acier": 0.5, "Fée": 2 },
  "Fée":       { "Feu": 0.5, "Combat": 2, "Poison": 0.5, "Dragon": 2, "Ténèbres": 2, "Acier": 0.5 },
};

// Calcule le multiplicateur total contre un défenseur multi-type
// ex: Feu vs Plante/Poison = 2 * 0.5 = 1
export function getTypeMultiplier(attackType, defenderTypes) {
  return defenderTypes.reduce((mult, defType) => {
    const row = TYPE_CHART[attackType];
    if (!row) return mult;
    return mult * (row[defType] ?? 1);
  }, 1);
}