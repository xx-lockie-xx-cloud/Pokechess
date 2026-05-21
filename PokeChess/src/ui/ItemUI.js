// ─────────────────────────────────────────────────────────────────────────────
// ItemUI.js — Remplace ItemScene.js (Phaser)
// ─────────────────────────────────────────────────────────────────────────────

import { ITEMS }               from '../data/items.js';
import { addToInventory }      from '../data/runState.js';

export const ItemUI = {
  _data:     null,
  _registry: null,
  _onDone:   null,
  _offered:  [],
  _selected: null,

  init(data, registry, onDone) {
    this._data     = data;
    this._registry = registry;
    this._onDone   = onDone;
    this._selected = null;

    // 3 objets équipables aléatoires
    this._offered = Object.values(ITEMS)
      .filter(i => i.type === 'equippable')
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    this._render();
    this._bindButtons();
  },

  _render() {
    const container = document.getElementById('item-cards');
    if (!container) return;
    container.innerHTML = '';

    this._offered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'poke-card';
      card.dataset.itemId = item.id;

      card.innerHTML = `
        <span style="font-size:36px;margin-bottom:6px">${item.emoji}</span>
        <span class="card-name">${item.name}</span>
        <span class="card-types" style="text-align:center;font-size:9px;
              color:var(--text-muted);padding:0 4px">${item.description}</span>
        <span class="card-price" style="color:var(--color-green)">Gratuit !</span>
      `;

      card.addEventListener('click', () => {
        this._selected = item;
        document.querySelectorAll('#item-cards .poke-card')
          .forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        const btn = document.getElementById('btn-item-confirm');
        if (btn) btn.disabled = false;
      });

      container.appendChild(card);
    });
  },

  _bindButtons() {
    // Confirmer
    const btnConfirm = document.getElementById('btn-item-confirm');
    if (btnConfirm) {
      btnConfirm.disabled = true;
      const newBtn = btnConfirm.cloneNode(true);
      btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);
      newBtn.disabled = true;
      newBtn.addEventListener('click', () => {
        if (!this._selected) return;
        addToInventory(this._registry, this._selected.id);
        if (this._onDone) this._onDone(this._data);
      });
    }

    // Passer
    const btnSkip = document.getElementById('btn-item-skip');
    if (btnSkip) {
      const newBtn = btnSkip.cloneNode(true);
      btnSkip.parentNode.replaceChild(newBtn, btnSkip);
      newBtn.addEventListener('click', () => {
        if (this._onDone) this._onDone(this._data);
      });
    }
  },
};