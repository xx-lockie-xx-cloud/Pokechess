// ─────────────────────────────────────────────────────────────────────────────
// DuelUI.js — Nœud 1vs1 Boulevard ⚔️
//
// Pari sur un duel à un contre un. Le joueur voit le champion adverse AVANT de
// choisir son combattant : l'enjeu est un puzzle de types, pas un coup de dé.
//
//   mise plafonnée à MAX_WAGER pièces
//   victoire → mise doublée   défaite → mise perdue
//
// La défaite n'est PAS fatale : sans cela, personne ne prendrait le pari.
// Le duel se déroule sur la case avant-centre du terrain (col 1, row 0) pour
// les deux camps, ce qui évite d'avoir à gérer un placement.
// ─────────────────────────────────────────────────────────────────────────────

import { POKEMONS }                     from '../data/pokemons.js';
import { getRunState, addCoins, removeCoins, getBSTTier,
         getRunRegion, getEnemyMultiplier } from '../data/runState.js';
import { isPokemonAllowed }             from '../data/regions.js';
import { assignCorners }                from '../data/synergies.js';

export const MAX_WAGER  = 10;
export const DUEL_COL   = 1;   // case avant-centre
export const DUEL_ROW   = 0;

export const DuelUI = {
  _registry: null,
  _onDone:   null,
  _data:     null,
  _wager:    3,
  _sel:      null,
  _foe:      null,

  init(data, registry, onDone) {
    this._registry = registry;
    this._onDone   = onDone;
    this._data     = data;
    this._sel      = null;
    this._wager    = Math.min(3, getRunState(registry)?.coins ?? 0);
    this._foe      = this._buildFoe();
    this._startCoinWatch();
    this._render();
  },

  // Adversaire : un Pokémon de tier comparable à la moyenne de l'équipe
  _buildFoe() {
    const meta   = window.SaveManager?.loadMeta?.() ?? {};
    const region = getRunRegion(this._registry);
    const bank   = getRunState(this._registry)?.playerBank ?? [];
    const avg    = bank.length
      ? Math.round(bank.reduce((a, p) => a + getBSTTier(p), 0) / bank.length)
      : 3;
    const tier = Math.max(2, Math.min(4, avg));

    const pool = POKEMONS.filter(p =>
      isPokemonAllowed(p.id, region, meta) && getBSTTier(p) === tier);
    const base = pool.length
      ? pool[Math.floor(Math.random() * pool.length)]
      : POKEMONS[0];

    const mapIndex = this._data?.mapIndex ?? 0;
    const mult     = getEnemyMultiplier(mapIndex, 0);
    const stats    = {};
    Object.entries(base.stats).forEach(([k, v]) => { stats[k] = Math.round(v * mult); });

    return { ...base, uid: `duel_${base.id}`, stats,
             col: DUEL_COL, row: DUEL_ROW, attributes: [],
             corners: assignCorners(base) };
  },

  // Unités POSÉES SUR LE TERRAIN (pas la banque) : le duel se joue avec un
  // Pokémon déjà placé, et la case de duel est une case du terrain.
  _field() {
    const reg = this._registry?.get?.('playerUnits') ?? [];
    if (reg.length) return reg.filter(Boolean);
    return (getRunState(this._registry)?.playerBank ?? [])
      .filter(u => u && u.isInTeam);
  },

  _coins() {
    return getRunState(this._registry)?.coins ?? 0;
  },

  _render() {
    const root = document.getElementById('duel-root');
    if (!root) return;
    const coins = getRunState(this._registry)?.coins ?? 0;
    const team  = this._field();
    const maxW  = Math.min(MAX_WAGER, coins);
    this._wager = Math.min(this._wager, maxW);

    root.innerHTML = `
      <div class="node-wrap">
        <h2 class="node-title">⚔️ 1vs1 Boulevard</h2>
        <p class="node-sub">Misez, puis désignez votre champion. Victoire : mise doublée.
          Défaite : mise perdue, mais votre épopée continue.</p>

        <div class="duel-foe">
          <span class="duel-label">Adversaire</span>
          <img src="${this._foe.spriteUrl}" alt="${this._foe.name}" class="duel-sprite"
               onerror="this.src='assets/placeholder.png'" />
          <span class="duel-name">${this._foe.name}</span>
          <span class="duel-types">${this._foe.types.join(' / ')}</span>
        </div>

        <div class="duel-wager">
          <span>Mise : <b id="duel-wager-val">${this._wager}</b> pièces</span>
          <input type="range" id="duel-wager" min="1" max="${Math.max(1, maxW)}"
                 value="${this._wager}" ${maxW < 1 ? 'disabled' : ''} />
        </div>

        <p class="duel-hint">Placez votre Champion sur la case indiquée</p>

        <div class="duel-board">
          ${[0, 1].map(row => `
            <div class="duel-row">
              ${[0, 1, 2].map(col => {
                const u   = team.find(p => p.col === col && p.row === row);
                const isD = (col === DUEL_COL && row === DUEL_ROW);
                const idx = u ? team.indexOf(u) : -1;
                return `
                  <button class="duel-cell ${isD ? 'duel-target' : ''}
                                 ${this._sel === idx && idx >= 0 ? 'active' : ''}
                                 ${u ? '' : 'empty'}"
                          data-idx="${idx}" ${u ? '' : 'disabled'}>
                    ${u ? `<img src="${u.spriteUrl}" alt="${u.name}" class="tr-sprite"
                                onerror="this.src='assets/placeholder.png'" />
                          <span class="tr-name">${u.name}</span>`
                        : '<span class="duel-empty">·</span>'}
                    ${isD ? '<span class="duel-flag">⚔️</span>' : ''}
                  </button>`;
              }).join('')}
            </div>`).join('')}
        </div>
        <p class="duel-note">La case marquée ⚔️ est celle du duel. Réorganisez votre
          terrain depuis l'écran de préparation si besoin.</p>

        <div class="node-actions">
          <button id="duel-go" class="btn-primary" ${this._sel == null || maxW < 1 ? 'disabled' : ''}>
            ⚔️ Lancer le duel
          </button>
          <button id="duel-leave" class="btn-secondary">Refuser le pari</button>
        </div>
        <div class="node-coins">💰 ${coins} pièces</div>
      </div>`;

    const slider = document.getElementById('duel-wager');
    slider?.addEventListener('input', () => {
      this._wager = Number(slider.value);
      const v = document.getElementById('duel-wager-val');
      if (v) v.textContent = this._wager;
    });
    root.querySelectorAll('.duel-cell:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.idx);
        if (i >= 0) { this._sel = i; this._render(); }
      });
    });
    document.getElementById('duel-go')?.addEventListener('click', () => this._start());
    document.getElementById('duel-leave')?.addEventListener('click', () => { this._stopCoinWatch(); this._onDone?.(null); });
  },

  _start() {
    if (this._sel == null) return;
    const champ = this._field()[this._sel];
    if (!champ) return;

    removeCoins(this._registry, this._wager);

    // Le champion est placé sur la case de duel, l'adversaire lui fait face
    const player = [{ ...champ, col: DUEL_COL, row: DUEL_ROW }];

    this._stopCoinWatch();
    this._onDone?.({
      isDuel:      true,
      duelWager:   this._wager,
      playerUnits: player,
      enemyUnits:  [this._foe],
      trainerName: `Duelliste`,
      mapIndex:    this._data?.mapIndex ?? 0,
      nodeType:    'duel',
    });
  },

  // Appelé par UIManager à la fin du combat de duel
  settle(registry, { won, wager }) {
    if (won) addCoins(registry, (wager ?? 0) * 2);
    return won ? (wager ?? 0) * 2 : 0;
  },

  // Les pièces peuvent changer pendant que l'écran est ouvert (vente depuis
  // l'écran de préparation). On resynchronise plutôt que de figer le montant
  // lu à l'arrivée sur le nœud.
  _startCoinWatch() {
    this._stopCoinWatch();
    this._lastCoins = this._coins?.() ?? getRunState(this._registry)?.coins ?? 0;
    this._coinTimer = setInterval(() => {
      const now = getRunState(this._registry)?.coins ?? 0;
      if (now !== this._lastCoins) { this._lastCoins = now; this._render(); }
    }, 400);
  },

  _stopCoinWatch() {
    if (this._coinTimer) { clearInterval(this._coinTimer); this._coinTimer = null; }
  },
};