// ─────────────────────────────────────────────────────────────────────────────
// luck.js — Source unique de la stat de Chance.
// Somme de la base (pokechess_meta.luck, debug) et des nœuds Fortune de
// l'arbre transversal. Utilisée par rollRarity, le casino et le drop de rune.
// ─────────────────────────────────────────────────────────────────────────────

import { SaveManager }   from '../SaveManager.js';
import { getMetaEffects } from './metaTree.js';

export function getLuck() {
  const meta = SaveManager.loadMeta() ?? {};
  const base = Math.max(0, meta.luck ?? 0);
  return base + getMetaEffects(meta).luck;
}