// ─────────────────────────────────────────────────────────────────────────────
// SaveManager.js — Double couche de sauvegarde (roguelite)
// ─────────────────────────────────────────────────────────────────────────────

const RUN_KEY  = 'pokechess_run';
const META_KEY = 'pokechess_meta';
const MAP_KEY  = 'pokechess_map';
const VERSION  = 1;

function serializeRegistry(registry) {
  const obj = {};
  for (const [key, value] of registry._data.entries()) obj[key] = value;
  return { version: VERSION, savedAt: new Date().toISOString(), data: obj };
}

function deserializeInto(registry, save) {
  registry._data.clear();
  for (const [key, value] of Object.entries(save.data ?? {}))
    registry._data.set(key, value);
}

export const SaveManager = {

  // ── Map state ──────────────────────────────────────────────────────────────
  saveMapState(seed, mapIndex, visitedNodes = [], availableNodes = [], lastNodeCol = 0) {
    try {
      localStorage.setItem(MAP_KEY, JSON.stringify({
        seed, mapIndex, visitedNodes, availableNodes, lastNodeCol,
        savedAt: new Date().toISOString(),
      }));
      return true;
    } catch (e) { console.warn('[SaveManager] saveMapState failed:', e); return false; }
  },

  loadMapState() {
    try { const raw = localStorage.getItem(MAP_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },

  clearMapState() { localStorage.removeItem(MAP_KEY); },

  // ── Run save ───────────────────────────────────────────────────────────────
  save(registry) {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(serializeRegistry(registry)));
      return true;
    } catch (e) { console.warn('[SaveManager] save failed:', e); return false; }
  },

  load(registry) {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) return false;
      const save = JSON.parse(raw);
      if (!save?.data) return false;
      deserializeInto(registry, save);
      return save;
    } catch (e) { console.warn('[SaveManager] load failed:', e); return false; }
  },

  hasRunSave() {
    try { const raw = localStorage.getItem(RUN_KEY); return !!(raw && JSON.parse(raw)?.data); }
    catch { return false; }
  },
  hasSave() { return this.hasRunSave(); },

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
      const CITY_NAMES = [
        'Argenta', 'Azuria', 'Carmin sur Mer', 'Céladopole',
        'Parmanie', 'Safrania', "Cramois'île", 'Jadielle',
      ];
      const mapIdx    = state.currentMap ?? 0;
      const city      = CITY_NAMES[mapIdx] ?? ('Route ' + (mapIdx + 1));
      const step      = (state.lastNodeCol ?? 0) + 1;
      const totalCols = (3 + Math.floor(mapIdx / 2)) + 2;
      return { date, map: mapIdx + 1, city, step, totalCols,
               coins: state.coins ?? 0,
               units: (save.data?.playerUnits ?? []).length };
    } catch { return null; }
  },

  deleteRunSave() { localStorage.removeItem(RUN_KEY); localStorage.removeItem(MAP_KEY); },
  deleteSave()    { this.deleteRunSave(); },

  exportJSON(registry) {
    try {
      const payload = JSON.stringify(serializeRegistry(registry), null, 2);
      const blob    = new Blob([payload], { type: 'application/json' });
      const url     = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      a.href        = url;
      a.download    = 'pokechess_run_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch { return false; }
  },

  importJSON(registry, onSuccess, onError) {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const save = JSON.parse(await file.text());
        if (!save?.data) throw new Error('Format invalide');
        deserializeInto(registry, save);
        localStorage.setItem(RUN_KEY, JSON.stringify(save));
        onSuccess?.(save);
      } catch { onError?.('Fichier invalide ou corrompu.'); }
    });
    input.click();
  },

  // ── Meta save ──────────────────────────────────────────────────────────────
  _defaultMeta() {
    return {
      version:       VERSION,
      totalRuns:     0,
      completedRuns: 0,
      bestMap:       0,
      badgesEarned:  [],
      totalWins:     0,
      difficulty:    'easy',
      pokemonLevels: {},
      seenPokemon:   [],
      caughtPokemon: [],
      achievements:  {},
      talentPoints:  0,
      talentTree:    {},
      unlocks: { extraStarterSlots: 0, startingCoins: 0, startBonus: [] },
    };
  },

  loadMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return this._defaultMeta();
      return { ...this._defaultMeta(), ...JSON.parse(raw) };
    } catch { return this._defaultMeta(); }
  },

  saveMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); return true; }
    catch { return false; }
  },

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

    if ((runState?.badgesEarned ?? []).length >= 8)
      meta.completedRuns = (meta.completedRuns ?? 0) + 1;

    (runState?.seenPokemon ?? []).forEach(id => {
      if (!meta.seenPokemon.includes(id)) meta.seenPokemon.push(id);
    });
    (runState?.caughtPokemon ?? []).forEach(id => {
      if (!meta.caughtPokemon.includes(id)) meta.caughtPokemon.push(id);
    });

    this.saveMeta(meta);
    return meta;
  },

  getPokemonLevel(pokemonId) {
    return this.loadMeta().pokemonLevels?.[pokemonId] ?? 1;
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

  getDifficulty() {
    const meta   = this.loadMeta();
    const stored = meta.difficulty ?? 'easy';
    const ach    = meta.achievements ?? {};
    // Conditions de déblocage (miroir de DIFFICULTIES dans levelSystem.js)
    const REQ = { easy: null, normal: 'ligue_easy', hard: 'ligue_normal', expert: 'ligue_hard_relic' };
    const isUnlocked = (id) => !REQ[id] || !!ach[REQ[id]];
    // Si la difficulté stockée n'est pas débloquée (ex: défaut hérité), on retombe
    // sur la plus haute difficulté réellement débloquée → évite de jouer "normal"
    // en croyant jouer "facile".
    if (isUnlocked(stored)) return stored;
    return ['expert', 'hard', 'normal', 'easy'].find(isUnlocked) ?? 'easy';
  },

  setDifficulty(id) {
    const meta = this.loadMeta();
    meta.difficulty = id;
    this.saveMeta(meta);
  },

  // ── Achievements ────────────────────────────────────────────────────────────
  // ── Tracking des runs ─────────────────────────────────────────────────────
  getRunStats(meta) {
    const m = meta ?? this.loadMeta();
    return m?.runStats ?? {
      leaguesBeaten: 0, leaguesByDiff: { easy:0, normal:0, hard:0, expert:0 },
      totalWins: 0, totalLosses: 0, pokemonCaptured: 0,
      relicsUsed: {}, badges: 0,
    };
  },

  // Incrément atomique d'une stat simple (charge la meta, incrémente, sauvegarde)
  bumpStat(key, amount = 1) {
    const meta  = this.loadMeta();
    const stats = this.getRunStats(meta);
    stats[key]  = (stats[key] ?? 0) + amount;
    meta.runStats = stats;
    this.saveMeta(meta);
    return stats[key];
  },

  // Incrément atomique d'une stat imbriquée (ex: leaguesByDiff.hard)
  bumpStatNested(parent, key, amount = 1) {
    const meta  = this.loadMeta();
    const stats = this.getRunStats(meta);
    stats[parent] = stats[parent] ?? {};
    stats[parent][key] = (stats[parent][key] ?? 0) + amount;
    meta.runStats = stats;
    this.saveMeta(meta);
    return stats[parent][key];
  },

  // Enregistre la fin d'un combat (appelé une fois, au moment des résultats)
  recordCombatResult(runState, { winner, nodeType, mapIndex } = {}) {
    const isWin  = winner === 'player';
    const isBoss = nodeType === 'boss';
    const diff   = runState?.difficulty ?? 'easy';
    if (isWin) {
      this.bumpStat('totalWins');
      if (isBoss) {
        this.bumpStat('badges');
        if ((mapIndex ?? -1) >= 8) {
          this.bumpStat('leaguesBeaten');
          this.bumpStatNested('leaguesByDiff', diff);
        }
      }
    } else {
      this.bumpStat('totalLosses');
    }
  },

  // Enregistre la relique choisie au DÉBUT d'une épopée (une seule fois)
  recordRelicUsed(relicId) {
    if (!relicId) return;
    this.bumpStatNested('relicsUsed', relicId);
  },

  // Enregistre une capture
  recordCapture(n = 1) { this.bumpStat('pokemonCaptured', n); },

  // Compte les Pokémon niveau 100 (à la demande, depuis les niveaux persistants)
  countMaxLevelPokemon(meta) {
    const levels = (meta ?? this.loadMeta())?.pokemonLevels ?? {};
    return Object.values(levels).filter(l => l >= 100).length;
  },

  checkAchievements(runState, combatResult = null) {
    const meta  = this.loadMeta();
    const ach   = meta.achievements ?? {};
    const newly = [];

    const unlock = (id) => {
      if (!ach[id]) { ach[id] = { unlockedAt: Date.now() }; newly.push(id); }
    };

    // Ligue = victoire du boss sur la map 8 (dernière map)
    const isLeague = (combatResult?.mapIndex ?? -1) >= 8
                  && combatResult?.nodeType === 'boss'
                  && combatResult?.winner  === 'player';
    const runDiff  = runState?.difficulty ?? 'easy';
    const hasRelic = !!(runState?.relic?.id);

    // Progression
    const badges = runState?.badgesEarned ?? [];
    if (badges.length >= 1) unlock('premier_badge');
    if (isLeague)            unlock('champion_kanto');

    // Déblocage des difficultés
    if (isLeague) {
        if (runDiff === 'easy')   unlock('ligue_easy');
      if (runDiff === 'normal') unlock('ligue_normal');
      if (runDiff === 'hard' && hasRelic) unlock('ligue_hard_relic');
    }

    if (isLeague && combatResult?.playerUnits) {
      const units       = combatResult.playerUnits;
      const anomalyTypes = runState?.anomalyTypes ?? null;
      const LEAGUE_TYPES = ['Feu','Eau','Plante','Électrik','Psy','Glace','Combat','Poison',
        'Sol','Vol','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée','Normal'];
      LEAGUE_TYPES.forEach(type => {
        const count = units.filter(u => {
          // Avec Anomalie : utilise les types effectifs de la run
          const effectiveTypes = anomalyTypes?.[u.id] ?? u.types ?? [];
          return effectiveTypes.includes(type);
        }).length;
        if (count >= 6) unlock('league_' + type.toLowerCase());
      });
    }

    // Collection
    const seen = (meta.seenPokemon ?? []).length;
    if (seen >= 50)  unlock('curieux');
    if (seen >= 151) unlock('encyclopedie');

    // Vrais légendaires : Artikodin(144), Électhor(145), Sulfura(146), Mewtwo(150), Mew(151)
    const legendaryIds = [144, 145, 146, 150, 151];
    if ((meta.caughtPokemon ?? []).some(id => legendaryIds.includes(id)))
      unlock('coup_de_chance');

    // Objets : posséder 5 objets différents simultanément
    const distinctItems = new Set(runState?.inventory ?? []).size;
    if (distinctItems >= 5) unlock('collectionneur');

    // Niveaux
    const levels   = meta.pokemonLevels ?? {};
    const maxLevel = Math.max(...Object.values(levels), 1);
    if (maxLevel >= 25)  unlock('lv25');
    if (maxLevel >= 50)  unlock('lv50');
    if (maxLevel >= 100) unlock('lv100');
    if ((levels[5] ?? 1) >= 100) unlock('reptincel_100');

    // Niveaux 100 par type
    const POKES = window.__POKEMONS__;
    if (POKES) {
      const ALL_TYPES = ['Feu','Eau','Plante','Électrik','Psy','Glace','Combat','Poison',
        'Sol','Vol','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée','Normal'];
      ALL_TYPES.forEach(type => {
        // Normalise le nom du type pour la clé (supprime accents)
        const key = type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const count = Object.entries(levels).filter(([id, lvl]) => {
          if (lvl < 100) return false;
          const poke = POKES.find(p => p.id === parseInt(id));
          return poke?.types?.includes(type);
        }).length;
        if (count >= 1) unlock('lv100_' + key + '_1');
        if (count >= 3) unlock('lv100_' + key + '_3');
      });
    }

    // Combat
    if (combatResult) {
      if (combatResult.ultimateUsed) unlock('ultime');
      if (combatResult.winner === 'player' && combatResult.playerLosses === 0)
        unlock('exterminateur');
      if ((combatResult.activeSynergies ?? 0) >= 3) unlock('synergiste');
      if ((combatResult.maxPoisonStacks ?? 0) >= 5) unlock('empoisonneur');
      if (combatResult.explosionWin) unlock('sacrifice');
      if (isLeague && (runState?.coins ?? 0) >= 75) unlock('riche');
      // Légendaire : 5 pokémons T5 dans l'équipe (basé sur les stats de base via getBSTTier)
      const bstTier = u => {
        const s = u.stats ?? {};
        const bst = (s.hp??0)+(s.atk??0)+(s.spa??0)+(s.def??0)+(s.spd_def??0)+(s.spd??0);
        if (bst <= 308) return 1;
        if (bst <= 390) return 2;
        if (bst <= 470) return 3;
        if (bst <= 550) return 4;
        return 5;
      };
      const t5count = (combatResult.playerUnits ?? []).filter(u => bstTier(u) >= 5).length;
      if (t5count >= 3) unlock('legendaire_team');
    }

    // Bénit : finir la ligue avec une relique active
    if (isLeague && hasRelic) unlock('relique_terminee');

    // Maître Relique : finir la ligue en Difficile ou + avec chaque relique
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'loupe') unlock('hard_relic_loupe');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'bourse_doree') unlock('hard_relic_bourse_doree');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'braderie') unlock('hard_relic_braderie');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'pochette_surprise') unlock('hard_relic_pochette_surprise');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'condensateur') unlock('hard_relic_condensateur');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'pacte_de_sang') unlock('hard_relic_pacte_de_sang');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'de_maudit') unlock('hard_relic_de_maudit');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'sablier') unlock('hard_relic_sablier');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'benediction') unlock('hard_relic_benediction');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'revanche') unlock('hard_relic_revanche');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'contrat_maudit') unlock('hard_relic_contrat_maudit');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'catalyseur') unlock('hard_relic_catalyseur');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'miroir') unlock('hard_relic_miroir');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'cristal_pur') unlock('hard_relic_cristal_pur');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'couronne') unlock('hard_relic_couronne');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'encyclopedie') unlock('hard_relic_encyclopedie');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'aimant') unlock('hard_relic_aimant');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'doppelganger') unlock('hard_relic_doppelganger');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'medaille') unlock('hard_relic_medaille');
    if (isLeague && hasRelic && runDiff !== 'easy' && runDiff !== 'normal' && runState?.relic?.id === 'anomalie') unlock('hard_relic_anomalie');

    if (newly.length > 0) {
      meta.achievements = ach;
      this.saveMeta(meta);
    }
    return newly;
  },

  // ── Utilitaires ────────────────────────────────────────────────────────────
  resetMeta() { localStorage.removeItem(META_KEY); },

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
