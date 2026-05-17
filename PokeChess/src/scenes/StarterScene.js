import { POKEMONS, TYPE_COLORS } from '../data/pokemons.js';
import { CELL_SIZE, GRID_GAP }   from '../board.js';
import { initRun } from '../data/runState.js';

const STARTER_IDS = [1, 4, 7, 25, 133]; // Bulbizarre, Salamèche, Carapuce, Pikachu, Évoli

export class StarterScene extends Phaser.Scene {
  init() {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
  }
  constructor() {
    super({ key: 'StarterScene' });
    this.starters       = [];
    this.selectedId     = null;
    this.cardObjects    = {};  // id → { bg, img, nameTag, typeTag, badge }
  }

  preload() {
    this.starters = STARTER_IDS.map(id => POKEMONS.find(p => p.id === id));
    this.starters.forEach(p => {
      this.load.image(`monster_${p.id}`, p.spriteUrl);
    });
  }

  create() {
    // Réinitialise le zoom au cas où il aurait été modifié dans une scène précédente
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);

    const W = this.scale.width;
    const H = this.scale.height;

    // ── Fond ─────────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    // ── Titre ─────────────────────────────────────────────────────────────
    this.add.text(W / 2, 24, 'PokeChess', {
      fontSize: '24px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    this.add.text(W / 2, 56, 'Choisissez votre starter', {
      fontSize: '14px', fill: '#718096', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 0);

    // ── Cards des starters ────────────────────────────────────────────────
    const cardW   = 96;
    const cardH   = 120;
    const cardGap = 20;
    const totalW  = this.starters.length * (cardW + cardGap) - cardGap;
    const startX  = Math.round((W - totalW) / 2);
    const cardY   = Math.round(H / 2 - cardH / 2) - 20;

    this.starters.forEach((pokemon, i) => {
      const x = startX + i * (cardW + cardGap);
      this._createCard(pokemon, x, cardY, cardW, cardH);
    });

    // ── Texte de description (mis à jour au survol) ───────────────────────
    this.descText = this.add.text(W / 2, cardY + cardH + 24, 'Survolez un pokémon pour voir ses stats', {
      fontSize: '12px', fill: '#718096', fontFamily: 'sans-serif', align: 'center'
    }).setOrigin(0.5, 0);

    // ── Bouton confirmer (désactivé jusqu'à sélection) ───────────────────
    this.confirmBtn = this.add.text(W / 2, H - 24, '[ Choisir ce starter ]', {
      fontSize: '15px', fill: '#4a5568', fontFamily: 'sans-serif'
    }).setOrigin(0.5, 1).setDepth(10);
  }

  // ── Crée une carte de starter ─────────────────────────────────────────
  _createCard(pokemon, x, y, cardW, cardH) {
    const s  = 14;
    const c1 = TYPE_COLORS[pokemon.types[0]] ?? 0x888888;
    const c2 = pokemon.types[1] ? (TYPE_COLORS[pokemon.types[1]] ?? 0x888888) : c1;

    // Fond de carte
    const bg = this.add.graphics().setDepth(1);
    bg.fillStyle(0x16213e, 1);
    bg.fillRoundedRect(x, y, cardW, cardH, 10);
    bg.lineStyle(2, 0x334466, 1);
    bg.strokeRoundedRect(x, y, cardW, cardH, 10);

    // Coins de type
    const badge = this.add.graphics().setDepth(2);
    this._drawCorners(badge, x, y, cardW, cardH, s, c1, c2);

    // Sprite
    const img = this.add.image(
      Math.round(x + cardW / 2),
      Math.round(y + cardH / 2 - 14),
      `monster_${pokemon.id}`
    ).setDisplaySize(110, 110).setDepth(3).setInteractive({ cursor: 'pointer' });

    // Nom
    const nameTag = this.add.text(
      Math.round(x + cardW / 2),
      Math.round(y + cardH - 28),
      pokemon.name,
      { fontSize: '12px', fill: '#e2e8f0', fontFamily: 'sans-serif' }
    ).setOrigin(0.5, 0.5).setDepth(3);

    // Type(s)
    const typeLabel = pokemon.types.join(' / ');
    const typeTag = this.add.text(
      Math.round(x + cardW / 2),
      Math.round(y + cardH - 12),
      typeLabel,
      { fontSize: '10px', fill: '#a0aec0', fontFamily: 'sans-serif' }
    ).setOrigin(0.5, 0.5).setDepth(3);

    // Hover
    img.on('pointerover', () => {
      this.descText.setText(this._statsText(pokemon));
    });

    img.on('pointerout', () => {
      if (this.selectedId !== pokemon.id) {
        this.descText.setText('Survolez un pokémon pour voir ses stats');
      }
    });

    // Sélection
    img.on('pointerdown', () => this._selectStarter(pokemon));

    this.cardObjects[pokemon.id] = { bg, img, nameTag, typeTag, badge };
  }
  _statsText(pokemon) {
    const atkLabel = pokemon.stats.spa > pokemon.stats.atk
        ? `SP.ATK: ${pokemon.stats.spa}`
        : `ATK: ${pokemon.stats.atk}`;

    const defLabel = pokemon.stats.spa > pokemon.stats.atk
        ? `SP.DEF: ${pokemon.stats.spd_def}`
        : `DEF: ${pokemon.stats.def}`;

    return `${pokemon.name}  —  HP: ${pokemon.stats.hp}  ${atkLabel}  DEF: ${pokemon.stats.def}  ${defLabel}  VIT: ${pokemon.stats.spd}`;
    }

  // ── Sélection d'un starter ────────────────────────────────────────────
  _selectStarter(pokemon) {
    this.selectedId = pokemon.id;

    // Reset toutes les cartes
    this.starters.forEach(p => {
      const card = this.cardObjects[p.id];
      const c1   = TYPE_COLORS[p.types[0]] ?? 0x888888;
      const c2   = p.types[1] ? (TYPE_COLORS[p.types[1]] ?? 0x888888) : c1;
      const x    = card.bg.x;  // on recalcule depuis la position

      // On récupère la position depuis le sprite
      const sx = card.img.x - 96 / 2;
      const sy = card.img.y - 120 / 2 + 14;

      card.bg.clear();
      card.bg.fillStyle(0x16213e, 1);
      card.bg.fillRoundedRect(sx, sy, 96, 120, 10);
      card.bg.lineStyle(2, 0x334466, 1);
      card.bg.strokeRoundedRect(sx, sy, 96, 120, 10);

      card.badge.clear();
      this._drawCorners(card.badge, sx, sy, 96, 120, 14, c1, c2);
    });

    // Surligne la carte sélectionnée
    const sel  = this.cardObjects[pokemon.id];
    const sx   = sel.img.x - 96 / 2;
    const sy   = sel.img.y - 120 / 2 + 14;
    const c1   = TYPE_COLORS[pokemon.types[0]] ?? 0x888888;
    const c2   = pokemon.types[1] ? (TYPE_COLORS[pokemon.types[1]] ?? 0x888888) : c1;

    sel.bg.clear();
    sel.bg.fillStyle(0x1a2e4a, 1);
    sel.bg.fillRoundedRect(sx, sy, 96, 120, 10);
    sel.bg.lineStyle(2.5, 0xffd700, 1);
    sel.bg.strokeRoundedRect(sx, sy, 96, 120, 10);

    sel.badge.clear();
    this._drawCorners(sel.badge, sx, sy, 96, 120, 14, c1, c2);

    this.descText.setText(this._statsText(pokemon));

    // Active le bouton confirmer
    this.confirmBtn
      .setStyle({ fill: '#ffd700' })
      .setInteractive({ cursor: 'pointer' })
      .off('pointerdown')
      .on('pointerover', () => this.confirmBtn.setStyle({ fill: '#fff' }))
      .on('pointerout',  () => this.confirmBtn.setStyle({ fill: '#ffd700' }))
      .on('pointerdown', () => this._confirm(pokemon));
  }

  // ── Confirmation et passage à la GameScene ────────────────────────────
  _confirm(pokemon) {
    initRun(this.registry, pokemon);
    this.scene.start('MapScene');  // ← plus de GameScene
  }

  // ── Dessine les coins de type ─────────────────────────────────────────
  _drawCorners(g, x, y, w, h, s, c1, c2) {
    g.fillStyle(c1, 0.9);
    g.fillTriangle(x, y, x + s, y, x, y + s);
    g.fillStyle(c1, 0.9);
    g.fillTriangle(x + w, y + h, x + w - s, y + h, x + w, y + h - s);
    g.fillStyle(c2, 0.9);
    g.fillTriangle(x + w, y, x + w - s, y, x + w, y + s);
    g.fillStyle(c2, 0.9);
    g.fillTriangle(x, y + h, x + s, y + h, x, y + h - s);
  }
}