// ─────────────────────────────────────────────────────────────────────────────
// ShopScene.js
// Boutique entre les événements — vente d'objets consommables et équipables.
// Toujours au moins 1 PokéBall et 1 Rappel dans le catalogue.
// ─────────────────────────────────────────────────────────────────────────────

import { ITEMS } from '../data/items.js';
import {
  getRunState, addCoins, removeCoins,
  addPokeballs, addToInventory
} from '../data/runState.js';

const CARD_W   = 100;
const CARD_H   = 140;
const CARD_GAP = 16;

export class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
    this.nextNodeData = null;
    this.catalog      = [];     // ids des objets proposés
    this.cardObjects  = [];     // objets Phaser des cartes
    this.coinText     = null;
    this.infoText     = null;
  }

  init(data) {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.nextNodeData = data;
    this.cardObjects  = [];

    // Génère le catalogue : 5 objets dont PokéBall + Rappel obligatoires
    this.catalog = this._generateCatalog();
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    // ── Titre ─────────────────────────────────────────────────────────────
    this.add.text(W / 2, 14, 'PokeChess', {
      fontSize: '20px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 42, '🛒 Boutique', {
      fontSize: '16px', fill: '#74b9ff', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 66, 'Achetez des objets pour votre aventure', {
      fontSize: '12px', fill: '#a0aec0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    // ── Monnaie ───────────────────────────────────────────────────────────
    const state = getRunState(this.registry);
    this.coinText = this.add.text(W - 16, 16, `💰 ${state.coins ?? 0}`, {
      fontSize: '14px', fill: '#ffd700', fontFamily: 'sans-serif',
      backgroundColor: '#1a1a2e', padding: { x: 8, y: 4 }
    }).setOrigin(1, 0).setDepth(10);

    // ── Pokéballs ─────────────────────────────────────────────────────────
    this.pokeballText = this.add.text(16, 16, `🔴 ${state.pokeballs ?? 0}`, {
      fontSize: '14px', fill: '#ff6b6b', fontFamily: 'sans-serif',
      backgroundColor: '#1a1a2e', padding: { x: 8, y: 4 }
    }).setOrigin(0, 0).setDepth(10);

    // ── Cartes des objets ─────────────────────────────────────────────────
    const totalW = this.catalog.length * (CARD_W + CARD_GAP) - CARD_GAP;
    const startX = Math.round((W - totalW) / 2);
    const cardY  = Math.round(H / 2 - CARD_H / 2) - 20;

    this.catalog.forEach((itemId, i) => {
      const item = ITEMS[itemId];
      if (!item) return;
      this._createCard(item, startX + i * (CARD_W + CARD_GAP), cardY);
    });

    // ── Info text ─────────────────────────────────────────────────────────
    this.infoText = this.add.text(W / 2, H - 48, '', {
      fontSize: '12px', fill: '#fc5c65', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(10);

    // ── Bouton quitter ────────────────────────────────────────────────────
    const leaveBtn = this.add.text(W / 2, H - 16,
      '[ Quitter la boutique ]', {
      fontSize: '14px', fill: '#718096', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(10).setInteractive({ cursor: 'pointer' });

    leaveBtn.on('pointerover', () => leaveBtn.setStyle({ fill: '#a0aec0' }));
    leaveBtn.on('pointerout',  () => leaveBtn.setStyle({ fill: '#718096' }));
    leaveBtn.on('pointerdown', () => this._leave());

    // ── UIScene ───────────────────────────────────────────────────────────
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }
  }

  // ── Génère le catalogue : PokéBall + Rappel + 3 aléatoires ───────────
  _generateCatalog() {
    const mandatory = ['pokeball', 'rappel'];
    const optional  = Object.keys(ITEMS)
      .filter(id => !mandatory.includes(id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [...mandatory, ...optional];
  }

  // ── Crée une carte d'objet ────────────────────────────────────────────
  _createCard(item, x, y) {
    const state     = getRunState(this.registry);
    const canAfford = (state.coins ?? 0) >= item.price;

    // Fond
    const bg = this.add.graphics().setDepth(1);
    bg.fillStyle(canAfford ? 0x16213e : 0x0d1117, 0.95);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.lineStyle(2, canAfford ? 0x4a90d9 : 0x334466, 1);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);

    // Emoji objet
    this.add.text(
      Math.round(x + CARD_W / 2),
      Math.round(y + 28),
      item.emoji,
      { fontSize: '32px', fontFamily: 'sans-serif' }
    ).setOrigin(0.5, 0.5).setDepth(2);

    // Nom
    this.add.text(
      Math.round(x + CARD_W / 2),
      Math.round(y + 58),
      item.name,
      { fontSize: '11px', fill: '#e2e8f0', fontFamily: 'sans-serif',
        align: 'center', wordWrap: { width: CARD_W - 8 } }
    ).setOrigin(0.5, 0.5).setDepth(2);

    // Description
    this.add.text(
      Math.round(x + CARD_W / 2),
      Math.round(y + 84),
      item.description,
      { fontSize: '9px', fill: '#a0aec0', fontFamily: 'sans-serif',
        align: 'center', wordWrap: { width: CARD_W - 8 } }
    ).setOrigin(0.5, 0.5).setDepth(2);

    // Prix
    const priceColor = canAfford ? '#ffd700' : '#fc5c65';
    this.add.text(
      Math.round(x + CARD_W / 2),
      Math.round(y + CARD_H - 18),
      `${item.price} 💰`,
      { fontSize: '13px', fill: priceColor, fontFamily: 'sans-serif',
        fontStyle: 'bold' }
    ).setOrigin(0.5, 0.5).setDepth(2);

    // Zone de clic (uniquement si les moyens suffisent)
    if (canAfford) {
      const hitArea = this.add.rectangle(
        x + CARD_W / 2, y + CARD_H / 2,
        CARD_W, CARD_H, 0xffffff, 0
      ).setDepth(3).setInteractive({ cursor: 'pointer' });

      hitArea.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x1a2e4a, 0.95);
        bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
        bg.lineStyle(2.5, 0xffd700, 1);
        bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
      });

      hitArea.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x16213e, 0.95);
        bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
        bg.lineStyle(2, 0x4a90d9, 1);
        bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
      });

      hitArea.on('pointerdown', () => this._buy(item, bg, hitArea, x, y));
      this.cardObjects.push({ bg, hitArea, item, x, y });
    } else {
      this.cardObjects.push({ bg, hitArea: null, item, x, y });
    }
  }

  // ── Achat d'un objet ──────────────────────────────────────────────────
  _buy(item, bg, hitArea, x, y) {
    const state = getRunState(this.registry);
    if ((state.coins ?? 0) < item.price) {
      this.infoText.setText('Pas assez de 💰 !');
      return;
    }

    // Déduit le prix
    removeCoins(this.registry, item.price);

    // Applique l'effet selon le type d'objet
    if (item.id === 'pokeball') {
      addPokeballs(this.registry, 1);
      this.infoText.setText('Poké Ball achetée ! 🔴');
    } else {
      addToInventory(this.registry, item.id);
      this.infoText.setText(`${item.name} acheté ! ${item.emoji}`);
    }

    // Met à jour les affichages
    const newState = getRunState(this.registry);
    this.coinText.setText(`💰 ${newState.coins ?? 0}`);
    this.pokeballText.setText(`🔴 ${newState.pokeballs ?? 0}`);

    // Grises la carte si plus les moyens
    if ((newState.coins ?? 0) < item.price) {
      hitArea?.disableInteractive();
      bg.clear();
      bg.fillStyle(0x0d1117, 0.95);
      bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
      bg.lineStyle(2, 0x334466, 1);
      bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
    }

    // Grise toutes les cartes qu'on ne peut plus se payer
    this._refreshAffordability();
  }

  // ── Rafraîchit l'état des cartes selon la monnaie restante ───────────
  _refreshAffordability() {
    const state = getRunState(this.registry);
    const coins = state.coins ?? 0;

    this.cardObjects.forEach(({ bg, hitArea, item, x, y }) => {
      if (!hitArea) return;
      if (coins < item.price) {
        hitArea.disableInteractive();
        bg.clear();
        bg.fillStyle(0x0d1117, 0.95);
        bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
        bg.lineStyle(2, 0x334466, 1);
        bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
      }
    });
  }

  // ── Quitte la boutique → retour à la map ─────────────────────────────
  _leave() {
    const data = this.nextNodeData;
    this.scene.start('MapScene', {
      mapNodes:  data.mapNodes,
      startNode: data.startNode,
      mapIndex:  data.mapIndex,
    });
  }
}