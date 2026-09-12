// ─────────────────────────────────────────────────────────────────────────────
// LadderUI.js — Classement en ligne, un onglet par métrique.
// ─────────────────────────────────────────────────────────────────────────────

import { LADDER_METRICS, fetchLadder, publishScore, getMyUserId } from '../data/ladder.js';
import { getTrainerName } from '../data/playerProfile.js';

export const LadderUI = {
  _overlay: null,
  _metric:  LADDER_METRICS[0].key,
  _myId:    null,

  async open() {
    if (!this._overlay) this._build();
    this._overlay.classList.remove('hidden');
    this._renderTabs();
    // On publie avant de lire, pour que le joueur se voie a jour dans le classement.
    await publishScore({ force: true });
    this._myId = await getMyUserId();
    this._load();
  },
  close() { this._overlay?.classList.add('hidden'); },

  _build() {
    const o = document.createElement('div');
    o.className = 'ui-overlay ladder-overlay hidden';
    o.innerHTML = `
      <div class="ladder-panel">
        <div class="ladder-topbar">
          <div class="ladder-title">🏆 Classement</div>
          <button class="ladder-close btn-close">✕</button>
        </div>
        <div class="ladder-tabs"></div>
        <div class="ladder-body"></div>
      </div>`;
    document.body.appendChild(o);
    this._overlay = o;
    o.querySelector('.ladder-close').addEventListener('click', () => this.close());
    o.addEventListener('click', (e) => { if (e.target === o) this.close(); });
  },

  _renderTabs() {
    const tabs = this._overlay.querySelector('.ladder-tabs');
    tabs.innerHTML = LADDER_METRICS.map(m =>
      `<button class="ladder-tab${m.key === this._metric ? ' active' : ''}" data-key="${m.key}">
         ${m.emoji} ${m.label}
       </button>`).join('');
    tabs.querySelectorAll('.ladder-tab').forEach(b =>
      b.addEventListener('click', () => {
        this._metric = b.dataset.key;
        this._renderTabs();
        this._load();
      }));
  },

  async _load() {
    const body = this._overlay.querySelector('.ladder-body');
    body.innerHTML = '<div class="ladder-msg">Chargement...</div>';

    if (!getTrainerName()) {
      body.innerHTML = `<div class="ladder-msg">
        Choisissez un nom de dresseur dans les réglages pour apparaître au classement.</div>`;
      return;
    }

    const metric = LADDER_METRICS.find(m => m.key === this._metric);
    const rows   = await fetchLadder(this._metric);

    if (rows === null) {
      body.innerHTML = `<div class="ladder-msg">
        Classement indisponible pour le moment.<br>Vérifiez votre connexion.</div>`;
      return;
    }
    if (!rows.length) {
      body.innerHTML = '<div class="ladder-msg">Aucun dresseur classé pour l\'instant.</div>';
      return;
    }

    const fmt = metric?.fmt ?? (v => v ?? 0);
    body.innerHTML = `
      <div class="ladder-list">
        ${rows.map((r, i) => {
          const me = r.user_id === this._myId;
          const rank = i + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
          return `
            <div class="ladder-row${me ? ' me' : ''}">
              <span class="ladder-rank">${medal}</span>
              <span class="ladder-name">${this._esc(r.trainer_name ?? 'Dresseur')}</span>
              <span class="ladder-value">${fmt(r[this._metric])}</span>
            </div>`;
        }).join('')}
      </div>`;
  },

  _esc(s) {
    return String(s).replace(/[&<>"']/g, ch =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  },
};