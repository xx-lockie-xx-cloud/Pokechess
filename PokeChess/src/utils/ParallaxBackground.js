// Classe réutilisable pour les fonds parallaxe pixel art
// Chaque couche est tuilée horizontalement et défile à sa propre vitesse

export class ParallaxBackground {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ key: string, scrollFactor: number, alpha?: number }[]} layerConfigs
   */
  constructor(scene, layerConfigs) {
    this.scene  = scene;
    this.layers = [];
    this._build(layerConfigs);
  }

  _build(layerConfigs) {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    layerConfigs.forEach(({ key, scrollFactor, alpha = 1 }) => {
      // Récupère les dimensions réelles de la texture
      const texture     = this.scene.textures.get(key).getSourceImage();
      const scaleRatio  = H / texture.height;

      // TileSprite couvre toute la fenêtre
      const img = this.scene.add.tileSprite(0, 0, W, H, key)
        .setOrigin(0, 0)
        .setAlpha(alpha)
        .setDepth(-10)
        .setScrollFactor(0)
        .setTileScale(scaleRatio, scaleRatio);

      this.layers.push({ img, scrollFactor });
    });
  }

  /**
   * À appeler dans update(time, delta) de la scène
   * @param {number} delta  — fourni par Phaser automatiquement (ms depuis dernier frame)
   * @param {number} speed  — vitesse de base en pixels/seconde
   */
  update(delta, speed = 30) {
    this.layers.forEach(({ img, scrollFactor }) => {
      img.tilePositionX += (speed * scrollFactor * delta) / 1000;
    });
  }

  destroy() {
    this.layers.forEach(({ img }) => img.destroy());
    this.layers = [];
  }
}