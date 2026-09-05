// ─────────────────────────────────────────────────────────────────────────────
// MetaTreeUI.js — Arbre transversal du Destin (overlay autonome).
// Se paie avec meta.talentPoints, comme les arbres de type. Verrouillé tant
// que les 18 arbres de type ne sont pas complets.
// ─────────────────────────────────────────────────────────────────────────────

import { META_BRANCHES, META_TREE_TOTAL_COST, isMetaTreeUnlocked,
         getTypeTreeProgress, getMetaEffects, isNodeAvailable,
         getMetaProgress } from '../data/metaTree.js';

export const MetaTreeUI = {
  _overlay: null,

  open() {
    if (!this._overlay) this._build();
    this._overlay.classList.remove('hidden');
    this._render();
  },
  close() { this._overlay?.classList.add('hidden'); },

  _meta() { return window.SaveManager?.loadMeta?.() ?? {}; },

  _build() {
    const o = document.createElement('div');
    o.className = 'ui-overlay meta-tree-overlay hidden';
    o.innerHTML = `
      <div class="meta-tree-panel">
        <div class="meta-tree-topbar">
          <div class="meta-tree-title">✨ Destin</div>
          <button class="meta-tree-close btn-close">✕</button>
        </div>
        <div class="meta-tree-body"></div>
      </div>`;
    document.body.appendChild(o);
    this._overlay = o;
    o.querySelector('.meta-tree-close').addEventListener('click', () => this.close());
    o.addEventListener('click', (e) => { if (e.target === o) this.close(); });
  },

  _render() {
    const meta   = this._meta();
    const body   = this._overlay.querySelector('.meta-tree-body');
    const points = meta.talentPoints ?? 0;

    if (!isMetaTreeUnlocked(meta)) {
      const { done, total } = getTypeTreeProgress(meta);
      const pct = Math.round((done / total) * 100);
      body.innerHTML = `
        <div class="meta-tree-locked">
          <div class="meta-tree-lock-icon">🔒</div>
          <p>L'arbre du Destin s'ouvre quand les 18 arbres de type sont complets.</p>
          <div class="meta-progress"><div class="meta-progress-fill" style="width:${pct}%"></div></div>
          <p class="meta-tree-progress-text">${done} / ${total} nœuds débloqués</p>
        </div>`;
      return;
    }

    const fx   = getMetaEffects(meta);
    const prog = getMetaProgress(meta);
    body.innerHTML = `
      <div class="meta-tree-header">
        <span class="meta-points">⭐ ${points} point${points > 1 ? 's' : ''}</span>
        <span class="meta-total">${prog.done}/${prog.total} nœuds · ${prog.spent}/${META_TREE_TOTAL_COST} pts</span>
      </div>
      <div class="meta-summary">${this._summary(fx)}</div>
      ${META_BRANCHES.map(b => this._branchHtml(meta, b, points)).join('')}`;

    body.querySelectorAll('.meta-node-btn').forEach(btn =>
      btn.addEventListener('click', () => this._unlock(btn.dataset.branch, +btn.dataset.index)));
  },

  _summary(fx) {
    const parts = [];
    if (fx.luck)         parts.push(`🍀 Chance +${fx.luck}`);
    if (fx.critChance)   parts.push(`🎯 Crit +${Math.round(fx.critChance * 100)}%`);
    if (fx.critMult)     parts.push(`💥 Dégâts crit +${Math.round(fx.critMult * 100)}%`);
    if (fx.coinMult)     parts.push(`💰 Pièces +${Math.round(fx.coinMult * 100)}%`);
    if (fx.shopDiscount) parts.push(`🏷 Prix -${Math.round(fx.shopDiscount * 100)}%`);
    if (fx.shopSlots)    parts.push(`🛒 +${fx.shopSlots} emplacement`);
    if (fx.itemChoices)  parts.push(`🎁 +${fx.itemChoices} objet proposé`);
    if (fx.evasion)      parts.push(`💨 Esquive +${Math.round(fx.evasion * 100)}%`);
    if (fx.startCoins)   parts.push(`🪙 +${fx.startCoins} pièces au départ`);
    return parts.length ? parts.join(' · ') : '<em>Aucun bonus actif</em>';
  },

  _branchHtml(meta, branch, points) {
    const unlocked = meta.metaTree?.[branch.id] ?? [];
    const nodes = branch.nodes.map((node, i) => {
      const isOn      = unlocked[i] === true;
      const available = isNodeAvailable(meta, branch.id, i);
      const canAfford = points >= node.cost;
      const cls = isOn ? 'unlocked' : available ? (canAfford ? 'available' : 'poor') : 'locked';
      const action = isOn
        ? '<span class="meta-node-done">✓ Acquis</span>'
        : available
          ? (canAfford
              ? `<button class="meta-node-btn btn-primary" data-branch="${branch.id}" data-index="${i}">Débloquer (${node.cost})</button>`
              : `<span class="meta-node-need">⭐ ${node.cost} requis</span>`)
          : '<span class="meta-node-need">🔒 Nœud précédent requis</span>';
      return `
        <div class="meta-node ${cls} ${node.keystone ? 'keystone' : ''}">
          <div class="meta-node-main">
            <div class="meta-node-name">${node.keystone ? '★ ' : ''}${node.name}</div>
            <div class="meta-node-desc">${node.desc}</div>
          </div>
          <div class="meta-node-action">${action}</div>
        </div>`;
    }).join('');
    return `
      <div class="meta-branch">
        <div class="meta-branch-head">${branch.emoji} <strong>${branch.name}</strong>
          <span class="meta-branch-desc">${branch.desc}</span></div>
        ${nodes}
      </div>`;
  },

  _unlock(branchId, index) {
    const meta   = this._meta();
    const branch = META_BRANCHES.find(b => b.id === branchId);
    const node   = branch?.nodes[index];
    if (!node) return;
    if (!isNodeAvailable(meta, branchId, index)) return;
    const points = meta.talentPoints ?? 0;
    if (points < node.cost) return;

    const tree = { ...(meta.metaTree ?? {}) };
    const arr  = [...(tree[branchId] ?? [])];
    while (arr.length < branch.nodes.length) arr.push(false);
    arr[index] = true;
    tree[branchId] = arr;

    window.SaveManager?.saveMeta({ ...meta, metaTree: tree, talentPoints: points - node.cost });
    // Le multiplicateur de pièces est relu par addCoins : on le rafraîchit.
    const nfx = getMetaEffects(this._meta());
    window.__metaCoinMult   = nfx.coinMult;
    window.__metaStartCoins = nfx.startCoins;
    this._render();
  },
};