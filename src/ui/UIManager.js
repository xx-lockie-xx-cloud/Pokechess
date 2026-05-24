// ─────────────────────────────────────────────────────────────────────────────
// UIManager.js
//
// Architecture hybride :
//   - MapScene (Phaser) gère l'écran de map via window.phaserGame
//   - Tous les autres écrans sont en HTML/CSS pur
// ─────────────────────────────────────────────────────────────────────────────

import { getRunState }    from '../data/runState.js';
import { StarterUI }      from './StarterUI.js';
import { WildUI }         from './WildUI.js';
import { ShopUI }         from './ShopUI.js';
import { ItemUI }         from './ItemUI.js';
import { PrepUI }         from './PrepUI.js';
import { CombatUI }       from './CombatUI.js';
import { ArenaVictoryUI } from './ArenaVictoryUI.js';

const SCREEN_IDS = {
  menu:         'screen-menu',
  starter:      'screen-starter',
  map:          'screen-map',
  wild:         'screen-wild',
  shop:         'screen-shop',
  item:         'screen-item',
  combat:       'screen-combat',
  arenaVictory: 'screen-arena-victory',
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

    this.show('menu');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // show()
  // ─────────────────────────────────────────────────────────────────────────
  show(screenName, data = {}) {
    this.currentScreen = screenName;
    this.currentData   = data;

    // Masque tous les écrans HTML
    Object.values(SCREEN_IDS).forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });

    document.getElementById(SCREEN_IDS[screenName])?.classList.add('active');

    this._updateHeader(screenName);
    this._initScreen(screenName, data);
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

      // ── Map : délégué à Phaser MapScene ──────────────────────────────────
      case 'map':
        this._startMapScene(data);
        break;

      case 'wild':
        WildUI.init(data, this.registry, (result) => {
          this._onWildDone({ ...data, ...result });
        });
        break;

      case 'shop':
        ShopUI.init(data, this.registry, () => {
          this.show('map', {
            mapNodes:  data.mapNodes,
            startNode: data.startNode,
            mapIndex:  data.mapIndex,
          });
        });
        break;

      case 'item':
        ItemUI.init(data, this.registry, () => {
          this.show('map', {
            mapNodes:  data.mapNodes,
            startNode: data.startNode,
            mapIndex:  data.mapIndex,
          });
        });
        break;

      case 'combat':
        CombatUI.init(data, this.registry, (result) => {
          this._onCombatDone(result);
        });
        break;

      case 'arenaVictory':
        ArenaVictoryUI.init(data, this.registry, (nextData) => {
          this.show('map', nextData);
        });
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _startMapScene() — lance / redémarre la scène Phaser
  // ─────────────────────────────────────────────────────────────────────────
  _startMapScene(data) {
    const game = window.phaserGame;
    if (!game) return;

    const sceneManager = game.scene;

    // Si MapScene tourne déjà, on la redémarre avec les nouvelles données
    if (sceneManager.isActive('MapScene')) {
      sceneManager.stop('MapScene');
    }

    // Petit délai pour laisser Phaser finir le stop avant le start
    setTimeout(() => {
      sceneManager.start('MapScene', data);
    }, 50);
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
        this.show('map', {
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
        this.show('arenaVictory', { mapIndex: result.mapIndex });
      } else {
        this.show('map', {
          mapNodes:  result.mapNodes,
          startNode: result.startNode,
          mapIndex:  result.mapIndex,
        });
      }
    } else {
      this.registry.reset();
      this.registry.set('playerUnits', []);
      this.show('menu');
    }
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
    document.querySelectorAll('.screen').forEach(el => {
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
