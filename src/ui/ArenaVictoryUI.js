// ─────────────────────────────────────────────────────────────────────────────
// ArenaVictoryUI.js
// ─────────────────────────────────────────────────────────────────────────────

import { getArenaForMap }                       from '../data/arenas.js';
import { getRunState, setRunState, tryUnlockSlot } from '../data/runState.js';

export const ArenaVictoryUI = {
  _data:     null,
  _registry: null,
  _onDone:   null,

  init(data, registry, onDone) {
    this._data     = data;
    this._registry = registry;
    this._onDone   = onDone;

    const mapIndex   = data.mapIndex ?? 0;
    const arena      = getArenaForMap(mapIndex);
    const arenaNum   = mapIndex + 1;   // numéro humain de l'arène vaincue

    // Tentative de débloquage de slot
    const slotUnlocked = tryUnlockSlot(registry, arenaNum);

    this._render(arena, mapIndex, slotUnlocked);
    this._spawnParticles();
    this._bindButton(arena, mapIndex);
  },

  _render(arena, mapIndex, slotUnlocked) {
    const title = document.getElementById('victory-title');
    if (title) title.textContent = `Arène ${mapIndex + 1} vaincue !`;

    const champName = document.getElementById('victory-champion-name');
    if (champName) champName.textContent = arena
      ? `Champion ${arena.champion} défait` : '';

    const city = document.getElementById('victory-city');
    if (city) city.textContent = arena?.city ?? '';

    const champDiv = document.getElementById('victory-champion');
    // Utilise le sprite de combat (grand format) si dispo, sinon le sprite map
    const champSrc = arena?.championSpriteCombat ?? arena?.championSprite ?? null;
    if (champDiv && champSrc) {
      champDiv.innerHTML = `
        <img src="${champSrc}"
             alt="${arena.champion}"
             style="max-height:220px;max-width:220px;image-rendering:pixelated;object-fit:contain" />
      `;
    } else if (champDiv) {
      champDiv.innerHTML = `<span style="font-size:100px">${arena?.badgeEmoji ?? '🏆'}</span>`;
    }

    const badgeBox  = document.getElementById('victory-badge');
    const badgeImg  = document.getElementById('victory-badge-img');
    const badgeName = document.getElementById('victory-badge-name');

    if (arena && badgeBox) {
      badgeBox.classList.remove('hidden');
      if (badgeImg && arena.badgeSprite) {
        badgeImg.src = arena.badgeSprite;
        badgeImg.alt = arena.badgeName;
      } else if (badgeImg) {
        badgeImg.style.display = 'none';
      }
      if (badgeName) {
        badgeName.textContent = arena.badgeName;  // sans emoji — le sprite suffit
      }
    }

    // Notification de débloquage de slot
    if (slotUnlocked) {
      const victoryContent = document.getElementById('victory-content');
      if (victoryContent) {
        const notif = document.createElement('div');
        notif.className = 'slot-unlock-notif';
        notif.innerHTML = `
          <span class="slot-unlock-icon">🔓</span>
          <span>Nouveau slot de terrain débloqué !</span>
        `;
        victoryContent.appendChild(notif);
      }
    }
  },

  _spawnParticles() {
    const colors = ['#ffd700','#ff6b6b','#74b9ff','#55efc4','#ffeaa7'];
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 4 + Math.random() * 8;
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        top: -20px;
        width: ${size}px;
        height: ${size}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        animation-duration: ${1.5 + Math.random() * 2}s;
        animation-delay: ${Math.random() * 1.5}s;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  },

  _bindButton(arena, mapIndex) {
    const btn = document.getElementById('btn-next-map');
    if (!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
      const state   = getRunState(this._registry);
      const nextIdx = (state.currentMap ?? 0) + 1;
      setRunState(this._registry, { currentMap: nextIdx });
      if (this._onDone) this._onDone({ mapIndex: nextIdx, prevArena: arena });
    });
  },
};