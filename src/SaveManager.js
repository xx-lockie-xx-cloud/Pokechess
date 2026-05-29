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

  // ── Vérifie et débloque les achievements ─────────────────────────────────
  // Retourne un tableau des achievements nouvellement débloqués
  checkAchievements(runState, combatResult = null) {
    const meta    = this.loadMeta();
    const ach     = meta.achievements ?? {};
    const newly   = [];

    const unlock = (id) => {
      if (!ach[id]) {
        ach[id] = { unlockedAt: Date.now() };
        newly.push(id);
      }
    };

    // ── Progression ──────────────────────────────────────────────────────────
    const badges = runState?.badgesEarned ?? [];
    if (badges.length >= 1) unlock('premier_badge');
    if (badges.length >= 8) unlock('champion_kanto');

    // ── Ligue par type ───────────────────────────────────────────────────────
    // Déclenché si la run est terminée (8 badges) et que l'équipe est mono-type
    if (badges.length >= 8 && combatResult?.playerUnits) {
      const units = combatResult.playerUnits;
      const TYPES = ['Feu','Eau','Plante','Électrik','Psy','Glace','Combat','Poison',
        'Sol','Vol','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée','Normal'];
      TYPES.forEach(type => {
        const count = units.filter(u => u.types?.includes(type)).length;
        if (count >= 6) unlock(`league_${type.toLowerCase()}`);
      });
    }

    // ── Collection / Pokédex ────────────────────────────────────────────────
    const seen = (meta.seenPokemon ?? []).length;
    if (seen >= 50)  unlock('curieux');
    if (seen >= 151) unlock('encyclopedie');

    // T5 capturé (tier 5 = légendaire, dans caughtPokemon)
    const legendaryIds = [144, 145, 146, 147, 148, 149, 150, 151];
    if ((meta.caughtPokemon ?? []).some(id => legendaryIds.includes(id)))
      unlock('coup_de_chance');

    // ── Niveaux pokémon ──────────────────────────────────────────────────────
    const levels   = meta.pokemonLevels ?? {};
    const maxLevel = Math.max(...Object.values(levels), 1);
    if (maxLevel >= 25)  unlock('lv25');
    if (maxLevel >= 50)  unlock('lv50');
    if (maxLevel >= 100) unlock('lv100');
    if ((levels[5] ?? 1) >= 100) unlock('reptincel_100');

    // Achievements niveau 100 par type
    const POKEMONS = window.__POKEMONS__;
    if (POKEMONS) {
      const TYPES_100 = ['Feu','Eau','Plante','Électrik','Psy','Glace','Combat','Poison',
        'Sol','Vol','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée','Normal'];
      TYPES_100.forEach(type => {
        const key = type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        const count = Object.entries(levels).filter(([id, lvl]) => {
          if (lvl < 100) return false;
          const poke = POKEMONS.find(p => p.id === parseInt(id));
          return poke?.types?.includes(type);
        }).length;
        if (count >= 1) unlock('lv100_' + key + '_1');
        if (count >= 3) unlock('lv100_' + key + '_3');
      });
    }

    // Achievements niveau 100 par type (nécessite POKEMONS pour connaître les types)
    const POKEMONS = window.__POKEMONS__;
    if (POKEMONS) {
      const TYPES_LIST = ['Feu','Eau','Plante','Électrik','Psy','Glace','Combat','Poison',
        'Sol','Vol','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée','Normal'];
      TYPES_LIST.forEach(type => {
        const key = type.toLowerCase().replace(/[éêè]/g, 'e');
        // Compte les pokémons de ce type au niveau 100
        const count = Object.entries(levels).filter(([id, lvl]) => {
          if (lvl < 100) return false;
          const poke = POKEMONS.find(p => p.id === parseInt(id));
          return poke?.types?.includes(type);
        }).length;
        if (count >= 1) unlock(\`lv100_\${key}_1\`);
        if (count >= 3) unlock(\`lv100_\${key}_3\`);
      });
    }

    // ── Combat (depuis combatResult) ─────────────────────────────────────────
    if (combatResult) {
      // Ultime déclenché
      if (combatResult.ultimateUsed) unlock('ultime');

      // Exterminateur : victoire sans perte
      if (combatResult.winner === 'player' && combatResult.playerLosses === 0)
        unlock('exterminateur');

      // Synergiste : 3 synergies actives
      if ((combatResult.activeSynergies ?? 0) >= 3) unlock('synergiste');

      // Empoisonneur : 5 stacks poison en un combat
      if ((combatResult.maxPoisonStacks ?? 0) >= 5) unlock('empoisonneur');

      // Sacrifice : victoire grâce à une Explosion
      if (combatResult.explosionWin) unlock('sacrifice');

      // Riche : finir une arène avec 20+ pièces
      if ((runState?.coins ?? 0) >= 20) unlock('riche');

      // Légendaire : 2 T5 dans l'équipe
      const t5count = (combatResult.playerUnits ?? [])
        .filter(u => u.tier >= 5).length;
      if (t5count >= 2) unlock('legendaire_team');
    }

    if (newly.length > 0) {
      meta.achievements = ach;
      this.saveMeta(meta);
    }
    return newly;
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
