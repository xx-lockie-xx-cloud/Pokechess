// ─────────────────────────────────────────────────────────────────────────────
// ArenaVictoryUI.js — Remplace ArenaVictoryScene.js (Phaser)
// ─────────────────────────────────────────────────────────────────────────────

import { getArenaForMap, getArenas } from '../data/arenas.js';
import { DEFAULT_REGION }           from '../data/regions.js';
import { getRunState, setRunState, tryUnlockSlot } from '../data/runState.js';
import { RelicEngine } from '../combat/RelicEngine.js';
import { RELICS } from '../data/relics.js';
import { ACHIEVEMENTS } from '../data/levelSystem.js';

export const ArenaVictoryUI = {
  _data:     null,
  _registry: null,
  _onDone:   null,
  _originalContentHTML: null,

  init(data, registry, onDone) {
    this._data     = data;
    this._registry = registry;
    this._onDone   = onDone;

    // Sauvegarde la structure HTML originale (arènes) une seule fois, car
    // l'écran de ligue remplace tout le contenu de .screen-content.
    const content = document.querySelector('#overlay-arena-victory .screen-content');
    if (content && this._originalContentHTML == null) {
      this._originalContentHTML = content.innerHTML;
    }

    const mapIndex = data.mapIndex ?? 0;
    const regionId = window.SaveManager?.loadMeta?.()?.region ?? DEFAULT_REGION;
    const arena    = getArenaForMap(mapIndex, regionId);

    // mapIndex 8 = Ligue (9e map) → écran ÉPIQUE
    // mapIndex > 8 = ligues du mode endless → écran intermédiaire
    if (mapIndex === 8) {
      this._renderLeagueVictory(mapIndex, false);
      this._bindButton(arena, mapIndex);
    } else if (mapIndex > 8) {
      this._renderLeagueVictory(mapIndex, true);
      this._bindButton(arena, mapIndex);
    } else {
      // Restaure la structure d'arène si elle avait été remplacée par la ligue
      if (content && this._originalContentHTML != null) {
        content.innerHTML = this._originalContentHTML;
      }
      this._render(arena, mapIndex);
      this._spawnParticles();
      this._bindButton(arena, mapIndex);
    }
  },

  // ── Écran de victoire de LIGUE (épique map 8 / intermédiaire endless) ───────
  _renderLeagueVictory(mapIndex, isEndless) {
    // Enregistre le badge de ligue dans runState (comme une arène)
    const rs = getRunState(this._registry);
    const leagueId = 'league_' + mapIndex;
    if (!(rs.badgesEarned ?? []).includes(leagueId)) {
      setRunState(this._registry, { badgesEarned: [...(rs.badgesEarned ?? []), leagueId] });
    }

    const masterName   = this._data.trainerName  ?? 'Maître';
    const masterSprite = this._data.leagueSprite  ?? null;
    const fieldTeam    = this._data.fieldTeam     ?? [];

    const content = document.querySelector('#overlay-arena-victory .screen-content');
    if (!content) return;

    if (!isEndless) {
      // ── ÉCRAN ÉPIQUE (Ligue map 9) ──────────────────────────────────────────
      const diffId    = window.SaveManager?.getDifficulty?.() ?? 'normal';
      const DIFF_INFO = {
        easy:   { label: 'Facile',   icon: '🌱', color: '#55efc4' },
        normal: { label: 'Normal',   icon: '⚔️', color: '#74b9ff' },
        hard:   { label: 'Difficile',icon: '🔥', color: '#ff7675' },
        expert: { label: 'Expert',   icon: '💀', color: '#ffd700' },
      };
      const diff = DIFF_INFO[diffId] ?? DIFF_INFO.normal;

      // Les 8 badges des arènes DE LA RÉGION jouée, sur 2 lignes (4 + 4).
      // Le maître de ligue (Peter, Red) n'a pas de badge : il n'apparaît pas ici.
      const regionId     = window.SaveManager?.loadMeta?.()?.region ?? DEFAULT_REGION;
      const badgeSprites = getArenas(regionId).map(a => a.badgeSprite);
      const badgeImg = (src, i) => `
        <img class="lv-badge" src="${src}" alt="badge"
             style="animation-delay:${0.15 * i}s"
             onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🏅',className:'lv-badge-fallback'}))" />
      `;
      const half       = Math.ceil(badgeSprites.length / 2);
      const badgesHtml = `
        <div class="lv-badges-row">${badgeSprites.slice(0, half).map((s, i) => badgeImg(s, i)).join('')}</div>
        <div class="lv-badges-row">${badgeSprites.slice(half).map((s, i) => badgeImg(s, i + half)).join('')}</div>`;

      // Photo de classe : sprites de l'équipe terrain, légèrement chevauchés
      const photoHtml = fieldTeam.map((u, i) => `
        <img class="lv-photo-mon" src="${u.spriteUrl}" alt="${u.name}"
             style="margin-left:${i === 0 ? 0 : -18}px; z-index:${i}; animation-delay:${0.6 + 0.1 * i}s"
             onerror="this.src='assets/placeholder.png'" />
      `).join('');

      // ── Première victoire en EXPERT : écran d'honneur ─────────────────────
      const meta        = window.SaveManager?.loadMeta?.() ?? {};
      const firstExpert = diffId === 'expert' && !meta.expertLeagueDone;
      if (firstExpert) {
        window.SaveManager?.saveMeta?.({ ...meta, expertLeagueDone: true });
      }

      const expertHtml = firstExpert ? (() => {
        // ── Bilan personnalisé du joueur ──────────────────────────────────
        const st        = window.SaveManager?.getRunStats?.(meta) ?? {};
        const runs      = meta.totalRuns ?? 0;
        const wins      = st.totalWins   ?? 0;
        const losses    = st.totalLosses ?? 0;
        const lv100     = window.SaveManager?.countMaxLevelPokemon?.(meta) ?? 0;

        const achDone   = Object.keys(meta.achievements ?? {}).length;
        const achTotal  = Object.keys(ACHIEVEMENTS ?? {}).length;
        const achLeft   = Math.max(0, achTotal - achDone);

        const relicsUsedCount = Object.keys(st.relicsUsed ?? {}).length;
        const relicTotal      = Object.keys(RELICS ?? {}).length;
        const relicsLeft      = Math.max(0, relicTotal - relicsUsedCount);

        const line = (icon, html) => `<li><span class="lv-stat-ico">${icon}</span><div class="lv-stat-body">${html}</div></li>`;
        const b    = (v) => `<strong>${v}</strong>`;

        // Temps de jeu (comptabilisé depuis l'ajout du suivi ; masqué si < 5 min)
        const ptMs  = st.playtimeMs ?? 0;
        const ptMin = Math.round(ptMs / 60000);
        // Espaces insécables : évite que l'unité passe seule à la ligne
        const ptStr = ptMin >= 60
          ? `${Math.floor(ptMin / 60)}\u00A0h\u00A0${String(ptMin % 60).padStart(2, '0')}`
          : `${ptMin}\u00A0min`;
        const playtimeLine = ptMin >= 5
          ? line('⏱', `${b(ptStr)} de jeu
                       <span class="lv-stat-sub">C'est le temps que tu as passé sur PokeChess. Ça fait beaucoup !</span>`)
          : '';

        return `
        <div class="lv-expert-seal">
          <div class="lv-expert-crown">👑</div>
          <div class="lv-expert-title">MAÎTRISE ABSOLUE</div>
          <div class="lv-expert-sub">Ligue vaincue en difficulté Expert</div>
          <div class="lv-expert-note">
            <p>Tu viens de terminer PokeChess dans sa difficulté la plus exigeante.</p>
            <p>Un petit bilan du chemin parcouru :</p>            <ul class="lv-expert-stats">
              ${line('🗺', `${b(runs)} épopée${runs > 1 ? 's' : ''} lancée${runs > 1 ? 's' : ''}`)}
              ${playtimeLine}
              ${line('⚔️', `${b(wins)} victoire${wins > 1 ? 's' : ''} et ${b(losses)} défaite${losses > 1 ? 's' : ''} en combat`)}
              ${line('💯', `${b(lv100)} pokémon${lv100 > 1 ? 's' : ''} différent${lv100 > 1 ? 's' : ''} monté${lv100 > 1 ? 's' : ''} au niveau 100`)}
              ${line('🏅', achLeft > 0
                  ? `${b(achDone)} succès sur ${b(achTotal)}
                     <span class="lv-stat-sub">Il t'en reste ${b(achLeft)} à décrocher</span>`
                  : `${b(achDone)} succès sur ${b(achTotal)}, tu les as <em>tous</em> réalisés !`)}
              ${line('💎', relicsLeft > 0
                  ? `${b(relicsUsedCount)} relique${relicsUsedCount > 1 ? 's' : ''} essayée${relicsUsedCount > 1 ? 's' : ''} sur ${b(relicTotal)}
                     <span class="lv-stat-sub">${b(relicsLeft)} autre${relicsLeft > 1 ? 's' : ''} t'attend${relicsLeft > 1 ? 'ent' : ''} pour varier les plaisirs</span>`
                  : `Les ${b(relicTotal)} reliques ont toutes été essayées, chapeau !`)}
            </ul>
            <p>Ce jeu a été construit pièce par pièce. Comme tu l'as deviné, avec l'aide de
               l'intelligence artificielle. Cependant, chaque synergie, chaque talent et chaque
               équilibrage ont été bidouillés par mes petits doigts et mon gamefeel, plus quelques
               retours d'amis. Il m'a servi de porte d'entrée dans le développement web.</p>
            <p>Voir que tu as appris à maîtriser les différents aspects de ce jeu à ce niveau,
               ça n'a pas de prix.</p>
            <p>Merci d'y avoir joué, et encore bravo. 🙏</p>
            <p class="lv-expert-sign">Lockie</p>
          </div>
        </div>`;
      })() : '';

      content.innerHTML = `
        <div class="lv-rays"></div>
        <div class="league-victory epic${firstExpert ? ' expert-run' : ''}">
          <div class="lv-banner">🏆 CHAMPION DE LA LIGUE 🏆</div>
          <div class="lv-difficulty" style="color:${diff.color};border-color:${diff.color}">
            ${diff.icon} Difficulté ${diff.label}
          </div>
          <div class="lv-master">
            ${masterSprite ? `<img src="${masterSprite}" alt="${masterName}" class="lv-master-sprite"
                 onerror="this.style.display='none'" />` : ''}
            <div class="lv-master-text">Vous avez vaincu<br><strong>${masterName}</strong></div>
          </div>
          <div class="lv-badges">${badgesHtml}</div>
          ${expertHtml}
          <div class="lv-photo-label">Votre équipe championne</div>
          <div class="lv-photo">${photoHtml}</div>
        </div>
        <button id="btn-next-map" class="btn-primary btn-large">♾️ Continuer en mode infini</button>
      `;
      this._spawnConfetti(firstExpert ? 80 : 60);
    } else {
      // ── ÉCRAN INTERMÉDIAIRE (ligues endless) ────────────────────────────────
      const dId  = window.SaveManager?.getDifficulty?.() ?? 'normal';
      const dMap = {
        easy:   { label: 'Facile',    icon: '🌱', color: '#55efc4' },
        normal: { label: 'Normal',    icon: '⚔️', color: '#74b9ff' },
        hard:   { label: 'Difficile', icon: '🔥', color: '#ff7675' },
        expert: { label: 'Expert',    icon: '💀', color: '#ffd700' },
      };
      const d = dMap[dId] ?? dMap.normal;
      content.innerHTML = `
        <div class="league-victory endless">
          ${masterSprite ? `<img src="${masterSprite}" alt="${masterName}" class="lv-master-sprite"
               onerror="this.style.display='none'" />` : '<span style="font-size:72px">🏆</span>'}
          <div class="lv-endless-text">Vous avez vaincu<br><strong>${masterName}</strong></div>
          <div class="lv-difficulty" style="color:${d.color};border-color:${d.color}">
            ${d.icon} Difficulté ${d.label}
          </div>
        </div>
        <button id="btn-next-map" class="btn-primary btn-large">♾️ Continuer</button>
      `;
      this._spawnConfetti(35);
    }
  },

  _render(arena, mapIndex) {
    // Médaille : +1 niveau à tous les pokémons après chaque arène
    const rsCheck   = getRunState(this._registry);
    const lvlGain   = RelicEngine.arenaLevels(rsCheck?.relic?.id);
    if (lvlGain > 0 && mapIndex < 8) {
      const playerUnits = this._registry?.get?.('playerUnits') ?? [];
      playerUnits.forEach(u => {
        if (u?.id) for (let i = 0; i < lvlGain; i++) window.SaveManager?.gainPokemonLevel(u.id);
      });
    }

    // +1 point de talent par arène vaincue (sauf ligue)
    if (mapIndex < 8) {
      const meta = getRunState(this._registry);
      const savedMeta = window.SaveManager?.loadMeta() ?? {};
      const newPoints  = (savedMeta.talentPoints ?? 0) + 1;
      window.SaveManager?.saveMeta({ ...savedMeta, talentPoints: newPoints });
    }
    // Enregistre le badge dans runState.badgesEarned
    const arenaId = arena?.id ?? ('arena_' + mapIndex);
    const rs       = getRunState(this._registry);
    if (!(rs.badgesEarned ?? []).includes(arenaId)) {
      setRunState(this._registry, {
        badgesEarned: [...(rs.badgesEarned ?? []), arenaId],
      });
    }

    // Déverrouille un slot si applicable (2e/4e/6e badge)
    const arenaNumber = mapIndex + 1;  // mapIndex 0-7 → arenaNumber 1-8
    if (tryUnlockSlot(this._registry, arenaNumber)) {
      const slots = { 2: 4, 4: 5, 6: 6 };
      const newCount = slots[arenaNumber];
      if (newCount) {
        // Petit message de déverrouillage dans le titre
        setTimeout(() => {
          const msg = document.getElementById('arena-unlock-msg');
          if (msg) {
            msg.textContent = `🔓 ${newCount} emplacements terrain débloqués !`;
            msg.classList.remove('hidden');
          }
        }, 600);
      }
    }
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
        // Sprite de combat du champion devant le nom du badge, plutôt qu'un
        // emoji. Repli sur l'emoji si l'image ne charge pas.
        const sprite = arena.championSpriteCombat ?? arena.championSprite;
        badgeName.innerHTML = sprite
          ? `<img src="${sprite}" alt="${arena.champion}" class="badge-champ-icon"
                  onerror="this.replaceWith(document.createTextNode('${arena.badgeEmoji} '))" />` +
            `<span>${arena.badgeName}</span>`
          : `${arena.badgeEmoji} ${arena.badgeName}`;
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

  // Confettis festifs (plus nombreux et colorés que _spawnParticles)
  _spawnConfetti(count = 50) {
    const colors = ['#ffd700','#ff6b6b','#74b9ff','#55efc4','#ffeaa7','#fd79a8','#a29bfe','#fdcb6e'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'lv-confetti';
      const size = 6 + Math.random() * 8;
      const isRect = Math.random() > 0.5;
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        top: -24px;
        width: ${size}px;
        height: ${isRect ? size * 0.5 : size}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${isRect ? '1px' : '50%'};
        animation-duration: ${2 + Math.random() * 2.5}s;
        animation-delay: ${Math.random() * 1.2}s;
        transform: rotate(${Math.random() * 360}deg);
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 5000);
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
      const state = getRunState(this._registry);
      // currentMap a DÉJÀ été avancé à la victoire du boss → on le lit tel quel.
      const nextIdx = state.currentMap ?? (mapIndex + 1);
      if (this._onDone) {
        // Mode infini : incrémente loopCount une seule fois
        if (isLeagueVictory) {
          const rs = getRunState(this._registry);
          setRunState(this._registry, { ...rs, loopCount: (rs.loopCount ?? 0) + 1 });
        }
        this._onDone({ mapIndex: nextIdx, prevArena: arena, infiniteMode: isLeagueVictory });
      }
    });
  },
};