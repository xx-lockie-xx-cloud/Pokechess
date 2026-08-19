// ─────────────────────────────────────────────────────────────────────────────
// TrainingUI.js — Nœud Entraînement 🏋️
//
// Le joueur paie pour faire monter un Pokémon. Le coût est FIXE, quel que soit
// le niveau : un tarif croissant décourageait de terminer une montée en cours
// et rendait le nœud illisible.
//
// Sont entraînables les Pokémon du TERRAIN comme ceux de la BANQUE.
// ─────────────────────────────────────────────────────────────────────────────

import { getRunState, removeCoins } from '../data/runState.js';

export const TRAIN_COST = 2;

export const TrainingUI = {
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

  // Coût FIXE d'un niveau, indépendant du niveau actuel
  levelCost() {
    return TRAIN_COST;
  },

  _coins() {
    return getRunState(this._registry)?.coins ?? 0;
  },

  // Terrain ET banque. IMPORTANT : `playerUnits` (terrain) et `playerBank`
  // (banque) sont DISJOINTS. Une unité posée sort de la banque, donc filtrer
  // la banque pour trouver le terrain ne renvoyait jamais rien.
  _groups() {
    const state = getRunState(this._registry) ?? {};
    const field = (this._registry?.get?.('playerUnits') ?? []).filter(Boolean);
    const bank  = (state.playerBank ?? []).filter(Boolean);
    // Sécurité : si une unité figurait dans les deux, on ne la compte qu'une fois
    const onField = new Set(field.map(u => u?.uid).filter(Boolean));
    return { field, bench: bank.filter(u => !onField.has(u.uid)) };
  },

  // Liste à plat, dans l'ordre d'affichage (terrain puis banque)
  _team() {
    const g = this._groups();
    return [...g.field, ...g.bench];
  },

  _level(id) {
    return window.SaveManager?.getPokemonLevel?.(id) ?? 1;
  },

  // Une section (Terrain ou Banque). `offset` décale les index pour que la
  // sélection reste cohérente avec la liste à plat renvoyée par _team().
  _renderGroup(title, list, offset, coins) {
    if (!list.length) return '';
    return `
      <div class="node-section">${title}</div>
      <div class="training-list">
        ${list.map((p, k) => {
          const i    = offset + k;
          const lv   = this._level(p.id);
          const cost = this.levelCost();
          const can  = coins >= cost && lv < 100;
          return `
            <button class="training-card ${this._sel === i ? 'active' : ''} ${can ? '' : 'disabled'}"
                    data-idx="${i}" ${can ? '' : 'disabled'}>
              <img src="${p.spriteUrl}" alt="${p.name}" class="tr-sprite"
                   onerror="this.src='assets/placeholder.png'" />
              <span class="tr-name">${p.name}</span>
              <span class="tr-lv">Niv. ${lv}</span>
              <span class="tr-cost">${lv >= 100 ? 'Niveau max' : `💰 ${cost}`}</span>
            </button>`;
        }).join('')}
      </div>`;
  },

  _render() {
    const root = document.getElementById('training-root');
    if (!root) return;
    const coins = getRunState(this._registry)?.coins ?? 0;
    const team  = this._team();

    root.innerHTML = `
      <div class="node-wrap">
        <h2 class="node-title">🏋️ Entraînement</h2>
        <p class="node-sub">Choisissez un Pokémon à entraîner, sur le terrain ou en banque.
          ${TRAIN_COST} pièces par niveau.</p>

        ${team.length
          ? this._renderGroup('Sur le terrain', this._groups().field, 0, coins)
            + this._renderGroup('En banque', this._groups().bench, this._groups().field.length, coins)
          : '<p class="node-empty">Aucun Pokémon dans votre équipe.</p>'}

        <p id="training-info" class="node-info"></p>

        <div class="node-actions">
          <button id="training-buy" class="btn-primary" ${this._sel == null ? 'disabled' : ''}>
            🏋️ Entraîner (+1 niveau)
          </button>
          <button id="training-leave" class="btn-secondary">Quitter</button>
        </div>
        <div class="node-coins">💰 ${coins} pièces</div>
      </div>`;

    root.querySelectorAll('.training-card:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        this._sel = Number(btn.dataset.idx);
        this._render();
      });
    });
    document.getElementById('training-buy')?.addEventListener('click', () => this._train());
    document.getElementById('training-leave')?.addEventListener('click', () => { this._stopCoinWatch(); this._onDone?.(); });
  },

  _train() {
    if (this._sel == null) return;
    const p = this._team()[this._sel];
    if (!p) return;

    const lv   = this._level(p.id);
    const cost = this.levelCost();
    const state = getRunState(this._registry) ?? {};
    if ((state.coins ?? 0) < cost || lv >= 100) return;

    removeCoins(this._registry, cost);
    window.SaveManager?.gainPokemonLevel?.(p.id);

    this._render();
    const info = document.getElementById('training-info');
    if (info) info.innerHTML =
      `<span class="node-ok">${p.name} passe niveau ${this._level(p.id)} !</span>`;
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