import { Board, CELL_SIZE, GRID_GAP, GRID_COLS, GRID_ROWS } from './board.js';
import { Unit } from './units/Unit.js';
import { MONSTERS, TYPE_COLORS } from './units/data.js';

// ─── Scène principale ───────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.board         = null;
    this.selectedUnit  = null;   // unité sélectionnée dans la banque
    this.bankUnits     = [];     // unités disponibles (banque du bas)
    this.placedSprites = {};     // id sprite → container Phaser
  }

  preload() {
    // Charge les sprites depuis PokeAPI
    MONSTERS.forEach(m => {
      this.load.image(`monster_${m.id}`, m.spriteUrl);
    });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Fond ──────────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    // ── Titre ─────────────────────────────────────────────────────────────
    this.add.text(W / 2, 20, 'AutoChess Monster — Phase 1', {
      fontSize: '18px', fill: '#a0aec0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    // ── Grille ────────────────────────────────────────────────────────────
    const boardW  = GRID_COLS * (CELL_SIZE + GRID_GAP) - GRID_GAP;
    const boardH  = GRID_ROWS * (CELL_SIZE + GRID_GAP) - GRID_GAP;
    const boardX  = (W - boardW) / 2;
    const boardY  = 60;

    this.board = new Board(this, boardX, boardY);
    this.board.draw();

    // Label de zone
    this.add.text(boardX, boardY - 20, 'Votre terrain', {
      fontSize: '12px', fill: '#718096', fontFamily: 'sans-serif'
    });

    // ── Zone banque (en bas) ───────────────────────────────────────────────
    const bankY = boardY + boardH + 40;
    this.add.text(boardX, bankY - 20, 'Banque — cliquez un monstre puis une case', {
      fontSize: '12px', fill: '#718096', fontFamily: 'sans-serif'
    });

    this._drawBank(boardX, bankY);

    // ── Infos sélection ───────────────────────────────────────────────────
    this.infoText = this.add.text(W / 2, H - 24, '', {
      fontSize: '13px', fill: '#63b3ed', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1);

    // ── Clicks sur la grille ──────────────────────────────────────────────
    this.input.on('pointerdown', (ptr) => this._onGridClick(ptr, boardX, boardY));
  }

  // ── Dessine la banque de monstres ──────────────────────────────────────
  _drawBank(startX, startY) {
    MONSTERS.forEach((monsterData, i) => {
      const x = startX + i * (CELL_SIZE + GRID_GAP);
      const y = startY;

      // Fond de cellule banque
      const bg = this.add.graphics();
      bg.fillStyle(0x16213e, 0.9);
      bg.fillRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);
      bg.lineStyle(1.5, 0x334466, 1);
      bg.strokeRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);

      // Sprite
      const img = this.add.image(x + CELL_SIZE / 2, y + CELL_SIZE / 2 - 8, `monster_${monsterData.id}`)
        .setDisplaySize(48, 48)
        .setInteractive({ cursor: 'pointer' });

      // Nom
      this.add.text(x + CELL_SIZE / 2, y + CELL_SIZE - 10, monsterData.name.slice(0, 8), {
        fontSize: '10px', fill: '#a0aec0', fontFamily: 'sans-serif'
      }).setOrigin(0.5, 1);

      // Type badge (couleur)
      const typeColor = TYPE_COLORS[monsterData.types[0]] ?? 0x888888;
      const badge = this.add.graphics();
      badge.fillStyle(typeColor, 0.8);
      badge.fillRoundedRect(x + 4, y + 4, 12, 12, 3);

      // Sélection au clic
      img.on('pointerdown', () => {
        this.selectedUnit = monsterData;
        this.infoText.setText(`Sélectionné : ${monsterData.name} [${monsterData.types.join('/')}] — HP:${monsterData.stats.hp} ATK:${monsterData.stats.atk}`);
        // Feedback visuel — on met le badge en surbrillance
        badge.clear();
        badge.fillStyle(0xffd700, 1);
        badge.fillRoundedRect(x + 4, y + 4, 12, 12, 3);
      });

      this.bankUnits.push({ data: monsterData, img, bg, badge });
    });
  }

  // ── Gestion du clic sur la grille ──────────────────────────────────────
  _onGridClick(ptr, boardX, boardY) {
    if (!this.selectedUnit) return;

    // Calcule col/row depuis les coordonnées du pointeur
    const relX = ptr.x - boardX;
    const relY = ptr.y - boardY;
    const col  = Math.floor(relX / (CELL_SIZE + GRID_GAP));
    const row  = Math.floor(relY / (CELL_SIZE + GRID_GAP));

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    // Crée l'unité et tente de la placer
    const unit = new Unit(this.selectedUnit, col, row);
    const placed = this.board.placeUnit(unit, col, row);

    if (placed) {
      this._spawnUnitSprite(unit);
      this.infoText.setText(`${unit.name} placé en (${col}, ${row})`);
      this.selectedUnit = null;

      // Réinitialise les badges
      this.bankUnits.forEach(b => {
        b.badge.clear();
        b.badge.fillStyle(TYPE_COLORS[b.data.types[0]] ?? 0x888888, 0.8);
        b.badge.fillRoundedRect(
          this.board.offsetX + MONSTERS.indexOf(b.data) * (CELL_SIZE + GRID_GAP) + 4,
          this.board.offsetY + GRID_ROWS * (CELL_SIZE + GRID_GAP) + 40 + 4,
          12, 12, 3
        );
      });
    } else {
      this.infoText.setText('Cellule déjà occupée !');
    }
  }

  // ── Affiche le sprite d'une unité placée ──────────────────────────────
  _spawnUnitSprite(unit) {
    const { x, y } = this.board.cellToPixel(unit.col, unit.row);
    const img = this.add.image(x, y - 4, `monster_${unit.id}`).setDisplaySize(52, 52);
    const nameTag = this.add.text(x, y + 28, unit.name.slice(0, 8), {
      fontSize: '10px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0.5);

    this.placedSprites[`${unit.col}_${unit.row}`] = { img, nameTag };
  }
}

// ─── Config Phaser ─────────────────────────────────────────────────────────

const config = {
  type: Phaser.AUTO,
  width:  680,
  height: 520,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scene: [GameScene]
};

new Phaser.Game(config);