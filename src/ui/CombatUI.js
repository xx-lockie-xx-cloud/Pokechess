// ─────────────────────────────────────────────────────────────────────────────
// CombatUI.js
// ─────────────────────────────────────────────────────────────────────────────

import { CombatEngine, STAT_EMOJIS }           from '../combat/CombatEngine.js';
import { getMove }                             from '../data/moves.js';
import { getLevelColor, getLevelBadgeHTML }     from '../data/levelSystem.js';
import { addCoins, getEnemyMultiplier }     from '../data/runState.js';
import { SaveManager }                     from '../SaveManager.js';
import { getEffectiveStats }               from '../data/items.js';
import { getActiveSynergies, getFullStats } from '../data/synergies.js';
import { getArenaForMap }                   from '../data/arenas.js';

const DELAY_TURN_START = 100;
const DELAY_ATTACK     = 600;
const DELAY_FAINTED    = 400;
const DELAY_COMBAT_END = 600;

export const CombatUI = {
  _data:        null,
  _registry:    null,
  _onDone:      null,
  _playerUnits: [],
  _enemyUnits:  [],
  _slots:       {},
  _hpState:     {},
  _speed:       1,
  _combatLog:   [],
  _unsubscribe: null,   // pour nettoyer le listener registre

  // ─────────────────────────────────────────────────────────────────────────
  init(data, registry, onDone) {
    // Nettoie l'éventuel listener du combat précédent
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }

    this._data          = data;
    this._registry      = registry;
    this._onDone        = onDone;
    this._enemyUnits    = data.enemyUnits ?? [];
    this._slots         = {};
    this._hpState       = {};
    this._statusTracker = {};
    this._speed         = 1;
    this._combatLog     = [];

    // Lit toujours depuis le registre (priorité sur data.playerUnits)
    this._playerUnits = registry.get('playerUnits') ?? data.playerUnits ?? [];

    this._render();
    this._bindTeamListener();
    this._bindStartButton();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Écoute les changements d'équipe depuis PrepUI, re-rend le terrain joueur
  // ─────────────────────────────────────────────────────────────────────────
  _bindTeamListener() {
    const handler = () => {
      // Seulement si le combat n'a pas encore démarré
      const btn = document.getElementById('btn-start-combat');
      if (!btn || btn.disabled) return;
      this._playerUnits = this._registry.get('playerUnits') ?? this._playerUnits;
      this._refreshPlayerField();
    };

    this._registry.events.on('changedata-playerUnits', handler);

    // Fonction de désinscription appelée au start
    this._unsubscribe = () => {
      this._registry.events.off('changedata-playerUnits', handler);
    };
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Re-rend uniquement le terrain joueur (sans toucher à l'ennemi)
  // ─────────────────────────────────────────────────────────────────────────
  _refreshPlayerField() {
    const playerField = document.querySelector('.combat-field-player');
    if (!playerField) return;

    // Purge les anciennes entrées joueur dans _slots et _hpState
    Object.keys(this._slots).forEach(k => {
      if (k.startsWith('player_')) delete this._slots[k];
    });
    Object.keys(this._hpState).forEach(k => {
      if (k.startsWith('player_')) delete this._hpState[k];
    });

    playerField.innerHTML = '';
    playerField.appendChild(this._buildRow(this._playerUnits, 0, 'player'));
    playerField.appendChild(this._buildRow(this._playerUnits, 1, 'player'));
  },

  // ─────────────────────────────────────────────────────────────────────────
  _render() {
    const screen = document.getElementById('overlay-combat');
    if (!screen) return;
    screen.innerHTML = '';

    // Sprite dresseur arrière-plan
    const trainerSrc = this._getTrainerSpritePath();
    if (trainerSrc) {
      const img = document.createElement('img');
      img.src       = trainerSrc;
      img.className = 'combat-trainer-bg';
      img.alt       = 'Dresseur';
      screen.appendChild(img);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'combat-wrapper';
    screen.appendChild(wrapper);

    // Label ennemi
    const labelEnemy = document.createElement('div');
    labelEnemy.className   = 'combat-label combat-label-enemy';
    labelEnemy.textContent = `⚔ ${this._data.trainerName ?? 'Adversaire'}`;
    wrapper.appendChild(labelEnemy);

    // Terrain ennemi (rangée 1 en haut, rangée 0 en bas)
    const enemyField = document.createElement('div');
    enemyField.className = 'combat-field combat-field-enemy';
    enemyField.appendChild(this._buildRow(this._enemyUnits, 1, 'enemy'));
    enemyField.appendChild(this._buildRow(this._enemyUnits, 0, 'enemy'));
    wrapper.appendChild(enemyField);

    // Séparateur
    const sep = document.createElement('div');
    sep.className   = 'combat-separator';
    sep.textContent = '— VS —';
    wrapper.appendChild(sep);

    // Terrain joueur (rangée 0 en haut, rangée 1 en bas)
    const playerField = document.createElement('div');
    playerField.className = 'combat-field combat-field-player';
    playerField.appendChild(this._buildRow(this._playerUnits, 0, 'player'));
    playerField.appendChild(this._buildRow(this._playerUnits, 1, 'player'));
    wrapper.appendChild(playerField);

    // Label joueur
    const labelPlayer = document.createElement('div');
    labelPlayer.className   = 'combat-label combat-label-player';
    labelPlayer.textContent = 'Votre équipe';
    wrapper.appendChild(labelPlayer);

    // Hint équipe modifiable
    const hint = document.createElement('p');
    hint.className   = 'combat-hint';
    hint.id          = 'combat-hint-text';
    hint.textContent = '💡 Modifiez votre équipe via ⚔ Équipe avant de lancer';
    wrapper.appendChild(hint);

    // Phase text
    const phase = document.createElement('div');
    phase.className   = 'combat-phase';
    phase.id          = 'combat-phase-text';
    phase.textContent = 'Préparez-vous !';
    wrapper.appendChild(phase);

    // Boutons lancer + vitesse
    const btnRow = document.createElement('div');
    btnRow.className = 'combat-btn-row';

    const btn = document.createElement('button');
    btn.className   = 'btn-danger btn-large';
    btn.id          = 'btn-start-combat';
    btn.textContent = '⚔ Lancer le combat';
    btnRow.appendChild(btn);

    const btnSpeed = document.createElement('button');
    btnSpeed.className   = 'btn-speed';
    btnSpeed.id          = 'btn-combat-speed';
    btnSpeed.textContent = '▶▶ ×2';
    btnSpeed.title       = 'Accélérer le combat';
    btnSpeed.addEventListener('click', () => {
      this._speed = this._speed === 1 ? 2 : 1;
      btnSpeed.textContent = this._speed === 2 ? '▶ ×1' : '▶▶ ×2';
      btnSpeed.classList.toggle('active', this._speed === 2);
    });
    btnRow.appendChild(btnSpeed);
    wrapper.appendChild(btnRow);

    // Zone journal
    const logZone = document.createElement('div');
    logZone.id        = 'combat-log-zone';
    logZone.className = 'combat-log-zone hidden';
    wrapper.appendChild(logZone);
  },

  // ─────────────────────────────────────────────────────────────────────────
  _buildRow(units, rowIndex, side) {
    const row = document.createElement('div');
    row.className = 'combat-row';
    for (let col = 0; col < 3; col++) {
      const unit = units.find(u => u.col === col && u.row === rowIndex) ?? null;
      row.appendChild(this._buildSlot(unit, side));
    }
    return row;
  },

  // ─────────────────────────────────────────────────────────────────────────
  _buildSlot(unit, side) {
    const slot = document.createElement('div');
    slot.className = `combat-slot ${unit ? 'occupied' : 'empty'}`;
    if (!unit) return slot;

    const uid    = unit.uid ?? `${unit.id}_${unit.col}_${unit.row}`;
    const mapKey = `${side}_${uid}`;
    this._slots[mapKey] = slot;

    this._hpState[mapKey] = {
      current: unit.stats?.hp ?? unit.hp ?? 100,
      max:     unit.stats?.hp ?? unit.hp ?? 100,
    };

    const hpId = `hp-${mapKey.replace(/_/g, '-')}`;

    // ── Barre de vie ──────────────────────────────────────────────────────
    const hpWrapper = document.createElement('div');
    hpWrapper.className = 'combat-hp-bar-wrapper';

    const hpBar = document.createElement('div');
    hpBar.className = 'combat-hp-bar';
    hpBar.id        = hpId;

    const hpFill = document.createElement('div');
    hpFill.className        = 'combat-hp-fill';
    hpFill.style.width      = '100%';
    hpFill.style.background = 'var(--color-green)';

    hpBar.appendChild(hpFill);
    hpWrapper.appendChild(hpBar);

    // Label HP numérique sous la barre
    const maxHp = unit.stats?.hp ?? unit.hp ?? 100;
    const hpLabel = document.createElement('div');
    hpLabel.className = 'combat-hp-label';
    hpLabel.id        = `hplabel-${mapKey.replace(/_/g, '-')}`;
    hpLabel.textContent = `${maxHp}/${maxHp}`;
    hpWrapper.appendChild(hpLabel);

    // Barre ATB (vitesse de chargement du prochain tour)
    const atbBar  = document.createElement('div');
    const atbFill = document.createElement('div');
    atbBar.className  = 'combat-atb-bar';
    atbFill.className = 'combat-atb-fill';
    atbFill.id        = `atb-fill-${mapKey.replace(/_/g, '-')}`;
    atbFill.style.width = '0%';
    atbBar.appendChild(atbFill);
    hpWrapper.appendChild(atbBar);

    // ── Fond ultime — canvas Perlin noise aux couleurs du type ─────────────
    const TYPE_COLS = {
      Feu:'#e74c3c', Eau:'#3498db', Plante:'#2ecc71', Électrik:'#f1c40f',
      Psy:'#9b59b6', Glace:'#a8d8ea', Combat:'#c0392b', Poison:'#8e44ad',
      Sol:'#d4a017', Vol:'#85c1e9', Insecte:'#a9cce3', Roche:'#7f8c8d',
      Spectre:'#6c3483', Dragon:'#1a5276', Ténèbres:'#2c3e50',
      Acier:'#95a5a6', Fée:'#f1948a', Normal:'#aab7b8',
    };
    const t1 = unit.types?.[0] ?? 'Normal';
    const t2 = unit.types?.[1] ?? t1;
    const c1 = TYPE_COLS[t1] ?? '#444';
    const c2 = TYPE_COLS[t2] ?? c1;

    const manaBg = document.createElement('div');
    manaBg.className = 'combat-mana-bg';
    manaBg.id        = `mana-bg-${mapKey.replace(/_/g, '-')}`;
    manaBg.style.height = '0%';

    // Génère un canvas Perlin noise aux 2 couleurs du type
    const noiseCanvas = this._makeNoiseCanvas(c1, c2, 72, 72);
    manaBg.style.backgroundImage = `url(${noiseCanvas})`;
    manaBg.style.backgroundSize  = 'cover';

    slot.appendChild(manaBg);  // en premier → derrière tout le reste

    slot.appendChild(hpWrapper);

    // Badges statuts (persistants)
    const statusBadges = document.createElement('div');
    statusBadges.className = 'combat-status-badges';
    statusBadges.id        = `status-badges-${mapKey.replace(/_/g, '-')}`;
    slot.appendChild(statusBadges);

    // ── Sprite ────────────────────────────────────────────────────────────
    const spriteWrapper = document.createElement('div');
    spriteWrapper.className = 'combat-sprite-wrapper';
    spriteWrapper.id        = `sprite-${mapKey.replace(/_/g, '-')}`;

    const img = document.createElement('img');
    img.src       = unit.spriteUrl ?? '';
    img.alt       = unit.name;
    img.className = 'combat-sprite';
    img.draggable = false;
    spriteWrapper.appendChild(img);
    slot.appendChild(spriteWrapper);

    // ── Objet équipé ──────────────────────────────────────────────────────
    if (unit.heldItem) {
      const item = document.createElement('span');
      item.className   = 'combat-slot-item';
      item.textContent = unit.heldItem.emoji;
      item.title       = unit.heldItem.name;
      slot.appendChild(item);
    }

    // Clic → affiche les infos du pokémon
    slot.addEventListener('click', () => this._showUnitInfo(unit, side));

    return slot;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Info pokémon au clic (stats effectives, buffs, debuffs, passifs)
  // ─────────────────────────────────────────────────────────────────────────
  _showUnitInfo(unit, side) {
    const liveUnits = side === 'player' ? this._livePlayerUnits : this._liveEnemyUnits;
    const uid       = unit.uid ?? `${unit.id}_${unit.col}_${unit.row}`;
    const live      = liveUnits?.find(u => u.uid === uid) ?? unit;

    const TYPE_COLS = {
      Feu:'#e74c3c',Eau:'#3498db',Plante:'#2ecc71',Électrik:'#f1c40f',
      Psy:'#9b59b6',Glace:'#a8d8ea',Combat:'#c0392b',Poison:'#8e44ad',
      Sol:'#d4a017',Vol:'#85c1e9',Insecte:'#a9cce3',Roche:'#7f8c8d',
      Spectre:'#6c3483',Dragon:'#1a5276',Ténèbres:'#2c3e50',
      Acier:'#95a5a6',Fée:'#f1948a',Normal:'#aab7b8',
    };
    const STATUS_ICONS = {burn:'🔥',poison:'☠️',paralyze:'⚡',freeze:'❄️',sleep:'💤',confuse:'😵',stun:'🔒'};
    const STAT_LABELS  = {atk:'⚔️ ATK',spa:'🔮 SpATK',def:'🛡 DEF',spd_def:'💎 SpDEF',spd:'👟 VIT',hp:'❤️ HP'};

    const tc = TYPE_COLS[live.types?.[0]] ?? '#888';

    // Stats effectives (base + tempMods + rageStack)
    const effStats = ['hp','atk','spa','def','spd_def','spd'].map(s => {
      const base = live[s] ?? 0;
      let val    = base;
      (live.tempMods ?? []).filter(m => m.stat === s).forEach(m => { val = Math.round(val * m.mult); });
      if (live.rageStack?.stat === s && live.rageStack.count > 0)
        val = Math.round(val * Math.pow(live.rageStack.mult, live.rageStack.count));
      return { s, base, val, up: val > base, down: val < base };
    });

    const statuses  = (live.statusEffects ?? []).map(st =>
      `<span class="cinfo-status">${STATUS_ICONS[st.type]??'●'}${(st.stacks??1)>1?`×${st.stacks}`:''}</span>`
    ).join('') || '<span class="cinfo-none">Aucun</span>';

    const passives  = (live._passives ?? (live._passive ? [live._passive] : []));
    const passHtml  = passives.length
      ? passives.map(p => `<div class="cinfo-passive"><b>✨ ${p.name}</b> — ${p.desc}</div>`).join('')
      : '<span class="cinfo-none">Aucun</span>';

    const mods      = (live.tempMods ?? []).filter(m => m.mult !== 1);
    const modsHtml  = mods.length
      ? mods.map(m => {
          const pct = Math.round(Math.abs(m.mult - 1) * 100);
          return `<span class="cinfo-mod ${m.mult>1?'up':'down'}">${STAT_LABELS[m.stat]??m.stat} ${m.mult>1?'▲':'▼'}${pct}%</span>`;
        }).join('')
      : '<span class="cinfo-none">Aucun</span>';

    const hpPct   = live.maxHp > 0 ? Math.round((live.hp / live.maxHp) * 100) : 0;
    const hpColor = hpPct > 60 ? '#55efc4' : hpPct > 30 ? '#f39c12' : '#fc5c65';

    const overlay = document.getElementById('overlay-combat');
    overlay?.querySelector('.combat-unit-info')?.remove();

    const panel = document.createElement('div');
    panel.className = 'combat-unit-info';
    panel.innerHTML = `
      <div class="cinfo-header" style="border-left-color:${tc}">
        <img src="${live.spriteUrl??''}" class="cinfo-sprite" onerror="this.style.display='none'">
        <div class="cinfo-title-block">
          <div class="cinfo-name">${live.name}</div>
          <div class="cinfo-types">${(live.types??[]).map(t=>
            `<span class="cinfo-type" style="background:${TYPE_COLS[t]??'#888'}">${t}</span>`).join('')}</div>
        </div>
        <button class="cinfo-close btn-close">✕</button>
      </div>

      <div class="cinfo-hp-wrap">
        <div class="cinfo-hp-track"><div class="cinfo-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
        <span class="cinfo-hp-label" style="color:${hpColor}">${live.hp}/${live.maxHp}</span>
      </div>

      ${live.mana !== undefined ? `
      <div class="cinfo-mana-wrap">
        <div class="cinfo-mana-track"><div class="cinfo-mana-fill" style="width:${Math.min(100,live.mana??0)}%"></div></div>
        <span class="cinfo-mana-label">🔮 ${Math.round(live.mana??0)}/100</span>
      </div>` : ''}

      <div class="cinfo-section">📊 Stats effectives</div>
      <div class="cinfo-stats">
        ${effStats.map(({s,val,up,down})=>`
          <div class="cinfo-stat-row ${up?'up':down?'down':''}">
            <span>${STAT_LABELS[s]??s}</span>
            <span class="cinfo-stat-val">${val}</span>
          </div>`).join('')}
      </div>

      <div class="cinfo-section">⚡ Statuts</div>
      <div class="cinfo-row">${statuses}</div>

      <div class="cinfo-section">🔄 Buffs / Débuffs</div>
      <div class="cinfo-row">${modsHtml}</div>

      <div class="cinfo-section">✨ Passifs</div>
      <div class="cinfo-passives-list">${passHtml}</div>
    `;

    panel.querySelector('.cinfo-close')?.addEventListener('click', () => panel.remove());
    // Ferme aussi si on clique en dehors
    setTimeout(() => {
      const close = (e) => { if (!panel.contains(e.target)) { panel.remove(); document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 100);
    overlay?.appendChild(panel);
  },

  // ─────────────────────────────────────────────────────────────────────────
  _bindStartButton() {
    const btn = document.getElementById('btn-start-combat');
    if (!btn) return;

    btn.addEventListener('click', () => {
      // Stoppe l'écoute des changements d'équipe
      if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }

      // Relit les unités joueur depuis le registre au dernier instant
      this._playerUnits = this._registry.get('playerUnits') ?? this._playerUnits;

      btn.disabled    = true;
      btn.textContent = 'Combat en cours...';

      const hint = document.getElementById('combat-hint-text');
      if (hint) hint.style.display = 'none';

      const phase = document.getElementById('combat-phase-text');
      if (phase) phase.textContent = 'Combat en cours...';

      this._startCombat();
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  _startCombat() {
    const mapIndex    = this._data.mapIndex ?? 0;
    const baseMult    = getEnemyMultiplier(mapIndex);
    // Multiplicateur de difficulté (persistant via meta save)
    const diffId      = SaveManager.getDifficulty() ?? 'normal';
    const diffMults   = { easy: 0.8, normal: 1.0, hard: 1.3, expert: 1.7 };
    const diffMult    = diffMults[diffId] ?? 1.0;
    const mult        = baseMult * diffMult;

    // ── Joueur : item stats + synergy stats ──────────────────────────────
    const playerSynergies = getActiveSynergies(this._playerUnits);
    const meta = SaveManager.loadMeta() ?? {};
    const playerForEngine = this._playerUnits.map(u => {
      const full = getFullStats(u, this._playerUnits, meta);
      return { ...u, attributes: u.attributes ?? [], stats: full.withSynergy };
    });

    // ── Ennemi : stats de base en facile/normal, mult seulement en hard/expert
    // En facile/normal les stats sont celles du pokémon sans modification
    const applyMult = (diffId === 'hard' || diffId === 'expert');
    const enemyForEngine = this._enemyUnits.map(u => {
      if (!u.stats) return { ...u, attributes: u.attributes ?? [] };
      const scaledStats = applyMult
        ? Object.fromEntries(
            Object.entries(u.stats).map(([k, v]) => [k, Math.round(v * mult)])
          )
        : { ...u.stats };  // stats de base pures en facile/normal
      return { ...u, attributes: u.attributes ?? [], stats: scaledStats };
    });
    const enemySynergies = getActiveSynergies(enemyForEngine);

    // Injecte les niveaux dans les unités joueur (meta déjà déclaré plus haut)
    const withLevels = units => units.map(u => ({
      ...u, _level: meta.pokemonLevels?.[u.id] ?? 1,
    }));
    const activeTalentEffects = this._getActiveTalentEffects(meta, playerForEngine);

    const engine = new CombatEngine(
      withLevels(playerForEngine), withLevels(enemyForEngine),
      playerSynergies, enemySynergies
    );
    engine._playerTalents = activeTalentEffects;
    engine._enemyTalents  = [];
    const { log, winner } = engine.resolve();
    // Stocke les unités finales du moteur pour l'overlay info
    this._livePlayerUnits = engine.playerUnits;
    this._liveEnemyUnits  = engine.enemyUnits;

    this._animateLog(log, 0, () => this._onCombatEnd(winner, log));
  },

  // ─────────────────────────────────────────────────────────────────────────
  _animateLog(log, index, onComplete) {
    if (index >= log.length) { onComplete(); return; }
    const delay = Math.round(this._handleEvent(log[index]) / this._speed);
    setTimeout(() => this._animateLog(log, index + 1, onComplete), delay);
  },

  // ─────────────────────────────────────────────────────────────────────────
  _handleEvent(event) {
    // Alimente le journal de combat
    this._logEvent(event);

    switch (event.type) {
      case 'turn_start': {
        // L'unité qui agit est "next" → barre dorée, reset après action
        if (event.unitId) {
          const actKey = this._buildKey(event.unitSide ?? 'player', event.unitId);
          // Reset sa barre à 0 (elle vient d'agir)
          this._updateATBBar(actKey, 0, true);
          // Repasse toutes les autres barres en mauve
          this._setNextActor(event.unitId, event.unitSide ?? 'player');
        }
        this._appendLog(`<span class="log-turn">⚡ ${event.unitName ?? 'Pokémon'} agit</span>`);
        return DELAY_TURN_START;
      }

      case 'attack': {
        const attackerKey = this._buildKey(event.attackerSide, event.attackerId);
        const targetKey   = this._buildKey(event.targetSide,   event.targetId);
        if (event.attackerMana !== undefined) this._updateManaBar(attackerKey, event.attackerMana);
        if (event.targetMana   !== undefined) this._updateManaBar(targetKey,   event.targetMana);
        if (event.attackerAtb  !== undefined) this._updateATBBar(attackerKey, event.attackerAtb);
        if (event.targetAtb    !== undefined) this._updateATBBar(targetKey,   event.targetAtb);
        this._flashSlot(attackerKey, 'flash-yellow');
        if (event.isMove) this._showMoveAnimation(attackerKey, event.moveName ?? '');
        setTimeout(() => {
          this._flashSlot(targetKey, 'flash-red');
          this._updateHpBar(targetKey, event.targetHpLeft, event.targetMaxHp);
          this._showDamageText(targetKey, event.damage, event.typeMult);
        }, 100);
        return event.isMove ? 350 : DELAY_ATTACK;
      }

      case 'ultimate_start': {
        const attackerKey = this._buildKey(event.attackerSide, event.attackerId);
        this._showMoveAnimation(attackerKey, event.moveName ?? '');
        this._updateManaBar(attackerKey, 0);
        return 200;
      }

      case 'stat_change': {
        const key = this._buildKey(event.side, event.who);
        this._showStatChange(key, event.label, event.color);
        // Met à jour le badge permanent
        this._addStatBadge(key, event.stat, event.mult, event.color, event.label);
        return 90;
      }

      case 'coins_bonus':
        this._showRewardAnimation(`+${event.amount} 💰`);
        return 80;

      case 'unit_fainted': {
        const key = this._buildKey(event.unitSide, event.unitId);
        this._fadeOutSlot(key);
        return DELAY_FAINTED;
      }

      case 'combat_end':
        return DELAY_COMBAT_END;

      // ── Effets de statut pré-combat ─────────────────────────────────────
      case 'pre_combat': {
        const targetKey = this._buildKey(event.targetSide, event.targetId);
        if (event.damage) {
          this._updateHpBar(targetKey, event.targetHpLeft, event.targetMaxHp);
          this._showDamageText(targetKey, event.damage, 1);
        }
        this._showEffectLabel(targetKey, event.label ?? '');
        return 80;
      }

      case 'status_applied': {
        const targetKey = this._buildKey(event.targetSide, event.targetId);
        this._showEffectLabel(targetKey, event.label ?? '');
        // Reconstruit les badges à partir des statuts actifs trackés
        const unitStatuses = this._statusTracker[targetKey] ?? new Set();
        if (event.effect && event.effect !== 'untargetable' && event.effect !== 'transform' && event.effect !== 'shield')
          unitStatuses.add(event.effect);
        this._statusTracker[targetKey] = unitStatuses;
        this._updateStatusBadges(targetKey, [...unitStatuses]);
        return 60;
      }

      case 'status_cleared': {
        const targetKey = this._buildKey(event.targetSide, event.targetId);
        const unitStatuses = this._statusTracker[targetKey] ?? new Set();
        unitStatuses.delete(event.effect);
        this._statusTracker[targetKey] = unitStatuses;
        this._updateStatusBadges(targetKey, [...unitStatuses]);
        return 40;
      }

      // ── Dégâts de statut / soin en fin de tour ────────────────────────
      case 'effect_damage': {
        const targetKey = this._buildKey(event.targetSide, event.targetId);
        this._updateHpBar(targetKey, event.targetHpLeft, event.targetMaxHp);
        const color = event.effect === 'burn' ? '#ff8c00' :
                      event.effect === 'poison' ? '#a040a0' :
                      event.effect === 'curse'  ? '#705898' : '#ff4444';
        this._showStatusDamage(targetKey, event.damage, color, event.label);
        if (event.targetHpLeft <= 0) this._fadeOutSlot(targetKey);
        return 120;
      }

      case 'effect_heal': {
        const targetKey = this._buildKey(event.targetSide, event.targetId);
        this._updateHpBar(targetKey, event.targetHpLeft, event.targetMaxHp);
        this._showHealText(targetKey, event.heal, event.label);
        return 100;
      }

      // ── Attaque ratée / bloquée / skippée ────────────────────────────
      case 'attack_skipped': {
        const key = this._buildKey(event.attackerSide, event.attackerId);
        const label = event.reason === 'paralyze' ? '⚡ Paralysé !' : '❄️ Gelé !';
        this._showEffectLabel(key, label);
        return 80;
      }

      case 'attack_missed': {
        const key = this._buildKey(event.targetSide, event.targetId);
        this._showEffectLabel(key, '🦅 Esquivé !');
        return 80;
      }

      case 'attack_blocked': {
        const key = this._buildKey(event.targetSide, event.targetId);
        this._showEffectLabel(key, '🛡 Armure !');
        return 80;
      }

      case 'passive_trigger': {
        const icon = {fury:'🔥',ramp:'⬆',rage:'😤',metronome:'🎲',boost:'⭐'}[event.effect]??'✨';
        this._appendLog(`<span class="log-passive">${icon} ${event.label}</span>`);
        return 50;
      }
      default:
        return 50;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  _buildKey(side, pokemonId) {
    const units = side === 'player' ? this._playerUnits : this._enemyUnits;
    // pokemonId peut être un uid complet (effet de tour) ou un id simple (attaque)
    // On cherche d'abord par uid exact, puis par id
    const byUid = units.find(u => {
      const uid = u.uid ?? `${u.id}_${u.col}_${u.row}`;
      return uid === pokemonId || uid === String(pokemonId);
    });
    if (byUid) {
      const uid = byUid.uid ?? `${byUid.id}_${byUid.col}_${byUid.row}`;
      return `${side}_${uid}`;
    }
    const byId = units.find(u => u.id === pokemonId || String(u.id) === String(pokemonId));
    if (byId) {
      const uid = byId.uid ?? `${byId.id}_${byId.col}_${byId.row}`;
      return `${side}_${uid}`;
    }
    return `${side}_${pokemonId}`;
  },

  // ─────────────────────────────────────────────────────────────────────────
  _flashSlot(key, animClass) {
    const slot = this._slots[key];
    if (!slot) return;
    slot.classList.add(animClass);
    setTimeout(() => slot.classList.remove(animClass), 350);
  },

  _showDamageText(key, damage, typeMult) {
    const slot = this._slots[key];
    if (!slot) return;
    const color = typeMult >= 2 ? '#ff4444' : typeMult <= 0.5 ? '#aaaaaa' : '#ffffff';
    const txt = document.createElement('div');
    txt.className   = 'damage-text';
    txt.textContent = `-${damage}`;
    txt.style.color = color;
    slot.appendChild(txt);
    setTimeout(() => txt.remove(), 950);
  },

  _fadeOutSlot(key) {
    const slot = this._slots[key];
    if (!slot) return;
    slot.classList.add('fainted');
  },

  _updateHpBar(key, hpLeft, maxHp) {
    const hpId  = `hp-${key.replace(/_/g, '-')}`;
    const barEl = document.getElementById(hpId);
    const fill  = barEl?.querySelector('.combat-hp-fill');
    if (!fill) return;
    const ratio = Math.max(0, Math.min(1, hpLeft / maxHp));
    const color = ratio > 0.5 ? 'var(--color-green)' : ratio > 0.25 ? '#ffaa00' : 'var(--color-red)';
    fill.style.width      = `${(ratio * 100).toFixed(1)}%`;
    fill.style.background = color;
    this._hpState[key] = { current: hpLeft, max: maxHp };

    // Label numérique
    const labelEl = document.getElementById(`hplabel-${key.replace(/_/g, '-')}`);
    if (labelEl) labelEl.textContent = `${Math.max(0, hpLeft)}/${maxHp}`;
  },

  // Calcule les effets de talents actifs selon la meta et l'équipe
  _getActiveTalentEffects(meta, playerUnits) {
    if (!meta?.talentTree) return [];
    const effects = [];
    // Importe dynamiquement (synchrone ici car déjà chargé)
    const TALENT_TREES = window.__TALENT_TREES__;
    if (!TALENT_TREES) return [];  // fallback si pas encore chargé
    Object.entries(meta.talentTree).forEach(([type, unlockedArr]) => {
      const tree = TALENT_TREES[type];
      if (!tree) return;
      tree.forEach((node, i) => {
        if (unlockedArr[i]) effects.push({ ...node.effect, _name: node.name });
      });
    });
    return effects;
  },

  // Met à jour la barre ATB — dorée si c'est le prochain à jouer, mauve sinon
  // Construit les stats de récap depuis le log de combat
  _buildCombatRecap(log) {
    const stats = {};
    const addStat = (uid, name, side, key, val) => {
      if (!stats[uid]) stats[uid] = { uid, name, side, dmg:0, heal:0, ko:0, passiveNote:null };
      stats[uid][key] = (stats[uid][key] ?? 0) + val;
    };
    log.forEach(ev => {
      if (ev.type === 'attack' && !ev.effect) {
        addStat(ev.attackerId, ev.attackerName, ev.attackerSide, 'dmg', ev.damage ?? 0);
      }
      if (ev.type === 'effect_heal') {
        addStat(ev.targetId, ev.targetName, ev.targetSide, 'heal', ev.heal ?? 0);
      }
      if (ev.type === 'faint') {
        const lastAtk = [...log].reverse().find(
          e => e.type === 'attack' && e.targetId === ev.targetId
        );
        if (lastAtk) addStat(lastAtk.attackerId, lastAtk.attackerName, lastAtk.attackerSide, 'ko', 1);
      }
      // Passifs spéciaux : Métronome + Transformation
      if (ev.type === 'pre_combat' && (ev.effect === 'metronome' || ev.effect === 'boost_from_strongest')) {
        if (!stats[ev.targetId]) stats[ev.targetId] = { uid:ev.targetId, name:ev.targetName,
          side:ev.targetSide, dmg:0, heal:0, ko:0, passiveNote:null };
        stats[ev.targetId].passiveNote = ev.label;
      }
    });
    const all    = Object.values(stats);
    const player = all.filter(r => r.side === 'player').sort((a,b) => b.dmg - a.dmg);
    const enemy  = all.filter(r => r.side === 'enemy').sort((a,b) => b.dmg - a.dmg);
    return { player, enemy };
  },

  _recapRow(r) {
    return `
      <div class="recap-row">
        <span class="recap-name">${r.name}</span>
        <span class="recap-stat dmg" title="Dégâts infligés">⚔️ ${r.dmg}</span>
        ${r.heal > 0 ? `<span class="recap-stat heal" title="Soins">💚 ${r.heal}</span>` : ''}
        ${r.ko   > 0 ? `<span class="recap-stat ko"   title="K.O. infligés">💀 ${r.ko}</span>` : ''}
        ${r.passiveNote ? `<div class="recap-passive-note">${r.passiveNote}</div>` : ''}
      </div>`;
  },

  _updateATBBar(key, atb, isNext = false) {
    const fill = document.getElementById(`atb-fill-${key.replace(/_/g, '-')}`);
    if (!fill) return;
    fill.style.width      = `${Math.max(0, Math.min(100, atb))}%`;
    fill.style.background = isNext
      ? 'linear-gradient(90deg, #f39c12, #ffd700)'    // dorée = prochain
      : 'linear-gradient(90deg, #6c5ce7, #a29bfe)';   // mauve = en attente
  },

  // Marque l'acteur courant en doré, repasse les autres en mauve
  _setNextActor(unitId, side) {
    Object.entries(this._slots).forEach(([key]) => {
      const fill = document.getElementById(`atb-fill-${key.replace(/_/g, '-')}`);
      if (!fill) return;
      const isThis = key === this._buildKey(side, unitId);
      fill.style.background = isThis
        ? 'linear-gradient(90deg, #f39c12, #ffd700)'
        : 'linear-gradient(90deg, #6c5ce7, #a29bfe)';
    });
  },

  // ── Génère un canvas de bruit (Perlin simplifié) aux 2 couleurs du type ──
  // Retourne une dataURL utilisable comme backgroundImage
  _makeNoiseCanvas(hex1, hex2, w = 72, h = 72) {
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);

    // Parse hex → RGB
    const hexToRgb = hex => {
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      return [r, g, b];
    };
    const [r1,g1,b1] = hexToRgb(hex1);
    const [r2,g2,b2] = hexToRgb(hex2);

    // PRNG déterministe (Mulberry32) pour reproductibilité
    let seed = (r1 * 31 + g1 * 17 + b1 * 7 + r2 * 13) >>> 0;
    const rand = () => {
      seed += 0x6D2B79F5;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    // Bruit de valeur simple (smooth noise) sur grille 8×8
    const GRID = 8;
    const noise = [];
    for (let gy = 0; gy <= GRID; gy++) {
      noise[gy] = [];
      for (let gx = 0; gx <= GRID; gx++) noise[gy][gx] = rand();
    }
    const smooth = (t) => t * t * (3 - 2 * t);
    const lerp   = (a, b, t) => a + (b - a) * t;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fx = x / w * GRID;
        const fy = y / h * GRID;
        const gx = Math.floor(fx);
        const gy = Math.floor(fy);
        const tx = smooth(fx - gx);
        const ty = smooth(fy - gy);
        const v  = lerp(
          lerp(noise[gy][gx],   noise[gy][gx+1],   tx),
          lerp(noise[gy+1]?.[gx] ?? 0, noise[gy+1]?.[gx+1] ?? 0, tx),
          ty
        );
        // Mélange les 2 couleurs selon la valeur de bruit
        const i = (y * w + x) * 4;
        img.data[i+0] = Math.round(lerp(r1, r2, v));
        img.data[i+1] = Math.round(lerp(g1, g2, v));
        img.data[i+2] = Math.round(lerp(b1, b2, v));
        img.data[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  },

  _updateManaBar(key, mana) {
    const bg = document.getElementById(`mana-bg-${key.replace(/_/g, '-')}`);
    if (!bg) return;
    const pct = Math.max(0, Math.min(100, mana));
    bg.style.height = `${pct}%`;
  },

  _updateStatusBadges(key, effects = []) {
    const container = document.getElementById(`status-badges-${key.replace(/_/g, '-')}`);
    if (!container) return;
    container.innerHTML = '';
    const STATUS_EMOJIS = {
      burn:'🔥', poison:'☠️', paralyze:'⚡', freeze:'❄️',
      sleep:'💤', confuse:'😵', stun:'🔒',
    };
    effects.forEach(eff => {
      if (!STATUS_EMOJIS[eff]) return;
      const badge = document.createElement('span');
      badge.className   = 'status-badge';
      badge.textContent = STATUS_EMOJIS[eff];
      badge.title       = eff;
      container.appendChild(badge);
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  _onCombatEnd(winner, log = []) {
    const isWin = winner === 'player';

    const phase = document.getElementById('combat-phase-text');
    if (phase) phase.textContent = isWin ? '🏆 Victoire !' : '💀 Défaite...';

    // Gain de niveau pour les pokémons survivants après une victoire
    if (isWin && SaveManager) {
      const playerUnits = this._registry.get('playerUnits') ?? [];
      const levelUps    = [];
      playerUnits.forEach(u => {
        if (!u.id) return;
        const result = SaveManager.gainPokemonLevel(u.id);
        if (result.gained) {
          levelUps.push({ name: u.name, level: result.newLevel, id: u.id });
        }
      });
      if (levelUps.length > 0) {
        this._showLevelUps(levelUps);
      }
    }

    if (isWin) {
      addCoins(this._registry, 3);
      this._showRewardAnimation('+3 💰');
    }

    const screen = document.getElementById('overlay-combat');
    if (!screen) return;
    screen.querySelector('.combat-result-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'combat-result-overlay';

    const box = document.createElement('div');
    box.className = 'combat-result-box';

    const title = document.createElement('p');
    title.className   = `combat-result-title ${isWin ? 'win' : 'lose'}`;
    title.textContent = isWin ? '🏆 Victoire !' : '💀 Défaite...';
    box.appendChild(title);

    // ── Récap de combat (dégâts/soins par pokémon) ──────────────────────────
    const recap = this._buildCombatRecap(log);
    if (recap.player.length + recap.enemy.length > 0) {
      const recapEl = document.createElement('div');
      recapEl.className = 'combat-recap';
      recapEl.innerHTML = `
        <div class="recap-title">📊 Récap du combat</div>
        <div class="recap-cols">
          <div class="recap-side">
            <div class="recap-side-label ${isWin ? 'win' : 'lose'}">
              ${isWin ? '🏆 Votre équipe' : '💀 Votre équipe'}
            </div>
            ${recap.player.map(r => this._recapRow(r)).join('')}
          </div>
          <div class="recap-side">
            <div class="recap-side-label ${isWin ? 'lose' : 'win'}">
              ${isWin ? '💀 Adversaire' : '🏆 Adversaire'}
            </div>
            ${recap.enemy.map(r => this._recapRow(r)).join('')}
          </div>
        </div>
      `;
      box.appendChild(recapEl);
    }

    // Journal de combat scrollable
    if (this._combatLog.length > 0) {
      const logSection = document.createElement('div');
      logSection.className = 'combat-result-log';
      logSection.innerHTML = `
        <div class="log-title">📋 Journal de combat</div>
        ${this._combatLog.map(l => `<div class="log-line">${l}</div>`).join('')}
      `;
      box.appendChild(logSection);
    }

    const btn = document.createElement('button');
    btn.className   = 'btn-primary btn-large';
    btn.textContent = isWin
      ? (this._data.nodeType === 'boss' ? '🏆 Badge obtenu !' : '➡ Continuer')
      : '↩ Retour au menu';

    btn.addEventListener('click', () => {
      overlay.remove();
      if (this._onDone) {
        this._onDone({
          winner,
          nodeType:  this._data.nodeType  ?? 'combat',
          mapIndex:  this._data.mapIndex  ?? 0,
          mapNodes:  this._data.mapNodes  ?? null,
          startNode: this._data.startNode ?? null,
        });
      }
    });

    box.appendChild(btn);
    overlay.appendChild(box);
    screen.appendChild(overlay);
  },

  _showLevelUps(levelUps) {
    // Affiche une notification de level up pour chaque pokémon
    levelUps.forEach((lu, i) => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'level-up-toast';
        const color = getLevelColor(lu.level);
        el.innerHTML = `<span style="color:${color}">⬆ ${lu.name} → Nv.${lu.level}</span>`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
      }, i * 300);
    });
  },

  _showRewardAnimation(text) {
    // Ancre l'animation sous #ui-coins dans le header (les pièces entrent dans la bourse)
    const coinsEl = document.getElementById('ui-coins');
    const target  = coinsEl ?? document.body;

    const reward = document.createElement('div');
    reward.className   = 'combat-reward';
    reward.textContent = text;

    if (coinsEl) {
      // Positionnement sous l'élément coins
      const rect = coinsEl.getBoundingClientRect();
      reward.style.position = 'fixed';
      reward.style.left     = `${rect.left + rect.width / 2}px`;
      reward.style.top      = `${rect.bottom + 4}px`;
      reward.style.transform = 'translateX(-50%)';
      document.body.appendChild(reward);
    } else {
      document.getElementById('overlay-combat')?.appendChild(reward);
    }

    setTimeout(() => reward.remove(), 1700);
  },

  // ── Helpers visuels pour les nouveaux événements ─────────────────────────
  _showEffectLabel(key, text) {
    const slot = this._slots[key];
    if (!slot) return;
    const el = document.createElement('div');
    el.className   = 'effect-label';
    el.textContent = text;
    slot.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  _showStatusDamage(key, damage, color, label = '') {
    const slot = this._slots[key];
    if (!slot) return;
    const el = document.createElement('div');
    el.className   = 'damage-text';
    el.textContent = `${label} -${damage}`;
    el.style.color = color;
    slot.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },

  _showHealText(key, heal, label = '') {
    const slot = this._slots[key];
    if (!slot) return;
    const el = document.createElement('div');
    el.className   = 'heal-text';
    el.textContent = `${label} +${heal}`;
    slot.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },

  // ── Journal de combat ────────────────────────────────────────────────────
  _logEvent(event) {
    const t = event.type;
    if (t === 'attack') {
      const mover = event.isMove ? `<span class="log-move">⚡${event.moveName}</span> ` : '';
      const eff   = event.typeMult >= 2 ? ' <span class="log-super">super efficace!</span>'
                  : event.typeMult <= 0.5 ? ' <span class="log-weak">peu efficace</span>' : '';
      const crit  = event.isCrit ? ' <span class="log-crit">critique!</span>' : '';
      this._appendLog(
        `${event.attackerName} → ${event.targetName}: ${mover}<b>-${event.damage} PV</b>${eff}${crit}`
      );
    } else if (t === 'status_applied') {
      const stacks = event.stacks > 1 ? ` ×${event.stacks}` : '';
      this._appendLog(`<span class="log-status">${event.label}${stacks}</span> sur ${event.targetName}`);
    } else if (t === 'effect_damage') {
      this._appendLog(
        `<span class="log-status">${event.label}</span> ${event.targetName}: <b>-${event.damage} PV</b>`
      );
    } else if (t === 'effect_heal') {
      this._appendLog(
        `<span class="log-heal">${event.label}</span> ${event.targetName}: <b>+${event.heal} PV</b>`
      );
    } else if (t === 'unit_fainted') {
      this._appendLog(`<span class="log-faint">💀 ${event.unitName} est K.O. !</span>`);
    } else if (t === 'ultimate_start') {
      this._appendLog(
        `<span class="log-move">⚡ ${event.attackerSide === 'player' ? '🔵' : '🔴'} ${event.moveName} !</span>`
      );
    } else if (t === 'attack_skipped') {
      this._appendLog(`${event.attackerSide === 'player' ? '🔵' : '🔴'} <i>${event.label}</i>`);
    } else if (t === 'attack_missed') {
      this._appendLog(`<i>${event.label}</i>`);
    } else if (t === 'stat_change') {
      this._appendLog(
        `<span style="color:${event.color}">${event.label}</span>`
      );
    } else if (t === 'combat_end') {
      const winner = event.winner === 'player' ? '🏆 Victoire !' : '💀 Défaite';
      this._appendLog(`<b>${winner}</b> (tour ${(event.turn ?? 0) + 1})`);
      // Affiche le journal
      const logZone = document.getElementById('combat-log-zone');
      if (logZone) {
        logZone.innerHTML = `<div class="log-title">📋 Journal de combat</div>` +
          this._combatLog.map(l => `<div class="log-line">${l}</div>`).join('');
        logZone.classList.remove('hidden');
      }
    }
  },

  _appendLog(html) {
    this._combatLog.push(html);
  },

  _addStatBadge(key, stat, mult, color, label) {
    const slot = this._slots[key];
    if (!slot) return;
    const isBuff = mult > 1;
    const side   = isBuff ? 'buffs' : 'debuffs';

    // Conteneurs séparés : buffs à gauche, débuffs à droite
    let container = slot.querySelector(`.combat-stat-${side}`);
    if (!container) {
      container = document.createElement('div');
      container.className = `combat-stat-side combat-stat-${side}`;
      slot.appendChild(container);
    }

    // Badge par stat (mis à jour si déjà présent)
    let badge = container.querySelector(`[data-stat="${stat}"]`);
    if (!badge) {
      badge = document.createElement('span');
      badge.className    = 'combat-stat-badge-perm';
      badge.dataset.stat = stat;
      container.appendChild(badge);
    }
    badge.textContent = label;
    badge.style.color = color;
  },

  _showMoveAnimation(key, moveName) {
    const slot = this._slots[key];
    if (!slot) return;
    // Flash doré + label du move
    const el = document.createElement('div');
    el.className   = 'combat-ultimate-anim';
    el.textContent = `⚡ ${moveName}`;
    slot.appendChild(el);
    setTimeout(() => el.remove(), 900);
    // Anneau lumineux
    slot.classList.add('ultimate-glow');
    setTimeout(() => slot.classList.remove('ultimate-glow'), 600);
  },

  _showStatChange(key, label, color) {
    const slot = this._slots[key];
    if (!slot) return;
    const el = document.createElement('div');
    el.className   = 'combat-stat-change';
    el.textContent = label;
    el.style.color = color ?? '#fff';
    slot.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },

  _getTrainerSpritePath() {
    if (this._data.nodeType === 'boss') {
      const arena = getArenaForMap(this._data.mapIndex ?? 0);
      return arena?.championSpriteCombat ?? null;
    }
    if (this._data.trainerArchetypeId) {
      return `assets/trainers/combat/${this._data.trainerArchetypeId}_c.png`;
    }
    return null;
  },
};