// ─────────────────────────────────────────────────────────────────────────────
// UIManager.js
//
// Architecture : tous les écrans en HTML/CSS pur, map via MapUI.
// ─────────────────────────────────────────────────────────────────────────────

import { getRunState, addSeenPokemon,
         saveMapProgress, getMapProgress } from '../data/runState.js';
import { DIFFICULTIES, ACHIEVEMENTS, getDifficulty,
         getUnlockedDifficultiesWithMeta,
         getUnlockedDifficulties }             from '../data/levelSystem.js';
import { RELICS }                             from '../data/relics.js';
import { POKEMON_PASSIVES }                               from '../data/passiveHooks.js';
import { POKEMONS }                                       from '../data/pokemons.js';
import { ITEMS }                                          from '../data/items.js';
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
import { TutorialUI }      from './TutorialUI.js';
import { TalentTreeUI }      from './TalentTreeUI.js';
import { AchievementsUI }      from './AchievementsUI.js';
import { RelicsLibraryUI }    from './RelicsLibraryUI.js';
import { RelicUI }           from './RelicUI.js';
import { RelicEngine }       from '../combat/RelicEngine.js';

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

    document.getElementById('btn-epopee')
      ?.addEventListener('click', () => this._showEpopeeDetails());

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

    // ── Tutoriel ────────────────────────────────────────────────────────────
    // Expose POKEMON_PASSIVES sur window pour PrepUI (pas d'import dynamique)
    window.__POKEMON_PASSIVES__ = POKEMON_PASSIVES;
    window.__POKEMONS__          = POKEMONS;
    window.__ITEMS__             = ITEMS;
    window.__ACHIEVEMENTS__     = ACHIEVEMENTS;
    window.__RELICS__           = RELICS;
    TutorialUI.init();
    TalentTreeUI.init();
    AchievementsUI.init();
    RelicUI.init();
    RelicsLibraryUI.init();
    document.getElementById('btn-talent-tree')?.addEventListener('click', () => TalentTreeUI.open());
    document.getElementById('btn-achievements')?.addEventListener('click', () => AchievementsUI.open());
    document.getElementById('btn-stats')?.addEventListener('click', () => this._showStats());
    document.getElementById('btn-relics-library')?.addEventListener('click', () => RelicsLibraryUI.open());

    // Affiche le tutoriel au premier lancement (jamais vu)
    const meta = SaveManager.loadMeta();
    if (!meta.hasSeenTutorial) {
      setTimeout(() => TutorialUI.open('intro'), 300);
      SaveManager.saveMeta({ ...meta, hasSeenTutorial: true });
    }

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

      // Le seed MAÎTRE vient de state.seed ; la progression de mapVisited/mapAvailable
      const progress = getMapProgress(this.registry);
      this._startMapScene({
        mapIndex:       state.currentMap ?? 0,
        seed:           state.seed ?? progress.seed ?? null,
        visitedNodes:   progress.visited,
        availableNodes: progress.available,
      });
      this.show('map');
    });

    // Nouvelle partie — écrase toujours la save de run en cours (roguelite)
    // ── Bouton DEV (triple tap sur le titre PokeChess) ─────────────────────────
    let devTaps = 0, devTimer = null;
    document.querySelector('.menu-title, .game-title, h1')
      ?.addEventListener('click', () => {
        devTaps++;
        clearTimeout(devTimer);
        devTimer = setTimeout(() => { devTaps = 0; }, 600);
        if (devTaps >= 3) { devTaps = 0; this._devUnlockAll(); }
      });

    document.getElementById('btn-new-game')?.addEventListener('click', () => {
      console.log('[UIManager] btn-new-game cliqué');
      SaveManager.deleteRunSave();
      const seed = MapGenerator.generateSeed();  // seed maître numérique de l'épopée
      const diff = SaveManager.getDifficulty() ?? 'easy';
      this.registry.reset();
      this.registry.set('runState', { currentMap:0, coins:5, inventory:[],
        playerBank:[], unlockedSlots:3, seenPokemon:[], loopCount:0, seed,
        difficulty: diff });
      console.log('[UIManager] appel RelicUI.open()');
      RelicUI.open((relicId) => {
        console.log('[UIManager] RelicUI callback, relicId =', relicId);
        if (relicId) {
          const rs = this.registry.get('runState') ?? {};
          this.registry.set('runState', {
            ...rs,
            relic:       { id: relicId },
            anomalyTypes: relicId === 'anomalie'
              ? RelicEngine.generateAnomalyTypes(seed)
              : null,
          });
          this._applyRelicStartEffects(relicId);
        }
        this.show('starter');
      });
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

    // ── Sélecteur de difficulté ──────────────────────────────────────────
    this._renderDifficultySelector();
  }

  _renderDifficultySelector() {
    const container = document.getElementById('menu-difficulty');
    if (!container) return;
    const meta       = SaveManager.loadMeta();
    const unlocked   = getUnlockedDifficultiesWithMeta(meta);
    const current    = SaveManager.getDifficulty();

    // Badge DEV si mode dev actif
    const devBadge = meta.devMode
      ? `<div class="menu-dev-badge" onclick="UIManager._devUnlockAll()">🛠 MODE DEV — Triple-tap pour désactiver</div>`
      : '';

    container.innerHTML = `
      ${devBadge}
      <div class="difficulty-label">Difficulté</div>
      <div class="difficulty-btns">
        ${unlocked.map(d => `
          <button class="btn-difficulty ${d.id === current ? 'active' : ''}"
                  data-id="${d.id}" title="${d.desc}">
            ${d.label}
          </button>
        `).join('')}
        ${DIFFICULTIES.filter(d => !unlocked.includes(d)).map(d => `
          <button class="btn-difficulty locked" disabled title="Succès requis : ${d.unlockAchievement}">
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

  _updateRelicBanner() {
    // La relique est désormais affichée dans le bouton "Détails de l'épopée" (📜)
    // Cette méthode est conservée comme no-op pour compatibilité.
  }

  show(screenName, data = {}) {
    this._updateRelicBanner();
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
          // Retour menu demandé depuis l'écran de victoire
          if (nextData.goToMenu) {
            this.show('menu');
            return;
          }
          this._closeOverlay('arenaVictory');
          // Passage à la map SUIVANTE : le seed MAÎTRE reste inchangé.
          // On réinitialise seulement la progression (nœuds visités/disponibles).
          const rs = this.registry.get('runState') ?? {};
          this.registry.set('runState', {
            ...rs,
            mapVisited: [], mapAvailable: [], lastNodeCol: 0,
          });
          this.show('map', { ...nextData, seed: rs.seed ?? null });
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
  // ── Détails de l'épopée (seed, difficulté, relique) ────────────────────────
  _showEpopeeDetails() {
    const state   = getRunState(this.registry);
    const seed    = state.seed ?? '—';
    const diff    = state.difficulty ?? 'easy';
    const DIFF_LABELS = { easy:'📍 Facile', normal:'⚔️ Normal', hard:'🔥 Difficile', expert:'💀 Expert' };
    const relicId = state.relic?.id;
    const relic   = relicId ? window.__RELICS__?.[relicId] : null;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#1a1a2e;border-radius:16px;padding:24px;min-width:260px;max-width:340px;width:90%">
        <h2 style="text-align:center;margin:0 0 16px;color:#e2e8f0">📜 Détails de l'épopée</h2>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:10px 12px;font-size:13px;">
          <span style="color:#a0aec0">Difficulté</span>
          <span style="color:#e2e8f0;font-weight:700">${DIFF_LABELS[diff] ?? diff}</span>
          <span style="color:#a0aec0">Relique</span>
          <span style="color:#a29bfe;font-weight:700">${relic ? relic.icon + ' ' + relic.name : '— Aucune'}</span>
          <span style="color:#a0aec0">Seed</span>
          <span style="color:#e2e8f0;font-weight:700;font-family:monospace;word-break:break-all">${seed}</span>
        </div>
        <button id="btn-epopee-close" style="margin-top:20px;width:100%;padding:10px;background:#6c5ce7;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">Fermer</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-epopee-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  // ── Statistiques ─────────────────────────────────────────────────────────────
  _showStats() {
    const meta  = SaveManager.loadMeta();
    const stats = SaveManager.getRunStats(meta);
    const lines = [
      ['🏆 Ligues vaincues',    stats.leaguesBeaten ?? 0],
      ['📍 Facile',            stats.leaguesByDiff?.easy    ?? 0],
      ['⚔️ Normal',             stats.leaguesByDiff?.normal  ?? 0],
      ['🔥 Difficile',          stats.leaguesByDiff?.hard    ?? 0],
      ['💀 Expert',             stats.leaguesByDiff?.expert  ?? 0],
      ['✅ Combats gagnés',     stats.totalWins   ?? 0],
      ['❌ Combats perdus',     stats.totalLosses ?? 0],
      ['🏅 Badges totaux',      stats.badges      ?? 0],
      ['📖 Pokémon vus',        (meta.seenPokemon ?? []).length],
      ['🎒 Pokémon capturés',   (meta.caughtPokemon ?? []).length],
      ['🏅 Succès débloqués',   Object.keys(meta.achievements ?? {}).length],
    ];
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#1a1a2e;border-radius:16px;padding:24px;min-width:260px;max-width:340px;width:90%">
        <h2 style="text-align:center;margin:0 0 16px;color:#e2e8f0">📊 Statistiques</h2>
        <div style="display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:13px;">
          ${lines.map(([label, val]) =>
            `<span style="color:#a0aec0">${label}</span><span style="color:#e2e8f0;font-weight:700;text-align:right">${val}</span>`
          ).join('')}
        </div>
        <button id="btn-stats-close" style="margin-top:20px;width:100%;padding:10px;background:#6c5ce7;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">Fermer</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-stats-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  // ── Mode DEV : toggle unlock/reset tous les achievements ───────────────────
  _devUnlockAll() {
    const meta   = SaveManager.loadMeta();
    const isActive = !!meta.devMode;

    if (isActive) {
      // Désactive le mode dev → retire les achievements débloqués par dev
      if (!confirm('Quitter le mode dev ? Les succès débloqués automatiquement seront retirés.')) return;
      meta.devMode = false;
      // Retire uniquement les achievements marqués _byDev
      Object.keys(meta.achievements ?? {}).forEach(id => {
        if (meta.achievements[id]?._byDev) delete meta.achievements[id];
      });
      SaveManager.saveMeta(meta);
      this._showToast('🔓 Mode dev désactivé — succès réinitialisés', '#e17055');
    } else {
      // Active le mode dev → débloque tout et marque _byDev
      const now = Date.now();
      meta.achievements = meta.achievements ?? {};
      meta.devMode = true;
      Object.keys(ACHIEVEMENTS).forEach(id => {
        if (!meta.achievements[id]) {
          meta.achievements[id] = { unlockedAt: now, _byDev: true };
        }
      });
      SaveManager.saveMeta(meta);
      this._showToast('🛠 Mode dev activé — triple-tap pour désactiver', '#6c5ce7');
    }
    this._renderDifficultyMenu?.();
    this.show('menu');
  }

  _showToast(msg, color = '#2d3436') {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed', top:'60px', left:'50%',
      transform:'translateX(-50%)',
      background: color, color:'#fff',
      padding:'10px 20px', borderRadius:'8px',
      fontSize:'13px', fontWeight:'700',
      zIndex:'99999', whiteSpace:'nowrap',
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  _applyRelicStartEffects(relicId) {
    const rs = this.registry.get('runState') ?? {};
    if (relicId === 'contrat_maudit') {
      this.registry.set('runState', { ...rs, coins: (rs.coins ?? 5) + 8 });
    }
    if (relicId === 'pochette_surprise') {
      this.registry.set('runState', { ...rs, _startRandomItem: true });
    }
  }

  _initMenu() {
    // Le listener btn-new-game est déjà posé dans _bindMenuButtons avec RelicUI
    // Cette méthode ne doit plus le remplacer
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
      // Vérifie les achievements de fin de run
    const runStateFinal = this.registry?.get?.('runState') ?? {};
    SaveManager.checkAchievements(runStateFinal, null);
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
      // Re-sauvegarde explicite de la progression mise à jour (nœuds atteints)
      saveMapProgress(
        this.registry, progress.seed,
        [...visitedSet], [...availableSet], progress.col ?? 0
      );
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
    this._updateRelicBanner();
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
    this._updateRelicBanner();
  }
}

export const UIManager = new UIManagerClass();