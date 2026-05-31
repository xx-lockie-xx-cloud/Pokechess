// ─────────────────────────────────────────────────────────────────────────────
// MapScene.js — Scène Phaser de la map de progression
// ─────────────────────────────────────────────────────────────────────────────

import { MapGenerator, NODE_TYPES } from '../map/MapGenerator.js';
import { getRunState }              from '../data/runState.js';
import { TRAINER_ARCHETYPES }       from '../data/trainers.js';
import { getArenaForMap, ARENAS }   from '../data/arenas.js';

// ── Dimensions ───────────────────────────────────────────────────────────────
const SPRITE_SIZE = 72;   // taille d'affichage des sprites de nœuds
const COL_GAP     = 64;   // espace horizontal entre bords de sprites
const ROW_GAP     = 52;   // espace vertical entre bords de sprites
const MARGIN_X    = 70;
const MARGIN_Y    = 40;
const COL_STEP = SPRITE_SIZE + COL_GAP;  // 136px entre centres de colonnes
const ROW_STEP = SPRITE_SIZE + ROW_GAP;  // 124px entre centres de lignes

const NODE_STYLE = {
  start:  { emoji: '🏠', glowColor: 0x2ecc71, label: 'Départ'   },
  combat: { emoji: '⚔️', glowColor: 0xff6b6b, label: 'Dresseur' },
  shop:   { emoji: '🛒', glowColor: 0x74b9ff, label: 'Boutique'  },
  item:   { emoji: '🎒', glowColor: 0xd980fa, label: 'Objet'     },
  boss:   { emoji: '👑', glowColor: 0xffd700, label: 'Arène'     },
  random: { emoji: '🎲', glowColor: 0x1abc9c, label: 'Mystère'   },
};

export class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' });
    this.mapNodes     = [];
    this.startNode    = null;
    this.mapIndex     = 0;
    this.mapContainer = null;
    this.isDragging   = false;
    this.dragStartX   = 0;
    this.camStartX    = 0;
    this.minScrollX   = 0;
    this.maxScrollX   = 0;
    this._vertOffset  = MARGIN_Y;  // recalculé dans create() pour centrer
    this._horizOffset = MARGIN_X;  // recalculé dans create() pour centrage horizontal
    this._zoom        = 1;         // zoom courant (0.5 – 1.5)
    this._pinchDist   = 0;         // distance initiale du pinch
  }

  // ─────────────────────────────────────────────────────────────────────────
  init(data) {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.isDragging = false;

    const registry = window.gameRegistry;

    if (data?.mapNodes) {
      this.mapNodes  = data.mapNodes;
      this.startNode = data.startNode ?? null;
      this.mapIndex  = data.mapIndex  ?? 0;
    } else {
      const state     = getRunState(registry);
      this.mapIndex   = data?.mapIndex ?? state.currentMap ?? 0;
      const prevArena = data?.prevArena ?? null;
      const gen       = new MapGenerator(5, 3);
      this.mapNodes   = gen.generate(this.mapIndex, prevArena);
      this.startNode  = gen._startNode;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  preload() {
    TRAINER_ARCHETYPES.forEach(a => {
      const key = `trainer_map_${a.id}`;
      if (a.spriteMap && !this.textures.exists(key))
        this.load.image(key, a.spriteMap);
    });

    const arena = getArenaForMap(this.mapIndex);
    if (arena?.championSprite) {
      const key = `champion_map_${this.mapIndex}`;
      if (!this.textures.exists(key))
        this.load.image(key, arena.championSprite);
    }

    if (this.startNode?.prevArena) {
      const prev     = this.startNode.prevArena;
      const champKey = `champion_map_${prev.id - 1}`;
      const badgeKey = `badge_${prev.id}`;
      if (prev.championSprite && !this.textures.exists(champKey))
        this.load.image(champKey, prev.championSprite);
      if (prev.badgeSprite && !this.textures.exists(badgeKey))
        this.load.image(badgeKey, prev.badgeSprite);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Fond
    this.add.rectangle(0, 0, W, H, 0x1a1a2e, 1)
      .setOrigin(0).setDepth(-10).setScrollFactor(0);

    // Titre — "En Route vers [ville du prochain badge]", centré, scroll-fixe
    const destArena  = ARENAS[this.mapIndex] ?? null;
    const destCity   = destArena?.city ?? `Route ${this.mapIndex + 1}`;
    const titleText  = `En Route vers ${destCity}`;

    this.add.text(W / 2, 10, titleText, {
      fontSize:   '17px',
      fill:       '#e2e8f0',
      fontFamily: 'sans-serif',
      fontStyle:  'bold',
      stroke:     '#0a0a1a',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(20).setScrollFactor(0);

    // Dimensions du contenu
    // Les nœuds vont de colOffset=0 (startNode) à colOffset=totalCols-1 (boss)
    // → largeur réelle = (totalCols-1) colonnes + 1 sprite
    const totalCols  = this.mapNodes.length + 2;
    const contentW   = (totalCols - 1) * COL_STEP + SPRITE_SIZE;
    const maxRows    = Math.max(...this.mapNodes.map(col => col.length), 1);
    const contentH   = maxRows * ROW_STEP + SPRITE_SIZE + 24;

    // Centrage horizontal exact
    this._horizOffset = Math.max(MARGIN_X, Math.floor((W - contentW) / 2));

    // Centrage vertical
    this._vertOffset  = Math.max(MARGIN_Y, Math.floor((H - contentH) / 2));

    // Largeur totale scrollable
    const mapW = this._horizOffset + contentW + MARGIN_X;
    this._mapW = mapW;
    this._updateScrollBounds();

    this.mapContainer = this.add.container(0, 0).setDepth(5);

    this._drawConnections();
    this._drawNodes();

    // ── Zoom molette ──────────────────────────────────────────────────────
    this.input.on('wheel', (ptr, objs, dx, dy) => {
      const delta    = dy > 0 ? -0.08 : 0.08;
      this._applyZoom(this._zoom + delta, ptr.x, ptr.y);
    });

    // ── Drag (pan) ────────────────────────────────────────────────────────
    this.input.on('pointerdown', ptr => {
      if (ptr.pointerId !== undefined && this._getActivePointers() > 1) return;
      this.isDragging = true;
      this.dragStartX = ptr.x;
      this.camStartX  = this.cameras.main.scrollX;
    });
    this.input.on('pointermove', ptr => {
      // Pinch-to-zoom (2 doigts)
      const pointers = this.input.manager.pointers.filter(p => p.isDown);
      if (pointers.length === 2) {
        this.isDragging = false;
        const dist = Phaser.Math.Distance.Between(
          pointers[0].x, pointers[0].y,
          pointers[1].x, pointers[1].y
        );
        if (this._pinchDist > 0) {
          const ratio = dist / this._pinchDist;
          const cx    = (pointers[0].x + pointers[1].x) / 2;
          const cy    = (pointers[0].y + pointers[1].y) / 2;
          this._applyZoom(this._zoom * ratio, cx, cy);
        }
        this._pinchDist = dist;
        return;
      }
      this._pinchDist = 0;

      if (!this.isDragging) return;
      const newX = Phaser.Math.Clamp(
        this.camStartX + (this.dragStartX - ptr.x),
        this.minScrollX, this.maxScrollX
      );
      this.cameras.main.setScroll(newX, 0);
    });
    this.input.on('pointerup',  () => { this.isDragging = false; this._pinchDist = 0; });
    this.input.on('pointerout', () => { this.isDragging = false; this._pinchDist = 0; });
  }

  _getActivePointers() {
    return this.input.manager.pointers.filter(p => p.isDown).length;
  }

  // Applique le zoom en gardant le point ptr (world) fixe à l'écran
  _applyZoom(newZoom, screenX, screenY) {
    newZoom = Phaser.Math.Clamp(newZoom, 0.5, 2.0);
    if (newZoom === this._zoom) return;

    const cam     = this.cameras.main;
    const worldX  = cam.scrollX + screenX / this._zoom;
    const worldY  = cam.scrollY + screenY / this._zoom;

    this._zoom = newZoom;
    cam.setZoom(newZoom);
    this._updateScrollBounds();

    // Recentre la caméra pour garder le point sous le curseur fixe
    cam.setScroll(
      worldX - screenX / newZoom,
      worldY - screenY / newZoom
    );
    // Clamp scroll après zoom
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, this.minScrollX, this.maxScrollX);
  }

  _updateScrollBounds() {
    const W             = this.scale.width;
    const scaledMapW    = this._mapW * this._zoom;
    this.minScrollX     = 0;
    this.maxScrollX     = Math.max(0, (scaledMapW - W) / this._zoom);
    this.cameras.main.setBounds(
      0, 0,
      Math.max(this._mapW, W / this._zoom),
      this.scale.height / this._zoom
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Connexions / empreintes
  // ─────────────────────────────────────────────────────────────────────────
  _drawConnections() {
    if (this.startNode) {
      this.startNode.connections.forEach(targetId => {
        const [tc, tr] = targetId.split('_').map(Number);
        const target   = this.mapNodes[tc]?.[tr];
        if (target)
          this._drawFootprints(this._nodePos(this.startNode), this._nodePos(target), true);
      });
    }
    this.mapNodes.forEach(col => {
      col.forEach(node => {
        node.connections.forEach(targetId => {
          const [tc, tr] = targetId.split('_').map(Number);
          const target   = this.mapNodes[tc]?.[tr];
          if (!target) return;
          this._drawFootprints(this._nodePos(node), this._nodePos(target),
            node.visited || node.available);
        });
      });
    });
  }

  _drawFootprints(from, to, active) {
    for (let i = 1; i < 5; i++) {
      const t      = i / 5;
      const x      = Phaser.Math.Linear(from.x, to.x, t);
      const y      = Phaser.Math.Linear(from.y, to.y, t);
      const angle  = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
      const offset = (i % 2 === 0 ? 5 : -5);
      const px     = x + Math.cos(angle + Math.PI / 2) * offset;
      const py     = y + Math.sin(angle + Math.PI / 2) * offset;
      const foot   = this.add.graphics().setDepth(2).setAlpha(active ? 0.9 : 0.4);
      foot.fillStyle(active ? 0xf5e642 : 0xaab0c4, 1);
      foot.fillEllipse(px, py, 8, 5);
      foot.fillEllipse(px - Math.cos(angle) * 5, py - Math.sin(angle) * 5, 6, 4);
      this.mapContainer.add(foot);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Nœuds
  // ─────────────────────────────────────────────────────────────────────────
  _drawNodes() {
    if (this.startNode) this._drawNode(this.startNode);
    this.mapNodes.forEach(col => col.forEach(node => this._drawNode(node)));
  }

  _drawNode(node) {
    const { x, y }   = this._nodePos(node);
    const isStart     = node.type === NODE_TYPES.START;
    const isBoss      = node.type === NODE_TYPES.BOSS;
    const isAvailable = node.available && !node.visited;
    const isVisited   = node.visited;
    const alpha       = isAvailable || isStart ? 1 : isVisited ? 0.4 : 0.3;

    // ── Lueur rectangulaire derrière les nœuds disponibles ────────────────
    let glowGfx = null;
    if (isAvailable) {
      const style = NODE_STYLE[node.type] ?? NODE_STYLE.combat;
      glowGfx = this.add.graphics().setDepth(2);
      glowGfx.fillStyle(style.glowColor, 0.18);
      glowGfx.fillRoundedRect(
        x - SPRITE_SIZE / 2 - 8, y - SPRITE_SIZE / 2 - 8,
        SPRITE_SIZE + 16, SPRITE_SIZE + 16, 10
      );
      this.mapContainer.add(glowGfx);

      this.tweens.add({
        targets:  glowGfx,
        alpha:    { from: 0.4, to: 1 },
        duration: 900,
        yoyo:     true,
        repeat:   -1,
        ease:     'Sine.easeInOut',
      });
    }

    // ── Contenu (sprite ou emoji) ──────────────────────────────────────────
    const contentObj = this._drawNodeContent(node, x, y, isBoss, isStart, alpha);

    // ── Label ─────────────────────────────────────────────────────────────
    this._drawNodeLabel(node, x, y, isBoss, isStart, isAvailable, isVisited);

    // ── Zone de clic ──────────────────────────────────────────────────────
    if (isAvailable && contentObj) {
      this._addClickZone(node, x, y, contentObj, glowGfx);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Contenu du nœud — retourne l'objet principal (image ou texte)
  // ─────────────────────────────────────────────────────────────────────────
  _drawNodeContent(node, x, y, isBoss, isStart, alpha) {
    const size = isBoss ? Math.round(SPRITE_SIZE * 1.15) : SPRITE_SIZE;

    // Sprite dresseur (combat)
    if (node.type === NODE_TYPES.COMBAT && node.trainer?.archetypeId) {
      const key = `trainer_map_${node.trainer.archetypeId}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(x, y, key)
          .setDisplaySize(size, size).setDepth(4).setAlpha(alpha);
        this.mapContainer.add(img);
        return img;
      }
    }

    // Sprite champion (boss)
    if (isBoss) {
      const key = `champion_map_${this.mapIndex}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(x, y, key)
          .setDisplaySize(size, size).setDepth(4).setAlpha(alpha);
        this.mapContainer.add(img);
        return img;
      }
    }

    // Nœud de départ avec champion précédent
    if (isStart && node.prevArena) {
      const prev     = node.prevArena;
      const champKey = `champion_map_${prev.id - 1}`;
      const badgeKey = `badge_${prev.id}`;
      let mainObj    = null;

      if (this.textures.exists(champKey)) {
        mainObj = this.add.image(x, y, champKey)
          .setDisplaySize(size, size).setDepth(4).setAlpha(0.9);
        this.mapContainer.add(mainObj);
      }

      if (this.textures.exists(badgeKey)) {
        const badge = this.add.image(
          x + size * 0.4, y - size * 0.4, badgeKey
        ).setDisplaySize(22, 22).setDepth(5);
        this.mapContainer.add(badge);
      } else if (prev.badgeEmoji) {
        const txt = this.add.text(
          x + size * 0.38, y - size * 0.38,
          prev.badgeEmoji, { fontSize: '14px', fontFamily: 'sans-serif' }
        ).setOrigin(0.5).setDepth(5);
        this.mapContainer.add(txt);
      }
      return mainObj;
    }

    // Fallback emoji (shop, item, random, start sans arena)
    const style = NODE_STYLE[node.type] ?? NODE_STYLE.combat;
    const txt   = this.add.text(x, y, style.emoji, {
      fontSize:   `${Math.round(size * 0.65)}px`,
      fontFamily: 'sans-serif',
    }).setOrigin(0.5).setDepth(4).setAlpha(alpha);
    this.mapContainer.add(txt);
    return txt;
  }

  // ─────────────────────────────────────────────────────────────────────────
  _drawNodeLabel(node, x, y, isBoss, isStart, isAvailable, isVisited) {
    let txt;
    if (isVisited && !isStart)          txt = '✓';
    else if (isStart && node.prevArena) txt = node.prevArena.city;
    else if (isBoss && node.trainer)    txt = node.trainer.name ?? 'Arène';
    else                                txt = (NODE_STYLE[node.type] ?? NODE_STYLE.combat).label;

    const color = isAvailable ? '#ffffff' :
                  isVisited   ? '#4a5568' :
                  isStart     ? '#a0aec0' : '#555577';

    const label = this.add.text(x, y + SPRITE_SIZE / 2 + 8, txt, {
      fontSize:   isAvailable ? '11px' : '10px',
      fill:       color,
      fontFamily: 'sans-serif',
      fontStyle:  isAvailable ? 'bold' : 'normal',
      align:      'center',
    }).setOrigin(0.5, 0).setDepth(4);
    this.mapContainer.add(label);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone de clic — hover sur le sprite directement
  // ─────────────────────────────────────────────────────────────────────────
  _addClickZone(node, x, y, contentObj, glowGfx) {
    const hitSize = SPRITE_SIZE + 12;
    const hitArea = this.add.rectangle(x, y, hitSize, hitSize, 0xffffff, 0)
      .setDepth(6).setInteractive({ cursor: 'pointer' });

    hitArea.on('pointerover', () => {
      contentObj.setScale(1.1);
      if (glowGfx) {
        glowGfx.clear();
        const style = NODE_STYLE[node.type] ?? NODE_STYLE.combat;
        glowGfx.fillStyle(style.glowColor, 0.38);
        glowGfx.fillRoundedRect(
          x - SPRITE_SIZE / 2 - 12, y - SPRITE_SIZE / 2 - 12,
          SPRITE_SIZE + 24, SPRITE_SIZE + 24, 12
        );
      }
    });

    hitArea.on('pointerout', () => {
      contentObj.setScale(1);
      if (glowGfx) {
        glowGfx.clear();
        const style = NODE_STYLE[node.type] ?? NODE_STYLE.combat;
        glowGfx.fillStyle(style.glowColor, 0.18);
        glowGfx.fillRoundedRect(
          x - SPRITE_SIZE / 2 - 8, y - SPRITE_SIZE / 2 - 8,
          SPRITE_SIZE + 16, SPRITE_SIZE + 16, 10
        );
      }
    });

    hitArea.on('pointerdown', () => {
      this.isDragging = false;
      this._selectNode(node);
    });

    this.mapContainer.add(hitArea);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sélection → notifie UIManager
  // ─────────────────────────────────────────────────────────────────────────
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

    const units = window.gameRegistry?.get('playerUnits') ?? [];

    if (window.UIManager) {
      window.UIManager.onNodeSelected({
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
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Position d'un nœud (centre)
  // ─────────────────────────────────────────────────────────────────────────
  _nodePos(node) {
    const colOffset = node.col + 1;
    return {
      x: this._horizOffset + colOffset * COL_STEP + SPRITE_SIZE / 2,
      y: this._vertOffset   + node.row  * ROW_STEP + SPRITE_SIZE / 2,
    };
  }
}