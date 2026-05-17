// ─────────────────────────────────────────────────────────────────────────────
// CombatAnimator.js
// Gère les animations Phaser en lisant le log du CombatEngine.
// Ne contient aucune logique de jeu — uniquement du visuel.
//
// Compatibilité clés sprites :
//   - Ancien système : 'player_25'        (side_id)
//   - Nouveau système : 'player_25_0_1'   (side_uid avec col/row)
//   _findSprite() gère les deux automatiquement.
// ─────────────────────────────────────────────────────────────────────────────

import { HP_BAR_OFFSET } from '../board.js';

export class CombatAnimator {
  constructor(scene) {
    this.scene      = scene;
    this.isPlaying  = false;
    this.onComplete = null;
    this.log        = [];
    this.sprites    = {};
    this.hpBars     = {};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // play() — lance l'animation du log de combat
  // sprites : { 'side_uid': PhaserImage, ... }
  // ─────────────────────────────────────────────────────────────────────────
  play(log, sprites, onComplete) {
    this.log        = log;
    this.sprites    = sprites;
    this.onComplete = onComplete;
    this.isPlaying  = true;
    this._playEvent(0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _playEvent() — joue les événements un par un avec délai
  // ─────────────────────────────────────────────────────────────────────────
  _playEvent(index) {
    if (index >= this.log.length) {
      this.isPlaying = false;
      if (this.onComplete) this.onComplete();
      return;
    }

    const event = this.log[index];
    const delay = this._handleEvent(event);

    this.scene.time.delayedCall(delay, () => this._playEvent(index + 1));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _handleEvent() — traite un événement et retourne le délai suivant
  // ─────────────────────────────────────────────────────────────────────────
  _handleEvent(event) {
    switch (event.type) {

      case 'turn_start':
        return 100;

      case 'attack': {
        const { sprite: attSprite, key: attackerKey } =
          this._findSprite(event.attackerSide, event.attackerId);
        const { sprite: tgtSprite, key: targetKey } =
          this._findSprite(event.targetSide, event.targetId);

        // Flash jaune sur l'attaquant
        if (attSprite?.active) this._flash(attSprite, 0xffd700);

        // Flash rouge + barre de vie + texte dégâts sur la cible
        if (tgtSprite?.active) {
          this.scene.time.delayedCall(100, () => {
            if (tgtSprite.active) {
              this._flash(tgtSprite, 0xff4444);
              this._updateHpBar(targetKey, event.targetHpLeft, event.targetMaxHp);
              this._showDamageText(tgtSprite, event.damage, event.typeMult);
            }
          });
        }
        return 500;
      }

      case 'unit_fainted': {
        const { sprite } = this._findSprite(event.unitSide, event.unitId);
        if (sprite?.active) {
          this.scene.tweens.add({
            targets:  sprite,
            alpha:    0,
            duration: 400,
            ease:     'Power2',
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

  // ─────────────────────────────────────────────────────────────────────────
  // _findSprite() — cherche un sprite par side + id
  // Compatible avec les deux systèmes de clés (id simple ou uid composite)
  // ─────────────────────────────────────────────────────────────────────────
  _findSprite(side, id) {
    // 1. Clé directe : 'player_25' (ancien système)
    const directKey = `${side}_${id}`;
    if (this.sprites[directKey]) {
      return { sprite: this.sprites[directKey], key: directKey };
    }

    // 2. Clé uid : 'player_25_0_1' ou 'player_25_starter' (nouveau système)
    // Cherche une clé qui commence par 'side_' et dont la partie après
    // le préfixe commence par l'id suivi d'un underscore ou de fin de chaîne
    const prefix   = `${side}_`;
    const idStr    = String(id);
    const uidKey   = Object.keys(this.sprites).find(k => {
      if (!k.startsWith(prefix)) return false;
      const rest = k.slice(prefix.length);
      // Correspond à 'id_...' ou exactement 'id'
      return rest === idStr || rest.startsWith(`${idStr}_`);
    });

    if (uidKey) {
      return { sprite: this.sprites[uidKey], key: uidKey };
    }

    // Sprite introuvable
    return { sprite: null, key: directKey };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _flash() — teinte colorée temporaire sur un sprite
  // ─────────────────────────────────────────────────────────────────────────
  _flash(sprite, color) {
    if (!sprite?.active) return;
    sprite.setTint(color);
    this.scene.time.delayedCall(200, () => {
      if (sprite?.active) sprite.clearTint();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _showDamageText() — texte de dégâts flottant
  // Couleur et suffixe selon l'efficacité du type
  // ─────────────────────────────────────────────────────────────────────────
  _showDamageText(sprite, damage, typeMult) {
    if (!sprite?.active) return;

    const color  = typeMult >= 2   ? '#ff4444' :  // super efficace
                   typeMult <= 0.5 ? '#aaaaaa' :  // pas très efficace
                   typeMult === 0  ? '#555555' :  // immunité
                   '#ffffff';                      // normal

    const suffix = typeMult >= 2   ? ' !!' :
                   typeMult <= 0.5 ? ' …'  : '';

    const text = this.scene.add.text(
      sprite.x + Phaser.Math.Between(-10, 10),
      sprite.y - 20,
      `-${damage}${suffix}`,
      { fontSize: '14px', fill: color, fontFamily: 'sans-serif', fontStyle: 'bold' }
    ).setOrigin(0.5, 1).setDepth(50);

    this.scene.tweens.add({
      targets:    text,
      y:          text.y - 40,
      alpha:      0,
      duration:   800,
      ease:       'Power2',
      onComplete: () => text.destroy(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _updateHpBar() — met à jour la barre de vie d'une unité
  // ─────────────────────────────────────────────────────────────────────────
  _updateHpBar(key, hpLeft, maxHp) {
    const bar = this.hpBars?.[key];
    if (!bar?.fill?.active) return;

    const ratio = Math.max(0, hpLeft / maxHp);
    bar.fill.scaleX = ratio;

    const color = ratio > 0.5  ? 0x44cc44 :
                  ratio > 0.25 ? 0xffaa00 : 0xff4444;
    bar.fill.setFillStyle(color);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // createHpBars() — crée les barres de vie pour tous les sprites
  // Détruit les anciennes barres avant d'en créer de nouvelles
  // ─────────────────────────────────────────────────────────────────────────
  createHpBars(sprites, units) {
    // Détruit les anciennes barres
    if (this.hpBars) {
      Object.values(this.hpBars).forEach(bar => {
        if (bar?.fill?.active)       bar.fill.destroy();
        if (bar?.background?.active) bar.background.destroy();
      });
    }

    this.hpBars = {};

    Object.entries(sprites).forEach(([key, sprite]) => {
      if (!sprite?.active) return;

      // Cherche l'unité correspondante par clé directe ou uid
      const unit = units.find(u => {
        const directMatch = `${u.side}_${u.id}` === key;
        const uidMatch    = `${u.side}_${u.uid}` === key;
        return directMatch || uidMatch;
      });

      if (!unit) return;

      const barW = 50;
      const barH = 6;
      const x    = sprite.x - barW / 2;
      const y    = sprite.y + HP_BAR_OFFSET;

      // Fond gris
      const background = this.scene.add.rectangle(
        x + barW / 2, y, barW, barH, 0x333333
      ).setDepth(20);

      // Barre de vie verte
      const fill = this.scene.add.rectangle(x, y, barW, barH, 0x44cc44)
        .setOrigin(0, 0.5).setDepth(21);

      this.hpBars[key] = { fill, background, maxW: barW };
    });
  }
}