// ─────────────────────────────────────────────────────────────────────────────
// AchievementsUI.js — Overlay succès
// Accessible depuis le menu principal et depuis le Pokédex
// ─────────────────────────────────────────────────────────────────────────────
import { ACHIEVEMENTS } from '../data/levelSystem.js';
import { SaveManager }  from '../SaveManager.js';

const CATEGORY_LABELS = {
  league:      '🏆 Ligue',
  progression: '📍 Progression',
  collection:  '📖 Collection',
  level:       '⬆ Niveaux',
  combat:      '⚔️ Combat',
  roguelite:   '🎲 Roguelite',
};

export const AchievementsUI = {
  _overlay: null,

  init() {
    this._overlay = document.getElementById('overlay-achievements');
    if (!this._overlay) return;
    document.getElementById('btn-achievements-close')
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
    const body = document.getElementById('achievements-body');
    if (!body) return;

    const meta    = SaveManager.loadMeta();
    const unlocked = meta.achievements ?? {};

    const all   = Object.values(ACHIEVEMENTS);
    const done  = all.filter(a => unlocked[a.id]).length;
    const total = all.length;
    const pct   = Math.round((done / total) * 100);

    // Groupe par catégorie
    const categories = {};
    all.forEach(a => {
      const cat = a.category ?? 'other';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(a);
    });

    // Catégories dans un ordre précis
    const ORDER = ['league','progression','collection','level','combat','roguelite'];

    body.innerHTML = `
      <div class="ach-global-progress">
        <div class="ach-global-count">${done} / ${total} succès débloqués</div>
        <div class="ach-global-bar">
          <div class="ach-global-fill" style="width:${pct}%"></div>
        </div>
      </div>

      ${ORDER.filter(c => categories[c]?.length).map(cat => `
        <div class="ach-category">
          <div class="ach-cat-title">${CATEGORY_LABELS[cat] ?? cat}</div>
          <div class="ach-grid">
            ${categories[cat].map(a => {
              const isUnlocked = !!unlocked[a.id];
              const date = isUnlocked
                ? new Date(unlocked[a.id].unlockedAt).toLocaleDateString('fr-FR', {
                    day:'2-digit', month:'2-digit', year:'numeric',
                  })
                : null;
              return `
                <div class="ach-item ${isUnlocked ? 'unlocked' : 'locked'}">
                  <span class="ach-item-icon">${isUnlocked ? (a.label.split(' ')[0] ?? '✅') : '🔒'}</span>
                  <div class="ach-item-info">
                    <div class="ach-item-label" title="${a.label}">
                      ${isUnlocked ? a.label : '???'}
                    </div>
                    <div class="ach-item-desc">
                      ${isUnlocked ? a.desc : 'Non débloqué'}
                    </div>
                    ${date ? `<div class="ach-item-date">✓ ${date}</div>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    `;
  },
};
