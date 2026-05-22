// ─────────────────────────────────────────────────────────────────────────────
// SaveManager.js — Double couche de sauvegarde (roguelite)
//
//  RUN SAVE  (clé: 'pokechess_run')
//    → Progression de la run courante : map, équipe, pièces, layout
//    → Écrasée à chaque nouvelle partie
//    → Sauvegarde automatique à chaque registry.set('runState')
//
//  META SAVE (clé: 'pokechess_meta')
//    → Unlocks permanents entre les runs : badges, power-ups, records
//    → Jamais effacée par une nouvelle partie
//    → Mise à jour en fin de run (victoire ou défaite)
// ─────────────────────────────────────────────────────────────────────────────

const RUN_KEY  = 'pokechess_run';
const META_KEY = 'pokechess_meta';
const MAP_KEY  = 'pokechess_map';   // layout de la map courante (clé séparée)
const VERSION  = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers sérialisation
// ─────────────────────────────────────────────────────────────────────────────
function serializeRegistry(registry) {
  const obj = {};
  for (const [key, value] of registry._data.entries()) {
    obj[key] = value;
  }
  return { version: VERSION, savedAt: new Date().toISOString(), data: obj };
}

function deserializeInto(registry, save) {
  registry._data.clear();
  for (const [key, value] of Object.entries(save.data ?? {})) {
    registry._data.set(key, value);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN SAVE
// ─────────────────────────────────────────────────────────────────────────────
export const SaveManager = {

  // ── Layout de map — sauvegarde par SEED (déterministe) ──────────────────────
  // On ne sauve que le seed + les nœuds visités/disponibles.
  // La map est régénérée à l'identique depuis le seed à la restauration.
  saveMapState(seed, mapIndex, visitedNodes = [], availableNodes = [], lastNodeCol = 0) {
    try {
      localStorage.setItem(MAP_KEY, JSON.stringify({
        seed,
        mapIndex,
        visitedNodes,    // ex: ['start', '0_1', '1_0']
        availableNodes,  // ex: ['2_0', '2_2']
        lastNodeCol,
        savedAt: new Date().toISOString(),
      }));
      return true;
    } catch (e) {
      console.warn('[SaveManager] saveMapState failed:', e);
      return false;
    }
  },

  loadMapState() {
    try {
      const raw = localStorage.getItem(MAP_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  },

  clearMapState() {
    localStorage.removeItem(MAP_KEY);
  },

  // ── Sauvegarde auto de la run ──────────────────────────────────────────────
  save(registry) {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(serializeRegistry(registry)));
      return true;
    } catch (e) {
      console.warn('[SaveManager] save failed:', e);
      return false;
    }
  },

  // ── Charge la run sauvegardée ──────────────────────────────────────────────
  load(registry) {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) return false;
      const save = JSON.parse(raw);
      if (!save?.data) return false;
      deserializeInto(registry, save);
      return save;
    } catch (e) {
      console.warn('[SaveManager] load failed:', e);
      return false;
    }
  },

  hasRunSave() {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      return !!(raw && JSON.parse(raw)?.data);
    } catch { return false; }
  },

  // Alias pour compatibilité
  hasSave() { return this.hasRunSave(); },

  // ── Métadonnées de la run (menu) ───────────────────────────────────────────
  getMeta() {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) return null;
      const save  = JSON.parse(raw);
      const state = save.data?.runState;
      if (!state) return null;
      const date = save.savedAt
        ? new Date(save.savedAt).toLocaleDateString('fr-FR', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit',
          })
        : '—';

      // Nom de la ville destination (correspondance mapIndex → arène)
      const CITY_NAMES = [
        'Argenta', 'Azuria', 'Carmin sur Mer', 'Céladopole',
        'Parmanie', 'Safrania', "Cramois'île", 'Jadielle',
      ];
      const mapIdx      = state.currentMap ?? 0;
      const city        = CITY_NAMES[mapIdx] ?? `Route ${mapIdx + 1}`;
      const step        = (state.lastNodeCol ?? 0) + 1;
      // Nombre de colonnes = 3 + floor(mapIndex/2) + 2 (start + boss)
      const totalCols   = (3 + Math.floor(mapIdx / 2)) + 2;

      return {
        date,
        map:       mapIdx + 1,
        city,
        step,
        totalCols,
        coins:     state.coins ?? 0,
        units:     (save.data?.playerUnits ?? []).length,
      };
    } catch { return null; }
  },

  // ── Supprime uniquement la run (nouvelle partie) ───────────────────────────
  deleteRunSave() {
    localStorage.removeItem(RUN_KEY);
    localStorage.removeItem(MAP_KEY);
  },

  // Alias pour compatibilité
  deleteSave() { this.deleteRunSave(); },

  // ── Export JSON (run uniquement) ───────────────────────────────────────────
  exportJSON(registry) {
    try {
      const payload  = JSON.stringify(serializeRegistry(registry), null, 2);
      const blob     = new Blob([payload], { type: 'application/json' });
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `pokechess_run_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (e) { return false; }
  },

  // ── Import JSON ────────────────────────────────────────────────────────────
  importJSON(registry, onSuccess, onError) {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = '.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const save = JSON.parse(await file.text());
        if (!save?.data) throw new Error('Format invalide');
        deserializeInto(registry, save);
        localStorage.setItem(RUN_KEY, JSON.stringify(save));
        onSuccess?.(save);
      } catch (e) { onError?.('Fichier invalide ou corrompu.'); }
    });
    input.click();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // META SAVE — Roguelite (unlocks permanents entre les runs)
  // ─────────────────────────────────────────────────────────────────────────

  // Structure de la meta save
  _defaultMeta() {
    return {
      version:        VERSION,
      totalRuns:      0,
      completedRuns:  0,       // runs avec toutes les arènes battues
      bestMap:        0,
      badgesEarned:   [],
      totalWins:      0,
      difficulty:     'normal',
      // Niveaux persistants des pokémons (id → niveau 1-100)
      pokemonLevels:  {},
      // Pokédex persistant (vu + capturé toutes runs confondues)
      seenPokemon:    [],
      caughtPokemon:  [],
      // Succès débloqués
      achievements:   {},
      // Unlocks roguelite
      unlocks: {
        extraStarterSlots: 0,
        startingCoins:     0,
        startBonus:        [],
      },
    };
  },

  // ── Lecture ────────────────────────────────────────────────────────────────
  loadMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return this._defaultMeta();
      return { ...this._defaultMeta(), ...JSON.parse(raw) };
    } catch { return this._defaultMeta(); }
  },

  // ── Écriture ───────────────────────────────────────────────────────────────
  saveMeta(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
      return true;
    } catch (e) { return false; }
  },

  // ── Mise à jour en fin de run ──────────────────────────────────────────────
  // Appelé depuis UIManager._onCombatDone() après victoire ou défaite
  updateMetaOnRunEnd(runState, playerUnits, winner) {
    const meta = this.loadMeta();
    meta.totalRuns++;

    const currentMap = runState?.currentMap ?? 0;
    if (currentMap > meta.bestMap) meta.bestMap = currentMap;

    (runState?.badgesEarned ?? []).forEach(id => {
      if (!meta.badgesEarned.includes(id)) {
        meta.badgesEarned.push(id);
        meta.totalWins++;
      }
    });

    // Run complète si toutes les arènes battues
    if ((runState?.badgesEarned ?? []).length >= 8) {
      meta.completedRuns = (meta.completedRuns ?? 0) + 1;
    }

    // Pokédex persistant — fusion avec la run courante
    (runState?.seenPokemon ?? []).forEach(id => {
      if (!meta.seenPokemon.includes(id)) meta.seenPokemon.push(id);
    });
    (runState?.caughtPokemon ?? []).forEach(id => {
      if (!meta.caughtPokemon.includes(id)) meta.caughtPokemon.push(id);
    });

    this.saveMeta(meta);
    return meta;
  },

  // ── Gestion des niveaux pokémon ─────────────────────────────────────────
  getPokemonLevel(pokemonId) {
    const meta = this.loadMeta();
    return meta.pokemonLevels?.[pokemonId] ?? 1;
  },

  gainPokemonLevel(pokemonId) {
    const meta    = this.loadMeta();
    const current = meta.pokemonLevels?.[pokemonId] ?? 1;
    if (current >= 100) return { gained: false, newLevel: 100 };
    const newLevel = current + 1;
    meta.pokemonLevels = { ...(meta.pokemonLevels ?? {}), [pokemonId]: newLevel };
    this.saveMeta(meta);
    return { gained: true, newLevel, pokemonId };
  },

  // ── Difficulté ─────────────────────────────────────────────────────────
  getDifficulty() {
    return this.loadMeta().difficulty ?? 'normal';
  },

  setDifficulty(id) {
    const meta = this.loadMeta();
    meta.difficulty = id;
    this.saveMeta(meta);
  },

  // ── Réinitialise la meta (debug) ───────────────────────────────────────────
  resetMeta() {
    localStorage.removeItem(META_KEY);
  },

  // ── Exporte la meta ────────────────────────────────────────────────────────
  exportMeta() {
    const meta    = this.loadMeta();
    const payload = JSON.stringify(meta, null, 2);
    const blob    = new Blob([payload], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = 'pokechess_meta.json';
    a.click();
    URL.revokeObjectURL(url);
  },
};