// ─────────────────────────────────────────────────────────────────────────────
// UIManager.js
//
// Architecture : tous les écrans en HTML/CSS pur, map via MapUI.
// ─────────────────────────────────────────────────────────────────────────────

import { getRunState, addSeenPokemon } from '../data/runState.js';
import { MapUI }          from './MapUI.js';
import { PokedexUI }     from './PokedexUI.js';
import { StarterUI }      from './StarterUI.js';
import { WildUI }         from './WildUI.js';
import { ShopUI }         from './ShopUI.js';
import { ItemUI }         from './ItemUI.js';
import { PrepUI }         from './PrepUI.js';
import { CombatUI }       from './CombatUI.js';
import { ArenaVictoryUI } from './ArenaVictoryUI.js';

// Écrans complets (la map reste active en permanence pendant la partie)
const SCREEN_IDS = {
  menu:    'screen-menu',
  starter: 'screen-starter',
  map:     'screen-map',
};

// Overlays au-dessus de la map (jamais besoin de cacher la map)
const OVERLAY_IDS = {
  wild:         'overlay-wild',
  shop:         'overlay-shop',
  item:         'overlay-item',
  combat:       'overlay-combat',
  arenaVictory: 'overlay-arena-victory',
};

class UIManagerClass {
  constructor() {
    this.registry      = null;
    this.currentScreen = null;
    this.currentData   = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // init()
  // ─────────────────────────────────────────────────────────────────────────
  init(registry) {
    this.registry = registry;
    window.gameRegistry = registry;

    document.getElementById('btn-team')
      ?.addEventListener('click', () => this._togglePrep());

    setInterval(() => this._refreshHeader(), 500);

    // Pokédex — initialisé dès le démarrage (overlay toujours présent dans le DOM)
    PokedexUI.init(registry);

    this.show('menu');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // show()
  // ─────────────────────────────────────────────────────────────────────────
  show(screenName, data = {}) {
    this.currentScreen = screenName;
    this.currentData   = data;

    // Ferme tous les overlays ouverts
    Object.values(OVERLAY_IDS).forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });

    if (screenName === 'map') {
      // La map reste active — on masque seulement menu/starter
      Object.values(SCREEN_IDS).forEach(id => {
        document.getElementById(id)?.classList.remove('active');
      });
      document.getElementById('screen-map')?.classList.add('active');
      this._updateHeader('map');
      this._initScreen('map', data);
    } else if (OVERLAY_IDS[screenName]) {
      // Overlay par-dessus la map (la map reste active)
      document.getElementById(OVERLAY_IDS[screenName])?.classList.add('active');
      this._updateHeader(screenName);
      this._initScreen(screenName, data);
    } else {
      // Écran plein (menu, starter) — nettoie aussi les inline styles (posés par MapUI)
      Object.values(SCREEN_IDS).forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.cssText = ''; el.classList.remove('active'); }
      });
      document.getElementById(SCREEN_IDS[screenName])?.classList.add('active');
      this._updateHeader(screenName);
      this._initScreen(screenName, data);
    }
  }

  _closeOverlay(name) {
    document.getElementById(OVERLAY_IDS[name])?.classList.remove('active');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _initScreen()
  // ─────────────────────────────────────────────────────────────────────────
  _initScreen(screenName, data) {
    switch (screenName) {

      case 'menu':
        this._initMenu();
        break;

      case 'starter':
        StarterUI.init(data, this.registry, () => {
          this.show('map', { mapIndex: 0 });
        });
        break;

      case 'map':
        this._startMapScene(data);
        break;

      case 'wild':
        WildUI.init(data, this.registry, (result) => {
          this._closeOverlay('wild');
          this._onWildDone({ ...data, ...result });
        });
        break;

      case 'shop':
        ShopUI.init(data, this.registry, () => {
          this._closeOverlay('shop');
          this._refreshMapScene({
            mapNodes:  data.mapNodes,
            startNode: data.startNode,
            mapIndex:  data.mapIndex,
          });
        });
        break;

      case 'item':
        ItemUI.init(data, this.registry, () => {
          this._closeOverlay('item');
          this._refreshMapScene({
            mapNodes:  data.mapNodes,
            startNode: data.startNode,
            mapIndex:  data.mapIndex,
          });
        });
        break;

      case 'combat':
        CombatUI.init(data, this.registry, (result) => {
          this._closeOverlay('combat');
          this._onCombatDone(result);
        });
        break;

      case 'arenaVictory':
        ArenaVictoryUI.init(data, this.registry, (nextData) => {
          this._closeOverlay('arenaVictory');
          this.show('map', nextData);
        });
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _startMapScene() — initialise MapUI CSS
  // ─────────────────────────────────────────────────────────────────────────
  _startMapScene(data) {
    MapUI.init(data, this.registry, (nodeData) => {
      this.onNodeSelected(nodeData);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // onNodeSelected() — appelé par MapScene._selectNode()
  // ─────────────────────────────────────────────────────────────────────────
  onNodeSelected(nodeData) {
    this.show('wild', nodeData);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _initMenu()
  // ─────────────────────────────────────────────────────────────────────────
  _initMenu() {
    const btn = document.getElementById('btn-new-game');
    if (!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => this.show('starter'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _onWildDone()
  // ─────────────────────────────────────────────────────────────────────────
  _onWildDone(data) {
    switch (data.nextScreen) {
      case 'combat': this.show('combat', data); break;
      case 'shop':   this.show('shop',   data); break;
      case 'item':   this.show('item',   data); break;
      default:
        // Pas de rencontre → map déjà en fond, on rafraîchit juste les nœuds
        this._refreshMapScene({
          mapNodes:  data.mapNodes,
          startNode: data.startNode,
          mapIndex:  data.mapIndex,
        });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _onCombatDone()
  // ─────────────────────────────────────────────────────────────────────────
  _onCombatDone(result) {
    const isWin = result.winner === 'player';

    if (isWin) {
      if (result.nodeType === 'boss') {
        // ArenaVictory overlay par-dessus la map (pas besoin de relancer MapScene)
        this.show('arenaVictory', { mapIndex: result.mapIndex });
      } else {
        // Overlay combat fermé → map déjà visible, on rafraîchit juste les nœuds
        this._refreshMapScene({
          mapNodes:  result.mapNodes,
          startNode: result.startNode,
          mapIndex:  result.mapIndex,
        });
      }
    } else {
      this.registry.reset();
      this.registry.set('playerUnits', []);
      // Nettoie l'inline style posé par MapUI + retire la classe active
      const mapEl = document.getElementById('screen-map');
      if (mapEl) {
        mapEl.style.cssText = '';
        mapEl.classList.remove('active');
      }
      this.show('menu');
    }
  }

  // Redémarre MapScene avec de nouvelles données sans toucher aux écrans HTML
  _refreshMapScene(data) {
    this.currentData = { ...this.currentData, ...data };
    this._startMapScene(data);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PrepUI overlay
  // ─────────────────────────────────────────────────────────────────────────
  _togglePrep() {
    const overlay = document.getElementById('overlay-prep');
    if (!overlay) return;
    if (overlay.classList.contains('hidden')) {
      PrepUI.open(this.registry);
      overlay.classList.remove('hidden');
    } else {
      PrepUI.close(this.registry);
      overlay.classList.add('hidden');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Header
  // ─────────────────────────────────────────────────────────────────────────
  _updateHeader(screenName) {
    const header     = document.getElementById('game-header');
    const showHeader = !['menu', 'starter'].includes(screenName);
    header?.classList.toggle('hidden', !showHeader);
    // Applique le padding-top seulement aux écrans et overlays visibles
    document.querySelectorAll('.screen.active, .game-overlay.active').forEach(el => {
      el.classList.toggle('with-header', showHeader);
    });
    this._refreshHeader();
  }

  _refreshHeader() {
    if (!this.registry) return;
    const state = getRunState(this.registry);
    const el1   = document.getElementById('ui-coins');
    const el2   = document.getElementById('ui-pokeballs');
    if (el1) el1.textContent = `💰 ${state.coins     ?? 0}`;
    if (el2) el2.textContent = `🔴 ${state.pokeballs ?? 0}`;
  }
}

export const UIManager = new UIManagerClass();