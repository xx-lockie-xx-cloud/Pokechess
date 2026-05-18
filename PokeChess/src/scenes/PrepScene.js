// ─────────────────────────────────────────────────────────────────────────────
// PrepScene.js — version stabilisée
// Fixes appliqués :
//   Fix 1 : uid unique par pokémon pour éviter les collisions de clé sprite
//   Fix 2 : _refreshAll(save) — sauvegarde uniquement sur vrai changement
//   Fix 3 : sélection sans _refreshAll() — juste visuel, pas de saveState
//   Fix 4 : séparation claire visuel / données / sauvegarde
// ─────────────────────────────────────────────────────────────────────────────

import { TYPE_COLORS, POKEMONS }     from '../data/pokemons.js';
import { GRID_COLS, GRID_ROWS }      from '../board.js';
import { getRunState, setRunState,
         addCoins, BANK_MAX_SIZE }   from '../data/runState.js';
import { canEvolve, getEvolutionId } from '../data/evolutionData.js';
import { getActiveSynergies }        from '../data/synergies.js';
import { Field }                     from '../components/Field.js';

// ── Constantes visuelles ──────────────────────────────────────────────────────
const PANEL_W   = 620;
const PANEL_H   = 460;
const SLOT_SIZE = 64;
const SLOT_GAP  = 6;

// ── Position de la toile d'araignée ───────────────────────────────────────────
// ⚙️  Modifie ces valeurs pour repositionner la toile
const SPIDER_CX_OFFSET = 490;   // décalage horizontal depuis panelX
const SPIDER_CY_OFFSET = 330;   // décalage vertical depuis panelY
const SPIDER_RADIUS    = 52;    // rayon de la toile

export class PrepScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PrepScene' });

    this.playerField  = null;   // composant Field (terrain)
    this.bankSlots    = [];     // [idx] → pokemon | null
    this.selectedCard = null;   // { pokemon, source, sourceCol?, sourceRow?, sourceIdx? }

    // Drag & drop
    this.isDragging   = false;
    this.dragUnit     = null;
    this.dragSource   = null;
    this.dragSprite   = null;

    // Objets Phaser des slots banque
    this.bankObjects  = {};

    // Conteneurs dynamiques
    this.synergyContainer = null;
    this.spiderContainer  = null;
    this.actionBarItems   = [];

    // Référence au label banque (mis à jour dans _refreshBankLabel)
    this.bankLabel = null;

    // Coordonnées du panneau (calculées dans create, réutilisées partout)
    this.panelX = 0;
    this.panelY = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // init()
  // ─────────────────────────────────────────────────────────────────────────
  init() {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);

    this.selectedCard = null;
    this.isDragging   = false;
    this.dragUnit     = null;
    this.dragSource   = null;
    this.bankObjects  = {};
    this.actionBarItems = [];

    // Charge la banque
    const state    = getRunState(this.registry);
    this.bankSlots = Array.from({ length: BANK_MAX_SIZE }, (_, i) =>
      state.playerBank?.[i] ?? null
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // preload()
  // ─────────────────────────────────────────────────────────────────────────
  preload() {
    const playerUnits = this.registry.get('playerUnits') ?? [];
    [...this.bankSlots, ...playerUnits].filter(Boolean).forEach(p => {
      const key = `monster_${p.id}`;
      if (!this.textures.exists(key)) this.load.image(key, p.spriteUrl);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────
  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.panelX = Math.round((W - PANEL_W) / 2);
    this.panelY = Math.round((H - PANEL_H) / 2);
    const { panelX, panelY } = this;

    // ── Fond bloquant ─────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x000000, 0.75)
      .setOrigin(0).setDepth(0).setInteractive();

    // ── Panneau ───────────────────────────────────────────────────────────
    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x1a1a2e, 0.97);
    panel.fillRoundedRect(panelX, panelY, PANEL_W, PANEL_H, 14);
    panel.lineStyle(2, 0x4a90d9, 1);
    panel.strokeRoundedRect(panelX, panelY, PANEL_W, PANEL_H, 14);

    // ── Titre ─────────────────────────────────────────────────────────────
    this.add.text(W / 2, panelY + 14, 'Gestion de l\'équipe', {
      fontSize: '15px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(2);

    // ── Bouton fermer ─────────────────────────────────────────────────────
    this.add.text(panelX + PANEL_W - 14, panelY + 12, '✕', {
      fontSize: '16px', fill: '#718096', fontFamily: 'sans-serif'
    }).setOrigin(1, 0).setDepth(2)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerover', function() { this.setStyle({ fill: '#e2e8f0' }); })
      .on('pointerout',  function() { this.setStyle({ fill: '#718096' }); })
      .on('pointerdown', () => this._close());

    // ── Séparateur vertical ───────────────────────────────────────────────
    const sepG = this.add.graphics().setDepth(2);
    sepG.lineStyle(1, 0x334466, 0.4);
    sepG.lineBetween(
      panelX + PANEL_W / 2, panelY + 36,
      panelX + PANEL_W / 2, panelY + PANEL_H - 50
    );

    // ── Labels ────────────────────────────────────────────────────────────
    this.add.text(panelX + 16, panelY + 36, 'Terrain', {
      fontSize: '11px', fill: '#718096', fontFamily: 'sans-serif'
    }).setDepth(2);

    this.bankLabel = this.add.text(
      panelX + PANEL_W / 2 + 12, panelY + 36,
      `Banque (${this.bankSlots.filter(Boolean).length}/${BANK_MAX_SIZE})`, {
      fontSize: '11px', fill: '#718096', fontFamily: 'sans-serif'
    }).setDepth(2);

    // ── Terrain (Field) ───────────────────────────────────────────────────
    const playerUnits = this.registry.get('playerUnits') ?? [];

    this.playerField = new Field(this, panelX + 16, panelY + 52, {
      borderColor: 0x4a90d9,
      showName:    true,
      cellSize:    SLOT_SIZE,
      cellGap:     SLOT_GAP,
      interactive: true,
      depth:       2,
      onCellClick: (col, row) => this._onFieldClick(col, row),
    });
    this.playerField.setUnits(playerUnits);

    // ── Banque ────────────────────────────────────────────────────────────
    this._drawAllBankSlots();

    // ── Stock Pokéballs ───────────────────────────────────────────────────
    const state     = getRunState(this.registry);
    const pokeballs = state.pokeballs ?? 0;

    this.pokeballText = this.add.text(
    panelX + PANEL_W - 16, panelY + 36,
    `🔴 ${pokeballs} Poké Ball${pokeballs > 1 ? 's' : ''}`,
    { fontSize: '11px', fill: '#ff6b6b', fontFamily: 'sans-serif' }
    ).setOrigin(1, 0).setDepth(2);

    // ── Conteneurs dynamiques ─────────────────────────────────────────────
    this.synergyContainer = this.add.container(0, 0).setDepth(3);
    this.spiderContainer  = this.add.container(0, 0).setDepth(3);

    // ── Synergies initiales ───────────────────────────────────────────────
    this._drawSynergies();

    // ── Barre d'action ────────────────────────────────────────────────────
    this._drawActionBar();

    // ── Bouton valider ────────────────────────────────────────────────────
    this._drawValidateButton();

    // ── Drag & drop ───────────────────────────────────────────────────────
    this.input.on('pointermove', ptr => this._onDragMove(ptr));
    this.input.on('pointerup',   ptr => this._onDragEnd(ptr));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  BANQUE
  // ═════════════════════════════════════════════════════════════════════════

  // Calcule la position pixel d'un slot de banque
  _bankSlotPos(idx) {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    return {
      x: this.panelX + PANEL_W / 2 + 12 + col * (SLOT_SIZE + SLOT_GAP),
      y: this.panelY + 52 + row * (SLOT_SIZE + SLOT_GAP),
    };
  }

  _drawAllBankSlots() {
    for (let i = 0; i < BANK_MAX_SIZE; i++) {
      this._drawBankSlot(i);
    }
  }

  _drawBankSlot(idx) {
    const key  = `bank_${idx}`;
    const unit = this.bankSlots[idx] ?? null;
    const sel  = this.selectedCard?.source === 'bank' &&
                 this.selectedCard?.sourceIdx === idx;
    const { x, y } = this._bankSlotPos(idx);

    // Détruit l'ancien slot
    if (this.bankObjects[key]) {
      Object.values(this.bankObjects[key]).forEach(o => {
        if (o && typeof o.destroy === 'function') o.destroy();
      });
    }

    // Fond
    const bg = this.add.graphics().setDepth(2);
    bg.fillStyle(unit ? 0x1a2e4a : 0x16213e, 0.9);
    bg.fillRoundedRect(x, y, SLOT_SIZE, SLOT_SIZE, 8);
    bg.lineStyle(
      sel ? 2.5 : 1.5,
      sel ? 0xffd700 : (unit ? 0x4a90d9 : 0x334466),
      1
    );
    bg.strokeRoundedRect(x, y, SLOT_SIZE, SLOT_SIZE, 8);

    let corners = null, sprite = null, nameTag = null;
    let hitArea = null, plus = null;

    if (unit) {
      // Coins de type
      const s  = 9;
      const c1 = TYPE_COLORS[unit.types[0]] ?? 0x888888;
      const c2 = unit.types[1]
        ? (TYPE_COLORS[unit.types[1]] ?? 0x888888) : c1;

      corners = this.add.graphics().setDepth(3);
      corners.fillStyle(c1, 0.9);
      corners.fillTriangle(x, y, x + s, y, x, y + s);
      corners.fillStyle(c1, 0.9);
      corners.fillTriangle(
        x + SLOT_SIZE, y + SLOT_SIZE,
        x + SLOT_SIZE - s, y + SLOT_SIZE,
        x + SLOT_SIZE, y + SLOT_SIZE - s
      );
      corners.fillStyle(c2, 0.9);
      corners.fillTriangle(x + SLOT_SIZE, y, x + SLOT_SIZE - s, y, x + SLOT_SIZE, y + s);
      corners.fillStyle(c2, 0.9);
      corners.fillTriangle(x, y + SLOT_SIZE, x + s, y + SLOT_SIZE, x, y + SLOT_SIZE - s);

      // Sprite
      const texKey = `monster_${unit.id}`;
      sprite = this.add.image(
        Math.round(x + SLOT_SIZE / 2),
        Math.round(y + SLOT_SIZE / 2 - 6),
        this.textures.exists(texKey) ? texKey : '__DEFAULT'
      ).setDisplaySize(50, 50).setDepth(4).setInteractive({ cursor: 'pointer' });

      // Nom
      nameTag = this.add.text(
        Math.round(x + SLOT_SIZE / 2),
        Math.round(y + SLOT_SIZE - 6),
        unit.name,
        { fontSize: '9px', fill: '#e2e8f0', fontFamily: 'sans-serif' }
      ).setOrigin(0.5, 1).setDepth(4);

      sprite.on('pointerdown', ptr => {
        if (ptr.rightButtonDown()) return;
        // Lance le drag ET la sélection
        this._startDrag(unit, 'bank', idx, null, x + SLOT_SIZE / 2, y + SLOT_SIZE / 2);
        this._onBankClick(idx);
      });

    } else {
      // Slot vide
      hitArea = this.add.rectangle(
        x + SLOT_SIZE / 2, y + SLOT_SIZE / 2,
        SLOT_SIZE, SLOT_SIZE, 0xffffff, 0
      ).setDepth(3).setInteractive({ cursor: 'pointer' });
      hitArea.on('pointerdown', () => this._onBankClick(idx));

      plus = this.add.text(
        x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, '+',
        { fontSize: '22px', fill: '#334466', fontFamily: 'sans-serif' }
      ).setOrigin(0.5).setDepth(3);
    }

    this.bankObjects[key] = { bg, corners, sprite, nameTag, hitArea, plus };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  GESTION DES CLICS — Fix 3 : sélection = visuel uniquement, pas de save
  // ═════════════════════════════════════════════════════════════════════════

  _onFieldClick(col, row) {
    const unit = this.playerField.getUnit(col, row);

    // ── Cas 1 : une carte est déjà sélectionnée → on déplace ─────────────
    if (this.selectedCard) {
      const { pokemon, source, sourceCol, sourceRow, sourceIdx } = this.selectedCard;

      // Vérifie que la source est toujours valide (anti-duplication)
      const sourceValid = source === 'field'
        ? this.playerField.getUnit(sourceCol, sourceRow)?.uid === pokemon.uid
        : this.bankSlots[sourceIdx]?.uid === pokemon.uid;

      if (!sourceValid) {
        // Source invalide → annule silencieusement
        this.selectedCard = null;
        this._clearSelectionVisuals();
        return;
      }

      // Déplacement sur soi-même → désélectionne
      if (source === 'field' && sourceCol === col && sourceRow === row) {
        this.selectedCard = null;
        this._clearSelectionVisuals();
        return;
      }

      // ── Swap ──────────────────────────────────────────────────────────
      const existing = this.playerField.getUnit(col, row);

      if (source === 'bank') {
        // Banque → Terrain : l'éventuel occupant retourne en banque
        this.bankSlots[sourceIdx] = existing
          ? { ...existing } : null;
      } else {
        // Terrain → Terrain : swap des deux unités
        this.playerField.setUnit(sourceCol, sourceRow,
          existing ? { ...existing, col: sourceCol, row: sourceRow } : null
        );
      }

      this.playerField.setUnit(col, row, { ...pokemon, col, row });

      this.selectedCard = null;

      // Fix 2 : sauvegarde uniquement après un vrai changement de données
      this._refreshAll(true);
      this._checkEvolution();
      return;
    }

    // ── Cas 2 : rien de sélectionné → sélectionne l'unité ────────────────
    if (unit) {
      this.selectedCard = {
        pokemon:   unit,
        source:    'field',
        sourceCol: col,
        sourceRow: row,
      };

      // Fix 3 : visuel uniquement, PAS de _refreshAll ni de saveState
      this.playerField.highlightCell(col, row, true);
      this._drawActionBar();
      this._drawSpiderChart(unit);
    }
  }

  _onBankClick(idx) {
    const unit = this.bankSlots[idx];

    // ── Cas 1 : une carte est déjà sélectionnée → on déplace ─────────────
    if (this.selectedCard) {
      const { pokemon, source, sourceCol, sourceRow, sourceIdx } = this.selectedCard;

      // Vérifie validité (anti-duplication)
      const sourceValid = source === 'field'
        ? this.playerField.getUnit(sourceCol, sourceRow)?.uid === pokemon.uid
        : this.bankSlots[sourceIdx]?.uid === pokemon.uid;

      if (!sourceValid) {
        this.selectedCard = null;
        this._clearSelectionVisuals();
        return;
      }

      // Clic sur soi-même → désélectionne
      if (source === 'bank' && sourceIdx === idx) {
        this.selectedCard = null;
        this._clearSelectionVisuals();
        return;
      }

      // ── Swap ──────────────────────────────────────────────────────────
      const existing = this.bankSlots[idx] ?? null;

      if (source === 'field') {
        // Terrain → Banque : l'éventuel occupant va sur le terrain
        this.playerField.setUnit(sourceCol, sourceRow,
          existing ? { ...existing, col: sourceCol, row: sourceRow } : null
        );
      } else {
        // Banque → Banque : swap simple
        this.bankSlots[sourceIdx] = existing;
      }
      this.bankSlots[idx] = pokemon;

      this.selectedCard = null;

      // Fix 2 : sauvegarde uniquement après changement réel
      this._refreshAll(true);
      return;
    }

    // ── Cas 2 : sélectionne l'unité de banque ────────────────────────────
    if (unit) {
      this.selectedCard = {
        pokemon:   unit,
        source:    'bank',
        sourceIdx: idx,
      };

      // Fix 3 : visuel uniquement
      this._drawBankSlot(idx);   // redessine avec la bordure dorée
      this._drawActionBar();
      this._drawSpiderChart(unit);
    }
  }

  // ── Efface les visuels de sélection sans toucher aux données ─────────────
  _clearSelectionVisuals() {
    this.playerField?.resetHighlights();
    this.spiderContainer?.removeAll(true);
    this._drawActionBar();

    // Redessine les slots banque pour retirer la bordure dorée
    for (let i = 0; i < BANK_MAX_SIZE; i++) {
      this._drawBankSlot(i);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  DRAG & DROP
  // ═════════════════════════════════════════════════════════════════════════

  _startDrag(unit, source, colOrIdx, row, x, y) {
    if (!unit) return;
    this.isDragging = true;
    this.dragUnit   = unit;
    this.dragSource = source === 'field'
      ? { source, col: colOrIdx, row }
      : { source, idx: colOrIdx };

    const key = `monster_${unit.id}`;
    this.dragSprite = this.add.image(x, y,
      this.textures.exists(key) ? key : '__DEFAULT'
    ).setDisplaySize(50, 50).setDepth(50).setAlpha(0.75);
  }

  _onDragMove(ptr) {
    if (!this.isDragging || !this.dragSprite) return;
    this.dragSprite.setPosition(ptr.x, ptr.y);
  }

  _onDragEnd(ptr) {
    if (!this.isDragging || !this.dragSprite) return;
    this.isDragging = false;
    this.dragSprite.destroy();
    this.dragSprite = null;

    const target = this._getSlotAt(ptr.x, ptr.y);
    if (!target || !this.dragUnit) {
      this.dragUnit = null; this.dragSource = null; return;
    }

    const { type, col, row, idx } = target;
    const src = this.dragSource;

    if (type === 'field') {
      const existing = this.playerField.getUnit(col, row);
      if (src.source === 'bank') {
        this.bankSlots[src.idx] = existing ?? null;
      } else {
        if (src.col === col && src.row === row) {
          this.dragUnit = null; this.dragSource = null; return;
        }
        this.playerField.setUnit(src.col, src.row,
          existing ? { ...existing, col: src.col, row: src.row } : null
        );
      }
      this.playerField.setUnit(col, row, { ...this.dragUnit, col, row });
      this._checkEvolution();

    } else {
      const existing = this.bankSlots[idx] ?? null;
      if (src.source === 'field') {
        this.playerField.setUnit(src.col, src.row,
          existing ? { ...existing, col: src.col, row: src.row } : null
        );
      } else {
        if (src.idx === idx) {
          this.dragUnit = null; this.dragSource = null; return;
        }
        this.bankSlots[src.idx] = existing;
      }
      this.bankSlots[idx] = this.dragUnit;
    }

    this.dragUnit   = null;
    this.dragSource = null;

    // Fix 2 : sauvegarde après drag réel
    this._refreshAll(true);
  }

  _getSlotAt(px, py) {
    // Terrain
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const x = this.panelX + 16 + c * (SLOT_SIZE + SLOT_GAP);
        const y = this.panelY + 52 + r * (SLOT_SIZE + SLOT_GAP);
        if (px >= x && px <= x + SLOT_SIZE && py >= y && py <= y + SLOT_SIZE)
          return { type: 'field', col: c, row: r };
      }
    }

    // Banque
    for (let i = 0; i < BANK_MAX_SIZE; i++) {
      const { x, y } = this._bankSlotPos(i);
      if (px >= x && px <= x + SLOT_SIZE && py >= y && py <= y + SLOT_SIZE)
        return { type: 'bank', idx: i };
    }

    return null;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  BARRE D'ACTION
  // ═════════════════════════════════════════════════════════════════════════

  _drawActionBar() {
    this.actionBarItems.forEach(o => {
      if (o && typeof o.destroy === 'function') o.destroy();
    });
    this.actionBarItems = [];

    if (!this.selectedCard) return;

    const { pokemon }  = this.selectedCard;
    const barY         = this.panelY + PANEL_H - 50;
    const price        = this._getSellPrice(pokemon);

    // Séparateur
    const sep = this.add.graphics().setDepth(3);
    sep.lineStyle(1, 0x334466, 0.4);
    sep.lineBetween(
      this.panelX + 12, barY,
      this.panelX + PANEL_W - 12, barY
    );
    this.actionBarItems.push(sep);

    // Info stats
    const atkLabel = (pokemon.stats.spa ?? 0) > (pokemon.stats.atk ?? 0)
      ? `SP.ATK:${pokemon.stats.spa}` : `ATK:${pokemon.stats.atk}`;

    const info = this.add.text(this.panelX + 16, barY + 10,
      `${pokemon.name}  [${pokemon.types.join('/')}]  ` +
      `HP:${pokemon.stats.hp}  ${atkLabel}  ` +
      `DEF:${pokemon.stats.def}  VIT:${pokemon.stats.spd}`, {
      fontSize: '10px', fill: '#a0aec0', fontFamily: 'sans-serif'
    }).setDepth(4);
    this.actionBarItems.push(info);

    // Bouton vendre
    const sellBtn = this.add.text(
      this.panelX + PANEL_W - 16, barY + 10,
      `[ Vendre — ${price} 💰 ]`, {
      fontSize: '12px', fill: '#fc5c65', fontFamily: 'sans-serif'
    }).setOrigin(1, 0).setDepth(4).setInteractive({ cursor: 'pointer' });

    sellBtn.on('pointerover', () => sellBtn.setStyle({ fill: '#fff' }));
    sellBtn.on('pointerout',  () => sellBtn.setStyle({ fill: '#fc5c65' }));
    sellBtn.on('pointerdown', () => this._sell());
    this.actionBarItems.push(sellBtn);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  VENTE
  // ═════════════════════════════════════════════════════════════════════════

  _sell() {
    if (!this.selectedCard) return;
    const { source, sourceCol, sourceRow, sourceIdx, pokemon } = this.selectedCard;
    const price = this._getSellPrice(pokemon);

    if (source === 'field') {
      this.playerField.setUnit(sourceCol, sourceRow, null);
    } else {
      this.bankSlots[sourceIdx] = null;
    }

    addCoins(this.registry, price);
    this.selectedCard = null;
    this.spiderContainer.removeAll(true);

    // Fix 2 : sauvegarde après vente (vrai changement)
    this._refreshAll(true);
  }

  _getSellPrice(pokemon) {
    const s = pokemon.stats;
    return Math.max(1, Math.floor(
      (s.hp + s.atk + (s.spa ?? s.atk) + s.def + (s.spd_def ?? s.def) + s.spd) / 40
    ));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  SYNERGIES
  // ═════════════════════════════════════════════════════════════════════════

  _drawSynergies() {
    this.synergyContainer.removeAll(true);

    const sx       = this.panelX + 16;
    const sy       = this.panelY + 52 + GRID_ROWS * (SLOT_SIZE + SLOT_GAP) + 10;
    const units    = this.playerField.getAllUnits();
    const synergies = getActiveSynergies(units);

    this.synergyContainer.add(
      this.add.text(sx, sy, 'Synergies :', {
        fontSize: '10px', fill: '#718096', fontFamily: 'sans-serif'
      }).setDepth(3)
    );

    if (synergies.length === 0) {
      this.synergyContainer.add(
        this.add.text(sx, sy + 16, 'Aucune synergie active', {
          fontSize: '10px', fill: '#4a5568', fontFamily: 'sans-serif'
        }).setDepth(3)
      );
      return;
    }

    synergies.slice(0, 6).forEach((syn, i) => {
      const col   = i % 2;
      const row   = Math.floor(i / 2);
      const bx    = sx + col * 120;
      const by    = sy + 16 + row * 22;
      const stars = syn.tier === 3 ? ' ★★★' : ' ★★';

      const badge = this.add.graphics().setDepth(3);
      badge.fillStyle(syn.color, 0.80);
      badge.fillRoundedRect(bx, by, 112, 17, 4);

      const txt = this.add.text(bx + 5, by + 8,
        `${syn.icon} ${syn.type}${stars}`, {
        fontSize: '10px', fill: '#ffffff', fontFamily: 'sans-serif'
      }).setOrigin(0, 0.5).setDepth(4);

      // Tooltip au survol
      const hit = this.add.rectangle(bx + 56, by + 8, 112, 17, 0xffffff, 0)
        .setDepth(5).setInteractive({ cursor: 'help' });

      let tooltip = null;
      hit.on('pointerover', () => {
        tooltip = this.add.text(bx, by - 20, syn.label, {
          fontSize: '10px', fill: '#ffd700', fontFamily: 'sans-serif',
          backgroundColor: '#1a1a2e', padding: { x: 4, y: 2 }
        }).setDepth(10);
      });
      hit.on('pointerout', () => {
        if (tooltip) { tooltip.destroy(); tooltip = null; }
      });

      this.synergyContainer.add([badge, txt, hit]);
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  TOILE D'ARAIGNÉE
  // ═════════════════════════════════════════════════════════════════════════

  _drawSpiderChart(pokemon) {
    this.spiderContainer.removeAll(true);
    if (!pokemon) return;

    const cx = this.panelX + SPIDER_CX_OFFSET;
    const cy = this.panelY + SPIDER_CY_OFFSET;
    const R  = SPIDER_RADIUS;

    const axes = [
      { emoji: '❤️',  value: pokemon.stats.hp,                          max: 250, angle: -90  },
      { emoji: '🔮',  value: pokemon.stats.spa     ?? pokemon.stats.atk, max: 154, angle: -30  },
      { emoji: '💎',  value: pokemon.stats.spd_def ?? pokemon.stats.def, max: 130, angle:  30  },
      { emoji: '👟',  value: pokemon.stats.spd,                          max: 150, angle:  90  },
      { emoji: '🛡️',  value: pokemon.stats.def,                          max: 180, angle:  150 },
      { emoji: '⚔️',  value: pokemon.stats.atk,                          max: 134, angle:  210 },
    ];

    const toRad = deg => (deg * Math.PI) / 180;
    const g = this.add.graphics().setDepth(3);

    // Grille hexagonale
    [0.33, 0.66, 1.0].forEach(ratio => {
      g.lineStyle(1, 0x334466, ratio === 1.0 ? 0.55 : 0.25);
      g.beginPath();
      axes.forEach((ax, i) => {
        const px = cx + R * ratio * Math.cos(toRad(ax.angle));
        const py = cy + R * ratio * Math.sin(toRad(ax.angle));
        i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
      });
      g.closePath();
      g.strokePath();
    });

    // Axes radiaux
    axes.forEach(ax => {
      g.lineStyle(1, 0x4a5568, 0.45);
      g.lineBetween(
        cx, cy,
        cx + R * Math.cos(toRad(ax.angle)),
        cy + R * Math.sin(toRad(ax.angle))
      );
    });

    // Polygone des stats
    const points = axes.map(ax => ({
      px: cx + R * Math.min(ax.value / ax.max, 1) * Math.cos(toRad(ax.angle)),
      py: cy + R * Math.min(ax.value / ax.max, 1) * Math.sin(toRad(ax.angle)),
    }));

    g.fillStyle(0x4a90d9, 0.18);
    g.beginPath();
    points.forEach((p, i) => i === 0 ? g.moveTo(p.px, p.py) : g.lineTo(p.px, p.py));
    g.closePath();
    g.fillPath();

    g.lineStyle(2, 0x4a90d9, 0.85);
    g.beginPath();
    points.forEach((p, i) => i === 0 ? g.moveTo(p.px, p.py) : g.lineTo(p.px, p.py));
    g.closePath();
    g.strokePath();

    g.fillStyle(0x74b9ff, 1);
    points.forEach(p => g.fillCircle(p.px, p.py, 2.5));

    this.spiderContainer.add(g);

    // Icônes + valeurs
    axes.forEach(ax => {
      const dist = R + 15;
      const lx   = cx + dist * Math.cos(toRad(ax.angle));
      const ly   = cy + dist * Math.sin(toRad(ax.angle));

      const emojiTxt = this.add.text(lx, ly - 8, ax.emoji, {
        fontSize: '12px', fontFamily: 'sans-serif'
      }).setOrigin(0.5, 0.5).setDepth(4);

      const valTxt = this.add.text(lx, ly + 8, `${ax.value}`, {
        fontSize: '8px', fill: '#a0aec0', fontFamily: 'sans-serif'
      }).setOrigin(0.5, 0.5).setDepth(4);

      this.spiderContainer.add([emojiTxt, valTxt]);
    });

    // Nom au centre
    const nameTxt = this.add.text(cx, cy, pokemon.name, {
      fontSize: '8px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0.5).setDepth(4);

    this.spiderContainer.add(nameTxt);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  ÉVOLUTION
  // ═════════════════════════════════════════════════════════════════════════

  _checkEvolution() {
    const units  = this.playerField.getAllUnits();
    const counts = {};
    units.forEach(u => { counts[u.id] = (counts[u.id] ?? 0) + 1; });

    for (const [idStr, count] of Object.entries(counts)) {
      const id = parseInt(idStr);
      if (count >= 2 && canEvolve(id)) {
        this._proposeEvolution(id);
        return;
      }
    }
  }

  _proposeEvolution(baseId) {
    const evoId   = getEvolutionId(baseId);
    const evoPok  = POKEMONS.find(p => p.id === evoId);
    const basePok = POKEMONS.find(p => p.id === baseId);
    if (!evoPok || !basePok) return;

    const W = this.scale.width;
    const H = this.scale.height;
    const popupItems = [];

    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.65)
      .setOrigin(0).setDepth(60);
    popupItems.push(overlay);

    [
      { y: H / 2 - 50, txt: `✨ ${basePok.name} peut évoluer en ${evoPok.name} !`, size: '15px', color: '#ffd700' },
      { y: H / 2 - 24, txt: 'Les 2 exemplaires fusionnent en 1 pokémon évolué.', size: '11px', color: '#a0aec0' },
    ].forEach(({ y, txt, size, color }) => {
      popupItems.push(
        this.add.text(W / 2, y, txt, {
          fontSize: size, fill: color, fontFamily: 'sans-serif'
        }).setOrigin(0.5).setDepth(61)
      );
    });

    const yesBtn = this.add.text(W / 2 - 70, H / 2 + 16,
      '[ ✅ Évoluer ]', {
      fontSize: '14px', fill: '#44cc44', fontFamily: 'sans-serif'
    }).setOrigin(0.5).setDepth(61).setInteractive({ cursor: 'pointer' });
    popupItems.push(yesBtn);

    const noBtn = this.add.text(W / 2 + 70, H / 2 + 16,
      '[ ✕ Annuler ]', {
      fontSize: '14px', fill: '#fc5c65', fontFamily: 'sans-serif'
    }).setOrigin(0.5).setDepth(61).setInteractive({ cursor: 'pointer' });
    popupItems.push(noBtn);

    const cleanup = () => popupItems.forEach(o => o.destroy());

    yesBtn.on('pointerdown', () => { cleanup(); this._evolve(baseId, evoId); });
    noBtn.on('pointerdown',  () => cleanup());
  }

  _evolve(baseId, evoId) {
    const evoPok = POKEMONS.find(p => p.id === evoId);
    if (!evoPok) return;

    let replaced = false;
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const u = this.playerField.getUnit(c, r);
        if (u?.id === baseId) {
          if (!replaced) {
            this.playerField.setUnit(c, r, {
              ...evoPok, col: c, row: r,
              uid: u.uid,   // conserve le uid de l'unité originale
              isInTeam: true, attributes: []
            });
            replaced = true;
          } else {
            this.playerField.setUnit(c, r, null);
          }
        }
      }
    }
    // Fix 2 : sauvegarde après évolution
    this._refreshAll(true);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  BOUTON VALIDER
  // ═════════════════════════════════════════════════════════════════════════

  _drawValidateButton() {
    const btn = this.add.text(
      this.panelX + PANEL_W / 2,
      this.panelY + PANEL_H - 8,
      '[ ✅ Valider l\'équipe ]', {
      fontSize: '13px', fill: '#44cc44', fontFamily: 'sans-serif',
      backgroundColor: '#0d1a0d', padding: { x: 10, y: 5 }
    }).setOrigin(0.5, 1).setDepth(4).setInteractive({ cursor: 'pointer' });

    btn.on('pointerover', () => btn.setStyle({ fill: '#ffffff' }));
    btn.on('pointerout',  () => btn.setStyle({ fill: '#44cc44' }));
    btn.on('pointerdown', () => this._close());
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  REFRESH — Fix 2 : save = true uniquement sur vrai changement de données
  // ═════════════════════════════════════════════════════════════════════════

  _refreshAll(save = false) {
    // Redessine tous les slots banque
    this._drawAllBankSlots();

    // Met à jour le label banque
    this.bankLabel?.setText(
      `Banque (${this.bankSlots.filter(Boolean).length}/${BANK_MAX_SIZE})`
    );

    // Réinitialise les surlignages
    this.playerField?.resetHighlights();

    // Ressurligne si sélection active sur le terrain
    if (this.selectedCard?.source === 'field') {
      this.playerField?.highlightCell(
        this.selectedCard.sourceCol,
        this.selectedCard.sourceRow,
        true
      );
    }

    // Met à jour synergies
    this._drawSynergies();

    // Met à jour le nombre de pokéballs
    const freshState = getRunState(this.registry);
    this.pokeballText?.setText(
    `🔴 ${freshState.pokeballs ?? 0} Poké Ball${(freshState.pokeballs ?? 0) > 1 ? 's' : ''}`
    );

    // Met à jour barre d'action
    this._drawActionBar();

    // Efface la toile si rien n'est sélectionné
    if (!this.selectedCard) {
      this.spiderContainer?.removeAll(true);
    }

    // Fix 2 : ne sauvegarde que si demandé explicitement
    if (save) this._saveState();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _saveState() — persiste l'état dans le registre
  // ─────────────────────────────────────────────────────────────────────────
  _saveState() {
    const units = this.playerField.getAllUnits()
      .map(u => ({ ...u, isInTeam: true }));

    const bank = this.bankSlots
      .filter(Boolean)
      .map(u => ({ ...u, isInTeam: true }));

    this.registry.set('playerUnits', units);
    const state = getRunState(this.registry);
    setRunState(this.registry, { ...state, playerBank: bank });
  }

  _close() {
    this._saveState();
    this.scene.stop('PrepScene');
  }
}