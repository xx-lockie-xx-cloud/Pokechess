// ─────────────────────────────────────────────────────────────────────────────
// CombatEngine.js — Moteur avec mana, capacités ultimes et mécaniques complètes
// ─────────────────────────────────────────────────────────────────────────────

import { getTypeMultiplier }           from '../data/typeChart.js';
import { MOVES, POKEMON_MOVES, getMove } from '../data/moves.js';
import { POKEMON_PASSIVES, TALENT_TREES } from '../data/levelSystem.js';

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
      _level: unit._level ?? 1,  // niveau persistant pour les passifs
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
      // ATB (Active Time Battle) — barre de charge de 0→100
      // Initialisée à (100 + SPD) / 5 → pokémon rapide démarre plus avancé
      // SPD=30 → 26 | SPD=100 → 40 | SPD=110 → 42
      atbBar: 0,  // calculé après _copyUnit via _initATBBar()
      // Passif de niveau actif (null si niveau insuffisant)
      _passive: null,
      // Bouclier passif one-shot utilisé
      _passiveShieldUsed: false,
      // Compteur d'actions pour effets périodiques du passif
      _passiveActionCount: 0,
      // Premier coup du combat déjà infligé
      _firstHitDone: false,
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
    // Poison et Brûlure : stackables
    if ((type === 'poison' || type === 'burn') && existing) {
      const maxStacks = type === 'poison' ? 5 : 3;
      existing.stacks = Math.min((existing.stacks ?? 1) + 1, maxStacks);
      const icon = type === 'poison' ? '☠️' : '🔥';
      const name = type === 'poison' ? 'Poison' : 'Brûlure';
      this.log.push({ type: 'status_applied', effect: type,
        label: `${icon} ${name} ×${existing.stacks}`,
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
  // Vitesse effective ATB : 100 + SPD (lissée pour éviter les écarts extrêmes)
  // Exemple : SPD=30 → 130 | SPD=110 → 210 (ratio 1.6× au lieu de 3.6×)
  _getATBSpeed(unit) {
    return 100 + this._getStat(unit, 'spd');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // resolve() — moteur ATB
  // ─────────────────────────────────────────────────────────────────────────
  resolve() {
    this._setupPreCombat();

    let actionCount   = 0;    // nombre total d'actions (pour les effets périodiques)
    let globalActions = 0;    // sécurité anti-boucle infinie
    const MAX_ACTIONS = 500;

    // Taille du tick : chaque tick avance les barres de (speed/10) points
    // → barres moins saturées, différences de vitesse plus lisibles
    const TICK_DIV = 50;  // augmenté pour ralentir les barres ATB

    while (!this._isOver() && globalActions < MAX_ACTIONS) {
      globalActions++;

      // ── Tick ATB : avance toutes les barres d'un incrément proportionnel ──
      const alive = this._allAlive();
      if (!alive.length) break;

      // Incrément par tick = speed / TICK_DIV (ex : SPD=130 → +26/tick, SPD=210 → +42/tick)
      alive.forEach(u => {
        u.atbBar = Math.min(100 + this._getATBSpeed(u), u.atbBar + this._getATBSpeed(u) / TICK_DIV);
      });

      // Unités prêtes (barre ≥ 100) triées par valeur décroissante
      // (celle avec le plus grand overflow joue en premier)
      const ready = this._allAlive()
        .filter(u => u.atbBar >= 100)
        .sort((a, b) => b.atbBar - a.atbBar);

      for (const unit of ready) {
        if (unit.hp <= 0 || this._isOver()) continue;
        if (unit.skipNextTurn) { unit.skipNextTurn = false; unit.atbBar -= 100; continue; }

        // Log de l'action
        actionCount++;
        this.log.push({ type: 'turn_start', turn: actionCount, unitId: unit.uid, unitName: unit.name });

        // Bâillement → sommeil (décrémenté à chaque action de l'unité)
        const delay = unit.statusEffects.find(s => s.type === 'delayed_sleep');
        if (delay) {
          delay.turnsLeft = (delay.turnsLeft ?? 1) - 1;
          if (delay.turnsLeft <= 0) {
            this._removeStatus(unit, 'delayed_sleep');
            this._addStatus(unit, 'sleep', 3);
          }
        }

        // Agit
        this._takeTurn(unit);

        // Reset barre (conserve l'overflow au-delà de 100)
        unit.atbBar -= 100;

        // ── Effets de fin d'action (burn, poison, regen) ──────────────────
        // Déclenchés toutes les 8 actions globales (≈ 1 tour complet)
        if (actionCount % 8 === 0) {
          this._resolveEndOfTurn();
          this._decrementMods();
        }
      }


    }

    const winner = this._winner();
    this.log.push({ type: 'combat_end', winner, turn: actionCount });
    return { log: this.log, winner };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pré-combat : synergies
  // ─────────────────────────────────────────────────────────────────────────
  _setupPreCombat() {
    // Initialise les barres ATB APRÈS les effets pré-combat (qui peuvent modifier SPD)
    // (100 + SPD) / 5 → SPD=30 → 26 | SPD=110 → 42
    [...this.playerUnits, ...this.enemyUnits].forEach(u => {
      u.atbBar = this._getATBSpeed(u) / 5;
    });

    this._applyPassives('player', this.playerUnits, this.enemyUnits);
    this._applyPassives('enemy',  this.enemyUnits,  this.playerUnits);
    this._applyTalents('player',  this.playerUnits, this.enemyUnits);
    this._applyTalents('enemy',   this.enemyUnits,  this.playerUnits);
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
        ['atk','spa'].forEach(s => {
          const ex = u.tempMods.find(m => m.stat === s && m._intimidate);
          if (ex) { ex.mult *= 0.85; }
          else     { u.tempMods.push({ stat: s, mult: 0.85, turnsLeft: -1, _intimidate: true }); }
        });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSIFS DE NIVEAU
  // ═══════════════════════════════════════════════════════════════════════════

  // Applique les passifs de niveau pré-combat (stat boosts, intimidate, etc.)
  _applyPassives(side, allies, enemies) {
    allies.forEach(unit => {
      const level    = unit._level ?? 1;
      const passives = this._getUnitPassive(unit.id, level);
      if (!passives.length) return;
      // Stocke le tableau complet pour les triggers in-combat
      unit._passives = passives;
      // Compatibilité : _passive pointe sur le dernier (plus puissant)
      unit._passive  = passives[passives.length - 1];

      passives.forEach(passive => {
      const e = passive.effect;
      if (!e) return;

      switch (e.kind) {
        // Boosts de stats permanents
        case 'stat_boost':
          this._applyPermStat(unit, e.stat, e.mult);
          break;
        case 'dual_stat_boost':
        case 'fury_dual':
          (e.stats ?? []).forEach(s => this._applyPermStat(unit, s, e.mult));
          break;
        case 'damage_reduction':
          unit._damageReduction = (unit._damageReduction ?? 1) * e.mult;
          break;
        case 'damage_reduction_physical':
          unit._dmgReducPhysical = (unit._dmgReducPhysical ?? 1) * e.mult;
          break;
        case 'damage_reduction_special':
          unit._dmgReducSpecial  = (unit._dmgReducSpecial  ?? 1) * e.mult;
          break;
        case 'evasion':
          unit._evasion = (unit._evasion ?? 0) + e.chance;
          break;
        case 'damage_absorb':
        case 'damage_absorb_reduction':
          unit.armorShield = true;
          if (e.mult) unit._damageReduction = (unit._damageReduction ?? 1) * e.mult;
          break;
        case 'sturdy':
          unit._sturdy = true;
          break;
        case 'revive':
          unit._reviveRate = e.rate;
          break;
        case 'status_immunity':
          unit._statusImmune = true;
          break;
        case 'status_immunity_types':
          unit._statusImmuneList = [...(unit._statusImmuneList ?? []), ...(e.statuses ?? [])];
          break;
        case 'type_immunity':
          unit._typeImmune = [...(unit._typeImmune ?? []), e.type];
          break;
        case 'type_resistance':
        case 'type_resistance_immunity':
          unit._typeResist = unit._typeResist ?? {};
          if (e.resist_type) unit._typeResist[e.resist_type] = (unit._typeResist[e.resist_type] ?? 1) * e.mult;
          if (e.type)        unit._typeResist[e.type]        = (unit._typeResist[e.type]        ?? 1) * e.mult;
          if (e.immune)      unit._statusImmuneList = [...(unit._statusImmuneList ?? []), e.immune];
          break;
        case 'ignore_def':
          unit._ignoreDefPct = (unit._ignoreDefPct ?? 0) + e.pct;
          break;
        case 'multi_hit':
          unit._multiHit = { hits: e.hits, mult: e.mult };
          break;
        case 'bonus_hit':
          unit._bonusHit = e.mult;
          break;
        case 'crit_boost':
          unit._critBoost = (unit._critBoost ?? 0) + e.chance;
          break;
        case 'priority_always':
          unit._priorityAlways = true;
          break;
        // Intimidate passif (début de combat)
        case 'intimidate':
          enemies.forEach(en => {
            (e.stats ?? []).forEach(s => {
              // Utilise tempMod permanent pour que les débuffs soient visibles dans l'overlay
              const existing = en.tempMods.find(m => m.stat === s && m._intimidate);
              if (existing) {
                existing.mult *= e.mult; // cumule si plusieurs intimidate
              } else {
                en.tempMods.push({ stat: s, mult: e.mult, turnsLeft: -1, _intimidate: true });
              }
            });
          });
          this.log.push({ type:'pre_combat', effect:'passive_intimidate',
            label:`😤 ${passive.name} (${unit.name}) — ${e.stats.join('/')} ${Math.round((1-e.mult)*100)}%▼`,
            targetSide: side === 'player' ? 'enemy' : 'player' });
          break;
        case 'intimidate_proc':
          enemies.forEach(en => {
            (e.stats ?? []).forEach(s => this._applyPermStat(en, s, e.mult));
            if (e.status && Math.random() < e.chance) this._addStatus(en, e.status, 2);
          });
          break;
        // AoE statut au début
        case 'aoe_start_status': {
          const targets = e.row === 'all' ? enemies
            : enemies.filter(en => en.row === 0);
          targets.forEach(en => {
            if (en.hp <= 0) return;
            if (e.chance && Math.random() > e.chance) return;
            for (let i = 0; i < (e.stacks ?? 1); i++)
              this._addStatus(en, e.status, e.turns ?? -1);
          });
          this.log.push({ type:'pre_combat', effect:'passive_aoe_status',
            label:`✨ ${passive.name} (${unit.name})`, targetSide: side === 'player' ? 'enemy' : 'player' });
          break;
        }
        case 'aoe_start_status_stack': {
          // Comme aoe_start_status mais force un stack supplémentaire
          // même si le statut est déjà présent (ex: Sulfura + synergie Feu)
          const targets2 = e.row === 'all' ? enemies
            : enemies.filter(en => en.row === 0);
          targets2.forEach(en => {
            if (en.hp <= 0) return;
            if (e.chance && Math.random() > e.chance) return;
            // Force le stack même si statut existant
            const existing = en.statusEffects.find(s => s.type === e.status);
            if (existing) {
              existing.stacks = (existing.stacks ?? 1) + (e.stacks ?? 1);
              this.log.push({ type:'status_applied', effect: e.status,
                label:`🔥 ${passive.name} — stack brûlure ×${existing.stacks}`,
                stacks: existing.stacks,
                targetId:en.uid, targetName:en.name, targetSide:en.side });
            } else {
              this._addStatus(en, e.status, e.turns ?? 3);
            }
          });
          this.log.push({ type:'pre_combat', effect:'passive_aoe_status_stack',
            label:`🔥 ${passive.name} (${unit.name})`, targetSide: side === 'player' ? 'enemy' : 'player' });
          break;
        }
        // Aura boost (alliés d'un type)
        case 'aura_type_boost':
          allies.filter(a => a.types.includes(e.type) && a !== unit)
            .forEach(a => {
              this._applyPermStat(a, 'atk',     e.mult);
              this._applyPermStat(a, 'spa',     e.mult);
              this._applyPermStat(a, 'def',     e.mult);
              this._applyPermStat(a, 'spd_def', e.mult);
            });
          break;
        case 'aura_all_boost':
          allies.filter(a => a !== unit).forEach(a => {
            ['atk','spa','def','spd_def','spd'].forEach(s => this._applyPermStat(a, s, e.mult));
          });
          break;
        // Timing boost initial
        case 'temporary_boost':
          unit.tempMods.push({ stat: e.stat, mult: e.mult, turnsLeft: e.duration });
          break;
        // Type absorb (immunité + soin)
        case 'type_absorb':
          unit._typeAbsorb = [...(unit._typeAbsorb ?? []), e.type];
          break;
        // First hit boost
        case 'first_hit_boost':
          unit._firstHitMult = e.mult;
          break;
        // Boost highest stat
        case 'boost_highest_stat': {
          const stats = ['atk','spa','def','spd_def','spd'];
          const best  = stats.reduce((b, s) => unit[s] > unit[b] ? s : b, stats[0]);
          this._applyPermStat(unit, best, e.mult);
          break;
        }
        case 'status_immunity_boost':
          unit._statusImmune = true;
          ['atk','spa','def','spd_def','spd'].forEach(s => this._applyPermStat(unit, s, e.mult));
          break;
        case 'lone_type_boost': {
          const countSameType = allies.filter(a => a !== unit && a.types.some(t => unit.types.includes(t))).length;
          if (countSameType === 0) this._applyPermStat(unit, e.stat, e.mult);
          break;
        }
        case 'boost_from_strongest': {
          // Gagne ratio × stats du pokémon le plus puissant (allié ou ennemi)
          const allU  = [...this.playerUnits, ...this.enemyUnits];
          const strg  = allU.filter(u => u !== unit)
            .sort((a,b) => (b.atk+b.spa+b.def+b.spd_def+b.spd+b.hp)
                         - (a.atk+a.spa+a.def+a.spd_def+a.spd+a.hp))[0];
          const ratio = e.ratio ?? (1/3);
          if (strg) {
            ['atk','spa','def','spd_def','spd','hp'].forEach(s => {
              const bonus = Math.round(strg[s] * ratio);
              unit[s]  += bonus;
              if (s === 'hp') unit.maxHp += bonus;
            });
            this.log.push({ type:'pre_combat', effect:'boost_from_strongest',
              label:`⭐ ${passive.name} — +1/3 stats de ${strg.name}`,
              targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
          }
          break;
        }
        case 'sleep_n_start': {
          const shuffled = [...enemies].sort(() => Math.random() - 0.5);
          shuffled.slice(0, e.count ?? 1).forEach(en => {
            if (en.hp > 0) this._addStatus(en, 'sleep', e.turns ?? 2);
          });
          break;
        }
        case 'sleep_one_start': {
          const target = enemies.filter(en => en.hp > 0)[Math.floor(Math.random() * enemies.length)];
          if (target) this._addStatus(target, 'sleep', e.turns ?? 2);
          break;
        }
        // Régén périodique de zone (setup, déclenché dans _resolveEndOfTurn)
        case 'regen_all_period':
        case 'regen_ally':
          // stocké dans _passive, déclenché dans _resolveEndOfTurn
          break;
        case 'random_passive': {
          // Métronome : tire un passif aléatoire parmi tous les existants
          const allDefs   = Object.values(POKEMON_PASSIVES);
          const allKinds  = [];
          allDefs.forEach(def => {
            [35, 70].forEach(lvl => {
              if (def[lvl]?.effect?.kind && def[lvl].effect.kind !== 'random_passive')
                allKinds.push(def[lvl]);
            });
          });
          if (allKinds.length > 0) {
            const picked = allKinds[Math.floor(Math.random() * allKinds.length)];
            // Stocke le passif tiré pour les triggers in-combat
            unit._metronomePassive = picked;
            // Applique les effets de setup du passif tiré
            const savedPassive = passive;
            const tmpUnit = { ...unit, _passive: picked };
            // Log visible en fin de combat
            this.log.push({ type:'pre_combat', effect:'metronome',
              label:`🎲 Métronome → ${picked.name} : ${picked.desc}`,
              targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
          }
          break;
        }
        // Passifs actifs (in-combat) — stockés pour _checkPassiveTriggers
        default:
          break;
      }
      }); // fin passives.forEach
    });
  }

  // Récupère le passif d'un pokémon selon son niveau
  // Retourne un tableau de tous les passifs actifs selon le niveau
  // Nv.35 ET Nv.70 sont actifs si level >= 70
  _getUnitPassive(pokemonId, level) {
    const all = POKEMON_PASSIVES[pokemonId];
    if (!all) return [];
    const result = [];
    if (level >= 35 && all[35]) result.push(all[35]);
    if (level >= 70 && all[70]) result.push(all[70]);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TALENTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Applique les effets des talents débloqués (injectés via talentEffects)
  _applyTalents(side, allies, enemies) {
    const talentEffects = side === 'player'
      ? (this._playerTalents ?? [])
      : (this._enemyTalents  ?? []);

    talentEffects.forEach(e => {
      switch (e.kind) {
        case 'type_stat':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => this._applyPermStat(u, e.stat, e.mult));
          break;
        case 'type_dual_stat':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => (e.stats ?? []).forEach(s => this._applyPermStat(u, s, e.mult)));
          break;
        case 'type_evasion':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._evasion = (u._evasion ?? 0) + e.chance; });
          break;
        case 'type_status_immunity':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._statusImmuneList = [...(u._statusImmuneList ?? []), e.status]; });
          break;
        case 'type_start_shield':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u.armorShield = true; });
          break;
        case 'type_start_debuff':
          enemies.forEach(en => this._applyPermStat(en, e.stat, e.mult));
          break;
        case 'type_start_status':
          enemies.forEach(en => {
            for (let i = 0; i < (e.stacks ?? 1); i++)
              this._addStatus(en, e.status, -1);
          });
          break;
        case 'type_start_aoe_status':
          enemies.filter(en => e.row === 'all' || en.row === 0).forEach(en => {
            if (Math.random() < (e.chance ?? 1)) this._addStatus(en, e.status, 2);
          });
          break;
        case 'type_once_aoe':
          // déclenché via _talentAoeUsed dans le moteur
          this._pendingTalentAoe = this._pendingTalentAoe ?? [];
          this._pendingTalentAoe.push({ side, ...e });
          break;
        case 'type_revive':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._reviveRate = Math.max(u._reviveRate ?? 0, e.rate); });
          break;
        case 'type_proc':
          // stocké dans _talentProcs, vérifié dans _checkPassiveTriggers
          this._talentProcs = this._talentProcs ?? [];
          this._talentProcs.push({ side, ...e });
          break;
        case 'type_aoe_immunity':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._immuneToAoe = true; });
          break;
        case 'type_ignore_def':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._ignoreDefPct = (u._ignoreDefPct ?? 0) + e.pct; });
          break;
        case 'type_counter':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._counterRate = (u._counterRate ?? 0) + e.rate; });
          break;
        case 'type_ignore_resistance':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._ignoreResistance = true; });
          break;
        case 'all_immunity_type':
          allies.forEach(u => { u._typeImmune = [...(u._typeImmune ?? []), e.immune_type]; });
          break;
        case 'bonus_slot':
          // géré côté UI (runState)
          break;
        case 'type_damage_reduction_special':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._dmgReducSpecial = (u._dmgReducSpecial ?? 1) * e.mult; });
          break;
        case 'type_group_reduction':
          if (allies.filter(u => u.types.includes(e.type)).length >= e.count)
            allies.filter(u => u.types.includes(e.type))
              .forEach(u => { u._damageReduction = (u._damageReduction ?? 1) * e.mult; });
          break;
        case 'type_boost_highest':
          allies.filter(u => u.types.includes(e.type)).forEach(u => {
            const stats = ['atk','spa','def','spd_def','spd'];
            const best  = stats.reduce((b, s) => u[s] > u[b] ? s : b, stats[0]);
            this._applyPermStat(u, best, e.mult);
          });
          break;
        case 'type_regen_all':
          // stocké dans _talentRegens, déclenché dans _resolveEndOfTurn
          this._talentRegens = this._talentRegens ?? [];
          this._talentRegens.push({ side, ...e });
          break;
        case 'type_aoe_row':
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._aoeRow = e.row; });
          break;
        case 'type_dot_boost':
          // boostPoison : géré dans _applyDot
          this._poisonBoost = (this._poisonBoost ?? 1) * e.mult;
          break;
        case 'type_status_boost':
          // durée statut : géré dans _addStatus (via _statusDurationMult)
          this._statusDurationMult = (this._statusDurationMult ?? 1) * e.mult;
          break;
        case 'type_swarm_boost':
          this._swarmChance = e.chance;
          break;
        default: break;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VÉRIFICATION DES PASSIFS EN COMBAT
  // ═══════════════════════════════════════════════════════════════════════════

  // Appelé après chaque attaque de 'attacker' sur 'target' — procs passifs
  _checkPassiveTriggers(attacker, target, damage) {
    const allPassives = attacker._passives ?? (attacker._passive ? [attacker._passive] : []);
    allPassives.forEach(p => {
      if (!p?.effect) return;
      const e = p.effect;
      this._checkSinglePassiveTrigger(p, e, attacker, target, damage);
    });
  }

  _checkSinglePassiveTrigger(p, e, attacker, target, damage) {
    const allies  = attacker.side === 'player' ? this.playerUnits : this.enemyUnits;
    const enemies = attacker.side === 'player' ? this.enemyUnits  : this.playerUnits;

    switch (e.kind) {
      case 'on_attack_proc':
      case 'on_attack_proc_drain':
      case 'on_attack_proc_debuff': {
        if (Math.random() < e.chance) {
          for (let i = 0; i < (e.stacks ?? 1); i++)
            this._addStatus(target, e.status, e.turns ?? -1);
          if (e.drain) {
            const heal = Math.max(1, Math.ceil(damage * e.drain));
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
            this.log.push({ type:'effect_heal', effect:'passive_drain', label:`🩸 ${p.name}`,
              targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
              heal, targetHpLeft:attacker.hp, targetMaxHp:attacker.maxHp });
          }
          if (e.stat && e.debuff) this._applyPermStat(target, e.stat, e.debuff);
        }
        break;
      }
      case 'drain_attack': {
        const heal = Math.max(1, Math.ceil(damage * e.rate));
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        this.log.push({ type:'effect_heal', effect:'passive_drain', label:`🩸 ${p.name}`,
          targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
          heal, targetHpLeft:attacker.hp, targetMaxHp:attacker.maxHp });
        break;
      }
      case 'on_hit_debuff':
      case 'multi_hit_debuff':
        this._applyPermStat(target, e.stat, e.mult);
        break;
      case 'ramp_stat':
      case 'ramp_dual': {
        const stats = e.stats ?? [e.stat];
        let totalPct = 0;
        stats.forEach(s => {
          const cur  = attacker._rampMult?.[s] ?? 0;
          const next = Math.min(cur + (e.per_action ?? 0.05), e.max ?? 0.50);
          attacker._rampMult = attacker._rampMult ?? {};
          attacker._rampMult[s] = next;
          attacker.tempMods = attacker.tempMods.filter(m => m.stat !== s || m._ramp !== true);
          attacker.tempMods.push({ stat: s, mult: 1 + next, turnsLeft: -1, _ramp: true });
          totalPct = Math.round(next * 100);
        });
        this.log.push({ type:'passive_trigger', effect:'ramp',
          label:`⬆ ${p.name} (${attacker.name}) +${totalPct}%`,
          targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side });
        break;
      }
      case 'bonus_vs_status':
        // géré dans _calcDamage
        break;
      case 'rage_stack': {
        if (!attacker._isReceivingHit) break; // déclenché seulement sur réception
        attacker.rageStack = attacker.rageStack ?? { stat: e.stat, count: 0, mult: 1 + (e.per_hit ?? 0.05) };
        const maxCount = Math.floor((e.max ?? 0.50) / (e.per_hit ?? 0.05));
        attacker.rageStack.count = Math.min(attacker.rageStack.count + 1, maxCount);
        break;
      }
      case 'flat_bonus_dmg':
        // ajouté dans _calcDamage
        break;
      case 'periodic_aoe':
      case 'periodic_aoe_status': {
        attacker._passiveActionCount = (attacker._passiveActionCount ?? 0) + 1;
        if (attacker._passiveActionCount % (e.period ?? 8) === 0) {
          enemies.filter(en => en.hp > 0).forEach(en => {
            this._addStatus(en, e.status ?? 'paralyze', 2);
          });
          this.log.push({ type:'pre_combat', effect:'passive_periodic_aoe',
            label:`✨ ${p.name} (${attacker.name})` });
        }
        break;
      }
      case 'dot_target': {
        // applique un dot sur la cible (8% HP/action)
        if (!target._passDots) target._passDots = [];
        if (!target._passDots.includes(attacker.uid)) {
          target._passDots.push(attacker.uid);
          target._passiveDotRate = Math.max(target._passiveDotRate ?? 0, e.rate ?? 0.08);
        }
        break;
      }
      default: break;
    }

    // Procs talents aussi
    (this._talentProcs ?? [])
      .filter(tp => tp.side === attacker.side && attacker.types.includes(tp.type))
      .forEach(tp => {
        if (Math.random() < tp.chance) {
          this._addStatus(target, tp.status, tp.turns ?? 2);
        }
      });
  }

  // Passifs sur réception d'un coup
  _checkPassiveOnReceive(unit, attacker, damage) {
    const allPassives = unit._passives ?? (unit._passive ? [unit._passive] : []);
    allPassives.forEach(p => {
      if (!p?.effect) return;
      const e = p.effect;
      this._checkSinglePassiveOnReceive(p, e, unit, attacker, damage);
    });
  }

  _checkSinglePassiveOnReceive(p, e, unit, attacker, damage) {
    switch (e.kind) {
      case 'drain_on_receive': {
        // Enracinement : absorbe X% des dégâts reçus comme soins
        const heal = Math.max(1, Math.ceil(damage * e.rate));
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        this.log.push({ type:'effect_heal', effect:'drain_on_receive', label:`🌿 ${p.name}`,
          targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
          heal, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
        break;
      }
      case 'counter':
      case 'damage_reduction_counter': {
        const rate = e.counter ?? e.rate ?? 0;
        if (rate > 0) {
          const counterDmg = Math.max(1, Math.ceil(damage * rate));
          attacker.hp = Math.max(0, attacker.hp - counterDmg);
          this.log.push({ type:'attack', effect:'counter', label:`🔄 ${p.name}`,
            attackerId:unit.uid, attackerName:unit.name, attackerSide:unit.side,
            targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
            damage:counterDmg, targetHpLeft:attacker.hp, targetMaxHp:attacker.maxHp,
            attackerMana:unit.mana, targetMana:attacker.mana,
            attackerAtb:unit.atbBar, targetAtb:attacker.atbBar });
          if (attacker.hp <= 0) this._handleFaint(attacker);
        }
        break;
      }
      case 'rage_stack': {
        unit.rageStack = unit.rageStack ?? { stat: e.stat, count: 0, mult: 1 + (e.per_hit ?? 0.05) };
        const maxCount = Math.floor((e.max ?? 0.50) / (e.per_hit ?? 0.05));
        unit.rageStack.count = Math.min(unit.rageStack.count + 1, maxCount);
        const totalBoost = Math.round(unit.rageStack.count * (e.per_hit ?? 0.05) * 100);
        this.log.push({ type:'passive_trigger', effect:'rage',
          label:`😤 ${p.name} (${unit.name}) +${totalBoost}% ${e.stat}`,
          targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
        break;
      }
      case 'on_receive_proc': {
        if (Math.random() < e.chance) {
          this._addStatus(attacker, e.status, e.turns ?? 2);
        }
        break;
      }
      case 'status_reflect':
      case 'status_reflect_once': {
        const chance = e.chance ?? 1.0;
        if (e.kind === 'status_reflect_once' && unit._reflectUsed) break;
        if (Math.random() < chance) {
          attacker.statusEffects.filter(s => !['sleep'].includes(s.type)).forEach(s => {
            this._addStatus(attacker, s.type, s.turnsLeft);
          });
          if (e.kind === 'status_reflect_once') unit._reflectUsed = true;
        }
        break;
      }
      default: break;
    }
  }

  // Passifs à la mort d'une unité
  _checkDeathPassives(unit) {
    const p = unit._passive;
    const allies  = unit.side === 'player' ? this.playerUnits : this.enemyUnits;
    const enemies = unit.side === 'player' ? this.enemyUnits  : this.playerUnits;

    if (p?.effect) {
      const e = p.effect;
      switch (e.kind) {
        case 'on_death_aoe': {
          const dmg = Math.max(1, Math.ceil(unit.maxHp * e.rate));
          enemies.filter(en => en.hp > 0).forEach(en => {
            en.hp = Math.max(0, en.hp - dmg);
            en.maxHp = Math.max(1, en.maxHp - Math.max(1, Math.floor(dmg * 0.1)));
            this.log.push({ type:'attack', effect:'death_passive', label:`💥 ${p.name}`,
              attackerId:unit.uid, attackerName:unit.name, attackerSide:unit.side,
              targetId:en.uid, targetName:en.name, targetSide:en.side,
              damage:dmg, targetHpLeft:en.hp, targetMaxHp:en.maxHp,
              attackerMana:unit.mana, targetMana:en.mana,
              attackerAtb:unit.atbBar, targetAtb:en.atbBar });
            if (en.hp <= 0) this._handleFaint(en);
          });
          break;
        }
        case 'on_death_aoe_pct': {
          enemies.filter(en => en.hp > 0).forEach(en => {
            const dmg = Math.max(1, Math.ceil(en.maxHp * e.rate));
            en.hp = Math.max(0, en.hp - dmg);
            this.log.push({ type:'attack', effect:'death_passive', label:`👻 ${p.name}`,
              attackerId:unit.uid, attackerName:unit.name, attackerSide:unit.side,
              targetId:en.uid, targetName:en.name, targetSide:en.side,
              damage:dmg, targetHpLeft:en.hp, targetMaxHp:en.maxHp,
              attackerMana:unit.mana, targetMana:en.mana,
              attackerAtb:unit.atbBar, targetAtb:en.atbBar });
            if (en.hp <= 0) this._handleFaint(en);
          });
          break;
        }
        case 'on_death_target': {
          const target = enemies.filter(en => en.hp > 0)
            .sort((a,b) => b.hp - a.hp)[0];
          if (target) {
            const dmg = Math.max(1, Math.ceil(unit.maxHp * e.rate));
            target.hp = Math.max(0, target.hp - dmg);
            this.log.push({ type:'attack', effect:'death_passive', label:`💀 ${p.name}`,
              attackerId:unit.uid, attackerName:unit.name, attackerSide:unit.side,
              targetId:target.uid, targetName:target.name, targetSide:target.side,
              damage:dmg, targetHpLeft:target.hp, targetMaxHp:target.maxHp,
              attackerMana:unit.mana, targetMana:target.mana,
              attackerAtb:unit.atbBar, targetAtb:target.atbBar });
            if (target.hp <= 0) this._handleFaint(target);
          }
          break;
        }
        case 'revive': {
          if (!unit._revived) {
            unit._revived = true;
            unit.hp = Math.max(1, Math.ceil(unit.maxHp * e.rate));
            this.log.push({ type:'effect_heal', effect:'revive', label:`✨ ${p.name}`,
              targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
              heal:unit.hp, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
            return; // annule la mort
          }
          break;
        }
        default: break;
      }
    }

    // Revive via talent
    if (unit._reviveRate && !unit._revived) {
      unit._revived = true;
      unit.hp = Math.max(1, Math.ceil(unit.maxHp * unit._reviveRate));
      this.log.push({ type:'effect_heal', effect:'revive', label:'✨ Phénix (talent)',
        targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
        heal:unit.hp, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
      return; // annule la mort
    }

    // Sturdy
    if (unit._sturdy && !unit._sturdyUsed && unit.hp <= 0) {
      unit._sturdyUsed = true;
      unit.hp = 1;
      this.log.push({ type:'pre_combat', effect:'sturdy', label:`🪨 Robustesse (${unit.name})` });
      return;
    }

    // Ko boost alliés
    const alliesAlive = allies.filter(a => a.hp > 0 && a !== unit);
    alliesAlive.forEach(ally => {
      const ap = ally._passive?.effect;
      if (ap?.kind === 'on_ko_boost') {
        this._applyPermStat(ally, ap.stat, 1 + ap.mult);
        this.log.push({ type:'pre_combat', effect:'on_ko_boost',
          label:`⬆ ${ally._passive.name} (${ally.name})` });
      }
    });
  }

  _applyPermStat(unit, stat, mult) {
    unit[stat] = Math.round(unit[stat] * mult);
  }

  // _resolveTurn() supprimé — remplacé par le moteur ATB dans resolve()

  // ─────────────────────────────────────────────────────────────────────────
  // Action d'une unité
  // ─────────────────────────────────────────────────────────────────────────
  _takeTurn(unit) {
    // ── Passifs actifs à chaque tour — itère sur TOUS les passifs débloqués ──
    const passives = unit._passives ?? (unit._passive ? [unit._passive] : []);
    const p = unit._passive?.effect; // garde pour les blocs fury/stack ci-dessous


    // regen_self : soigne 5% HP à chaque action du pokémon
    passives.forEach(passive => {
      if (passive.effect?.kind !== 'regen_self') return;
      const rate = passive.effect.rate ?? 0.05;
      const heal = Math.max(1, Math.ceil(unit.maxHp * rate));
      unit.hp    = Math.min(unit.maxHp, unit.hp + heal);
      this.log.push({ type:'effect_heal', effect:'passive_regen', label:`💚 ${passive.name}`,
        targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
        heal, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
    });

    // fury / conditional_boost : applique un tempMod selon PV
    passives.forEach(passive => {
      const ep = passive.effect;
      if (ep?.kind !== 'fury' && ep?.kind !== 'fury_dual') return;
      const threshold = ep.threshold ?? 0.5;
      const active    = (unit.hp / unit.maxHp) < threshold;
      const stats     = ep.kind === 'fury_dual' ? (ep.stats ?? [ep.stat]) : [ep.stat];
      const modKey    = `_fury_${passive.id}_${unit.uid}`;
      const wasActive = unit._furyActive?.[modKey];
      unit.tempMods   = unit.tempMods.filter(m => m._furyKey !== modKey);
      if (active) {
        stats.forEach(s => unit.tempMods.push({ stat: s, mult: ep.mult, turnsLeft: -1, _furyKey: modKey }));
        if (!wasActive) {
          unit._furyActive = unit._furyActive ?? {};
          unit._furyActive[modKey] = true;
          this.log.push({ type:'passive_trigger', effect:'fury',
            label:`🔥 ${passive.name} activé ! (${unit.name} PV<${Math.round(threshold*100)}%)`,
            targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
        }
      } else {
        if (unit._furyActive) delete unit._furyActive[modKey];
      }
    });

    // conditional_boost : boost si condition remplie (hp_above)
    if (p?.kind === 'conditional_boost') {
      const hpPct   = unit.hp / unit.maxHp;
      const active  = p.condition === 'hp_above'
        ? hpPct >= (p.threshold ?? 0.75)
        : hpPct < (p.threshold ?? 0.75);
      const modKey  = `_cond_${unit.uid}`;
      unit.tempMods = unit.tempMods.filter(m => m._condKey !== modKey);
      if (active) {
        unit.tempMods.push({ stat: p.stat, mult: p.mult, turnsLeft: -1, _condKey: modKey });
      }
    }

    // stack_per_ally : recalcule le bonus selon les alliés vivants
    if (p?.kind === 'stack_per_ally') {
      const allies  = unit.side === 'player' ? this.playerUnits : this.enemyUnits;
      const count   = p.type === 'all'
        ? allies.filter(a => a.hp > 0 && a !== unit).length
        : allies.filter(a => a.hp > 0 && a !== unit && a.types.includes(p.type)).length;
      const mult    = 1 + count * (p.per_ally ?? 0.05);
      const modKey  = `_stack_${unit.uid}`;
      unit.tempMods = unit.tempMods.filter(m => m._stackKey !== modKey);
      unit.tempMods.push({ stat: p.stat, mult, turnsLeft: -1, _stackKey: modKey });
    }

    // dodge_once : marque l'unité comme esquivant la prochaine attaque
    if (p?.kind === 'dodge_once' && !unit._dodgeUsed) {
      unit._dodgeOnce = true;
    }

    // emergency_heal : soigne si PV critiques
    if (p?.kind === 'emergency_heal' && !unit._emergencyUsed) {
      if ((unit.hp / unit.maxHp) < (p.threshold ?? 0.25)) {
        unit._emergencyUsed = true;
        const heal = Math.max(1, Math.ceil(unit.maxHp * p.rate));
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        this.log.push({ type:'effect_heal', effect:'passive_emergency', label:`💚 ${unit._passive.name}`,
          targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
          heal, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
      }
    }

    // heal_on_ko : soigne après avoir K.O. un ennemi (géré dans _handleFaint via callback)
    // on_ko_boost : géré dans _checkDeathPassives

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
    if (this._hasStatus(unit, 'freeze')) {
      // Gel : -25% VIT, se lève après 2 actions propres du pokémon
      const freezeSt = unit.statusEffects.find(s => s.type === 'freeze');
      if (freezeSt) {
        freezeSt._actionsLeft = (freezeSt._actionsLeft ?? 2);
        // Applique le malus VIT via tempMod si pas encore présent
        if (!unit.tempMods.some(m => m._freeze)) {
          unit.tempMods.push({ stat:'spd', mult:0.75, turnsLeft:-1, _freeze:true });
        }
        freezeSt._actionsLeft--;
        this.log.push({ type:'passive_trigger', effect:'freeze',
          label:`❄️ Gel (${unit.name}) — VIT -25% (${freezeSt._actionsLeft} action${freezeSt._actionsLeft>1?'s':''} restante${freezeSt._actionsLeft>1?'s':''})`,
          targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
        if (freezeSt._actionsLeft <= 0) {
          this._removeStatus(unit, 'freeze');
          unit.tempMods = unit.tempMods.filter(m => !m._freeze);
          this.log.push({ type:'passive_trigger', effect:'freeze',
            label:`🌡 ${unit.name} n'est plus gelé !`,
            targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
        }
      }
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
    });
    // Mana une seule fois par attaque, indépendamment du nombre de cibles
    if (targets.length > 0) {
      attacker.mana = Math.min(MANA_MAX, attacker.mana + MANA_ON_HIT);
    }
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
      });
      // Mana gagnée une seule fois après l'attaque, indépendamment du nb de cibles
      attacker.mana = Math.min(MANA_MAX, attacker.mana + MANA_ON_HIT);

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
    // Érosion PV max : 10% des dégâts reçus, minimum 1 HP
    const erosion = Math.max(1, Math.floor(damage * 0.10));
    target.maxHp  = Math.max(1, target.maxHp - erosion);
    // Si les PV actuels dépassent le nouveau max, on les plafonne
    target.hp = Math.min(target.hp, target.maxHp);
    const typeMult = move?.ignoreType ? 1
      : getTypeMultiplier((move?.type ?? attacker.types[0]), target.types);

    this.log.push({
      type:         'attack',
      attackerId:   attacker.uid, attackerName: attacker.name, attackerSide: attacker.side,
      targetId:     target.uid,   targetName:   target.name,   targetSide:   target.side,
      damage, multiplier: mult, typeMult, isSwarm,
      isMove:       !!move, moveName: move?.name ?? null,
      targetHpLeft: target.hp, targetMaxHp: target.maxHp,
      attackerMana: attacker.mana, targetMana: target.mana,
      attackerAtb:  Math.max(0, Math.min(100, attacker.atbBar ?? 0)),
      targetAtb:    Math.max(0, Math.min(100, target.atbBar   ?? 0)),
    });

    // Passifs post-attaque
    this._checkPassiveTriggers(attacker, target, damage);
    this._checkPassiveOnReceive(target, attacker, damage);

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

    // Passif ignore_def / ignore_def_chance
    let defMult = 1.0;
    if (attacker._ignoreDefPct > 0)   defMult -= Math.min(attacker._ignoreDefPct, 1.0);
    const ep = attacker._passive?.effect;
    if (ep?.kind === 'ignore_def_chance' && Math.random() < ep.chance) defMult = 0;
    const safeDef = Math.max(1, Math.round(defStat * defMult));

    let damage = (((22 * atkStat * basePower / safeDef) / 50) + 2) / 3;

    const typeMult = move.ignoreType ? 1 : getTypeMultiplier(move.type ?? attacker.types[0], target.types);
    const isCrit   = (move.effects ?? []).some(e => e.kind === 'guaranteed_crit');
    const random   = (85 + Math.random() * 15) / 100;

    // Passif bonus_vs_status / bonus_vs_stun / type_damage_boost
    let bonusMult = 1.0;
    if (ep?.kind === 'bonus_vs_status' && target.statusEffects.length > 0)
      bonusMult *= (ep.mult ?? 1.20);
    if (ep?.kind === 'bonus_vs_stun' && this._hasStatus(target, 'stun'))
      bonusMult *= (ep.mult ?? 1.50);
    if (ep?.kind === 'type_damage_boost' && attacker.types.includes(ep.type))
      bonusMult *= (ep.mult ?? 1.15);

    // crit_boost passif
    const critChance = attacker._critBoost ?? 0;
    const isCritPassive = critChance > 0 && Math.random() < critChance;
    // guaranteed_crit si PV > threshold
    const isGuarCrit = ep?.kind === 'guaranteed_crit_threshold'
      && (attacker.hp / attacker.maxHp) >= (ep.threshold ?? 0.75);

    damage = damage * 1.1 * typeMult * random * bonusMult;
    if (isCrit || isCritPassive || isGuarCrit) damage *= 1.5;

    return Math.max(1, Math.round(damage));
  }
  // _calcDamageMove délègue ici ↑

  // ─────────────────────────────────────────────────────────────────────────
  // Fin de tour
  // ─────────────────────────────────────────────────────────────────────────
  _resolveEndOfTurn() {
    const all = [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0);
    all.forEach(u => {
      const burnStatus = u.statusEffects.find(s => s.type === 'burn');
      if (burnStatus) {
        const burnStacks = burnStatus.stacks ?? 1;
        const dmg = Math.max(1, Math.ceil(u.maxHp * 0.05 * burnStacks));
        u.hp = Math.max(0, u.hp - dmg);
        this.log.push({ type:'effect_damage', effect:'burn',
          label: burnStacks > 1 ? `🔥×${burnStacks}` : '🔥',
          stacks: burnStacks,
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

    // Passifs de regen périodique (regen_self, regen_all_period, regen_ally)
    [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0).forEach(u => {
      const p = u._passive?.effect;
      if (!p) return;
      // regen_self géré dans _takeTurn
      if (p.kind === 'regen_all_period') {
        const allies = u.side === 'player' ? this.playerUnits : this.enemyUnits;
        allies.filter(a => a.hp > 0).forEach(ally => {
          const heal = Math.max(1, Math.ceil(ally.maxHp * p.rate));
          ally.hp = Math.min(ally.maxHp, ally.hp + heal);
          this.log.push({ type:'effect_heal', effect:'passive_regen', label:`💚 ${u._passive.name}`,
            targetId:ally.uid, targetName:ally.name, targetSide:ally.side,
            heal, targetHpLeft:ally.hp, targetMaxHp:ally.maxHp });
        });
      }
    });

    // Talents de regen
    (this._talentRegens ?? []).forEach(tr => {
      const allies = tr.side === 'player' ? this.playerUnits : this.enemyUnits;
      allies.filter(a => a.hp > 0).forEach(a => {
        const heal = Math.max(1, Math.ceil(a.maxHp * tr.rate));
        a.hp = Math.min(a.maxHp, a.hp + heal);
        this.log.push({ type:'effect_heal', effect:'talent_regen', label:`💚 Talent ${tr.type}`,
          targetId:a.uid, targetName:a.name, targetSide:a.side,
          heal, targetHpLeft:a.hp, targetMaxHp:a.maxHp });
      });
    });

    // Dot passifs (malédiction, parasite, etc.)
    [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0).forEach(u => {
      if (u._passiveDotRate) {
        const dmg = Math.max(1, Math.ceil(u.maxHp * u._passiveDotRate));
        u.hp = Math.max(0, u.hp - dmg);
        this.log.push({ type:'attack', effect:'passive_dot', label:'💀 Malédiction',
          targetId:u.uid, targetName:u.name, targetSide:u.side,
          damage:dmg, targetHpLeft:u.hp, targetMaxHp:u.maxHp });
        if (u.hp <= 0) this._handleFaint(u);
      }
    });

    // dot_on_sleep : cibles endormies perdent des HP
    // dot_on_stun  : cibles immobilisées perdent des HP
    // dot_drain    : drain passif ennemi (Parasite)
    [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0).forEach(attacker => {
      const ep = attacker._passive?.effect;
      if (!ep) return;
      const enemies = attacker.side === 'player' ? this.enemyUnits : this.playerUnits;
      const allies  = attacker.side === 'player' ? this.playerUnits : this.enemyUnits;

      if (ep.kind === 'dot_on_sleep') {
        enemies.filter(en => en.hp > 0 && this._hasStatus(en, 'sleep')).forEach(en => {
          const dmg = Math.max(1, Math.ceil(en.maxHp * ep.rate));
          en.hp = Math.max(0, en.hp - dmg);
          this.log.push({ type:'attack', effect:'dot_on_sleep', label:`💤 ${attacker._passive.name}`,
            attackerId:attacker.uid, attackerSide:attacker.side,
            targetId:en.uid, targetName:en.name, targetSide:en.side,
            damage:dmg, targetHpLeft:en.hp, targetMaxHp:en.maxHp });
          if (en.hp <= 0) this._handleFaint(en);
        });
      }

      if (ep.kind === 'dot_on_stun') {
        enemies.filter(en => en.hp > 0 && this._hasStatus(en, 'stun')).forEach(en => {
          const dmg = Math.max(1, Math.ceil(en.maxHp * ep.rate));
          en.hp = Math.max(0, en.hp - dmg);
          this.log.push({ type:'attack', effect:'dot_on_stun', label:`🔒 ${attacker._passive.name}`,
            attackerId:attacker.uid, attackerSide:attacker.side,
            targetId:en.uid, targetName:en.name, targetSide:en.side,
            damage:dmg, targetHpLeft:en.hp, targetMaxHp:en.maxHp });
          if (en.hp <= 0) this._handleFaint(en);
        });
      }

      if (ep.kind === 'dot_drain') {
        enemies.filter(en => en.hp > 0).forEach(en => {
          const dmg  = Math.max(1, Math.ceil(en.maxHp * ep.rate));
          const heal = dmg;
          en.hp = Math.max(0, en.hp - dmg);
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
          this.log.push({ type:'effect_heal', effect:'dot_drain', label:`🩸 ${attacker._passive.name}`,
            targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
            heal, targetHpLeft:attacker.hp, targetMaxHp:attacker.maxHp });
          if (en.hp <= 0) this._handleFaint(en);
        });
      }

      if (ep.kind === 'slow_enemy_atb') {
        // Ralentit les barres ATB ennemies (appliqué une fois au setup, pas en boucle)
      }
    });

    // poison : dégâts selon stacks + effets spéciaux (double_poison_dmg, poison_slow, etc.)
    [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0).forEach(u => {
      const poisonStatus = u.statusEffects.find(s => s.type === 'poison');
      if (!poisonStatus) return;
      const stacks = poisonStatus.stacks ?? 1;

      // Cherche si l'attaquant a double_poison_dmg ou poison_dmg_boost
      const attackers = u.side === 'player' ? this.enemyUnits : this.playerUnits;
      const hasDblPoison = attackers.some(a => a._passive?.effect?.kind === 'double_poison_dmg');
      const hasPoison_slow = attackers.some(a => a._passive?.effect?.kind === 'poison_slow');

      if (hasDblPoison) {
        // Poison inflige ×2 → géré via rate × 2
        // (la base est déjà dans _applyDot, on ne double pas ici pour éviter le triple)
      }
      if (hasPoison_slow && !u._poisonSlowed) {
        u._poisonSlowed = true;
        const slowAttacker = attackers.find(a => a._passive?.effect?.kind === 'poison_slow');
        this._applyPermStat(u, 'spd', slowAttacker._passive.effect.mult ?? 0.80);
      }
    });
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

  // Regen eau : soigne TOUS les alliés (pas uniquement les types Eau)
  // Déclenchée toutes les 8 actions depuis la boucle ATB
  _applySynergyRegen(side, fx, units) {
    if (!fx.has('regen')) return;
    const rate = 0.04;
    units.filter(u => u.hp > 0).forEach(u => {
      const heal = Math.max(1, Math.ceil(u.maxHp * rate));
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