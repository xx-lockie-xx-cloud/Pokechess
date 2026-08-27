// ─────────────────────────────────────────────────────────────────────────────
// game.js — Point d'entrée
console.log('[game.js] module chargé');
// Architecture : UIManager gère tous les écrans en HTML/CSS pur.
// Plus de Phaser — la map est rendue en CSS/SVG par MapUI.
// ─────────────────────────────────────────────────────────────────────────────

import { UIManager }   from './ui/UIManager.js';
import { SaveManager } from './SaveManager.js';
import { RuneManager } from './combat/RuneManager.js';

window.UIManager   = UIManager;
window.SaveManager = SaveManager;

// ── Debug : prévisualiser l'écran de victoire de ligue sans faire une run ────
//   window.previewLeagueVictory()            → écran normal (difficulté courante)
//   window.previewLeagueVictory('expert')    → force l'écran d'honneur Expert
//   window.previewLeagueVictory('expert', true) → rejoue l'écran Expert (reset du flag)
// Debug runes : window.giveRune('vampire', 'legendaire', 0)
// Octroie une rune au pool et l'assigne au i-ieme pokemon de terrain.
window.giveRune = (type = null, rarity = 'legendaire', idx = 0) => {
  const registry = window.__registry;
  if (!registry) { console.warn('Lance le jeu d\'abord.'); return; }
  const diffByRarity = { normal:'easy', rare:'normal', epique:'hard', legendaire:'expert' };
  const rune  = RuneManager.grantRune(diffByRarity[rarity] ?? 'expert', type);
  const units = (registry.get('playerUnits') ?? []).filter(Boolean);
  const u = units[idx];
  if (!u) { console.warn('Aucun pokemon de terrain a l\'index', idx); return; }
  RuneManager.assign(u.id, rune.uid);
  console.info(`[rune] ${rune.type} (${rune.rarity}) assignee a ${u.name ?? u.id}`);
  return rune;
};

// Debug chance : window.setLuck(5)
window.setLuck = (n = 0) => {
  const m = SaveManager.loadMeta(); m.luck = Math.max(0, +n || 0); SaveManager.saveMeta(m);
  console.info('[luck] chance =', m.luck); return m.luck;
};

window.previewLeagueVictory = (difficulty = null, replay = true) => {
  const registry = window.__registry;
  if (!registry) { console.warn('Registre indisponible — lance le jeu d\'abord.'); return; }

  // IMPORTANT : getDifficulty() ne renvoie une difficulté que si elle est
  // DÉBLOQUÉE. Pour la prévisualisation on pose donc aussi les succès requis,
  // sinon 'expert' retomberait silencieusement sur une difficulté inférieure.
  const meta = SaveManager.loadMeta();
  const next = { ...meta };
  if (difficulty) {
    next.difficulty = difficulty;
    const REQ = { normal: 'ligue_easy', hard: 'ligue_normal', expert: 'ligue_hard_relic' };
    const need = REQ[difficulty];
    if (need) {
      next.achievements = { ...(next.achievements ?? {}) };
      if (!next.achievements[need]) {
        next.achievements[need] = { unlockedAt: Date.now() };
        console.info(`[preview] succès "${need}" débloqué pour permettre la difficulté ${difficulty}`);
      }
    }
  }
  if (replay) next.expertLeagueDone = false;
  SaveManager.saveMeta(next);   // une seule écriture → plus d'écrasement

  // Équipe factice si aucune n'est en cours
  const team = (registry.get('playerUnits') ?? []).filter(Boolean);
  const fake = team.length ? team : [6, 9, 3, 25, 143, 149].map(id => ({
    id, name: `#${id}`,
    spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
  }));

  console.info('[preview] difficulté effective :', SaveManager.getDifficulty());
  UIManager.show('arenaVictory', {
    mapIndex: 8,
    trainerName: 'Peter',
    leagueSprite: null,
    fieldTeam: fake,
  });
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('[game.js] DOMContentLoaded');

  // ── Registre léger ────────────────────────────────────────────────────────
  const registry = {
    _data: new Map(),

    get(key) { return this._data.get(key); },

    set(key, value) {
      const old = this._data.get(key);
      this._data.set(key, value);
      this.events.emit(`changedata-${key}`, this, value, old);
      // Auto-save silencieuse à chaque changement d'état
      // (sauf si la run a été scellée comme perdue → on ne recrée pas la save)
      if ((key === 'runState' || key === 'playerUnits') && !this._runSealed) {
        SaveManager.save(this);
      }
      return this;
    },

    // Scelle la run (défaite) : empêche toute nouvelle sauvegarde jusqu'au reset
    sealRun()   { this._runSealed = true;  return this; },
    unsealRun() { this._runSealed = false; return this; },

    reset() { this._data.clear(); this._runSealed = false; return this; },

    events: {
      _listeners: new Map(),
      on(event, fn) {
        const list = this._listeners.get(event) ?? [];
        list.push(fn);
        this._listeners.set(event, list);
      },
      off(event, fn) {
        const list = (this._listeners.get(event) ?? []).filter(f => f !== fn);
        this._listeners.set(event, list);
      },
      emit(event, ...args) {
        (this._listeners.get(event) ?? []).forEach(fn => fn(...args));
      },
    },
  };

  window.gameRegistry = registry;

  console.log('[game.js] appel UIManager.init');
  window.__registry = registry;   // exposé pour les helpers de debug

  // ── Temps de jeu cumulé ────────────────────────────────────────────────────
  // Accumulé par tranches de 30s, uniquement quand l'onglet est visible.
  // (Non rétroactif : ne comptabilise que le temps joué à partir de maintenant.)
  (() => {
    const TICK_MS = 30000;
    let lastTick  = Date.now();
    const flush = () => {
      const now = Date.now();
      const dt  = now - lastTick;
      lastTick  = now;
      if (dt > 0 && dt < 5 * 60 * 1000 && document.visibilityState === 'visible') {
        SaveManager.bumpStat?.('playtimeMs', dt);
      }
    };
    setInterval(flush, TICK_MS);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
  })();

  UIManager.init(registry);
});