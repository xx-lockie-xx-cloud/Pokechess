// ─────────────────────────────────────────────────────────────────────────────
// MapGenerator.js
// Génère la structure d'une map style Slay the Spire.
// Version sans Phaser — remplace Phaser.Math par des équivalents JS natifs.
// ─────────────────────────────────────────────────────────────────────────────

import { TRAINER_ARCHETYPES, generateEnemyTeam } from '../data/trainers.js';
import { getArenaForMap }                         from '../data/arenas.js';

// ── Helpers — remplacent Phaser.Math ─────────────────────────────────────────
const randBetween = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const clamp = (val, min, max) =>
  Math.min(Math.max(val, min), max);

// ─────────────────────────────────────────────────────────────────────────────

export const NODE_TYPES = {
  START:  'start',
  COMBAT: 'combat',
  SHOP:   'shop',
  ITEM:   'item',
  RANDOM: 'random',
  BOSS:   'boss',
};

// Budget de stats cible par étape — croît sur 9 maps × 6 colonnes
function budgetForStep(mapIndex, col, totalCols) {
  const globalStep = mapIndex * totalCols + col;
  const totalSteps = 9 * totalCols;
  const MIN_BUDGET = 150;
  const MAX_BUDGET = 1200;
  const ratio      = globalStep / Math.max(totalSteps - 1, 1);
  return Math.round(MIN_BUDGET + (MAX_BUDGET - MIN_BUDGET) * ratio);
}

// Nombre max de pokémons ennemis — aligné sur les slots débloqués du joueur
// map 0-1 : max 3 | map 2-3 : max 4 | map 4-5 : max 5 | map 6+ : max 6
// (le boss dispose toujours d'une unité de plus que la limite en cours)
function maxUnitsForStep(mapIndex, col, totalCols) {
  const isBoss = col === totalCols;
  let base;
  if (mapIndex < 2) base = 3;
  else if (mapIndex < 4) base = 4;
  else if (mapIndex < 6) base = 5;
  else base = 6;
  // Progression à l'intérieur d'une map : les premières colonnes démarrent 1 slot plus bas
  const earlyCol = col < Math.floor(totalCols / 2);
  if (earlyCol && base > 2) base = Math.max(2, base - 1);
  return isBoss ? Math.min(base + 1, 6) : base;
}

// Type de nœud aléatoire pondéré
function randomNodeType() {
  const r = Math.random();
  if (r < 0.60) return NODE_TYPES.COMBAT;
  if (r < 0.78) return NODE_TYPES.SHOP;
  if (r < 0.92) return NODE_TYPES.ITEM;
  return NODE_TYPES.RANDOM;
}

// Nœud RANDOM : jamais de combat — seulement SHOP, ITEM ou RANDOM lui-même
function randomNodeTypeForRandom() {
  const r = Math.random();
  if (r < 0.45) return NODE_TYPES.ITEM;
  if (r < 0.80) return NODE_TYPES.SHOP;
  return NODE_TYPES.RANDOM;  // peut rester "mystère pur" (future implémentation)
}

export class MapGenerator {
  constructor(cols = 5, rowsMax = 3) {
    this.cols       = cols;
    this.rowsMax    = rowsMax;
    this._startNode = null;
  }

  // ── Génère la map complète ────────────────────────────────────────────────
  generate(mapIndex = 0, prevArena = null) {
    this.mapIndex = mapIndex;

    // Colonnes dynamiques : +1 colonne tous les 2 badges
    // map 0-1 → 3 cols | map 2-3 → 4 cols | map 4-5 → 5 cols | map 6-7 → 6 cols
    this.cols    = 3 + Math.floor(mapIndex / 2);
    this.rowsMax = 4;   // 3-4 nœuds par colonne

    const nodes     = [];
    const MAX_SHOPS = 3;       // maximum de shops par map
    let   shopCount = 0;       // compteur shops placés

    for (let col = 0; col <= this.cols; col++) {
      const isBoss     = col === this.cols;
      const isEarlyCol = col < 2;  // 2 premières colonnes : pas de shop

      // 3 à 4 nœuds par colonne (sauf boss : toujours 1)
      const numNodes = isBoss ? 1 : randBetween(3, this.rowsMax);
      const colNodes = [];

      for (let row = 0; row < numNodes; row++) {
        let type = isBoss ? NODE_TYPES.BOSS : randomNodeType();

        // Résout RANDOM en SHOP ou ITEM (jamais COMBAT)
        if (type === NODE_TYPES.RANDOM) {
          type = randomNodeTypeForRandom();
        }

        // Remplace SHOP si quota atteint ou colonne trop tôt
        if (type === NODE_TYPES.SHOP) {
          if (isEarlyCol || shopCount >= MAX_SHOPS) {
            type = NODE_TYPES.ITEM;
          } else {
            shopCount++;
          }
        }
        const budget   = budgetForStep(mapIndex, col, this.cols);
        const maxUnits = maxUnitsForStep(mapIndex, col, this.cols);

        const archetype = (type === NODE_TYPES.COMBAT)
          ? TRAINER_ARCHETYPES[Math.floor(Math.random() * TRAINER_ARCHETYPES.length)]
          : null;

        let trainerData = null;

        if (type === NODE_TYPES.COMBAT) {
          trainerData = {
            name:        archetype.name,
            color:       archetype.color,
            archetypeId: archetype.id,
            units:       generateEnemyTeam(archetype, budget, maxUnits, mapIndex),
          };
        } else if (isBoss) {
          const arenaData = getArenaForMap(mapIndex);
          trainerData = {
            name:  arenaData ? `Champion ${arenaData.champion}` : 'Champion',
            color: 0xffd700,
            units: arenaData ? arenaData.team : this._generateBossTeam(budget),
          };
        }

        colNodes.push({
          id:          `${col}_${row}`,
          col,
          row,
          type,
          trainer:     trainerData,
          connections: [],
          visited:     false,
          available:   col === 0,
        });
      }

      nodes.push(colNodes);
    }

    this._buildConnections(nodes);
    this._startNode = this._buildStartNode(nodes, prevArena);

    return nodes;
  }

  // ── Connexions sans croisements ───────────────────────────────────────────
  _buildConnections(nodes) {
    for (let col = 0; col < nodes.length - 1; col++) {
      const current = nodes[col];
      const next    = nodes[col + 1];

      current.forEach((node, nodeIdx) => {
        const ratio     = current.length > 1
          ? nodeIdx / (current.length - 1)
          : 0.5;
        const targetIdx = Math.round(ratio * (next.length - 1));

        // ✅ clamp remplace Phaser.Math.Clamp
        const primary = next[clamp(targetIdx, 0, next.length - 1)];
        node.connections.push(primary.id);

        // Connexion secondaire optionnelle (35%)
        if (next.length > 1 && Math.random() < 0.35) {
          const candidates = next.filter((n, i) =>
            i !== targetIdx && Math.abs(i - targetIdx) === 1
          );
          if (candidates.length > 0) {
            const secondary = candidates[
              Math.floor(Math.random() * candidates.length)
            ];
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

  // ── Équipe boss de secours ────────────────────────────────────────────────
  _generateBossTeam(budget) {
    const allPokemon = TRAINER_ARCHETYPES.flatMap(a => a.pool);
    const shuffled   = [...allPokemon].sort(() => Math.random() - 0.5);
    const cells      = [];

    for (let col = 0; col < 3; col++)
      for (let row = 0; row < 2; row++)
        cells.push({ col, row });

    cells.sort(() => Math.random() - 0.5);

    const team  = [];
    let   spent = 0;

    for (const pokemon of shuffled) {
      if (team.length >= 6) break;
      const cost = pokemon.stats.hp + pokemon.stats.atk +
                   pokemon.stats.def + pokemon.stats.spd;
      if (spent + cost > budget * 1.2) continue;
      const cell = cells[team.length];
      team.push({ ...pokemon, col: cell.col, row: cell.row, attributes: [] });
      spent += cost;
    }

    return team;
  }
}