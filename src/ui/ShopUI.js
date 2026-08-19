// ─────────────────────────────────────────────────────────────────────────────
// ShopUI.js — Boutique (sans pokéballs, achat direct en pièces dans WildUI)
// ─────────────────────────────────────────────────────────────────────────────

import { ITEMS, pickEquippableItems }      from '../data/items.js';
import { RelicEngine }                    from '../combat/RelicEngine.js';
import { getRunState, removeCoins,
         addToInventory }                 from '../data/runState.js';

export const ShopUI = {
  _data:     null,
  _registry: null,
  _onDone:   null,
  _catalog:  [],

  init(data, registry, onDone) {
    this._data     = data;
    this._registry = registry;
    this._onDone   = onDone;
    this._catalog  = this._generateCatalog();
    this._render();
    this._bindButtons();
  },

  _generateCatalog() {
    // La pokéball n'est plus vendue en boutique — achat direct dans les rencontres
    const mandatory = ['rappel', 'restes'];
    const state     = getRunState(this._registry);
    const slots     = RelicEngine.shopSlots(state?.relic?.id);
    // Tirage pondéré : privilégie les objets utiles à l'équipe du joueur
    const optional  = pickEquippableItems(slots, state?.playerBank ?? [],
                                          { exclude: mandatory })
                        .map(i => i.id);
    return [...mandatory, ...optional];
  },

  _render() {
    const state     = getRunState(this._registry);
    const coins     = state.coins ?? 0;
    const container = document.getElementById('shop-cards');
    if (!container) return;
    container.innerHTML = '';

    this._catalog.forEach(itemId => {
      const item = ITEMS[itemId];
      if (!item) return;

      const canAfford = coins >= item.price;
      const card = document.createElement('div');
      card.className = `poke-card ${canAfford ? '' : 'disabled'}`;
      card.dataset.itemId = itemId;

      card.innerHTML = `
        <span style="font-size:32px;margin-bottom:4px">${item.emoji}</span>
        <span class="card-name">${item.name}</span>
        <span class="card-types" style="text-align:center;font-size:9px;
              color:var(--text-muted);padding:0 4px">${item.description}</span>
        <span class="card-price">${item.price} 💰</span>
      `;

      if (canAfford) {
        card.addEventListener('click', () => this._buy(item));
      }

      container.appendChild(card);
    });

    const info = document.getElementById('shop-info');
    if (info) info.textContent = `💰 ${coins} disponibles`;
  },

  async _buy(item) {
    const state = getRunState(this._registry);
    if ((state.coins ?? 0) < item.price) return;

    // Fenêtre de confirmation aux couleurs du jeu
    const ok = await (window.UIManager?.confirm?.({
      icon:    item.emoji ?? '🛒',
      title:   `Acheter ${item.name} ?`,
      message: `Cet achat coûte <strong>${item.price} 💰</strong>.<br>
                Il te restera <strong>${(state.coins ?? 0) - item.price} 💰</strong>.`,
      yesLabel: 'Acheter',
      noLabel:  'Annuler',
    }) ?? Promise.resolve(confirm(`Acheter ${item.name} pour ${item.price} 💰 ?`)));
    if (!ok) return;

    removeCoins(this._registry, item.price);
    addToInventory(this._registry, item.id);
    // Succès immédiats liés à l'inventaire (ex. Collectionneur : 5 objets différents)
    window.UIManager?.notifyAchievements?.(this._registry);

    const info = document.getElementById('shop-info');
    if (info) {
      info.style.color = 'var(--color-green)';
      info.textContent = `${item.emoji} ${item.name} acheté !`;
      setTimeout(() => {
        info.style.color = '';
        this._render();
        this._bindButtons();
      }, 800);
    }
  },

  _bindButtons() {
    const btn = document.getElementById('btn-shop-leave');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        if (this._onDone) this._onDone(this._data);
      });
    }
  },
};