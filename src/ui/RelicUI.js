// ─────────────────────────────────────────────────────────────────────────────
// RelicUI.js — Sélection de relique au début de run (avant le starter)
// ─────────────────────────────────────────────────────────────────────────────
import { RELICS, getUnlockedRelics, getRelicById } from '../data/relics.js';
import { SaveManager }                              from '../SaveManager.js';

const CATEGORY_COLORS = {
  economy:     '#ffd700',
  combat:      '#fc5c65',
  synergy:     '#a29bfe',
  info:        '#4fc3f7',
  progression: '#55efc4',
  challenge:   '#e17055',
};

export const RelicUI = {
  _overlay: null,
  _onDone:  null,  // callback(relicId | null)

  init() {
    this._overlay = document.getElementById('overlay-relic');
    if (!this._overlay) return;
    this._overlay.addEventListener('click', e => {
      if (e.target === this._overlay) this._skip();
    });
  },

  // Ouvre la sélection — onDone(relicId) ou onDone(null) si skip
  open(onDone) {
    console.log('[RelicUI] open() appelé');
    if (!this._overlay) {
      console.log('[RelicUI] overlay absent, appel init()');
      this.init();
    }
    if (!this._overlay) {
      console.error('[RelicUI] ❌ overlay toujours absent après init(), passage direct au starter');
      onDone?.(null);
      return;
    }
    this._onDone = onDone;
    this._render();
    this._overlay.classList.add('active');
    document.body.classList.add('overlay-open');
    console.log('[RelicUI] overlay affiché, classes :', this._overlay.className);
  },

  close() {
    this._overlay?.classList.remove('active');
    document.body.classList.remove('overlay-open');
  },

  _skip() {
    this.close();
    this._onDone?.(null);
  },

  _showConfirm(relic, onConfirm, onCancel) {
    // Retire un ancien confirm si présent
    document.getElementById('relic-confirm-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'relic-confirm-overlay';
    overlay.className = 'relic-confirm-overlay';
    overlay.innerHTML = `
      <div class="relic-confirm-panel">
        <div class="relic-confirm-icon">${relic.icon}</div>
        <div class="relic-confirm-name">${relic.name}</div>
        <div class="relic-confirm-desc">${relic.desc}</div>
        ${relic.apply?.symmetric
          ? '<div class="relic-confirm-sym">⚖️ S\'applique aux deux camps</div>' : ''}
        <div class="relic-confirm-question">Choisir cette relique ?</div>
        <div class="relic-confirm-btns">
          <button class="btn-primary relic-btn-confirm">✓ Confirmer</button>
          <button class="btn-secondary relic-btn-cancel">✕ Annuler</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.relic-btn-confirm').addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
    overlay.querySelector('.relic-btn-cancel').addEventListener('click', () => {
      overlay.remove();
      onCancel();
    });
  },

  _render() {
    console.log('[RelicUI] _render() appelé');
    const container = document.getElementById('relic-content');
    console.log('[RelicUI] relic-content trouvé :', !!container);
    if (!container) {
      console.error('[RelicUI] ❌ relic-content introuvable');
      return;
    }
    const meta     = SaveManager.loadMeta();
    const unlocked = getUnlockedRelics(meta);
    console.log('[RelicUI] reliques débloquées :', unlocked.length, unlocked.map(r => r.id));

    // Propose 3 reliques aléatoires parmi les débloquées
    const shuffled = [...unlocked].sort(() => Math.random() - 0.5);
    const choices  = shuffled.slice(0, Math.min(3, shuffled.length));

    if (choices.length === 0) {
      container.innerHTML = `
        <div class="relic-empty">
          <p>Aucune relique débloquée pour l'instant.</p>
          <p class="relic-empty-hint">Débloque des reliques en accomplissant des succès.</p>
          <button class="relic-skip-btn" id="relic-skip">Commencer sans relique →</button>
        </div>`;
      document.getElementById('relic-skip')?.addEventListener('click', () => this._skip());
      return;
    }

    container.innerHTML = `
      <div class="relic-intro">
        <p>Choisis une relique pour cette run. Elle modifiera les règles du jeu pour toi <strong>et</strong> tes adversaires.</p>
      </div>
      <div class="relic-choices">
        ${choices.map(r => this._relicCard(r)).join('')}
      </div>
      <div class="relic-footer">
        <button class="relic-skip-btn" id="relic-skip">Passer — commencer sans relique</button>
      </div>
    `;

    // Listeners cartes
    container.querySelectorAll('.relic-card').forEach(card => {
      card.addEventListener('click', () => {
        const id    = card.dataset.relicId;
        const relic = RELICS[id];

        // Sélection visuelle
        container.querySelectorAll('.relic-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        // Overlay de confirmation
        this._showConfirm(relic, () => {
          this.close();
          this._onDone?.(id);
        }, () => {
          card.classList.remove('selected');
        });
      });
    });

    document.getElementById('relic-skip')?.addEventListener('click', () => this._skip());
  },

  _relicCard(relic) {
    const color = CATEGORY_COLORS[relic.category] ?? '#888';
    return `
      <div class="relic-card" data-relic-id="${relic.id}" style="--rc:${color}">
        <div class="relic-card-icon">${relic.icon}</div>
        <div class="relic-card-body">
          <div class="relic-card-name">${relic.name}</div>
          <div class="relic-card-desc">${relic.desc}</div>
          ${relic.apply?.symmetric
            ? '<div class="relic-card-sym">⚖️ S\'applique aux deux camps</div>'
            : ''}
        </div>
      </div>`;
  },

  // Affiche la relique active dans la MapUI (badge compact)
  buildActiveRelicBadge(relicId) {
    const relic = getRelicById(relicId);
    if (!relic) return '';
    const color = CATEGORY_COLORS[relic.category] ?? '#888';
    return `
      <div class="active-relic-badge" style="--rc:${color}" title="${relic.desc}">
        <span class="arb-icon">${relic.icon}</span>
        <span class="arb-name">${relic.name}</span>
      </div>`;
  },
};