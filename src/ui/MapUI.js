// ─────────────────────────────────────────────────────────────────────────────
// MapUI.js — Map de progression HTML/CSS/SVG (sans Phaser)
// ─────────────────────────────────────────────────────────────────────────────

import { MapGenerator, NODE_TYPES } from '../map/MapGenerator.js';
import { getRunState }              from '../data/runState.js';
import { TRAINER_ARCHETYPES, ALL_TRAINER_ARCHETYPES }       from '../data/trainers.js';
import { getArenaForMap, ARENAS }   from '../data/arenas.js';

// ── Constantes de base (à zoom=1) ────────────────────────────────────────────
const BASE_SPRITE = 72;
const BASE_COL_GAP = 70;
const BASE_ROW_GAP = 64;
const BASE_COL_STEP = BASE_SPRITE + BASE_COL_GAP;   // 142px
const BASE_ROW_STEP = BASE_SPRITE + BASE_ROW_GAP;   // 136px
const BASE_MARGIN_X = 64;
const BASE_MARGIN_Y = 48;
const BASE_LABEL_H  = 22;

const NODE_META = {
  start:  { emoji: '🏠', glow: '#2ecc71', label: 'Départ'   },
  combat: { emoji: '⚔️', glow: '#ff6b6b', label: 'Dresseur' },
  shop:   { emoji: '🛒', glow: '#74b9ff', label: 'Boutique'  },
  item:   { emoji: '🎒', glow: '#d980fa', label: 'Objet'     },
  boss:   { emoji: '👑', glow: '#ffd700', label: 'Arène'     },
  random: { emoji: '🎲', glow: '#1abc9c', label: 'Mystère'   },
};

// ─────────────────────────────────────────────────────────────────────────────
export const MapUI = {
  // État
  _nodes:    [],
  _start:    null,
  _mapIdx:   0,
  _seed:     null,
  _reg:      null,
  _onNode:   null,
  _zoom:     1,

  // Références DOM persistantes (recréées à chaque init)
  _screen:   null,
  _viewport: null,

  // ─────────────────────────────────────────────────────────────────────────
  // init() — point d'entrée appelé par UIManager
  // ─────────────────────────────────────────────────────────────────────────
  init(data, registry, onNodeSelected) {
    this._reg    = registry;
    this._onNode = onNodeSelected;
    this._zoom   = 1;

    // Génère ou réutilise les nœuds
    const state  = getRunState(registry);
    this._mapIdx = data?.mapIndex ?? state.currentMap ?? 0;
    const gen    = new MapGenerator();

    if (data?.seed != null) {
      // ── Restauration depuis seed ───────────────────────────────────────────
      // Même seed → même PRNG → même layout garanti
      this._nodes = gen.generate(this._mapIdx, data?.prevArena ?? null, data.seed);
      this._start = gen._startNode;
      this._seed  = data.seed;
      gen.restoreState(
        this._nodes, this._start,
        data.visitedNodes   ?? [],
        data.availableNodes ?? []
      );
    } else {
      // ── Nouvelle map (ou retour depuis combat avec mapNodes) ───────────────
      // On génère toujours depuis un nouveau seed (le seed sera sauvé après)
      const prevArena = data?.prevArena ?? null;
      this._nodes = gen.generate(this._mapIdx, prevArena);
      this._start = gen._startNode;
      this._seed  = gen._seed;
      // Si mapNodes passé (retour combat), restaure l'état visited/available
      // depuis le registre (sauvé dans runState)
      if (data?.mapNodes) {
        // Recopie visited/available depuis les mapNodes fournis
        const visitedSet   = new Set();
        const availableSet = new Set();
        data.mapNodes.forEach(col => col.forEach(n => {
          if (n.visited)   visitedSet.add(n.id);
          if (n.available) availableSet.add(n.id);
        }));
        if (data.startNode?.visited) visitedSet.add('start');
        gen.restoreState(
          this._nodes, this._start,
          [...visitedSet], [...availableSet]
        );
        // Conserve le seed existant si disponible dans les data
        if (data.existingSeed != null) this._seed = data.existingSeed;
      }
    }

    // Construit la structure de base (titre + viewport)
    this._screen = document.getElementById('screen-map');
    if (!this._screen) return;
    this._screen.innerHTML = '';
    // Ne pas toucher au display — UIManager gère la visibilité via la classe .active
    this._screen.style.background = '#1a1a2e';

    // Titre
    const title = document.createElement('div');
    const dest  = ARENAS[this._mapIdx];
    title.textContent = `En Route vers ${dest?.city ?? `Route ${this._mapIdx + 1}`}`;
    title.style.cssText = `
      flex-shrink: 0;
      text-align: center;
      padding: 10px 16px 6px;
      font-size: 18px;
      font-weight: 700;
      color: #e2e8f0;
      letter-spacing: 0.02em;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      pointer-events: none;
      user-select: none;
    `;
    this._screen.appendChild(title);

    // Viewport : scroll natif, centre si contenu < écran
    this._viewport = document.createElement('div');
    this._viewport.style.cssText = `
      flex: 1;
      overflow: auto;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      cursor: grab;
      scrollbar-width: thin;
      scrollbar-color: #334466 transparent;
    `;
    this._screen.appendChild(this._viewport);

    // Zoom molette
    this._viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const rect  = this._viewport.getBoundingClientRect();
      const pivotX = e.clientX - rect.left + this._viewport.scrollLeft;
      const pivotY = e.clientY - rect.top  + this._viewport.scrollTop;
      const delta  = e.deltaY > 0 ? -0.1 : 0.1;
      this._setZoom(this._zoom + delta, pivotX, pivotY);
    }, { passive: false });

    // Drag/pan
    let drag = null;
    this._viewport.addEventListener('pointerdown', e => {
      if (e.target.closest('.mn-wrap')) return; // laisse les clics sur les nœuds
      this._viewport.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY,
               sl: this._viewport.scrollLeft, st: this._viewport.scrollTop };
      this._viewport.style.cursor = 'grabbing';
    });
    this._viewport.addEventListener('pointermove', e => {
      if (!drag) return;
      this._viewport.scrollLeft = drag.sl - (e.clientX - drag.x);
      this._viewport.scrollTop  = drag.st - (e.clientY - drag.y);
    });
    this._viewport.addEventListener('pointerup', () => {
      drag = null;
      this._viewport.style.cursor = 'grab';
    });
    this._viewport.addEventListener('pointercancel', () => {
      drag = null;
      this._viewport.style.cursor = 'grab';
    });

    this._renderWorld();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _setZoom() — change le zoom et re-rend le monde (instantané sur ~20 nœuds)
  // ─────────────────────────────────────────────────────────────────────────
  _setZoom(newZoom, pivotX, pivotY) {
    newZoom = Math.max(0.4, Math.min(2.0, +newZoom.toFixed(2)));
    if (newZoom === this._zoom) return;

    const ratio  = newZoom / this._zoom;
    const sl     = this._viewport.scrollLeft;
    const st     = this._viewport.scrollTop;

    this._zoom = newZoom;
    this._renderWorld();

    // Maintient le point sous le curseur fixe
    this._viewport.scrollLeft = pivotX * ratio - (pivotX - sl * ratio);
    this._viewport.scrollTop  = pivotY * ratio - (pivotY - st * ratio);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _renderWorld() — (re)construit le monde dans le viewport
  // ─────────────────────────────────────────────────────────────────────────
  _renderWorld() {
    if (!this._viewport) return;
    this._viewport.innerHTML = '';

    const z        = this._zoom;
    const SPRITE   = BASE_SPRITE   * z;
    const COL_STEP = BASE_COL_STEP * z;
    const ROW_STEP = BASE_ROW_STEP * z;
    const MARGIN_X = BASE_MARGIN_X * z;
    const MARGIN_Y = BASE_MARGIN_Y * z;
    const LABEL_H  = BASE_LABEL_H  * z;

    const totalCols = this._nodes.length + 2;  // start + N cols + boss
    const maxRows   = Math.max(...this._nodes.map(c => c.length), 1);

    // Dimensions réelles du monde
    const worldW = (totalCols - 1) * COL_STEP + SPRITE + MARGIN_X * 2;
    const worldH = (maxRows   - 1) * ROW_STEP + SPRITE + MARGIN_Y * 2 + LABEL_H;

    // ── Centrage dans le viewport si monde plus petit ──────────────────────
    const vW = this._viewport.clientWidth  || window.innerWidth;
    const vH = this._viewport.clientHeight || (window.innerHeight - 100);

    const offsetX = worldW < vW ? Math.floor((vW - worldW) / 2) : 0;
    const offsetY = worldH < vH ? Math.floor((vH - worldH) / 2) : 0;

    // ── Monde (containing block pour SVG + nœuds) ─────────────────────────
    const world = document.createElement('div');
    world.style.cssText = `
      position: relative;
      width:  ${Math.max(worldW, vW)}px;
      height: ${Math.max(worldH, vH)}px;
      flex-shrink: 0;
    `;
    this._viewport.appendChild(world);

    // ── Calcul des positions ───────────────────────────────────────────────
    const pos = {};
    const allNodes = [];

    if (this._start) {
      pos['start'] = this._calcPos(this._start, offsetX, offsetY,
                                   SPRITE, COL_STEP, ROW_STEP, MARGIN_X, MARGIN_Y, maxRows);
      allNodes.push(this._start);
    }
    this._nodes.forEach(col => col.forEach(n => {
      pos[n.id] = this._calcPos(n, offsetX, offsetY,
                                SPRITE, COL_STEP, ROW_STEP, MARGIN_X, MARGIN_Y, maxRows);
      allNodes.push(n);
    }));

    // ── SVG des connexions ─────────────────────────────────────────────────
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg   = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width',  Math.max(worldW, vW));
    svg.setAttribute('height', Math.max(worldH, vH));
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1;';
    world.appendChild(svg);
    this._drawSVG(svg, pos, SPRITE, z);

    // ── Nœuds DOM ─────────────────────────────────────────────────────────
    allNodes.forEach(n => {
      world.appendChild(this._buildNode(n, pos[n.id], SPRITE, z));
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _calcPos() — centre d'un nœud (coin haut-gauche du sprite)
  // ─────────────────────────────────────────────────────────────────────────
  _calcPos(node, offsetX, offsetY, SPRITE, COL_STEP, ROW_STEP, MARGIN_X, MARGIN_Y, maxRows) {
    const colOffset = node.col + 1;   // start.col=-1 → colOffset=0

    // Centrage vertical par colonne (les colonnes n'ont pas toutes le même nb de nœuds)
    const colNodes   = node.col >= 0 ? (this._nodes[node.col] ?? [node]) : [node];
    const totalH     = (maxRows - 1)           * ROW_STEP;
    const colH       = (colNodes.length - 1)   * ROW_STEP;
    const colOffsetY = Math.floor((totalH - colH) / 2);

    return {
      x: offsetX + MARGIN_X + colOffset * COL_STEP,
      y: offsetY + MARGIN_Y + colOffsetY + node.row * ROW_STEP,
    };
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _drawSVG() — connexions + empreintes
  // ─────────────────────────────────────────────────────────────────────────
  _drawSVG(svg, pos, SPRITE, z) {
    const half = SPRITE / 2;
    const ns   = 'http://www.w3.org/2000/svg';

    const drawLine = (fromPos, toPos, active) => {
      const x1 = fromPos.x + half, y1 = fromPos.y + half;
      const x2 = toPos.x   + half, y2 = toPos.y   + half;

      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke',           active ? '#f5e642' : '#2a3550');
      line.setAttribute('stroke-width',     active ? 2 * z    : 1.5 * z);
      line.setAttribute('stroke-dasharray', active ? 'none'   : `${6*z} ${4*z}`);
      line.setAttribute('opacity',          active ? '0.75'   : '0.4');
      svg.appendChild(line);

      if (active) this._drawFootprints(svg, x1, y1, x2, y2, z);
    };

    const resolve = id => {
      const [tc, tr] = id.split('_').map(Number);
      return this._nodes[tc]?.[tr] ?? null;
    };

    // Depuis le nœud de départ
    if (this._start) {
      this._start.connections.forEach(id => {
        const t = resolve(id);
        if (t) drawLine(pos['start'], pos[t.id], true);
      });
    }

    // Entre les colonnes
    this._nodes.forEach(col => col.forEach(node => {
      const active = node.visited || node.available;
      node.connections.forEach(id => {
        const t = resolve(id);
        if (t) drawLine(pos[node.id], pos[t.id], active);
      });
    }));
  },

  _drawFootprints(svg, x1, y1, x2, y2, z) {
    const ns    = 'http://www.w3.org/2000/svg';
    const angle = Math.atan2(y2 - y1, x2 - x1);
    for (let i = 1; i < 5; i++) {
      const t  = i / 5;
      const x  = x1 + (x2 - x1) * t;
      const y  = y1 + (y2 - y1) * t;
      const o  = i % 2 === 0 ? 5 * z : -5 * z;
      const px = x + Math.cos(angle + Math.PI / 2) * o;
      const py = y + Math.sin(angle + Math.PI / 2) * o;
      const el = document.createElementNS(ns, 'ellipse');
      el.setAttribute('cx',        px.toFixed(1));
      el.setAttribute('cy',        py.toFixed(1));
      el.setAttribute('rx',        (5 * z).toFixed(1));
      el.setAttribute('ry',        (3.5 * z).toFixed(1));
      el.setAttribute('fill',      '#f5e642');
      el.setAttribute('opacity',   '0.6');
      el.setAttribute('transform', `rotate(${(angle*180/Math.PI).toFixed(1)},${px.toFixed(1)},${py.toFixed(1)})`);
      svg.appendChild(el);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _buildNode() — crée le div d'un nœud
  // ─────────────────────────────────────────────────────────────────────────
  _buildNode(node, pos, SPRITE, z) {
    const isStart     = node.type === NODE_TYPES.START;
    const isBoss      = node.type === NODE_TYPES.BOSS;
    const isAvailable = node.available && !node.visited;
    const isVisited   = node.visited;
    const meta        = NODE_META[node.type] ?? NODE_META.combat;

    // Wrapper positionné
    const wrap = document.createElement('div');
    wrap.className = 'mn-wrap';
    wrap.style.cssText = `
      position: absolute;
      left: ${pos.x}px;
      top:  ${pos.y}px;
      width:  ${SPRITE}px;
      height: ${SPRITE}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 2;
      cursor: ${isAvailable ? 'pointer' : 'default'};
      opacity: ${isAvailable || isStart ? '1' : isVisited ? '0.4' : '0.3'};
      transition: transform 0.15s ease, filter 0.15s ease;
      ${isAvailable ? `filter: drop-shadow(0 0 ${8*z}px ${meta.glow});` : ''}
    `;

    if (isAvailable) {
      wrap.style.animation = isBoss
        ? `mn-pulse-boss ${1.2}s ease-in-out infinite`
        : `mn-pulse 1.6s ease-in-out infinite`;

      wrap.addEventListener('mouseenter', () => {
        wrap.style.transform = `scale(1.12)`;
        wrap.style.animation = 'none';
        wrap.style.filter    = `drop-shadow(0 0 ${16*z}px ${meta.glow})`;
      });
      wrap.addEventListener('mouseleave', () => {
        wrap.style.transform = '';
        wrap.style.filter    = `drop-shadow(0 0 ${8*z}px ${meta.glow})`;
        wrap.style.animation = isBoss
          ? 'mn-pulse-boss 1.2s ease-in-out infinite'
          : 'mn-pulse 1.6s ease-in-out infinite';
      });
      wrap.addEventListener('click', e => {
        e.stopPropagation();
        this._selectNode(node);
      });
    }

    // ── Contenu ────────────────────────────────────────────────────────────
    const inner = document.createElement('div');
    inner.style.cssText = `
      width: ${SPRITE}px;
      height: ${SPRITE}px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    `;

    const spriteSrc = this._getSprite(node);
    if (spriteSrc) {
      const img = document.createElement('img');
      img.src             = spriteSrc;
      img.draggable       = false;
      img.style.cssText   = `
        width: ${SPRITE}px;
        height: ${SPRITE}px;
        object-fit: contain;
        image-rendering: pixelated;
        pointer-events: none;
      `;
      inner.appendChild(img);
    } else {
      const em = document.createElement('span');
      em.textContent    = meta.emoji;
      em.style.cssText  = `font-size: ${SPRITE * 0.55}px; line-height: 1; pointer-events: none;`;
      inner.appendChild(em);
    }

    wrap.appendChild(inner);

    // Badge "visité"
    if (isVisited && !isStart) {
      const ck = document.createElement('div');
      ck.textContent  = '✓';
      ck.style.cssText = `
        position: absolute;
        top: ${-6*z}px; right: ${-6*z}px;
        background: #27ae60;
        color: #fff;
        font-size: ${10*z}px;
        font-weight: 700;
        width: ${16*z}px; height: ${16*z}px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        pointer-events: none;
      `;
      wrap.appendChild(ck);
    }

    // Label
    const lbl = document.createElement('div');
    lbl.textContent  = this._getLabel(node, isStart, isBoss, isVisited);
    lbl.style.cssText = `
      margin-top: ${4*z}px;
      font-size: ${10*z}px;
      font-weight: 600;
      color: ${isAvailable ? '#ffffff' : isVisited ? '#4a5568' : '#718096'};
      text-align: center;
      white-space: nowrap;
      pointer-events: none;
      text-shadow: 0 1px ${4*z}px rgba(0,0,0,0.9);
      line-height: 1;
    `;
    wrap.appendChild(lbl);

    return wrap;
  },

  // ─────────────────────────────────────────────────────────────────────────
  _getSprite(node) {
    if (node.type === NODE_TYPES.START && node.prevArena?.championSprite)
      return node.prevArena.championSprite;
    if (node.type === NODE_TYPES.BOSS) {
      const a = getArenaForMap(this._mapIdx);
      return a?.championSprite ?? null;
    }
    if (node.type === NODE_TYPES.COMBAT && node.trainer?.archetypeId) {
      const a = ALL_TRAINER_ARCHETYPES.find(x => x.id === node.trainer.archetypeId);
      return a?.spriteMap ?? null;
    }
    return null;
  },

  _getLabel(node, isStart, isBoss, isVisited) {
    if (isVisited && !isStart)     return '✓';
    if (isStart && node.prevArena) return node.prevArena.city;
    if (isStart)                   return 'Départ';
    if (isBoss && node.trainer)    return node.trainer.name ?? 'Arène';
    return (NODE_META[node.type] ?? NODE_META.combat).label;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _selectNode() — notifie UIManager
  // ─────────────────────────────────────────────────────────────────────────
  _selectNode(node) {
    if (node.col >= 0 && this._nodes[node.col])
      this._nodes[node.col].forEach(n => { n.available = false; });
    node.visited = true;
    node.connections.forEach(id => {
      const [tc, tr] = id.split('_').map(Number);
      const t = this._nodes[tc]?.[tr];
      if (t) t.available = true;
    });
    if (this._onNode) {
      this._onNode({
        playerUnits:        this._reg.get('playerUnits') ?? [],
        enemyUnits:         node.trainer?.units       ?? [],
        trainerName:        node.trainer?.name        ?? 'Dresseur',
        trainerArchetypeId: node.trainer?.archetypeId ?? null,
        mapNodes:           this._nodes,
        startNode:          this._start,
        mapIndex:           this._mapIdx,
        nodeId:             node.id,
        nodeType:           node.type,
      });
    }
  },
};
