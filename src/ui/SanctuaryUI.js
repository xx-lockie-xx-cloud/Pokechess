// ─────────────────────────────────────────────────────────────────────────────
// SanctuaryUI.js — Nœud Sanctuaire ⛩️
//
// Trois bénédictions tirées au sort, une seule à choisir. Gratuit : le coût est
// l'opportunité perdue, pas les pièces. Les bénédictions déjà actives sont
// exclues du tirage, pour éviter les doublons sans intérêt.
// ─────────────────────────────────────────────────────────────────────────────

import { getRunState, setRunState }        from '../data/runState.js';
import { drawBlessings, BLESSING_DURATION } from '../data/blessings.js';

export const SanctuaryUI = {
  _registry: null,
  _onDone:   null,
  _offer:    [],
  _taken:    false,

  init(data, registry, onDone) {
    this._registry = registry;
    this._onDone   = onDone;
    this._taken    = false;
    const active   = getRunState(registry)?.blessings ?? [];
    this._offer    = drawBlessings(3, active.map(b => b.id));
    this._render();
  },

  _render() {
    const root = document.getElementById('sanctuary-root');
    if (!root) return;
    const active = getRunState(this._registry)?.blessings ?? [];

    root.innerHTML = `
      <div class="node-wrap">
        <h2 class="node-title">⛩️ Sanctuaire</h2>
        <p class="node-sub">Recueillez-vous et choisissez une bénédiction.
          Elle vous accompagnera pendant <b>${BLESSING_DURATION} combats</b>.</p>

        ${active.length ? `
          <div class="node-section">Bénédictions actives</div>
          <div class="bless-active">
            ${active.map(a => {
              const b = this._offer.find(x => x.id === a.id);
              return `<span class="bless-chip" title="${a.name}">
                        ${a.emoji} <b>${a.left}</b></span>`;
            }).join('')}
          </div>` : ''}

        <div class="bless-list">
          ${this._offer.length ? this._offer.map(b => `
            <button class="bless-card" data-id="${b.id}" style="--bl:${b.color}"
                    ${this._taken ? 'disabled' : ''}>
              <span class="bless-ico">${b.emoji}</span>
              <span class="bless-name">${b.name}</span>
              <span class="bless-desc">${b.desc}</span>
            </button>`).join('')
            : '<p class="node-empty">Toutes les bénédictions vous accompagnent déjà.</p>'}
        </div>

        <p id="sanctuary-info" class="node-info"></p>

        <div class="node-actions">
          <button id="sanctuary-leave" class="btn-secondary">
            ${this._taken ? 'Continuer' : 'Passer son chemin'}
          </button>
        </div>
      </div>`;

    root.querySelectorAll('.bless-card:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => this._take(btn.dataset.id));
    });
    document.getElementById('sanctuary-leave')
      ?.addEventListener('click', () => this._onDone?.());
  },

  _take(id) {
    if (this._taken) return;
    const b = this._offer.find(x => x.id === id);
    if (!b) return;

    const state  = getRunState(this._registry) ?? {};
    const active = [...(state.blessings ?? [])];
    // Reprendre une bénédiction déjà active recharge simplement son compteur
    const found  = active.find(a => a.id === id);
    if (found) found.left = BLESSING_DURATION;
    else active.push({ id: b.id, name: b.name, emoji: b.emoji,
                       color: b.color, desc: b.desc, left: BLESSING_DURATION });

    setRunState(this._registry, { blessings: active });
    this._taken = true;
    this._render();

    const info = document.getElementById('sanctuary-info');
    if (info) info.innerHTML =
      `<span class="node-ok">${b.emoji} ${b.name} vous accompagne pour ${BLESSING_DURATION} combats.</span>`;
  },
};