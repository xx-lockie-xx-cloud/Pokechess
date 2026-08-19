// ─────────────────────────────────────────────────────────────────────────────
// PrepUI.js — Remplace PrepScene.js (Phaser)
// Gère l'overlay HTML de gestion d'équipe.
//
// Fonctionnement :
//   PrepUI.open(registry)  → ouvre l'overlay, charge l'état
//   PrepUI.close(registry) → sauvegarde et ferme l'overlay
//
// Layout de l'overlay (défini dans index.html + main.css) :
//   ┌─────────────────────────────────────┐
//   │ Titre                          [✕] │
//   ├──────────────┬──────────────────────┤
//   │ Terrain 3×2  │ Banque 3×2           │
//   │              │                      │
//   │ Synergies    │ Toile stats (SVG)    │
//   │ Inventaire   │                      │
//   ├─────────────────────────────────────┤
//   │ Barre d'action (vente/déséquipement)│
//   ├─────────────────────────────────────┤
//   │       [ ✅ Valider l'équipe ]       │
//   └─────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

import { POKEMONS, TYPE_COLORS as TC }   from '../data/pokemons.js';
import { GRID_COLS, GRID_ROWS }          from '../board.js';
import { getBSTTier, getRunState, setRunState, applyAnomalyToUnits,
         addCoins, addToInventory,
         removeFromInventory, getInventory,
         BANK_MAX_SIZE, getUnlockedSlots } from '../data/runState.js';
import { ITEMS }                         from '../data/items.js';
import { getActiveSynergies, getFullStats, assignCorners, ensureCorners }  from '../data/synergies.js';
import { getLevelBadgeHTML, getLevelBonus, getActiveTalentEffects,
         getLevelBadgeHTMLFor, getEffectiveLevel } from '../data/levelSystem.js';
import { EFFECT_LABELS_SHORT }              from '../data/statusConstants.js';
import { getPokemonPassive }                 from '../data/passiveHooks.js';
import { getMove }                           from '../data/moves.js';
import { canEvolve, getEvolutionId }     from '../data/evolutionData.js';
import { RelicEngine }                   from '../combat/RelicEngine.js';

function hexToCSS(hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >>  8) & 0xff;
  const b =  hex        & 0xff;
  return `rgb(${r},${g},${b})`;
}

// Couleur CSS approximative par type (pour le label de capacité dans le slot)
function typeColor(type) {
  const colors = {
    Feu:'#f08030',    Eau:'#6890f0',    Plante:'#78c850',  Électrik:'#f8d030',
    Psy:'#f85888',    Glace:'#98d8d8',  Combat:'#c03028',  Poison:'#a040a0',
    Sol:'#e0c068',    Vol:'#a890f0',    Insecte:'#a8b820',  Roche:'#b8a038',
    Spectre:'#705898',Dragon:'#7038f8', Ténèbres:'#705848', Acier:'#b8b8d0',
    Fée:'#ee99ac',    Normal:'#a8a878',
  };
  return colors[type] ?? '#a0aec0';
}

export const PrepUI = {
  _registry:    null,
  _field:       [],    // [col][row] → pokemon | null
  _bank:        [],    // [idx] → pokemon | null
  _selectedCard: null, // { pokemon, source, col?, row?, idx? }
  _selectedItem: null, // objet inventaire sélectionné
  _dragSource:  null,

  // ─────────────────────────────────────────────────────────────────────────
  // open() — charge l'état et construit l'interface
  // ─────────────────────────────────────────────────────────────────────────
  open(registry) {
    this._registry     = registry;
    this._selectedCard = null;
    this._selectedItem = null;
    this._dragSource   = null;
    this._draggedItem  = null;
    this._dragJustEnded = false;

    const state       = getRunState(registry);
    // ✅ Charge les unités terrain depuis le registre
    const playerUnits = registry.get('playerUnits') ?? [];

    // Initialise le terrain
    this._field = [];
    for (let c = 0; c < GRID_COLS; c++) {
      this._field[c] = [];
      for (let r = 0; r < GRID_ROWS; r++) this._field[c][r] = null;
    }
    // Place les unités terrain
    playerUnits.forEach(u => {
      if (u.col < GRID_COLS && u.row < GRID_ROWS) {
        this._field[u.col][u.row] = u;
      }
    });

    // Initialise la banque
    this._bank = Array.from({ length: BANK_MAX_SIZE },
      (_, i) => state.playerBank?.[i] ?? null
    );

    this._renderAll();
    this._bindCloseButton();
    this._bindValidateButton();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // close() — sauvegarde et ferme
  // ─────────────────────────────────────────────────────────────────────────
  close(registry) {
    this._saveState(registry ?? this._registry);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _saveState() — persiste dans le registre Phaser
  // ─────────────────────────────────────────────────────────────────────────
  _saveState(registry) {
    const units = [];
    for (let c = 0; c < GRID_COLS; c++)
      for (let r = 0; r < GRID_ROWS; r++)
        if (this._field[c][r]) units.push({ ...this._field[c][r], col: c, row: r, isInTeam: true });

    const bank = this._bank.filter(Boolean).map(u => ({ ...u, isInTeam: true }));

    registry.set('playerUnits', units);
    const state = getRunState(registry);
    setRunState(registry, { ...state, playerBank: bank });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _renderAll() — reconstruit tout l'overlay
  // ─────────────────────────────────────────────────────────────────────────
  _renderAll() {
    this._renderField();
    this._renderBank();
    this._renderSynergies();
    this._renderInventory();
    this._renderActionBar();
    this._updateBankLabel();
    // Toile uniquement si sélection active
    if (!this._selectedCard) this._clearSpider();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _renderField() — terrain 3×2
  // ─────────────────────────────────────────────────────────────────────────
  _renderField() {
    const grid = document.getElementById('prep-field');
    if (!grid) return;
    grid.innerHTML = '';

    // Placement libre : tous les slots sont accessibles
    // La limite porte sur le nombre TOTAL de pokémons sur le terrain
    // (pas sur leur position). Les slots vides restent interactifs.
    const maxUnits = getUnlockedSlots(this._registry);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        // Un slot est "bloqué" uniquement si :
        // - il est vide ET le terrain est déjà plein (maxUnits atteint)
        const unit = this._field[c][r];
        const totalOnField = Object.values(this._field)
          .flatMap(col => Object.values(col))
          .filter(Boolean).length;
        // Un slot vide est verrouillé seulement si le terrain est plein
        // ET qu'on ne déplace pas un pokémon déjà sur le terrain
        // (permettre le drag terrain→terrain même quand c'est plein)
        const dragFromField = this._dragSource?.source === 'field';
        const isLocked = !unit && totalOnField >= maxUnits && !dragFromField;

        if (isLocked) {
          const locked = document.createElement('div');
          locked.className = 'slot slot-locked';
          locked.innerHTML = `<span class="slot-lock-icon">🔒</span>`;
          locked.dataset.source = 'field';
          locked.dataset.col    = c;
          locked.dataset.row    = r;
          // Le drop est détecté par _dropTargetAt (Pointer Events) via data-source.
          // _onDrop autorise terrain→terrain (repositionnement) même sur case verrouillée.
          grid.appendChild(locked);
          continue;
        }

        const slot = this._createSlot(unit, {
          selected: this._selectedCard?.source === 'field' &&
                    this._selectedCard?.col === c &&
                    this._selectedCard?.row === r,
          onClick: () => this._onFieldClick(c, r),
          onDragStart: unit ? () => this._startDrag('field', c, r) : null,
          onDragOver:  () => this._onDragOver('field', c, r),
          onDrop:      () => this._onDrop('field', c, r),
        });
        slot.dataset.source = 'field';
        slot.dataset.col    = c;
        slot.dataset.row    = r;
        grid.appendChild(slot);
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _renderBank() — banque 3×2
  // ─────────────────────────────────────────────────────────────────────────
  _renderBank() {
    const grid = document.getElementById('prep-bank');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < BANK_MAX_SIZE; i++) {
      const unit = this._bank[i] ?? null;
      const slot = this._createSlot(unit, {
        selected: this._selectedCard?.source === 'bank' &&
                  this._selectedCard?.idx === i,
        onClick:     () => this._onBankClick(i),
        onDragStart: unit ? () => this._startDrag('bank', i) : null,
        onDragOver:  () => this._onDragOver('bank', i),
        onDrop:      () => this._onDrop('bank', i),
      });
      slot.dataset.source = 'bank';
      slot.dataset.idx    = i;
      grid.appendChild(slot);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _createSlot() — crée un élément HTML de slot
  // ─────────────────────────────────────────────────────────────────────────
  _createSlot(unit, { selected, onClick, onDragStart, onDragOver, onDrop }) {
    const slot = document.createElement('div');
    slot.className = `slot${unit ? ' occupied' : ''}${selected ? ' selected' : ''}`;
    slot.setAttribute('draggable', 'false');  // drag géré par Pointer Events

    if (unit) {
      // Coins de type — attribution aléatoire stockée sur l'unité [TL,TR,BR,BL]
      // On utilise TOUJOURS les coins stockés pour que l'affichage corresponde
      // exactement au calcul de synergie (getActiveSynergies lit aussi unit.corners).
      let corners = ensureCorners(unit);
      const cc = (i) => hexToCSS(TC[corners[i]] ?? 0x888888);
      const cTL = cc(0), cTR = cc(1), cBR = cc(2), cBL = cc(3);

      // Objet équipé
      const itemHtml = unit.heldItem
        ? `<span class="slot-item">${unit.heldItem.emoji}</span>` : '';

      const meta      = window.SaveManager?.loadMeta() ?? null;
      const unitLevel = meta?.pokemonLevels?.[unit.id] ?? 1;

      slot.innerHTML = `
        <span class="type-corner tl" style="border-color:${cTL} transparent transparent transparent"></span>
        <span class="type-corner tr" style="border-color:transparent ${cTR} transparent transparent"></span>
        <span class="type-corner bl" style="border-color:transparent transparent transparent ${cBL}"></span>
        <span class="type-corner br" style="border-color:transparent transparent ${cBR} transparent"></span>
        <img src="${unit.spriteUrl}" alt="${unit.name}"
             onerror="this.src='assets/placeholder.png'" />
        <span class="slot-name">${unit.name}</span>
        ${(() => {
          // Badge tenant compte des niveaux temporaires d'un objet (Super
          // Bonbon) : affiche « Nv.60 +20 » plutôt que le seul niveau acquis.
          const m = window.SaveManager?.loadMeta?.() ?? null;
          const { level } = getEffectiveLevel(unit, m);
          return level > 1 ? getLevelBadgeHTMLFor(unit, m) : '';
        })()}
        ${(() => {
          const rid = getRunState(this._registry)?.relic?.id;
          const INFO = { 'pacte_de_sang':'💀 HP-20%', 'benediction':'🩹 HP+30%', 'contrat_maudit':'🩸 HP-10%' };
          return rid && INFO[rid] ? `<span class="slot-relic-mod" title="${INFO[rid]}">${INFO[rid]}</span>` : '';
        })()}
        ${(() => {
          const passive = getPokemonPassive(unit.id, unitLevel);
          return passive ? `<span class="slot-passive-badge" title="${passive.name}: ${passive.desc}">✨</span>` : '';
        })()}
        ${(() => {
          if (getRunState(this._registry)?.relic?.id !== 'couronne') return '';
          const allUnits = this._getAllFieldUnits();
          const bst = u => (u.stats?.hp??0)+(u.stats?.atk??0)+(u.stats?.spa??0)+(u.stats?.def??0)+(u.stats?.spd_def??0)+(u.stats?.spd??0);
          const topId = allUnits.sort((a,b) => bst(b)-bst(a))[0]?.id;
          return topId === unit.id ? '<span class="slot-crown" title="👑 Couronne : synergies ×2">👑</span>' : '';
        })()}
        ${itemHtml}
      `;
    } else {
      slot.innerHTML = `<span class="slot-plus">+</span>`;
    }

    // Événements
    slot.addEventListener('click', onClick);

    // ── Drag des pokémons via Pointer Events (souris + tactile fiable) ─────────
    // Le HTML5 DnD natif ne fonctionne pas sur mobile ; on utilise pointerdown.
    if (onDragStart && unit) {
      slot.style.touchAction = 'none';   // évite le scroll pendant le drag
      slot.addEventListener('pointerdown', (e) => {
        // Ignore le clic droit / boutons secondaires
        if (e.button && e.button !== 0) return;
        this._startPointerDrag(e, slot, onDragStart);
      });
    }

    // ── Réception d'un objet inventaire déposé (DnD natif, depuis l'inventaire) ─
    slot.addEventListener('dragover', (e) => {
      if (this._draggedItem && unit) { e.preventDefault(); slot.classList.add('drag-over'); }
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', (e) => {
      slot.classList.remove('drag-over');
      if (this._draggedItem && unit) {
        e.preventDefault();
        this._equipItem(this._draggedItem,
          slot.dataset.source === 'field' ? 'field' : 'bank',
          parseInt(slot.dataset.col ?? 0),
          parseInt(slot.dataset.row ?? 0),
          parseInt(slot.dataset.idx ?? 0)
        );
        this._draggedItem = null;
      }
    });

    return slot;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Drag par Pointer Events — fiable sur mobile (tactile) et desktop (souris)
  // ─────────────────────────────────────────────────────────────────────────
  _startPointerDrag(e, slot, onDragStart) {
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    let ghost    = null;

    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      // Seuil : on ne démarre le drag qu'après un vrai mouvement (sinon = tap)
      if (!dragging && Math.hypot(dx, dy) < 8) return;
      if (!dragging) {
        dragging = true;
        onDragStart();                       // pose this._dragSource
        slot.classList.add('dragging-source');
        // Fantôme suivant le doigt / curseur
        ghost = slot.cloneNode(true);
        Object.assign(ghost.style, {
          position: 'fixed', pointerEvents: 'none', opacity: '0.85',
          zIndex: '99998', width: `${slot.offsetWidth}px`, height: `${slot.offsetHeight}px`,
          transform: 'translate(-50%, -50%)', margin: '0',
        });
        document.body.appendChild(ghost);
        // Re-render pour débloquer les cases verrouillées (drag terrain→terrain)
        this._renderAll();
      }
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top  = `${ev.clientY}px`;
      this._highlightDropTargetAt(ev.clientX, ev.clientY);
    };

    const onUp = (ev) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      if (ghost) ghost.remove();
      slot.classList.remove('dragging-source');
      this._clearDropHighlight();
      if (!dragging) { this._dragSource = null; return; }  // simple tap → le click gère

      // Empêche le click fantôme post-drag
      this._dragJustEnded = true;
      setTimeout(() => { this._dragJustEnded = false; }, 80);

      const target = this._dropTargetAt(ev.clientX, ev.clientY);
      if (target?.type === 'field')      this._onDrop('field', target.col, target.row);
      else if (target?.type === 'bank')  this._onDrop('bank', target.idx);
      else { this._dragSource = null; this._renderAll(); }  // hors zone → annule
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  },

  // Retourne la cible de drop sous le point (x, y), ou null
  _dropTargetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const slotEl = el.closest('[data-source]');
    if (!slotEl) return null;
    if (slotEl.dataset.source === 'field')
      return { type: 'field', col: parseInt(slotEl.dataset.col), row: parseInt(slotEl.dataset.row) };
    if (slotEl.dataset.source === 'bank')
      return { type: 'bank', idx: parseInt(slotEl.dataset.idx) };
    return null;
  },

  _highlightDropTargetAt(x, y) {
    this._clearDropHighlight();
    const el = document.elementFromPoint(x, y);
    const slotEl = el?.closest('[data-source]');
    if (slotEl) slotEl.classList.add('drag-over');
  },

  _clearDropHighlight() {
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Clics sur le terrain
  // ─────────────────────────────────────────────────────────────────────────
  _onFieldClick(col, row) {
    if (this._dragJustEnded) return;
    const unit = this._field[col][row];

    // Si objet inventaire sélectionné → équiper via clic
    if (this._selectedItem && unit) {
      this._equipItem(this._selectedItem, 'field', col, row, null);
      return;
    }

    // Clic = affichage des stats uniquement (le déplacement se fait au drag & drop)
    if (unit) {
      this._selectedCard = { pokemon: unit, source: 'field', col, row };
      this._renderAll();
      this._drawSpider(unit);
    } else {
      this._selectedCard = null;
      this._clearSpider();
      this._renderAll();
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Clics sur la banque
  // ─────────────────────────────────────────────────────────────────────────
  _onBankClick(idx) {
    if (this._dragJustEnded) return;
    const unit = this._bank[idx];

    // Si objet inventaire sélectionné → équiper via clic
    if (this._selectedItem && unit) {
      this._equipItem(this._selectedItem, 'bank', null, null, idx);
      return;
    }

    // Clic = affichage des stats uniquement (déplacement au drag & drop)
    if (unit) {
      this._selectedCard = { pokemon: unit, source: 'bank', idx };
      this._renderAll();
      this._drawSpider(unit);
    } else {
      this._selectedCard = null;
      this._clearSpider();
      this._renderAll();
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Drag & drop natif HTML5
  // ─────────────────────────────────────────────────────────────────────────
  _startDrag(source, colOrIdx, row) {
    this._dragSource = source === 'field'
      ? { source, col: colOrIdx, row }
      : { source, idx: colOrIdx };
  },

  _onDragOver(targetType, colOrIdx, row) {
    // Juste pour autoriser le drop (géré dans dragover)
  },

  _onDrop(targetType, colOrIdx, row) {
    if (!this._dragSource) return;

    // Anti-clic fantôme après drag
    this._dragJustEnded = true;
    setTimeout(() => { this._dragJustEnded = false; }, 50);

    const src = this._dragSource;

    // ── Capture l'unité AVANT toute modification ──────────────────────
    let draggedUnit = null;
    if (src.source === 'field') {
      draggedUnit = this._field[src.col]?.[src.row] ?? null;
    } else {
      draggedUnit = this._bank[src.idx] ?? null;
    }

    // Si rien à déposer → annule
    if (!draggedUnit) {
      this._dragSource = null;
      return;
    }

    if (targetType === 'field') {
      // Évite de déposer sur soi-même
      if (src.source === 'field' && src.col === colOrIdx && src.row === row) {
        this._dragSource = null;
        return;
      }

      // Contrainte d'équipe : un dépôt depuis la BANQUE augmente le nombre
      // d'unités sur le terrain → autorisé seulement si on reste sous la limite.
      // Un déplacement terrain→terrain ne change pas le total → toujours autorisé
      // (y compris sur une case verrouillée).
      const existing = this._field[colOrIdx][row] ?? null;
      if (src.source === 'bank' && !existing) {
        const maxUnits = getUnlockedSlots(this._registry);
        const totalOnField = Object.values(this._field)
          .flatMap(col => Object.values(col)).filter(Boolean).length;
        if (totalOnField >= maxUnits) {
          // Terrain plein : on refuse le dépôt depuis la banque
          this._dragSource = null;
          this._renderAll();
          return;
        }
      }

      // Vide la source
      if (src.source === 'field') {
        this._field[src.col][src.row] = existing
          ? { ...existing, col: src.col, row: src.row } : null;
      } else {
        this._bank[src.idx] = existing ?? null;
      }

      // Place l'unité sur la cible
      this._field[colOrIdx][row] = { ...draggedUnit, col: colOrIdx, row };
      this._checkEvolution();

    } else {
      // Dépose en banque
      if (src.source === 'bank' && src.idx === colOrIdx) {
        this._dragSource = null;
        return;
      }

      const existing = this._bank[colOrIdx] ?? null;

      if (src.source === 'field') {
        this._field[src.col][src.row] = existing
          ? { ...existing, col: src.col, row: src.row } : null;
      } else {
        this._bank[src.idx] = existing ?? null;
      }

      this._bank[colOrIdx] = draggedUnit;
    }

    this._dragSource = null;
    this._renderAll();
    this._saveState(this._registry);
  },

  // Récupère l'unité depuis la source de drag
  _getDragUnit(src) {
    if (src.source === 'field') return this._field[src.col]?.[src.row];
    return this._bank[src.idx];
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Équipement d'objet
  // ─────────────────────────────────────────────────────────────────────────
  _equipItem(item, source, col, row, idx) {
    let unit;
    if (source === 'field') unit = this._field[col][row];
    else unit = this._bank[idx];
    if (!unit) return;

    // Remet l'ancien objet dans l'inventaire
    if (unit.heldItem) addToInventory(this._registry, unit.heldItem.id);

    // Retire le nouvel objet de l'inventaire
    removeFromInventory(this._registry, item.id);

    const updated = { ...unit, heldItem: item };
    if (source === 'field') this._field[col][row] = updated;
    else this._bank[idx] = updated;

    this._selectedItem = null;
    this._renderAll();
    this._saveState(this._registry);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Vente d'un pokémon
  // ─────────────────────────────────────────────────────────────────────────
  _sell() {
    if (!this._selectedCard) return;
    const { pokemon, source, col, row, idx } = this._selectedCard;
    const price = this._sellPrice(pokemon);

    // Remet l'objet équipé dans l'inventaire
    if (pokemon.heldItem) addToInventory(this._registry, pokemon.heldItem.id);

    if (source === 'field') this._field[col][row] = null;
    else this._bank[idx] = null;

    addCoins(this._registry, price);
    this._selectedCard = null;
    this._clearSpider();
    this._renderAll();
    this._saveState(this._registry);
  },

  // Déséquipe l'objet du pokémon sélectionné
  _unequip() {
    if (!this._selectedCard) return;
    const { pokemon, source, col, row, idx } = this._selectedCard;
    if (!pokemon.heldItem) return;

    addToInventory(this._registry, pokemon.heldItem.id);
    const updated = { ...pokemon, heldItem: null };

    if (source === 'field') {
      this._field[col][row] = updated;
      this._selectedCard.pokemon = updated;
    } else {
      this._bank[idx] = updated;
      this._selectedCard.pokemon = updated;
    }

    this._renderAll();
    this._saveState(this._registry);
  },

  // Rendu du bloc passif de niveau dans l'action bar
  _renderPassiveBlock(pokemon) {
    const meta = SaveManager?.loadMeta() ?? {};
    const lvl  = meta.pokemonLevels?.[pokemon.id] ?? 1;
    const all  = window.__POKEMON_PASSIVES__?.[pokemon.id];
    if (!all) return '';

    const blocks = [];

    // Passif Nv.35
    if (lvl >= 35 && all[35]) {
      blocks.push(`
        <div class="prep-passive-block">
          <div class="prep-passive-title">
            <span class="prep-passive-icon">✨</span>
            <span class="prep-passive-name">${all[35].name}</span>
            <span class="prep-passive-level">Nv.35</span>
          </div>
          <p class="prep-passive-desc">${all[35].desc}</p>
        </div>`);
    } else if (all[35]) {
      blocks.push(`
        <div class="prep-passive-block locked">
          <span class="prep-passive-icon">🔒</span>
          <span class="prep-passive-hint">Passif débloqué au Nv.35</span>
        </div>`);
    }

    // Passif Nv.70
    if (lvl >= 70 && all[70]) {
      blocks.push(`
        <div class="prep-passive-block">
          <div class="prep-passive-title">
            <span class="prep-passive-icon">✨</span>
            <span class="prep-passive-name">${all[70].name}</span>
            <span class="prep-passive-level">Nv.70</span>
          </div>
          <p class="prep-passive-desc">${all[70].desc}</p>
        </div>`);
    } else if (all[70]) {
      blocks.push(`
        <div class="prep-passive-block locked">
          <span class="prep-passive-icon">🔒</span>
          <span class="prep-passive-hint">Passif débloqué au Nv.70</span>
        </div>`);
    }

    return blocks.join('');
  },

  // Vend l'objet tenu par le pokémon sélectionné (moitié du prix d'achat)
  async _sellItem() {
    if (!this._selectedCard) return;
    const { pokemon, source, col, row, idx } = this._selectedCard;
    if (!pokemon?.heldItem) return;
    const item      = pokemon.heldItem;
    const sellMult  = RelicEngine.sellMult(getRunState(this._registry)?.relic?.id);
    const sellPrice = Math.max(0, Math.floor((item.price ?? 4) * sellMult));
    const ok = await (window.UIManager?.confirm?.({
      icon:    item.emoji ?? '💰',
      title:   `Vendre ${item.name} ?`,
      message: `Tu récupéreras <strong>${sellPrice} 💰</strong>.`,
      yesLabel: 'Vendre',
      noLabel:  'Annuler',
    }) ?? Promise.resolve(confirm(`Vendre ${item.name} pour ${sellPrice} 💰 ?`)));
    if (!ok) return;
    addCoins(this._registry, sellPrice);

    // Met à jour l'unité dans field ou bank
    const updated = { ...pokemon, heldItem: null };
    if (source === 'field') {
      this._field[col][row] = updated;
      this._selectedCard.pokemon = updated;
    } else {
      this._bank[idx] = updated;
      this._selectedCard.pokemon = updated;
    }

    this._renderAll();
    this._saveState(this._registry);
  },

  _sellPrice(pokemon) {
    // Prix de revente selon tier : T1=0, T2=1, T3=2, T4=3, T5=4
    const SELL = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
    return SELL[getBSTTier(pokemon)] ?? 1;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Synergies
  // ─────────────────────────────────────────────────────────────────────────
  _renderSynergies() {
    const container = document.getElementById('prep-synergies');
    if (!container) return;
    container.innerHTML = '';

    const units     = this._getAllFieldUnits();
    const relicId   = getRunState(this._registry)?.relic?.id;
    const synergies = getActiveSynergies(units, relicId);

    if (synergies.length === 0) {
      container.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Aucune</span>';
      return;
    }

    const STAT_LABELS = { hp:'❤️ HP', atk:'⚔️ ATK', def:'🛡️ DEF',
                          spa:'🔮 SP.ATK', spd_def:'💎 SP.DEF', spd:'👟 VIT' };
    // Libellés générés depuis statusConstants.js (synchronisés avec le moteur)
    const EFFECT_LABELS = EFFECT_LABELS_SHORT;

    synergies.slice(0, 8).forEach(syn => {
      const badge = document.createElement('span');
      badge.className = 'synergy-badge';
      badge.style.background = hexToCSS(syn.color);

      // Détail des bonus stats
      const bonusLines = Object.entries(syn.statBonus ?? {}).map(([stat, mult]) => {
        const pct = Math.round((mult - 1) * 100);
        if (relicId === 'miroir') {
          const boosted = Math.round(pct * 1.5);
          const extra   = boosted - pct;
          return `${STAT_LABELS[stat] ?? stat} +${boosted}% (+${pct}+${extra}%) 🪞`;
        }
        return `${STAT_LABELS[stat] ?? stat} +${pct}%`;
      }).join('<br>');

      const effectLine = syn.effect
        ? `<span style="color:#ffd700">${EFFECT_LABELS[syn.effect] ?? syn.effect}</span>`
        : '';

      const tierLabel = syn.tier === 3 ? '3★' : syn.tier === 2 ? '2★' : '1★';
      const tooltipHtml = `
        <div class="pop-title">${syn.icon} ${syn.type} — ${tierLabel}</div>
        <div style="color:var(--text-muted);font-size:10px;margin-bottom:4px">${syn.count} coins réunis</div>
        ${bonusLines}
        ${effectLine ? `<br>${effectLine}` : ''}
      `;
      badge.innerHTML = `${syn.icon} ${syn.type} ${'★'.repeat(syn.tier)}`;
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.UIManager?.showPopover) window.UIManager.showPopover(badge, tooltipHtml);
      });
      container.appendChild(badge);
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Inventaire
  // ─────────────────────────────────────────────────────────────────────────
  _renderInventory() {
    const container = document.getElementById('prep-inventory');
    if (!container) return;
    container.innerHTML = '';

    const inv = getInventory(this._registry);

    if (inv.length === 0) {
      container.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Vide</span>';
      return;
    }

    inv.forEach((itemId, i) => {
      const item = ITEMS[itemId];
      if (!item) return;

      const slot = document.createElement('div');
      slot.className = `inventory-slot${this._selectedItem?._invIdx === i ? ' selected' : ''}`;
      slot.title     = `${item.name} : ${item.description}`;
      slot.textContent = item.emoji;
      slot.draggable   = true;   // ← draggable

      // Clic → sélectionne l'objet (pour équiper via clic sur pokémon)
      slot.addEventListener('click', () => {
        if (this._selectedItem?._invIdx === i) {
          this._selectedItem = null;
        } else {
          this._selectedItem = { ...item, _invIdx: i };
          this._selectedCard = null;
        }
        this._renderAll();
      });

      // Drag start → mémorise l'objet draggé
      slot.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        this._draggedItem = { ...item, _invIdx: i };
      });

      slot.addEventListener('dragend', () => {
        this._draggedItem = null;
      });

      container.appendChild(slot);
    });

    if (this._selectedItem) {
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size:10px;color:var(--color-gold);width:100%;margin-top:4px;display:block';
      hint.textContent   = `${this._selectedItem.emoji} Glissez sur un pokémon ou cliquez-le`;
      container.appendChild(hint);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Barre d'action
  // ─────────────────────────────────────────────────────────────────────────
  _renderActionBar() {
    const bar = document.getElementById('prep-action-bar');
    if (!bar) return;

    if (!this._selectedCard) {
      bar.classList.add('hidden');
      bar.innerHTML = '';
      return;
    }

    bar.classList.remove('hidden');
    const { pokemon } = this._selectedCard;
    const price = this._sellPrice(pokemon);

    const move = getMove(pokemon.id);

    // ── Bloc détail de la capacité ultime ────────────────────────────────
    let moveBlock = '';
    if (move) {
      const CAT   = { physical:'⚔️ Physique', special:'🔮 Spécial', status:'✨ Statut' };
      const TGTS  = {
        single:'1 cible',       all_enemies:'Tous ennemis',
        row_front:'Rangée av.', row_back:'Rangée arr.',
        all_allies:'Alliés',    self:'Soi-même',
        bounce_2:'Rebond ×2',   back_row_prio:'Rang. arr. prio.',
        random_2:'2 aléatoires',column:'Colonne',
        primary_adj:'+adjacents',nearest_2:'2 proches',
        random_3:'3 aléatoires',
      };
      const effects = (move.effects ?? []).map(e => {
        const icons = {burn:'🔥',poison:'☠️',paralyze:'⚡',freeze:'❄️',sleep:'💤',confuse:'😵',stun:'🔒'};
        const se = { hp:'❤️',atk:'⚔️',def:'🛡️',spa:'🔮',spd_def:'💎',spd:'👟' };
        if (e.kind==='status') return `${icons[e.status]??''}${e.chance<1?` ${Math.round(e.chance*100)}%`:' garanti'}`;
        if (e.kind==='stat' && e.mult>1) return `${e.who==='self'?'Soi':'Cible'} ${se[e.stat]??e.stat}▲${Math.round((e.mult-1)*100)}%${e.permanent?' perm':''}`;
        if (e.kind==='stat' && e.mult<1) return `${e.who==='self'?'Soi':'Cible'} ${se[e.stat]??e.stat}▼${Math.round((1-e.mult)*100)}%${e.permanent?' perm':''}`;
        if (e.kind==='heal')    return `💚 Soin ${Math.round(e.rate*100)}%`;
        if (e.kind==='ko')      return `☠ KO ${Math.round(e.chance*100)}%`;
        if (e.kind==='sacrifice') return '💥 Sacrifice';
        if (e.kind==='shield')  return '🛡 Bouclier alliés';
        if (e.kind==='clear_buffs') return '🌀 Reset buffs ennemis';
        if (e.kind==='push_back')   return '⬅ Repousse';
        if (e.kind==='skip_next')   return '⏭ Skip 1 tour';
        if (e.kind==='untargetable') return '🌫 Intouchable';
        return '';
      }).filter(Boolean).join(' · ');

      const bp     = move.bp > 0 ? Math.round(move.bp * (move.powerMult ?? 1)) : null;
      const hits   = move.hits > 1 ? `×${move.hits}` : move.hitsRandom ? `×${move.hitsRandom[0]}-${move.hitsRandom[1]}` : null;
      const tags   = [
        bp    ? `💥 ${bp}`              : null,
        CAT[move.cat],
        TGTS[move.target] ?? move.target,
        hits,
        move.drain  ? `🩸 Drain ${Math.round(move.drain*100)}%`   : null,
        move.recoil ? `💥 Recul ${Math.round(move.recoil*100)}%`  : null,
      ].filter(Boolean).map(t => `<span class="prep-move-tag">${t}</span>`).join('');

      moveBlock = `
        <div class="prep-move-block" style="border-color:${typeColor(move.type)}">
          <div class="prep-move-title">
            <span style="color:${typeColor(move.type)};font-weight:700;font-size:12px">⚡ ${move.name}</span>
            <span class="prep-move-type-badge" style="background:${typeColor(move.type)}">${move.type}</span>
          </div>
          <div class="prep-move-tags">${tags}</div>
          ${effects ? `<div class="prep-move-effects">${effects}</div>` : ''}
        </div>`;
    }

    bar.innerHTML = `
      <div class="action-info-block">
        <div class="action-info-header">
          <strong>${pokemon.name}</strong>
          <span style="font-size:10px;color:var(--text-muted)">[${pokemon.types.join('/')}]</span>
          ${pokemon.heldItem ? `<span style="font-size:11px">${pokemon.heldItem.emoji} ${pokemon.heldItem.name}</span>` : ''}
        </div>
        ${moveBlock}
        ${this._renderPassiveBlock(pokemon)}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;align-self:flex-start">
        ${pokemon.heldItem ? `
          <button class="btn-unequip" id="btn-prep-unequip">
            ${pokemon.heldItem.emoji} Retirer
          </button>
          <button class="btn-sell btn-sell-item" id="btn-prep-sell-item">
            Vendre objet ${Math.max(0, Math.floor((pokemon.heldItem.price ?? 4) / 2))} 💰
          </button>
        ` : ''}
        <button class="btn-sell" id="btn-prep-sell">
          Vendre ${price} 💰
        </button>
      </div>
    `;

    document.getElementById('btn-prep-sell')
      ?.addEventListener('click', () => this._sell());

    document.getElementById('btn-prep-unequip')
      ?.addEventListener('click', () => this._unequip());

    document.getElementById('btn-prep-sell-item')
      ?.addEventListener('click', () => this._sellItem());
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Toile d'araignée SVG
  // ─────────────────────────────────────────────────────────────────────────
  _drawSpider(pokemon) {
    const svg = document.getElementById('prep-spider');
    if (!svg) return;

    const cx = 100, cy = 100, R = 70;

    // Collecte les unités du terrain pour les synergies
    const fieldUnits = [];
    for (let c = 0; c < (this._field?.length ?? 0); c++)
      for (let r = 0; r < (this._field[c]?.length ?? 0); r++)
        if (this._field[c][r]) fieldUnits.push(this._field[c][r]);

    // Trois niveaux de stats
    const metaLvl = window.SaveManager?.loadMeta() ?? null;
    const relicId = getRunState(this._registry)?.relic?.id ?? null;
    const talentEffects = getActiveTalentEffects(metaLvl);
    const full    = getFullStats(pokemon, fieldUnits, metaLvl, relicId, talentEffects);
    const { base, withItem, withSynergy, withTalent, itemBoosted, synergyBoosted, talentBoosted, synColor } = full;

    const hasSynColor    = !!synColor;
    const hasItemBoost   = itemBoosted.size > 0;
    const hasAnyBoost    = hasItemBoost || synergyBoosted.size > 0;

    // Stat offensive dominante sur les stats FINALES
    const dominantOffense = (withSynergy.spa ?? 0) >= (withSynergy.atk ?? 0) ? '🔮' : '⚔️';
    const pLevelSvg       = metaLvl?.pokemonLevels?.[pokemon.id] ?? 1;

    const axes = [
      { emoji: '❤️',  key: 'hp',      baseV: base.hp,              itemV: withItem.hp,              synV: withSynergy.hp,              talV: withTalent.hp,              max: 250, angle: -90  },
      { emoji: '🔮',  key: 'spa',     baseV: base.spa  ?? base.atk, itemV: withItem.spa  ?? withItem.atk, synV: withSynergy.spa  ?? withSynergy.atk, talV: withTalent.spa  ?? withTalent.atk, max: 154, angle: -30  },
      { emoji: '💎',  key: 'spd_def', baseV: base.spd_def ?? base.def, itemV: withItem.spd_def ?? withItem.def, synV: withSynergy.spd_def ?? withSynergy.def, talV: withTalent.spd_def ?? withTalent.def, max: 130, angle: 30  },
      { emoji: '👟',  key: 'spd',     baseV: base.spd,              itemV: withItem.spd,             synV: withSynergy.spd,             talV: withTalent.spd,             max: 150, angle:  90  },
      { emoji: '🛡️',  key: 'def',     baseV: base.def,              itemV: withItem.def,             synV: withSynergy.def,             talV: withTalent.def,             max: 180, angle: 150 },
      { emoji: '⚔️',  key: 'atk',     baseV: base.atk,              itemV: withItem.atk,             synV: withSynergy.atk,             talV: withTalent.atk,             max: 134, angle: 210 },
    ];

    // Rétrocompatibilité : ax.value = stat finale (talents inclus), ax.base = stat de base
    axes.forEach(ax => { ax.value = ax.talV ?? ax.synV; ax.base = ax.baseV; });

    // ── Décomposition détaillée par stat (pour le popover au clic) ────────────
    // base → +niveau → +objet → +synergies
    const levelMult = pLevelSvg > 1 ? 1 + (pLevelSvg - 1) * 0.005 : 1;
    const heldItemName = pokemon.heldItem?.name ?? null;
    // Synergies actives qui boostent chaque stat
    const activeSyns = getActiveSynergies(fieldUnits.filter(Boolean), relicId);
    const synOriginFor = (statKey) => {
      const origins = [];
      activeSyns.forEach(syn => {
        if (syn.statBonus && syn.statBonus[statKey] && syn.statBonus[statKey] !== 1) {
          origins.push(`${syn.type} ×${syn.count}`);
        }
      });
      return origins;
    };
    // Talents qui boostent une stat donnée pour les types de ce pokémon
    const talentOriginFor = (statKey) => {
      const names = [];
      (talentEffects ?? []).forEach(e => {
        if (!e || !(pokemon.types ?? []).includes(e.type)) return;
        const hits =
          (e.kind === 'type_stat' && e.stat === statKey) ||
          (e.kind === 'type_dual_stat' && (e.stats ?? []).includes(statKey)) ||
          (e.kind === 'type_boost_highest') ||
          (e.kind === 'type_stack_per_type') ||
          (e.kind === 'type_stack_per_ally');
        if (hits) names.push(e._name ?? e.type);
      });
      return names.length ? names.join(', ') : '';
    };
    this._statBreakdowns = {};
    const STAT_NAMES = { hp:'❤️ PV', atk:'⚔️ Attaque', spa:'🔮 Atq. Spé.',
      def:'🛡️ Défense', spd_def:'💎 Déf. Spé.', spd:'👟 Vitesse' };
    axes.forEach(ax => {
      const afterLevel = Math.round(ax.baseV * levelMult);
      const levelDelta = afterLevel - ax.baseV;
      const itemDelta  = ax.itemV - afterLevel;
      const synDelta   = ax.synV - ax.itemV;
      const talDelta   = (ax.talV ?? ax.synV) - ax.synV;
      const rows = [`<div class="pop-row"><span>Base</span><span>${ax.baseV}</span></div>`];
      if (levelDelta !== 0)
        rows.push(`<div class="pop-row"><span>+${levelDelta} <span class="pop-origin">(Niv. ${pLevelSvg})</span></span></div>`);
      if (itemDelta !== 0 && heldItemName)
        rows.push(`<div class="pop-row"><span>+${itemDelta} <span class="pop-origin">(${heldItemName})</span></span></div>`);
      else if (itemDelta !== 0)
        rows.push(`<div class="pop-row"><span>+${itemDelta} <span class="pop-origin">(objet)</span></span></div>`);
      if (synDelta !== 0) {
        const origins = synOriginFor(ax.key);
        const label   = origins.length ? origins.join(', ') : 'synergie';
        rows.push(`<div class="pop-row"><span>+${synDelta} <span class="pop-origin">(${label})</span></span></div>`);
      }
      if (talDelta !== 0) {
        const tl = talentOriginFor(ax.key);
        rows.push(`<div class="pop-row"><span>+${talDelta} <span class="pop-origin" style="color:#a29bfe">(talent ${tl})</span></span></div>`);
      }
      rows.push(`<div class="pop-row pop-total"><span>Total</span><span>${ax.talV ?? ax.synV}</span></div>`);
      this._statBreakdowns[ax.key] =
        `<div class="pop-title">${STAT_NAMES[ax.key] ?? ax.key}</div>${rows.join('')}`;
    });

    const toRad = d => d * Math.PI / 180;

    const ptsBase = axes.map(ax => ({
      x: cx + R * Math.min(ax.baseV / ax.max, 1) * Math.cos(toRad(ax.angle)),
      y: cy + R * Math.min(ax.baseV / ax.max, 1) * Math.sin(toRad(ax.angle)),
    }));
    const ptsItem = axes.map(ax => ({
      x: cx + R * Math.min(ax.itemV / ax.max, 1) * Math.cos(toRad(ax.angle)),
      y: cy + R * Math.min(ax.itemV / ax.max, 1) * Math.sin(toRad(ax.angle)),
    }));
    const pts = axes.map(ax => ({
      x: cx + R * Math.min(ax.value / ax.max, 1) * Math.cos(toRad(ax.angle)),
      y: cy + R * Math.min(ax.value / ax.max, 1) * Math.sin(toRad(ax.angle)),
    }));

    // Aliases pour la suite
    const basePts = ptsBase;
    const hasItem = hasItemBoost;
    const isBoosted = ax => hasItemBoost && ax.itemV > ax.baseV;

    // Couleur de synergies — déclarée ici pour être accessible dans labels et dots
    const finalColor   = hasSynColor ? synColor : '#4a90d9';
    const finalOpacity = hasSynColor ? '0.25'   : '0.20';
    const finalStrokeW = hasSynColor ? '2.0'    : '1.5';

    // Grille hexagonale
    let gridLines = '';
    [0.33, 0.66, 1.0].forEach(ratio => {
      const gpts = axes.map(ax => ({
        x: cx + R * ratio * Math.cos(toRad(ax.angle)),
        y: cy + R * ratio * Math.sin(toRad(ax.angle)),
      }));
      const d = gpts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';
      gridLines += `<path d="${d}" fill="none" stroke="#334466" stroke-width="${ratio === 1 ? 0.8 : 0.4}" opacity="${ratio === 1 ? 0.7 : 0.3}"/>`;
    });

    // Axes radiaux
    const radialLines = axes.map(ax =>
      `<line x1="${cx}" y1="${cy}"
             x2="${(cx + R * Math.cos(toRad(ax.angle))).toFixed(1)}"
             y2="${(cy + R * Math.sin(toRad(ax.angle))).toFixed(1)}"
             stroke="#4a5568" stroke-width="0.5" opacity="0.5"/>`
    ).join('');

    // Polygone de base (fantôme semi-transparent si objet équipé)
    const basePolyPts = basePts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const basePolygon = hasItem
      ? `<polygon points="${basePolyPts}" fill="#4a90d9" fill-opacity="0.08"
                  stroke="#4a90d9" stroke-width="1" stroke-dasharray="3 2" opacity="0.4"/>`
      : '';

    // Polygone effectif
    const polyPts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Tailles adaptatives mobile — les labels débordent via overflow:visible
    // La toile reste 120px, seuls les textes sortent légèrement
    const isMobile  = window.innerWidth <= 768;
    const emojiSize = isMobile ? 38 : 13;
    const valSize   = isMobile ? 66 : 11;
    const labelDist = isMobile ? 12 : 18;  // très proche de la toile sur mobile

    // Icônes + valeurs
    // Priorité couleur : Doré (dominant) > Type (synergies) > Vert (item) > Gris
    const labels = axes.map(ax => {
      const dist       = R + labelDist;
      const lx         = cx + dist * Math.cos(toRad(ax.angle));
      const ly         = cy + dist * Math.sin(toRad(ax.angle));
      const isMain     = ax.emoji === dominantOffense;
      const isSynBoost = synergyBoosted.has(ax.key);
      const isItmBoost = isBoosted(ax);
      const isBoostedAny = isSynBoost || isItmBoost;

      const valColor = isMain ? '#ffd700' : isSynBoost ? finalColor : isItmBoost ? '#55efc4' : '#a0aec0';

      // Affiche UNIQUEMENT le total final (le détail est dans le popover au clic)
      const valueStr = `${ax.value}`;

      const bgColor  = isMain ? '#ffd700' : isSynBoost ? finalColor : '#55efc4';
      const bgOpFill = isMain ? '0.12' : isSynBoost ? '0.12' : '0.08';
      const bgOpStr  = isMain ? '0.6'  : isSynBoost ? '0.55' : '0.5';
      const bgRect   = isBoostedAny || isMain
        ? `<rect x="${(lx - 10).toFixed(1)}" y="${(ly - 15).toFixed(1)}"
                width="20" height="22" rx="4"
                fill="${bgColor}" fill-opacity="${bgOpFill}"
                stroke="${bgColor}" stroke-width="0.8" stroke-opacity="${bgOpStr}"/>`
        : '';

      // Zone cliquable transparente (pour ouvrir le popover de détail)
      const hitRect = `<rect x="${(lx - 12).toFixed(1)}" y="${(ly - 16).toFixed(1)}"
              width="24" height="26" rx="4" fill="transparent"
              style="cursor:pointer" data-stat-popover="${ax.key}"/>`;

      return `
        ${bgRect}
        <text x="${lx.toFixed(1)}" y="${(ly - 6).toFixed(1)}"
              text-anchor="middle" font-size="${emojiSize}" dominant-baseline="middle"
              style="pointer-events:none">${ax.emoji}</text>
        <text x="${lx.toFixed(1)}" y="${(ly + 8).toFixed(1)}"
              text-anchor="middle" font-size="${valSize}" fill="${valColor}"
              font-weight="${isMain || isBoostedAny ? 'bold' : 'normal'}"
              dominant-baseline="middle" style="pointer-events:none">${valueStr}</text>
        ${hitRect}
      `;
    }).join('');

    // Points sur les sommets
    // Doré = stat offensive dominante | Synergies = couleur type | Vert = item | Bleu = normal
    const dots = axes.map((ax, i) => {
      const p          = pts[i];
      const isMain     = ax.emoji === dominantOffense;
      const isSynBoost = synergyBoosted.has(ax.key);
      const isItemOnly = isBoosted(ax) && !isSynBoost;

      if (isMain) {
        // Doré (priorité max)
        const outerRing = isSynBoost
          ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7"
                     fill="none" stroke="${finalColor}" stroke-width="1" opacity="0.5"/>`
          : '';
        return `
          ${outerRing}
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5"
                  fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.8"/>
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#ffd700"/>
        `;
      }
      if (isSynBoost) {
        // Couleur de type (synergies)
        return `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6"
                  fill="none" stroke="${finalColor}" stroke-width="1.5" opacity="0.6"/>
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${finalColor}"/>
        `;
      }
      if (isItemOnly) {
        return `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5"
                  fill="none" stroke="#55efc4" stroke-width="1.2" opacity="0.7"/>
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#55efc4"/>
        `;
      }
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="#74b9ff"/>`;
    }).join('');

    // ── Polygone item (niveau intermédiaire) ─────────────────────────────
    const itemPolyPts  = ptsItem.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const itemPolygon  = (hasItemBoost && synergyBoosted.size > 0)
      ? `<polygon points="${itemPolyPts}" fill="#4a90d9" fill-opacity="0.15"
                  stroke="#4a90d9" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.6"/>`
      : '';

    svg.innerHTML = `
      ${gridLines}
      ${radialLines}
      ${basePolygon}
      ${itemPolygon}
      <polygon points="${polyPts}" fill="${finalColor}" fill-opacity="${finalOpacity}"
               stroke="${finalColor}" stroke-width="${finalStrokeW}"/>
      ${dots}
      ${labels}

    `;

    // Attache les handlers de clic sur les zones de stats → popover de détail
    svg.querySelectorAll('[data-stat-popover]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = el.getAttribute('data-stat-popover');
        const html = this._statBreakdowns?.[key];
        if (html && window.UIManager?.showPopover) {
          window.UIManager.showPopover(el, html);
        }
      });
    });
  },

  _clearSpider() {
    const svg = document.getElementById('prep-spider');
    if (svg) svg.innerHTML = '';
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Évolution
  // ─────────────────────────────────────────────────────────────────────────
  _checkEvolution() {
    const units  = this._getAllFieldUnits();
    const counts = {};
    units.forEach(u => { counts[u.id] = (counts[u.id] ?? 0) + 1; });

    for (const [idStr, count] of Object.entries(counts)) {
      const id = parseInt(idStr);
      if (count >= 2 && canEvolve(id)) {
        this._proposeEvolution(id);
        return;
      }
    }
  },

  _proposeEvolution(baseId) {
    // Évoli (133) : choix entre Aquali / Voltali / Pyroli
    if (baseId === 133) {
      this._proposeEeveeEvolution();
      return;
    }

    const evoId   = getEvolutionId(baseId);
    const evoPok  = POKEMONS.find(p => p.id === evoId);
    const basePok = POKEMONS.find(p => p.id === baseId);
    if (!evoPok || !basePok) return;

    // Popup HTML natif
    const popup = document.createElement('div');
    popup.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.7);
      display:flex;align-items:center;justify-content:center;z-index:500
    `;
    popup.innerHTML = `
      <div style="background:var(--bg-base);border:2px solid var(--color-gold);
                  border-radius:14px;padding:32px;text-align:center;max-width:320px">
        <p style="font-size:18px;color:var(--color-gold);font-weight:700;margin-bottom:8px">
          ✨ Évolution disponible !
        </p>
        <p style="color:var(--text-primary);margin-bottom:4px">
          ${basePok.name} → ${evoPok.name}
        </p>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:24px">
          Les 2 exemplaires fusionnent en 1 pokémon évolué.
        </p>
        <div style="display:flex;gap:16px;justify-content:center">
          <button id="evo-yes" class="btn-success">✅ Évoluer</button>
          <button id="evo-no" class="btn-ghost">✕ Annuler</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    document.getElementById('evo-yes').addEventListener('click', () => {
      popup.remove();
      this._evolve(baseId, evoId);
    });
    document.getElementById('evo-no').addEventListener('click', () => {
      popup.remove();
    });
  },

  // ── Évolution d'Évoli : choix entre Aquali / Voltali / Pyroli ──────────────
  _proposeEeveeEvolution() {
    const CHOICES = [
      { id: 134, name: 'Aquali',  type: 'Eau',      icon: '💧', color: '#3498db' },
      { id: 135, name: 'Voltali', type: 'Électrik', icon: '⚡', color: '#f1c40f' },
      { id: 136, name: 'Pyroli',  type: 'Feu',      icon: '🔥', color: '#e74c3c' },
    ];

    const popup = document.createElement('div');
    popup.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.75);
      display:flex;align-items:center;justify-content:center;z-index:500;padding:16px
    `;

    const cardsHtml = CHOICES.map(c => {
      const pok = POKEMONS.find(p => p.id === c.id);
      return `
        <button class="evo-choice-card" data-evo="${c.id}"
          style="background:var(--bg-card,#0f3460);border:2px solid ${c.color};
                 border-radius:12px;padding:12px 8px;cursor:pointer;display:flex;
                 flex-direction:column;align-items:center;gap:4px;min-width:90px;
                 transition:transform 0.12s,box-shadow 0.12s">
          <img src="${pok?.spriteUrl ?? ''}" alt="${c.name}"
               style="width:64px;height:64px;image-rendering:pixelated;pointer-events:none"
               onerror="this.style.display='none'" />
          <span style="font-weight:700;color:#e2e8f0;font-size:13px;pointer-events:none">${c.name}</span>
          <span style="font-size:11px;color:${c.color};pointer-events:none">${c.icon} ${c.type}</span>
        </button>`;
    }).join('');

    popup.innerHTML = `
      <div style="background:var(--bg-base,#1a1a2e);border:2px solid var(--color-gold,#ffd700);
                  border-radius:14px;padding:24px 20px;text-align:center;max-width:360px;width:100%">
        <p style="font-size:18px;color:var(--color-gold,#ffd700);font-weight:700;margin:0 0 4px">
          ✨ Évolution d'Évoli
        </p>
        <p style="font-size:12px;color:var(--text-muted,#a0aec0);margin:0 0 18px">
          Choisis la forme d'évolution (les 2 Évoli fusionnent).
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          ${cardsHtml}
        </div>
        <button id="evo-cancel" class="btn-ghost" style="margin-top:18px">✕ Annuler</button>
      </div>
    `;
    document.body.appendChild(popup);

    popup.querySelectorAll('.evo-choice-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const evoId = parseInt(btn.dataset.evo);
        popup.remove();
        this._evolve(133, evoId);
      });
    });
    document.getElementById('evo-cancel').addEventListener('click', () => popup.remove());
  },

  _evolve(baseId, evoId) {
    const evoPok = POKEMONS.find(p => p.id === evoId);
    if (!evoPok) return;

    let replaced = false;
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const u = this._field[c][r];
        if (u?.id === baseId) {
          if (!replaced) {
            const anomalyTypes = getRunState(this._registry)?.anomalyTypes;
          const evoTypes = anomalyTypes?.[evoId] ?? evoPok.types;
          const evolved = {
              ...evoPok, col: c, row: r,
              uid: u.uid, heldItem: u.heldItem ?? null,
              isInTeam: true, attributes: [],
              types: evoTypes,
            };
            // Re-tirage des coins à l'évolution (selon les nouveaux types)
            evolved.corners = assignCorners(evolved);
            this._field[c][r] = evolved;
            replaced = true;
          } else {
            // Remet l'objet du 2e exemplaire dans l'inventaire
            if (u.heldItem) addToInventory(this._registry, u.heldItem.id);
            this._field[c][r] = null;
          }
        }
      }
    }
    this._renderAll();
    this._saveState(this._registry);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Boutons fermer / valider
  // ─────────────────────────────────────────────────────────────────────────
  _bindCloseButton() {
    const btn = document.getElementById('btn-close-prep');
    if (!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      this._saveState(this._registry);
      document.getElementById('overlay-prep')?.classList.add('hidden');
    });
  },

  _bindValidateButton() {
    const btn = document.getElementById('btn-validate-team');
    if (!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      this._saveState(this._registry);
      document.getElementById('overlay-prep')?.classList.add('hidden');
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Utilitaires
  // ─────────────────────────────────────────────────────────────────────────
  _getAllFieldUnits() {
    const units = [];
    for (let c = 0; c < GRID_COLS; c++)
      for (let r = 0; r < GRID_ROWS; r++)
        if (this._field[c][r]) units.push(this._field[c][r]);
    const result  = applyAnomalyToUnits(units, this._registry);
    const relicId = getRunState(this._registry)?.relic?.id ?? null;
    // Marque Miroir et Couronne sur les unités pour getFullStats
    if (relicId === 'couronne' && result.length) {
      const bst = u => (u.stats?.hp??0)+(u.stats?.atk??0)+(u.stats?.spa??0)+
                       (u.stats?.def??0)+(u.stats?.spd_def??0)+(u.stats?.spd??0);
      const topId = [...result].sort((a,b) => bst(b)-bst(a))[0]?.id;
      result.forEach(u => { u._doubleSynergyBonus = u.id === topId; });
    }
    result.forEach(u => { u._relicId = relicId; });
    return result;
  },

  _updateBankLabel() {
    const label = document.getElementById('prep-bank-label');
    if (label) label.textContent =
      `Banque (${this._bank.filter(Boolean).length}/${BANK_MAX_SIZE})`;
  },

  _renderAll() {
    this._renderField();
    this._renderBank();
    this._renderSynergies();
    this._renderInventory();
    this._renderActionBar();
    this._updateBankLabel();
  },
};