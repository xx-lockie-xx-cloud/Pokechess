// ─────────────────────────────────────────────────────────────────────────────
// CombatEngine.js — Moteur avec mana, capacités ultimes et mécaniques complètes
// ─────────────────────────────────────────────────────────────────────────────

import { getTypeMultiplier }           from '../data/typeChart.js';
import { MOVES, POKEMON_MOVES, getMove } from '../data/moves.js';

// ── Multiplicateur AoE selon le nombre de cibles ─────────────────────────────
function aoeMult(targetCount) {
  if (targetCount <= 1) return 1.0;
  if (targetCount === 2) return 0.65;
  if (targetCount === 3) return 0.45;
  return 0.30;
}

const MANA_MAX       = 100;
const MANA_ON_HIT    = 20;   // mana gagnée en attaquant
const MANA_ON_RECV   = 0;    // mana reçu = % HP perdus (calculé dynamiquement)

export class CombatEngine {
  constructor(playerUnits, enemyUnits, playerSynergies = [], enemySynergies = []) {
    this.playerUnits = playerUnits.map(u => this._copyUnit(u, 'player'));
    this.enemyUnits  = enemyUnits.map(u  => this._copyUnit(u, 'enemy'));
    this.log         = [];

    this.playerFx = this._extractEffects(playerSynergies);
    this.enemyFx  = this._extractEffects(enemySynergies);

    this.rageKills        = { player: 0, enemy: 0 };
    this.swarmProcs       = 0;
    this._playerSynData   = playerSynergies;
    this._enemySynData    = enemySynergies;
  }

  // ─────────────────────────────────────────────────────────────────────────
  _extractEffects(syns) {
    const fx = new Set();
    syns.forEach(s => { if (s.effect) fx.add(s.effect); });
    return fx;
  }

  _fx(side) { return side === 'player' ? this.playerFx : this.enemyFx; }

  // ─────────────────────────────────────────────────────────────────────────
  _copyUnit(unit, side) {
    const atk     = unit.stats?.atk     ?? unit.atk     ?? 0;
    const spa     = unit.stats?.spa     ?? unit.spa     ?? atk;
    const def     = unit.stats?.def     ?? unit.def     ?? 0;
    const spd_def = unit.stats?.spd_def ?? unit.spd_def ?? def;
    return {
      id: unit.id, uid: unit.uid ?? `${unit.id}_${unit.col}_${unit.row}`,
      name: unit.name, types: unit.types ?? [], side,
      row: unit.row ?? 0, col: unit.col ?? 0,
      hp: unit.stats?.hp ?? unit.hp ?? 1,
      maxHp: unit.stats?.hp ?? unit.hp ?? 1,
      atk, spa, def, spd_def,
      spd: unit.stats?.spd ?? unit.spd ?? 1,
      attributes:  unit.attributes  ?? [],
      heldItem:    unit.heldItem    ?? null,
      // Mana
      mana: 0,
      // Statuts : array de { type, turnsLeft (-1=permanent) }
      statusEffects: [],
      // Modificateurs temporaires : { stat, mult, turnsLeft }
      tempMods: [],
      // Rage stacks { stat, mult, count, maxStacks }
      rageStack: null,
      // Bouclier armure
      armorShield: false,
      // Intouchable (Tunnel, Téléport)
      untargetable: 0,
      // Skip prochain tour (Ultralaser)
      skipNextTurn: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers statuts
  // ─────────────────────────────────────────────────────────────────────────
  _hasStatus(unit, type) {
    return unit.statusEffects.some(s => s.type === type);
  }
  _addStatus(unit, type, turns = -1) {
    const existing = unit.statusEffects.find(s => s.type === type);
    // Poison : stackable (max 5 stacks)
    if (type === 'poison' && existing) {
      existing.stacks = Math.min((existing.stacks ?? 1) + 1, 5);
      this.log.push({ type: 'status_applied', effect: type,
        label: `☠️ Poison ×${existing.stacks}`,
        stacks: existing.stacks,
        targetId: unit.uid, targetName: unit.name, targetSide: unit.side });
      return;
    }
    if (existing) return;  // autres statuts : non stackables
    unit.statusEffects.push({ type, turnsLeft: turns, stacks: 1 });
    this.log.push({ type: 'status_applied', effect: type,
      label: STATUS_LABELS[type] ?? type,
      stacks: 1,
      targetId: unit.uid, targetName: unit.name, targetSide: unit.side });
  }
  _removeStatus(unit, type) {
    unit.statusEffects = unit.statusEffects.filter(s => s.type !== type);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stats effectives (base + tempMods + rageStack)
  // ─────────────────────────────────────────────────────────────────────────
  _getStat(unit, stat) {
    let val = unit[stat] ?? 0;
    unit.tempMods.filter(m => m.stat === stat).forEach(m => { val *= m.mult; });
    if (unit.rageStack?.stat === stat && unit.rageStack.count > 0) {
      val *= Math.pow(unit.rageStack.mult, unit.rageStack.count);
    }
    return Math.max(1, Math.round(val));
  }

  // ─────────────────────────────────────────────────────────────────────────
  resolve() {
    this._setupPreCombat();
    let turn = 0;
    while (!this._isOver() && turn < 100) {
      this._resolveTurn(turn++);
    }
    const winner = this._winner();
    this.log.push({ type: 'combat_end', winner, turn });
    return { log: this.log, winner };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pré-combat : synergies
  // ─────────────────────────────────────────────────────────────────────────
  _setupPreCombat() {
    this._applyPreEffects('player', this.playerFx, this.enemyUnits, this.playerUnits);
    this._applyPreEffects('enemy',  this.enemyFx,  this.playerUnits, this.enemyUnits);
    // Armure Roche
    ['player','enemy'].forEach(side => {
      const fx = this._fx(side);
      const allies = side === 'player' ? this.playerUnits : this.enemyUnits;
      if (fx.has('armor')) {
        allies.filter(u => u.types.includes('Roche')).forEach(u => { u.armorShield = true; });
      }
    });
  }

  _applyPreEffects(side, fx, enemies, allies) {
    if (fx.has('quake')) {
      enemies.forEach(u => {
        if (u.hp <= 0) return;
        const dmg = Math.max(1, Math.ceil(u.maxHp * 0.05));
        u.hp = Math.max(0, u.hp - dmg);
        this.log.push({ type:'pre_combat', effect:'quake', label:'🏔 Tremblement !',
          targetId:u.uid, targetSide:u.side, damage:dmg, targetHpLeft:u.hp, targetMaxHp:u.maxHp });
        if (u.hp <= 0) this._handleFaint(u);
      });
    }
    if (fx.has('intimidate')) {
      enemies.forEach(u => {
        this._applyPermStat(u, 'atk',   0.85);
        this._applyPermStat(u, 'spa',   0.85);
        this.log.push({ type:'pre_combat', effect:'intimidate', label:'🌑 Intimidation !',
          targetId:u.uid, targetSide:u.side });
      });
    }
    // Statuts de synergies : limités à 3 tours (renouvelés si réappliqués)
    const statusMap = { burn:'🔥', poison:'☠️', paralyze:'⚡', freeze:'❄️', confuse:'😵' };
    const synergyStatusTurns = { burn: 3, poison: 3, confuse: 3, paralyze: -1, freeze: -1 };
    Object.keys(statusMap).forEach(eff => {
      if (!fx.has(eff)) return;
      enemies.forEach(u => {
        if (eff === 'burn') this._applyPermStat(u, 'atk', 0.90);
        this._addStatus(u, eff, synergyStatusTurns[eff] ?? -1);
      });
    });
  }

  _applyPermStat(unit, stat, mult) {
    unit[stat] = Math.round(unit[stat] * mult);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tour
  // ─────────────────────────────────────────────────────────────────────────
  _resolveTurn(turn) {
    this.log.push({ type:'turn_start', turn });
    this.swarmProcs = 0;

    // Bâillement → sommeil
    this._allAlive().forEach(u => {
      const delay = u.statusEffects.find(s => s.type === 'delayed_sleep');
      if (delay) {
        delay.turnsLeft = (delay.turnsLeft ?? 1) - 1;
        if (delay.turnsLeft <= 0) {
          this._removeStatus(u, 'delayed_sleep');
          this._addStatus(u, 'sleep', 3);
        }
      }
    });

    // Ordre de jeu : priority d'abord, puis VIT effective
    const order = this._allAlive().sort((a, b) => {
      const pa = a._pendingPriority ?? 0;
      const pb = b._pendingPriority ?? 0;
      if (pb !== pa) return pb - pa;
      return this._getStat(b, 'spd') - this._getStat(a, 'spd');
    });

    for (const unit of order) {
      if (unit.hp <= 0) continue;
      if (unit.skipNextTurn) { unit.skipNextTurn = false; continue; }
      this._takeTurn(unit);
    }

    this._resolveEndOfTurn();
    this._decrementMods();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Action d'une unité
  // ─────────────────────────────────────────────────────────────────────────
  _takeTurn(unit) {
    // Statuts qui bloquent l'action
    if (this._hasStatus(unit, 'sleep')) {
      const s = unit.statusEffects.find(e => e.type === 'sleep');
      if (s) s.turnsLeft--;
      if (s?.turnsLeft <= 0) {
        this._removeStatus(unit, 'sleep');
        this.log.push({ type:'status_cleared', effect:'sleep', label:'😴→ Réveillé !',
          targetId:unit.uid, targetSide:unit.side });
      } else {
        this.log.push({ type:'attack_skipped', reason:'sleep', label:'💤 Dort !',
          attackerId:unit.uid, attackerSide:unit.side });
        return;
      }
    }
    if (this._hasStatus(unit, 'stun')) {
      const s = unit.statusEffects.find(e => e.type === 'stun');
      if (s) s.turnsLeft = (s.turnsLeft ?? 2) - 1;
      if (!s || s.turnsLeft <= 0) this._removeStatus(unit, 'stun');
      this.log.push({ type:'attack_skipped', reason:'stun', label:'🔒 Immobilisé !',
        attackerId:unit.uid, attackerSide:unit.side });
      return;
    }
    if (this._hasStatus(unit, 'freeze') && Math.random() < 0.30) {
      this.log.push({ type:'attack_skipped', reason:'freeze', label:'❄️ Gelé !',
        attackerId:unit.uid, attackerSide:unit.side });
      return;
    }
    if (this._hasStatus(unit, 'paralyze') && Math.random() < 0.25) {
      this.log.push({ type:'attack_skipped', reason:'paralyze', label:'⚡ Paralysé !',
        attackerId:unit.uid, attackerSide:unit.side });
      return;
    }
    if (this._hasStatus(unit, 'confuse') && Math.random() < 0.20) {
      const allies = this._alliesOf(unit).filter(u => u.hp > 0 && u.uid !== unit.uid);
      if (allies.length > 0) {
        const victim = allies[Math.floor(Math.random() * allies.length)];
        const dmg    = this._calcDamage(unit, victim, 1.0, 50);
        victim.hp    = Math.max(0, victim.hp - dmg);
        this.log.push({ type:'attack', attackerId:unit.uid, attackerName:unit.name,
          attackerSide:unit.side, targetId:victim.uid, targetName:victim.name,
          targetSide:victim.side, damage:dmg, typeMult:1, confused:true,
          targetHpLeft:victim.hp, targetMaxHp:victim.maxHp });
        if (victim.hp <= 0) this._handleFaint(victim);
        return;
      }
    }
    if (unit.untargetable > 0) { unit.untargetable--; return; }

    // Ultimate (mana >= 100)
    if (unit.mana >= MANA_MAX) {
      const move = getMove(unit.id);
      if (move) {
        unit.mana = 0;
        this.log.push({ type:'ultimate_start', attackerId:unit.uid,
          attackerSide:unit.side, moveName:move.name, moveType:move.type });
        this._executeMove(unit, move);
        return;
      }
    }

    // Attaque normale
    const targets = this._getTargets(unit);
    if (!targets.length) return;
    this._performNormalAttack(unit, targets);

    // Essaim (chance configurée dans synergies.js, défaut 15%)
    const sideFx    = this._fx(unit.side);
    const swarmRate = this._swarmRate(unit.side);
    if (sideFx.has('swarm') && this.swarmProcs < 2 && unit.types.includes('Insecte')) {
      if (Math.random() < swarmRate) {
        const others = this._alliesOf(unit).filter(u =>
          u.hp > 0 && u.uid !== unit.uid && u.types.includes('Insecte'));
        if (others.length > 0) {
          this.swarmProcs++;
          const chain = others[Math.floor(Math.random() * others.length)];
          const ct    = this._getTargets(chain);
          if (ct.length) this._performNormalAttack(chain, ct, true);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ciblage (attaque normale)
  // ─────────────────────────────────────────────────────────────────────────
  _getTargets(unit) {
    const enemies = this._enemiesOf(unit).filter(u => u.hp > 0 && u.untargetable === 0);
    if (!enemies.length) return [];

    const hasPortee  = unit.attributes.includes('portée');
    const hasEmbroch = unit.attributes.includes('embrochage');
    const hasFendre  = unit.attributes.includes('fendre');

    // Charme Fée : l'ennemi cible toujours le meilleur défenseur
    const isEnemyVsPlayer = unit.side === 'enemy' && this.playerFx.has('charm');

    let primary;
    if (isEnemyVsPlayer) {
      const cands = this._enemiesOf(unit).filter(u => u.hp > 0);
      if (cands.length > 0) {
        primary = cands.reduce((best, u) => {
          const stat = unit.atk >= unit.spa ? 'def' : 'spd_def';
          return this._getStat(u, stat) > this._getStat(best, stat) ? u : best;
        }, cands[0]);
      }
    }

    if (!primary) {
      const frontRow = enemies.filter(u => u.row === 0);
      const backRow  = enemies.filter(u => u.row === 1);
      const pool     = hasPortee
        ? (backRow.length  > 0 ? backRow  : frontRow)
        : (frontRow.length > 0 ? frontRow : backRow);
      primary = pool[Math.floor(Math.random() * pool.length)];
    }

    const result = [{ unit: primary, mult: 1.0 }];
    if (hasEmbroch) {
      const behind = enemies.find(u => u.col === primary.col && u.row === primary.row + 1);
      if (behind) result.push({ unit: behind, mult: 0.4 });
    }
    if (hasFendre) {
      enemies.filter(u => u.row === primary.row && Math.abs(u.col - primary.col) === 1)
        .forEach(u => result.push({ unit: u, mult: 0.2 }));
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Attaque normale (sans capacité)
  // ─────────────────────────────────────────────────────────────────────────
  _performNormalAttack(attacker, targets, isSwarm = false) {
    const sideFx       = this._fx(attacker.side);
    const aoeReduction = aoeMult(targets.length);

    targets.forEach(({ unit: target, mult }) => {
      if (target.hp <= 0) return;
      const tFx = this._fx(target.side);

      if (tFx.has('dodge') && target.types.includes('Vol') && Math.random() < 0.20) {
        this.log.push({ type:'attack_missed', reason:'dodge', label:'🦅 Esquivé !',
          attackerId:attacker.uid, attackerSide:attacker.side,
          targetId:target.uid,    targetSide:target.side });
        return;
      }
      if (target.armorShield) {
        target.armorShield = false;
        this.log.push({ type:'attack_blocked', reason:'armor', label:'🛡 Armure !',
          attackerId:attacker.uid, attackerSide:attacker.side,
          targetId:target.uid,    targetSide:target.side });
        return;
      }
      if (this._hasStatus(target, 'freeze')) this._removeStatus(target, 'freeze');

      let dmg = Math.max(1, Math.round(
        this._calcDamage(attacker, target, mult, 50) * aoeReduction
      ));

      if (sideFx.has('crit') && attacker.types.includes('Combat') && Math.random() < 0.30) {
        dmg = Math.round(dmg * 1.5);
        this.log.push({ type:'crit', attackerId:attacker.uid, attackerSide:attacker.side });
      }
      if (tFx.has('iron') && target.types.includes('Acier')) dmg = Math.round(dmg * 0.80);

      const rageCount = this.rageKills[attacker.side];
      if (sideFx.has('rage') && attacker.types.includes('Dragon') && rageCount > 0)
        dmg = Math.round(dmg * (1 + rageCount * 0.10));

      this._dealDamage(attacker, target, dmg, mult, isSwarm);
      attacker.mana = Math.min(MANA_MAX, attacker.mana + MANA_ON_HIT);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Exécution d'une capacité ultime
  // ─────────────────────────────────────────────────────────────────────────
  _executeMove(attacker, move) {
    const targets = this._resolveTargets(attacker, move);

    // Effets avant dégâts (status appliqués à priori, buffs self)
    const preEffects = ['untargetable','stat','skip_next','shield','rage_stack',
                        'random_stat_boost','copy_enemy','trigger_ally','coins'];
    (move.effects ?? []).forEach(eff => {
      if (preEffects.includes(eff.kind)) this._applyEffect(eff, attacker, targets, move);
    });

    if (move.cat !== 'status' && move.bp > 0) {
      const hits = this._resolveHits(move);

      const aoeReduction = aoeMult(targets.length);

      targets.forEach(target => {
        if (target.hp <= 0) return;
        const tFx = this._fx(target.side);

        // Esquive
        if (tFx.has('dodge') && target.types.includes('Vol') && Math.random() < 0.20) {
          this.log.push({ type:'attack_missed', reason:'dodge', label:'🦅 Esquivé !',
            attackerId:attacker.uid, attackerSide:attacker.side,
            targetId:target.uid, targetSide:target.side });
          return;
        }
        // Armure
        if (target.armorShield && !move.ignoreArmor) {
          target.armorShield = false;
          this.log.push({ type:'attack_blocked', reason:'armor', label:'🛡 Armure !',
            attackerId:attacker.uid, attackerSide:attacker.side,
            targetId:target.uid, targetSide:target.side });
          return;
        }
        if (this._hasStatus(target, 'freeze')) this._removeStatus(target, 'freeze');

        // KO instantané
        const koEff = (move.effects ?? []).find(e => e.kind === 'ko');
        if (koEff && Math.random() < koEff.chance) {
          target.hp = 0;
          this.log.push({ type:'attack', attackerId:attacker.uid, attackerName:attacker.name,
            attackerSide:attacker.side, targetId:target.uid, targetName:target.name,
            targetSide:target.side, damage:target.maxHp, typeMult:1,
            isMove:true, moveName:move.name, isKO:true,
            targetHpLeft:0, targetMaxHp:target.maxHp });
          this._handleFaint(target);
          return;
        }

        // Dégâts fixes (Draco-Rage)
        const fixedEff = (move.effects ?? []).find(e => e.kind === 'fixed_hp_pct');
        let totalDmg = 0;
        if (fixedEff) {
          totalDmg = Math.max(1, Math.round(target.maxHp * fixedEff.rate));
        } else {
          for (let h = 0; h < hits; h++) {
            const bp  = (move.bp ?? 50) * (move.powerMult ?? 1.0);
            let   dmg = this._calcDamageMove(attacker, target, bp, move);
            // Réduction AoE : atténue les dégâts si plusieurs cibles
            dmg = Math.max(1, Math.round(dmg * aoeReduction));
            if (tFx.has('iron') && target.types.includes('Acier'))
              dmg = Math.round(dmg * 0.80);
            totalDmg += dmg;

            // Drain par hit
            if (move.drain) {
              const heal = Math.max(1, Math.round(dmg * move.drain));
              attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
              this.log.push({ type:'effect_heal', effect:'drain', label:'💚',
                targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
                heal, targetHpLeft:attacker.hp, targetMaxHp:attacker.maxHp });
            }
          }
        }

        this._dealDamage(attacker, target, totalDmg, 1.0, false, move);
        attacker.mana = Math.min(MANA_MAX, attacker.mana + MANA_ON_HIT);
      });

      // Recul
      if (move.recoil && targets.length > 0) {
        const totalDealt = targets.reduce((s, t) => {
          const dmg = Math.min(t.maxHp * 0.5,
            this._calcDamageMove(attacker, t, (move.bp ?? 50) * (move.powerMult ?? 1), move));
          return s + dmg;
        }, 0);
        const recoilDmg = Math.max(1, Math.round(totalDealt * move.recoil));
        attacker.hp = Math.max(0, attacker.hp - recoilDmg);
        this.log.push({ type:'effect_damage', effect:'recoil', label:'💥 Recul',
          targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
          damage:recoilDmg, targetHpLeft:attacker.hp, targetMaxHp:attacker.maxHp });
        if (attacker.hp <= 0) this._handleFaint(attacker);
      }

      // Attaque secondaire AoE (psyko_surf)
      if (move.aoeSecondary) {
        const aoe = move.aoeSecondary;
        const aoeTgts = this._enemiesOf(attacker).filter(u => u.hp > 0);
        aoeTgts.forEach(t => {
          const dmg = this._calcDamageMove(attacker, t, aoe.bp * (move.powerMult ?? 0.5), { ...move, type: aoe.type });
          this._dealDamage(attacker, t, dmg, 1.0, false, move);
        });
      }
    }

    // Effets après dégâts (status sur cibles, heal, push_back, clear_buffs, sacrifice)
    const postEffects = ['status','heal','push_back','clear_buffs','sacrifice','delayed_sleep','ignore_type'];
    (move.effects ?? []).forEach(eff => {
      if (postEffects.includes(eff.kind)) this._applyEffect(eff, attacker, targets, move);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Résolution des cibles pour une capacité
  // ─────────────────────────────────────────────────────────────────────────
  _resolveTargets(attacker, move) {
    const enemies = this._enemiesOf(attacker).filter(u => u.hp > 0 && u.untargetable === 0);
    const allies  = this._alliesOf(attacker).filter(u => u.hp > 0);
    if (!enemies.length && !['self','all_allies','status'].includes(move.target)) return [];

    switch (move.target) {
      case 'self':         return [attacker];
      case 'all_allies':   return [attacker, ...allies.filter(u => u.uid !== attacker.uid)];
      case 'all_enemies':  return enemies;
      case 'row_front':    return enemies.filter(u => u.row === 0).length
        ? enemies.filter(u => u.row === 0)
        : enemies.filter(u => u.row === 1);
      case 'row_back':     return enemies.filter(u => u.row === 1).length
        ? enemies.filter(u => u.row === 1)
        : enemies.filter(u => u.row === 0);
      case 'back_row_prio': {
        const br = enemies.filter(u => u.row === 1);
        const fr = enemies.filter(u => u.row === 0);
        const pool = br.length ? br : fr;
        return [pool[Math.floor(Math.random() * pool.length)]];
      }
      case 'column': {
        const primary = this._pickPrimary(attacker, enemies);
        return enemies.filter(u => u.col === primary.col);
      }
      case 'bounce_2': {
        const shuffled = [...enemies].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 2);
      }
      case 'random_2': {
        const s = [...enemies].sort(() => Math.random() - 0.5);
        return s.slice(0, 2);
      }
      case 'random_3': {
        const s = [...enemies].sort(() => Math.random() - 0.5);
        return s.slice(0, 3);
      }
      case 'nearest_2': {
        const sorted = enemies.slice().sort((a, b) => a.row - b.row);
        return sorted.slice(0, 2);
      }
      case 'primary_adj': {
        const prim = this._pickPrimary(attacker, enemies);
        const adj  = enemies.filter(u => u.row === prim.row && Math.abs(u.col - prim.col) === 1);
        return [prim, ...adj];
      }
      case 'row_primary': {
        const prim = this._pickPrimary(attacker, enemies);
        return enemies.filter(u => u.row === prim.row);
      }
      default: // 'single'
        return [this._pickPrimary(attacker, enemies)];
    }
  }

  _pickPrimary(attacker, enemies) {
    const hasPortee = attacker.attributes.includes('portée');
    const front = enemies.filter(u => u.row === 0);
    const back  = enemies.filter(u => u.row === 1);
    const pool  = hasPortee
      ? (back.length  > 0 ? back  : front)
      : (front.length > 0 ? front : back);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _resolveHits(move) {
    if (move.hitsRandom) {
      const [min, max] = move.hitsRandom;
      return min + Math.floor(Math.random() * (max - min + 1));
    }
    return move.hits ?? 1;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Application d'un effet
  // ─────────────────────────────────────────────────────────────────────────
  _applyEffect(eff, attacker, targets, move) {
    switch (eff.kind) {

      case 'status': {
        const tgts = eff.who === 'all' ? targets : [targets[0]].filter(Boolean);
        tgts.forEach(t => {
          if (t && t.hp > 0 && Math.random() < (eff.chance ?? 1.0))
            this._addStatus(t, eff.status, eff.turns ?? -1);
        });
        break;
      }

      case 'stat': {
        const who = eff.who;
        let units = [];
        if      (who === 'self')                   units = [attacker];
        else if (who === 'target')                 units = targets.slice(0, 1);
        else if (who === 'all_targets')            units = targets;
        else if (who === 'all_allies')             units = this._alliesOf(attacker);
        else if (who === 'all_enemies')            units = this._enemiesOf(attacker).filter(u => u.hp > 0);

        units.forEach(u => {
          const emoji = STAT_EMOJIS[eff.stat] ?? eff.stat;
          const up    = eff.mult > 1;
          if (eff.permanent) {
            this._applyPermStat(u, eff.stat, eff.mult);
            this.log.push({ type:'stat_change', who:u.uid, side:u.side,
              stat:eff.stat, mult:eff.mult, permanent:true, emoji,
              label:`${emoji}${up ? '▲' : '▼'}`, color:up ? '#55efc4' : '#ff7675' });
          } else {
            u.tempMods.push({ stat:eff.stat, mult:eff.mult, turnsLeft:eff.turns ?? 2 });
            this.log.push({ type:'stat_change', who:u.uid, side:u.side,
              stat:eff.stat, mult:eff.mult, turns:eff.turns, emoji,
              label:`${emoji}${up ? '▲' : '▼'}`, color:up ? '#55efc4' : '#ff7675' });
          }
        });
        break;
      }

      case 'heal': {
        let units = [];
        if      (eff.who === 'self')          units = [attacker];
        else if (eff.who === 'all_allies')    units = [attacker, ...this._alliesOf(attacker)];
        else if (eff.who === 'allies_water')  units = [attacker, ...this._alliesOf(attacker)]
          .filter(u => u.types.includes('Eau'));
        else if (eff.who === 'random_ally') {
          const pool = this._alliesOf(attacker).filter(u => u.hp > 0);
          if (pool.length) units = [pool[Math.floor(Math.random() * pool.length)]];
        }
        units.filter(u => u.hp > 0).forEach(u => {
          const heal = Math.max(1, Math.ceil(u.maxHp * eff.rate));
          u.hp = Math.min(u.maxHp, u.hp + heal);
          this.log.push({ type:'effect_heal', effect:'move_heal', label:'💚',
            targetId:u.uid, targetName:u.name, targetSide:u.side,
            heal, targetHpLeft:u.hp, targetMaxHp:u.maxHp });
        });
        break;
      }

      case 'shield': {
        const units = eff.who === 'all_allies'
          ? [attacker, ...this._alliesOf(attacker)]
          : [attacker];
        units.filter(u => u.hp > 0).forEach(u => {
          u.armorShield = true;
          this.log.push({ type:'pre_combat', effect:'shield', label:'🛡 Bouclier !',
            targetId:u.uid, targetSide:u.side });
        });
        break;
      }

      case 'push_back':
        targets.forEach(t => { if (t.hp > 0) t.row = 1; });
        break;

      case 'clear_buffs':
        this._enemiesOf(attacker).filter(u => u.hp > 0).forEach(u => {
          u.tempMods = u.tempMods.filter(m => m.mult <= 1);
          this.log.push({ type:'stat_change', who:u.uid, side:u.side,
            label:'🌀 Brouillard !', color:'#a29bfe', stat:'all', mult:1 });
        });
        break;

      case 'sacrifice':
        attacker.hp = 0;
        this.log.push({ type:'unit_fainted', unitId:attacker.uid,
          unitName:attacker.name, unitSide:attacker.side });
        break;

      case 'skip_next':
        attacker.skipNextTurn = true;
        break;

      case 'untargetable':
        attacker.untargetable = eff.turns ?? 1;
        this.log.push({ type:'status_applied', effect:'untargetable', label:'🌫 Intouchable !',
          targetId:attacker.uid, targetSide:attacker.side });
        break;

      case 'delayed_sleep':
        this._addStatus(targets[0], 'delayed_sleep', 1);
        break;

      case 'rage_stack':
        if (!attacker.rageStack) {
          attacker.rageStack = { stat:eff.stat, mult:eff.mult, count:0, maxStacks:eff.maxStacks };
        }
        if (attacker.rageStack.count < (eff.maxStacks ?? 5)) {
          attacker.rageStack.count++;
          this.log.push({ type:'stat_change', who:attacker.uid, side:attacker.side,
            stat:eff.stat, mult:eff.mult, label:`${STAT_EMOJIS[eff.stat] ?? '📈'}▲ ×${attacker.rageStack.count}`,
            color:'#fdcb6e' });
        }
        break;

      case 'random_stat_boost': {
        const stats = ['hp','atk','def','spa','spd_def','spd'];
        const s     = stats[Math.floor(Math.random() * stats.length)];
        this._applyPermStat(attacker, s, eff.mult);
        this.log.push({ type:'stat_change', who:attacker.uid, side:attacker.side,
          stat:s, mult:eff.mult, permanent:true,
          label:`${STAT_EMOJIS[s] ?? s}▲ +30%`, color:'#fdcb6e' });
        break;
      }

      case 'copy_enemy': {
        const enemies = this._enemiesOf(attacker).filter(u => u.hp > 0);
        if (!enemies.length) break;
        const target = enemies.reduce((best, u) =>
          (u.maxHp + u.atk + u.spa) > (best.maxHp + best.atk + best.spa) ? u : best, enemies[0]);
        ['atk','spa','def','spd_def','spd'].forEach(s => { attacker[s] = target[s]; });
        attacker.tempMods = [];
        attacker.id = target.id; // pour utiliser la même move
        this.log.push({ type:'status_applied', effect:'transform',
          label:`🔄 Transformation → ${target.name}`,
          targetId:attacker.uid, targetSide:attacker.side });
        break;
      }

      case 'trigger_ally': {
        const allies = this._alliesOf(attacker).filter(u => u.hp > 0 && u.uid !== attacker.uid);
        const count  = Math.min(eff.count ?? 1, allies.length);
        const picked = allies.sort(() => Math.random() - 0.5).slice(0, count);
        picked.forEach(ally => {
          const allyMove = getMove(ally.id);
          if (allyMove) {
            this.log.push({ type:'ultimate_start', attackerId:ally.uid,
              attackerSide:ally.side, moveName:allyMove.name, moveType:allyMove.type });
            this._executeMove(ally, allyMove);
          }
        });
        break;
      }

      case 'coins':
        this.log.push({ type:'coins_bonus', amount:eff.amount ?? 1,
          attackerId:attacker.uid, attackerSide:attacker.side });
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Infliger des dégâts avec log
  // ─────────────────────────────────────────────────────────────────────────
  _dealDamage(attacker, target, damage, mult, isSwarm, move = null) {
    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - damage);
    // Mana reçue = % HP perdus (ex: -20% HP → +20 mana)
    const hpPctLost = target.maxHp > 0
      ? Math.round((hpBefore - target.hp) / target.maxHp * 100)
      : 0;
    target.mana = Math.min(MANA_MAX, target.mana + hpPctLost);
    const typeMult = move?.ignoreType ? 1
      : getTypeMultiplier((move?.type ?? attacker.types[0]), target.types);

    this.log.push({
      type:         'attack',
      attackerId:   attacker.uid, attackerName: attacker.name, attackerSide: attacker.side,
      targetId:     target.uid,   targetName:   target.name,   targetSide:   target.side,
      damage, multiplier: mult, typeMult, isSwarm,
      isMove:       !!move, moveName: move?.name ?? null,
      targetHpLeft: target.hp, targetMaxHp: target.maxHp,
      // Mana info for UI
      attackerMana: attacker.mana, targetMana: target.mana,
    });

    if (target.hp <= 0) this._handleFaint(target);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Formule dégâts (attaque normale)
  // ─────────────────────────────────────────────────────────────────────────
  _calcDamage(attacker, target, damageMultiplier, basePower) {
    const atkStat = attacker.atk >= attacker.spa
      ? this._getStat(attacker, 'atk') : this._getStat(attacker, 'spa');
    const defStat = attacker.atk >= attacker.spa
      ? this._getStat(target, 'def') : this._getStat(target, 'spd_def');
    const safeDef = Math.max(1, defStat);
    let damage = (((22 * atkStat * basePower / safeDef) / 50) + 2) / 3;
    const typeMult = getTypeMultiplier(attacker.types[0], target.types);
    const random   = (85 + Math.random() * 15) / 100;
    damage = damage * 1.1 * typeMult * random * damageMultiplier;
    return Math.max(1, Math.round(damage));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Formule dégâts (capacité — respecte la catégorie de la capacité)
  // ─────────────────────────────────────────────────────────────────────────
  _calcDamageMove(attacker, target, basePower, move) {
    const isMixed = move.cat === 'mixed';
    if (isMixed) {
      // 50% des dégâts physiques + 50% des dégâts spéciaux
      const split   = move.mixedSplit ?? 0.5;
      const physDmg = this._calcDamageMoveSingle(attacker, target, basePower * split, 'physical', move);
      const specDmg = this._calcDamageMoveSingle(attacker, target, basePower * (1 - split), 'special', move);
      return Math.max(1, physDmg + specDmg);
    }
    return this._calcDamageMoveSingle(attacker, target, basePower, move.cat, move);
  }

  _calcDamageMoveSingle(attacker, target, basePower, cat, move) {
    const isPhys  = cat === 'physical';
    const atkStat = isPhys ? this._getStat(attacker, 'atk') : this._getStat(attacker, 'spa');
    let   defStat = isPhys ? this._getStat(target, 'def')   : this._getStat(target, 'spd_def');

    if (move.ignoreDefPct) defStat = Math.max(1, Math.round(defStat * (1 - move.ignoreDefPct)));
    const safeDef = Math.max(1, defStat);

    let damage = (((22 * atkStat * basePower / safeDef) / 50) + 2) / 3;

    const typeMult = move.ignoreType ? 1 : getTypeMultiplier(move.type ?? attacker.types[0], target.types);
    const isCrit   = (move.effects ?? []).some(e => e.kind === 'guaranteed_crit');
    const random   = (85 + Math.random() * 15) / 100;

    damage = damage * 1.1 * typeMult * random;
    if (isCrit) damage *= 1.5;

    return Math.max(1, Math.round(damage));
  }
  // _calcDamageMove délègue ici ↑

  // ─────────────────────────────────────────────────────────────────────────
  // Fin de tour
  // ─────────────────────────────────────────────────────────────────────────
  _resolveEndOfTurn() {
    const all = [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0);
    all.forEach(u => {
      if (this._hasStatus(u, 'burn')) {
        const dmg = Math.max(1, Math.ceil(u.maxHp * 0.05));
        u.hp = Math.max(0, u.hp - dmg);
        this.log.push({ type:'effect_damage', effect:'burn', label:'🔥',
          targetId:u.uid, targetName:u.name, targetSide:u.side,
          damage:dmg, targetHpLeft:u.hp, targetMaxHp:u.maxHp });
        if (u.hp <= 0) this._handleFaint(u);
      }
      const poisonStatus = u.statusEffects.find(s => s.type === 'poison');
      if (poisonStatus) {
        const stacks = poisonStatus.stacks ?? 1;
        const dmg    = Math.max(1, Math.ceil(u.maxHp * 0.03 * stacks));
        u.hp = Math.max(0, u.hp - dmg);
        this.log.push({ type:'effect_damage', effect:'poison',
          label: stacks > 1 ? `☠️×${stacks}` : '☠️',
          stacks,
          targetId:u.uid, targetName:u.name, targetSide:u.side,
          damage:dmg, targetHpLeft:u.hp, targetMaxHp:u.maxHp });
        if (u.hp <= 0) this._handleFaint(u);
      }
      if (u.heldItem?.effect === 'regen') {
        const heal = Math.max(1, Math.ceil(u.maxHp * (u.heldItem.regenRate ?? 0.10)));
        u.hp = Math.min(u.maxHp, u.hp + heal);
        this.log.push({ type:'effect_heal', effect:'item_regen', label:'🍖',
          targetId:u.uid, targetName:u.name, targetSide:u.side,
          heal, targetHpLeft:u.hp, targetMaxHp:u.maxHp });
      }
    });
    this._applyCurse('player', this.playerFx, this.enemyUnits);
    this._applyCurse('enemy',  this.enemyFx,  this.playerUnits);
    this._applySynergyRegen('player', this.playerFx, this.playerUnits);
    this._applySynergyRegen('enemy',  this.enemyFx,  this.enemyUnits);
  }

  _applyCurse(side, fx, targets) {
    if (!fx.has('curse')) return;
    const alive = targets.filter(u => u.hp > 0);
    if (!alive.length) return;
    const victim = alive.reduce((b, u) => u.hp > b.hp ? u : b, alive[0]);
    const dmg    = Math.max(1, Math.ceil(victim.maxHp * 0.10));
    victim.hp    = Math.max(0, victim.hp - dmg);
    this.log.push({ type:'effect_damage', effect:'curse', label:'👻',
      targetId:victim.uid, targetName:victim.name, targetSide:victim.side,
      damage:dmg, targetHpLeft:victim.hp, targetMaxHp:victim.maxHp });
    if (victim.hp <= 0) this._handleFaint(victim);
  }

  _applySynergyRegen(side, fx, units) {
    if (!fx.has('regen')) return;
    units.filter(u => u.hp > 0 && u.types.includes('Eau')).forEach(u => {
      const heal = Math.max(1, Math.ceil(u.maxHp * 0.08));
      u.hp = Math.min(u.maxHp, u.hp + heal);
      this.log.push({ type:'effect_heal', effect:'regen', label:'💧',
        targetId:u.uid, targetName:u.name, targetSide:u.side,
        heal, targetHpLeft:u.hp, targetMaxHp:u.maxHp });
    });
  }

  _decrementMods() {
    [...this.playerUnits, ...this.enemyUnits].forEach(u => {
      // Décrémente tempMods
      u.tempMods = u.tempMods
        .map(m => ({ ...m, turnsLeft: m.turnsLeft - 1 }))
        .filter(m => m.turnsLeft > 0);

      // Décrémente les statuts à durée limitée (turnsLeft > 0)
      u.statusEffects = u.statusEffects.filter(s => {
        if (s.turnsLeft === -1) return true;  // permanent
        if (s.turnsLeft <= 1) {
          this.log.push({ type:'status_cleared', effect: s.type,
            label: `${s.type} dissipé`,
            targetId: u.uid, targetSide: u.side });
          return false;
        }
        s.turnsLeft--;
        return true;
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  _handleFaint(unit) {
    if (unit._faintLogged) return;
    unit._faintLogged = true;
    unit.hp = 0;
    this.log.push({ type:'unit_fainted', unitId:unit.uid, unitName:unit.name, unitSide:unit.side });
    if (unit.types.includes('Dragon'))
      this.rageKills[unit.side] = (this.rageKills[unit.side] ?? 0) + 1;
  }

  _swarmRate(side) {
    // Taux de proc de l'essaim depuis les synergies actives
    if (side === 'player' && this._playerSynData) {
      const s = this._playerSynData.find(x => x.effect === 'swarm');
      if (s?.swarmChance) return s.swarmChance;
    }
    return 0.15;  // défaut 15%
  }

  _allAlive()      { return [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0); }
  _enemiesOf(u)    { return u.side === 'player' ? this.enemyUnits  : this.playerUnits; }
  _alliesOf(u)     { return u.side === 'player' ? this.playerUnits : this.enemyUnits; }
  _isOver()        { return !this.playerUnits.some(u => u.hp > 0) || !this.enemyUnits.some(u => u.hp > 0); }
  _winner()        { return this.playerUnits.some(u => u.hp > 0) ? 'player' : 'enemy'; }
}

// ─────────────────────────────────────────────────────────────────────────────
const STATUS_LABELS = {
  burn:'🔥 Brûlure !',  poison:'☠️ Poison !', paralyze:'⚡ Paralysie !',
  freeze:'❄️ Gel !',    sleep:'💤 Sommeil !', confuse:'😵 Confusion !',
  stun:'🔒 Immobilisé !',
};

export const STAT_EMOJIS = {
  hp:'❤️', atk:'⚔️', def:'🛡️', spa:'🔮', spd_def:'💎', spd:'👟',
};