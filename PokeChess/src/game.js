import { Board, CELL_SIZE, GRID_GAP, GRID_COLS, GRID_ROWS } from './board.js';
import { Unit } from './units/Unit.js';
import { POKEMONS, TYPE_COLORS } from './data/pokemons.js';
import { MenuScene }  from './scenes/MenuScene.js';
import { UIScene }    from './scenes/UIScene.js';
import { PrepScene }  from './scenes/PrepScene.js';
import { WildScene }  from './scenes/WildScene.js';
import { CombatScene } from './scenes/CombatScene.js';
import { MapScene }   from './map/MapScene.js';
import { StarterScene } from './scenes/StarterScene.js';
import { ArenaVictoryScene } from './scenes/ArenaVictoryScene.js';
import { ShopScene } from './scenes/ShopScene.js';

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.board         = null;
    this.selectedUnit  = null;
    this.bankUnits     = [];
    this.placedSprites = {};
    this.cellGraphics  = {};
    this.boardX        = 0;
    this.boardY        = 0;
  }
  init() {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
  }

  preload() {
    POKEMONS.forEach(m => {
      this.load.image(`monster_${m.id}`, m.spriteUrl);
    });
  }

  create() {
    // Réinitialise le zoom au cas où il aurait été modifié dans une scène précédente
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    // Réinitialisation complète à chaque lancement de la scène
    this.selectedUnit  = null;
    this.bankUnits     = [];
    this.placedSprites = {};
    this.cellGraphics  = {};

    // Récupère le starter et l'état de la run depuis le registre
    const starter      = this.registry.get('starterPokemon');
    const firstRun     = this.registry.get('firstEvent') !== true;

    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    this.add.text(W / 2, 14, 'PokeChess', {
      fontSize: '20px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 40, 'Phase 1', {
      fontSize: '13px', fill: '#718096', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    const boardW = GRID_COLS * (CELL_SIZE + GRID_GAP) - GRID_GAP;
    const boardX = Math.round((W - boardW) / 2);
    const boardY = 90;

    this.boardX = boardX;
    this.boardY = boardY;

    this.board = new Board(this, boardX, boardY);

    this.add.text(W / 2, boardY - 18, 'Votre terrain', {
      fontSize: '12px', fill: '#718096', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1);

    this._drawGrid(boardX, boardY);

    const boardH = GRID_ROWS * (CELL_SIZE + GRID_GAP) - GRID_GAP;
    const bankY  = boardY + boardH + 40;

    this.add.text(W / 2, bankY - 18, 'Banque — clic gauche pour sélectionner', {
      fontSize: '12px', fill: '#718096', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1);

    this._drawBank(boardX, bankY);

    // Info text — placé assez haut pour ne pas chevaucher le bouton
    this.infoText = this.add.text(W / 2, H - 50, 'Sélectionne un monstre dans la banque', {
      fontSize: '12px', fill: '#63b3ed', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(30);

    // Bouton centré en bas
    this.combatBtn = this.add.text(W / 2, H - 16, '[ ⚔ Lancer le combat ]', {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(30).setInteractive({ cursor: 'pointer' });

    this.combatBtn.on('pointerover', () => this.combatBtn.setStyle({ fill: '#fff' }));
    this.combatBtn.on('pointerout',  () => this.combatBtn.setStyle({ fill: '#ffd700' }));
    this.combatBtn.on('pointerdown', () => this._launchCombat());

    this.input.on('pointerdown', (ptr) => {
      if (ptr.rightButtonDown()) return;
      this._onGridClick(ptr, boardX, boardY);
    });

    this.input.on('pointerdown', (ptr) => {
      if (!ptr.rightButtonDown()) return;
      this._onRightClick(ptr, boardX, boardY);
    });

    this.game.canvas.addEventListener('contextmenu', e => e.preventDefault());

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }
  }

  _drawGrid(boardX, boardY) {
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const x = boardX + c * (CELL_SIZE + GRID_GAP);
        const y = boardY + r * (CELL_SIZE + GRID_GAP);
        const g = this.add.graphics();
        g.fillStyle(0x16213e, 0.9);
        g.fillRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);
        g.lineStyle(1.5, 0x334466, 1);
        g.strokeRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);
        this.cellGraphics[`${c}_${r}`] = g;
      }
    }
  }

  _updateCell(col, row, occupied) {
    const g = this.cellGraphics[`${col}_${row}`];
    if (!g) return;
    g.setVisible(!occupied);
  }

  _drawBank(startX, startY) {
    // Récupère la banque du joueur depuis le registre (initialisée avec le starter)
      const runState   = this.registry.get('runState') ?? {};
      const playerBank = runState.playerBank ?? [];

      const visiblePokemons = playerBank.filter(p => p.isInTeam === true);

      if (visiblePokemons.length === 0) return;

      const totalW  = visiblePokemons.length * (CELL_SIZE + GRID_GAP) - GRID_GAP;
      const offsetX = Math.round((this.scale.width - totalW) / 2);

    visiblePokemons.forEach((monsterData, i) => {
      const x = offsetX + i * (CELL_SIZE + GRID_GAP);
      const y = startY;
      const s = 12;

      const bg = this.add.graphics().setDepth(1);
      bg.fillStyle(0x16213e, 0.9);
      bg.fillRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);
      bg.lineStyle(1.5, 0x334466, 1);
      bg.strokeRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);

      const c1 = TYPE_COLORS[monsterData.types[0]] ?? 0x888888;
      const c2 = monsterData.types[1]
        ? (TYPE_COLORS[monsterData.types[1]] ?? 0x888888)
        : c1;

      const badge = this.add.graphics().setDepth(2);
      badge.fillStyle(c1, 0.9);
      badge.fillTriangle(x, y, x + s, y, x, y + s);
      badge.fillStyle(c1, 0.9);
      badge.fillTriangle(x + CELL_SIZE, y + CELL_SIZE, x + CELL_SIZE - s, y + CELL_SIZE, x + CELL_SIZE, y + CELL_SIZE - s);
      badge.fillStyle(c2, 0.9);
      badge.fillTriangle(x + CELL_SIZE, y, x + CELL_SIZE - s, y, x + CELL_SIZE, y + s);
      badge.fillStyle(c2, 0.9);
      badge.fillTriangle(x, y + CELL_SIZE, x + s, y + CELL_SIZE, x, y + CELL_SIZE - s);

      const img = this.add.image(
        Math.round(x + CELL_SIZE / 2),
        Math.round(y + CELL_SIZE / 2 - 6),
        `monster_${monsterData.id}`
      ).setDisplaySize(80, 80).setInteractive({ cursor: 'pointer' }).setDepth(3);

      const nameTag = this.add.text(
        Math.round(x + CELL_SIZE / 2),
        Math.round(y + CELL_SIZE - 6),
        monsterData.name,
        { fontSize: '11px', fill: '#a0aec0', fontFamily: 'sans-serif' }
      ).setOrigin(0.5, 1).setDepth(3);

      img.on('pointerdown', () => {
        this.selectedUnit = monsterData;

        // Reset toutes les bordures
        this.bankUnits.forEach(b => {
          b.bg.clear();
          b.bg.fillStyle(0x16213e, 0.9);
          b.bg.fillRoundedRect(b.x, b.y, CELL_SIZE, CELL_SIZE, 8);
          b.bg.lineStyle(1.5, 0x334466, 1);
          b.bg.strokeRoundedRect(b.x, b.y, CELL_SIZE, CELL_SIZE, 8);
        });

        // Surligne la sélection
        bg.clear();
        bg.fillStyle(0x16213e, 0.9);
        bg.fillRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);
        bg.lineStyle(2, 0xffd700, 1);
        bg.strokeRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);

        this.infoText.setText(
          `${monsterData.name} [${monsterData.types.join('/')}] — HP:${monsterData.stats.hp} ATK:${monsterData.stats.atk} · Clic gauche sur une case`
        );
      });

      this.bankUnits.push({ data: monsterData, img, bg, badge, nameTag, x, y, visible: true });
    });
  }

  _setBankCardVisible(monsterId, visible) {
    const card = this.bankUnits.find(b => b.data.id === monsterId);
    if (!card) return;
    card.bg.setVisible(visible);
    card.badge.setVisible(visible);
    card.img.setVisible(visible);
    card.nameTag.setVisible(visible);
    if (visible) card.img.setInteractive({ cursor: 'pointer' });
    else card.img.disableInteractive();
    card.visible = visible;
  }

  _onGridClick(ptr, boardX, boardY) {
    if (!this.selectedUnit) return;

    const relX = ptr.x - boardX;
    const relY = ptr.y - boardY;
    const col  = Math.floor(relX / (CELL_SIZE + GRID_GAP));
    const row  = Math.floor(relY / (CELL_SIZE + GRID_GAP));

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    const unit   = new Unit(this.selectedUnit, col, row);
    const placed = this.board.placeUnit(unit, col, row);

    if (placed) {
      this._updateCell(col, row, true);
      this._spawnUnitSprite(unit);
      this._setBankCardVisible(unit.id, false);
      this.infoText.setText(`${unit.name} placé · Clic droit pour le retirer`);
      this.selectedUnit = null;

      this.bankUnits.forEach(b => {
        b.bg.clear();
        b.bg.fillStyle(0x16213e, 0.9);
        b.bg.fillRoundedRect(b.x, b.y, CELL_SIZE, CELL_SIZE, 8);
        b.bg.lineStyle(1.5, 0x334466, 1);
        b.bg.strokeRoundedRect(b.x, b.y, CELL_SIZE, CELL_SIZE, 8);
      });
    } else {
      this.infoText.setText('Cellule déjà occupée !');
    }
  }

  _onRightClick(ptr, boardX, boardY) {
    const relX = ptr.x - boardX;
    const relY = ptr.y - boardY;
    const col  = Math.floor(relX / (CELL_SIZE + GRID_GAP));
    const row  = Math.floor(relY / (CELL_SIZE + GRID_GAP));

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    const unit = this.board.removeUnit(col, row);
    if (unit) {
      const key = `${col}_${row}`;
      const s   = this.placedSprites[key];
      if (s) {
        s.img.destroy();
        s.nameTag.destroy();
        s.corners.destroy();
        delete this.placedSprites[key];
      }
      this._updateCell(col, row, false);
      this._setBankCardVisible(unit.id, true);
      this.infoText.setText(`${unit.name} retiré — retourné dans la banque`);
    }
  }

  _spawnUnitSprite(unit) {
    const { x, y } = this.board.cellToPixel(unit.col, unit.row);
    const cx = x - CELL_SIZE / 2;
    const cy = y - CELL_SIZE / 2;
    const s  = 14;

    const c1 = TYPE_COLORS[unit.types[0]] ?? 0x888888;
    const c2 = unit.types[1]
      ? (TYPE_COLORS[unit.types[1]] ?? 0x888888)
      : c1;

    const corners = this.add.graphics().setDepth(10);
    corners.fillStyle(c1, 0.9);
    corners.fillTriangle(cx, cy, cx + s, cy, cx, cy + s);
    corners.fillStyle(c1, 0.9);
    corners.fillTriangle(cx + CELL_SIZE, cy + CELL_SIZE, cx + CELL_SIZE - s, cy + CELL_SIZE, cx + CELL_SIZE, cy + CELL_SIZE - s);
    corners.fillStyle(c2, 0.9);
    corners.fillTriangle(cx + CELL_SIZE, cy, cx + CELL_SIZE - s, cy, cx + CELL_SIZE, cy + s);
    corners.fillStyle(c2, 0.9);
    corners.fillTriangle(cx, cy + CELL_SIZE, cx + s, cy + CELL_SIZE, cx, cy + CELL_SIZE - s);

    const img = this.add.image(
      Math.round(x),
      Math.round(y - 6),
      `monster_${unit.id}`
    ).setDisplaySize(80, 80).setDepth(11);

    const nameTag = this.add.text(
      Math.round(x),
      Math.round(y + 30),
      unit.name,
      { fontSize: '11px', fill: '#e2e8f0', fontFamily: 'sans-serif' }
    ).setOrigin(0.5, 0.5).setDepth(12);

    this.placedSprites[`${unit.col}_${unit.row}`] = { img, nameTag, corners };
  }

  _launchCombat() {
    const placedUnits = this.board.getAllUnits();
    if (placedUnits.length === 0) {
      this.infoText.setText('Place au moins un monstre avant de combattre !');
      return;
    }

    // Met à jour runState avec les unités joueur
    const runState = this.registry.get('runState') ?? {};
    this.registry.set('runState', { ...runState, playerUnits: placedUnits });
    this.registry.set('playerUnits', placedUnits);

    this.scene.start('MapScene');
  }
}

const config = {
  type: Phaser.AUTO,
  width:  680,
  height: 520,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  input: {
    mouse: { preventDefaultWheel: true }
  },
  scene: [MenuScene, StarterScene, MapScene, UIScene, PrepScene, WildScene, ShopScene, CombatScene, ArenaVictoryScene]
};

new Phaser.Game(config);