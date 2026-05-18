// ─────────────────────────────────────────────────────────────────────────────
// MapScene.js
// Affiche la map de progression style Slay the Spire.
// Nœuds avec sprites de dresseurs HGSS pour les combats et champions d'arène.
// ─────────────────────────────────────────────────────────────────────────────

import { MapGenerator, NODE_TYPES } from './MapGenerator.js';
import { ParallaxBackground }       from '../utils/ParallaxBackground.js';
import { getRunState }              from '../data/runState.js';
import { TRAINER_ARCHETYPES }       from '../data/trainers.js';
import { getArenaForMap }           from '../data/arenas.js';

const NODE_RADIUS = 28;
const COL_GAP     = 90;
const ROW_GAP     = 80;
const MARGIN_X    = 70;
const MARGIN_Y    = 40;
const TITLE_H     = 62;

const NODE_STYLE = {
  start:  { emoji: '🏠',  color: 0x27ae60, glowColor: 0x2ecc71, label: 'Départ'   },
  combat: { emoji: '⚔️',  color: 0xe74c3c, glowColor: 0xff6b6b, label: 'Dresseur' },
  shop:   { emoji: '🛒',  color: 0x2980b9, glowColor: 0x74b9ff, label: 'Shop'      },
  item:   { emoji: '🎒',  color: 0x8e44ad, glowColor: 0xd980fa, label: 'Objet'     },
  boss:   { emoji: '👑',  color: 0xf39c12, glowColor: 0xffd700, label: 'Arène'     },
  random: { emoji: '🎲',  color: 0x16a085, glowColor: 0x1abc9c, label: 'Mystère'   },
};

export class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' });
    this.mapNodes     = [];
    this.startNode    = null;
    this.mapIndex     = 0;
    this.parallax     = null;
    this.mapContainer = null;
    this.isDragging   = false;
    this.dragStartX   = 0;
    this.camStartX    = 0;
    this.minScrollX   = 0;
    this.maxScrollX   = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // init()
  // ─────────────────────────────────────────────────────────────────────────
  init(data) {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.mapIndex = 0;

    if (data?.mapNodes) {
      this.mapNodes  = data.mapNodes;
      this.startNode = data.startNode ?? null;
      this.mapIndex  = data.mapIndex  ?? 0;
    } else {
      const state     = getRunState(this.registry);
      this.mapIndex   = data?.mapIndex ?? state.currentMap ?? 0;
      const prevArena = data?.prevArena ?? null;

      const gen      = new MapGenerator(5, 3);
      this.mapNodes  = gen.generate(this.mapIndex, prevArena);
      this.startNode = gen._startNode;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // preload() — charge le parallaxe + sprites dresseurs
  // ─────────────────────────────────────────────────────────────────────────
  preload() {
    // Parallaxe
    if (!this.textures.exists('map_back'))
      this.load.image('map_back',   'assets/backgrounds/map/back.png');
    if (!this.textures.exists('map_middle'))
      this.load.image('map_middle', 'assets/backgrounds/map/middle.png');
    if (!this.textures.exists('map_front'))
      this.load.image('map_front',  'assets/backgrounds/map/front.png');

    // Sprites dresseurs génériques (nœuds combat)
    TRAINER_ARCHETYPES.forEach(a => {
      const key = `trainer_map_${a.id}`;
      if (a.spriteMap && !this.textures.exists(key)) {
        this.load.image(key, a.spriteMap);
      }
    });

    // Sprite du champion d'arène (nœud boss)
    const arena = getArenaForMap(this.mapIndex);
    if (arena?.championSprite) {
      const key = `champion_map_${this.mapIndex}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, arena.championSprite);
      }
    }

    if (this.startNode?.prevArena) {
    const prev = this.startNode.prevArena;

      // Sprite map du champion (réutilise la clé déjà chargée si disponible)
      const champKey = `champion_map_${prev.id - 1}`;
      if (prev.championSprite && !this.textures.exists(champKey)) {
        this.load.image(champKey, prev.championSprite);
      }

      // Badge
      const badgeKey = `badge_${prev.id}`;
      if (prev.badgeSprite && !this.textures.exists(badgeKey)) {
        this.load.image(badgeKey, prev.badgeSprite);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────
  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Parallaxe ─────────────────────────────────────────────────────────
    this.parallax = new ParallaxBackground(this, [
      { key: 'map_back',   scrollFactor: 0.05, alpha: 1   },
      { key: 'map_middle', scrollFactor: 0.15, alpha: 0.9 },
      { key: 'map_front',  scrollFactor: 0.3,  alpha: 1   },
    ]);

    this.add.rectangle(0, 0, W, H, 0x000000, 0.45)
      .setOrigin(0).setDepth(-9).setScrollFactor(0);

    // ── Bandeau titre fixe ────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, TITLE_H, 0x000000, 0.65)
      .setOrigin(0).setDepth(19).setScrollFactor(0);

    this.add.text(W / 2, 14, 'PokeChess', {
      fontSize: '20px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(20).setScrollFactor(0);

    this.add.text(W / 2, 40,
      `Route ${this.mapIndex + 1} — Choisissez votre prochain événement`, {
      fontSize: '12px', fill: '#a0aec0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(20).setScrollFactor(0);

    // ── Calcul scroll ─────────────────────────────────────────────────────
    const totalCols = this.mapNodes.length + 2;
    const mapW      = totalCols * (NODE_RADIUS * 2 + COL_GAP) + MARGIN_X;
    this.minScrollX = 0;
    this.maxScrollX = Math.max(0, mapW - W);
    this.cameras.main.setBounds(0, 0, Math.max(mapW, W), H);

    // ── Conteneur map ─────────────────────────────────────────────────────
    this.mapContainer = this.add.container(0, 0).setDepth(5);

    this._drawConnections();
    this._drawNodes();

    // ── UIScene ───────────────────────────────────────────────────────────
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    // ── Navigation molette ────────────────────────────────────────────────
    this.input.on('wheel', (ptr, objs, dx, dy) => {
      const newX = Phaser.Math.Clamp(
        this.cameras.main.scrollX + dy * 1.5,
        this.minScrollX, this.maxScrollX
      );
      this.cameras.main.setScroll(newX, 0);
    });

    // ── Navigation clic-glisser ───────────────────────────────────────────
    this.input.on('pointerdown', ptr => {
      this.isDragging = true;
      this.dragStartX = ptr.x;
      this.camStartX  = this.cameras.main.scrollX;
    });
    this.input.on('pointermove', ptr => {
      if (!this.isDragging) return;
      const newX = Phaser.Math.Clamp(
        this.camStartX + (this.dragStartX - ptr.x),
        this.minScrollX, this.maxScrollX
      );
      this.cameras.main.setScroll(newX, 0);
    });
    this.input.on('pointerup', () => { this.isDragging = false; });
  }

  update(time, delta) {
    if (this.parallax) this.parallax.update(delta, 15);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  EMPREINTES DE PAS
  // ═════════════════════════════════════════════════════════════════════════

  _drawConnections() {
    // Depuis le nœud de départ
    if (this.startNode) {
      this.startNode.connections.forEach(targetId => {
        const [tc, tr] = targetId.split('_').map(Number);
        const target   = this.mapNodes[tc]?.[tr];
        if (!target) return;
        this._drawFootprints(this._nodePos(this.startNode), this._nodePos(target), true);
      });
    }

    // Entre colonnes normales
    this.mapNodes.forEach(col => {
      col.forEach(node => {
        node.connections.forEach(targetId => {
          const [tc, tr] = targetId.split('_').map(Number);
          const target   = this.mapNodes[tc]?.[tr];
          if (!target) return;
          const active = node.visited || (node.available && !node.visited);
          this._drawFootprints(this._nodePos(node), this._nodePos(target), active);
        });
      });
    });
  }

  _drawFootprints(from, to, active) {
    const steps = 5;
    for (let i = 1; i < steps; i++) {
      const t      = i / steps;
      const x      = Phaser.Math.Linear(from.x, to.x, t);
      const y      = Phaser.Math.Linear(from.y, to.y, t);
      const angle  = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
      const offset = (i % 2 === 0 ? 5 : -5);
      const px     = x + Math.cos(angle + Math.PI / 2) * offset;
      const py     = y + Math.sin(angle + Math.PI / 2) * offset;

      const foot = this.add.graphics().setDepth(2).setAlpha(active ? 0.9 : 0.5);
      foot.fillStyle(active ? 0xf5e642 : 0xaab0c4, 1);
      foot.fillEllipse(px, py, 8, 5);
      foot.fillEllipse(px - Math.cos(angle) * 5, py - Math.sin(angle) * 5, 6, 4);
      this.mapContainer.add(foot);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  NŒUDS
  // ═════════════════════════════════════════════════════════════════════════

  _drawNodes() {
    if (this.startNode) this._drawNode(this.startNode);
    this.mapNodes.forEach(col => col.forEach(node => this._drawNode(node)));
  }

  _drawNode(node) {
    const { x, y }   = this._nodePos(node);
    const style       = NODE_STYLE[node.type] ?? NODE_STYLE.combat;
    const isBoss      = node.type === NODE_TYPES.BOSS;
    const isStart     = node.type === NODE_TYPES.START;
    const isAvailable = node.available && !node.visited;
    const isVisited   = node.visited;
    const nodeAlpha   = isAvailable || isStart ? 1 : 0.35;

    // ── Cercle de fond ────────────────────────────────────────────────────
    const circle = this.add.graphics().setDepth(3);

    if (isAvailable) {
      circle.fillStyle(style.glowColor, 0.18);
      circle.fillCircle(x, y, NODE_RADIUS + 9);
    }

    circle.fillStyle(0x000000, 0.35);
    circle.fillCircle(x + 3, y + 3, NODE_RADIUS);

    const bgColor = isVisited   ? 0x2d3748 :
                    isAvailable ? style.color :
                    isStart     ? style.color : 0x1a202c;
    circle.fillStyle(bgColor, isStart ? 0.7 : isAvailable ? 1 : 0.4);
    circle.fillCircle(x, y, NODE_RADIUS);

    if (isAvailable) {
      circle.fillStyle(0xffffff, 0.12);
      circle.fillEllipse(x - 5, y - 10, NODE_RADIUS * 0.75, NODE_RADIUS * 0.4);
    }

    const borderColor = isAvailable ? style.glowColor :
                        isVisited   ? 0x4a5568 :
                        isStart     ? style.glowColor : 0x2d3748;
    circle.lineStyle(isBoss ? 3 : 2, borderColor, isAvailable || isStart ? 1 : 0.25);
    circle.strokeCircle(x, y, NODE_RADIUS);

    if (isBoss && isAvailable) {
      circle.lineStyle(1.5, 0xffd700, 0.5);
      circle.strokeCircle(x, y, NODE_RADIUS + 6);
      circle.lineStyle(1, 0xffd700, 0.2);
      circle.strokeCircle(x, y, NODE_RADIUS + 11);
    }

    this.mapContainer.add(circle);

    // ── Contenu du nœud (sprite ou emoji) ─────────────────────────────────
    this._drawNodeContent(node, x, y, isBoss, isStart, isAvailable, nodeAlpha);

    // ── Label sous le nœud ────────────────────────────────────────────────
    this._drawNodeLabel(node, x, y, isBoss, isStart, isAvailable, isVisited);

    // ── Zone de clic ──────────────────────────────────────────────────────
    if (isAvailable) {
      this._addClickZone(node, x, y, circle, style, isBoss);
    }
  }

  // ── Contenu : sprite dresseur ou emoji selon le type ─────────────────
  _drawNodeContent(node, x, y, isBoss, isStart, isAvailable, nodeAlpha) {
    const spriteSize     = NODE_RADIUS * 1.7;
    const spriteSizeBoss = NODE_RADIUS * 1.9;

    if (node.type === NODE_TYPES.COMBAT && node.trainer?.archetypeId) {
      // ── Sprite dresseur générique ──────────────────────────────────────
      const key = `trainer_map_${node.trainer.archetypeId}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(x, y, key)
          .setDisplaySize(spriteSize, spriteSize)
          .setDepth(4).setAlpha(nodeAlpha);
        this.mapContainer.add(img);
        return;
      }

    } else if (isBoss) {
      // ── Sprite champion d'arène ────────────────────────────────────────
      const key = `champion_map_${this.mapIndex}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(x, y, key)
          .setDisplaySize(spriteSizeBoss, spriteSizeBoss)
          .setDepth(4).setAlpha(nodeAlpha);
        this.mapContainer.add(img);
        return;
      }

    } else if (isStart && node.prevArena) {
      // ── Badge de l'arène précédente ────────────────────────────────────
      const prev      = node.prevArena;
      const champKey  = `champion_map_${prev.id - 1}`;
      const badgeKey  = `badge_${prev.id}`;

      // Sprite du champion vaincu (petit, centré dans le nœud)
      if (this.textures.exists(champKey)) {
        const champImg = this.add.image(x, y - 4, champKey)
          .setDisplaySize(NODE_RADIUS * 1.5, NODE_RADIUS * 1.5)
          .setDepth(4).setAlpha(0.9);
        this.mapContainer.add(champImg);
      }

      // Badge dans le coin supérieur droit du nœud
      if (this.textures.exists(badgeKey)) {
        const badgeImg = this.add.image(
          x + NODE_RADIUS * 0.6,
          y - NODE_RADIUS * 0.6,
          badgeKey
        ).setDisplaySize(16, 16).setDepth(5);
        this.mapContainer.add(badgeImg);
      } else {
        // Fallback emoji badge
        const badgeEmoji = this.add.text(
          x + NODE_RADIUS * 0.5,
          y - NODE_RADIUS * 0.5,
          prev.badgeEmoji,
          { fontSize: '12px', fontFamily: 'sans-serif' }
        ).setOrigin(0.5).setDepth(5);
        this.mapContainer.add(badgeEmoji);
      }

      return;
    }

    // ── Fallback emoji pour tous les autres cas ────────────────────────
    const style     = NODE_STYLE[node.type] ?? NODE_STYLE.combat;
    const emojiSize = isBoss ? '22px' : '18px';
    const emoji     = this.add.text(x, y - 4, style.emoji, {
      fontSize: emojiSize, fontFamily: 'sans-serif'
    }).setOrigin(0.5).setDepth(4).setAlpha(nodeAlpha);
    this.mapContainer.add(emoji);
  }

  // ── Label sous le cercle ─────────────────────────────────────────────
  _drawNodeLabel(node, x, y, isBoss, isStart, isAvailable, isVisited) {
    const labelColor = isAvailable ? '#ffffff' :
                       isVisited   ? '#4a5568' :
                       isStart     ? '#a0aec0' : '#555577';

    let labelTxt;

    if (isVisited && !isStart) {
      labelTxt = '✓';
    } else if (isStart && node.prevArena) {
      labelTxt = node.prevArena.city;
    } else if (isBoss && node.trainer) {
      labelTxt = node.trainer.name ?? 'Arène';
    } else {
      const style = NODE_STYLE[node.type] ?? NODE_STYLE.combat;
      labelTxt    = style.label;
    }

    const label = this.add.text(x, y + NODE_RADIUS + 6, labelTxt, {
      fontSize: '10px', fill: labelColor,
      fontFamily: 'sans-serif',
      fontStyle:  isAvailable ? 'bold' : 'normal',
      align:      'center',
    }).setOrigin(0.5, 0).setDepth(4);

    this.mapContainer.add(label);
  }

  // ── Zone de clic interactive ─────────────────────────────────────────
  _addClickZone(node, x, y, circle, style, isBoss) {
    const hitArea = this.add.circle(x, y, NODE_RADIUS, 0xffffff, 0)
      .setDepth(6).setInteractive({ cursor: 'pointer' });

    hitArea.on('pointerover', () => {
      circle.clear();
      circle.fillStyle(style.glowColor, 0.28);
      circle.fillCircle(x, y, NODE_RADIUS + 11);
      circle.fillStyle(0x000000, 0.35);
      circle.fillCircle(x + 3, y + 3, NODE_RADIUS);
      circle.fillStyle(style.color, 1);
      circle.fillCircle(x, y, NODE_RADIUS);
      circle.fillStyle(0xffffff, 0.18);
      circle.fillEllipse(x - 5, y - 10, NODE_RADIUS * 0.75, NODE_RADIUS * 0.4);
      circle.lineStyle(2.5, 0xffd700, 1);
      circle.strokeCircle(x, y, NODE_RADIUS);
    });

    hitArea.on('pointerout', () => {
      circle.clear();
      circle.fillStyle(style.glowColor, 0.18);
      circle.fillCircle(x, y, NODE_RADIUS + 9);
      circle.fillStyle(0x000000, 0.35);
      circle.fillCircle(x + 3, y + 3, NODE_RADIUS);
      circle.fillStyle(style.color, 1);
      circle.fillCircle(x, y, NODE_RADIUS);
      circle.fillStyle(0xffffff, 0.12);
      circle.fillEllipse(x - 5, y - 10, NODE_RADIUS * 0.75, NODE_RADIUS * 0.4);
      circle.lineStyle(isBoss ? 3 : 2, style.glowColor, 1);
      circle.strokeCircle(x, y, NODE_RADIUS);
      if (isBoss) {
        circle.lineStyle(1.5, 0xffd700, 0.5);
        circle.strokeCircle(x, y, NODE_RADIUS + 6);
      }
    });

    hitArea.on('pointerdown', () => {
      this.isDragging = false;
      this._selectNode(node);
    });

    this.mapContainer.add(hitArea);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  SÉLECTION D'UN NŒUD
  // ═════════════════════════════════════════════════════════════════════════

  _selectNode(node) {
    if (node.col >= 0 && this.mapNodes[node.col]) {
      this.mapNodes[node.col].forEach(n => { n.available = false; });
    }

    node.visited = true;

    node.connections.forEach(targetId => {
      const [tc, tr] = targetId.split('_').map(Number);
      const target   = this.mapNodes[tc]?.[tr];
      if (target) target.available = true;
    });

    const units = this.registry.get('playerUnits') ?? [];

    this.scene.start('WildScene', {
      playerUnits:        units,
      enemyUnits:         node.trainer?.units        ?? [],
      trainerName:        node.trainer?.name         ?? 'Dresseur',
      trainerArchetypeId: node.trainer?.archetypeId  ?? null,
      mapNodes:           this.mapNodes,
      startNode:          this.startNode,
      mapIndex:           this.mapIndex,
      nodeId:             node.id,
      nodeType:           node.type,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  POSITION D'UN NŒUD
  // ═════════════════════════════════════════════════════════════════════════

  _nodePos(node) {
    const colOffset = node.col + 1;  // col -1 → 0, col 0 → 1, etc.
    return {
      x: MARGIN_X + colOffset * (NODE_RADIUS * 2 + COL_GAP) + NODE_RADIUS,
      y: MARGIN_Y + node.row  * (NODE_RADIUS * 2 + ROW_GAP) + NODE_RADIUS + TITLE_H,
    };
  }
}