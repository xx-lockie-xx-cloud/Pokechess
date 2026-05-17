// Gère les animations Phaser en lisant le log du CombatEngine
// Ne contient aucune logique de jeu — uniquement du visuel
import { HP_BAR_OFFSET } from '../board.js';

export class CombatAnimator {
  constructor(scene) {
    this.scene        = scene;
    this.isPlaying    = false;
    this.onComplete   = null;   // callback appelé quand tout est animé
  }

  // ── Lance l'animation d'un log de combat ──────────────────────────────
  // sprites = { 'player_id': phaserImage, 'enemy_id': phaserImage, ... }
  play(log, sprites, onComplete) {
    this.log        = log;
    this.sprites    = sprites;
    this.onComplete = onComplete;
    this.isPlaying  = true;
    this._playEvent(0);
  }

  // ── Joue les événements un par un avec un délai entre chaque ──────────
  _playEvent(index) {
    if (index >= this.log.length) {
      this.isPlaying = false;
      if (this.onComplete) this.onComplete();
      return;
    }

    const event = this.log[index];
    const delay  = this._handleEvent(event);

    this.scene.time.delayedCall(delay, () => this._playEvent(index + 1));
  }

  // ── Traite un événement et retourne le délai avant le suivant ────────
  _handleEvent(event) {
    switch (event.type) {

      case 'turn_start':
        return 100;  // petite pause entre les tours

      case 'attack': {
        const attackerKey = `${event.attackerSide}_${event.attackerId}`;
        const targetKey   = `${event.targetSide}_${event.targetId}`;
        const attSprite   = this.sprites[attackerKey];
        const tgtSprite   = this.sprites[targetKey];

        if (attSprite) this._flash(attSprite, 0xffd700);

        if (tgtSprite) {
          this.scene.time.delayedCall(100, () => {
            this._flash(tgtSprite, 0xff4444);
            this._updateHpBar(targetKey, event.targetHpLeft, event.targetMaxHp);
            this._showDamageText(tgtSprite, event.damage, event.typeMult);
          });
        }
        return 500;
      }

      case 'unit_fainted': {
        const key    = `${event.unitSide}_${event.unitId}`;
        const sprite = this.sprites[key];
        if (sprite) {
          // Fade out du sprite
          this.scene.tweens.add({
            targets: sprite,
            alpha:   0,
            duration: 400,
            ease:    'Power2'
          });
        }
        return 300;
      }

      case 'combat_end':
        return 500;

      default:
        return 50;
    }
  }

  // ── Flash coloré sur un sprite ────────────────────────────────────────
  _flash(sprite, color) {
    sprite.setTint(color);
    this.scene.time.delayedCall(200, () => sprite.clearTint());
  }

  // ── Texte de dégâts flottant ─────────────────────────────────────────
  _showDamageText(sprite, damage, typeMult) {
    const color = typeMult >= 2   ? '#ff4444' :   // super efficace → rouge vif
                  typeMult <= 0.5 ? '#aaaaaa' :   // pas très efficace → gris
                  typeMult === 0  ? '#555555' :   // immunité → gris foncé
                  '#ffffff';                       // normal → blanc

    const suffix = typeMult >= 2   ? ' !!' :
                  typeMult <= 0.5 ? ' …'  : '';

    const text = this.scene.add.text(
      sprite.x + Phaser.Math.Between(-10, 10),
      sprite.y - 20,
      `-${damage}${suffix}`,
      { fontSize: '14px', fill: color, fontFamily: 'sans-serif', fontStyle: 'bold' }
    ).setOrigin(0.5, 1).setDepth(50);

    this.scene.tweens.add({
      targets:  text,
      y:        text.y - 40,
      alpha:    0,
      duration: 800,
      ease:     'Power2',
      onComplete: () => text.destroy()
    });
  }

  // ── Met à jour la barre de vie d'une unité ───────────────────────────
  _updateHpBar(key, hpLeft, maxHp) {
    const bar = this.hpBars?.[key];
    if (!bar?.fill?.active) return;  // ignore si détruit
    const ratio = Math.max(0, hpLeft / maxHp);
    bar.fill.scaleX = ratio;
    const color = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xffaa00 : 0xff4444;
    bar.fill.setFillStyle(color);
  }

  // ── Crée les barres de vie pour tous les sprites ──────────────────────
  createHpBars(sprites, units) {
    // Détruit les anciennes barres avant d'en créer de nouvelles
    if (this.hpBars) {
      Object.values(this.hpBars).forEach(bar => {
        if (bar?.fill)       bar.fill.destroy();
        if (bar?.background) bar.background.destroy();
      });
    }

    this.hpBars = {};

    Object.entries(sprites).forEach(([key, sprite]) => {
      if (!sprite?.active) return;  // ignore les sprites détruits

      const unit = units.find(u => `${u.side}_${u.uid ?? u.id}` === key
                                || `${u.side}_${u.id}` === key);
      if (!unit) return;

      const barW = 50, barH = 6;
      const x    = sprite.x - barW / 2;
      const y    = sprite.y + HP_BAR_OFFSET;

      // Fond gris — stocké pour pouvoir être détruit
      const background = this.scene.add.rectangle(
        x + barW / 2, y, barW, barH, 0x333333
      ).setDepth(20);

      // Barre de vie — stockée pour pouvoir être détruite et mise à jour
      const fill = this.scene.add.rectangle(x, y, barW, barH, 0x44cc44)
        .setOrigin(0, 0.5).setDepth(21);

      this.hpBars[key] = { fill, background, maxW: barW };
    });
  }
}