// ─────────────────────────────────────────────────────────────────────────────
// Field.js — Composant réutilisable de terrain
// Gère l'affichage d'une grille 3x2 de pokémons dans n'importe quelle scène.
//
// Usage :
//   const field = new Field(scene, startX, startY, options);
//   field.setUnits(units);   // met à jour les unités affichées
//   field.destroy();         // nettoie tous les objets Phaser
//
// Options :
//   borderColor    : couleur de la bordure des cellules (défaut 0x4a90d9)
//   showName       : affiche le nom sous le sprite (défaut true)
//   cellSize       : taille d'une cellule en pixels (défaut 72)
//   cellGap        : espace entre les cellules (défaut 6)
//   interactive    : les sprites sont cliquables (défaut false)
//   onCellClick    : callback(col, row, unit) au clic sur une cellule
// ─────────────────────────────────────────────────────────────────────────────

import { TYPE_COLORS } from '../data/pokemons.js';
import { GRID_COLS, GRID_ROWS } from '../board.js';

export class Field {
  constructor(scene, startX, startY, options = {}) {
    this.scene    = scene;
    this.startX   = startX;
    this.startY   = startY;

    // ── Options avec valeurs par défaut ───────────────────────────────────
    this.borderColor  = options.borderColor  ?? 0x4a90d9;
    this.showName     = options.showName     ?? true;
    this.cellSize     = options.cellSize     ?? 72;
    this.cellGap      = options.cellGap      ?? 6;
    this.interactive  = options.interactive  ?? false;
    this.onCellClick  = options.onCellClick  ?? null;
    this.depth        = options.depth        ?? 1;

    // ── État interne ──────────────────────────────────────────────────────
    // units[col][row] → pokemon | null
    this.units = [];
    for (let c = 0; c < GRID_COLS; c++) {
      this.units[c] = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        this.units[c][r] = null;
      }
    }

    // Objets Phaser par cellule — clé : 'c_r'
    // Chaque entrée : { bg, corners, sprite, nameTag, hitArea }
    this.cellObjects = {};

    // Dessin initial (cellules vides)
    this._drawAll();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Largeur et hauteur totales du terrain en pixels
  // ─────────────────────────────────────────────────────────────────────────
  get width() {
    return GRID_COLS * (this.cellSize + this.cellGap) - this.cellGap;
  }

  get height() {
    return GRID_ROWS * (this.cellSize + this.cellGap) - this.cellGap;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // setUnits() — met à jour les unités et redessine le terrain complet
  // units : tableau plat de pokémons avec col et row définis
  // ─────────────────────────────────────────────────────────────────────────
  setUnits(units) {
    // Réinitialise la grille interne
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        this.units[c][r] = null;
      }
    }

    // Place chaque unité à sa position
    units.filter(Boolean).forEach(u => {
      if (u.col < GRID_COLS && u.row < GRID_ROWS) {
        this.units[u.col][u.row] = u;
      }
    });

    // Redessine toutes les cellules
    this._drawAll();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // setUnit() — met à jour une seule cellule
  // ─────────────────────────────────────────────────────────────────────────
  setUnit(col, row, unit) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    this.units[col][row] = unit;
    this._drawCell(col, row);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getUnit() — retourne l'unité à une position donnée
  // ─────────────────────────────────────────────────────────────────────────
  getUnit(col, row) {
    return this.units[col]?.[row] ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getAllUnits() — retourne toutes les unités placées (sans les nulls)
  // ─────────────────────────────────────────────────────────────────────────
  getAllUnits() {
    const result = [];
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        if (this.units[c][r]) result.push(this.units[c][r]);
      }
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // highlightCell() — surligne une cellule (sélection dans PrepScene)
  // ─────────────────────────────────────────────────────────────────────────
  highlightCell(col, row, highlighted = true) {
    const key = `${col}_${row}`;
    const obj = this.cellObjects[key];
    if (!obj?.bg) return;

    const x = this.startX + col * (this.cellSize + this.cellGap);
    const y = this.startY + row * (this.cellSize + this.cellGap);

    obj.bg.clear();
    obj.bg.fillStyle(this.units[col][row] ? 0x1a2e4a : 0x16213e, 0.9);
    obj.bg.fillRoundedRect(x, y, this.cellSize, this.cellSize, 8);
    obj.bg.lineStyle(
      highlighted ? 2.5 : 1.5,
      highlighted ? 0xffd700 : (this.units[col][row] ? this.borderColor : 0x334466),
      1
    );
    obj.bg.strokeRoundedRect(x, y, this.cellSize, this.cellSize, 8);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // resetHighlights() — enlève tous les surlignages
  // ─────────────────────────────────────────────────────────────────────────
  resetHighlights() {
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        this.highlightCell(c, r, false);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getSprite() — retourne le sprite d'une unité (pour l'animator)
  // ─────────────────────────────────────────────────────────────────────────
  getSprite(col, row) {
    return this.cellObjects[`${col}_${row}`]?.sprite ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getSpriteMap() — retourne un objet { 'side_id': sprite } pour CombatAnimator
  // ─────────────────────────────────────────────────────────────────────────
  getSpriteMap(side) {
  const map = {};
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const unit   = this.units[c][r];
      const sprite = this.cellObjects[`${c}_${r}`]?.sprite;
      if (unit && sprite) {
        // Utilise uid si disponible, sinon id (fallback)
        const key = unit.uid ?? `${unit.id}_${c}_${r}`;
        map[`${side}_${key}`] = sprite;
      }
    }
  }
  return map;
}

  // ─────────────────────────────────────────────────────────────────────────
  // destroy() — détruit tous les objets Phaser du terrain
  // ─────────────────────────────────────────────────────────────────────────
  destroy() {
    Object.values(this.cellObjects).forEach(obj => {
      if (!obj) return;
      Object.values(obj).forEach(o => {
        if (o && typeof o.destroy === 'function') o.destroy();
      });
    });
    this.cellObjects = {};
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  MÉTHODES INTERNES
  // ═════════════════════════════════════════════════════════════════════════

  // ── Dessine toutes les cellules ───────────────────────────────────────
  _drawAll() {
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        this._drawCell(c, r);
      }
    }
  }

  // ── Dessine une cellule individuelle ──────────────────────────────────
  _drawCell(col, row) {
    const key  = `${col}_${row}`;
    const unit = this.units[col][row];

    // Détruit les anciens objets de cette cellule
    if (this.cellObjects[key]) {
      Object.values(this.cellObjects[key]).forEach(o => {
        if (o && typeof o.destroy === 'function') o.destroy();
      });
    }

    const x = this.startX + col * (this.cellSize + this.cellGap);
    const y = this.startY + row * (this.cellSize + this.cellGap);

    // ── Fond de cellule ───────────────────────────────────────────────────
    const bg = this.scene.add.graphics().setDepth(this.depth);
    bg.fillStyle(unit ? 0x1a2e4a : 0x16213e, 0.9);
    bg.fillRoundedRect(x, y, this.cellSize, this.cellSize, 8);
    bg.lineStyle(1.5, unit ? this.borderColor : 0x334466, 1);
    bg.strokeRoundedRect(x, y, this.cellSize, this.cellSize, 8);

    let corners = null, sprite = null, nameTag = null, hitArea = null;

    if (unit) {
      // ── Coins de type ───────────────────────────────────────────────────
      const s  = 10;
      const c1 = TYPE_COLORS[unit.types[0]] ?? 0x888888;
      const c2 = unit.types[1]
        ? (TYPE_COLORS[unit.types[1]] ?? 0x888888) : c1;

      corners = this.scene.add.graphics().setDepth(this.depth + 1);
      corners.fillStyle(c1, 0.9);
      corners.fillTriangle(x, y, x + s, y, x, y + s);
      corners.fillStyle(c1, 0.9);
      corners.fillTriangle(
        x + this.cellSize, y + this.cellSize,
        x + this.cellSize - s, y + this.cellSize,
        x + this.cellSize, y + this.cellSize - s
      );
      corners.fillStyle(c2, 0.9);
      corners.fillTriangle(x + this.cellSize, y, x + this.cellSize - s, y, x + this.cellSize, y + s);
      corners.fillStyle(c2, 0.9);
      corners.fillTriangle(x, y + this.cellSize, x + s, y + this.cellSize, x, y + this.cellSize - s);

      // ── Sprite ─────────────────────────────────────────────────────────
      const texKey = `monster_${unit.id}`;
      sprite = this.scene.add.image(
        Math.round(x + this.cellSize / 2),
        Math.round(y + this.cellSize / 2 - (this.showName ? 6 : 0)),
        this.scene.textures.exists(texKey) ? texKey : '__DEFAULT'
      ).setDisplaySize(
        this.cellSize - 14,
        this.cellSize - 14
      ).setDepth(this.depth + 2);

      // Charge le sprite si manquant
      if (!this.scene.textures.exists(texKey)) {
        this.scene.load.once('complete', () => {
          if (sprite?.active) sprite.setTexture(texKey);
        });
        this.scene.load.image(texKey, unit.spriteUrl);
        this.scene.load.start();
      }

      // ── Nom ────────────────────────────────────────────────────────────
      if (this.showName) {
        nameTag = this.scene.add.text(
          Math.round(x + this.cellSize / 2),
          Math.round(y + this.cellSize - 6),
          unit.name,
          { fontSize: '9px', fill: '#e2e8f0', fontFamily: 'sans-serif' }
        ).setOrigin(0.5, 1).setDepth(this.depth + 3);
      }

      // ── Zone de clic (si interactive) ──────────────────────────────────
      if (this.interactive && this.onCellClick) {
        hitArea = this.scene.add.rectangle(
          x + this.cellSize / 2,
          y + this.cellSize / 2,
          this.cellSize,
          this.cellSize,
          0xffffff, 0
        ).setDepth(this.depth + 4).setInteractive({ cursor: 'pointer' });

        hitArea.on('pointerdown', () => {
          this.onCellClick(col, row, unit);
        });
      }

    } else if (this.interactive && this.onCellClick) {
      // ── Slot vide cliquable ─────────────────────────────────────────────
      hitArea = this.scene.add.rectangle(
        x + this.cellSize / 2,
        y + this.cellSize / 2,
        this.cellSize,
        this.cellSize,
        0xffffff, 0
      ).setDepth(this.depth + 4).setInteractive({ cursor: 'pointer' });

      hitArea.on('pointerdown', () => {
        this.onCellClick(col, row, null);
      });

      // Indicateur "+"
      this.scene.add.text(
        x + this.cellSize / 2,
        y + this.cellSize / 2,
        '+',
        { fontSize: '20px', fill: '#334466', fontFamily: 'sans-serif' }
      ).setOrigin(0.5).setDepth(this.depth + 3);
    }

    this.cellObjects[key] = { bg, corners, sprite, nameTag, hitArea };
  }
}