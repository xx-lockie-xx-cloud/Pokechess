// ─────────────────────────────────────────────────────────────────────────────
// CombatUI.js
// ─────────────────────────────────────────────────────────────────────────────

import { CombatEngine, STAT_EMOJIS }           from '../combat/CombatEngine.js';
import { getMove }                             from '../data/moves.js';
import { addCoins, getEnemyMultiplier }     from '../data/runState.js';
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

    // Bouton lancer
    const btn = document.createElement('button');
    btn.className   = 'btn-danger btn-large';
    btn.id          = 'btn-start-combat';
    btn.textContent = '⚔ Lancer le combat';
    wrapper.appendChild(btn);
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

    // Barre mana
    const manaBar  = document.createElement('div');
    const manaFill = document.createElement('div');
    manaBar.className  = 'combat-mana-bar';
    manaFill.className = 'combat-mana-fill';
    manaFill.id        = `mana-fill-${mapKey.replace(/_/g, '-')}`;
    manaFill.style.width = '0%';
    manaBar.appendChild(manaFill);
    hpWrapper.appendChild(manaBar);

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

    // ── Nom (overlay en bas du slot) ──────────────────────────────────────
    const name = document.createElement('span');
    name.className   = 'combat-slot-name';
    name.textContent = unit.name;
    slot.appendChild(name);

    // ── Objet équipé ──────────────────────────────────────────────────────
    if (unit.heldItem) {
      const item = document.createElement('span');
      item.className   = 'combat-slot-item';
      item.textContent = unit.heldItem.emoji;
      item.title       = unit.heldItem.name;
      slot.appendChild(item);
    }

    return slot;
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
    const mapIndex = this._data.mapIndex ?? 0;
    const mult     = getEnemyMultiplier(mapIndex);

    // ── Joueur : item stats + synergy stats ──────────────────────────────
    const playerSynergies = getActiveSynergies(this._playerUnits);
    const playerForEngine = this._playerUnits.map(u => {
      const full = getFullStats(u, this._playerUnits);
      return { ...u, attributes: u.attributes ?? [], stats: full.withSynergy };
    });

    // ── Ennemi : multiplicateur map + synergies ennemies ──────────────────
    const enemyForEngine = this._enemyUnits.map(u => {
      if (!u.stats) return { ...u, attributes: u.attributes ?? [] };
      const scaledStats = Object.fromEntries(
        Object.entries(u.stats).map(([k, v]) => [k, Math.round(v * mult)])
      );
      return { ...u, attributes: u.attributes ?? [], stats: scaledStats };
    });
    const enemySynergies = getActiveSynergies(enemyForEngine);

    const engine          = new CombatEngine(playerForEngine, enemyForEngine, playerSynergies, enemySynergies);
    const { log, winner } = engine.resolve();

    this._animateLog(log, 0, () => this._onCombatEnd(winner));
  },

  // ─────────────────────────────────────────────────────────────────────────
  _animateLog(log, index, onComplete) {
    if (index >= log.length) { onComplete(); return; }
    const delay = this._handleEvent(log[index]);
    setTimeout(() => this._animateLog(log, index + 1, onComplete), delay);
  },

  // ─────────────────────────────────────────────────────────────────────────
  _handleEvent(event) {
    switch (event.type) {
      case 'turn_start':
        return DELAY_TURN_START;

      case 'attack': {
        const attackerKey = this._buildKey(event.attackerSide, event.attackerId);
        const targetKey   = this._buildKey(event.targetSide,   event.targetId);
        if (event.attackerMana !== undefined) this._updateManaBar(attackerKey, event.attackerMana);
        if (event.targetMana   !== undefined) this._updateManaBar(targetKey,   event.targetMana);
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

  _updateManaBar(key, mana) {
    const fill = document.getElementById(`mana-fill-${key.replace(/_/g, '-')}`);
    if (!fill) return;
    const pct = Math.max(0, Math.min(100, mana));
    fill.style.width = `${pct}%`;
    if (pct >= 100) fill.classList.add('mana-ready');
    else fill.classList.remove('mana-ready');
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
  _onCombatEnd(winner) {
    const isWin = winner === 'player';

    const phase = document.getElementById('combat-phase-text');
    if (phase) phase.textContent = isWin ? '🏆 Victoire !' : '💀 Défaite...';

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