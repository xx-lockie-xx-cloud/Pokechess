import { rollRarity, RARITY_META } from '../data/rarity.js';
import { getLuck } from '../data/luck.js';
// ─────────────────────────────────────────────────────────────────────────────
// ShopUI.js — Boutique (sans pokéballs, achat direct en pièces dans WildUI)
// ─────────────────────────────────────────────────────────────────────────────

import { ITEMS, pickEquippableItems,
         describeItem, resolveHeldItem }   from '../data/items.js';
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
    return [...mandatory, ...optional].map(id => ({ id, rarity: rollRarity(getLuck()) }));
  },

  _render() {
    const state     = getRunState(this._registry);
    const coins     = state.coins ?? 0;
    const container = document.getElementById('shop-cards');
    if (!container) return;
    container.innerHTML = '';

    this._catalog.forEach(entry => {
      const item = ITEMS[entry.id];
      if (!item) return;
      const rarity = entry.rarity ?? 'normal';

      const canAfford = coins >= item.price;
      const card = document.createElement('div');
      card.className = `poke-card ${canAfford ? '' : 'disabled'}${rarity !== 'normal' ? ' rarity-' + rarity : ''}`;
      card.dataset.itemId = entry.id;

      card.innerHTML = `
        <span style="font-size:32px;margin-bottom:4px">${item.emoji}</span>
        <span class="card-name">${item.name}</span>
        ${rarity !== 'normal' ? `<span class="card-rarity" style="color:${RARITY_META[rarity].color}">${RARITY_META[rarity].label}</span>` : ''}
        <span class="card-types" style="text-align:center;font-size:9px;
              color:var(--text-muted);padding:0 4px">${describeItem(resolveHeldItem(entry))}</span>
        <span class="card-price">${item.price} 💰</span>
      `;

      if (canAfford) {
        card.addEventListener('click', () => this._buy(entry));
      }

      container.appendChild(card);
    });

    const info = document.getElementById('shop-info');
    if (info) info.textContent = `💰 ${coins} disponibles`;
  },

  async _buy(entry) {
    const item  = ITEMS[entry.id];
    if (!item) return;
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
    addToInventory(this._registry, { id: entry.id, rarity: entry.rarity });
    // L'objet acheté n'est plus proposé (slot consommé)
    this._catalog = this._catalog.filter(e => e !== entry);
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