// ─────────────────────────────────────────────────────────────────────────────
// SettingsUI.js — Écran de réglages (overlay autonome) + appel unique au nom
// de dresseur pour les joueurs qui ont déjà une partie en cours.
// ─────────────────────────────────────────────────────────────────────────────

import { getTrainerName, setTrainerName, sanitizeTrainerName,
         shouldPromptName, markNamePrompted, hasProgress,
         TRAINER_NAME_MAX } from '../data/playerProfile.js';

export const SettingsUI = {
  _overlay: null,

  open() {
    if (!this._overlay) this._build();
    this._overlay.classList.remove('hidden');
    this._render();
  },
  close() { this._overlay?.classList.add('hidden'); },

  _build() {
    const o = document.createElement('div');
    o.className = 'ui-overlay settings-overlay hidden';
    o.innerHTML = `
      <div class="settings-panel">
        <div class="settings-topbar">
          <div class="settings-title">⚙️ Réglages</div>
          <button class="settings-close btn-close">✕</button>
        </div>
        <div class="settings-body"></div>
      </div>`;
    document.body.appendChild(o);
    this._overlay = o;
    o.querySelector('.settings-close').addEventListener('click', () => this.close());
    o.addEventListener('click', (e) => { if (e.target === o) this.close(); });
  },

  _render() {
    const body = this._overlay.querySelector('.settings-body');
    const name = getTrainerName() ?? '';
    body.innerHTML = `
      <div class="settings-group">
        <div class="settings-label">Nom de dresseur</div>
        <div class="settings-hint">Affiché dans le classement. Modifiable à tout moment.</div>
        <div class="settings-row">
          <input id="settings-trainer-name" class="settings-input" type="text"
                 maxlength="${TRAINER_NAME_MAX}" value="${name.replace(/"/g, '&quot;')}"
                 placeholder="Votre nom" />
          <button id="settings-save-name" class="btn-primary">Enregistrer</button>
        </div>
        <div id="settings-name-feedback" class="settings-feedback"></div>
      </div>`;

    const input = body.querySelector('#settings-trainer-name');
    const fb    = body.querySelector('#settings-name-feedback');
    body.querySelector('#settings-save-name').addEventListener('click', () => {
      const saved = setTrainerName(input.value);
      if (saved) {
        input.value = saved;
        fb.textContent = `✓ Enregistré : ${saved}`;
        fb.className = 'settings-feedback ok';
      } else {
        fb.textContent = 'Entrez un nom valide.';
        fb.className = 'settings-feedback err';
      }
    });
    input.addEventListener('input', () => { fb.textContent = ''; });
  },
};

// ── Appel unique au nom de dresseur ─────────────────────────────────────────
// Affiché une seule fois : au premier lancement pour un nouveau joueur, et pour
// les joueurs existants qui n'ont jamais renseigné de nom. S'ils passent, on ne
// les relance pas (drapeau trainerNamePrompted).
export function maybePromptTrainerName() {
  if (!shouldPromptName()) return;
  const existing = hasProgress();

  const o = document.createElement('div');
  o.className = 'ui-confirm-overlay trainer-prompt-overlay';
  o.innerHTML = `
    <div class="ui-confirm-box trainer-prompt-box" role="dialog" aria-modal="true">
      <div class="trainer-prompt-icon">🎽</div>
      <div class="trainer-prompt-title">Quel est votre nom de dresseur ?</div>
      <div class="trainer-prompt-text">
        ${existing
          ? 'Un classement arrive. Choisissez le nom sous lequel vous apparaîtrez.'
          : 'Il vous représentera dans le classement des dresseurs.'}
      </div>
      <input id="trainer-prompt-input" class="settings-input" type="text"
             maxlength="${TRAINER_NAME_MAX}" placeholder="Votre nom" />
      <div id="trainer-prompt-feedback" class="settings-feedback"></div>
      <div class="ui-confirm-actions">
        <button id="trainer-prompt-skip" class="btn-ghost">Plus tard</button>
        <button id="trainer-prompt-ok" class="ui-confirm-yes">Valider</button>
      </div>
      <div class="trainer-prompt-note">Modifiable ensuite dans les réglages.</div>
    </div>`;
  document.body.appendChild(o);
  requestAnimationFrame(() => o.classList.add('visible'));

  const input = o.querySelector('#trainer-prompt-input');
  const fb    = o.querySelector('#trainer-prompt-feedback');
  const close = () => {
    o.classList.remove('visible');
    setTimeout(() => o.remove(), 180);
  };

  o.querySelector('#trainer-prompt-skip').addEventListener('click', () => {
    markNamePrompted();
    close();
  });
  o.querySelector('#trainer-prompt-ok').addEventListener('click', () => {
    if (!sanitizeTrainerName(input.value)) {
      fb.textContent = 'Entrez un nom valide.';
      fb.className = 'settings-feedback err';
      return;
    }
    setTrainerName(input.value);
    close();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') o.querySelector('#trainer-prompt-ok').click();
  });
  setTimeout(() => input.focus(), 120);
}