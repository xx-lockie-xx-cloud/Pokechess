// ─────────────────────────────────────────────────────────────────────────────
// ArenaVictoryUI.js — Remplace ArenaVictoryScene.js (Phaser)
// ─────────────────────────────────────────────────────────────────────────────

import { getArenaForMap }           from '../data/arenas.js';
import { getRunState, setRunState } from '../data/runState.js';

export const ArenaVictoryUI = {
  _data:     null,
  _registry: null,
  _onDone:   null,

  init(data, registry, onDone) {
    this._data     = data;
    this._registry = registry;
    this._onDone   = onDone;

    const arena = getArenaForMap(data.mapIndex ?? 0);
    this._render(arena, data.mapIndex ?? 0);
    this._spawnParticles();
    this._bindButton(arena, data.mapIndex ?? 0);
  },

  _render(arena, mapIndex) {
    // Titre
    const title = document.getElementById('victory-title');
    if (title) title.textContent = `Arène ${mapIndex + 1} vaincue !`;

    // Champion
    const champName = document.getElementById('victory-champion-name');
    if (champName) champName.textContent = arena
      ? `Champion ${arena.champion} défait` : '';

    // Ville
    const city = document.getElementById('victory-city');
    if (city) city.textContent = arena?.city ?? '';

    // Sprite champion
    const champDiv = document.getElementById('victory-champion');
    if (champDiv && arena?.championSprite) {
      champDiv.innerHTML = `
        <img src="${arena.championSprite}"
             alt="${arena.champion}"
             style="width:120px;height:120px;image-rendering:pixelated" />
      `;
    } else if (champDiv) {
      champDiv.innerHTML = `<span style="font-size:80px">${arena?.badgeEmoji ?? '🏆'}</span>`;
    }

    // Badge
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
        // Fallback emoji dans le nom
      }
      if (badgeName) {
        badgeName.textContent = `${arena.badgeEmoji} ${arena.badgeName}`;
      }
    }
  },

  // Particules CSS (remplace les tweens Phaser)
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
      // Nettoie après animation
      setTimeout(() => p.remove(), 4000);
    }
  },

  _bindButton(arena, mapIndex) {
    const btn = document.getElementById('btn-next-map');
    if (!btn) return;

    // La ligue est sur la map 8 (index 8, 9e map)
    // Maps 0-7 = les 8 arènes | Map 8 = Ligue Pokémon
    const isLeagueVictory = mapIndex >= 8;

    if (isLeagueVictory) {
      // Victoire de la ligue → choix : mode infini ou retour menu
      btn.textContent = '♾️ Continuer en mode infini';

      // Bouton retour menu
      let menuBtn = document.getElementById('btn-victory-menu');
      if (!menuBtn) {
        menuBtn = document.createElement('button');
        menuBtn.id        = 'btn-victory-menu';
        menuBtn.className = 'btn-secondary';
        menuBtn.style.marginTop = '8px';
        btn.parentNode.appendChild(menuBtn);
      }
      menuBtn.textContent = '🏠 Retour au menu principal';
      menuBtn.onclick = () => {
        if (this._onDone) this._onDone({ goToMenu: true });
      };
    } else {
      btn.textContent = '➡️ Prochaine arène';
    }

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
      const state   = getRunState(this._registry);
      const nextIdx = (state.currentMap ?? 0) + 1;
      setRunState(this._registry, {
        currentMap:   nextIdx,
        infiniteMode: isLeagueVictory,
      });
      if (this._onDone) {
        this._onDone({ mapIndex: nextIdx, prevArena: arena, infiniteMode: isLeagueVictory });
      }
    });
  },
};