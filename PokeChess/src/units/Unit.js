// Classe de base pour un monstre sur la grille

export class Unit {
  constructor(data, col, row) {
    this.id       = data.id;
    this.name     = data.name;
    this.types    = data.types;
    this.tier     = data.tier;
    this.stats    = { ...data.stats };      // copie des stats de base
    this.hp       = data.stats.hp;          // hp actuels
    this.spriteUrl = data.spriteUrl;

    this.col = col;   // position sur la grille
    this.row = row;

    // Référence aux objets Phaser (assignés plus tard)
    this.sprite    = null;
    this.container = null;
  }

  isAlive() {
    return this.hp > 0;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
  }
}