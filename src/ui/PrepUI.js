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
import { getBSTTier }                   from '../data/runState.js';
import { getRunState, setRunState,
         addCoins, addToInventory,
         removeFromInventory, getInventory,
         BANK_MAX_SIZE, getUnlockedSlots } from '../data/runState.js';
import { ITEMS }                         from '../data/items.js';
import { getActiveSynergies, getFullStats }  from '../data/synergies.js';
import { getLevelBadgeHTML, getLevelBonus }  from '../data/levelSystem.js';
import { getMove }                           from '../data/moves.js';
import { canEvolve, getEvolutionId }     from '../data/evolutionData.js';

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

    // Slots numérotés de gauche à droite, rangée 0 en premier :
    // index = r * GRID_COLS + c  (0-5 pour une grille 3×2)
    const unlocked = getUnlockedSlots(this._registry);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const slotIndex = r * GRID_COLS + c;
        const isLocked  = slotIndex >= unlocked;

        if (isLocked) {
          // Slot verrouillé — non interactif
          const locked = document.createElement('div');
          locked.className = 'slot slot-locked';
          locked.innerHTML = `<span class="slot-lock-icon">🔒</span>`;
          locked.dataset.source = 'field';
          locked.dataset.col    = c;
          locked.dataset.row    = r;
          grid.appendChild(locked);
          continue;
        }

        const unit = this._field[c][r];
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
    slot.setAttribute('draggable', !!unit);

    if (unit) {
      // Coins de type
      const c1 = hexToCSS(TC[unit.types[0]] ?? 0x888888);
      const c2 = hexToCSS(TC[unit.types[1]] ?? TC[unit.types[0]] ?? 0x888888);

      // Objet équipé
      const itemHtml = unit.heldItem
        ? `<span class="slot-item">${unit.heldItem.emoji}</span>` : '';

      const meta      = window.SaveManager?.loadMeta() ?? null;
      const unitLevel = meta?.pokemonLevels?.[unit.id] ?? 1;

      slot.innerHTML = `
        <span class="type-corner tl" style="border-color:${c1} transparent transparent transparent"></span>
        <span class="type-corner tr" style="border-color:transparent ${c2} transparent transparent"></span>
        <span class="type-corner bl" style="border-color:transparent transparent transparent ${c1}"></span>
        <span class="type-corner br" style="border-color:transparent transparent ${c2} transparent"></span>
        <img src="${unit.spriteUrl}" alt="${unit.name}"
             onerror="this.src='assets/placeholder.png'" />
        <span class="slot-name">${unit.name}</span>
        ${unitLevel > 1 ? getLevelBadgeHTML(unitLevel) : ''}
        ${itemHtml}
      `;
    } else {
      slot.innerHTML = `<span class="slot-plus">+</span>`;
    }

    // Événements
    slot.addEventListener('click', onClick);

    if (onDragStart) {
      slot.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      });
    }
    if (onDragOver) {
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        slot.classList.add('drag-over');
        onDragOver();
      });
      slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over');
      });
    }
    // Réception du drop d'objet inventaire
slot.addEventListener('dragover', (e) => {
  e.preventDefault();
  // Accepte aussi bien le drop pokémon que le drop objet
  e.dataTransfer.dropEffect = 'move';
  if (unit) slot.classList.add('drag-over');
});

slot.addEventListener('drop', (e) => {
  e.preventDefault();
  slot.classList.remove('drag-over');

  // Drop d'un objet inventaire sur un pokémon
  if (this._draggedItem && unit) {
    this._equipItem(this._draggedItem, 
      // Détecte si c'est un slot terrain ou banque depuis l'id du slot
      slot.dataset.source === 'field' ? 'field' : 'bank',
      parseInt(slot.dataset.col ?? 0),
      parseInt(slot.dataset.row ?? 0),
      parseInt(slot.dataset.idx ?? 0)
    );
    this._draggedItem = null;
    return;
  }
  // Drop pokémon → comportement existant
  if (onDrop) onDrop();
  });

  if (onDrop) {
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      onDrop();
    });
  }

    return slot;
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

    // Clic sur un pokémon → affiche ses stats, pas de déplacement
    if (unit) {
      this._selectedCard = { pokemon: unit, source: 'field', col, row };
      this._renderAll();
      this._drawSpider(unit);
    } else {
      // Clic sur slot vide → désélectionne
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

    // Clic → affiche stats uniquement
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

      // Récupère l'occupant actuel de la cible
      const existing = this._field[colOrIdx][row] ?? null;

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
    const synergies = getActiveSynergies(units);

    if (synergies.length === 0) {
      container.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Aucune</span>';
      return;
    }

    const STAT_LABELS = { hp:'❤️ HP', atk:'⚔️ ATK', def:'🛡️ DEF',
                          spa:'🔮 SP.ATK', spd_def:'💎 SP.DEF', spd:'👟 VIT' };
    const EFFECT_LABELS = {
      burn:'🔥 Brûlure ennemie', regen:'💧 Régénération (Eau)',
      poison:'☠️ Empoisonnement', paralyze:'⚡ Paralysie ennemie',
      confuse:'😵 Confusion ennemie', freeze:'❄️ Gel ennemi',
      dodge:'🦅 Esquive 20%', crit:'🎯 Crit +30%',
      swarm:'🦋 Essaim (chaîne)', quake:'🏔 Tremblement',
      curse:'👻 Malédiction', intimidate:'🌑 Intimidation',
      armor:'🛡 Armure', charm:'🧚 Charme (ciblage)',
      rage:'🐉 Rage (+10%/mort)', iron:'⚙️ Armure Acier -20%',
    };

    synergies.slice(0, 8).forEach(syn => {
      const badge = document.createElement('span');
      badge.className = 'synergy-badge';
      badge.style.background = hexToCSS(syn.color);

      // Détail des bonus stats
      const bonusLines = Object.entries(syn.statBonus ?? {}).map(([stat, mult]) => {
        const pct = Math.round((mult - 1) * 100);
        return `${STAT_LABELS[stat] ?? stat} +${pct}%`;
      }).join('<br>');

      const effectLine = syn.effect
        ? `<span style="color:#ffd700">${EFFECT_LABELS[syn.effect] ?? syn.effect}</span>`
        : '';

      badge.innerHTML = `
        ${syn.icon}<span class="synergy-name"> ${syn.type}</span> ${'★'.repeat(syn.tier)}
        <span class="synergy-tooltip">
          <strong>${syn.icon} ${syn.type} — ${syn.tier === 3 ? '3★' : '2★'}</strong>
          <span style="color:var(--text-muted);font-size:9px">${syn.count} pokémons</span>
          <hr style="border-color:var(--border-default);margin:3px 0">
          ${bonusLines}
          ${effectLine ? `<br>${effectLine}` : ''}
        </span>
      `;
      container.appendChild(badge);

      // ── Touch : toggle tooltip au tap sur mobile ─────────────────────────
      // Sur mobile :hover ne se déclenche pas → on gère le tap manuellement
      badge.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        // Ferme tous les autres tooltips ouverts
        document.querySelectorAll('.synergy-badge.tooltip-open')
          .forEach(b => { if (b !== badge) b.classList.remove('tooltip-open'); });
        badge.classList.toggle('tooltip-open');
      }, { passive: true });
    });

    // Ferme le tooltip en tapant ailleurs
    document.addEventListener('touchstart', () => {
      document.querySelectorAll('.synergy-badge.tooltip-open')
        .forEach(b => b.classList.remove('tooltip-open'));
    }, { passive: true });
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
      slot.title     = `${item.name} — ${item.description}`;
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
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;align-self:flex-start">
        ${pokemon.heldItem ? `<button class="btn-unequip" id="btn-prep-unequip">
          ${pokemon.heldItem.emoji} Retirer
        </button>` : ''}
        <button class="btn-sell" id="btn-prep-sell">
          Vendre ${price} 💰
        </button>
      </div>
    `;

    document.getElementById('btn-prep-sell')
      ?.addEventListener('click', () => this._sell());

    document.getElementById('btn-prep-unequip')
      ?.addEventListener('click', () => this._unequip());
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
    const full    = getFullStats(pokemon, fieldUnits, metaLvl);
    const { base, withItem, withSynergy, itemBoosted, synergyBoosted, synColor } = full;

    const hasSynColor    = !!synColor;
    const hasItemBoost   = itemBoosted.size > 0;
    const hasAnyBoost    = hasItemBoost || synergyBoosted.size > 0;

    // Stat offensive dominante sur les stats FINALES
    const dominantOffense = (withSynergy.spa ?? 0) >= (withSynergy.atk ?? 0) ? '🔮' : '⚔️';
    const pLevelSvg       = metaLvl?.pokemonLevels?.[pokemon.id] ?? 1;

    const axes = [
      { emoji: '❤️',  key: 'hp',      baseV: base.hp,              itemV: withItem.hp,              synV: withSynergy.hp,              max: 250, angle: -90  },
      { emoji: '🔮',  key: 'spa',     baseV: base.spa  ?? base.atk, itemV: withItem.spa  ?? withItem.atk, synV: withSynergy.spa  ?? withSynergy.atk, max: 154, angle: -30  },
      { emoji: '💎',  key: 'spd_def', baseV: base.spd_def ?? base.def, itemV: withItem.spd_def ?? withItem.def, synV: withSynergy.spd_def ?? withSynergy.def, max: 130, angle: 30  },
      { emoji: '👟',  key: 'spd',     baseV: base.spd,              itemV: withItem.spd,             synV: withSynergy.spd,             max: 150, angle:  90  },
      { emoji: '🛡️',  key: 'def',     baseV: base.def,              itemV: withItem.def,             synV: withSynergy.def,             max: 180, angle: 150 },
      { emoji: '⚔️',  key: 'atk',     baseV: base.atk,              itemV: withItem.atk,             synV: withSynergy.atk,             max: 134, angle: 210 },
    ];

    // Rétrocompatibilité : ax.value = stat finale, ax.base = stat de base
    axes.forEach(ax => { ax.value = ax.synV; ax.base = ax.baseV; });

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
      x: cx + R * Math.min(ax.synV / ax.max, 1) * Math.cos(toRad(ax.angle)),
      y: cy + R * Math.min(ax.synV / ax.max, 1) * Math.sin(toRad(ax.angle)),
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

    // Icônes + valeurs
    // Priorité couleur : Doré (dominant) > Type (synergies) > Vert (item) > Gris
    const labels = axes.map(ax => {
      const dist       = R + 18;
      const lx         = cx + dist * Math.cos(toRad(ax.angle));
      const ly         = cy + dist * Math.sin(toRad(ax.angle));
      const isMain     = ax.emoji === dominantOffense;
      const isSynBoost = synergyBoosted.has(ax.key);
      const isItmBoost = isBoosted(ax);
      const isBoostedAny = isSynBoost || isItmBoost;

      const valColor = isMain ? '#ffd700' : isSynBoost ? finalColor : isItmBoost ? '#55efc4' : '#a0aec0';

      // Construction de la valeur avec annotations
      let valueStr = `${ax.synV}`;
      if (isSynBoost && ax.synV > ax.itemV) {
        const synDelta = ax.synV - ax.itemV;
        valueStr += ` <tspan fill="${finalColor}" font-size="7">+${synDelta}</tspan>`;
      } else if (isItmBoost && ax.itemV > ax.baseV) {
        const itmDelta = ax.itemV - ax.baseV;
        valueStr += ` <tspan fill="#55efc4" font-size="7">+${itmDelta}</tspan>`;
      }

      const bgColor  = isMain ? '#ffd700' : isSynBoost ? finalColor : '#55efc4';
      const bgOpFill = isMain ? '0.12' : isSynBoost ? '0.12' : '0.08';
      const bgOpStr  = isMain ? '0.6'  : isSynBoost ? '0.55' : '0.5';
      const bgRect   = isBoostedAny || isMain
        ? `<rect x="${(lx - 10).toFixed(1)}" y="${(ly - 15).toFixed(1)}"
                width="20" height="22" rx="4"
                fill="${bgColor}" fill-opacity="${bgOpFill}"
                stroke="${bgColor}" stroke-width="0.8" stroke-opacity="${bgOpStr}"/>`
        : '';

      return `
        ${bgRect}
        <text x="${lx.toFixed(1)}" y="${(ly - 6).toFixed(1)}"
              text-anchor="middle" font-size="13" dominant-baseline="middle">${ax.emoji}</text>
        <text x="${lx.toFixed(1)}" y="${(ly + 8).toFixed(1)}"
              text-anchor="middle" font-size="8" fill="${valColor}"
              font-weight="${isMain || isBoostedAny ? 'bold' : 'normal'}"
              dominant-baseline="middle">${valueStr}</text>
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
      <text x="${cx}" y="${cy}" text-anchor="middle"
            font-size="9" fill="#e2e8f0" dominant-baseline="middle">
        ${pokemon.name}
      </text>
    `;
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

  _evolve(baseId, evoId) {
    const evoPok = POKEMONS.find(p => p.id === evoId);
    if (!evoPok) return;

    let replaced = false;
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const u = this._field[c][r];
        if (u?.id === baseId) {
          if (!replaced) {
            this._field[c][r] = {
              ...evoPok, col: c, row: r,
              uid: u.uid, heldItem: u.heldItem ?? null,
              isInTeam: true, attributes: []
            };
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
    return units;
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
