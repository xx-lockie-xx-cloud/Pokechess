// ─────────────────────────────────────────────────────────────────────────────
// TalentTreeUI.js — Interface de gestion des arbres de talents
// Accessible depuis le menu principal
// ─────────────────────────────────────────────────────────────────────────────
import { TALENT_TREES, getTalentCost } from '../data/levelSystem.js';
import { SaveManager }                from '../SaveManager.js';

const TYPE_COLORS = {
  Feu:'#e74c3c', Eau:'#3498db', Plante:'#2ecc71', Électrik:'#f1c40f',
  Psy:'#9b59b6', Glace:'#a8d8ea', Combat:'#c0392b', Poison:'#8e44ad',
  Sol:'#d4a017', Vol:'#85c1e9', Insecte:'#a9cce3', Roche:'#7f8c8d',
  Spectre:'#6c3483', Dragon:'#1a5276', Ténèbres:'#705848',
  Acier:'#b8b8d0', Fée:'#ee99ac', Normal:'#aab7b8',
};
const TYPE_ICONS = {
  Feu:'🔥', Eau:'💧', Plante:'🌿', Électrik:'⚡', Psy:'🔮',
  Glace:'❄️', Combat:'👊', Poison:'☠️', Sol:'🏔', Vol:'🦅',
  Insecte:'🦋', Roche:'🪨', Spectre:'👻', Dragon:'🐉', Ténèbres:'🌑',
  Acier:'⚙️', Fée:'🧚', Normal:'⭐',
};

export const TalentTreeUI = {
  _overlay: null,
  _activeType: null,

  init() {
    this._overlay = document.getElementById('overlay-talent-tree');
    if (!this._overlay) return;

    document.getElementById('btn-talent-tree-close')
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
    const meta     = SaveManager.loadMeta();
    const points   = meta.talentPoints ?? 0;
    const container = document.getElementById('talent-tree-content');
    if (!container) return;

    // Exporte TALENT_TREES pour CombatUI
    window.__TALENT_TREES__ = TALENT_TREES;

    container.innerHTML = `
      <div class="tt-header">
        <div class="tt-points">
          <span class="tt-points-icon">⭐</span>
          <span class="tt-points-val">${points}</span>
          <span class="tt-points-label">points disponibles</span>
        </div>
        <p class="tt-hint">Gagnez 1 point par arène vaincue. Chaque type a 3 nœuds à débloquer.</p>
      </div>

      <div class="tt-types-grid">
        ${Object.keys(TALENT_TREES).map(type => {
          const color    = TYPE_COLORS[type] ?? '#888';
          const icon     = TYPE_ICONS[type] ?? '?';
          const tree     = TALENT_TREES[type];
          const unlocked = meta.talentTree?.[type] ?? [];
          const total    = unlocked.filter(Boolean).length;
          return `
            <div class="tt-type-card ${this._activeType === type ? 'active' : ''}"
                 data-type="${type}" style="--tc:${color}">
              <div class="tt-type-icon">${icon}</div>
              <div class="tt-type-name">${type}</div>
              <div class="tt-type-progress">${'●'.repeat(total)}${'○'.repeat(3 - total)}</div>
            </div>`;
        }).join('')}
      </div>

      <div class="tt-detail" id="tt-detail">
        ${this._activeType
          ? this._renderTree(meta, this._activeType)
          : '<p class="tt-select-hint">← Sélectionne un type pour voir son arbre</p>'}
      </div>
    `;

    // Listeners type cards
    container.querySelectorAll('.tt-type-card').forEach(card => {
      card.addEventListener('click', () => {
        this._activeType = card.dataset.type;
        this._render();
      });
    });

    // Listeners boutons déblocage
    container.querySelectorAll('.tt-unlock-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type  = btn.dataset.type;
        const index = parseInt(btn.dataset.index);
        this._unlockNode(type, index);
      });
    });
  },

  _renderTree(meta, type) {
    const tree     = TALENT_TREES[type];
    const unlocked = meta.talentTree?.[type] ?? [false, false, false];
    const points   = meta.talentPoints ?? 0;
    const color    = TYPE_COLORS[type] ?? '#888';
    const icon     = TYPE_ICONS[type] ?? '?';

    return `
      <div class="tt-tree-header">
        <span style="font-size:22px">${icon}</span>
        <span class="tt-tree-title" style="color:${color}">${type}</span>
      </div>
      <div class="tt-nodes">
        ${tree.map((node, i) => {
          const isUnlocked  = unlocked[i] === true;
          const prevUnlocked = i === 0 || unlocked[i-1] === true;
          const canAfford   = points >= node.cost;
          const canUnlock   = !isUnlocked && prevUnlocked && canAfford;
          const locked      = !isUnlocked && !prevUnlocked;

          return `
            ${i > 0 ? `<div class="tt-connector ${unlocked[i-1] ? 'lit' : ''}"></div>` : ''}
            <div class="tt-node ${isUnlocked ? 'unlocked' : locked ? 'locked' : 'available'}"
                 style="--tc:${color}">
              <div class="tt-node-header">
                <span class="tt-node-name">${node.name}</span>
                <span class="tt-node-cost">${'⭐'.repeat(node.cost)}</span>
              </div>
              <p class="tt-node-desc">${node.desc}</p>
              ${isUnlocked
                ? `<div class="tt-node-check">✅ Débloqué</div>`
                : locked
                  ? `<div class="tt-node-locked">🔒 Débloquer le nœud précédent d'abord</div>`
                  : canAfford
                    ? `<button class="tt-unlock-btn" data-type="${type}" data-index="${i}">
                         Débloquer (${node.cost} pt${node.cost > 1 ? 's' : ''})
                       </button>`
                    : `<div class="tt-node-locked">🔒 ${node.cost} pt${node.cost > 1 ? 's' : ''} requis</div>`
              }
            </div>`;
        }).join('')}
      </div>`;
  },

  _unlockNode(type, index) {
    const meta     = SaveManager.loadMeta();
    const points   = meta.talentPoints ?? 0;
    const cost     = getTalentCost(type, index);
    const unlocked = meta.talentTree?.[type] ?? [false, false, false];

    if (points < cost) return;
    if (unlocked[index]) return;
    if (index > 0 && !unlocked[index - 1]) return;

    const newTree    = { ...(meta.talentTree ?? {}), [type]: [...unlocked] };
    newTree[type][index] = true;

    SaveManager.saveMeta({
      ...meta,
      talentPoints: points - cost,
      talentTree:   newTree,
    });

    this._render();
  },
};