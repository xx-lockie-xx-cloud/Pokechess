// ─────────────────────────────────────────────────────────────────────────────
// game.js — Point d'entrée
// Architecture : UIManager gère tous les écrans en HTML/CSS pur.
// Plus de Phaser — la map est rendue en CSS/SVG par MapUI.
// ─────────────────────────────────────────────────────────────────────────────

import { UIManager } from './ui/UIManager.js';

window.UIManager = UIManager;

document.addEventListener('DOMContentLoaded', () => {

  // ── Registre léger ────────────────────────────────────────────────────────
  const registry = {
    _data: new Map(),

    get(key) { return this._data.get(key); },

    set(key, value) {
      const old = this._data.get(key);
      this._data.set(key, value);
      this.events.emit(`changedata-${key}`, this, value, old);
      return this;
    },

    reset() { this._data.clear(); return this; },

    events: {
      _listeners: new Map(),
      on(event, fn) {
        const list = this._listeners.get(event) ?? [];
        list.push(fn);
        this._listeners.set(event, list);
      },
      off(event, fn) {
        const list = (this._listeners.get(event) ?? []).filter(f => f !== fn);
        this._listeners.set(event, list);
      },
      emit(event, ...args) {
        (this._listeners.get(event) ?? []).forEach(fn => fn(...args));
      },
    },
  };

  window.gameRegistry = registry;

  UIManager.init(registry);
});