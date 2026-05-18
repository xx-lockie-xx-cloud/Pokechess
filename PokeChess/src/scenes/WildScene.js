import { POKEMONS, TYPE_COLORS } from '../data/pokemons.js';
import { CELL_SIZE, GRID_GAP }   from '../board.js';
import {
  getRunState, setRunState,
  addToBank, addCoins, removeCoins,
  getPokeballs, addPokeballs, removePokeball,
  getWildPool,
  BANK_MAX_SIZE
} from '../data/runState.js';

const CARD_W   = 100;
const CARD_H   = 130;
const CARD_GAP = 24;

export class WildScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WildScene' });
    this.offered      = [];
    this.selectedIdx  = null;
    this.cardObjects  = [];
    this.nextNodeData = null;
    this.coinText     = null;
    this.bankText     = null;
    this.infoText     = null;
    this.confirmBtn   = null;
    this.rerollBtn    = null;
  }

  init(data) {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.nextNodeData = data;
    this.offered      = [];
    this.cardObjects  = [];
    this.selectedIdx  = null;

    // Tire 3 pokémons selon le budget de la map
    this._rollOffered();
  }

  preload() {
    // Charge les sprites APRES que offered est défini dans init()
    this.offered.forEach(p => {
      const key = `monster_${p.id}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, p.spriteUrl);
      }
    });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    this.add.text(W / 2, 14, 'PokeChess', {
        fontSize: '20px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 42, '🌿 Rencontre Sauvage !', {
        fontSize: '15px', fill: '#78c850', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 66, 'Choisissez un pokémon à capturer', {
        fontSize: '12px', fill: '#a0aec0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    // ── Stock pokéballs (haut gauche) ─────────────────────────────────────
    const state    = getRunState(this.registry);
    const pokeballs = state.pokeballs ?? 0;
    const coins     = state.coins     ?? 0;
    const bank      = state.playerBank ?? [];

    this.pokeballText = this.add.text(16, 16, `🔴 ${pokeballs}`, {
        fontSize: '14px', fill: '#ff6b6b', fontFamily: 'sans-serif',
        backgroundColor: '#1a1a2e', padding: { x: 8, y: 4 }
    }).setOrigin(0, 0).setDepth(10);

    this.coinText = this.add.text(W - 16, 16, `💰 ${coins}`, {
        fontSize: '14px', fill: '#ffd700', fontFamily: 'sans-serif',
        backgroundColor: '#1a1a2e', padding: { x: 8, y: 4 }
    }).setOrigin(1, 0).setDepth(10);

    this.bankText = this.add.text(W / 2, 16, `🎒 ${bank.length}/${BANK_MAX_SIZE}`, {
        fontSize: '14px', fill: '#a0aec0', fontFamily: 'sans-serif',
        backgroundColor: '#1a1a2e', padding: { x: 8, y: 4 }
    }).setOrigin(0.5, 0).setDepth(10);

    // ── Cartes ────────────────────────────────────────────────────────────
    const totalW  = 3 * CARD_W + 2 * CARD_GAP;
    const startX  = Math.round((W - totalW) / 2);
    const cardY   = Math.round(H / 2 - CARD_H / 2) - 10;

    this.offered.forEach((pokemon, i) => {
        this._createCard(pokemon, i, startX + i * (CARD_W + CARD_GAP), cardY);
    });

    // ── Bouton reroll ─────────────────────────────────────────────────────
    this.rerollBtn = this.add.text(W / 2, cardY + CARD_H + 28,
        '[ 🔄 Reroll — 1 💰 ]', {
        fontSize: '13px', fill: '#ffd700', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(10).setInteractive({ cursor: 'pointer' });

    this.rerollBtn.on('pointerover', () => this.rerollBtn.setStyle({ fill: '#fff' }));
    this.rerollBtn.on('pointerout',  () => this.rerollBtn.setStyle({ fill: '#ffd700' }));
    this.rerollBtn.on('pointerdown', () => this._reroll());

    // ── Bouton passer ─────────────────────────────────────────────────────
    this.add.text(W / 2, cardY + CARD_H + 56, '[ Passer sans capturer ]', {
        fontSize: '12px', fill: '#718096', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0).setDepth(10)
        .setInteractive({ cursor: 'pointer' })
        .on('pointerover', function() { this.setStyle({ fill: '#a0aec0' }); })
        .on('pointerout',  function() { this.setStyle({ fill: '#718096' }); })
        .on('pointerdown', () => this._proceed());

    // ── Info text ─────────────────────────────────────────────────────────
    this.infoText = this.add.text(W / 2, H - 48, '', {
        fontSize: '12px', fill: '#fc5c65', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(10);

    // ── Bouton capturer ───────────────────────────────────────────────────
    // Actif uniquement si pokéballs disponibles
    const hasBalls = pokeballs > 0;
    this.confirmBtn = this.add.text(W / 2, H - 20,
        hasBalls
        ? '[ 🔴 Capturer ]'
        : '[ Pas de Poké Ball ! ]', {
        fontSize: '14px',
        fill: hasBalls ? '#4a5568' : '#718096',
        fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(10);
    }

  // ── Tire 3 pokémons selon le budget ───────────────────────────────
  _rollOffered() {
    const pool = getWildPool(this.registry, POKEMONS);

    // Si le pool est vide (début de partie), prend les 20 pokémons les plus faibles
    const source = pool.length >= 3 ? pool : [...POKEMONS]
      .sort((a, b) => {
        const sumA = a.stats.hp + a.stats.atk + a.stats.def + a.stats.spd;
        const sumB = b.stats.hp + b.stats.atk + b.stats.def + b.stats.spd;
        return sumA - sumB;
      })
      .slice(0, 20);

    // Mélange et prend 3
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    this.offered   = shuffled.slice(0, 3);
  }

  // ── Crée une carte pokémon ────────────────────────────────────────
  _createCard(pokemon, idx, x, y) {
    const s  = 12;
    const c1 = TYPE_COLORS[pokemon.types[0]] ?? 0x888888;
    const c2 = pokemon.types[1]
        ? (TYPE_COLORS[pokemon.types[1]] ?? 0x888888) : c1;

    // Fond
    const bg = this.add.graphics().setDepth(1);
    bg.fillStyle(0x16213e, 1);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.lineStyle(2, 0x334466, 1);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);

    // Coins de type
    const badge = this.add.graphics().setDepth(2);
    badge.fillStyle(c1, 0.9);
    badge.fillTriangle(x, y, x + s, y, x, y + s);
    badge.fillStyle(c1, 0.9);
    badge.fillTriangle(x + CARD_W, y + CARD_H, x + CARD_W - s, y + CARD_H, x + CARD_W, y + CARD_H - s);
    badge.fillStyle(c2, 0.9);
    badge.fillTriangle(x + CARD_W, y, x + CARD_W - s, y, x + CARD_W, y + s);
    badge.fillStyle(c2, 0.9);
    badge.fillTriangle(x, y + CARD_H, x + s, y + CARD_H, x, y + CARD_H - s);

    // Sprite
    const key = `monster_${pokemon.id}`;
    const img = this.add.image(
        Math.round(x + CARD_W / 2),
        Math.round(y + CARD_H / 2 - 18),
        this.textures.exists(key) ? key : '__DEFAULT'
    ).setDisplaySize(70, 70).setDepth(3).setInteractive({ cursor: 'pointer' });

    if (!this.textures.exists(key)) {
        this.load.once('complete', () => img.setTexture(key));
        this.load.image(key, pokemon.spriteUrl);
        this.load.start();
    }

    // Nom — stocké dans cardObjects
    const nameTag = this.add.text(
        Math.round(x + CARD_W / 2),
        Math.round(y + CARD_H - 30),
        pokemon.name,
        { fontSize: '11px', fill: '#e2e8f0', fontFamily: 'sans-serif' }
    ).setOrigin(0.5, 0.5).setDepth(3);

    // Types — stocké dans cardObjects
    const typeTag = this.add.text(
        Math.round(x + CARD_W / 2),
        Math.round(y + CARD_H - 14),
        pokemon.types.join('/'),
        { fontSize: '9px', fill: '#a0aec0', fontFamily: 'sans-serif' }
    ).setOrigin(0.5, 0.5).setDepth(3);

    img.on('pointerdown', () => this._selectCard(idx, x, y, bg, pokemon));

    // Stocke TOUS les objets pour pouvoir les détruire au reroll
    this.cardObjects.push({ bg, badge, img, nameTag, typeTag, x, y, pokemon });

  }

  // ── Sélection d'une carte ─────────────────────────────────────────
  _selectCard(idx, x, y, bg, pokemon) {
    this.selectedIdx = idx;

    // Reset toutes les bordures
    this.cardObjects.forEach(c => {
      c.bg.clear();
      c.bg.fillStyle(0x16213e, 1);
      c.bg.fillRoundedRect(c.x, c.y, CARD_W, CARD_H, 10);
      c.bg.lineStyle(2, 0x334466, 1);
      c.bg.strokeRoundedRect(c.x, c.y, CARD_W, CARD_H, 10);
    });

    // Surligne la sélection
    bg.clear();
    bg.fillStyle(0x1a2e4a, 1);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.lineStyle(2.5, 0xffd700, 1);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);

    this.infoText.setText('');

    // Active le bouton confirmer
    this.confirmBtn
      .setStyle({ fill: '#44cc44' })
      .setInteractive({ cursor: 'pointer' })
      .off('pointerdown')
      .on('pointerover', () => this.confirmBtn.setStyle({ fill: '#fff' }))
      .on('pointerout',  () => this.confirmBtn.setStyle({ fill: '#44cc44' }))
      .on('pointerdown', () => this._capture(pokemon));
  }

  // ── Capture avec pokéball ─────────────────────────────────────────────
_capture(pokemon) {
    // Vérifie les pokéballs
    const hasBall = removePokeball(this.registry);
    if (!hasBall) {
        this.infoText.setText('Plus de Poké Balls ! Achetez-en au Shop.');
        return;
    }

    // Vérifie la banque
    const added = addToBank(this.registry, pokemon);
    if (!added) {
        // Rembourse la pokéball si banque pleine
        addPokeballs(this.registry, 1);
        this.infoText.setText(`Banque pleine ! (${BANK_MAX_SIZE} max)`);
        return;
    }

    // Met à jour les affichages
    const state = getRunState(this.registry);
    this.pokeballText.setText(`🔴 ${state.pokeballs}`);
    this.bankText.setText(`🎒 ${(state.playerBank ?? []).length}/${BANK_MAX_SIZE}`);

    // Si plus de pokéballs → désactive le bouton
    if ((state.pokeballs ?? 0) <= 0) {
        this.confirmBtn
        .setText('[ Pas de Poké Ball ! ]')
        .setStyle({ fill: '#718096' })
        .disableInteractive();
    }

    // Si banque pleine → passe automatiquement
    if ((state.playerBank ?? []).length >= BANK_MAX_SIZE) {
        this.infoText.setText(`${pokemon.name} capturé ! Banque pleine.`);
        this.time.delayedCall(1000, () => this._proceed());
        return;
    }

    this.infoText.setText(`${pokemon.name} capturé ! 🔴 ${state.pokeballs} ball(s) restante(s)`);

    // Ne passe PAS automatiquement → le joueur peut encore capturer
    // Il doit cliquer "Passer" ou sélectionner un autre pokémon
    this.selectedIdx = null;
    this.confirmBtn.setStyle({ fill: '#4a5568' }).disableInteractive();
    }

  // ── Reroll ────────────────────────────────────────────────────────
  _reroll() {
    const state = getRunState(this.registry);
    if ((state.coins ?? 0) < 1) {
        this.infoText.setText('Pas assez de PokéCoins !');
        return;
    }

    removeCoins(this.registry, 1);
    const newState = getRunState(this.registry);
    this.coinText.setText(`💰 ${newState.coins}`);

    // Détruit TOUS les objets de chaque carte (bg, badge, img, nameTag, typeTag)
    this.cardObjects.forEach(c => {
        c.bg.destroy();
        c.badge.destroy();
        c.img.destroy();
        c.nameTag.destroy();
        c.typeTag.destroy();
    });
    this.cardObjects = [];
    this.selectedIdx = null;
    this.confirmBtn.setStyle({ fill: '#4a5568' }).disableInteractive();
    this.infoText.setText('');

    this._rollOffered();

    const W      = this.scale.width;
    const totalW = 3 * CARD_W + 2 * CARD_GAP;
    const startX = Math.round((W - totalW) / 2);
    const cardY  = Math.round(this.scale.height / 2 - CARD_H / 2) - 10;

    this.offered.forEach((pokemon, i) => {
        this._createCard(pokemon, i, startX + i * (CARD_W + CARD_GAP), cardY);
    });
  }

  // ── Passe à la résolution du nœud ────────────────────────────────
  _proceed() {
    const data     = this.nextNodeData;
    const nodeType = data.nodeType ?? 'combat';

    switch (nodeType) {
        case 'shop':
        this.scene.start('ShopScene', data);
        break;
        
        case 'item':
        // À implémenter plus tard — pour l'instant redirige vers shop
        this.scene.start('ShopScene', data);
        break;

        case 'random': {
        // Redirige aléatoirement vers combat, shop ou objet
        const roll = Math.random();
        if (roll < 0.40) {
            // Combat contre un dresseur aléatoire
            this.scene.start('CombatScene', data);
        } else if (roll < 0.70) {
            // Shop
            this.scene.start('ShopScene', data);
        } else {
            // Objet gratuit
            this.scene.start('ItemScene', data);
        }
        break;
        }
        case 'boss':
        case 'combat':
        default:
        this.scene.start('CombatScene', data);
        break;
    }
    }
}