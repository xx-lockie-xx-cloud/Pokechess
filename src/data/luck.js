// ─────────────────────────────────────────────────────────────────────────────
// luck.js — Source unique de la stat de Chance.
// Lue depuis la méta (pokechess_meta.luck). Alimentée plus tard par l'arbre méta ;
// modifiable en debug via window.setLuck(n). Échelle voulue basse (0 à ~10).
// ─────────────────────────────────────────────────────────────────────────────

import { SaveManager } from '../SaveManager.js';

export function getLuck() {
  return Math.max(0, SaveManager.loadMeta()?.luck ?? 0);
}