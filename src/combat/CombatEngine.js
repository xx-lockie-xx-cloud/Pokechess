// ─────────────────────────────────────────────────────────────────────────────
// CombatEngine.js — Moteur avec mana, capacités ultimes et mécaniques complètes
// ─────────────────────────────────────────────────────────────────────────────

import { getTypeMultiplier }           from '../data/typeChart.js';
import { resolveHeldItem }             from '../data/items.js';
import { weatherStatMult, weatherDotRate,
         WEATHERS, WEATHER_TURNS, WEATHER_REPOST_EVERY } from '../data/weather.js';
import { MOVES, POKEMON_MOVES, getMove } from '../data/moves.js';
import { TALENT_TREES }                   from '../data/levelSystem.js';
import { STATUS_VALUES }                  from '../data/statusConstants.js';
import { PassiveEngine }                 from './PassiveEngine.js';
import { RelicEngine }                   from './RelicEngine.js';

// Synergie Roche : part des PV max accordée en bouclier, au tour 0 puis
// toutes les 8 actions.
const ROCK_SHIELD_RATE = 0.05;

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
    this.relicId     = null;  // défini depuis CombatUI avant resolve()
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
      // Objet relu depuis ITEMS : la sauvegarde en conserve une copie figée,
      // qui ignorerait tout rééquilibrage ultérieur de l'objet.
      heldItem:    resolveHeldItem(unit.heldItem),
      // Mana
      mana: 0,
      // Statuts : array de { type, turnsLeft (-1=permanent) }
      statusEffects: [],
      // Modificateurs temporaires : { stat, mult, turnsLeft }
      tempMods: [],
      // Rage stacks { stat, mult, count, maxStacks }
      rageStack: null,
      // Bouclier armure (booléen : bloque un coup entier)
      armorShield: false,
      // Bouclier à POINTS (bénédictions, capacités) : absorbe avant les PV
      shield: 0, maxShield: 0,
      // Rune assignée (résolue + scalée par RuneManager en amont), ou null
      _rune: unit.rune ?? null,
      // Drapeaux des bénédictions du Sanctuaire, lus au setup
      _blessFlags: unit._blessFlags ?? null,
      // Intouchable (Tunnel, Téléport)
      untargetable: 0,
      // Skip prochain tour (Ultralaser)
      skipNextTurn: false,
      // ATB (Active Time Battle) — barre de charge de 0→100
      // Initialisée à (100 + SPD) / 5 → pokémon rapide démarre plus avancé
      // SPD=30 → 26 | SPD=100 → 40 | SPD=110 → 42
      atbBar: 0,  // calculé après _copyUnit via _initATBBar()
      // Passifs de niveau (chargés via PassiveEngine._loadPassives)
      _passives:    [],
      _flags:       {},    // flags divers (sturdy, dodgeOnce, ignoreDef…)
      _ramp:        {},    // compteurs ramp_stat
      _condActive:  {},    // états conditionnels actifs
      _reviveRate:  0,     // taux de résurrection (revive_mark)
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers statuts
  // ─────────────────────────────────────────────────────────────────────────
  _hasStatus(unit, type) {
    return unit.statusEffects.some(s => s.type === type);
  }
  _addStatus(unit, type, turns = -1) {
    // L'empoisonnement dure 2× plus longtemps (favorise l'accumulation de stacks).
    // Le poison permanent (turns = -1) reste permanent.
    if (type === 'poison' && turns > 0) turns *= 2;
    // Immunité aux statuts (posée par ON_SETUP status_immunity)
    if (unit._statusImmuneList?.includes(type)) return;
    if (unit._statusImmune) return;
    const existing = unit.statusEffects.find(s => s.type === type);
    // Poison et Brûlure : stackables
    if ((type === 'poison' || type === 'burn') && existing) {
      const maxStacks = type === 'poison' ? 10 : 5;   // poison 10, brûlure 5
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
    // Météo : bonus/malus par type, dynamiques. Appliqués ici plutôt que par
    // mutation des stats, pour qu'ils disparaissent d'eux-mêmes à l'expiration.
    if (this.weather) {
      val *= weatherStatMult(this.weather.id, unit.types, stat);
      // Passif conditionnel à la météo (Chlorophylle, Capteur Solaire...)
      const wb = unit._weatherBoost;
      if (wb && wb.weather === this.weather.id && wb.stats.includes(stat)) {
        val *= wb.mult;
      }
    }
    unit.tempMods.filter(m => m.stat === stat).forEach(m => { val *= m.mult; });
    if (unit.rageStack?.stat === stat && unit.rageStack.count > 0) {
      val *= Math.pow(unit.rageStack.mult, unit.rageStack.count);
    }
    // Adaptabilité (talent Normal) : bonus tous-stats cumulé par coup reçu
    if (unit._allStatRage?.acc > 0) {
      val *= (1 + unit._allStatRage.acc);
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

    // Instantané des PV max APRÈS le setup (synergies, talents, passifs ON_SETUP,
    // reliques) mais AVANT le combat. L'UI s'en sert pour afficher les barres de
    // départ : lire maxHp après resolve() donnerait la valeur finale, déjà rongée
    // par l'érosion.
    // Météo globale : { id, turnsLeft } ou null. Affecte les DEUX camps.
    this.weather = this.weather ?? null;

    // Bénédictions du Sanctuaire : les drapeaux réutilisent les mécanismes
    // déjà en place (bouclier, immunité, résurrection, rage à la mort d'un
    // allié), donc aucun nouveau code de combat n'est nécessaire.
    this.playerUnits.forEach(u => {
      const f = u._blessFlags;
      if (!f) return;
      if (f.shieldRate) {
        u.shield    = (u.shield ?? 0) + Math.round(u.maxHp * f.shieldRate);
        u.maxShield = Math.max(u.maxShield ?? 0, u.shield);
      }
      if (f.statusImmune) {
        u._statusImmuneList = [...(u._statusImmuneList ?? []),
          'burn','poison','paralyze','freeze','confuse','sleep'];
      }
      if (f.reviveRate)  u._reviveRate = Math.max(u._reviveRate ?? 0, f.reviveRate);
      if (f.atkOnAllyKo) {
        u._flags = u._flags ?? {};
        u._flags.atkOnAllyKo = { boost: f.atkOnAllyKo };
      }
    });

    // Roches météo : un objet porté peut poser la météo d'ouverture.
    // Si plusieurs sont présentes, la dernière lue l'emporte (une seule météo).
    [...this.playerUnits, ...this.enemyUnits].forEach(u => {
      const w = u.heldItem?.setsWeather;
      if (w) this._setWeather(w, u.heldItem.weatherTurns ?? WEATHER_TURNS, u);
    });

    this.initialMaxHp = {};
    [...this.playerUnits, ...this.enemyUnits].forEach(u => {
      this.initialMaxHp[`${u.side}_${u.uid}`] = u.maxHp;
    });

    // Instantané de DÉPART : ce que l'UI doit afficher avant la première action
    // (inclut synergies, talents, passifs ON_SETUP, objets et météo d'ouverture).
    this.initialStats = this._snapshotStats();
    this.initialWeather = this.weather
      ? { id: this.weather.id, turnsLeft: this.weather.turnsLeft } : null;

    let actionCount   = 0;    // nombre total d'actions (pour les effets périodiques)
    let globalActions = 0;    // sécurité anti-boucle infinie
    let winner        = null; // gagnant (peut être fixé par le Sablier)
    const MAX_ACTIONS = 1000;

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

      // Sablier : vérifie la limite d'actions
      if (this.relicId) {
        const limitResult = RelicEngine.checkActionLimit(
          this.relicId, actionCount, this.playerUnits, this.enemyUnits);
        if (limitResult) {
          winner = limitResult === 'draw' ? 'enemy' : limitResult;
          this.log.push({ type:'pre_combat', effect:'sablier',
            label:`⏱ Sablier — Temps écoulé ! ${limitResult === 'player' ? 'Joueur gagne' : 'Ennemi gagne'}` });
          break;
        }
      }

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
        this.log.push({ type: 'turn_start', turn: actionCount, unitId: unit.uid,
                        unitName: unit.name, unitSide: unit.side,
                        // Instantané des stats EFFECTIVES de toutes les unités.
                        // Le combat étant pré-simulé, l'UI ne peut pas lire les
                        // objets (déjà mutés) : elle rejoue ces instantanés au
                        // rythme de l'animation.
                        stats: this._snapshotStats(),
                        weather: this.weather
                          ? { id: this.weather.id, turnsLeft: this.weather.turnsLeft }
                          : null });

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
        this._totalActions = (this._totalActions ?? 0) + 1;
        this._takeTurn(unit);

        // Reset barre (conserve l'overflow au-delà de 100)
        unit.atbBar -= 100;

        // ── Effets de fin d'action (burn, poison, regen) ──────────────────
        // Déclenchés toutes les 8 actions globales (≈ 1 tour complet)
        // Météo : décomptée à CHAQUE action (un tour = une action de Pokémon),
        // contrairement aux statuts qui suivent le cycle de 8 actions.
        this._tickWeather();
        this._tickIntervalDots(actionCount);

        if (actionCount % 8 === 0) {
          this._applyRockShield();   // synergie Roche : renouvelle le bouclier
          this._resolveEndOfTurn();
          this._tickTraps();
          this._resolveFutureAttacks();
          this._decrementMods();
        }
      }


    }

    // Si le Sablier n'a pas déjà tranché, on calcule le gagnant normalement
    if (winner == null) winner = this._winner();
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

    // Charge les passifs dans chaque unité
    [...this.playerUnits, ...this.enemyUnits].forEach(u => this._loadPassives(u));

    // Objets tenus à effet de résurrection (Rappel) : réutilise le mécanisme
    // _reviveRate consommé dans _handleFaint. L'objet n'est PAS consommé, mais
    // la résurrection ne s'applique qu'une fois par combat (garde _revived).
    [...this.playerUnits, ...this.enemyUnits].forEach(u => {
      const rate = u.heldItem?.reviveRate;
      if (rate > 0) {
        u._reviveRate = Math.max(u._reviveRate ?? 0, rate);
        u._reviveItem = u.heldItem.name;
      }
    });

    // Effets de relique pré-combat
    if (this.relicId) {
      RelicEngine.applyPreCombat(this.relicId, this.playerUnits, this.enemyUnits);
    }

    // ON_SETUP : effets de début de combat
    this.playerUnits.forEach(u => this._runHook('ON_SETUP', u,
      { enemies:this.enemyUnits, allies:this.playerUnits }));
    this.enemyUnits.forEach(u => this._runHook('ON_SETUP', u,
      { enemies:this.playerUnits, allies:this.enemyUnits }));

    // Talents
    this._applyTalents('player', this.playerUnits, this.enemyUnits);
    this._applyTalents('enemy',  this.enemyUnits,  this.playerUnits);

    // Résumé des talents actifs au début du combat (affichage groupé)
    const talentList = (this._playerTalents ?? [])
      .map(e => `${e.type ?? ''} — ${e._name ?? ''}`.trim())
      .filter(Boolean);
    if (talentList.length) {
      this.log.push({ type:'talent_summary', talents: talentList });
    }
    this._applyPreEffects('player', this.playerFx, this.enemyUnits, this.playerUnits);
    this._applyPreEffects('enemy',  this.enemyFx,  this.playerUnits, this.enemyUnits);
    // Synergie Roche : bouclier d'équipe posé au tour 0, puis renouvelé
    // périodiquement (voir _tickRockShield). Il profite à TOUTE l'équipe, et
    // plus seulement aux Pokémon de type Roche.
    this._applyRockShield();
  }

  // Bouclier de la synergie Roche : ROCK_SHIELD_RATE des PV max à tous les
  // alliés du camp concerné. Cumulatif avec les autres boucliers.
  _applyRockShield() {
    ['player', 'enemy'].forEach(side => {
      const fx = this._fx(side);
      if (!fx.has('armor')) return;
      const allies = side === 'player' ? this.playerUnits : this.enemyUnits;
      allies.filter(u => u.hp > 0).forEach(u => {
        const pts = Math.max(1, Math.round(u.maxHp * ROCK_SHIELD_RATE));
        u.shield    = (u.shield ?? 0) + pts;
        u.maxShield = Math.max(u.maxShield ?? 0, u.shield);
      });
      this.log.push({ type: 'pre_combat', effect: 'shield', label: '🪨 Armure Roche',
        targetSide: side });
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
        if (eff === 'burn') this._applyPermStat(u, 'atk', STATUS_VALUES.burnAtkMult);
        this._addStatus(u, eff, synergyStatusTurns[eff] ?? -1);
      });
    });
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
            .forEach(u => {
              u._reviveRate = Math.max(u._reviveRate ?? 0, e.rate);
              u._reviveTalent = e.type;   // origine talent (pour le log)
            });
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
        case 'type_stack_per_type': {
          // +per_type par type distinct dans l'équipe, sur toutes les stats
          const distinct = new Set(allies.flatMap(u => u.types ?? [])).size;
          const m = 1 + (e.per_type ?? 0) * distinct;
          allies.filter(u => u.types.includes(e.type)).forEach(u =>
            ['hp','atk','spa','def','spd_def','spd'].forEach(s => this._applyPermStat(u, s, m)));
          break;
        }
        case 'type_stack_per_ally': {
          const cnt = allies.filter(u => u.types.includes(e.type)).length;
          const m = 1 + (e.per ?? e.per_ally ?? 0) * cnt;
          allies.filter(u => u.types.includes(e.type)).forEach(u =>
            ['hp','atk','spa','def','spd_def','spd'].forEach(s => this._applyPermStat(u, s, m)));
          break;
        }
        case 'type_resilience':
          // Adaptabilité (Normal) : immunité aux malus + rage tous-stats par coup reçu
          allies.filter(u => u.types.includes(e.type)).forEach(u => {
            u._noStatMalus  = true;
            u._allStatRage  = { rate: e.ragePerHit ?? 0.02, max: e.max ?? 0.40, acc: 0 };
          });
          break;
        case 'type_conditional_stat':
          // Boost conditionnel (ex : si PV < seuil) — vérifié dynamiquement
          allies.filter(u => u.types.includes(e.type)).forEach(u => {
            u._conditionalStats = [...(u._conditionalStats ?? []), e];
          });
          break;
        case 'type_once_push_front':
          // Place les alliés du type sur la rangée avant au début du combat
          allies.filter(u => u.types.includes(e.type)).forEach(u => { u.row = 0; });
          break;
        case 'type_once_untargetable':
          // Intouchable au premier ciblage (consommé par la logique de ciblage)
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._onceUntargetable = true; });
          break;
        case 'type_swarm_on_ko':
          // Boost des alliés du type quand l'un d'eux tombe (consommé dans _handleFaint)
          allies.filter(u => u.types.includes(e.type))
            .forEach(u => { u._swarmOnKo = { stat: e.stat ?? 'atk', mult: e.mult ?? 1.15 }; });
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

  // Passifs sur réception d'un coup

  // Passifs à la mort d'une unité

  _applyPermStat(unit, stat, mult) {
    // Adaptabilité (talent Normal) : immunisé aux malus de stats
    if (mult < 1 && unit._noStatMalus) return;
    unit[stat] = Math.round(unit[stat] * mult);
    // hp et maxHp sont deux champs distincts : sans cette synchro, un talent
    // qui booste les PV augmenterait les PV courants sans lever le plafond
    // (barre incohérente et bonus en partie perdu).
    if (stat === 'hp') unit.maxHp = unit.hp;
  }

  // _resolveTurn() supprimé — remplacé par le moteur ATB dans resolve()

  // ─────────────────────────────────────────────────────────────────────────
  // Action d'une unité
  // ─────────────────────────────────────────────────────────────────────────
  _takeTurn(unit) {
    this._runeReplayed = false;   // reset anti-chaîne du rejeu (rune Violent)
    // ── Passifs ON_ACTION ────────────────────────────────────────────────────
    const allies_  = unit.side === 'player' ? this.playerUnits : this.enemyUnits;
    const enemies_ = unit.side === 'player' ? this.enemyUnits  : this.playerUnits;
    this._runHook('ON_ACTION', unit, { allies:allies_, enemies:enemies_ });

    // Statuts qui bloquent l'action    // Statuts qui bloquent l'action
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
        freezeSt._actionsLeft = (freezeSt._actionsLeft ?? STATUS_VALUES.freezeActions);
        // Applique le malus VIT via tempMod si pas encore présent
        if (!unit.tempMods.some(m => m._freeze)) {
          unit.tempMods.push({ stat:'spd', mult:STATUS_VALUES.freezeSpdMult, turnsLeft:-1, _freeze:true });
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
    if (this._hasStatus(unit, 'paralyze') && Math.random() < STATUS_VALUES.paralyzeSkipChance) {
      this.log.push({ type:'attack_skipped', reason:'paralyze', label:'⚡ Paralysé !',
        attackerId:unit.uid, attackerSide:unit.side });
      return;
    }
    if (this._hasStatus(unit, 'confuse') && Math.random() < STATUS_VALUES.confuseHitAllyChance) {
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
        // isUltimate: true → CombatEngine utilisera attacker.types[0] comme type
        const ultimateMove = { ...move, isUltimate: true };
        this.log.push({ type:'ultimate_start', attackerId:unit.uid,
          attackerSide:unit.side, moveName:move.name, moveType:unit.types[0] });
        this._executeMove(unit, ultimateMove);
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
    let pool = this._enemiesOf(unit).filter(u => u.hp > 0 && u.untargetable === 0);
    // Talent "Intouchable une fois" : les protégés esquivent le 1er ciblage (puis consommé)
    const protectedOnce = pool.filter(u => u._onceUntargetable);
    if (protectedOnce.length) {
      const available = pool.filter(u => !u._onceUntargetable);
      protectedOnce.forEach(u => {
        u._onceUntargetable = false;   // esquive consommée
        this.log.push({ type:'talent_trigger', talentType:(u.types?.[0] ?? ''),
          label:`${u.name} esquive (Intouchable) !` });
      });
      if (available.length) pool = available;  // sinon ils redeviennent ciblables
    }
    const enemies = pool;
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
    let _dealtTotal = 0;

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

      const _hpBefore = target.hp;
      this._dealDamage(attacker, target, dmg, mult, isSwarm);
      _dealtTotal += Math.max(0, _hpBefore - target.hp);
    });
    // Mana une seule fois par attaque, indépendamment du nombre de cibles
    if (targets.length > 0) {
      attacker.mana = Math.min(MANA_MAX, attacker.mana + MANA_ON_HIT);
    }
    // Rune onAttack : une fois par attaque
    this._fireAttackRune(attacker, targets[0]?.unit ?? null, _dealtTotal);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RUNES : bouclier depuis stat, déclencheurs onAttack et onHitReceived
  // ─────────────────────────────────────────────────────────────────────────
  _runeShieldValue(unit, fromStat, mag) {
    let base = 0;
    if (fromStat === 'hp')       base = unit.maxHp;
    else if (fromStat === 'atk') base = Math.max(this._getStat(unit, 'atk'), this._getStat(unit, 'spa'));
    else if (fromStat === 'def') base = Math.max(this._getStat(unit, 'def'), this._getStat(unit, 'spd_def'));
    return Math.round(base * mag);
  }

  _fireAttackRune(attacker, target, dealtTotal) {
    const r = attacker?._rune;
    if (!r || r.trigger !== 'onAttack' || attacker.hp <= 0) return;
    const e = r.effect;
    switch (e.kind) {
      case 'lifesteal':
        if (dealtTotal > 0) {
          const heal = Math.max(1, Math.round(dealtTotal * e.mag));
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
          this.log.push({ type:'effect_heal', effect:'rune_vampire', label:`🩸 ${attacker.name}`,
            targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
            heal, targetHpLeft:attacker.hp, targetMaxHp:attacker.maxHp });
        }
        break;
      case 'stun':
        if (target && target.hp > 0 && Math.random() < e.mag) {
          this._addStatus(target, 'freeze', 1);
          this.log.push({ type:'passive_trigger', effect:'rune_effroi', label:`😱 ${target.name}`,
            targetId:target.uid, targetName:target.name, targetSide:target.side });
        }
        break;
      case 'shield': {
        const val = this._runeShieldValue(attacker, e.fromStat, e.mag);
        if (val > 0) {
          attacker.shield    = Math.max(attacker.shield ?? 0, val);   // recharge à la valeur, ne stacke pas
          attacker.maxShield = Math.max(attacker.maxShield ?? 0, attacker.shield);
          this.log.push({ type:'passive_trigger', effect:'rune_rempart', label:`🛡 ${attacker.name}`,
            targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
            shieldLeft:attacker.shield, maxShield:attacker.maxShield });
        }
        break;
      }
      case 'heal_most_wounded': {
        const allies = this._alliesOf(attacker).filter(u => u.hp > 0);
        if (allies.length) {
          const w = allies.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
          const heal = Math.max(1, Math.round(w.maxHp * e.mag));
          w.hp = Math.min(w.maxHp, w.hp + heal);
          this.log.push({ type:'effect_heal', effect:'rune_panacee', label:`💊 ${w.name}`,
            targetId:w.uid, targetName:w.name, targetSide:w.side,
            heal, targetHpLeft:w.hp, targetMaxHp:w.maxHp });
        }
        break;
      }
      case 'replay':
        if (!this._runeReplayed && Math.random() < e.mag) {
          this._runeReplayed = true;
          const t2 = this._getTargets(attacker);
          if (t2.length) {
            this.log.push({ type:'passive_trigger', effect:'rune_violent', label:`⚡ ${attacker.name} rejoue !`,
              targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side });
            this._performNormalAttack(attacker, t2);
          }
        }
        break;
    }
  }

  _fireReceiveRune(attacker, target, damage) {
    const r = target?._rune;
    if (!r || r.trigger !== 'onHitReceived') return;
    if (this._inRuneRetaliation) return;   // une riposte/un renvoi ne se contre pas
    if (target.hp <= 0 || damage <= 0 || attacker.hp <= 0) return;
    const e = r.effect;
    switch (e.kind) {
      case 'counter':
        if (Math.random() < e.mag) {
          const cdmg = Math.max(1, Math.round(this._calcDamage(target, attacker, 1, 50)));
          this._inRuneRetaliation = true;
          this.log.push({ type:'passive_trigger', effect:'rune_revanche', label:`⚔️ ${target.name} riposte !`,
            targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side });
          this._dealDamage(target, attacker, cdmg, 1, false, { type:target.types[0], ignoreType:true });
          this._inRuneRetaliation = false;
        }
        break;
      case 'reflect': {
        const rdmg = Math.max(1, Math.round(damage * e.mag));
        this._inRuneRetaliation = true;
        this.log.push({ type:'passive_trigger', effect:'rune_epines', label:`🌵 ${target.name} renvoie !`,
          targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side });
        this._dealDamage(target, attacker, rdmg, 1, false, { type:target.types[0], ignoreType:true });
        this._inRuneRetaliation = false;
        break;
      }
      case 'status':
        if (Math.random() < e.mag) {
          const dur    = (e.status === 'poison' || e.status === 'burn') ? -1 : 2;
          const stacks = e.stacks ?? 1;
          for (let i = 0; i < stacks; i++) this._addStatus(attacker, e.status, dur);
          this.log.push({ type:'passive_trigger', effect:'rune_' + e.status, label:`✨ ${attacker.name}`,
            targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side });
        }
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Exécution d'une capacité ultime
  // ─────────────────────────────────────────────────────────────────────────
  _executeMove(attacker, move) {
    const targets = this._resolveTargets(attacker, move);

    // Effets avant dégâts (status appliqués à priori, buffs self)
    const preEffects = ['untargetable','stat','skip_next','shield','rage_stack',
                        'random_stat_boost','copy_enemy','trigger_ally','coins',
                        'weather'];
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
        const piercesArmor = move.ignoreArmor
          || (move.effects ?? []).some(e => e.kind === 'ignore_armor');
        if (target.armorShield && !piercesArmor) {
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
    const postEffects = ['status','heal','push_back','clear_buffs','sacrifice','delayed_sleep','ignore_type',
                         'future_attack','counter_burst','pain_split','splash_adj','trap'];
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
          if (eff.rate) {
            // Bouclier à points. La base est les PV max par défaut, mais peut
            // être une autre stat (`fromStat`) : indispensable pour les profils
            // coquille comme Caratroc, dont les 20 PV rendraient un pourcentage
            // de PV dérisoire face à ses 230 de défense.
            const base = eff.fromStat
              ? this._getStat(u, eff.fromStat)
              : u.maxHp;
            const pts  = Math.max(1, Math.round(base * eff.rate));
            // CUMULATIF : un bouclier existant n'est pas remplacé
            u.shield    = (u.shield ?? 0) + pts;
            u.maxShield = Math.max(u.maxShield ?? 0, u.shield);
          } else {
            u.armorShield = true;   // bouclier historique : bloque un coup
          }
          this.log.push({ type:'pre_combat', effect:'shield', label:'🛡 Bouclier !',
            targetId:u.uid, targetSide:u.side,
            shieldLeft:u.shield ?? 0, maxShield:u.maxShield ?? 0 });
        });
        break;
      }

      case 'push_back':
        targets.forEach(t => { if (t.hp > 0) t.row = 1; });
        break;

      case 'future_attack': {
        // Prescience : les dégâts sont calculés MAINTENANT mais frappent dans
        // N tours. Ils touchent même si le lanceur est tombé entre-temps, ce
        // qui est tout l'intérêt de la capacité.
        const t = targets.find(x => x.hp > 0) ?? targets[0];
        if (t) {
          const bp  = (move.bp ?? 60) * (move.powerMult ?? 1);
          const dmg = this._calcDamageMove(attacker, t, bp, move);
          (this._pendingFuture ??= []).push({
            targetUid: t.uid, side: t.side, damage: dmg,
            turnsLeft: eff.turns ?? 2, sourceName: attacker.name,
          });
          this.log.push({ type: 'status_applied', status: 'future', label: '🔮',
            targetId: t.uid, targetName: t.name, targetSide: t.side });
        }
        break;
      }

      case 'counter_burst': {
        // Renvoie un multiple des DERNIERS dégâts subis. Sans dégâts reçus,
        // la capacité ne fait rien plutôt que d'infliger un minimum arbitraire.
        const base = attacker._lastDamageTaken ?? 0;
        if (base > 0) {
          const dmg = Math.max(1, Math.round(base * (eff.mult ?? 1.5)));
          targets.filter(t => t.hp > 0).forEach(t => {
            this._dealDamage(attacker, t, dmg);
          });
        }
        break;
      }

      case 'pain_split': {
        // Égalise les PV du lanceur et de la cible (moyenne des deux), sans
        // dépasser leurs maximums respectifs.
        const t = targets.find(x => x.hp > 0);
        if (t) {
          const avg = Math.round((attacker.hp + t.hp) / 2);
          const before = { a: attacker.hp, t: t.hp };
          attacker.hp = Math.min(attacker.maxHp, avg);
          t.hp        = Math.min(t.maxHp, avg);
          this.log.push({ type: 'effect_heal', effect: 'pain_split', label: '⚖️ Partage',
            targetId: t.uid, targetName: t.name, targetSide: t.side,
            heal: t.hp - before.t, targetHpLeft: t.hp, targetMaxHp: t.maxHp });
          if (t.hp <= 0) this._handleFaint(t);
        }
        break;
      }

      case 'splash_adj': {
        // Éclaboussure : une fraction des dégâts touche les voisins immédiats
        // de la cible principale (cases orthogonales).
        const prim = targets[0];
        if (prim) {
          const rate = eff.rate ?? 0.20;
          const base = prim._lastHitDamage ?? 0;
          if (base > 0) {
            this._enemiesOf(attacker)
              .filter(u => u.hp > 0 && u !== prim &&
                Math.abs(u.col - prim.col) + Math.abs(u.row - prim.row) === 1)
              .forEach(u => this._dealDamage(attacker, u,
                Math.max(1, Math.round(base * rate))));
          }
        }
        break;
      }

      case 'trap': {
        // Piège : la cible ne peut plus esquiver et subit des dégâts résiduels.
        targets.filter(t => t.hp > 0).forEach(t => {
          t._trapped = { turns: eff.turns ?? 3, rate: eff.rate ?? 0.04, by: attacker.uid };
          t.evasion = 0;
          this.log.push({ type: 'status_applied', status: 'trap', label: '🕸️',
            targetId: t.uid, targetName: t.name, targetSide: t.side });
        });
        break;
      }

      case 'weather':
        // Pose une météo globale (les deux camps sont affectés)
        this._setWeather(eff.weather, eff.turns ?? WEATHER_TURNS, attacker);
        break;

      case 'clear_buffs':
        this._enemiesOf(attacker).filter(u => u.hp > 0).forEach(u => {
          u.tempMods = u.tempMods.filter(m => m.mult <= 1);
          this.log.push({ type:'stat_change', who:u.uid, side:u.side,
            label:'🌀 Brouillard !', color:'#a29bfe', stat:'all', mult:1 });
        });
        break;

      case 'sacrifice': {
        // Le lanceur ne meurt plus : il perd une part de ses PV COURANTS.
        // Se tuer pour une explosion coûtait une unité entière, un prix trop
        // élevé pour être jamais rentable. Il survit désormais à 1 PV minimum.
        const rate  = eff.rate ?? 0.60;
        const lost  = Math.max(1, Math.round(attacker.hp * rate));
        attacker.hp = Math.max(1, attacker.hp - lost);
        this.log.push({ type:'effect_damage', effect:'sacrifice', label:'💥 Contrecoup',
          targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
          damage:lost, targetHpLeft:attacker.hp, targetMaxHp:attacker.maxHp });
        break;
      }

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
    if (target.hp <= 0 || damage <= 0) return;

    // Esquive dodge_once (flag posé par ON_SETUP)
    if (target._flags?.dodgeOnce && !target._dodgeUsed) {
      target._dodgeUsed = true;
      this.log.push({ type:'passive_trigger', effect:'dodge',
        label:`💨 ${target.name} esquive !`,
        targetId:target.uid, targetName:target.name, targetSide:target.side });
      return;
    }

    // Esquive probabiliste (_evasion posé par ON_SETUP evasion)
    if (target._evasion && Math.random() < target._evasion) {
      this.log.push({ type:'passive_trigger', effect:'evasion',
        label:`💨 ${target.name} esquive ! (${Math.round(target._evasion*100)}%)`,
        targetId:target.uid, targetName:target.name, targetSide:target.side });
      return;
    }

    // Type immunity (posé par ON_SETUP type_immunity)
    if (move?.type && target._typeImmune?.includes(move.type)) {
      this.log.push({ type:'passive_trigger', effect:'immunity',
        label:`🛡 ${target.name} immunisé ${move.type}`,
        targetId:target.uid, targetName:target.name, targetSide:target.side });
      return;
    }

    // Type absorb : soigne au lieu de blesser
    if (move?.type && target._typeAbsorb?.includes(move.type)) {
      const heal = Math.max(1, damage);
      target.hp = Math.min(target.maxHp, target.hp + heal);
      this.log.push({ type:'effect_heal', effect:'type_absorb', label:`💙 ${target.name} absorbe ${move.type}`,
        targetId:target.uid, targetName:target.name, targetSide:target.side,
        heal, targetHpLeft:target.hp, targetMaxHp:target.maxHp });
      return;
    }

    // Bouclier (armorShield) — absorbe 1 coup
    if (target.armorShield) {
      target.armorShield = false;
      this.log.push({ type:'passive_trigger', effect:'shield',
        label:`🛡 ${target.name} bloque le coup !`,
        targetId:target.uid, targetName:target.name, targetSide:target.side });
      return;
    }

    // Réduction dégâts passifs (_dmgReduction posé par ON_SETUP stat_boost)
    if (target._dmgReduction && target._dmgReduction < 1) {
      damage = Math.max(1, Math.round(damage * target._dmgReduction));
    }

    // Bouclier à POINTS : absorbe les dégâts avant les PV. Distinct de
    // armorShield (booléen, bloque un coup entier). Le surplus passe aux PV.
    if (target.shield > 0 && damage > 0) {
      const absorbed = Math.min(target.shield, damage);
      target.shield -= absorbed;
      damage        -= absorbed;
      this.log.push({ type:'shield_absorb', label:'🛡',
        targetId:target.uid, targetName:target.name, targetSide:target.side,
        absorbed, shieldLeft:target.shield, maxShield:target.maxShield ?? 0,
        targetHpLeft:target.hp, targetMaxHp:target.maxHp });
      if (damage <= 0) return;
    }

    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - damage);
    // Mana reçue = % HP perdus (ex: -20% HP → +20 mana)
    const hpPctLost = target.maxHp > 0
      ? Math.round((hpBefore - target.hp) / target.maxHp * 100)
      : 0;
    // reduceEnemyMana flag (Mewtwo Pression)
    const manaGain = this._alliesOf(target).some(a => a._flags?.reduceEnemyMana)
      ? Math.round(hpPctLost * (1 - (this._alliesOf(target).find(a=>a._flags?.reduceEnemyMana)?._flags.reduceEnemyMana.mult ?? 0.50)))
      : hpPctLost;
    target.mana = Math.min(MANA_MAX, target.mana + manaGain);
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
      // Catégorie : capacité → move.cat ; attaque de base → physique si ATK≥SP.ATK
      category:     move?.cat ?? (((attacker.atk ?? 0) >= (attacker.spa ?? 0)) ? 'physical' : 'special'),
      // Type de l'attaque : type du move, sinon dernier type utilisé par l'attaquant
      attackType:   move?.type ?? attacker._lastAttackType ?? attacker.types?.[0] ?? 'Normal',
      targetHpLeft: target.hp, targetMaxHp: target.maxHp,
      attackerMana: attacker.mana, targetMana: target.mana,
      attackerAtb:  Math.max(0, Math.min(100, attacker.atbBar ?? 0)),
      targetAtb:    Math.max(0, Math.min(100, target.atbBar   ?? 0)),
    });

    // Passifs post-attaque
    this._runHook('ON_ATTACK',  attacker, { target, damage, enemies:this.enemyUnits,  allies:this.playerUnits });
    this._runHook('ON_RECEIVE', target,   { attacker, damage, enemies:this.playerUnits, allies:this.enemyUnits });

    // Rune onHitReceived : riposte / renvoi / statut sur l'attaquant
    this._fireReceiveRune(attacker, target, damage);

    // Adaptabilité (talent Normal) : +X% tous-stats par coup reçu (plafonné)
    if (target._allStatRage && target.hp > 0 && damage > 0) {
      const r = target._allStatRage;
      r.acc = Math.min((r.acc ?? 0) + r.rate, r.max);
    }

    // Mémorisation pour counter_burst (Contre) et splash_adj (Éclaboussure)
    if (damage > 0) {
      target._lastDamageTaken = damage;
      target._lastHitDamage   = damage;
    }

    // Baie de secours (Baie Sitrus) : soigne une fois en passant sous le seuil.
    // Vérifié ici car _dealDamage est le point central de perte de PV.
    this._checkEmergencyBerry(target);

    if (target.hp <= 0) this._handleFaint(target);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MÉTÉO — globale, affecte les deux camps
  // ─────────────────────────────────────────────────────────────────────────
  _setWeather(weatherId, turns = WEATHER_TURNS, source = null) {
    const w = WEATHERS[weatherId];
    if (!w) return;
    const replacing = this.weather && this.weather.id !== weatherId;
    this.weather = { id: weatherId, turnsLeft: turns };
    this.log.push({
      type: 'weather_set', weather: weatherId, label: w.emoji,
      name: w.name, desc: w.desc, turns,
      sourceName: source?.name ?? null, replacing,
    });
  }

  // Repose la météo des unités qui en portent une (passif weather_setter),
  // tant qu'elles sont en vie. Cadence : tous les WEATHER_REPOST_EVERY tours.
  _repostWeather() {
    this._weatherTick = (this._weatherTick ?? 0) + 1;
    if (this._weatherTick % WEATHER_REPOST_EVERY !== 0) return;
    const setters = [...this.playerUnits, ...this.enemyUnits]
      .filter(u => u.hp > 0 && u._weatherSetter);
    if (!setters.length) return;
    // Le dernier à agir impose sa météo (une seule peut être active)
    const u = setters[setters.length - 1];
    if (this.weather?.id === u._weatherSetter && this.weather.turnsLeft >= WEATHER_TURNS) return;
    this._setWeather(u._weatherSetter, WEATHER_TURNS, u);
  }

  _tickWeather() {
    this._repostWeather();
    if (!this.weather) return;
    const w = WEATHERS[this.weather.id];

    // Dégâts résiduels (tempête de sable, grêle) sur les deux camps
    if (w?.dot) this.weather.dotTick = (this.weather.dotTick ?? 0) + 1;
    // Nerf : tempête de sable / grêle infligent des dégâts un tour sur deux
    if (w?.dot && this.weather.dotTick % 2 === 1) {
      [...this.playerUnits, ...this.enemyUnits].forEach(u => {
        if (u.hp <= 0) return;
        const rate = weatherDotRate(this.weather.id, u.types ?? []);
        if (rate <= 0) return;
        const dmg = Math.max(1, Math.ceil(u.maxHp * rate));
        u.hp = Math.max(0, u.hp - dmg);
        this.log.push({
          type: 'effect_damage', effect: 'weather', label: w.emoji,
          targetId: u.uid, targetName: u.name, targetSide: u.side,
          damage: dmg, targetHpLeft: u.hp, targetMaxHp: u.maxHp,
        });
        if (u.hp <= 0) this._handleFaint(u);
      });
    }

    this.weather.turnsLeft -= 1;
    if (this.weather.turnsLeft <= 0) {
      this.log.push({ type: 'weather_end', weather: this.weather.id,
                      label: w?.emoji ?? '', name: w?.name ?? '' });
      this.weather = null;
    }
  }

  // Attaques différées (Prescience) : décompte puis application
  _resolveFutureAttacks() {
    if (!this._pendingFuture?.length) return;
    const all = [...this.playerUnits, ...this.enemyUnits];
    this._pendingFuture = this._pendingFuture.filter(f => {
      f.turnsLeft -= 1;
      if (f.turnsLeft > 0) return true;
      const t = all.find(u => u.uid === f.targetUid);
      if (t && t.hp > 0) {
        t.hp = Math.max(0, t.hp - f.damage);
        this.log.push({ type: 'effect_damage', effect: 'future', label: '🔮 Prescience',
          targetId: t.uid, targetName: t.name, targetSide: t.side,
          damage: f.damage, targetHpLeft: t.hp, targetMaxHp: t.maxHp });
        if (t.hp <= 0) this._handleFaint(t);
      }
      return false;
    });
  }

  // Dégâts périodiques à intervalle LIBRE, exprimé en actions (et non en
  // cycles de 8 comme les effets de fin de tour). Permet des cadences comme
  // « 2% toutes les 10 actions », impossibles avec le hook ON_PERIODIC.
  _tickIntervalDots(actionCount) {
    [...this.playerUnits, ...this.enemyUnits].forEach(u => {
      const d = u._intervalDot;
      if (!d || u.hp <= 0) return;
      if (actionCount % d.every !== 0) return;
      const foes = u.side === 'player' ? this.enemyUnits : this.playerUnits;
      foes.filter(e => e.hp > 0).forEach(e => {
        const dmg = Math.max(1, Math.ceil(e.maxHp * d.rate));
        e.hp = Math.max(0, e.hp - dmg);
        this.log.push({ type:'attack', effect:'passive_dot', label:`🩸 ${d.name}`,
          attackerId:u.uid, attackerSide:u.side,
          targetId:e.uid, targetName:e.name, targetSide:e.side,
          damage:dmg, targetHpLeft:e.hp, targetMaxHp:e.maxHp });
        if (e.hp <= 0) this._handleFaint(e);
      });
    });
  }

  // Piège (trap) : dégâts résiduels et décompte de la durée
  _tickTraps() {
    [...this.playerUnits, ...this.enemyUnits].forEach(u => {
      const tr = u._trapped;
      if (!tr || u.hp <= 0) return;
      const dmg = Math.max(1, Math.ceil(u.maxHp * tr.rate));
      u.hp = Math.max(0, u.hp - dmg);
      this.log.push({ type: 'effect_damage', effect: 'trap', label: '🕸️',
        targetId: u.uid, targetName: u.name, targetSide: u.side,
        damage: dmg, targetHpLeft: u.hp, targetMaxHp: u.maxHp });
      if (u.hp <= 0) { this._handleFaint(u); return; }
      tr.turns -= 1;
      if (tr.turns <= 0) u._trapped = null;
    });
  }

  // Instantané compact des stats effectives (météo, tempMods, rage... inclus),
  // indexé par uid. Utilisé par l'UI pour un suivi en temps réel.
  _snapshotStats() {
    const snap = {};
    [...this.playerUnits, ...this.enemyUnits].forEach(u => {
      snap[u.uid] = {
        hp: u.hp, maxHp: u.maxHp,
        shield: u.shield ?? 0, maxShield: u.maxShield ?? 0,
        atk:     this._getStat(u, 'atk'),
        spa:     this._getStat(u, 'spa'),
        def:     this._getStat(u, 'def'),
        spd_def: this._getStat(u, 'spd_def'),
        spd:     this._getStat(u, 'spd'),
        statuses: (u.statusEffects ?? []).map(st => ({ type: st.type, stacks: st.stacks ?? 1 })),
      };
    });
    return snap;
  }

  // Objet à effet de secours : { emergencyHeal: { threshold, rate } }
  _checkEmergencyBerry(unit) {
    const berry = unit?.heldItem?.emergencyHeal;
    if (!berry || unit._berryUsed || unit.hp <= 0) return;
    if ((unit.hp / unit.maxHp) >= (berry.threshold ?? 0.50)) return;
    unit._berryUsed = true;
    const heal = Math.max(1, Math.ceil(unit.maxHp * (berry.rate ?? 0.25)));
    unit.hp = Math.min(unit.maxHp, unit.hp + heal);
    this.log.push({ type:'effect_heal', effect:'item_berry',
      label:`🍊 ${unit.heldItem.name}`,
      targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
      heal, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
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
    // Alternance de type : bitype attaque en type1 puis type2 en alternance
    const atkTypeIdx = attacker._attackTypeTurn ?? 0;
    const atkType    = attacker.types[atkTypeIdx % attacker.types.length] ?? attacker.types[0];
    attacker._attackTypeTurn = atkTypeIdx + 1;
    attacker._lastAttackType = atkType;  // mémorise pour le log

    const typeMult = getTypeMultiplier(atkType, target.types);
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

    // Ultime : utilise le type 1 du pokémon (override move.type)
    const ultimateType = attacker.types[0];
    const effType  = move.isUltimate ? ultimateType : (move.type ?? attacker.types[0]);
    const typeMult = move.ignoreType ? 1
      : getTypeMultiplier(effType, target.types);
    const isCrit   = (move.effects ?? []).some(e => e.kind === 'guaranteed_crit');
    const random   = (85 + Math.random() * 15) / 100;

    // Flags passifs : bonus dégâts
    // Crit boost et firstHitBoost
    const isCritPassive = attacker._flags?.critBoost
      && Math.random() < (attacker._flags.critBoost.chance ?? 0);
    let firstHitMult = 1.0;
    if (attacker._flags?.firstHitBoost && !attacker._firstHitDone) {
      firstHitMult = attacker._flags.firstHitBoost.mult ?? 2.0;
      attacker._firstHitDone = true;
    }

    // Flags passifs : bonusVsStatus, bonusVsStun, critBoost
    let bonusMult = 1.0;
    const bvs = attacker._flags?.bonusVsStatus;
    if (bvs && target.statusEffects.length > 0) bonusMult *= (bvs.mult ?? 1.20);
    const bvstn = attacker._flags?.bonusVsStun;
    if (bvstn && this._hasStatus(target, 'stun')) bonusMult *= (bvstn.mult ?? 1.50);

    // Crit boost via flag
    const critFlag  = attacker._flags?.critBoost;


    // ramp_damage : dégâts croissants tant que la MÊME capacité est réutilisée
    // sur des tours consécutifs. Plafonné (×2 par défaut) pour éviter qu'un
    // troisième tour ne devienne un one-shot.
    let rampMult = 1;
    const ramp = (move.effects ?? []).find(e => e.kind === 'ramp_damage');
    if (ramp) {
      const st = attacker._rampDmg;
      if (st && st.move === move.name) st.stacks += 1;
      else attacker._rampDmg = { move: move.name, stacks: 0 };
      const stacks = attacker._rampDmg.stacks;
      rampMult = Math.min(Math.pow(2, stacks), ramp.max ?? 2.0);
    } else if (attacker._rampDmg) {
      attacker._rampDmg = null;   // une autre capacité brise la série
    }

    damage = damage * 1.1 * typeMult * random * bonusMult * firstHitMult * rampMult;
    if (isCrit || isCritPassive) damage *= 1.5;

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
        const dmg = Math.max(1, Math.ceil(u.maxHp * STATUS_VALUES.burnDmgPerStack * burnStacks));
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
        const dmg    = Math.max(1, Math.ceil(u.maxHp * STATUS_VALUES.poisonDmgPerStack * stacks));
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

    // ON_PERIODIC : passifs périodiques (regen, dot, aoe status)
    const allAlive_ = [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0);
    allAlive_.forEach(u => {
      const pAllies  = u.side === 'player' ? this.playerUnits : this.enemyUnits;
      const pEnemies = u.side === 'player' ? this.enemyUnits  : this.playerUnits;
      this._runHook('ON_PERIODIC', u, { allies:pAllies, enemies:pEnemies });
    });

    // Talents de regen (système de talents séparé)    // dot_on_sleep : cibles endormies perdent des HP
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

    // dotTarget flag (malédiction d'Osselait) : perd HP/action
    [...this.playerUnits, ...this.enemyUnits].filter(u => u.hp > 0 && u._flags?.dotTarget).forEach(u => {
      const rate = u._flags.dotTarget.rate ?? 0.08;
      const dmg  = Math.max(1, Math.ceil(u.maxHp * rate));
      u.hp = Math.max(0, u.hp - dmg);
      this.log.push({ type:'attack', effect:'passive_dot', label:`💀 Malédiction`,
        targetId:u.uid, targetName:u.name, targetSide:u.side,
        damage:dmg, targetHpLeft:u.hp, targetMaxHp:u.maxHp });
      if (u.hp <= 0) this._handleFaint(u);
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
    if (unit.hp > 0) return;
    if (unit._faintLogged) return;

    // ON_DEATH : effets à la mort (revive_mark, explosion, etc.)
    const fEnemies = unit.side === 'player' ? this.enemyUnits  : this.playerUnits;
    const fAllies  = unit.side === 'player' ? this.playerUnits : this.enemyUnits;
    this._runHook('ON_DEATH', unit, { enemies:fEnemies, allies:fAllies });
    if (unit.hp > 0) return; // revivifié

    // Revanche : déclenche l'ultime si mana ≥ seuil
    if (this.relicId && RelicEngine.checkDeathUltimate(this.relicId, unit) && !unit._revengeUsed) {
      unit._revengeUsed = true;
      const enemies = unit.side === 'player' ? this.enemyUnits : this.playerUnits;
      unit.hp = 1; // temporairement vivant pour l'ultime
      const move = getMove(unit.id);
      if (move) this._executeMove(unit, move);
      unit.hp = 0; // revient à 0 après
    }

    // Revive via _reviveRate (posé par revive_mark dans ON_SETUP)
    if (unit._reviveRate > 0 && !unit._revived) {
      unit._revived = true;
      unit.hp = Math.max(1, Math.ceil(unit.maxHp * unit._reviveRate));
      if (unit._reviveTalent) {
        this.log.push({ type:'talent_trigger', talentType:unit._reviveTalent,
          label:`Phénix — ${unit.name} ressuscite !` });
      } else if (unit._reviveItem) {
        this.log.push({ type:'passive_trigger', effect:'boost',
          label:`💊 ${unit._reviveItem} — ${unit.name} est ranimé !`,
          targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
      }
      this.log.push({ type:'effect_heal', effect:'revive', label:`✨ Résurrection ! (${unit.name})`,
        targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
        heal:unit.hp, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
      return;
    }

    // Sturdy : survit à 1 HP
    if (unit._flags?.sturdy && !unit._sturdyUsed) {
      unit._sturdyUsed = true;
      unit.hp = 1;
      this.log.push({ type:'passive_trigger', effect:'sturdy',
        label:`🪨 Robustesse — ${unit.name} survit à 1 HP !`,
        targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
      return;
    }

    unit._faintLogged = true;
    unit._dead = true;  // bloque les soins passifs (ex: Enracinement)
    unit.hp = 0;
    this.log.push({ type:'unit_fainted', unitId:unit.uid, unitName:unit.name, unitSide:unit.side });
    if (unit.types.includes('Dragon'))
      this.rageKills[unit.side] = (this.rageKills[unit.side] ?? 0) + 1;

    // Boost alliés sur K.O. (atkOnAllyKo, spdOnAllyKo)
    fAllies.filter(a => a.hp > 0).forEach(ally => {
      const sf = ally._flags?.spdOnAllyKo;
      if (sf) ally.spd = Math.round(ally.spd * (1 + sf.boost));
      const af = ally._flags?.atkOnAllyKo;
      if (af) ally.atk = Math.round(ally.atk * (1 + af.boost));
    });

    // Talent "Essaim vengeur" (type_swarm_on_ko) : à la mort d'une unité d'un type,
    // les alliés du MÊME type encore en vie reçoivent un boost de stat.
    fAllies.filter(a => a.hp > 0 && a._swarmOnKo).forEach(ally => {
      if (ally.types.some(t => unit.types.includes(t))) {
        const { stat, mult } = ally._swarmOnKo;
        ally[stat] = Math.round((ally[stat] ?? 0) * mult);
        this.log.push({ type:'talent_trigger', talentType:(ally.types?.[0] ?? ''),
          label:`${ally.name} enrage (Essaim) !` });
      }
    });

    // Boost attaquant sur K.O. ennemi (atkOnEnemyKo)
    fEnemies.filter(a => a.hp > 0).forEach(en => {
      const ef = en._flags?.atkOnEnemyKo;
      if (ef) en.atk = Math.round(en.atk * (1 + ef.boost));
    });
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
  // Vainqueur. Si UN SEUL camp a des survivants, il gagne.
  // Si les DEUX en ont (limite d'actions atteinte), on départage aux PV
  // restants en pourcentage : déclarer le joueur vainqueur par défaut, comme
  // avant, offrait une victoire gratuite à qui savait faire traîner un combat.
  _winner() {
    const alive = arr => arr.filter(u => u.hp > 0);
    const p = alive(this.playerUnits);
    const e = alive(this.enemyUnits);
    if (!p.length) return 'enemy';
    if (!e.length) return 'player';

    const ratio = arr => arr.reduce((a, u) => a + (u.hp / Math.max(1, u.maxHp)), 0) / arr.length;
    const rp = ratio(p);
    const re = ratio(e);
    if (rp !== re) return rp > re ? 'player' : 'enemy';
    // Égalité parfaite : on départage au nombre d'unités debout
    if (p.length !== e.length) return p.length > e.length ? 'player' : 'enemy';
    return 'player';   // ex aequo absolu : bénéfice du doute au joueur
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Mixin PassiveEngine ────────────────────────────────────────────────────
Object.assign(CombatEngine.prototype, PassiveEngine);

const STATUS_LABELS = {
  burn:'🔥 Brûlure !',  poison:'☠️ Poison !', paralyze:'⚡ Paralysie !',
  freeze:'❄️ Gel !',    sleep:'💤 Sommeil !', confuse:'😵 Confusion !',
  stun:'🔒 Immobilisé !',
};

export const STAT_EMOJIS = {
  hp:'❤️', atk:'⚔️', def:'🛡️', spa:'🔮', spd_def:'💎', spd:'👟',
};