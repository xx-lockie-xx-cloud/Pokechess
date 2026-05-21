// ─────────────────────────────────────────────────────────────────────────────
// CombatScene.js — version migrée HTML/CSS
//
// Changements par rapport à la version précédente :
//   - Ne lance plus UIScene (Phaser) → UIScene est le header HTML
//   - Ne lance plus MapScene/MenuScene directement → appelle window.UIManager
//   - Ne lance plus ArenaVictoryScene → appelle window.UIManager.show('arenaVictory')
//   - Tout le reste (combat engine, animator, sprites) est INCHANGÉ
// ─────────────────────────────────────────────────────────────────────────────

import { CombatEngine }   from '../combat/CombatEngine.js';
import { CombatAnimator } from '../combat/CombatAnimator.js';
import { addCoins }       from '../data/runState.js';
import { getArenaForMap } from '../data/arenas.js';
import { TYPE_COLORS }    from '../data/pokemons.js';
import { GRID_COLS, CELL_SIZE, GRID_GAP } from '../board.js';

const ROW_NEAR_OFFSET    =   5;
const ENEMY_ROW0_OFFSET  = -(ROW_NEAR_OFFSET + CELL_SIZE);
const ENEMY_ROW1_OFFSET  = -(ROW_NEAR_OFFSET + 2 * CELL_SIZE);
const PLAYER_ROW0_OFFSET =   ROW_NEAR_OFFSET;
const PLAYER_ROW1_OFFSET =   ROW_NEAR_OFFSET + CELL_SIZE;

export class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
    this.playerUnits        = [];
    this.enemyUnits         = [];
    this.trainerName        = 'Dresseur';
    this.mapNodes           = null;
    this.startNode          = null;
    this.mapIndex           = 0;
    this.nodeType           = 'combat';
    this.trainerArchetypeId = null;
    this.trainerSpriteKey   = null;
    this.trainerSpritePath  = null;
    this.playerField        = null;
    this.enemyField         = null;
    this.animator           = null;
    this.combatStarted      = false;
    this.phaseText          = null;
    this._syncEnabled       = false;
    this._syncTimeout       = null;
  }

  init(data) {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.playerUnits        = data.playerUnits        ?? [];
    this.enemyUnits         = data.enemyUnits         ?? [];
    this.trainerName        = data.trainerName        ?? 'Dresseur';
    this.mapNodes           = data.mapNodes           ?? null;
    this.startNode          = data.startNode          ?? null;
    this.mapIndex           = data.mapIndex           ?? 0;
    this.nodeType           = data.nodeType           ?? 'combat';
    this.trainerArchetypeId = data.trainerArchetypeId ?? null;
    this.combatStarted      = false;
    this._syncEnabled       = false;

    if (this.nodeType === 'boss') {
      const arena = getArenaForMap(this.mapIndex);
      this.trainerSpriteKey  = arena ? `champion_combat_${this.mapIndex}` : null;
      this.trainerSpritePath = arena?.championSpriteCombat ?? null;
    } else if (this.nodeType === 'combat' && this.trainerArchetypeId) {
      this.trainerSpriteKey  = `trainer_combat_${this.trainerArchetypeId}`;
      this.trainerSpritePath = `assets/trainers/combat/${this.trainerArchetypeId}_c.png`;
    } else {
      this.trainerSpriteKey  = null;
      this.trainerSpritePath = null;
    }
  }

  preload() {
    this.enemyUnits.forEach(u => {
      const key = `monster_${u.id}`;
      if (!this.textures.exists(key)) this.load.image(key, u.spriteUrl);
    });
    if (this.trainerSpriteKey && this.trainerSpritePath &&
        !this.textures.exists(this.trainerSpriteKey)) {
      this.load.image(this.trainerSpriteKey, this.trainerSpritePath);
    }
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    if (this.trainerSpriteKey && this.textures.exists(this.trainerSpriteKey)) {
      this.add.image(W * 0.14, H * 0.38, this.trainerSpriteKey)
        .setOrigin(0.5).setScale(3.5).setAlpha(0.80).setDepth(0);
    }

    this.add.text(W / 2, 14, 'PokeChess', {
      fontSize: '20px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(1);

    this.phaseText = this.add.text(W / 2, 40,
      `Combat contre ${this.trainerName}`, {
      fontSize: '13px', fill: '#fc5c65', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(1);

    this.add.text(W / 2, 66, 'Adversaire', {
      fontSize: '12px', fill: '#fc5c65', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(1);

    this.add.text(W / 2, H - 20, 'Votre équipe', {
      fontSize: '12px', fill: '#45aaf2', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(1);

    const sep = this.add.graphics().setDepth(1);
    sep.lineStyle(1, 0x334466, 0.5);
    sep.lineBetween(40, H / 2, W - 40, H / 2);

    this._spawnUnits(W, H);
    this.animator = new CombatAnimator(this);

    this._createButton(W / 2, H - 36, 'Lancer le combat', () => this._startCombat());

    // ✅ MIGRATION : plus de UIScene Phaser
    // Le header HTML est toujours visible (géré par UIManager)

    this._syncEnabled = true;
    this.registry.events.on('changedata-playerUnits', () => {
      if (!this._syncEnabled) return;
      if (this._syncTimeout) clearTimeout(this._syncTimeout);
      this._syncTimeout = setTimeout(() => {
        if (this._syncEnabled) this._syncPlayerUnits();
      }, 100);
    });
  }

  _spawnUnits(W, H) {
    const mid    = H / 2;
    const cellW  = CELL_SIZE + GRID_GAP;
    const totalW = GRID_COLS * cellW - GRID_GAP;
    const startX = Math.round((W - totalW) / 2);

    this.enemyField = this._createField(
      startX, this.enemyUnits,
      mid + ENEMY_ROW0_OFFSET, mid + ENEMY_ROW1_OFFSET, 0xfc5c65
    );
    this.playerField = this._createField(
      startX, this.playerUnits,
      mid + PLAYER_ROW0_OFFSET, mid + PLAYER_ROW1_OFFSET, 0x4a90d9
    );
  }

  _createField(startX, units, row0Y, row1Y, borderColor) {
    const scene       = this;
    const cellSize    = CELL_SIZE;
    const cellGap     = GRID_GAP;
    const cellObjects = {};
    const sprites     = {};

    const drawUnit = (unit) => {
      const col = unit.col, row = unit.row;
      const key = `${col}_${row}`;

      if (cellObjects[key]) {
        Object.values(cellObjects[key]).forEach(o => {
          if (o && typeof o.destroy === 'function') o.destroy();
        });
      }

      const x = startX + col * (cellSize + cellGap);
      const y = row === 0 ? row0Y : row1Y;

      const bg = scene.add.graphics().setDepth(1);
      bg.fillStyle(0x16213e, 0.9);
      bg.fillRoundedRect(x, y, cellSize, cellSize, 8);
      bg.lineStyle(1.5, borderColor, 1);
      bg.strokeRoundedRect(x, y, cellSize, cellSize, 8);

      const s  = 12;
      const c1 = TYPE_COLORS[unit.types[0]] ?? 0x888888;
      const c2 = unit.types[1] ? (TYPE_COLORS[unit.types[1]] ?? 0x888888) : c1;
      const corners = scene.add.graphics().setDepth(2);
      corners.fillStyle(c1, 0.9);
      corners.fillTriangle(x, y, x + s, y, x, y + s);
      corners.fillStyle(c1, 0.9);
      corners.fillTriangle(x + cellSize, y + cellSize, x + cellSize - s, y + cellSize, x + cellSize, y + cellSize - s);
      corners.fillStyle(c2, 0.9);
      corners.fillTriangle(x + cellSize, y, x + cellSize - s, y, x + cellSize, y + s);
      corners.fillStyle(c2, 0.9);
      corners.fillTriangle(x, y + cellSize, x + s, y + cellSize, x, y + cellSize - s);

      const texKey = `monster_${unit.id}`;
      const sprite = scene.add.image(
        Math.round(x + cellSize / 2),
        Math.round(y + cellSize / 2 - 6),
        scene.textures.exists(texKey) ? texKey : '__DEFAULT'
      ).setDisplaySize(cellSize - 12, cellSize - 12).setDepth(10);

      const nameTag = scene.add.text(
        Math.round(x + cellSize / 2),
        Math.round(y + cellSize - 6),
        unit.name,
        { fontSize: '9px', fill: '#e2e8f0', fontFamily: 'sans-serif' }
      ).setOrigin(0.5, 1).setDepth(11);

      cellObjects[key] = { bg, corners, sprite, nameTag };
      const uid = unit.uid ?? `${unit.id}_${col}_${row}`;
      sprites[uid] = sprite;
      return sprite;
    };

    units.forEach(unit => drawUnit(unit));

    return {
      units, sprites, cellObjects,
      getSpriteMap(side) {
        const map = {};
        Object.entries(sprites).forEach(([uid, sprite]) => {
          map[`${side}_${uid}`] = sprite;
        });
        return map;
      },
      destroy() {
        Object.values(cellObjects).forEach(obj => {
          Object.values(obj).forEach(o => {
            if (o && typeof o.destroy === 'function') o.destroy();
          });
        });
      },
    };
  }

  _syncPlayerUnits() {
    const newUnits = this.registry.get('playerUnits') ?? [];
    if (newUnits.length === 0) return;
    this.playerUnits = newUnits;
    if (this.playerField) this.playerField.destroy();
    const W = this.scale.width, H = this.scale.height, mid = H / 2;
    const cellW  = CELL_SIZE + GRID_GAP;
    const totalW = GRID_COLS * cellW - GRID_GAP;
    const startX = Math.round((W - totalW) / 2);
    this.playerField = this._createField(
      startX, newUnits,
      mid + PLAYER_ROW0_OFFSET, mid + PLAYER_ROW1_OFFSET, 0x4a90d9
    );
  }

  _createButton(x, y, label, onClick) {
    const btn = this.add.text(x, y, `[ ${label} ]`, {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(30).setInteractive({ cursor: 'pointer' });
    btn.on('pointerover',  () => btn.setStyle({ fill: '#fff' }));
    btn.on('pointerout',   () => btn.setStyle({ fill: '#ffd700' }));
    btn.on('pointerdown',  () => { btn.destroy(); onClick(); });
    return btn;
  }

  _startCombat() {
    this._syncEnabled = false;
    if (this._syncTimeout) clearTimeout(this._syncTimeout);
    this.combatStarted = true;
    this.phaseText.setText('Combat en cours...');

    const playerForEngine = this.playerUnits.map(u => ({ ...u, attributes: u.attributes ?? [] }));
    const enemyForEngine  = this.enemyUnits.map(u  => ({ ...u, attributes: u.attributes ?? [] }));

    const engine          = new CombatEngine(playerForEngine, enemyForEngine);
    const { log, winner } = engine.resolve();

    const sprites = {
      ...this.playerField.getSpriteMap('player'),
      ...this.enemyField.getSpriteMap('enemy'),
    };

    const allUnits = [
      ...engine.playerUnits.map((u, i) => ({
        ...u, side: 'player',
        uid: this.playerUnits[i]?.uid ?? u.uid ?? `${u.id}_${u.col}_${u.row}`
      })),
      ...engine.enemyUnits.map((u, i) => ({
        ...u, side: 'enemy',
        uid: this.enemyUnits[i]?.uid ?? u.uid ?? `${u.id}_${u.col}_${u.row}`
      })),
    ];

    this.animator.createHpBars(sprites, allUnits);
    this.animator.play(log, sprites, () => this._onCombatEnd(winner));
  }

  _onCombatEnd(winner) {
    const W = this.scale.width, H = this.scale.height;
    const isWin = winner === 'player';
    const color = isWin ? '#44cc44' : '#fc5c65';

    if (isWin) {
      addCoins(this.registry, 3);
      const reward = this.add.text(40, H / 2, '+3 💰', {
        fontSize: '20px', fill: '#ffd700', fontFamily: 'sans-serif',
        fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(50);
      this.tweens.add({
        targets: reward, y: 20, alpha: 0, duration: 1500, ease: 'Power2',
        onComplete: () => reward.destroy(),
      });
    }

    this.phaseText.setText(isWin ? 'Victoire !' : 'Défaite');
    this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setDepth(40);
    this.add.text(W / 2, H / 2 - 24, isWin ? '🏆 Victoire !' : '💀 Défaite...', {
      fontSize: '28px', fill: color, fontFamily: 'sans-serif'
    }).setOrigin(0.5).setDepth(41);

    // ✅ MIGRATION : appelle UIManager au lieu de scene.start(...)
    const combatData = {
      mapNodes:  this.mapNodes,
      startNode: this.startNode,
      mapIndex:  this.mapIndex,
      nodeType:  this.nodeType,
    };

    if (isWin) {
      const isBoss = this.nodeType === 'boss';
      const btnLabel = isBoss ? '🏆 Badge obtenu !' : 'Continuer';

      this._createButton(W / 2, H / 2 + 40, btnLabel, () => {
        if (window.UIManager) {
          window.UIManager.onCombatEnd('player', combatData);
        }
      });
    } else {
      this._createButton(W / 2, H / 2 + 40, 'Retour au menu', () => {
        this.registry.reset();
        if (window.UIManager) {
          window.UIManager.onCombatEnd('enemy', combatData);
        }
      });
    }
  }
}
