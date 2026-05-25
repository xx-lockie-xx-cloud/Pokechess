// ─────────────────────────────────────────────────────────────────────────────
// UIManager.js
//
// Architecture : tous les écrans en HTML/CSS pur, map via MapUI.
// ─────────────────────────────────────────────────────────────────────────────

import { getRunState, addSeenPokemon,
         saveMapProgress, getMapProgress } from '../data/runState.js';
import { DIFFICULTIES, getUnlockedDifficultiesWithMeta } from '../data/levelSystem.js';
import { SaveManager }                from '../SaveManager.js';
import { MapUI }          from './MapUI.js';
import { MapGenerator }   from '../map/MapGenerator.js';
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

    document.getElementById('btn-menu-home')
      ?.addEventListener('click', () => {
        const ok = confirm('Retourner au menu principal ? Ta progression est sauvegardée.');
        if (!ok) return;
        const mapEl = document.getElementById('screen-map');
        if (mapEl) { mapEl.style.cssText = ''; mapEl.classList.remove('active'); }
        this.show('menu');
      });

    setInterval(() => this._refreshHeader(), 500);

    // Pokédex
    PokedexUI.init(registry);

    // ── Sauvegarde ──────────────────────────────────────────────────────────
    this._initSaveButtons();

    this.show('menu');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _initSaveButtons() — branche les boutons du menu principal
  // ─────────────────────────────────────────────────────────────────────────
  _initSaveButtons() {
    const hasSave = SaveManager.hasSave();

    // Bouton Continuer
    const btnContinue = document.getElementById('btn-continue');
    const saveMeta    = document.getElementById('save-meta');
    const saveActions = document.getElementById('menu-save-actions');

    if (hasSave) {
      btnContinue?.classList.remove('hidden');
      saveActions?.classList.remove('hidden');
      document.getElementById('menu-save-actions-extra')?.classList.remove('hidden');

      // Métadonnées de la save
      const meta = SaveManager.getMeta();
      if (meta && saveMeta) {
        saveMeta.classList.remove('hidden');
        saveMeta.innerHTML = `
          <div class="save-meta-title">En route vers ${meta.city} — étape ${meta.step}/${meta.totalCols}</div>
          <div class="save-meta-details">
            <span>🗺 Arène ${meta.map}</span>
            <span>💰 ${meta.coins} pièces</span>
            <span>🐾 ${meta.units} pokémon${meta.units > 1 ? 's' : ''}</span>
            <span style="color:var(--text-muted);font-size:10px">${meta.date}</span>
          </div>
        `;
      }
    }

    // Continuer — restaure la map depuis le seed dans runState
    btnContinue?.addEventListener('click', () => {
      const save = SaveManager.load(this.registry);
      if (!save) return;
      const state = this.registry.get('runState');
      if (!state) return;

      // Le seed et la progression sont dans runState (auto-sauvegardés)
      const progress = getMapProgress(this.registry);

      if (progress.seed != null) {
        this._startMapScene({
          mapIndex:       state.currentMap ?? 0,
          seed:           progress.seed,
          visitedNodes:   progress.visited,
          availableNodes: progress.available,
        });
      } else {
        // Pas de seed → nouvelle map
        this._startMapScene({ mapIndex: state.currentMap ?? 0 });
      }
      this.show('map');
    });

    // Nouvelle partie — écrase toujours la save de run en cours (roguelite)
    document.getElementById('btn-new-game')?.addEventListener('click', () => {
      SaveManager.deleteRunSave();  // efface uniquement la save de run (pas la meta)
      this.show('starter');
    });

    // Export JSON
    document.getElementById('btn-export-save')?.addEventListener('click', () => {
      if (SaveManager.hasSave()) {
        SaveManager.load(this.registry);   // s'assure que le registre est à jour
      }
      SaveManager.exportJSON(this.registry);
    });

    // Import JSON
    document.getElementById('btn-import-save')?.addEventListener('click', () => {
      SaveManager.importJSON(
        this.registry,
        (save) => {
          alert('✅ Sauvegarde importée ! Clique sur "Continuer" pour reprendre.');
          location.reload();   // recharge pour réinitialiser proprement l'UI
        },
        (err) => alert(`❌ ${err}`)
      );
    });

    // Supprimer la run
    document.getElementById('btn-delete-save')?.addEventListener('click', () => {
      const ok = confirm('Supprimer définitivement ta sauvegarde ?');
      if (!ok) return;
      SaveManager.deleteSave();
      location.reload();
    });

    // Reset complet (achievements + niveaux + méta)
    document.getElementById('btn-reset-all')?.addEventListener('click', () => {
      const ok1 = confirm('⚠️ Réinitialiser TOUTE ta progression ? (niveaux, succès, difficulté)');
      if (!ok1) return;
      const ok2 = confirm('Dernière confirmation — cette action est irréversible.');
      if (!ok2) return;
      SaveManager.resetMeta();
      SaveManager.deleteSave();
      location.reload();
    });

    // Affiche les achievements débloqués dans le menu
    this._renderMenuAchievements();

    // ── Sélecteur de difficulté ──────────────────────────────────────────
    this._renderDifficultySelector();
  }

  // Affiche un résumé des achievements débloqués dans le menu principal
  _renderMenuAchievements() {
    const container = document.getElementById('menu-achievements');
    if (!container) return;
    import('../data/levelSystem.js').then(({ ACHIEVEMENTS }) => {
      const meta     = SaveManager.loadMeta();
      const unlocked = meta.achievements ?? {};
      const done     = Object.values(ACHIEVEMENTS)
        .filter(a => unlocked[a.id]?.unlocked);
      const total    = Object.values(ACHIEVEMENTS).length;
      if (!done.length) {
        container.innerHTML = `<span class="menu-ach-empty">Aucun succès débloqué</span>`;
        return;
      }
      container.innerHTML = `
        <div class="menu-ach-title">🏅 Succès (${done.length}/${total})</div>
        <div class="menu-ach-list">
          ${done.slice(0, 6).map(a =>
            `<span class="menu-ach-badge" title="${a.desc}">${a.label}</span>`
          ).join('')}
          ${done.length > 6 ? `<span class="menu-ach-more">+${done.length - 6}</span>` : ''}
        </div>
      `;
    }).catch(() => {});
  }

  _renderDifficultySelector() {
    const container = document.getElementById('menu-difficulty');
    if (!container) return;
    const meta       = SaveManager.loadMeta();
    const unlocked   = getUnlockedDifficultiesWithMeta(meta);
    const current    = SaveManager.getDifficulty();

    container.innerHTML = `
      <div class="difficulty-label">Difficulté</div>
      <div class="difficulty-btns">
        ${unlocked.map(d => `
          <button class="btn-difficulty ${d.id === current ? 'active' : ''}"
                  data-id="${d.id}" title="${d.desc}">
            ${d.label}
          </button>
        `).join('')}
        ${DIFFICULTIES.filter(d => !unlocked.includes(d)).map(d => `
          <button class="btn-difficulty locked" disabled title="Complète ${d.unlockAt} run(s) pour débloquer">
            🔒 ${d.label.split(' ')[1]}
          </button>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('.btn-difficulty:not(.locked)').forEach(btn => {
      btn.addEventListener('click', () => {
        SaveManager.setDifficulty(btn.dataset.id);
        this._renderDifficultySelector();
      });
    });
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
      // Collecte visited/available depuis les nœuds mutés
      const visited   = [];
      const available = [];
      if (nodeData.startNode?.visited) visited.push('start');
      (nodeData.mapNodes ?? []).forEach(col =>
        col.forEach(n => {
          if (n.visited)   visited.push(n.id);
          if (n.available) available.push(n.id);
        })
      );
      // Colonne du nœud sélectionné
      const colStr = nodeData.nodeId ? nodeData.nodeId.split('_')[0] : '0';
      const col    = isNaN(parseInt(colStr, 10)) ? 0 : parseInt(colStr, 10);

      // Sauve seed + progression dans runState (auto-persisté par game.js)
      const seed = MapUI._seed;
      if (seed != null) {
        saveMapProgress(this.registry, seed, visited, available, col);
      }

      this.onNodeSelected(nodeData);
    });

    // Sauvegarde du seed initial (nouvelle map générée)
    if (MapUI._seed != null && !data?.seed) {
      const available = (MapUI._nodes?.[0] ?? []).map(n => n.id);
      saveMapProgress(this.registry, MapUI._seed, ['start'], available, 0);
    }
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
    // Récupère le seed et la progression depuis runState pour préserver le layout
    const progress = getMapProgress(this.registry);
    if (progress.seed != null && data.mapNodes) {
      // Retour depuis combat/shop/item : restaure le layout par seed
      // en recopiant visited/available depuis les mapNodes passés
      const visitedSet   = new Set(['start']);
      const availableSet = new Set();
      (data.mapNodes ?? []).forEach(col => col.forEach(n => {
        if (n.visited)   visitedSet.add(n.id);
        if (n.available) availableSet.add(n.id);
      }));
      this._startMapScene({
        mapIndex:       data.mapIndex,
        seed:           progress.seed,
        visitedNodes:   [...visitedSet],
        availableNodes: [...availableSet],
        prevArena:      data.prevArena ?? null,
      });
    } else {
      this._startMapScene(data);
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