// Gestion de la grille de jeu (8x4 pour le joueur, 8x4 pour l'ennemi)

export const GRID_COLS  = 3;
export const GRID_ROWS  = 2;    // rangées joueur
export const CELL_SIZE  = 72;   // pixels par cellule
export const GRID_GAP   = 4;    // espace entre cellules

export class Board {
  constructor(scene, offsetX, offsetY) {
    this.scene   = scene;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.cells   = [];    // tableau 2D [col][row] → Unit | null
    this.graphics = null;

    // Init du tableau vide
    for (let c = 0; c < GRID_COLS; c++) {
      this.cells[c] = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        this.cells[c][r] = null;
      }
    }
  }

  // Dessine la grille avec Phaser Graphics
  draw() {
    if (this.graphics) this.graphics.destroy();
    this.graphics = this.scene.add.graphics();

    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const x = this.offsetX + c * (CELL_SIZE + GRID_GAP);
        const y = this.offsetY + r * (CELL_SIZE + GRID_GAP);
        const occupied = this.cells[c][r] !== null;

        // Fond de cellule
        this.graphics.fillStyle(occupied ? 0x2d4a7a : 0x16213e, 0.9);
        this.graphics.fillRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);

        // Bordure
        this.graphics.lineStyle(1.5, occupied ? 0x4a90d9 : 0x334466, 1);
        this.graphics.strokeRoundedRect(x, y, CELL_SIZE, CELL_SIZE, 8);
      }
    }
  }

  // Convertit col/row en coordonnées pixel (centre de la cellule)
  cellToPixel(col, row) {
    return {
      x: this.offsetX + col * (CELL_SIZE + GRID_GAP) + CELL_SIZE / 2,
      y: this.offsetY + row * (CELL_SIZE + GRID_GAP) + CELL_SIZE / 2
    };
  }

  // Place une unité sur la grille
  placeUnit(unit, col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (this.cells[col][row] !== null) return false;    // cellule occupée

    this.cells[col][row] = unit;
    unit.col = col;
    unit.row = row;
    this.draw();
    return true;
  }

  // Retire une unité de la grille
  removeUnit(col, row) {
    const unit = this.cells[col][row];
    if (unit) {
      this.cells[col][row] = null;
      this.draw();
    }
    return unit;
  }

  // Retourne toutes les unités placées
  getAllUnits() {
    const units = [];
    for (let c = 0; c < GRID_COLS; c++)
      for (let r = 0; r < GRID_ROWS; r++)
        if (this.cells[c][r]) units.push(this.cells[c][r]);
    return units;
  }
}