// ─────────────────────────────────────────────────────────────────────────────
// MapGenerator.js — Génération déterministe par seed (Slay the Spire style)
// ─────────────────────────────────────────────────────────────────────────────

import { TRAINER_ARCHETYPES, generateEnemyTeam } from '../data/trainers.js';
import { getArenaForMap }                         from '../data/arenas.js';

// ─────────────────────────────────────────────────────────────────────────────
// PRNG déterministe — Mulberry32 (rapide, bonne distribution)
// Toujours utilisé à la place de Math.random() dans ce fichier
// ─────────────────────────────────────────────────────────────────────────────
function createRNG(seed) {
  let s = seed >>> 0;
  return function() {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randBetweenRNG(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// ─────────────────────────────────────────────────────────────────────────────
export const NODE_TYPES = {
  START:  'start',
  COMBAT: 'combat',
  SHOP:   'shop',
  ITEM:   'item',
  RANDOM: 'random',
  BOSS:   'boss',
};

// ─────────────────────────────────────────────────────────────────────────────
function budgetForStep(mapIndex, col, totalCols) {
  const globalStep = mapIndex * totalCols + col;
  const totalSteps = 8 * totalCols;
  const MIN_BUDGET = 200;
  const MAX_BUDGET = 2400;
  const ratio      = Math.min(globalStep / Math.max(totalSteps - 1, 1), 1);
  const curved     = Math.pow(ratio, 1.3);
  return Math.round(MIN_BUDGET + (MAX_BUDGET - MIN_BUDGET) * curved);
}

function maxUnitsForStep(mapIndex, col, totalCols) {
  const isBoss = col === totalCols;
  let base;
  if (mapIndex < 2) base = 3;
  else if (mapIndex < 4) base = 4;
  else if (mapIndex < 6) base = 5;
  else base = 6;
  const earlyCol = col < Math.floor(totalCols / 2);
  if (earlyCol && base > 2) base = Math.max(2, base - 1);
  return isBoss ? Math.min(base + 1, 6) : base;
}

function nodeTypeFromRNG(rng) {
  const r = rng();
  if (r < 0.60) return NODE_TYPES.COMBAT;
  if (r < 0.78) return NODE_TYPES.SHOP;
  if (r < 0.92) return NODE_TYPES.ITEM;
  return NODE_TYPES.RANDOM;
}

function randomNodeTypeForRandom(rng) {
  const r = rng();
  if (r < 0.45) return NODE_TYPES.ITEM;
  if (r < 0.80) return NODE_TYPES.SHOP;
  return NODE_TYPES.ITEM;  // fallback item
}

// ─────────────────────────────────────────────────────────────────────────────
export class MapGenerator {
  constructor() {
    this.cols       = 3;
    this.rowsMax    = 4;
    this._startNode = null;
    this._seed      = null;
  }

  // ── Génère un seed aléatoire (à stocker dans la save) ─────────────────────
  static generateSeed() {
    return Math.floor(Math.random() * 2147483647);
  }

  // ── Génère la map depuis un seed ──────────────────────────────────────────
  generate(mapIndex = 0, prevArena = null, seed = null) {
    // Seed : fourni (restauration) ou généré (nouvelle map)
    this._seed    = seed ?? MapGenerator.generateSeed();
    const rng     = createRNG(this._seed);

    this.mapIndex = mapIndex;
    this.cols     = 3 + Math.floor(mapIndex / 2);
    this.rowsMax  = 4;

    const nodes     = [];
    const MAX_SHOPS = 3;
    let   shopCount = 0;

    for (let col = 0; col <= this.cols; col++) {
      const isBoss     = col === this.cols;
      const isEarlyCol = col < 2;
      const numNodes   = isBoss ? 1 : randBetweenRNG(rng, 3, this.rowsMax);
      const colNodes   = [];

      for (let row = 0; row < numNodes; row++) {
        let type = isBoss ? NODE_TYPES.BOSS : nodeTypeFromRNG(rng);

        if (type === NODE_TYPES.RANDOM) {
          type = randomNodeTypeForRandom(rng);
        }
        if (type === NODE_TYPES.SHOP) {
          if (isEarlyCol || shopCount >= MAX_SHOPS) {
            type = NODE_TYPES.ITEM;
          } else {
            shopCount++;
          }
        }

        const budget    = budgetForStep(mapIndex, col, this.cols);
        const maxUnits  = maxUnitsForStep(mapIndex, col, this.cols);
        const archIdx   = Math.floor(rng() * TRAINER_ARCHETYPES.length);
        const archetype = type === NODE_TYPES.COMBAT
          ? TRAINER_ARCHETYPES[archIdx] : null;

        let trainerData = null;
        if (type === NODE_TYPES.COMBAT && archetype) {
          trainerData = {
            name:        archetype.name,
            color:       archetype.color,
            archetypeId: archetype.id,
            units:       generateEnemyTeam(archetype, budget, maxUnits, mapIndex, rng),
          };
        } else if (isBoss) {
          const arenaData = getArenaForMap(mapIndex);
          trainerData = {
            name:  arenaData ? `Champion ${arenaData.champion}` : 'Champion',
            color: 0xffd700,
            units: arenaData ? arenaData.team : [],
          };
        }

        colNodes.push({
          id:          `${col}_${row}`,
          col, row, type,
          trainer:     trainerData,
          connections: [],
          visited:     false,
          available:   col === 0,
        });
      }
      nodes.push(colNodes);
    }

    this._buildConnections(nodes, rng);
    this._startNode = this._buildStartNode(nodes, prevArena);
    return nodes;
  }

  // ── Restaure les états visited/available depuis une liste de nœuds visités ─
  restoreState(nodes, startNode, visitedNodes = [], availableNodes = []) {
    const visitedSet   = new Set(visitedNodes);
    const availableSet = new Set(availableNodes);

    if (startNode) {
      startNode.visited   = true;
      startNode.available = false;
    }

    nodes.forEach(col => col.forEach(node => {
      node.visited   = visitedSet.has(node.id);
      node.available = availableSet.has(node.id);
    }));

    return { nodes, startNode };
  }

  // ── Connexions sans croisements ───────────────────────────────────────────
  _buildConnections(nodes, rng) {
    for (let col = 0; col < nodes.length - 1; col++) {
      const current = nodes[col];
      const next    = nodes[col + 1];

      current.forEach((node, nodeIdx) => {
        const ratio     = current.length > 1
          ? nodeIdx / (current.length - 1)
          : 0.5;
        const targetIdx = Math.round(ratio * (next.length - 1));
        const primary   = next[clamp(targetIdx, 0, next.length - 1)];
        node.connections.push(primary.id);

        if (next.length > 1 && rng() < 0.35) {
          const candidates = next.filter((n, i) =>
            i !== targetIdx && Math.abs(i - targetIdx) === 1
          );
          if (candidates.length > 0) {
            const secondary = candidates[Math.floor(rng() * candidates.length)];
            if (!node.connections.includes(secondary.id)) {
              node.connections.push(secondary.id);
            }
          }
        }
      });
    }
  }

  // ── Nœud de départ ────────────────────────────────────────────────────────
  _buildStartNode(nodes, prevArena = null) {
    const firstCol    = nodes[0];
    const connections = firstCol.map(n => n.id);
    return {
      id:          'start',
      col:         -1,
      row:         Math.floor((this.rowsMax - 1) / 2),
      type:        NODE_TYPES.START,
      trainer:     null,
      connections,
      visited:     true,
      available:   false,
      prevArena,
      label:       prevArena
        ? `${prevArena.badgeEmoji} ${prevArena.city}`
        : 'Départ',
    };
  }
}