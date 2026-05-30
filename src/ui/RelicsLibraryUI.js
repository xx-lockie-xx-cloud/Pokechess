// ─────────────────────────────────────────────────────────────────────────────
// RelicsLibraryUI.js — Bibliothèque des reliques (accesssible depuis le menu)
// ─────────────────────────────────────────────────────────────────────────────
import { RELICS }       from '../data/relics.js';
import { ACHIEVEMENTS } from '../data/levelSystem.js';
import { SaveManager }  from '../SaveManager.js';

const CATEGORY_LABELS = {
  economy:     '🛍 Économie',
  combat:      '⚔️ Combat',
  synergy:     '🔗 Synergies',
  info:        '📖 Information',
  progression: '⭐ Progression',
  challenge:   '🎲 Challenge',
};

const CATEGORY_ORDER = ['economy','combat','synergy','info','progression','challenge'];

export const RelicsLibraryUI = {
  _overlay: null,

  init() {
    this._overlay = document.getElementById('overlay-relics-library');
    if (!this._overlay) return;
    document.getElementById('btn-relics-library-close')
      ?.addEventListener('click', () => this.close());
    this._overlay.addEventListener('click', e => {
      if (e.target === this._overlay) this.close();
    });
  },

  open() {
    if (!this._overlay) this.init();
    this._render();
    this._overlay?.classList.add('active');
    document.body.classList.add('overlay-open');
  },

  close() {
    this._overlay?.classList.remove('active');
    document.body.classList.remove('overlay-open');
  },

  _render() {
    const body = document.getElementById('relics-library-body');
    if (!body) return;

    const meta      = SaveManager.loadMeta();
    const ach       = meta?.achievements ?? {};
    const activeRun = meta?.currentRelic ?? null;

    const all      = Object.values(RELICS);
    const unlocked = all.filter(r => !r.unlockAchievement || ach[r.unlockAchievement]);
    const locked   = all.filter(r =>  r.unlockAchievement && !ach[r.unlockAchievement]);

    // Barre de progression
    const pct = Math.round((unlocked.length / all.length) * 100);

    // Groupe par catégorie
    const byCategory = {};
    all.forEach(r => {
      if (!byCategory[r.category]) byCategory[r.category] = [];
      byCategory[r.category].push(r);
    });

    body.innerHTML = `
      <div class="rl-progress">
        <div class="rl-progress-label">${unlocked.length} / ${all.length} reliques débloquées</div>
        <div class="rl-progress-bar">
          <div class="rl-progress-fill" style="width:${pct}%"></div>
        </div>
      </div>

      ${CATEGORY_ORDER.filter(c => byCategory[c]?.length).map(cat => `
        <div class="rl-category">
          <div class="rl-cat-title">${CATEGORY_LABELS[cat] ?? cat}</div>
          <div class="rl-grid">
            ${byCategory[cat].map(r => this._relicCard(r, ach)).join('')}
          </div>
        </div>
      `).join('')}
    `;
  },

  _relicCard(relic, ach) {
    const isUnlocked = !relic.unlockAchievement || !!ach[relic.unlockAchievement];
    const achDef = relic.unlockAchievement
      ? (window.__ACHIEVEMENTS__?.[relic.unlockAchievement] ?? null)
      : null;

    if (!isUnlocked) return `
      <div class="rl-card locked">
        <div class="rl-card-icon">🔒</div>
        <div class="rl-card-body">
          <div class="rl-card-name">???</div>
          <div class="rl-card-unlock">
            ${achDef ? `Succès requis : <em>${achDef.label}</em>` : 'Verrouillé'}
          </div>
        </div>
      </div>`;

    return `
      <div class="rl-card unlocked">
        <div class="rl-card-icon">${relic.icon}</div>
        <div class="rl-card-body">
          <div class="rl-card-name">${relic.name}</div>
          <div class="rl-card-desc">${relic.desc}</div>
          ${relic.apply?.symmetric
            ? '<div class="rl-card-sym">⚖️ Symétrique</div>' : ''}
          ${achDef
            ? `<div class="rl-card-ach">🏅 ${achDef.label}</div>` : ''}
        </div>
      </div>`;
  },
};
