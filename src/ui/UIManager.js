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
import { getRegionList, getRegionDifficulties, isRegionUnlocked, DEFAULT_REGION,
         REGIONS } from '../data/regions.js';

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
      // Un seul appel : show('map', data) → _startMapScene(data) avec la progression.
      // (Évite un double appel qui régénérait une map vierge.)
      this.show('map', {
        mapIndex:       state.currentMap ?? 0,
        seed:           state.seed ?? progress.seed ?? null,
        visitedNodes:   progress.visited,
        availableNodes: progress.available,
      });
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
      // Seed : personnalisée si la case "Choisir la seed" est cochée, sinon aléatoire
      const seedToggle = document.getElementById('seed-toggle');
      const seedInput  = document.getElementById('seed-input');
      let seed = MapGenerator.generateSeed();
      if (seedToggle?.checked) {
        const custom = MapGenerator.normalizeSeed(seedInput?.value);
        if (custom != null) seed = custom;
      }
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
          // Statistiques : enregistre la relique choisie (une fois par épopée)
          SaveManager.recordRelicUsed?.(relicId);
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
    const current    = SaveManager.getDifficulty();

    // ── Région courante (repli sur Kanto si verrouillée ou inconnue) ──────────
    let regionId = meta.region ?? DEFAULT_REGION;
    if (!isRegionUnlocked(regionId, meta)) regionId = DEFAULT_REGION;
    const regions   = getRegionList(meta);
    const regDiffs  = getRegionDifficulties(regionId, meta);

    // Difficulté courante valide pour cette région ? sinon on prend la première
    const validIds  = regDiffs.filter(d => d.unlocked).map(d => d.id);
    const curDiff   = validIds.includes(current) ? current : (validIds[0] ?? 'normal');
    if (curDiff !== current) SaveManager.setDifficulty(curDiff);

    const DIFF_LABELS = {
      easy:   '🌱 Facile',   normal: '⚔️ Normal',
      hard:   '🔥 Difficile', expert: '💀 Expert',
    };

    // Badge DEV si mode dev actif
    const devBadge = meta.devMode
      ? `<div class="menu-dev-badge" onclick="UIManager._devUnlockAll()">🛠 MODE DEV — Triple-tap pour désactiver</div>`
      : '';

    container.innerHTML = `
      ${devBadge}
      <div class="difficulty-label">Région</div>
      <div class="region-btns">
        ${regions.map(r => `
          <button class="btn-region ${r.id === regionId ? 'active' : ''} ${r.unlocked ? '' : 'locked'}"
                  data-region="${r.id}" ${r.unlocked ? '' : 'disabled'}
                  title="${r.unlocked ? r.subtitle : r.unlockHint}">
            <span class="region-visual">
              ${r.image
                ? `<img src="${r.image}" alt="${r.name}" class="region-img"
                        onerror="this.replaceWith(Object.assign(document.createElement('span'),
                                 {className:'region-emoji',textContent:'${r.emoji}'}))" />`
                : `<span class="region-emoji">${r.emoji}</span>`}
              ${r.unlocked ? '' : '<span class="region-lock">🔒</span>'}
            </span>
            <span class="region-name">${r.name}</span>
            <span class="region-sub">${r.unlocked ? r.subtitle : r.unlockHint}</span>
          </button>
        `).join('')}
      </div>
      <div class="difficulty-label">Difficulté</div>
      <div class="difficulty-btns">
        ${regDiffs.map(d => d.unlocked
          ? `<button class="btn-difficulty ${d.id === curDiff ? 'active' : ''}" data-id="${d.id}">
               ${DIFF_LABELS[d.id] ?? d.id}
             </button>`
          : `<button class="btn-difficulty locked" disabled
                     title="Terminez la Ligue en ${DIFF_LABELS[d.requires] ?? d.requires}">
               🔒 ${(DIFF_LABELS[d.id] ?? d.id).split(' ')[1] ?? d.id}
             </button>`
        ).join('')}
      </div>
      <div class="seed-chooser">
        <label class="seed-checkbox">
          <input type="checkbox" id="seed-toggle" />
          <span>Choisir la seed</span>
        </label>
        <input type="text" id="seed-input" class="seed-input hidden"
               placeholder="Entrez une seed (nombre ou texte)" maxlength="40" />
      </div>
    `;

    container.querySelectorAll('.btn-region:not(.locked)').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = SaveManager.loadMeta();
        SaveManager.saveMeta({ ...m, region: btn.dataset.region });
        this._renderDifficultySelector();   // re-filtre les difficultés
      });
    });

    container.querySelectorAll('.btn-difficulty:not(.locked)').forEach(btn => {
      btn.addEventListener('click', () => {
        SaveManager.setDifficulty(btn.dataset.id);
        this._renderDifficultySelector();
      });
    });

    // Affiche/masque le champ seed selon la case
    const toggle = container.querySelector('#seed-toggle');
    const input  = container.querySelector('#seed-input');
    if (toggle && input) {
      toggle.addEventListener('change', () => {
        input.classList.toggle('hidden', !toggle.checked);
        if (toggle.checked) input.focus();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // show()
  // ─────────────────────────────────────────────────────────────────────────

  _updateRelicBanner() {
    // La relique est désormais affichée dans le bouton "Détails de l'épopée" (📜)
    // Cette méthode est conservée comme no-op pour compatibilité.
  }

  // Vérifie les succès HORS combat (capture, achat…) et affiche un toast immédiat
  // pour chaque succès nouvellement débloqué.
  notifyAchievements(registry) {
    const reg      = registry ?? this.registry;
    const runState = reg?.get?.('runState') ?? {};
    const newAch   = window.SaveManager?.checkAchievements?.(runState) ?? [];
    newAch.forEach((id, i) => setTimeout(() => this._showAchievementToast(id), i * 600));
    return newAch;
  }

  _showAchievementToast(id) {
    const ach = window.__ACHIEVEMENTS__?.[id];
    if (!ach) return;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <span class="ach-toast-icon">🏅</span>
      <div>
        <div class="ach-toast-title">Achievement débloqué !</div>
        <div class="ach-toast-label">${ach.label}</div>
        <div class="ach-toast-desc">${ach.desc}</div>
      </div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // Fenêtre de confirmation aux couleurs du jeu (remplace confirm() natif).
  // Retourne une Promise<boolean>. Usage : if (await UIManager.confirm({...}))
  confirm({ title = 'Confirmer', message = '', icon = '❓',
            yesLabel = 'Oui', noLabel = 'Non' } = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'ui-confirm-overlay';
      overlay.innerHTML = `
        <div class="ui-confirm-box" role="dialog" aria-modal="true">
          <div class="ui-confirm-icon">${icon}</div>
          <div class="ui-confirm-title">${title}</div>
          ${message ? `<div class="ui-confirm-msg">${message}</div>` : ''}
          <div class="ui-confirm-actions">
            <button class="ui-confirm-no">${noLabel}</button>
            <button class="ui-confirm-yes">${yesLabel}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));

      const close = (val) => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 180);
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter')  close(true);
      };
      overlay.querySelector('.ui-confirm-yes').addEventListener('click', () => close(true));
      overlay.querySelector('.ui-confirm-no').addEventListener('click',  () => close(false));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      document.addEventListener('keydown', onKey);
    });
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
          // currentMap et la progression ont déjà été réinitialisés à la victoire
          // du boss. On régénère simplement la map suivante depuis le seed maître.
          const rs = this.registry.get('runState') ?? {};
          this.show('map', {
            ...nextData,
            mapIndex: rs.currentMap ?? nextData.mapIndex,
            seed:     rs.seed ?? null,
          });
        });
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _startMapScene() — initialise MapUI CSS
  // ─────────────────────────────────────────────────────────────────────────
  _startMapScene(data) {
    MapUI.init(data, this.registry, (nodeData) => {
      // ── Persistance PRÉ-combat ────────────────────────────────────────────
      // On sauvegarde l'état d'AVANT le nœud cliqué : le nœud courant reste
      // "disponible" dans la save. Ainsi, actualiser pendant la préparation ou
      // le combat fait reprendre AVANT le combat (à refaire), au lieu de le
      // sauter — et surtout, un boss interrompu ne soft-lock plus la run.
      // La progression POST-combat n'est commitée qu'à la victoire (CombatUI).
      const curId   = nodeData.nodeId ?? null;
      const visited = [];
      if (nodeData.startNode?.visited) visited.push('start');
      (nodeData.mapNodes ?? []).forEach(col =>
        col.forEach(n => { if (n.visited && n.id !== curId) visited.push(n.id); })
      );
      // available pré-clic = connexions des nœuds visités, moins les visités
      // (le nœud courant, connexion d'un visité, redevient donc disponible)
      const visitedSet = new Set(visited);
      const availSet   = new Set();
      const addConn = (n) => (n?.connections ?? []).forEach(id => {
        if (!visitedSet.has(id)) availSet.add(id);
      });
      if (nodeData.startNode?.visited) addConn(nodeData.startNode);
      (nodeData.mapNodes ?? []).forEach(col =>
        col.forEach(n => { if (visitedSet.has(n.id)) addConn(n); })
      );
      // Colonne du dernier nœud réellement terminé (celle d'avant le clic)
      const colStr = curId ? String(curId).split('_')[0] : '0';
      const colNum = isNaN(parseInt(colStr, 10)) ? 0 : parseInt(colStr, 10);
      const col    = Math.max(0, colNum - 1);

      const seed = MapUI._seed;
      if (seed != null) {
        saveMapProgress(this.registry, seed, visited, [...availSet], col);
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
  // ── Popover partagé, confiné au viewport (mobile-safe) ─────────────────────
  // Affiche `html` près de l'élément `anchorEl`, en restant dans l'écran visible.
  // Se ferme au clic ailleurs, au scroll, ou à l'appel de hidePopover().
  showPopover(anchorEl, html, opts = {}) {
    this.hidePopover();
    const pop = document.createElement('div');
    pop.className = 'shared-popover';
    pop.innerHTML = html;
    Object.assign(pop.style, {
      position: 'fixed', zIndex: '99999', visibility: 'hidden',
      maxWidth: 'min(280px, 90vw)',
      // Fond + bord en inline pour garantir l'affichage (priorité sur le CSS)
      background: '#2a3a5c',
      border: '2px solid #6c7a9c',
      borderRadius: '10px',
      padding: '10px 12px',
      color: '#e2e8f0',
      boxShadow: '0 6px 24px rgba(0,0,0,0.75)',
      fontSize: '11px',
      lineHeight: '1.55',
    });
    document.body.appendChild(pop);
    this._activePopover = pop;

    // Mesure puis positionne en restant dans le viewport
    const rect = anchorEl.getBoundingClientRect();
    const pw   = pop.offsetWidth;
    const ph   = pop.offsetHeight;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    const M    = 8;  // marge minimale aux bords

    // Position horizontale : centrée sur l'ancre, clampée
    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(M, Math.min(left, vw - pw - M));

    // Position verticale : au-dessus si possible, sinon en dessous
    let top = rect.top - ph - 8;
    if (top < M) top = rect.bottom + 8;          // bascule sous l'ancre
    top = Math.max(M, Math.min(top, vh - ph - M)); // clamp final

    Object.assign(pop.style, {
      left: `${left}px`, top: `${top}px`, visibility: 'visible',
    });

    // Fermeture au clic ailleurs / scroll
    this._popoverCleanup = (e) => {
      if (pop.contains(e?.target)) return;
      this.hidePopover();
    };
    // setTimeout pour ne pas capter le clic d'ouverture courant
    setTimeout(() => {
      document.addEventListener('click', this._popoverCleanup, true);
      window.addEventListener('scroll', this._popoverCleanup, true);
    }, 0);
    return pop;
  }

  hidePopover() {
    if (this._activePopover) { this._activePopover.remove(); this._activePopover = null; }
    if (this._popoverCleanup) {
      document.removeEventListener('click', this._popoverCleanup, true);
      window.removeEventListener('scroll', this._popoverCleanup, true);
      this._popoverCleanup = null;
    }
  }

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
    const totalCombats = (stats.totalWins ?? 0) + (stats.totalLosses ?? 0);
    const winRate = totalCombats > 0
      ? Math.round((stats.totalWins ?? 0) / totalCombats * 100) : 0;
    const maxLevelCount = SaveManager.countMaxLevelPokemon(meta);
    const relicsUsedCount = Object.values(stats.relicsUsed ?? {}).reduce((a, b) => a + b, 0);
    const totalAch = (() => { try { return Object.keys(ACHIEVEMENTS).length; } catch { return 0; } })();

    const sections = [
      ['Ligue', [
        ['🏆 Ligues vaincues',    stats.leaguesBeaten ?? 0],
        ['📍 en Facile',          stats.leaguesByDiff?.easy    ?? 0],
        ['⚔️ en Normal',          stats.leaguesByDiff?.normal  ?? 0],
        ['🔥 en Difficile',       stats.leaguesByDiff?.hard    ?? 0],
        ['💀 en Expert',          stats.leaguesByDiff?.expert  ?? 0],
      ]],
      ['Combats', [
        ['🏅 Badges obtenus',     stats.badges      ?? 0],
        ['✅ Combats gagnés',     stats.totalWins   ?? 0],
        ['❌ Combats perdus',     stats.totalLosses ?? 0],
        ['📈 Taux de victoire',   `${winRate}%`],
      ]],
      ['Collection', [
        ['📖 Pokémon vus',        (meta.seenPokemon ?? []).length + ' / 151'],
        ['🎒 Pokémon capturés',   stats.pokemonCaptured ?? 0],
        ['⭐ Pokémon niveau 100', maxLevelCount],
      ]],
      ['Progression', [
        ['💎 Reliques utilisées', relicsUsedCount],
        ['🏆 Succès débloqués',   `${Object.keys(meta.achievements ?? {}).length}${totalAch ? ' / ' + totalAch : ''}`],
      ]],
    ];

    const sectionHtml = sections.map(([title, rows]) => `
      <div style="margin-top:14px;">
        <div style="color:#a29bfe;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">${title}</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:5px 12px;font-size:13px;">
          ${rows.map(([label, val]) =>
            `<span style="color:#a0aec0">${label}</span><span style="color:#e2e8f0;font-weight:700;text-align:right">${val}</span>`
          ).join('')}
        </div>
      </div>`).join('');

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="background:#1a1a2e;border-radius:16px;padding:24px;min-width:260px;max-width:360px;width:100%;max-height:85vh;overflow-y:auto;">
        <h2 style="text-align:center;margin:0 0 4px;color:#e2e8f0">📊 Statistiques</h2>
        ${sectionHtml}
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
      if (!confirm('Quitter le mode dev ? Les succès débloqués automatiquement seront retirés et les niveaux des Pokémon restaurés.')) return;
      meta.devMode = false;
      // Retire uniquement les achievements marqués _byDev
      Object.keys(meta.achievements ?? {}).forEach(id => {
        if (meta.achievements[id]?._byDev) delete meta.achievements[id];
      });
      // Restaure les niveaux des Pokémon d'avant le mode dev
      if (meta._levelsBackup) {
        meta.pokemonLevels = meta._levelsBackup;
        delete meta._levelsBackup;
      }
      // Restaure les ligues réellement gagnées
      if (meta._leaguesBackup) {
        meta.runStats = meta.runStats ?? {};
        meta.runStats.leaguesByRegion = meta._leaguesBackup;
        delete meta._leaguesBackup;
      }
      SaveManager.saveMeta(meta);
      this._showToast('🔓 Mode dev désactivé — niveaux restaurés', '#e17055');
    } else {
      // Active le mode dev → débloque tout, marque _byDev, et passe tout niveau 100
      const now = Date.now();
      meta.achievements = meta.achievements ?? {};
      meta.devMode = true;
      Object.keys(ACHIEVEMENTS).forEach(id => {
        if (!meta.achievements[id]) {
          meta.achievements[id] = { unlockedAt: now, _byDev: true };
        }
      });

      // Ligues marquées comme terminées dans TOUTES les régions et difficultés.
      // On écrit réellement la donnée (plutôt que de tester devMode partout) :
      // ainsi les régions, les difficultés et le déblocage de la gen 2 suivent
      // le même chemin qu'en jeu normal. `_byDev` permet de tout retirer ensuite.
      meta.runStats = meta.runStats ?? {};
      meta._leaguesBackup = JSON.parse(JSON.stringify(meta.runStats.leaguesByRegion ?? {}));
      const byRegion = { ...(meta.runStats.leaguesByRegion ?? {}) };
      Object.values(REGIONS).forEach(r => {
        byRegion[r.id] = { ...(byRegion[r.id] ?? {}) };
        r.difficulties.forEach(d => {
          byRegion[r.id][d] = Math.max(byRegion[r.id][d] ?? 0, 1);
        });
      });
      meta.runStats.leaguesByRegion = byRegion;
      // Sauvegarde les niveaux actuels puis passe tous les Pokémon niveau 100
      meta._levelsBackup = { ...(meta.pokemonLevels ?? {}) };
      const allLevels = {};
      (window.__POKEMONS__ ?? []).forEach(p => { allLevels[p.id] = 100; });
      // Fallback : si la liste n'est pas exposée, on garde les ids 1-151
      if (Object.keys(allLevels).length === 0) {
        for (let id = 1; id <= 251; id++) allLevels[id] = 100;
      }
      meta.pokemonLevels = allLevels;
      SaveManager.saveMeta(meta);
      this._showToast('🛠 Mode dev — tous Pokémon niveau 100', '#6c5ce7');
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
        // currentMap a déjà été avancé DÈS le calcul du combat (resolve()).
        // On affiche l'écran de victoire (arène vaincue = result.mapIndex).
        this.show('arenaVictory', {
          mapIndex:     result.mapIndex,
          trainerName:  result.trainerName,
          leagueSprite: result.leagueSprite,
          isLeague:     result.isLeague,
          fieldTeam:    result.fieldTeam ?? [],
        });
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
      // lastNodeCol = colonne max réellement atteinte (recalculée des visités)
      let maxCol = 0;
      visitedSet.forEach(id => {
        const c = parseInt(String(id).split('_')[0], 10);
        if (!isNaN(c) && c > maxCol) maxCol = c;
      });
      saveMapProgress(
        this.registry, progress.seed,
        [...visitedSet], [...availableSet], maxCol
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