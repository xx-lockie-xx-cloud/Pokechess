import { getRunState } from '../data/runState.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    this.coinText = null;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Bouton Équipe — depth très élevé pour passer au-dessus de tout ───
    const btn = this.add.text(W - 12, H - 12, '[ ⚔ Équipe ]', {
      fontSize: '13px', fill: '#ffd700',
      fontFamily: 'sans-serif',
      backgroundColor: '#4d4d61',
      padding: { x: 8, y: 4 }
    }).setOrigin(1, 1).setDepth(9999).setInteractive({ cursor: 'pointer' });

    btn.on('pointerover', () => btn.setStyle({ fill: '#fff' }));
    btn.on('pointerout',  () => btn.setStyle({ fill: '#ffd700' }));
    btn.on('pointerdown', () => {
      // Bloque l'accès pendant le combat actif
      const combatActive = this.scene.isActive('CombatScene');
      if (combatActive) {
        // Vérifie si le combat a démarré
        const combatScene = this.scene.get('CombatScene');
        if (combatScene?.combatStarted) return;
      }

      if (!this.scene.isActive('PrepScene')) {
        this.scene.launch('PrepScene');
        this.scene.bringToTop('PrepScene');
      } else {
        this.scene.stop('PrepScene');
      }
    });

    // ── Monnaie — coin supérieur gauche ──────────────────────────────────
    this.coinText = this.add.text(12, 12, '💰 0', {
      fontSize: '13px', fill: '#ffd700',
      fontFamily: 'sans-serif',
      backgroundColor: '#1a1a2e',
      padding: { x: 8, y: 4 }
    }).setOrigin(0, 0).setDepth(200);

    // Rafraîchit toutes les 500ms
    this.time.addEvent({
      delay:    500,
      loop:     true,
      callback: () => this._refresh()
    });
  }

  _refresh() {
    const state = getRunState(this.registry);
    this.coinText?.setText(`💰 ${state.coins ?? 0}`);
  }
}