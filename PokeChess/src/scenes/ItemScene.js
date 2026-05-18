// ─────────────────────────────────────────────────────────────────────────────
// ItemScene.js
// Événement Objet — choix gratuit parmi 3 objets équipables
// ─────────────────────────────────────────────────────────────────────────────

import { ITEMS }           from '../data/items.js';
import { addToInventory }  from '../data/runState.js';

const CARD_W   = 110;
const CARD_H   = 150;
const CARD_GAP = 20;

export class ItemScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ItemScene' });
    this.nextNodeData = null;
    this.offered      = [];
    this.selected     = null;
    this.cardObjects  = [];
    this.confirmBtn   = null;
    this.infoText     = null;
  }

  init(data) {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.nextNodeData = data;
    this.selected     = null;
    this.cardObjects  = [];

    // 3 objets équipables aléatoires (pas pokeball ni rappel ni super_bonbon)
    const equippables = Object.values(ITEMS)
      .filter(i => i.type === 'equippable')
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    this.offered = equippables;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    // ── Titre ─────────────────────────────────────────────────────────────
    this.add.text(W / 2, 14, 'PokeChess', {
      fontSize: '20px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 42, '🎒 Objet Trouvé !', {
      fontSize: '16px', fill: '#d980fa', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 66, 'Choisissez un objet gratuitement', {
      fontSize: '12px', fill: '#a0aec0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    // ── Cartes ────────────────────────────────────────────────────────────
    const totalW = 3 * CARD_W + 2 * CARD_GAP;
    const startX = Math.round((W - totalW) / 2);
    const cardY  = Math.round(H / 2 - CARD_H / 2) - 20;

    this.offered.forEach((item, i) => {
      this._createCard(item, i, startX + i * (CARD_W + CARD_GAP), cardY);
    });

    // ── Info ──────────────────────────────────────────────────────────────
    this.infoText = this.add.text(W / 2, H - 48, '', {
      fontSize: '12px', fill: '#fc5c65', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(10);

    // ── Bouton confirmer ──────────────────────────────────────────────────
    this.confirmBtn = this.add.text(W / 2, H - 16,
      '[ Choisir cet objet ]', {
      fontSize: '14px', fill: '#4a5568', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(10);

    // ── Bouton passer ─────────────────────────────────────────────────────
    this.add.text(W / 2, H - 48, '[ Passer ]', {
      fontSize: '12px', fill: '#718096', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(10)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerover', function() { this.setStyle({ fill: '#a0aec0' }); })
      .on('pointerout',  function() { this.setStyle({ fill: '#718096' }); })
      .on('pointerdown', () => this._proceed());

    // ── UIScene ───────────────────────────────────────────────────────────
    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
  }

  _createCard(item, idx, x, y) {
    const bg = this.add.graphics().setDepth(1);
    bg.fillStyle(0x16213e, 0.95);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.lineStyle(2, 0x334466, 1);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);

    this.add.text(x + CARD_W / 2, y + 32, item.emoji, {
      fontSize: '36px', fontFamily: 'sans-serif'
    }).setOrigin(0.5).setDepth(2);

    this.add.text(x + CARD_W / 2, y + 68, item.name, {
      fontSize: '11px', fill: '#e2e8f0', fontFamily: 'sans-serif',
      align: 'center', wordWrap: { width: CARD_W - 8 }
    }).setOrigin(0.5).setDepth(2);

    this.add.text(x + CARD_W / 2, y + 98, item.description, {
      fontSize: '9px', fill: '#a0aec0', fontFamily: 'sans-serif',
      align: 'center', wordWrap: { width: CARD_W - 8 }
    }).setOrigin(0.5).setDepth(2);

    const hit = this.add.rectangle(
      x + CARD_W / 2, y + CARD_H / 2,
      CARD_W, CARD_H, 0xffffff, 0
    ).setDepth(3).setInteractive({ cursor: 'pointer' });

    hit.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x1a2e4a, 0.95);
      bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
      bg.lineStyle(2.5, 0xd980fa, 1);
      bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
    });

    hit.on('pointerout', () => {
      if (this.selected?.id !== item.id) {
        bg.clear();
        bg.fillStyle(0x16213e, 0.95);
        bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
        bg.lineStyle(2, 0x334466, 1);
        bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
      }
    });

    hit.on('pointerdown', () => this._selectCard(item, idx, bg, x, y));
    this.cardObjects.push({ item, bg, hit, x, y });
  }

  _selectCard(item, idx, bg, x, y) {
    this.selected = item;

    // Reset toutes les cartes
    this.cardObjects.forEach(c => {
      c.bg.clear();
      c.bg.fillStyle(0x16213e, 0.95);
      c.bg.fillRoundedRect(c.x, c.y, CARD_W, CARD_H, 10);
      c.bg.lineStyle(2, 0x334466, 1);
      c.bg.strokeRoundedRect(c.x, c.y, CARD_W, CARD_H, 10);
    });

    // Surligne la sélection
    bg.clear();
    bg.fillStyle(0x1a2e4a, 0.95);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.lineStyle(2.5, 0xffd700, 1);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);

    // Active le bouton confirmer
    this.confirmBtn
      .setStyle({ fill: '#44cc44' })
      .setInteractive({ cursor: 'pointer' })
      .off('pointerdown')
      .on('pointerover', () => this.confirmBtn.setStyle({ fill: '#fff' }))
      .on('pointerout',  () => this.confirmBtn.setStyle({ fill: '#44cc44' }))
      .on('pointerdown', () => this._confirm());
  }

  _confirm() {
    if (!this.selected) return;
    addToInventory(this.registry, this.selected.id);
    this._proceed();
  }

  _proceed() {
    const data = this.nextNodeData;
    this.scene.start('MapScene', {
      mapNodes:  data.mapNodes,
      startNode: data.startNode,
      mapIndex:  data.mapIndex,
    });
  }
}