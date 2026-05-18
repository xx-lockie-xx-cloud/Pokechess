// ─────────────────────────────────────────────────────────────────────────────
// ArenaVictoryScene.js
// Écran de victoire après avoir battu un champion d'arène.
// Affiche : sprite du champion, badge obtenu, animation de victoire.
// ─────────────────────────────────────────────────────────────────────────────

import { getArenaForMap }              from '../data/arenas.js';
import { getRunState, setRunState }    from '../data/runState.js';

export class ArenaVictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArenaVictoryScene' });
    this.arenaData = null;
    this.mapIndex  = 0;
  }

  init(data) {
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.mapIndex  = data.mapIndex ?? 0;
    this.arenaData = getArenaForMap(this.mapIndex);
  }

  preload() {
    if (this.arenaData?.championSprite) {
      const key = `champion_${this.mapIndex}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, this.arenaData.championSprite);
      }
    }
    // Badge de l'arène vaincue
    if (this.arenaData?.badgeSprite) {
    const key = `badge_victory_${this.mapIndex}`;
    if (!this.textures.exists(key)) {
        this.load.image(key, this.arenaData.badgeSprite);
    }
    }
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const arena = this.arenaData;

    // ── Fond ─────────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x0a0a1a).setOrigin(0);

    // ── Particules ────────────────────────────────────────────────────────
    this._spawnParticles(W, H);

    // ── Sprite champion ───────────────────────────────────────────────────
    const champKey = `champion_${this.mapIndex}`;
    if (arena?.championSprite && this.textures.exists(champKey)) {
        const champ = this.add.image(W * 0.28, H * 0.52, champKey)
        .setOrigin(0.5).setAlpha(0).setScale(2.5);
        this.tweens.add({ targets: champ, alpha: 1, duration: 600, ease: 'Power2' });
        this.tweens.add({
        targets: champ, y: H * 0.52 - 8,
        duration: 1800, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: 600,
        });
    } else {
        this.add.text(W * 0.28, H * 0.52,
        arena?.badgeEmoji ?? '🏆', {
        fontSize: '80px', fontFamily: 'sans-serif'
        }).setOrigin(0.5);
    }

    // ── Textes en cascade ─────────────────────────────────────────────────
    const items = [];

    items.push(this.add.text(W * 0.62, H * 0.20,
        `Arène ${this.mapIndex + 1} vaincue !`, {
        fontSize: '22px', fill: '#ffd700', fontFamily: 'sans-serif',
        fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0));

    if (arena) {
        items.push(this.add.text(W * 0.62, H * 0.32,
        `Champion ${arena.champion} défait`, {
        fontSize: '14px', fill: '#e2e8f0', fontFamily: 'sans-serif',
        }).setOrigin(0.5).setAlpha(0));

        items.push(this.add.text(W * 0.62, H * 0.40,
        arena.city, {
        fontSize: '12px', fill: '#718096', fontFamily: 'sans-serif',
        }).setOrigin(0.5).setAlpha(0));

        // ── Boîte du badge ────────────────────────────────────────────────
        // Coordonnées définies ici pour être accessibles partout dans le bloc
        const bx = W * 0.62 - 100;
        const by = H * 0.50;

        const badgeG = this.add.graphics().setAlpha(0);
        badgeG.fillStyle(0x1a2e4a, 0.9);
        badgeG.fillRoundedRect(bx, by, 200, 64, 10);
        badgeG.lineStyle(2, 0xffd700, 1);
        badgeG.strokeRoundedRect(bx, by, 200, 64, 10);
        items.push(badgeG);

        // Sprite du badge ou fallback emoji
        const badgeVictoryKey = `badge_victory_${this.mapIndex}`;
        if (this.textures.exists(badgeVictoryKey)) {
        items.push(
            this.add.image(bx + 36, by + 32, badgeVictoryKey)
            .setDisplaySize(40, 40)
            .setOrigin(0.5)
            .setAlpha(0)
        );
        } else {
        items.push(
            this.add.text(bx + 36, by + 32, arena.badgeEmoji, {
            fontSize: '28px', fontFamily: 'sans-serif',
            }).setOrigin(0.5).setAlpha(0)
        );
        }

        items.push(this.add.text(bx + 110, by + 22,
        arena.badgeName, {
        fontSize: '13px', fill: '#ffd700',
        fontFamily: 'sans-serif', fontStyle: 'bold',
        }).setOrigin(0.5).setAlpha(0));

        items.push(this.add.text(bx + 110, by + 42,
        'obtenu !', {
        fontSize: '11px', fill: '#a0aec0', fontFamily: 'sans-serif',
        }).setOrigin(0.5).setAlpha(0));
    }

    // ── Animation cascade ─────────────────────────────────────────────────
    items.forEach((item, i) => {
        this.tweens.add({
        targets:  item,
        alpha:    1,
        duration: 400,
        delay:    400 + i * 200,
        ease:     'Power2',
        });
    });

    // ── Bouton continuer ──────────────────────────────────────────────────
    const btnDelay = 400 + items.length * 200 + 300;
    const btn = this.add.text(W / 2, H * 0.85,
        '[ ➡ Continuer vers la prochaine route ]', {
        fontSize: '14px', fill: '#ffd700', fontFamily: 'sans-serif',
        backgroundColor: '#0d1a2e', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setAlpha(0).setDepth(10).setInteractive({ cursor: 'pointer' });

    btn.on('pointerover', () => btn.setStyle({ fill: '#fff' }));
    btn.on('pointerout',  () => btn.setStyle({ fill: '#ffd700' }));
    btn.on('pointerdown', () => this._goToNextMap());

    this.tweens.add({ targets: btn, alpha: 1, duration: 400, delay: btnDelay });
    }

  // ── Particules étoiles ────────────────────────────────────────────────
  _spawnParticles(W, H) {
    const colors = [0xffd700, 0xff6b6b, 0x74b9ff, 0x55efc4, 0xffeaa7];
    for (let i = 0; i < 25; i++) {
      const x     = Phaser.Math.Between(0, W);
      const color = colors[i % colors.length];
      const size  = Phaser.Math.Between(3, 7);
      const delay = Phaser.Math.Between(0, 1500);

      const star = this.add.graphics();
      star.fillStyle(color, 1);
      star.fillCircle(x, -20, size);

      this.tweens.add({
        targets:     star,
        y:           H + 20,
        x:           x + Phaser.Math.Between(-50, 50),
        alpha:       { from: 1, to: 0 },
        duration:    Phaser.Math.Between(1500, 3000),
        delay,
        ease:        'Power1',
        repeat:      -1,
        repeatDelay: Phaser.Math.Between(500, 2000),
      });
    }
  }

  // ── Passage à la map suivante ─────────────────────────────────────────
  _goToNextMap() {
    const state    = getRunState(this.registry);
    const nextIdx  = (state.currentMap ?? 0) + 1;

    setRunState(this.registry, { currentMap: nextIdx });

    this.scene.stop('UIScene');
    this.scene.start('MapScene', {
      mapIndex:  nextIdx,
      prevArena: this.arenaData,
    });
  }
}