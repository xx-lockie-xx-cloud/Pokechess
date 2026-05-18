// ─────────────────────────────────────────────────────────────────────────────
// CombatScene.js
// Scène de combat — affiche les deux équipes et anime le combat automatique.
// ─────────────────────────────────────────────────────────────────────────────

import { CombatEngine }   from '../combat/CombatEngine.js';
import { CombatAnimator } from '../combat/CombatAnimator.js';
import { addCoins }       from '../data/runState.js';
import { getArenaForMap } from '../data/arenas.js';
import { TYPE_COLORS }    from '../data/pokemons.js';
import { GRID_COLS, CELL_SIZE, GRID_GAP } from '../board.js';

// ── Offsets verticaux des rangées depuis H/2 ──────────────────────────────────
// ⚙️  Modifie ces valeurs pour ajuster le placement
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

    // Sprite du dresseur ennemi
    this.trainerSpriteKey   = null;
    this.trainerSpritePath  = null;

    // Terrains
    this.playerField        = null;
    this.enemyField         = null;

    // Animateur
    this.animator           = null;

    // État du combat
    this.combatStarted      = false;
    this.phaseText          = null;

    // Anti-rebond sync PrepScene
    this._syncEnabled       = false;
    this._syncTimeout       = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // init()
  // ─────────────────────────────────────────────────────────────────────────
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

    // ── Détermine le sprite du dresseur ───────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // preload()
  // ─────────────────────────────────────────────────────────────────────────
  preload() {
    // Sprites pokémons ennemis
    this.enemyUnits.forEach(u => {
      const key = `monster_${u.id}`;
      if (!this.textures.exists(key)) this.load.image(key, u.spriteUrl);
    });

    // Sprite du dresseur (arrière-plan)
    if (this.trainerSpriteKey && this.trainerSpritePath &&
        !this.textures.exists(this.trainerSpriteKey)) {
      this.load.image(this.trainerSpriteKey, this.trainerSpritePath);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────
  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Fond ─────────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    // ── Sprite du dresseur en arrière-plan ────────────────────────────────
    if (this.trainerSpriteKey && this.textures.exists(this.trainerSpriteKey)) {
      this.add.image(W * 0.14, H * 0.38, this.trainerSpriteKey)
        .setOrigin(0.5)
        .setScale(3.5)
        .setAlpha(0.80)
        .setDepth(0);
    }

    // ── Titre ─────────────────────────────────────────────────────────────
    this.add.text(W / 2, 14, 'PokeChess', {
      fontSize: '20px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(1);

    this.phaseText = this.add.text(W / 2, 40,
      `Combat contre ${this.trainerName}`, {
      fontSize: '13px', fill: '#fc5c65', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(1);

    // ── Labels équipes ────────────────────────────────────────────────────
    this.add.text(W / 2, 66, 'Adversaire', {
      fontSize: '12px', fill: '#fc5c65', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(1);

    this.add.text(W / 2, H - 20, 'Votre équipe', {
      fontSize: '12px', fill: '#45aaf2', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(1);

    // ── Ligne de séparation ───────────────────────────────────────────────
    const sep = this.add.graphics().setDepth(1);
    sep.lineStyle(1, 0x334466, 0.5);
    sep.lineBetween(40, H / 2, W - 40, H / 2);

    // ── Terrains ──────────────────────────────────────────────────────────
    this._spawnUnits(W, H);

    // ── Animateur (sans barres de vie — créées au lancement du combat) ────
    this.animator = new CombatAnimator(this);

    // ── Bouton lancer le combat ───────────────────────────────────────────
    this._createButton(W / 2, H - 36, 'Lancer le combat', () => this._startCombat());

    // ── UIScene ───────────────────────────────────────────────────────────
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }
    this.scene.bringToTop('UIScene');

    // ── Sync depuis PrepScene avec anti-rebond ────────────────────────────
    this._syncEnabled = true;
    this.registry.events.on('changedata-playerUnits', () => {
      if (!this._syncEnabled) return;
      if (this._syncTimeout) clearTimeout(this._syncTimeout);
      this._syncTimeout = setTimeout(() => {
        if (this._syncEnabled) this._syncPlayerUnits();
      }, 100);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _spawnUnits() — crée les deux terrains
  // ─────────────────────────────────────────────────────────────────────────
  _spawnUnits(W, H) {
    const mid    = H / 2;
    const cellW  = CELL_SIZE + GRID_GAP;
    const totalW = GRID_COLS * cellW - GRID_GAP;
    const startX = Math.round((W - totalW) / 2);

    this.enemyField = this._createField(
      startX, this.enemyUnits,
      mid + ENEMY_ROW0_OFFSET,
      mid + ENEMY_ROW1_OFFSET,
      0xfc5c65
    );

    this.playerField = this._createField(
      startX, this.playerUnits,
      mid + PLAYER_ROW0_OFFSET,
      mid + PLAYER_ROW1_OFFSET,
      0x4a90d9
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _createField() — terrain avec rangées à Y fixes
  // Retourne un objet avec getSpriteMap() et destroy()
  // ─────────────────────────────────────────────────────────────────────────
  _createField(startX, units, row0Y, row1Y, borderColor) {
    const scene       = this;
    const cellSize    = CELL_SIZE;
    const cellGap     = GRID_GAP;
    const cellObjects = {};
    const sprites     = {};   // uid → PhaserImage

    const drawUnit = (unit) => {
      const col = unit.col;
      const row = unit.row;
      const key = `${col}_${row}`;

      // Détruit l'ancien si existe
      if (cellObjects[key]) {
        Object.values(cellObjects[key]).forEach(o => {
          if (o && typeof o.destroy === 'function') o.destroy();
        });
      }

      const x = startX + col * (cellSize + cellGap);
      const y = row === 0 ? row0Y : row1Y;

      // Fond de cellule
      const bg = scene.add.graphics().setDepth(1);
      bg.fillStyle(0x16213e, 0.9);
      bg.fillRoundedRect(x, y, cellSize, cellSize, 8);
      bg.lineStyle(1.5, borderColor, 1);
      bg.strokeRoundedRect(x, y, cellSize, cellSize, 8);

      // Coins de type
      const s  = 12;
      const c1 = TYPE_COLORS[unit.types[0]] ?? 0x888888;
      const c2 = unit.types[1]
        ? (TYPE_COLORS[unit.types[1]] ?? 0x888888) : c1;

      const corners = scene.add.graphics().setDepth(2);
      corners.fillStyle(c1, 0.9);
      corners.fillTriangle(x, y, x + s, y, x, y + s);
      corners.fillStyle(c1, 0.9);
      corners.fillTriangle(
        x + cellSize, y + cellSize,
        x + cellSize - s, y + cellSize,
        x + cellSize, y + cellSize - s
      );
      corners.fillStyle(c2, 0.9);
      corners.fillTriangle(x + cellSize, y, x + cellSize - s, y, x + cellSize, y + s);
      corners.fillStyle(c2, 0.9);
      corners.fillTriangle(x, y + cellSize, x + s, y + cellSize, x, y + cellSize - s);

      // Sprite pokémon
      const texKey = `monster_${unit.id}`;
      const sprite = scene.add.image(
        Math.round(x + cellSize / 2),
        Math.round(y + cellSize / 2 - 6),
        scene.textures.exists(texKey) ? texKey : '__DEFAULT'
      ).setDisplaySize(cellSize - 12, cellSize - 12).setDepth(10);

      // Nom
      const nameTag = scene.add.text(
        Math.round(x + cellSize / 2),
        Math.round(y + cellSize - 6),
        unit.name,
        { fontSize: '9px', fill: '#e2e8f0', fontFamily: 'sans-serif' }
      ).setOrigin(0.5, 1).setDepth(11);

      cellObjects[key] = { bg, corners, sprite, nameTag };

      // Clé unique par unité : uid si disponible, sinon construit depuis id+col+row
      const uid = unit.uid ?? `${unit.id}_${col}_${row}`;
      sprites[uid] = sprite;

      return sprite;
    };

    // Dessine toutes les unités
    units.forEach(unit => drawUnit(unit));

    return {
      units,
      sprites,
      cellObjects,

      // Retourne { 'side_uid': sprite } pour CombatAnimator
      getSpriteMap(side) {
        const map = {};
        Object.entries(sprites).forEach(([uid, sprite]) => {
          map[`${side}_${uid}`] = sprite;
        });
        return map;
      },

      // Détruit tous les objets Phaser
      destroy() {
        Object.values(cellObjects).forEach(obj => {
          Object.values(obj).forEach(o => {
            if (o && typeof o.destroy === 'function') o.destroy();
          });
        });
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _syncPlayerUnits() — recharge le terrain joueur depuis le registre
  // Appelé quand PrepScene modifie l'équipe avant le combat
  // ─────────────────────────────────────────────────────────────────────────
  _syncPlayerUnits() {
    const newUnits = this.registry.get('playerUnits') ?? [];
    if (newUnits.length === 0) return;

    this.playerUnits = newUnits;
    if (this.playerField) this.playerField.destroy();

    const W      = this.scale.width;
    const H      = this.scale.height;
    const mid    = H / 2;
    const cellW  = CELL_SIZE + GRID_GAP;
    const totalW = GRID_COLS * cellW - GRID_GAP;
    const startX = Math.round((W - totalW) / 2);

    this.playerField = this._createField(
      startX, newUnits,
      mid + PLAYER_ROW0_OFFSET,
      mid + PLAYER_ROW1_OFFSET,
      0x4a90d9
    );
    // Pas de _rebuildHpBars ici — les barres sont créées uniquement dans _startCombat
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _createButton() — bouton texte générique
  // ─────────────────────────────────────────────────────────────────────────
  _createButton(x, y, label, onClick) {
    const btn = this.add.text(x, y, `[ ${label} ]`, {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(30).setInteractive({ cursor: 'pointer' });

    btn.on('pointerover',  () => btn.setStyle({ fill: '#fff' }));
    btn.on('pointerout',   () => btn.setStyle({ fill: '#ffd700' }));
    btn.on('pointerdown',  () => { btn.destroy(); onClick(); });
    return btn;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _startCombat() — résout le combat et lance les animations
  // ─────────────────────────────────────────────────────────────────────────
  _startCombat() {
    // Désactive la sync depuis PrepScene
    this._syncEnabled = false;
    if (this._syncTimeout) clearTimeout(this._syncTimeout);
    this.combatStarted = true;
    this.phaseText.setText('Combat en cours...');

    // Prépare les copies pour le moteur
    const playerForEngine = this.playerUnits.map(u => ({
      ...u, attributes: u.attributes ?? []
    }));
    const enemyForEngine = this.enemyUnits.map(u => ({
      ...u, attributes: u.attributes ?? []
    }));

    // Résolution complète (instantanée)
    const engine          = new CombatEngine(playerForEngine, enemyForEngine);
    const { log, winner } = engine.resolve();

    // ── Sprites depuis les terrains ───────────────────────────────────────
    const sprites = {
      ...this.playerField.getSpriteMap('player'),
      ...this.enemyField.getSpriteMap('enemy'),
    };

    // ── allUnits : reconstruit avec uid depuis les unités originales ──────
    // Le CombatEngine préserve le uid grâce à _copyUnit() corrigé,
    // mais on le force depuis les unités originales par sécurité
    const allUnits = [
      ...engine.playerUnits.map((u, i) => ({
        ...u,
        side: 'player',
        uid:  this.playerUnits[i]?.uid ?? u.uid ?? `${u.id}_${u.col}_${u.row}`,
      })),
      ...engine.enemyUnits.map((u, i) => ({
        ...u,
        side: 'enemy',
        uid:  this.enemyUnits[i]?.uid ?? u.uid ?? `${u.id}_${u.col}_${u.row}`,
      })),
    ];

    // ── Crée les barres de vie UNE SEULE FOIS ici ────────────────────────
    this.animator.createHpBars(sprites, allUnits);

    // Lance les animations
    this.animator.play(log, sprites, () => this._onCombatEnd(winner));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _onCombatEnd() — affiche le résultat et propose la navigation
  // ─────────────────────────────────────────────────────────────────────────
  _onCombatEnd(winner) {
    const W     = this.scale.width;
    const H     = this.scale.height;
    const isWin = winner === 'player';
    const color = isWin ? '#44cc44' : '#fc5c65';

    if (isWin) {
      addCoins(this.registry, 3);

      // Animation +3 💰
      const reward = this.add.text(40, H / 2, '+3 💰', {
        fontSize: '20px', fill: '#ffd700',
        fontFamily: 'sans-serif', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(50);

      this.tweens.add({
        targets:    reward,
        y:          20,
        alpha:      0,
        duration:   1500,
        ease:       'Power2',
        onComplete: () => reward.destroy(),
      });
    }

    this.phaseText.setText(isWin ? 'Victoire !' : 'Défaite');

    // Overlay semi-transparent
    this.add.rectangle(0, 0, W, H, 0x000000, 0.55)
      .setOrigin(0).setDepth(40);

    this.add.text(W / 2, H / 2 - 24,
      isWin ? '🏆 Victoire !' : '💀 Défaite...', {
      fontSize: '28px', fill: color, fontFamily: 'sans-serif'
    }).setOrigin(0.5).setDepth(41);

    if (isWin) {
      const isBoss = this.nodeType === 'boss';

      if (isBoss) {
        // Victoire sur l'arène → écran de transition avec badge
        this._createButton(W / 2, H / 2 + 40, '🏆 Badge obtenu !', () => {
          this.scene.stop('UIScene');
          this.scene.start('ArenaVictoryScene', { mapIndex: this.mapIndex });
        });
      } else {
        // Victoire normale → retour à la map
        this._createButton(W / 2, H / 2 + 40, 'Continuer', () => {
          this.scene.stop('UIScene');
          this.scene.start('MapScene', {
            mapNodes:  this.mapNodes,
            startNode: this.startNode,
            mapIndex:  this.mapIndex,
          });
        });
      }
    } else {
      // Défaite → menu principal
      this._createButton(W / 2, H / 2 + 40, 'Retour au menu', () => {
        this.scene.stop('UIScene');
        this.scene.stop('PrepScene');
        this.registry.reset();
        this.scene.start('MenuScene');
      });
    }
  }
}