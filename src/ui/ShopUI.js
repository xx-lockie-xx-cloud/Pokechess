import { rollRarity, RARITY_META } from '../data/rarity.js';
import { getLuck } from '../data/luck.js';
import { getMetaEffects } from '../data/metaTree.js';
import { RARITY_TIERS } from '../data/rarity.js';
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
    this._rerollUsed = false;   // milestone Second Souffle : 1 par visite
    this._catalog  = this._generateCatalog();
    this._render();
    this._bindButtons();
  },

  _generateCatalog() {
    // La pokéball n'est plus vendue en boutique — achat direct dans les rencontres
    const mandatory = ['rappel', 'restes'];
    const state     = getRunState(this._registry);
    const fx        = getMetaEffects(window.SaveManager?.loadMeta());
    const slots     = RelicEngine.shopSlots(state?.relic?.id) + fx.shopSlots;
    // Tirage pondéré : privilégie les objets utiles à l'équipe du joueur
    const optional  = pickEquippableItems(slots, state?.playerBank ?? [],
                                          { exclude: mandatory })
                        .map(i => i.id);
    return [...mandatory, ...optional].map(id => {
      let rarity = rollRarity(getLuck());
      // Keystone Main du Destin : jamais de rarete normale en boutique
      if (fx.shopMinRare && rarity === 'normal') rarity = RARITY_TIERS[1];
      return { id, rarity };
    });
  },

  // Prix affiche et debite, remise du noeud Negociant incluse.
  _price(item) {
    const d = getMetaEffects(window.SaveManager?.loadMeta()).shopDiscount;
    return Math.max(1, Math.round(item.price * (1 - d)));
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

      const price     = this._price(item);
      const canAfford = coins >= price;
      const card = document.createElement('div');
      card.className = `poke-card ${canAfford ? '' : 'disabled'}${rarity !== 'normal' ? ' rarity-' + rarity : ''}`;
      card.dataset.itemId = entry.id;

      card.innerHTML = `
        <span style="font-size:32px;margin-bottom:4px">${item.emoji}</span>
        <span class="card-name">${item.name}</span>
        ${rarity !== 'normal' ? `<span class="card-rarity" style="color:${RARITY_META[rarity].color}">${RARITY_META[rarity].label}</span>` : ''}
        <span class="card-types" style="text-align:center;font-size:9px;
              color:var(--text-muted);padding:0 4px">${describeItem(resolveHeldItem(entry))}</span>
        <span class="card-price">${price} 💰</span>
      `;

      if (canAfford) {
        card.addEventListener('click', () => this._buy(entry));
      }

      container.appendChild(card);
    });

    const info = document.getElementById('shop-info');
    if (info) info.textContent = `💰 ${coins} disponibles`;

    // Milestone Second Souffle : un rafraichissement gratuit par visite
    const canReroll = getMetaEffects(window.SaveManager?.loadMeta()).shopReroll
                      && !this._rerollUsed;
    let btn = document.getElementById('btn-shop-reroll');
    if (canReroll) {
      if (!btn) {
        btn = document.createElement('button');
        btn.id        = 'btn-shop-reroll';
        btn.className = 'btn-secondary';
        btn.textContent = '🔄 Rafraîchir (gratuit)';
        container.parentNode?.insertBefore(btn, container.nextSibling);
      }
      btn.onclick = () => {
        this._rerollUsed = true;
        this._catalog    = this._generateCatalog();
        this._render();
      };
      btn.style.display = '';
    } else if (btn) {
      btn.style.display = 'none';
    }
  },

  async _buy(entry) {
    const item  = ITEMS[entry.id];
    if (!item) return;
    const state = getRunState(this._registry);
    const price = this._price(item);
    if ((state.coins ?? 0) < price) return;

    // Fenêtre de confirmation aux couleurs du jeu
    const ok = await (window.UIManager?.confirm?.({
      icon:    item.emoji ?? '🛒',
      title:   `Acheter ${item.name} ?`,
      message: `Cet achat coûte <strong>${price} 💰</strong>.<br>
                Il te restera <strong>${(state.coins ?? 0) - price} 💰</strong>.`,
      yesLabel: 'Acheter',
      noLabel:  'Annuler',
    }) ?? Promise.resolve(confirm(`Acheter ${item.name} pour ${price} 💰 ?`)));
    if (!ok) return;

    removeCoins(this._registry, price);
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