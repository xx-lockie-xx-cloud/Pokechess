// ─────────────────────────────────────────────────────────────────────────────
// MapGenerator.js
// Génère la structure d'une map style Slay the Spire :
//   - 5 colonnes d'événements + 1 boss final
//   - 2 à 3 nœuds par colonne (sauf boss = 1 nœud centré)
//   - 1 nœud de départ (col -1) relié à tous les nœuds de col 0
//   - Connexions sans croisements entre colonnes
//   - Budget croissant pour la difficulté
// ─────────────────────────────────────────────────────────────────────────────

import { TRAINER_ARCHETYPES, generateEnemyTeam } from '../data/trainers.js';
import { getArenaForMap }                         from '../data/arenas.js';

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

// Nombre max de pokémons ennemis selon l'avancement global
function maxUnitsForStep(mapIndex, col, totalCols) {
  const globalStep = mapIndex * totalCols + col;
  const totalSteps = 9 * totalCols;
  const ratio      = globalStep / totalSteps;
  if (ratio < 0.25) return 2;
  if (ratio < 0.50) return 3;
  if (ratio < 0.75) return 4;
  return 6;
}

// Type de nœud aléatoire pondéré
function randomNodeType() {
  const r = Math.random();
  if (r < 0.55) return NODE_TYPES.COMBAT;
  if (r < 0.70) return NODE_TYPES.SHOP;
  if (r < 0.85) return NODE_TYPES.ITEM;
  return NODE_TYPES.RANDOM;
}

export class MapGenerator {
  // cols    : nombre de colonnes d'événements (hors boss)
  // rowsMax : nombre max de nœuds par colonne
  constructor(cols = 5, rowsMax = 3) {
    this.cols      = cols;
    this.rowsMax   = rowsMax;
    this._startNode = null;
  }

  // ── Génère la map complète ────────────────────────────────────────────
  // mapIndex  : index de la map actuelle (0 = map 1, 8 = map 9)
  // prevArena : données de l'arène précédente (pour le nœud de départ)
  generate(mapIndex = 0, prevArena = null) {
    this.mapIndex = mapIndex;
    const nodes   = [];

    // ── Colonnes d'événements (0 à cols-1) + colonne boss (cols) ─────────
    for (let col = 0; col <= this.cols; col++) {
      const isBoss   = col === this.cols;
      const numNodes = isBoss ? 1 : Phaser.Math.Between(2, this.rowsMax);
      const colNodes = [];

      for (let row = 0; row < numNodes; row++) {
        const type      = isBoss ? NODE_TYPES.BOSS : randomNodeType();
        const budget    = budgetForStep(mapIndex, col, this.cols);
        const maxUnits  = maxUnitsForStep(mapIndex, col, this.cols);

        // Archétype de dresseur (uniquement pour les combats)
        const archetype = (type === NODE_TYPES.COMBAT)
          ? TRAINER_ARCHETYPES[Math.floor(Math.random() * TRAINER_ARCHETYPES.length)]
          : null;

        // Données du boss (arène ou ligue selon la map)
        let trainerData = null;
        if (type === NODE_TYPES.COMBAT) {
          trainerData = {
            name:      archetype.name,
            color:     archetype.color,
            archetypeId: archetype.id,
            units:     generateEnemyTeam(archetype, budget, maxUnits),
          };
        } else if (isBoss) {
          const arenaData = getArenaForMap(mapIndex);
          trainerData = {
            name:  arenaData ? `Champion ${arenaData.champion}` : 'Champion',
            color: 0xffd700,
            units: arenaData ? arenaData.team : this._generateBossTeam(budget),
          };
        }

        const node = {
          id:          `${col}_${row}`,
          col,
          row,
          type,
          trainer:     trainerData,
          connections: [],       // remplis dans _buildConnections
          visited:     false,
          available:   col === 0,  // seule la col 0 est accessible au départ
        };

        colNodes.push(node);
      }

      nodes.push(colNodes);
    }

    // ── Connexions sans croisements ───────────────────────────────────────
    this._buildConnections(nodes);

    // ── Nœud de départ ────────────────────────────────────────────────────
    this._startNode = this._buildStartNode(nodes, prevArena);

    return nodes;
  }

  // ── Connexions : chaque nœud → 1 ou 2 nœuds de la colonne suivante ────
  // Mapping proportionnel pour éviter les croisements
  _buildConnections(nodes) {
    for (let col = 0; col < nodes.length - 1; col++) {
      const current = nodes[col];
      const next    = nodes[col + 1];

      current.forEach((node, nodeIdx) => {
        // Connexion principale : mapping proportionnel
        const ratio      = current.length > 1
          ? nodeIdx / (current.length - 1)
          : 0.5;
        const targetIdx  = Math.round(ratio * (next.length - 1));
        const primary    = next[Phaser.Math.Clamp(targetIdx, 0, next.length - 1)];
        node.connections.push(primary.id);

        // Connexion secondaire optionnelle (35%) vers un nœud adjacent
        if (next.length > 1 && Math.random() < 0.35) {
          const candidates = next.filter((n, i) =>
            i !== targetIdx && Math.abs(i - targetIdx) === 1
          );
          if (candidates.length > 0) {
            const secondary = candidates[Math.floor(Math.random() * candidates.length)];
            if (!node.connections.includes(secondary.id)) {
              node.connections.push(secondary.id);
            }
          }
        }
      });
    }
  }

  // ── Nœud de départ (col -1) ───────────────────────────────────────────
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
      visited:     true,    // toujours visité
      available:   false,   // pas cliquable
      prevArena,            // pour l'affichage du badge
      label:       prevArena
        ? `${prevArena.badgeEmoji} ${prevArena.city}`
        : 'Départ',
    };
  }

  // ── Équipe boss de secours (si pas d'arène définie) ───────────────────
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