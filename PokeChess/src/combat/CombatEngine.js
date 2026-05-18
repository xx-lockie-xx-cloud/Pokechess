// Moteur de combat pur — aucune dépendance à Phaser
// Gère les tours, le ciblage, les dégâts et les attributs spéciaux

import { getTypeMultiplier } from '../data/typeChart.js';

export class CombatEngine {
  constructor(playerUnits, enemyUnits) {
    this.playerUnits = playerUnits.map(u => this._copyUnit(u, 'player'));
    this.enemyUnits  = enemyUnits.map(u  => this._copyUnit(u, 'enemy'));
    this.log         = [];
  }

  // Dans CombatEngine._copyUnit()
  _copyUnit(unit, side) {
    const atk     = unit.stats?.atk     ?? unit.atk     ?? 0;
    const spa     = unit.stats?.spa     ?? unit.spa     ?? atk;
    const def     = unit.stats?.def     ?? unit.def     ?? 0;
    const spd_def = unit.stats?.spd_def ?? unit.spd_def ?? def;
    const attackType = spa > atk ? 'special' : 'physical';

    return {
      id:          unit.id,
      uid:         unit.uid ?? `${unit.id}_${unit.col}_${unit.row}`, // ← conserve uid
      name:        unit.name,
      types:       unit.types,
      attackType,
      side,
      row:         unit.row,
      col:         unit.col,
      hp:          unit.stats?.hp ?? unit.hp,
      maxHp:       unit.stats?.hp ?? unit.hp,
      atk,
      spa,
      def,
      spd_def,
      spd:         unit.stats?.spd ?? unit.spd,
      attributes:  unit.attributes ?? [],
    };
  }

  resolve() {
    let turn = 0;
    const MAX_TURNS = 100;
    while (!this._isCombatOver() && turn < MAX_TURNS) {
      this._resolveTurn(turn);
      turn++;
    }
    const winner = this._getWinner();
    this.log.push({ type: 'combat_end', winner, turn });
    return { log: this.log, winner };
  }

  _resolveTurn(turn) {
    this.log.push({ type: 'turn_start', turn });
    const allAlive = this._allAlive().sort((a, b) => b.spd - a.spd);
    for (const attacker of allAlive) {
      if (attacker.hp <= 0) continue;
      const targets = this._getTargets(attacker);
      if (targets.length === 0) continue;
      this._performAttack(attacker, targets);
    }
  }

  _getTargets(attacker) {
    const enemies     = this._getEnemiesOf(attacker).filter(u => u.hp > 0);
    if (enemies.length === 0) return [];

    const hasPortee  = attacker.attributes.includes('portée');
    const hasEmbroch = attacker.attributes.includes('embrochage');
    const hasFendre  = attacker.attributes.includes('fendre');

    const frontRow = enemies.filter(u => u.row === 0);
    const backRow  = enemies.filter(u => u.row === 1);

    let primaryPool = hasPortee
      ? (backRow.length  > 0 ? backRow  : frontRow)
      : (frontRow.length > 0 ? frontRow : backRow);

    const primary = primaryPool[Math.floor(Math.random() * primaryPool.length)];
    const result  = [{ unit: primary, damageMultiplier: 1.0 }];

    if (hasEmbroch) {
      const behind = enemies.find(u => u.col === primary.col && u.row === primary.row + 1);
      if (behind) result.push({ unit: behind, damageMultiplier: 0.4 });
    }

    if (hasFendre) {
      const adjacent = enemies.filter(u =>
        u.row === primary.row && Math.abs(u.col - primary.col) === 1
      );
      adjacent.forEach(u => result.push({ unit: u, damageMultiplier: 0.2 }));
    }

    return result;
  }

  _performAttack(attacker, targets) {
    targets.forEach(({ unit: target, damageMultiplier }) => {
      const damage = this._calcDamage(attacker, target, damageMultiplier);
      target.hp    = Math.max(0, target.hp - damage);

      // Calcule le multiplicateur de type pour le log (affichage)
      const typeMult = getTypeMultiplier(attacker.types[0], target.types);

      this.log.push({
        type:         'attack',
        attackerId:   attacker.id,
        attackerName: attacker.name,
        attackerSide: attacker.side,
        targetId:     target.id,
        targetName:   target.name,
        targetSide:   target.side,
        damage,
        multiplier:   damageMultiplier,
        typeMult,             // pour afficher "super efficace" etc.
        targetHpLeft: target.hp,
        targetMaxHp:  target.maxHp,
      });

      if (target.hp <= 0) {
        this.log.push({
          type:     'unit_fainted',
          unitId:   target.id,
          unitName: target.name,
          unitSide: target.side,
        });
      }
    });
  }

  // ── Formule officielle ────────────────────────────────────────────────
  // Damage = ((22 * AttackStat * 50 / DefenseStat) / 50 + 2) * STAB * TypeMult * Random
  _calcDamage(attacker, target, damageMultiplier) {
    const LEVEL_FACTOR  = 22;       // équivalent niveau 50 : (2*50/5+2)
    const ATTACK_POWER  = 50;       // puissance de base fixe

    // Choisit atk/def ou spa/spd_def selon le type d'attaque
    const atkStat = attacker.attackType === 'special' ? attacker.spa    : attacker.atk;
    const defStat = attacker.attackType === 'special' ? target.spd_def  : target.def;

    // Base damage
    let damage = (((LEVEL_FACTOR * atkStat * ATTACK_POWER / defStat) / 50) + 2)/3;

    // STAB : +10% si l'attaquant partage un type avec son attaque
    // On considère que l'attaquant attaque avec son premier type
    const stab = attacker.types.includes(attacker.types[0]) ? 1.1 : 1;
    // (STAB est toujours actif ici car on attaque avec son propre type —
    //  quand on ajoutera des moves distincts, ce sera plus nuancé)

    // Multiplicateur de type
    const typeMult = getTypeMultiplier(attacker.types[0], target.types);

    // Variation aléatoire : 85% à 100% comme dans les jeux officiels
    const random = (85 + Math.random() * 15) / 100;

    // Multiplicateur de l'attribut (embrochage, fendre)
    damage = damage * stab * typeMult * random * damageMultiplier;

    return Math.max(1, Math.round(damage));
  }

  _allAlive() {
    return [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0);
  }

  _getEnemiesOf(unit) {
    return unit.side === 'player' ? this.enemyUnits : this.playerUnits;
  }

  _isCombatOver() {
    return !this.playerUnits.some(u => u.hp > 0) || !this.enemyUnits.some(u => u.hp > 0);
  }

  _getWinner() {
    return this.playerUnits.some(u => u.hp > 0) ? 'player' : 'enemy';
  }
}