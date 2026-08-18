// ─────────────────────────────────────────────────────────────────────────────
// BlackMarketUI.js — Nœud Marché Noir 🕶️
//
// Troc à l'aveugle : le joueur cède un Pokémon et quelques pièces, et reçoit un
// autre Pokémon dont il ne connaît PAS l'identité avant l'échange.
//
// MONTÉE DE RANG : le Pokémon reçu est d'un tier SUPÉRIEUR, jusqu'à T4.
//   T1 → T2 (1 pièce)    T2 → T3 (1 pièce)
//   T3 → T4 (2 pièces)   T4 → T4 (2 pièces, échange latéral)
//
// Le Pokémon reçu partage AU MOINS UN TYPE avec celui cédé, pour que les
// synergies de l'équipe ne s'effondrent pas. Aucun T5 ne sort d'ici : c'est le
// rôle du Casino.
// ─────────────────────────────────────────────────────────────────────────────

import { POKEMONS }                      from '../data/pokemons.js';
import { getRunState, setRunState, removeCoins,
         getBSTTier, getRunRegion }      from '../data/runState.js';
import { isPokemonAllowed }              from '../data/regions.js';
import { assignCorners }                 from '../data/synergies.js';

export const MAX_TIER = 4;

// Coût de l'échange selon le tier CÉDÉ
export const TRADE_COSTS = { 1: 1, 2: 1, 3: 2, 4: 2 };

// Tier obtenu selon le tier cédé : montée jusqu'à T4, puis échange latéral
export function targetTier(sourceTier) {
  return Math.min((sourceTier ?? 1) + 1, MAX_TIER);
}
export function tradeCost(sourceTier) {
  return TRADE_COSTS[Math.min(sourceTier ?? 1, MAX_TIER)] ?? 2;
}

export const BlackMarketUI = {
  _registry: null,
  _onDone:   null,
  _sel:      null,

  init(data, registry, onDone) {
    this._registry = registry;
    this._onDone   = onDone;
    this._sel      = null;
    this._startCoinWatch();
    this._render();
  },

  // Terrain ET banque : sans le terrain, un joueur ayant posé toute son équipe
  // n'aurait rien à échanger et le nœud serait un cul-de-sac.
  _groups() {
    const state = getRunState(this._registry) ?? {};
    const bank  = (state.playerBank ?? []).filter(Boolean);
    const field = this._registry?.get?.('playerUnits') ?? [];
    const onField = new Set(field.map(u => u?.uid).filter(Boolean));
    const isField = u => onField.has(u.uid) || u.isInTeam === true;
    return { field: bank.filter(isField), bench: bank.filter(u => !isField(u)) };
  },

  // Liste à plat dans l'ordre d'affichage (terrain puis banque)
  _team() {
    const g = this._groups();
    return [...g.field, ...g.bench];
  },

  // Index dans playerBank, la liste affichée étant réordonnée
  _bankIndexOf(unit) {
    const bank = getRunState(this._registry)?.playerBank ?? [];
    return bank.findIndex(u => u && u.uid === unit.uid);
  },

  // Candidats : tier SUPÉRIEUR (plafonné T4), au moins un type commun, espèce
  // différente. Les T5 sont toujours exclus, sinon un T4 cédé pourrait
  // rapporter un légendaire, ce qui empiéterait sur le Casino.
  _candidates(source) {
    const meta   = window.SaveManager?.loadMeta?.() ?? {};
    const region = getRunRegion(this._registry);
    const from   = Math.min(getBSTTier(source), MAX_TIER);
    const want   = targetTier(from);
    return POKEMONS.filter(p =>
      p.id !== source.id &&
      getBSTTier(p) === want &&
      getBSTTier(p) <= MAX_TIER &&
      isPokemonAllowed(p.id, region, meta) &&
      p.types.some(t => source.types.includes(t)));
  },

  // Une section (Terrain ou Banque). `offset` décale les index pour rester
  // cohérent avec la liste à plat de _team().
  _renderGroup(title, list, offset, coins) {
    if (!list.length) return '';
    return `
      <div class="node-section">${title}</div>
      <div class="training-list">
        ${list.map((p, k) => {
          const i    = offset + k;
          const from = Math.min(getBSTTier(p), MAX_TIER);
          const to   = targetTier(from);
          const cost = tradeCost(from);
          const n    = this._candidates(p).length;
          const can  = n > 0 && coins >= cost;
          return `
            <button class="training-card ${this._sel === i ? 'active' : ''} ${can ? '' : 'disabled'}"
                    data-idx="${i}" ${can ? '' : 'disabled'}>
              <img src="${p.spriteUrl}" alt="${p.name}" class="tr-sprite"
                   onerror="this.src='assets/placeholder.png'" />
              <span class="tr-name">${p.name}</span>
              <span class="tr-lv">T${from} → <b>T${to}</b></span>
              <span class="tr-cost">${n ? `💰 ${cost}` : 'Aucun échange'}</span>
            </button>`;
        }).join('')}
      </div>`;
  },

  _render() {
    const root = document.getElementById('blackmarket-root');
    if (!root) return;
    const coins = getRunState(this._registry)?.coins ?? 0;
    const team  = this._team();

    root.innerHTML = `
      <div class="node-wrap">
        <h2 class="node-title">🕶️ Marché Noir</h2>
        <p class="node-sub">
          Échangez un Pokémon contre un autre de <b>rang supérieur</b>, partageant au
          moins un type. Au rang 4, l'échange reste latéral.
          <b>Vous ne saurez ce que vous recevez qu'après l'échange.</b>
        </p>

        ${team.length
          ? this._renderGroup('Sur le terrain', this._groups().field, 0, coins)
            + this._renderGroup('En banque', this._groups().bench, this._groups().field.length, coins)
          : '<p class="node-empty">Aucun Pokémon à échanger.</p>'}

        <p id="bm-info" class="node-info"></p>

        <div class="node-actions">
          <button id="bm-trade" class="btn-primary" ${this._sel == null ? 'disabled' : ''}>
            🕶️ Échanger${this._sel != null
              ? ` (${tradeCost(Math.min(getBSTTier(team[this._sel]), MAX_TIER))} pièces)` : ''}
          </button>
          <button id="bm-leave" class="btn-secondary">Quitter</button>
        </div>
        <div class="node-coins">💰 ${coins} pièces</div>
      </div>`;

    root.querySelectorAll('.training-card:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        this._sel = Number(btn.dataset.idx);
        this._render();
      });
    });
    document.getElementById('bm-trade')?.addEventListener('click', () => this._trade());
    document.getElementById('bm-leave')?.addEventListener('click', () => { this._stopCoinWatch(); this._onDone?.(); });
  },

  async _trade() {
    if (this._sel == null) return;
    const state = getRunState(this._registry) ?? {};
    const bank  = [...(state.playerBank ?? [])];
    // L'index affiché suit l'ordre terrain-puis-banque : on repasse par l'uid
    // pour retrouver la vraie position dans playerBank.
    const src   = this._team()[this._sel];
    if (!src) return;
    const bankIdx = this._bankIndexOf(src);
    if (bankIdx < 0) return;

    const from = Math.min(getBSTTier(src), MAX_TIER);
    const cost = tradeCost(from);
    if ((state.coins ?? 0) < cost) return;

    const pool = this._candidates(src);
    if (!pool.length) return;

    const pick = pool[Math.floor(Math.random() * pool.length)];
    removeCoins(this._registry, cost);

    // Le nouveau Pokémon reprend la place et l'objet tenu de l'ancien
    const replacement = {
      ...pick,
      uid:      `${pick.id}_trade_${Date.now()}`,
      isInTeam: src.isInTeam,
      col:      src.col,
      row:      src.row,
      heldItem: src.heldItem ?? null,
      corners:  assignCorners(pick),
    };
    bank[bankIdx] = replacement;
    setRunState(this._registry, { playerBank: bank });

    // Si le Pokémon cédé était POSÉ, le remplaçant prend sa case sur le terrain
    const field = this._registry?.get?.('playerUnits') ?? [];
    const fIdx  = field.findIndex(u => u && u.uid === src.uid);
    if (fIdx >= 0) {
      const nf = [...field];
      nf[fIdx] = replacement;
      this._registry.set('playerUnits', nf);
    }

    this._sel = null;
    this._render();
    window.UIManager?.notifyAchievements?.(this._registry);

    await this._showResult(src, pick);
  },

  // Les pièces peuvent changer pendant que l'écran est ouvert (vente depuis
  // l'écran de préparation). On resynchronise plutôt que de figer le montant
  // lu à l'arrivée sur le nœud.
  // Fenêtre de résultat : le joueur découvre ici ce qu'il a reçu.
  _showResult(from, to) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'casino-win-overlay';
      ov.innerHTML = `
        <div class="casino-win-box bm-box">
          <p class="cw-title">Vous avez échangé <b>${from.name}</b> contre :</p>
          <div class="cw-visual">
            <img src="${to.spriteUrl}" alt="${to.name}" class="cw-sprite"
                 onerror="this.src='assets/placeholder.png'" />
          </div>
          <p class="cw-name">${to.name}</p>
          <p class="bm-tier">Rang T${Math.min(getBSTTier(from), MAX_TIER)}
             → <b>T${getBSTTier(to)}</b> · ${to.types.join(' / ')}</p>
          <button class="btn-primary cw-ok">Parfait !</button>
        </div>`;
      document.body.appendChild(ov);
      const close = () => { ov.remove(); resolve(); };
      ov.querySelector('.cw-ok')?.addEventListener('click', close);
      ov.addEventListener('click', e => { if (e.target === ov) close(); });
    });
  },

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