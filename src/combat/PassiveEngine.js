// ─────────────────────────────────────────────────────────────────────────────
// PassiveEngine.js — Moteur de hooks pour les passifs de niveau
//
// S'injecte dans CombatEngine via mixin :
//   Object.assign(CombatEngine.prototype, PassiveEngine);
//
// Utilisation dans CombatEngine :
//   this._runHook('ON_SETUP',    unit, { enemies, allies })
//   this._runHook('ON_ACTION',   unit, {})
//   this._runHook('ON_ATTACK',   unit, { target, damage })
//   this._runHook('ON_RECEIVE',  unit, { attacker, damage })
//   this._runHook('ON_PERIODIC', unit, { enemies, allies })
//   this._runHook('ON_DEATH',    unit, { enemies, allies })
// ─────────────────────────────────────────────────────────────────────────────

import { POKEMON_PASSIVES, getUnitPassives } from '../data/passiveHooks.js';

export const PassiveEngine = {

  // ── Charge les passifs dans une unité ─────────────────────────────────────
  _loadPassives(unit) {
    const level  = unit._level ?? 1;
    unit._passives = getUnitPassives(unit.id, level);
    unit._flags    = {};   // flags divers (sturdy, dodgeOnce, ignoreDef, etc.)
  },

  // ── Exécute tous les hooks d'un type pour une unité ───────────────────────
  _runHook(hookName, unit, ctx = {}) {
    if (!unit._passives?.length) return;
    unit._passives.forEach(passive => {
      const actions = passive.hooks?.[hookName];
      if (!actions?.length) return;
      actions.forEach(action => {
        try {
          this._execAction(action, passive, unit, ctx);
        } catch (e) {
          console.warn(`[PassiveEngine] ${passive.name} ${hookName} ${action.type}:`, e.message);
        }
      });
    });
  },

  // ── Exécuteur central (~45 cases) ─────────────────────────────────────────
  _execAction(action, passive, unit, ctx) {
    const { enemies = [], allies = [], target, attacker,
            damage = 0, globalActionCount = 0 } = ctx;

    switch (action.type) {

      // ════════════════════════════════════════════════════════════════════
      // ON_SETUP
      // ════════════════════════════════════════════════════════════════════

      case 'stat_boost': {
        // Boost permanent de stats (ou réduction dégâts spéciale)
        const stats = action.stats ?? (action.stat ? [action.stat] : []);
        stats.forEach(s => {
          if (s === '_dmgReduction') {
            unit._dmgReduction = (unit._dmgReduction ?? 1) * action.mult;
          } else if (s === '_dmgReducPhysical') {
            unit._dmgReducPhysical = (unit._dmgReducPhysical ?? 1) * action.mult;
          } else if (s === '_dmgReducSpecial') {
            unit._dmgReducSpecial = (unit._dmgReducSpecial ?? 1) * action.mult;
          } else {
            unit[s] = Math.round((unit[s] ?? 0) * action.mult);
            if (s === 'hp') unit.maxHp = unit.hp;
          }
        });
        break;
      }

      case 'intimidate': {
        // Débuff permanent ennemis via tempMod (visible dans l'overlay)
        enemies.forEach(en => {
          (action.stats ?? []).forEach(s => {
            const ex = en.tempMods.find(m => m.stat === s && m._intimidate);
            if (ex) { ex.mult *= action.mult; }
            else     { en.tempMods.push({ stat:s, mult:action.mult, turnsLeft:-1, _intimidate:true }); }
          });
        });
        this._hookLog(passive, unit,
          `😤 ${passive.name} — ${(action.stats??[]).join('/')} ${Math.round((1-action.mult)*100)}%▼`);
        break;
      }

      case 'aoe_status': {
        // Applique un statut à un groupe d'ennemis
        const targets = this._resolveRow(enemies, action.row);
        targets.forEach(en => {
          if (en.hp <= 0) return;
          if (Math.random() > (action.chance ?? 1.0)) return;
          this._addStatus(en, action.status, action.turns ?? -1);
        });
        this._hookLog(passive, unit, `✨ ${passive.name}`);
        break;
      }

      case 'aoe_status_stack': {
        // Comme aoe_status mais force un stack supplémentaire (ex: Sulfura brûlure)
        const targets = this._resolveRow(enemies, action.row);
        targets.forEach(en => {
          if (en.hp <= 0) return;
          if (Math.random() > (action.chance ?? 1.0)) return;
          const ex = en.statusEffects.find(s => s.type === action.status);
          if (ex) {
            const maxSt = action.status === 'burn' ? 3 : 5;
            ex.stacks = Math.min((ex.stacks ?? 1) + 1, maxSt);
            this._hookLog(passive, unit, `🔥 ${passive.name} — stack ×${ex.stacks} sur ${en.name}`);
          } else {
            this._addStatus(en, action.status, action.turns ?? 3);
          }
        });
        break;
      }

      case 'shield': {
        unit.armorShield = true;
        break;
      }

      case 'revive_mark': {
        unit._reviveRate = Math.max(unit._reviveRate ?? 0, action.rate);
        break;
      }

      case 'evasion': {
        unit._evasion = (unit._evasion ?? 0) + action.chance;
        break;
      }

      case 'type_immunity': {
        unit._typeImmune = [...(unit._typeImmune ?? []), action.damageType];
        break;
      }

      case 'type_absorb': {
        unit._typeAbsorb = [...(unit._typeAbsorb ?? []), action.damageType];
        break;
      }

      case 'status_immunity': {
        unit._statusImmuneList = [...(unit._statusImmuneList ?? []), ...(action.statuses ?? [])];
        break;
      }

      case 'flag': {
        // Flags divers — stockés dans unit._flags, lus dans _dealDamage / _calcDamage
        unit._flags[action.flag] = { ...action };
        break;
      }

      case 'boost_highest_stat': {
        const stats  = ['atk','spa','def','spd_def','spd'];
        const best   = stats.reduce((b, s) => (unit[s] ?? 0) > (unit[b] ?? 0) ? s : b, stats[0]);
        unit[best]   = Math.round(unit[best] * action.mult);
        this._hookLog(passive, unit, `⭐ ${passive.name} — ${best} +${Math.round((action.mult-1)*100)}%`);
        break;
      }

      case 'aura_type_boost': {
        // Booste stats des alliés d'un type
        allies.filter(a => a !== unit && a.types?.includes(action.allyType)).forEach(a => {
          ['atk','spa','def','spd_def','spd'].forEach(s => {
            a[s] = Math.round(a[s] * action.mult);
          });
        });
        break;
      }

      case 'aura_all_boost': {
        allies.filter(a => a !== unit).forEach(a => {
          ['atk','spa','def','spd_def','spd'].forEach(s => {
            a[s] = Math.round(a[s] * action.mult);
          });
        });
        this._hookLog(passive, unit, `⭐ ${passive.name} — alliés +${Math.round((action.mult-1)*100)}%`);
        break;
      }

      case 'aura_dmg_reduction': {
        allies.filter(a => a !== unit).forEach(a => {
          a._dmgReduction = (a._dmgReduction ?? 1) * action.mult;
        });
        break;
      }

      case 'aura_type_immunity': {
        allies.filter(a => a !== unit && a.types?.includes(action.allyType)).forEach(a => {
          a._statusImmuneList = [...(a._statusImmuneList ?? []), ...(action.statuses ?? [])];
        });
        break;
      }

      case 'copy_strongest': {
        // Gagne ratio × stats du pokémon le plus puissant (allié ou ennemi)
        const all     = [...allies, ...enemies].filter(u => u !== unit && u.hp > 0);
        const bst     = (u) => (u.hp??0)+(u.atk??0)+(u.spa??0)+(u.def??0)+(u.spd_def??0)+(u.spd??0);
        const strongest = all.sort((a,b) => bst(b) - bst(a))[0];
        if (strongest) {
          const ratio = action.ratio ?? (1/3);
          ['atk','spa','def','spd_def','spd','hp'].forEach(s => {
            const bonus = Math.round((strongest[s] ?? 0) * ratio);
            unit[s] = (unit[s] ?? 0) + bonus;
            if (s === 'hp') unit.maxHp = unit.hp;
          });
          this._hookLog(passive, unit, `⭐ ${passive.name} — +${Math.round(ratio*100)}% stats de ${strongest.name}`);
        }
        break;
      }

      case 'random_passive': {
        // Métronome : tire un passif aléatoire et applique ses actions ON_SETUP
        const allDefs  = Object.values(POKEMON_PASSIVES);
        const pool     = [];
        allDefs.forEach(def => {
          [35, 70].forEach(lvl => {
            if (def[lvl]?.hooks && def[lvl].id !== 'metronome')
              pool.push(def[lvl]);
          });
        });
        const picked = pool[Math.floor(Math.random() * pool.length)];
        if (picked) {
          unit._metronomePassive = picked;
          // Applique les actions ON_SETUP du passif tiré
          (picked.hooks?.ON_SETUP ?? []).forEach(a => this._execAction(a, picked, unit, ctx));
          this._hookLog(passive, unit, `🎲 Métronome → ${picked.name} : ${picked.desc}`);
          this.log.push({ type:'pre_combat', effect:'metronome',
            label:`🎲 Métronome → ${picked.name} : ${picked.desc}`,
            targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
        }
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // ON_ACTION
      // ════════════════════════════════════════════════════════════════════

      case 'heal_self': {
        if (unit.hp <= 0) break;
        const heal = Math.max(1, Math.ceil(unit.maxHp * action.rate));
        unit.hp    = Math.min(unit.maxHp, unit.hp + heal);
        this.log.push({ type:'effect_heal', effect:'passive_regen', label:`💚 ${passive.name}`,
          targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
          heal, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
        break;
      }

      case 'conditional_stat': {
        // Applique/retire un tempMod selon une condition dynamique
        const key    = `_cond_${passive.id}_${unit.uid}`;
        const active = this._evalCondition(action, unit, allies);
        const stats  = action.stats ?? (action.stat ? [action.stat] : []);
        unit.tempMods = unit.tempMods.filter(m => m._condKey !== key);
        if (active) {
          stats.forEach(s => unit.tempMods.push({ stat:s, mult:action.mult, turnsLeft:-1, _condKey:key }));
          if (!unit._condActive?.[key]) {
            unit._condActive = unit._condActive ?? {};
            unit._condActive[key] = true;
            this._hookLog(passive, unit,
              `🔥 ${passive.name} activé ! (${action.condition} ${action.threshold ?? action.allyType ?? ''})`);
          }
        } else {
          if (unit._condActive) delete unit._condActive[key];
        }
        break;
      }

      case 'stack_per_ally': {
        // Bonus proportionnel au nombre d'alliés d'un type vivants
        const key   = `_stack_${passive.id}_${unit.uid}`;
        const count = action.allyType === 'all'
          ? allies.filter(a => a.hp > 0 && a !== unit).length
          : allies.filter(a => a.hp > 0 && a !== unit && a.types?.includes(action.allyType)).length;
        const mult  = 1 + count * (action.rate ?? 0.05);
        unit.tempMods = unit.tempMods.filter(m => m._stackKey !== key);
        if (count > 0) {
          unit.tempMods.push({ stat:action.stat, mult, turnsLeft:-1, _stackKey:key });
        }
        break;
      }

      case 'stack_per_enemy_status': {
        const key   = `_stackes_${passive.id}_${unit.uid}`;
        const count = enemies.filter(en => en.hp > 0 && this._hasStatus(en, action.status)).length;
        const mult  = 1 + count * (action.rate ?? 0.10);
        unit.tempMods = unit.tempMods.filter(m => m._stackesKey !== key);
        if (count > 0) {
          unit.tempMods.push({ stat:action.stat, mult, turnsLeft:-1, _stackesKey:key });
        }
        break;
      }

      case 'emergency_heal': {
        if (unit._emergencyUsed) break;
        if ((unit.hp / unit.maxHp) < (action.threshold ?? 0.25)) {
          unit._emergencyUsed = true;
          const heal = Math.max(1, Math.ceil(unit.maxHp * action.rate));
          unit.hp    = Math.min(unit.maxHp, unit.hp + heal);
          this.log.push({ type:'effect_heal', effect:'emergency_heal', label:`💚 ${passive.name}`,
            targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
            heal, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
        }
        break;
      }

      case 'ramp_stat': {
        // Ramp utilisé en ON_ACTION (vitesse) ou ON_ATTACK (dégâts)
        // Géré dans les deux hooks, mais la logique est la même
        const stats = action.stats ?? (action.stat ? [action.stat] : []);
        stats.forEach(s => {
          unit._ramp      = unit._ramp ?? {};
          const cur       = unit._ramp[s] ?? 0;
          const next      = Math.min(cur + action.rate, action.max ?? 0.50);
          unit._ramp[s]   = next;
          const key       = `_ramp_${passive.id}_${s}_${unit.uid}`;
          unit.tempMods   = unit.tempMods.filter(m => m._rampKey !== key);
          unit.tempMods.push({ stat:s, mult:1 + next, turnsLeft:-1, _rampKey:key });
        });
        const pct = Math.round((unit._ramp[stats[0]] ?? 0) * 100);
        this._hookLog(passive, unit, `⬆ ${passive.name} (${unit.name}) ${pct}%`);
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // ON_ATTACK
      // ════════════════════════════════════════════════════════════════════

      case 'drain': {
        if (!target || damage <= 0) break;
        const heal = Math.max(1, Math.ceil(damage * action.rate));
        unit.hp    = Math.min(unit.maxHp, unit.hp + heal);
        this.log.push({ type:'effect_heal', effect:'passive_drain', label:`🩸 ${passive.name}`,
          targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
          heal, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
        break;
      }

      case 'proc_status': {
        if (!target || Math.random() > (action.chance ?? 0)) break;
        const stacks = action.stacks ?? 1;
        for (let i = 0; i < stacks; i++)
          this._addStatus(target, action.status, action.turns ?? -1);
        break;
      }

      case 'proc_status_random': {
        if (!target || Math.random() > (action.chance ?? 0)) break;
        const pool   = action.statuses ?? [];
        const status = pool[Math.floor(Math.random() * pool.length)];
        if (status) this._addStatus(target, status, 2);
        break;
      }

      case 'debuff_target': {
        if (!target) break;
        const ex = target.tempMods.find(m => m.stat === action.stat && m._debuffKey === `${passive.id}_${target.uid}`);
        if (ex) { ex.mult *= action.mult; }
        else {
          target.tempMods.push({
            stat:action.stat, mult:action.mult, turnsLeft:-1,
            _debuffKey:`${passive.id}_${target.uid}`,
          });
        }
        break;
      }

      case 'periodic_aoe_status': {
        // Toutes les N attaques → AoE statut
        unit._periodicAtkCount    = (unit._periodicAtkCount ?? 0) + 1;
        if (unit._periodicAtkCount % (action.period ?? 5) !== 0) break;
        const tgts = [...(enemies.length ? enemies : [])];
        tgts.filter(en => en.hp > 0).forEach(en => this._addStatus(en, action.status, 2));
        this._hookLog(passive, unit, `⚡ ${passive.name} — AoE ${action.status}`);
        break;
      }

      case 'bonus_hit': {
        // Une frappe bonus à puissance réduite — géré en aval dans _takeTurn
        if (!target) break;
        const bonusDmg = Math.max(1, Math.ceil(damage * (action.mult ?? 0.50)));
        this._dealDamage(unit, target, bonusDmg, 1.0, false);
        this._hookLog(passive, unit, `🥊 ${passive.name} — frappe bonus`);
        break;
      }

      case 'flag_target': {
        // Pose un flag sur la cible (ex: dotTarget pour malédiction)
        if (!target) break;
        target._flags = target._flags ?? {};
        target._flags[action.flag] = { ...action };
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // ON_RECEIVE
      // ════════════════════════════════════════════════════════════════════

      case 'drain_receive': {
        // Enracinement : soigne en recevant des dégâts
        if (damage <= 0) break;
        const heal = Math.max(1, Math.ceil(damage * action.rate));
        unit.hp    = Math.min(unit.maxHp, unit.hp + heal);
        this.log.push({ type:'effect_heal', effect:'drain_receive', label:`🌿 ${passive.name}`,
          targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
          heal, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
        break;
      }

      case 'counter': {
        // Riposte X% des dégâts reçus
        if (!attacker || attacker.hp <= 0 || damage <= 0) break;
        const counterDmg = Math.max(1, Math.ceil(damage * action.rate));
        attacker.hp = Math.max(0, attacker.hp - counterDmg);
        this.log.push({ type:'attack', effect:'counter', label:`🔄 ${passive.name}`,
          attackerId:unit.uid, attackerName:unit.name, attackerSide:unit.side,
          targetId:attacker.uid, targetName:attacker.name, targetSide:attacker.side,
          damage:counterDmg, targetHpLeft:attacker.hp, targetMaxHp:attacker.maxHp,
          attackerMana:unit.mana, targetMana:attacker.mana,
          attackerAtb:unit.atbBar??0, targetAtb:attacker.atbBar??0 });
        if (attacker.hp <= 0) this._handleFaint(attacker);
        break;
      }

      case 'rage': {
        // Boost stat cumulatif par coup reçu
        unit.rageStack = unit.rageStack ?? {
          stat:action.stat, count:0, mult:1 + (action.rate ?? 0.05)
        };
        const maxCount = Math.floor((action.max ?? 0.50) / (action.rate ?? 0.05));
        unit.rageStack.count = Math.min(unit.rageStack.count + 1, maxCount);
        const totalBoost = Math.round(unit.rageStack.count * (action.rate ?? 0.05) * 100);
        this._hookLog(passive, unit, `😤 ${passive.name} +${totalBoost}% ${action.stat}`);
        break;
      }

      case 'proc_status_attacker': {
        if (!attacker || Math.random() > (action.chance ?? 0)) break;
        if (action.status === 'reflect') {
          // Synchronie : renvoie les statuts de l'unité vers l'attaquant
          unit.statusEffects.filter(s => s.type !== 'sleep').forEach(s => {
            this._addStatus(attacker, s.type, s.turnsLeft);
          });
        } else {
          this._addStatus(attacker, action.status, action.turns ?? 2);
        }
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // ON_PERIODIC
      // ════════════════════════════════════════════════════════════════════

      case 'heal_self_periodic': {
        if (unit.hp <= 0) break;
        const heal = Math.max(1, Math.ceil(unit.maxHp * action.rate));
        unit.hp    = Math.min(unit.maxHp, unit.hp + heal);
        this.log.push({ type:'effect_heal', effect:'passive_regen', label:`💚 ${passive.name}`,
          targetId:unit.uid, targetName:unit.name, targetSide:unit.side,
          heal, targetHpLeft:unit.hp, targetMaxHp:unit.maxHp });
        break;
      }

      case 'heal_all': {
        allies.filter(a => a.hp > 0).forEach(a => {
          const heal = Math.max(1, Math.ceil(a.maxHp * action.rate));
          a.hp = Math.min(a.maxHp, a.hp + heal);
          this.log.push({ type:'effect_heal', effect:'passive_regen', label:`💚 ${passive.name}`,
            targetId:a.uid, targetName:a.name, targetSide:a.side,
            heal, targetHpLeft:a.hp, targetMaxHp:a.maxHp });
        });
        break;
      }

      case 'heal_weakest_ally': {
        const weakest = allies.filter(a => a.hp > 0)
          .sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
        if (weakest) {
          const heal = Math.max(1, Math.ceil(weakest.maxHp * action.rate));
          weakest.hp = Math.min(weakest.maxHp, weakest.hp + heal);
          this.log.push({ type:'effect_heal', effect:'passive_regen', label:`💚 ${passive.name}`,
            targetId:weakest.uid, targetName:weakest.name, targetSide:weakest.side,
            heal, targetHpLeft:weakest.hp, targetMaxHp:weakest.maxHp });
        }
        break;
      }

      case 'dot_enemies': {
        enemies.filter(en => en.hp > 0).forEach(en => {
          const dmg = Math.max(1, Math.ceil(en.maxHp * action.rate));
          en.hp = Math.max(0, en.hp - dmg);
          this.log.push({ type:'attack', effect:'passive_dot', label:`🩸 ${passive.name}`,
            attackerId:unit.uid, attackerSide:unit.side,
            targetId:en.uid, targetName:en.name, targetSide:en.side,
            damage:dmg, targetHpLeft:en.hp, targetMaxHp:en.maxHp });
          if (en.hp <= 0) this._handleFaint(en);
        });
        break;
      }

      case 'dot_sleeping_enemies': {
        enemies.filter(en => en.hp > 0 && this._hasStatus(en, 'sleep')).forEach(en => {
          const dmg = Math.max(1, Math.ceil(en.maxHp * action.rate));
          en.hp = Math.max(0, en.hp - dmg);
          this.log.push({ type:'attack', effect:'passive_dot', label:`💤 ${passive.name}`,
            attackerId:unit.uid, attackerSide:unit.side,
            targetId:en.uid, targetName:en.name, targetSide:en.side,
            damage:dmg, targetHpLeft:en.hp, targetMaxHp:en.maxHp });
          if (en.hp <= 0) this._handleFaint(en);
        });
        break;
      }

      case 'aoe_status_periodic': {
        enemies.filter(en => en.hp > 0).forEach(en => {
          if (Math.random() < (action.chance ?? 0.30))
            this._addStatus(en, action.status, 2);
        });
        this._hookLog(passive, unit, `⚡ ${passive.name} — AoE ${action.status}`);
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // ON_DEATH
      // ════════════════════════════════════════════════════════════════════

      case 'aoe_damage': {
        const dmgBase = Math.ceil(unit.maxHp * action.rate);
        enemies.filter(en => en.hp > 0).forEach(en => {
          const dmg = Math.max(1, dmgBase);
          en.hp  = Math.max(0, en.hp - dmg);
          en.maxHp = Math.max(1, en.maxHp - Math.max(1, Math.floor(dmg * 0.1)));
          this.log.push({ type:'attack', effect:'death_passive', label:`💥 ${passive.name}`,
            attackerId:unit.uid, attackerName:unit.name, attackerSide:unit.side,
            targetId:en.uid, targetName:en.name, targetSide:en.side,
            damage:dmg, targetHpLeft:en.hp, targetMaxHp:en.maxHp,
            attackerMana:unit.mana??0, targetMana:en.mana??0,
            attackerAtb:unit.atbBar??0, targetAtb:en.atbBar??0 });
          if (en.hp <= 0) this._handleFaint(en);
        });
        break;
      }

      case 'target_damage': {
        const tgt = enemies.filter(en => en.hp > 0)
          .sort((a,b) => (b.hp + b.atk + b.spa) - (a.hp + a.atk + a.spa))[0];
        if (tgt) {
          const dmg = Math.max(1, Math.ceil(unit.maxHp * action.rate));
          tgt.hp = Math.max(0, tgt.hp - dmg);
          this.log.push({ type:'attack', effect:'death_passive', label:`💀 ${passive.name}`,
            attackerId:unit.uid, attackerName:unit.name, attackerSide:unit.side,
            targetId:tgt.uid, targetName:tgt.name, targetSide:tgt.side,
            damage:dmg, targetHpLeft:tgt.hp, targetMaxHp:tgt.maxHp,
            attackerMana:unit.mana??0, targetMana:tgt.mana??0,
            attackerAtb:unit.atbBar??0, targetAtb:tgt.atbBar??0 });
          if (tgt.hp <= 0) this._handleFaint(tgt);
        }
        break;
      }

      case 'target_ko_chance': {
        const tgt2 = enemies.filter(en => en.hp > 0)[Math.floor(Math.random() * enemies.length)];
        if (tgt2 && Math.random() < (action.chance ?? 0.20)) {
          tgt2.hp = 0;
          this.log.push({ type:'attack', effect:'death_passive', label:`💀 ${passive.name} — KO !`,
            attackerId:unit.uid, attackerSide:unit.side,
            targetId:tgt2.uid, targetName:tgt2.name, targetSide:tgt2.side,
            damage:tgt2.maxHp, targetHpLeft:0, targetMaxHp:tgt2.maxHp,
            attackerMana:unit.mana??0, targetMana:0,
            attackerAtb:unit.atbBar??0, targetAtb:0 });
          this._handleFaint(tgt2);
        }
        break;
      }

      case 'revive': {
        // Géré dans _handleFaint via unit._reviveRate — ici on pose juste la marque
        unit._reviveRate = Math.max(unit._reviveRate ?? 0, action.rate);
        break;
      }

      case 'buff_allies': {
        allies.filter(a => a.hp > 0).forEach(a => {
          ['atk','spa'].forEach(s => a[s] = Math.round(a[s] * (action.mult ?? 1.10)));
        });
        this._hookLog(passive, unit, `⬆ ${passive.name} — alliés boostés`);
        break;
      }

      case 'debuff_enemies_on_ko': {
        enemies.filter(en => en.hp > 0).forEach(en => {
          const ex = en.tempMods.find(m => m.stat === action.stat && m._deathDebuff);
          if (ex) { ex.mult *= action.mult; }
          else { en.tempMods.push({ stat:action.stat, mult:action.mult, turnsLeft:-1, _deathDebuff:true }); }
        });
        this._hookLog(passive, unit, `😤 ${passive.name} — ennemis débuff`);
        break;
      }

      default:
        // Action inconnue — silencieux pour éviter le bruit
        break;
    }
  },

  // ── Utilitaires ───────────────────────────────────────────────────────────

  // Résout un ciblage par rangée pour les AoE
  _resolveRow(enemies, row) {
    if (!row || row === 'all')    return enemies;
    if (row === 'front')          return enemies.filter(en => en.row === 0);
    if (row === 'back')           return enemies.filter(en => en.row > 0);
    if (row === 'random1') {
      const alive = enemies.filter(en => en.hp > 0);
      return alive.length ? [alive[Math.floor(Math.random() * alive.length)]] : [];
    }
    if (row === 'random2') {
      const alive = enemies.filter(en => en.hp > 0).sort(() => Math.random() - 0.5);
      return alive.slice(0, 2);
    }
    return enemies;
  },

  // Évalue une condition ON_ACTION
  _evalCondition(action, unit, allies) {
    switch (action.condition) {
      case 'hp_below':   return (unit.hp / unit.maxHp) < (action.threshold ?? 0.5);
      case 'hp_above':   return (unit.hp / unit.maxHp) >= (action.threshold ?? 0.75);
      case 'ally_type':  return allies.some(a => a !== unit && a.hp > 0 && a.types?.includes(action.allyType));
      case 'no_ally_ko': return allies.every(a => a.hp > 0);
      default:           return false;
    }
  },

  // Log court pour les passifs (type passive_trigger, visible en violet dans le journal)
  _hookLog(passive, unit, label) {
    this.log.push({ type:'passive_trigger', effect:'hook',
      label, targetId:unit.uid, targetName:unit.name, targetSide:unit.side });
  },
};