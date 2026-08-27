// ─────────────────────────────────────────────────────────────────────────────
// RuneManager.js — Pool de runes + assignation méta par espèce.
//
// Pool         : liste d'instances { uid, type, rarity } dans la méta
//                (pokechess_meta.runes), jamais effacée par un reset de run.
// Assignations : { pokemonId : runeUid } dans la méta (pokechess_meta.runeAssignments),
//                par ESPÈCE. Persistantes, éditables à tout moment depuis le menu.
//                Règle : 1 rune max par espèce, et une rune ne peut être que sur
//                une seule espèce. Seules les espèces niveau 100 peuvent en recevoir
//                (garde appliquée par l'UI ; assign() reste libre pour le debug).
// ─────────────────────────────────────────────────────────────────────────────

import { scaleRune, randomRuneId }   from '../data/runes.js';
import { RUNE_RARITY_BY_DIFFICULTY, RARITY_TIERS } from '../data/rarity.js';
import { SaveManager }               from '../SaveManager.js';

let _uidCounter = 0;
function _newUid() {
  return 'rune_' + Date.now().toString(36) + '_' + (_uidCounter++).toString(36);
}

export const RuneManager = {

  // ── Pool (méta, persistant) ────────────────────────────────────────────────
  getPool() {
    return SaveManager.loadMeta()?.runes ?? [];
  },
  _savePool(pool) {
    const meta = SaveManager.loadMeta() ?? {};
    meta.runes = pool;
    SaveManager.saveMeta(meta);
  },

  // Octroi d'une rune : 1 par région complétée. Type aléatoire, rareté = difficulté.
  grantRune(difficulty = 'easy', typeId = null, luck = 0) {
    const type = typeId ?? randomRuneId();
    let rarity = RUNE_RARITY_BY_DIFFICULTY[difficulty] ?? 'normal';
    // La chance peut faire monter la rune d'UN palier (une fois), plafonné.
    const idx = RARITY_TIERS.indexOf(rarity);
    if (idx >= 0 && idx < RARITY_TIERS.length - 1 && Math.random() < Math.min(0.5, luck * 0.04)) {
      rarity = RARITY_TIERS[idx + 1];
    }
    const rune = { uid: _newUid(), type, rarity };
    const pool   = this.getPool();
    pool.push(rune);
    this._savePool(pool);
    return rune;
  },

  getRune(uid) {
    return this.getPool().find(r => r.uid === uid) ?? null;
  },

  // ── Assignations (méta, par espèce) ─────────────────────────────────────────
  getAssignments() {
    return SaveManager.loadMeta()?.runeAssignments ?? {};
  },
  _saveAssignments(a) {
    const meta = SaveManager.loadMeta() ?? {};
    meta.runeAssignments = a;
    SaveManager.saveMeta(meta);
  },

  // Assigne une rune à une espèce. 1 rune max/espèce et 1 espèce max/rune.
  assign(pokemonId, runeUid) {
    if (!this.getRune(runeUid)) return this.getAssignments();
    const a = { ...this.getAssignments() };
    for (const pid of Object.keys(a)) if (a[pid] === runeUid) delete a[pid];  // 1 espece/rune
    a[pokemonId] = runeUid;                                                    // 1 rune/espece
    this._saveAssignments(a);
    return a;
  },

  unassign(pokemonId) {
    const a = { ...this.getAssignments() };
    delete a[pokemonId];
    this._saveAssignments(a);
    return a;
  },

  // Rune effective d'une espèce (résolue + scalée), ou null.
  getAssignedRune(pokemonId) {
    const uid = this.getAssignments()[pokemonId];
    if (!uid) return null;
    const inst = this.getRune(uid);
    if (!inst) return null;   // rune retiree du pool : assignation obsolete
    return scaleRune(inst.type, inst.rarity);
  },

  // Espèce qui porte une rune donnée (id), ou null.
  getRuneHolder(runeUid) {
    const a   = this.getAssignments();
    const pid = Object.keys(a).find(p => a[p] === runeUid);
    return pid != null ? +pid : null;
  },

  // Ids des espèces ayant atteint le niveau 100 (peuvent recevoir une rune).
  getMaxLevelPokemonIds() {
    const levels = SaveManager.loadMeta()?.pokemonLevels ?? {};
    return Object.keys(levels).filter(id => levels[id] >= 100).map(id => +id);
  },
};