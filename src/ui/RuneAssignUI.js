// ─────────────────────────────────────────────────────────────────────────────
// RuneAssignUI.js — Attribution des runes (overlay autonome).
// Vue 1 : le pool des runes obtenues. Vue 2 : sélecteur des pokémon niveau 100
// (grille type Pokédex + recherche). Seules les espèces niveau 100 sont éligibles.
// ─────────────────────────────────────────────────────────────────────────────

import { RUNES, scaleRune } from '../data/runes.js';
import { RARITY_META }      from '../data/rarity.js';
import { RuneManager }      from '../combat/RuneManager.js';
import { POKEMONS }         from '../data/pokemons.js';

const RUNE_ICONS = {
  violent: '⚡', vampire: '🩸', effroi: '😱',
  rempart_vital: '🛡', rempart_offensif: '🛡', rempart_defensif: '🛡',
  panacee: '💊', revanche: '⚔️', epines: '🌵',
  paralysie: '⚡', toxine: '☠️', combustion: '🔥', confusion: '💫',
};
const TRIGGER_LABEL = { onAttack: 'À l\'attaque', onHitReceived: 'Quand touché' };

const _byId = new Map(POKEMONS.map(p => [p.id, p]));
const nameOf   = id => _byId.get(id)?.name ?? ('#' + id);
const spriteOf = id => _byId.get(id)?.spriteUrl ?? 'assets/placeholder.png';

function effectLine(rune) {
  const e = rune.effect, pct = Math.round(e.mag * 100);
  switch (e.kind) {
    case 'replay':            return `${pct}% de rejouer une attaque`;
    case 'lifesteal':         return `Vol de vie : ${pct}% des dégâts`;
    case 'stun':              return `${pct}% d'étourdir la cible`;
    case 'shield':            return `Bouclier : ${pct}% ${{ hp: 'des PV max', atk: "de l'ATK dominante", def: 'de la DEF dominante' }[e.fromStat]}`;
    case 'heal_most_wounded': return `Soigne le plus blessé : ${pct}% PV max`;
    case 'counter':           return `${pct}% de contre-attaquer`;
    case 'reflect':           return `Renvoie ${pct}% des dégâts`;
    case 'status': {
      const verb = { poison: 'empoisonner', burn: 'brûler', paralyze: 'paralyser', confuse: 'confondre' }[e.status] ?? e.status;
      const el   = /^[aeiou\u00e9\u00e8]/i.test(verb) ? "d'" : 'de ';
      return `${pct}% ${el}${verb} l'attaquant${e.stacks ? ` (${e.stacks} stacks)` : ''}`;
    }
    default: return '';
  }
}

export const RuneAssignUI = {
  _overlay: null,
  _view: 'pool',
  _selRune: null,   // uid de la rune en cours d'attribution
  _search: '',

  open() {
    this._view = 'pool'; this._selRune = null; this._search = '';
    if (!this._overlay) this._build();
    this._overlay.classList.remove('hidden');
    this._render();
  },

  close() {
    this._overlay?.classList.add('hidden');
  },

  _build() {
    const o = document.createElement('div');
    o.className = 'ui-overlay rune-assign-overlay hidden';
    o.innerHTML = `
      <div class="rune-assign-panel">
        <div class="rune-assign-topbar">
          <button class="rune-assign-back btn-ghost" title="Retour">‹</button>
          <div class="rune-assign-title">Runes</div>
          <button class="rune-assign-close btn-close">✕</button>
        </div>
        <div class="rune-assign-body"></div>
      </div>`;
    document.body.appendChild(o);
    this._overlay = o;
    o.querySelector('.rune-assign-close').addEventListener('click', () => this.close());
    o.querySelector('.rune-assign-back').addEventListener('click', () => {
      if (this._view === 'picker') { this._view = 'pool'; this._selRune = null; this._render(); }
      else this.close();
    });
    o.addEventListener('click', (e) => { if (e.target === o) this.close(); });
  },

  _render() {
    const title = this._overlay.querySelector('.rune-assign-title');
    const back  = this._overlay.querySelector('.rune-assign-back');
    const body  = this._overlay.querySelector('.rune-assign-body');
    if (this._view === 'pool') {
      title.textContent = 'Runes';
      back.style.visibility = 'hidden';
      body.innerHTML = this._poolHtml();
      this._bindPool(body);
    } else {
      const inst = RuneManager.getRune(this._selRune);
      title.textContent = 'Attribuer : ' + (RUNES[inst?.type]?.name ?? 'Rune');
      back.style.visibility = 'visible';
      body.innerHTML = this._pickerHtml();
      this._bindPicker(body);
    }
  },

  // ── Vue pool ────────────────────────────────────────────────────────────────
  _poolHtml() {
    const pool = RuneManager.getPool();
    if (!pool.length) {
      return `<div class="rune-assign-empty">Aucune rune obtenue pour l'instant.<br>
              Termine une région (ligue vaincue) pour en gagner une.</div>`;
    }
    const cards = pool.map(inst => {
      const base   = RUNES[inst.type];
      if (!base) return '';
      const scaled = scaleRune(inst.type, inst.rarity);
      const meta   = RARITY_META[inst.rarity] ?? RARITY_META.normal;
      const holder = RuneManager.getRuneHolder(inst.uid);
      return `
        <div class="rune-card rarity-${inst.rarity}" data-uid="${inst.uid}">
          <div class="rune-card-icon rarity-${inst.rarity}">${RUNE_ICONS[inst.type] ?? '🔯'}</div>
          <div class="rune-card-main">
            <div class="rune-card-name">${base.name}
              <span class="rune-card-rarity" style="color:${meta.color}">${meta.label}</span></div>
            <div class="rune-card-trigger">${TRIGGER_LABEL[base.trigger]}</div>
            <div class="rune-card-effect">${effectLine(scaled)}</div>
            <div class="rune-card-holder">${holder != null
              ? `Sur <strong>${nameOf(holder)}</strong>` : '<em>Non attribuée</em>'}</div>
          </div>
          <div class="rune-card-actions">
            <button class="rune-assign-btn btn-primary" data-uid="${inst.uid}">Attribuer</button>
            ${holder != null ? `<button class="rune-unassign-btn btn-ghost" data-pid="${holder}">Retirer</button>` : ''}
          </div>
        </div>`;
    }).join('');
    return `<div class="rune-pool-list">${cards}</div>`;
  },

  _bindPool(body) {
    body.querySelectorAll('.rune-assign-btn').forEach(b =>
      b.addEventListener('click', () => {
        this._selRune = b.dataset.uid; this._view = 'picker'; this._search = ''; this._render();
      }));
    body.querySelectorAll('.rune-unassign-btn').forEach(b =>
      b.addEventListener('click', () => { RuneManager.unassign(+b.dataset.pid); this._render(); }));
  },

  // ── Vue sélecteur (pokémon niveau 100) ───────────────────────────────────────
  _pickerHtml() {
    const ids = RuneManager.getMaxLevelPokemonIds();
    if (!ids.length) {
      return `<div class="rune-assign-empty">Aucun pokémon niveau 100.<br>
              Monte un pokémon au niveau 100 pour pouvoir lui attribuer une rune.</div>`;
    }
    return `
      <input class="rune-search" type="text" placeholder="Rechercher un pokémon..." value="${this._search}" />
      <div class="rune-pick-grid">${this._gridHtml(ids)}</div>`;
  },

  _gridHtml(ids) {
    const q = this._search.trim().toLowerCase();
    const filtered = ids
      .filter(id => !q || nameOf(id).toLowerCase().includes(q))
      .sort((a, b) => a - b);
    if (!filtered.length) return `<div class="rune-assign-empty">Aucun résultat.</div>`;
    const assigns = RuneManager.getAssignments();
    return filtered.map(id => {
      const wornUid = assigns[id];
      const worn    = wornUid ? RuneManager.getRune(wornUid) : null;
      const badge   = worn ? `<span class="rune-pick-worn">${RUNE_ICONS[worn.type] ?? '🔯'}</span>` : '';
      return `
        <button class="rune-pick-cell" data-id="${id}" title="${nameOf(id)}">
          <img src="${spriteOf(id)}" alt="${nameOf(id)}" onerror="this.src='assets/placeholder.png'" />
          <span class="rune-pick-name">${nameOf(id)}</span>${badge}
        </button>`;
    }).join('');
  },

  _bindPicker(body) {
    const input = body.querySelector('.rune-search');
    const grid  = body.querySelector('.rune-pick-grid');
    if (input) {
      input.addEventListener('input', () => {
        this._search = input.value;
        grid.innerHTML = this._gridHtml(RuneManager.getMaxLevelPokemonIds());
        this._bindCells(grid);
      });
      input.focus();
    }
    if (grid) this._bindCells(grid);
  },

  _bindCells(grid) {
    grid.querySelectorAll('.rune-pick-cell').forEach(c =>
      c.addEventListener('click', () => {
        RuneManager.assign(+c.dataset.id, this._selRune);
        this._view = 'pool'; this._selRune = null; this._render();
      }));
  },
};