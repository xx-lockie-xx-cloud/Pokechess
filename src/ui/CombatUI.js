// ─────────────────────────────────────────────────────────────────────────────
// CombatUI.js
// ─────────────────────────────────────────────────────────────────────────────

import { CombatEngine, STAT_EMOJIS }           from '../combat/CombatEngine.js';
import { TYPE_COLORS } from '../data/pokemons.js';
import { getMove }                             from '../data/moves.js';
import { getLevelColor, getLevelBadgeHTML }     from '../data/levelSystem.js';
import { addCoins, getEnemyMultiplier, getRunState } from '../data/runState.js';
import { RelicEngine }                                 from '../combat/RelicEngine.js';
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
  _atbDisplay:  {},     // valeur affichée (0-100) de chaque barre ATB par clé
  _atbSpeed:    {},     // vitesse ATB (100 + spd) de chaque unité par clé
  _atbRaf:      null,   // handle requestAnimationFrame de l'animation en cours

  // ─────────────────────────────────────────────────────────────────────────
  init(data, registry, onDone) {
    // Nettoie l'éventuel listener du combat précédent
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }

    this._data          = data;
    this._registry      = registry;
    this._onDone        = onDone;
    // Applique anomalyTypes dès l'init pour que tous les affichages soient corrects
    const _anom = registry.get?.('runState')?.anomalyTypes ?? null;
    const _applyAnom = units => !_anom ? units : units.map(u =>
      _anom[u.id] ? { ...u, types: _anom[u.id] } : u
    );
    this._enemyUnits    = _applyAnom(data.enemyUnits ?? []);
    this._slots         = {};
    this._hpState       = {};
    this._statusTracker = {};
    this._speed         = 1;
    this._combatLog     = [];
    this._atbDisplay    = {};
    this._atbSpeed      = {};
    this._mapAdvanced   = false;
    this._statsRecorded = false;
    if (this._atbRaf) { cancelAnimationFrame(this._atbRaf); this._atbRaf = null; }

    // Lit toujours depuis le registre (priorité sur data.playerUnits)
    this._playerUnits = _applyAnom(registry.get('playerUnits') ?? data.playerUnits ?? []);

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

    // Bandeau info relique (Pacte de Sang, Bénédiction, Sablier, etc.)
    const relicId = this._registry?.get?.('runState')?.relic?.id;
    const RELIC_WARNINGS = {
      'pacte_de_sang': '💀 Pacte de Sang — HP ×0.8 / ATK ×1.3 pour tous',
      'benediction':   '🩹 Bénédiction — HP ×1.3 / ATK ×0.75 pour tous',
      'sablier':       '⏱ Sablier — Combat limité à 25 actions par camp',
      'de_maudit':     '🎲 Dé Maudit — 1 unité de chaque camp démarre à 50% HP',
      'condensateur':  '🔋 Condensateur — Toutes les unités démarrent avec 50 mana',
      'contrat_maudit':'🩸 Contrat Maudit — HP ×0.9 pour tous',
      'revanche':      '🔁 Revanche — Ultime déclenché à la mort si mana ≥ 50',
    };
    const warning = relicId ? RELIC_WARNINGS[relicId] : null;
    if (warning) {
      const relicInfo = document.createElement('div');
      relicInfo.className   = 'combat-relic-info';
      relicInfo.textContent = warning;
      btnRow.appendChild(relicInfo);
    }

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

    // Couronne : badge 👑 sur le top BST de chaque camp
    const _relicId = this._registry?.get?.('runState')?.relic?.id;
    if (_relicId === 'couronne') {
      const campUnits = side === 'player' ? this._playerUnits : this._enemyUnits;
      const bst = u => (u.stats?.hp??0)+(u.stats?.atk??0)+(u.stats?.spa??0)+
                       (u.stats?.def??0)+(u.stats?.spd_def??0)+(u.stats?.spd??0);
      const topId = [...campUnits].sort((a,b) => bst(b)-bst(a))[0]?.id;
      if (unit && unit.id === topId) {
        const crown = document.createElement('span');
        crown.textContent = '👑';
        crown.style.cssText = 'position:absolute;top:2px;left:2px;font-size:10px;z-index:5;pointer-events:none';
        slot.appendChild(crown);
      }
    }

    // Encyclopédie : badge stats sur les ennemis
    if (side === 'enemy') {
      const relicId = this._registry?.get?.('runState')?.relic?.id;
      if (relicId === 'encyclopedie') {
        const badge = document.createElement('div');
        badge.className = 'encyclopedie-badge';
        const hp  = unit.stats?.hp  ?? unit.hp  ?? '?';
        const atk = unit.stats?.atk ?? unit.atk ?? '?';
        const spa = unit.stats?.spa ?? unit.spa ?? '?';
        const spd = unit.stats?.spd ?? unit.spd ?? '?';
        badge.innerHTML = `<span>❤️${hp}</span><span>⚔️${atk}</span><span>🔮${spa}</span><span>👟${spd}</span>`;
        slot.appendChild(badge);
      }
    }

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
    const loopCount   = getRunState ? (this._registry ? getRunState(this._registry)?.loopCount ?? 0 : 0) : 0;
    const baseMult    = getEnemyMultiplier(mapIndex, loopCount);
    // Multiplicateur de difficulté (persistant via meta save)
    const diffId      = SaveManager.getDifficulty() ?? 'normal';
    const diffMults   = { easy: 0.8, normal: 1.0, hard: 1.118, expert: 1.225 };
    const diffMult    = diffMults[diffId] ?? 1.0;
    const mult        = baseMult * diffMult;

    // ── Relique active ───────────────────────────────────────────────────
    const rs           = this._registry ? getRunState(this._registry) : {};
    const relic        = rs?.relic ?? null;
    const relicId      = relic?.id ?? null;
    const anomalyTypes = rs?.anomalyTypes ?? null;

    // ── Joueur : item stats + synergy stats ──────────────────────────────
    const rawPlayerSynergies = getActiveSynergies(
      this._playerUnits.map(u => anomalyTypes ? { ...u, types: anomalyTypes[u.id] ?? u.types } : u),
      relicId
    );
    const playerSynergies = relicId
      ? RelicEngine.modifySynergies(relicId, rawPlayerSynergies, this._playerUnits)
      : rawPlayerSynergies;
    const meta = SaveManager.loadMeta() ?? {};

    // ── Couronne : marque le top BST AVANT getFullStats (sinon le ×2 ne s'applique pas)
    // "Le plus fort" = plus haut BST avec le bonus de NIVEAU appliqué
    // (stats de base × bonus niveau, hors synergies pour éviter la circularité).
    if (relicId === 'couronne') {
      const lvlBst = (u) => {
        const lvl = meta?.pokemonLevels?.[u.id] ?? 1;
        const m   = lvl > 1 ? 1 + (lvl - 1) * 0.005 : 1;
        const s   = u.stats ?? u;
        return ((s.hp??0)+(s.atk??0)+(s.spa??0)+(s.def??0)+(s.spd_def??0)+(s.spd??0)) * m;
      };
      // Nettoie d'anciens marquages puis remarque le top de chaque camp
      this._playerUnits.forEach(u => { if (u) delete u._doubleSynergyBonus; });
      this._enemyUnits.forEach(u  => { if (u) delete u._doubleSynergyBonus; });
      const topP = [...this._playerUnits].filter(Boolean).sort((a,b) => lvlBst(b)-lvlBst(a))[0];
      const topE = [...this._enemyUnits].filter(Boolean).sort((a,b) => lvlBst(b)-lvlBst(a))[0];
      if (topP) topP._doubleSynergyBonus = true;
      if (topE) topE._doubleSynergyBonus = true;
    }

    const playerForEngine = this._playerUnits.map(u => {
      const full = getFullStats(u, this._playerUnits, meta, relicId);
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
    const enemySynergies = getActiveSynergies(enemyForEngine, relicId);

    // Niveau des passifs ennemis selon la difficulté (le STAT bonus de niveau ne
    // s'applique pas aux ennemis ; ce niveau ne sert qu'à débloquer leurs passifs).
    //   Facile/Normal : aucun passif · Difficile : Nv.35 (1er) · Expert : Nv.70 (les deux)
    const ENEMY_PASSIVE_LEVEL = { easy: 1, normal: 1, hard: 35, expert: 70 };

    const withLevels = (units, isEnemy = false) => units.map(u => {
      const lvl = isEnemy
        ? (ENEMY_PASSIVE_LEVEL[diffId] ?? 1)
        : (meta.pokemonLevels?.[u.id] ?? 1);
      let unit = { ...u, _level: lvl };
      // Anomalie : réassigne les types
      if (anomalyTypes) RelicEngine.applyAnomalyTypes(unit, anomalyTypes);
      // Modificateurs de stats de la relique (Pacte de Sang, Bénédiction, Contrat Maudit)
      if (relicId) RelicEngine.applyStatModifier(relicId, unit);
      // Passe relicId à l'unité pour getFullStats (Miroir, Couronne)
      unit._relicId = relicId;
      // Alternance de type d'attaque (bitype)
      unit._attackTypeTurn = 0;
      return unit;
    });
    const activeTalentEffects = this._getActiveTalentEffects(meta, playerForEngine);

    const engine = new CombatEngine(
      withLevels(playerForEngine), withLevels(enemyForEngine, true),
      playerSynergies, enemySynergies
    );
    engine._playerTalents = activeTalentEffects;
    engine._enemyTalents  = [];
    engine.relicId        = relicId;
    const { log, winner } = engine.resolve();
    // Stocke les unités finales du moteur pour l'overlay info
    this._livePlayerUnits = engine.playerUnits;
    this._liveEnemyUnits  = engine.enemyUnits;

    // ── Issue connue dès le calcul (combat pré-simulé) ────────────────────────
    if (winner !== 'player') {
      // Anti-exploit : défaite SCELLÉE immédiatement.
      // Quitter en cours de lecture d'un combat perdant ne permet plus de reprendre.
      this._registry?.sealRun?.();   // bloque tout autosave ultérieur
      SaveManager.deleteSave?.();    // efface la sauvegarde de run existante
    } else if (this._data?.nodeType === 'boss' && this._registry && !this._mapAdvanced) {
      // Victoire de BOSS : on avance la map DÈS le calcul (avant la lecture),
      // pour que quitter pendant la lecture reprenne bien sur la map suivante.
      this._mapAdvanced = true;
      const rs        = this._registry.get('runState') ?? {};
      const beatenIdx = this._data.mapIndex ?? rs.currentMap ?? 0;
      const nextIdx   = beatenIdx + 1;
      const isLeague  = beatenIdx >= 8;
      this._registry.set('runState', {
        ...rs,
        currentMap:   nextIdx,
        mapVisited:   [], mapAvailable: [], lastNodeCol: 0,
        infiniteMode: isLeague ? true : rs.infiniteMode,
      });
    }

    this._animateLog(log, 0, () => this._onCombatEnd(winner, log));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ATB — Option C : remplissage temps réel piloté par l'ordre du log
  // ─────────────────────────────────────────────────────────────────────────

  // Initialise les vitesses ATB (100 + spd) et remet les barres à 0
  _initATBState() {
    this._atbDisplay = {};
    this._atbSpeed   = {};
    const register = (units, side) => {
      units.filter(Boolean).forEach(u => {
        const uid = u.uid ?? `${u.id}_${u.col}_${u.row}`;
        const key = `${side}_${uid}`;
        const spd = u.stats?.spd ?? u.spd ?? 1;
        this._atbSpeed[key]   = 100 + spd;
        this._atbDisplay[key] = 0;
        this._updateATBBar(key, 0);
      });
    };
    register(this._playerUnits, 'player');
    register(this._enemyUnits,  'enemy');
  },

  // Anime toutes les barres jusqu'à ce que l'acteur atteigne 100%.
  // Les autres montent proportionnellement à leur vitesse (math ATB fidèle).
  // Appelle `done` une fois l'acteur à 100%.
  _fillATBUntil(actorKey, done) {
    const startActor = this._atbDisplay[actorKey] ?? 0;
    const spdActor   = this._atbSpeed[actorKey]   ?? 100;

    // Temps ATB nécessaire pour que l'acteur atteigne 100%
    const atbTime = Math.max(0, (100 - startActor) / spdActor);

    // Cibles : chaque unité monte de vitesse × atbTime (cappé à 100)
    const targets = {};
    Object.keys(this._atbDisplay).forEach(key => {
      const start = this._atbDisplay[key] ?? 0;
      const gain  = (this._atbSpeed[key] ?? 100) * atbTime;
      targets[key] = (key === actorKey) ? 100 : Math.min(100, start + gain);
    });

    // Durée visuelle (modulée par la vitesse de lecture)
    const VISUAL_MS = 480 / (this._speed || 1);
    const starts    = { ...this._atbDisplay };
    const t0        = performance.now();

    const step = (now) => {
      const p = Math.min(1, (now - t0) / VISUAL_MS);
      Object.keys(targets).forEach(key => {
        const v = starts[key] + (targets[key] - starts[key]) * p;
        this._atbDisplay[key] = v;
        this._updateATBBar(key, v, key === actorKey && p >= 0.999);
      });
      if (p < 1) {
        this._atbRaf = requestAnimationFrame(step);
      } else {
        this._atbRaf = null;
        done();
      }
    };
    this._atbRaf = requestAnimationFrame(step);
  },

  // Réinitialise la barre d'une unité après qu'elle a agi
  _resetATB(key) {
    this._atbDisplay[key] = 0;
    this._updateATBBar(key, 0);
  },

  // ─────────────────────────────────────────────────────────────────────────
  _animateLog(log, index, onComplete) {
    // À la première frame, initialise les vitesses ATB
    if (index === 0) this._initATBState();

    if (index >= log.length) { onComplete(); return; }

    const event = log[index];
    const next  = () => this._animateLog(log, index + 1, onComplete);

    // Un 'turn_start' signale qu'une unité va agir → on remplit sa barre à 100%
    // AVANT de jouer l'action (les barres montent progressivement, pause ensuite).
    if (event.type === 'turn_start' && event.unitId) {
      const actorKey = this._buildKey(event.unitSide ?? 'player', event.unitId);
      this._setNextActor(event.unitId, event.unitSide ?? 'player');
      this._fillATBUntil(actorKey, () => {
        // L'acteur est à 100% : on joue le turn_start puis on enchaîne.
        // Les barres restent gelées pendant les animations d'attaque qui suivent.
        const delay = Math.round(this._handleEvent(event) / this._speed);
        this._resetATB(actorKey);
        setTimeout(next, delay);
      });
      return;
    }

    // Tous les autres événements : comportement normal (barres gelées)
    const delay = Math.round(this._handleEvent(event) / this._speed);
    setTimeout(next, delay);
  },

  // ─────────────────────────────────────────────────────────────────────────
  _handleEvent(event) {
    // Alimente le journal de combat
    this._logEvent(event);

    switch (event.type) {
      case 'turn_start': {
        // La barre de l'acteur est déjà à 100% (gérée par _fillATBUntil / RAF).
        // On ne touche plus la barre ici : elle sera reset après l'action.
        this._appendLog(`<span class="log-turn">⚡ ${event.unitName ?? 'Pokémon'} attaque :</span>`);
        return DELAY_TURN_START;
      }

      case 'attack': {
        const attackerKey = this._buildKey(event.attackerSide, event.attackerId);
        const targetKey   = this._buildKey(event.targetSide,   event.targetId);
        if (event.attackerMana !== undefined) this._updateManaBar(attackerKey, event.attackerMana);
        if (event.targetMana   !== undefined) this._updateManaBar(targetKey,   event.targetMana);
        this._flashSlot(attackerKey, 'flash-yellow');
        if (event.isMove) this._showMoveAnimation(attackerKey, event.moveName ?? '');

        const isCrit = event.typeMult >= 2;
        // Impact : flash cible + dégâts + burst d'emojis de type
        const onImpact = () => {
          this._flashSlot(targetKey, 'flash-red');
          this._updateHpBar(targetKey, event.targetHpLeft, event.targetMaxHp);
          this._showDamageText(targetKey, event.damage, event.typeMult);
          this._impactBurst(targetKey, { type: event.attackType, isCrit });
        };

        // Physique → lunge ; Spéciale → projectile coloré par type
        if (event.category === 'physical') {
          this._playPhysicalLunge(attackerKey, targetKey, { onImpact });
          return event.isMove ? 480 : 560;
        } else {
          this._playProjectile(attackerKey, targetKey, { type: event.attackType, onImpact });
          return event.isMove ? 430 : 520;
        }
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
        // Aura : ↑ vertes si gain (mult>1), ↓ rouges si perte (mult<1)
        if (event.mult != null && event.mult !== 1) {
          this._statAura(key, event.mult > 1);
        }
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
        // Icônes montantes selon l'effet (brûlure 🔥 / poison ☠ / autre 💥)
        const dmgIcon = event.effect === 'burn' ? '🔥' :
                        event.effect === 'poison' ? '☠️' :
                        event.effect === 'recoil' ? '💥' : '💢';
        this._floatRiseIcons(targetKey, dmgIcon, { color, count: 3 });
        if (event.targetHpLeft <= 0) this._fadeOutSlot(targetKey);
        return 120;
      }

      case 'effect_heal': {
        const targetKey = this._buildKey(event.targetSide, event.targetId);
        this._updateHpBar(targetKey, event.targetHpLeft, event.targetMaxHp);
        this._showHealText(targetKey, event.heal, event.label);
        // Croix vertes montantes
        this._floatRiseIcons(targetKey, '✚', { color: '#39d353', count: 3 });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE B — Socle d'animation (sprites, positions, projectiles, impacts)
  // ═══════════════════════════════════════════════════════════════════════════
  _spriteEl(key) {
    const slot = this._slots[key];
    return slot ? slot.querySelector('.combat-sprite-wrapper') : null;
  },

  // Centre d'un slot en coordonnées client (pour projectiles en position:fixed)
  _slotCenterClient(key) {
    const slot = this._slots[key];
    if (!slot) return null;
    const r = slot.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  },

  _typeEmoji(type) {
    const M = {
      Feu:'🔥', Eau:'💧', Plante:'🌿', Électrik:'⚡', Glace:'❄️', Combat:'👊',
      Poison:'☠️', Sol:'🌋', Vol:'🪶', Psy:'🔮', Insecte:'🐛', Roche:'🪨',
      Spectre:'👻', Dragon:'🐉', Ténèbres:'🌑', Acier:'⚙️', Fée:'✨', Normal:'⭐',
    };
    return M[type] ?? '✦';
  },

  // ── MODULE C — Attaque PHYSIQUE : lunge "Hearthstone" (armement → charge → retour)
  // Rotation accompagnant la translation + grossissement à l'armement.
  _playPhysicalLunge(attackerKey, targetKey, { onImpact } = {}) {
    const el = this._spriteEl(attackerKey);
    const slot = this._slots[attackerKey];
    const aC = this._slotCenterClient(attackerKey);
    const tC = this._slotCenterClient(targetKey);
    if (!el || !aC || !tC) { if (onImpact) onImpact(); return; }

    const dx = tC.x - aC.x, dy = tC.y - aC.y;
    const goingRight = dx >= 0;
    // Droite : armement -30° (anti-horaire) → impact +30° (horaire). Gauche : inverse.
    const armAngle = goingRight ? -30 : 30;
    const hitAngle = goingRight ? 30 : -30;
    // Charge partielle (~60% de la distance) pour limiter le chevauchement
    const moveX = dx * 0.6, moveY = dy * 0.6;
    const recoilX = -dx * 0.10, recoilY = -dy * 0.10;  // léger recul à l'armement

    // Le slot doit cesser de découper le sprite pendant le mouvement, et passer
    // au-dessus des slots voisins.
    if (slot) { slot.style.overflow = 'visible'; slot.style.zIndex = '60'; }
    el.style.zIndex = '60';
    el.style.willChange = 'transform';

    // Phase 1 — Armement (~110ms) : recul + rotation de départ + grossissement 1.15
    el.style.transition = 'transform 0.11s ease-in';
    el.style.transform  = `translate(${recoilX}px, ${recoilY}px) rotate(${armAngle}deg) scale(1.15)`;

    setTimeout(() => {
      // Phase 2 — Charge (~150ms) : translation vers la cible + sweep de rotation + scale ~1
      el.style.transition = 'transform 0.15s cubic-bezier(0.5,0,0.9,0.4)';
      el.style.transform  = `translate(${moveX}px, ${moveY}px) rotate(${hitAngle}deg) scale(1.0)`;
      setTimeout(() => {
        if (onImpact) onImpact();   // impact au contact
        // Phase 3 — Retour (~200ms)
        el.style.transition = 'transform 0.2s ease-out';
        el.style.transform  = 'translate(0,0) rotate(0deg) scale(1)';
        setTimeout(() => {
          el.style.transition = '';
          el.style.transform  = '';
          el.style.zIndex = '';
          el.style.willChange = '';
          if (slot) { slot.style.overflow = ''; slot.style.zIndex = ''; }
        }, 210);
      }, 150);
    }, 110);
  },

  // ── MODULE D — Attaque SPÉCIALE : projectile coloré attaquant → cible
  _playProjectile(attackerKey, targetKey, { type, onImpact } = {}) {
    const aC = this._slotCenterClient(attackerKey);
    const tC = this._slotCenterClient(targetKey);
    if (!aC || !tC) { if (onImpact) onImpact(); return; }

    const color = this._typeColor(type);
    const orb = document.createElement('div');
    orb.className = 'combat-projectile';
    Object.assign(orb.style, {
      position: 'fixed', left: `${aC.x}px`, top: `${aC.y}px`,
      width: '18px', height: '18px', borderRadius: '50%',
      background: `radial-gradient(circle at 35% 35%, #fff, ${color} 60%, ${color})`,
      boxShadow: `0 0 12px 4px ${color}`,
      transform: 'translate(-50%,-50%)', zIndex: '9999', pointerEvents: 'none',
      transition: 'left 0.25s linear, top 0.25s linear',
    });
    document.body.appendChild(orb);
    void orb.offsetWidth;   // force un reflow pour que la transition s'amorce
    // Lance le projectile
    requestAnimationFrame(() => {
      orb.style.left = `${tC.x}px`;
      orb.style.top  = `${tC.y}px`;
    });
    setTimeout(() => {
      orb.remove();
      if (onImpact) onImpact();
    }, 250);
  },

  // ── Burst d'impact : flash + emojis de type qui s'écartent du point d'impact
  _impactBurst(targetKey, { type, isCrit } = {}) {
    const c = this._slotCenterClient(targetKey);
    if (!c) return;
    const emoji = this._typeEmoji(type);
    const n = isCrit ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.5;
      const dist = (isCrit ? 34 : 26) + Math.random() * 8;
      const ex = Math.cos(ang) * dist, ey = Math.sin(ang) * dist;
      const p = document.createElement('div');
      p.textContent = emoji;
      Object.assign(p.style, {
        position: 'fixed', left: `${c.x}px`, top: `${c.y}px`,
        fontSize: isCrit ? '17px' : '14px', zIndex: '9999', pointerEvents: 'none',
        transform: 'translate(-50%,-50%)', transition: 'transform 0.4s ease-out, opacity 0.4s ease-out',
        opacity: '1',
      });
      document.body.appendChild(p);
      void p.offsetWidth;   // reflow → la transition s'amorce
      requestAnimationFrame(() => {
        p.style.transform = `translate(calc(-50% + ${ex}px), calc(-50% + ${ey}px)) scale(${isCrit?1.3:1})`;
        p.style.opacity = '0';
      });
      setTimeout(() => p.remove(), 450);
    }
  },

  // ── (fin du socle d'animation) ────────────────────────────────────────────

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE E — Auras de stats : flèches ↑ vertes (buff) / ↓ rouges (debuff)
  // Une seule aura par vague (coalescence des stat_change consécutifs même unité).
  // ═══════════════════════════════════════════════════════════════════════════
  _statAura(key, isBuff) {
    // Coalescence : ignore si une aura de même sens a déjà été lancée très récemment
    this._lastAura = this._lastAura ?? {};
    const guardKey = `${key}_${isBuff ? 'up' : 'down'}`;
    const now = performance.now();
    if (this._lastAura[guardKey] && now - this._lastAura[guardKey] < 280) return;
    this._lastAura[guardKey] = now;

    const c = this._slotCenterClient(key);
    if (!c) return;
    const arrow = isBuff ? '▲' : '▼';
    const color = isBuff ? '#39d353' : '#ff4d4d';
    const n = 3;
    for (let i = 0; i < n; i++) {
      const offX = (i - 1) * 14 + (Math.random() - 0.5) * 6;
      const a = document.createElement('div');
      a.textContent = arrow;
      Object.assign(a.style, {
        position: 'fixed',
        left: `${c.x + offX}px`,
        top:  `${c.y + (isBuff ? c.h * 0.25 : -c.h * 0.25)}px`,
        fontSize: '15px', fontWeight: '900', color,
        textShadow: `0 0 6px ${color}`,
        zIndex: '9999', pointerEvents: 'none',
        transform: 'translate(-50%,-50%)',
        transition: 'transform 0.6s ease-out, opacity 0.6s ease-out',
        opacity: '0.95',
      });
      document.body.appendChild(a);
      void a.offsetWidth;
      const rise = isBuff ? -c.h * 0.7 : c.h * 0.7;   // monte (buff) ou descend (debuff)
      // Décalage progressif des 3 flèches
      setTimeout(() => {
        a.style.transform = `translate(-50%, calc(-50% + ${rise}px))`;
        a.style.opacity = '0';
      }, i * 70);
      setTimeout(() => a.remove(), 700 + i * 70);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE F — Icônes flottantes montantes (soin ✚, poison ☠, brûlure 🔥)
  // ═══════════════════════════════════════════════════════════════════════════
  _floatRiseIcons(key, icon, { color = '#fff', count = 3 } = {}) {
    const c = this._slotCenterClient(key);
    if (!c) return;
    for (let i = 0; i < count; i++) {
      const offX = (i - (count - 1) / 2) * 13 + (Math.random() - 0.5) * 6;
      const el = document.createElement('div');
      el.textContent = icon;
      Object.assign(el.style, {
        position: 'fixed',
        left: `${c.x + offX}px`, top: `${c.y}px`,
        fontSize: '14px', zIndex: '9999', pointerEvents: 'none',
        color, textShadow: color !== '#fff' ? `0 0 5px ${color}` : 'none',
        transform: 'translate(-50%,-50%)',
        transition: 'transform 0.65s ease-out, opacity 0.65s ease-out',
        opacity: '1',
      });
      document.body.appendChild(el);
      void el.offsetWidth;
      setTimeout(() => {
        el.style.transform = `translate(-50%, calc(-50% - ${c.h * 0.65 + Math.random() * 10}px))`;
        el.style.opacity = '0';
      }, i * 60);
      setTimeout(() => el.remove(), 720 + i * 60);
    }
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
    // Stoppe l'animation ATB en cours
    if (this._atbRaf) { cancelAnimationFrame(this._atbRaf); this._atbRaf = null; }
    const isWin = winner === 'player';

    const phase = document.getElementById('combat-phase-text');
    if (phase) phase.textContent = isWin ? '🏆 Victoire !' : '💀 Défaite...';

    // ── Statistiques : enregistre l'issue du combat UNE seule fois ────────────
    if (!this._statsRecorded) {
      this._statsRecorded = true;
      const rsStats = this._registry?.get?.('runState') ?? {};
      SaveManager.recordCombatResult?.(rsStats, {
        winner,
        nodeType: this._data?.nodeType ?? 'combat',
        mapIndex: this._data?.mapIndex ?? 0,
      });
    }

    // Note : l'avancement de la map (victoire de boss) et le scellement (défaite)
    // se font désormais DÈS le calcul du combat (voir _startCombat, après resolve()),
    // pour que quitter pendant la lecture reprenne sur le bon état.

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
      // Bourse Dorée (et toute relique avec ECON_WIN_COINS) : pièces bonus
      const bonusCoins = RelicEngine.winCoins(getRunState(this._registry)?.relic?.id);
      if (bonusCoins > 0) addCoins(this._registry, bonusCoins);
      this._showRewardAnimation(`+${3 + bonusCoins} 💰`);
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
        // Collecte les données pour checkAchievements
        const playerUnits    = this._livePlayerUnits ?? this._playerUnits ?? [];
        const playerLosses   = playerUnits.filter(u => u.hp <= 0).length;
        const ultimateUsed   = (log ?? []).some(e => e.type === 'ultimate');
        const activeSynergies = Object.keys(this._playerFx ?? {}).length;
        const maxPoisonStacks = Math.max(0, ...(this._liveEnemyUnits ?? [])
          .flatMap(u => u.statusEffects ?? [])
          .filter(s => s.type === 'poison')
          .map(s => s.stacks ?? 1));
        const explosionWin   = (log ?? []).some(e => e.effect === 'death_passive'
          && (e.label ?? '').includes('Explosion'));

        const combatResult = {
          winner, playerUnits, playerLosses, ultimateUsed,
          activeSynergies, maxPoisonStacks, explosionWin,
          mapIndex: this._data?.mapIndex ?? 0,
          nodeType: this._data?.nodeType ?? 'combat',
        };

        // Vérifie les achievements
        const runState = this._registry
          ? (this._registry.get?.('runState') ?? {})
          : {};
        const newAch = SaveManager.checkAchievements(runState, combatResult);
        if (newAch.length > 0) {
          // Notifie les nouveaux achievements
          newAch.forEach((id, i) => {
            setTimeout(() => this._showAchievementToast(id), i * 600);
          });
        }

        this._onDone({
          winner,
          nodeType:     this._data.nodeType  ?? 'combat',
          mapIndex:     this._data.mapIndex  ?? 0,
          mapNodes:     this._data.mapNodes  ?? null,
          startNode:    this._data.startNode ?? null,
          trainerName:  this._data.trainerName  ?? null,
          leagueSprite: this._data.leagueSprite ?? null,
          isLeague:     this._data.isLeague     ?? false,
          // Équipe sur le terrain au moment de la victoire (pour la photo de classe)
          fieldTeam:    (this._registry?.get?.('playerUnits') ?? this._playerUnits ?? [])
                          .filter(Boolean).map(u => ({ id: u.id, name: u.name, spriteUrl: u.spriteUrl })),
        });
      }
    });

    box.appendChild(btn);
    overlay.appendChild(box);
    screen.appendChild(overlay);
  },

  _showAchievementToast(id) {
    // Import dynamique pour éviter la dépendance circulaire
    const ACHIEVEMENTS = window.__ACHIEVEMENTS__;
    const ach = ACHIEVEMENTS?.[id];
    if (!ach) return;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <span class="ach-toast-icon">🏅</span>
      <div>
        <div class="ach-toast-title">Achievement débloqué !</div>
        <div class="ach-toast-label">${ach.label}</div>
        <div class="ach-toast-desc">${ach.desc}</div>
      </div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
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
  // Couleur CSS d'un type (depuis TYPE_COLORS qui sont des nombres hex)
  _typeColor(type) {
    const hex = TYPE_COLORS[type];
    if (hex == null) return '#e2e8f0';
    const n = (typeof hex === 'number') ? hex : parseInt(String(hex).replace('#',''), 16);
    return `#${(n & 0xFFFFFF).toString(16).padStart(6, '0')}`;
  },

  _logEvent(event) {
    const t = event.type;
    if (t === 'attack') {
      const tc = this._typeColor(event.attackType);
      const eff   = event.typeMult >= 2 ? ' <span class="log-super">super efficace!</span>'
                  : event.typeMult <= 0.5 ? ' <span class="log-weak">peu efficace</span>' : '';
      const crit  = event.isCrit ? ' <span class="log-crit">critique!</span>' : '';
      if (event.isMove) {
        // Capacité : on garde le nom du move coloré (l'ultime a sa propre ligne)
        const moveLabel = `<span class="log-move" style="color:${tc};font-weight:700">⚡${event.moveName}</span>`;
        this._appendLog(
          `${moveLabel} → <b style="color:${tc}">${event.targetName}</b> <b>-${event.damage} PV</b>${eff}${crit}`
        );
      } else {
        // Attaque normale : pas de nom d'attaquant (déjà annoncé par "agit"),
        // juste [type coloré] [cible] - [dégâts] PV
        this._appendLog(
          `<span class="log-attack-line">↳ <span style="color:${tc};font-weight:700">[${event.attackType}]</span> ${event.targetName} <b>-${event.damage} PV</b>${eff}${crit}</span>`
        );
      }
    } else if (t === 'talent_summary') {
      this._appendLog(`<span class="log-talent">🎯 Talents actifs : ${event.talents.join(' · ')}</span>`);
    } else if (t === 'talent_trigger') {
      this._appendLog(`<span class="log-talent">🎯 Talent ${event.talentType ?? ''} : ${event.label ?? ''}</span>`);
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
      const tc = this._typeColor(event.moveType);
      this._appendLog(
        `<span class="log-move" style="color:${tc};font-weight:800">⚡ ${event.attackerSide === 'player' ? '🔵' : '🔴'} ${event.moveName} !</span>`
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
      // Ligue : sprite du Maître (archétype) ; sinon sprite du champion d'arène
      if (this._data.leagueSprite) return this._data.leagueSprite;
      const arena = getArenaForMap(this._data.mapIndex ?? 0);
      return arena?.championSpriteCombat ?? null;
    }
    if (this._data.trainerArchetypeId) {
      return `assets/trainers/combat/${this._data.trainerArchetypeId}_c.png`;
    }
    return null;
  },
};
