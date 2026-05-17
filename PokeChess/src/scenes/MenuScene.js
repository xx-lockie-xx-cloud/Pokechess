export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);

    this.add.rectangle(0, 0, W, H, 0x1a1a2e).setOrigin(0);

    this.add.text(W / 2, H / 2 - 80, 'PokeChess', {
      fontSize: '36px', fill: '#e2e8f0', fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 40, 'Un autochess inspiré de Pokémon', {
      fontSize: '14px', fill: '#718096', fontFamily: 'sans-serif'
    }).setOrigin(0.5);

    // Bouton nouvelle partie
    const btn = this.add.text(W / 2, H / 2 + 20, '[ 🎮 Nouvelle Partie ]', {
      fontSize: '18px', fill: '#ffd700', fontFamily: 'sans-serif'
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

    btn.on('pointerover', () => btn.setStyle({ fill: '#fff' }));
    btn.on('pointerout',  () => btn.setStyle({ fill: '#ffd700' }));
    btn.on('pointerdown', () => this.scene.start('StarterScene'));
  }
}