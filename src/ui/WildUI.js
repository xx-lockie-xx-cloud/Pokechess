// ─────────────────────────────────────────────────────────────────────────────
// WildUI.js
// Gère l'écran HTML de rencontre sauvage.
// Remplace WildScene.js (Phaser).
//
// Fonctionnement :
//   WildUI.init(data, registry, onDone)
//   → Affiche 3 cartes pokémon capturables
//   → Gère le reroll (1 💰)
//   → Gère la capture (1 pokéball)
//   → Appelle onDone({ nextScreen }) pour naviguer
// ─────────────────────────────────────────────────────────────────────────────

import { POKEMONS, TYPE_COLORS as TC } from '../data/pokemons.js';
import { getBSTTier }                  from '../data/runState.js';
import { getLevelBadgeHTML, getLevelBonus } from '../data/levelSystem.js';
import { getMove }                     from '../data/moves.js';
import {
  getRunState, addToBank, removeCoins, addCoins,
  weightedWildDraw, BANK_MAX_SIZE,
  addSeenPokemon
} from '../data/runState.js';

function hexToCSS(hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >>  8) & 0xff;
  const b =  hex        & 0xff;
  return `rgb(${r},${g},${b})`;
}

// ── Cadres géométriques par tier (style Arcane) ───────────────────────────────
function buildCardFrame(tier) {
  if (tier === 1) return ''; // T1 : cadre de base, rien à ajouter

  const W = 120, H = 170;

  // Palettes par tier
  const palette = {
    2: { stroke: '#b87333', glow: '#b8733340', bg: 'rgba(184,115,51,0.04)' }, // bronze
    3: { stroke: '#8fafc2', glow: '#8fafc240', bg: 'rgba(143,175,194,0.05)' }, // acier
    4: { stroke: '#d4af37', glow: '#d4af3755', bg: 'rgba(212,175,55,0.07)'  }, // or
    5: { stroke: '#9f7aea', glow: '#9f7aea70', bg: 'rgba(159,122,234,0.10)' }, // légendaire
  }[tier];

  const s  = palette.stroke;
  const t  = 0.8; // épaisseur fine
  const t2 = 1.6; // épaisseur principale

  // Coin haut-gauche : L angulaire
  const cornerTL = (len, inset, thick) => `
    <line x1="${inset}" y1="${inset + len}" x2="${inset}" y2="${inset}" stroke="${s}" stroke-width="${thick}"/>
    <line x1="${inset}" y1="${inset}" x2="${inset + len}" y2="${inset}" stroke="${s}" stroke-width="${thick}"/>`;

  // Coin haut-droit
  const cornerTR = (len, inset, thick) => `
    <line x1="${W - inset - len}" y1="${inset}" x2="${W - inset}" y2="${inset}" stroke="${s}" stroke-width="${thick}"/>
    <line x1="${W - inset}" y1="${inset}" x2="${W - inset}" y2="${inset + len}" stroke="${s}" stroke-width="${thick}"/>`;

  // Coin bas-gauche
  const cornerBL = (len, inset, thick) => `
    <line x1="${inset}" y1="${H - inset - len}" x2="${inset}" y2="${H - inset}" stroke="${s}" stroke-width="${thick}"/>
    <line x1="${inset}" y1="${H - inset}" x2="${inset + len}" y2="${H - inset}" stroke="${s}" stroke-width="${thick}"/>`;

  // Coin bas-droit
  const cornerBR = (len, inset, thick) => `
    <line x1="${W - inset - len}" y1="${H - inset}" x2="${W - inset}" y2="${H - inset}" stroke="${s}" stroke-width="${thick}"/>
    <line x1="${W - inset}" y1="${H - inset - len}" x2="${W - inset}" y2="${H - inset}" stroke="${s}" stroke-width="${thick}"/>`;

  let content = '';

  if (tier === 2) {
    // Bronze : 4 coins symétriques
    content = cornerTL(18, 5, t2) + cornerTR(18, 5, t2) +
              cornerBL(18, 5, t2) + cornerBR(18, 5, t2);
  }

  if (tier === 3) {
    // Acier : 4 coins + double ligne intérieure en TL/BR
    content =
      cornerTL(22, 4, t2) + cornerTR(22, 4, t2) +
      cornerBL(22, 4, t2) + cornerBR(22, 4, t2) +
      cornerTL(14, 9, t) + cornerBR(14, 9, t);
  }

  if (tier === 4) {
    // Or : 4 coins doubles + trait diagonal en TL et BR
    const diag = `
      <line x1="4" y1="26" x2="26" y2="4" stroke="${s}" stroke-width="${t}" opacity="0.5"/>
      <line x1="${W-4}" y1="${H-26}" x2="${W-26}" y2="${H-4}" stroke="${s}" stroke-width="${t}" opacity="0.5"/>
      <line x1="${W/2 - 6}" y1="3" x2="${W/2 + 6}" y2="3" stroke="${s}" stroke-width="${t2}" opacity="0.8"/>
      <line x1="${W/2 - 6}" y1="${H-3}" x2="${W/2 + 6}" y2="${H-3}" stroke="${s}" stroke-width="${t2}" opacity="0.8"/>`;
    content =
      cornerTL(26, 4, t2) + cornerTR(26, 4, t2) +
      cornerBL(26, 4, t2) + cornerBR(26, 4, t2) +
      cornerTL(16, 10, t) + cornerTR(16, 10, t) +
      cornerBL(16, 10, t) + cornerBR(16, 10, t) +
      diag;
  }

  if (tier === 5) {
    // Légendaire : cadre complet avec réseau angulaire
    const s2 = '#d4af37'; // accent or
    const diags = `
      <line x1="4" y1="32" x2="32" y2="4"   stroke="${s}" stroke-width="${t}" opacity="0.4"/>
      <line x1="${W-4}" y1="${H-32}" x2="${W-32}" y2="${H-4}" stroke="${s}" stroke-width="${t}" opacity="0.4"/>
      <line x1="${W-4}" y1="32"   x2="${W-32}" y2="4"   stroke="${s2}" stroke-width="${t}" opacity="0.35"/>
      <line x1="4" y1="${H-32}" x2="32" y2="${H-4}"   stroke="${s2}" stroke-width="${t}" opacity="0.35"/>
      <line x1="${W/2 - 10}" y1="3" x2="${W/2}" y2="8" stroke="${s2}" stroke-width="1.5"/>
      <line x1="${W/2}" y1="8" x2="${W/2 + 10}" y2="3" stroke="${s2}" stroke-width="1.5"/>
      <line x1="${W/2 - 10}" y1="${H-3}" x2="${W/2}" y2="${H-8}" stroke="${s2}" stroke-width="1.5"/>
      <line x1="${W/2}" y1="${H-8}" x2="${W/2 + 10}" y2="${H-3}" stroke="${s2}" stroke-width="1.5"/>
    `;
    const innerFrame = `
      <rect x="8" y="8" width="${W-16}" height="${H-16}"
            fill="none" stroke="${s}" stroke-width="0.6" opacity="0.3"
            rx="2"/>`;
    content =
      cornerTL(30, 3, t2) + cornerTR(30, 3, t2) +
      cornerBL(30, 3, t2) + cornerBR(30, 3, t2) +
      cornerTL(18, 10, t) + cornerTR(18, 10, t) +
      cornerBL(18, 10, t) + cornerBR(18, 10, t) +
      cornerTL(10, 14, 0.5) + cornerTR(10, 14, 0.5) +
      cornerBL(10, 14, 0.5) + cornerBR(10, 14, 0.5) +
      diags + innerFrame;
  }

  return `<svg class="card-frame-svg" viewBox="0 0 ${W} ${H}"
               xmlns="http://www.w3.org/2000/svg"
               style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:visible">
    <rect width="${W}" height="${H}" fill="${palette.bg}" rx="6"/>
    ${content}
  </svg>`;
}

const STAT_EMOJIS_W = { hp:'❤️', atk:'⚔️', def:'🛡️', spa:'🔮', spd_def:'💎', spd:'👟' };

function typeColorW(type) {
  const colors = {
    Feu:'#f08030', Eau:'#6890f0', Plante:'#78c850', Électrik:'#f8d030',
    Psy:'#f85888', Glace:'#98d8d8', Combat:'#c03028', Poison:'#a040a0',
    Sol:'#e0c068', Vol:'#a890f0', Insecte:'#a8b820', Roche:'#b8a038',
    Spectre:'#705898', Dragon:'#7038f8', Ténèbres:'#705848', Acier:'#b8b8d0',
    Fée:'#ee99ac', Normal:'#a8a878',
  };
  return colors[type] ?? '#a0aec0';
}


// Prix d'achat et de revente selon le tier BST
const CAPTURE_PRICE = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7 };
const SELL_PRICE    = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };

export const WildUI = {
  _data:      null,
  _registry:  null,
  _onDone:    null,
  _offered:   [],
  _selected:     null,
  _selectedCard: null,   // référence DOM de la carte sélectionnée

  // ─────────────────────────────────────────────────────────────────────────
  // init()
  // ─────────────────────────────────────────────────────────────────────────
  init(data, registry, onDone) {
    this._data     = data;
    this._registry = registry;
    this._onDone   = onDone;
    this._selected     = null;
    this._selectedCard = null;

    this._rollOffered();
    this._render();
    this._bindButtons();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _rollOffered() — tire 3 pokémons distincts via tirage pondéré par tiers
  // ─────────────────────────────────────────────────────────────────────────
  _rollOffered() {
    const offered = [];
    const usedIds = new Set();
    let   tries   = 0;

    // Tire 3 pokémons distincts (max 30 tentatives pour éviter boucle infinie)
    while (offered.length < 3 && tries < 30) {
      tries++;
      const p = weightedWildDraw(this._registry, POKEMONS);
      if (p && !usedIds.has(p.id)) {
        offered.push(p);
        usedIds.add(p.id);
      }
    }

    // Fallback si pas assez de pokémons tirés (ne devrait jamais arriver)
    if (offered.length < 3) {
      const fallback = [...POKEMONS]
        .filter(p => !usedIds.has(p.id))
        .sort(() => Math.random() - 0.5);
      while (offered.length < 3 && fallback.length) {
        offered.push(fallback.shift());
      }
    }

    this._offered = offered;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _render() — construit les cartes et les infos
  // ─────────────────────────────────────────────────────────────────────────
  _render() {
    const state = getRunState(this._registry);
    const bank  = state.playerBank ?? [];

    // Cartes
    const container = document.getElementById('wild-cards');
    if (!container) return;
    container.innerHTML = '';

    this._offered.forEach(pokemon => {
      const card = this._createCard(pokemon);
      container.appendChild(card);
    });

    // Info text
    const info = document.getElementById('wild-info');
    if (info) info.textContent = '';

    // Bouton capture — prix affiché après sélection d'un pokémon
    const btnCapture = document.getElementById('btn-capture');
    if (btnCapture) {
      btnCapture.disabled  = true;   // activé après sélection
      btnCapture.textContent = '🔴 Capturer';
    }

    // Bouton reroll
    const btnReroll = document.getElementById('btn-reroll');
    if (btnReroll) {
      const coins = state.coins ?? 0;
      btnReroll.disabled = coins < 1;
      btnReroll.textContent = `🔄 Reroll — 1 💰 (${coins} restant${coins > 1 ? 's' : ''})`;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _createCard()
  // ─────────────────────────────────────────────────────────────────────────
  _createCard(pokemon) {
    const card = document.createElement('div');
    const tier = getBSTTier(pokemon);
    card.className = `poke-card card-tier-${tier}`;
    card.dataset.id = pokemon.id;

    const c1 = hexToCSS(TC[pokemon.types[0]] ?? 0x888888);
    const c2 = hexToCSS(TC[pokemon.types[1]] ?? TC[pokemon.types[0]] ?? 0x888888);

    const price = CAPTURE_PRICE[tier] ?? 3;

    card.innerHTML = `
      ${buildCardFrame(tier)}
      <span class="type-corner tl" style="border-color: ${c1} transparent transparent transparent"></span>
      <span class="type-corner tr" style="border-color: transparent ${c2} transparent transparent"></span>
      <span class="type-corner bl" style="border-color: transparent transparent transparent ${c1}"></span>
      <span class="type-corner br" style="border-color: transparent transparent ${c2} transparent"></span>
      <img src="${pokemon.spriteUrl}" alt="${pokemon.name}"
           onerror="this.src='assets/placeholder.png'" />
      <span class="card-name">${pokemon.name}</span>
      <span class="card-types">${pokemon.types.join(' / ')}</span>
      ${(() => { const m = window.SaveManager?.loadMeta() ?? null; const l = m?.pokemonLevels?.[pokemon.id] ?? 1; return l > 1 ? getLevelBadgeHTML(l) : ''; })()}
      <span class="card-price">${price} 💰</span>
    `;

    card.addEventListener('click', () => this._selectCard(pokemon, card));
    return card;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _selectCard()
  // ─────────────────────────────────────────────────────────────────────────
  _selectCard(pokemon, cardEl) {
    this._selected     = pokemon;
    this._selectedCard = cardEl;
    addSeenPokemon(this._registry, pokemon.id);

    document.querySelectorAll('#wild-cards .poke-card')
      .forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');

    const state    = getRunState(this._registry);
    const bankFull = (state.playerBank ?? []).length >= BANK_MAX_SIZE;

    const tier      = getBSTTier(pokemon);
    const price     = CAPTURE_PRICE[tier] ?? 3;
    const canAfford = (state.coins ?? 0) >= price;

    const btnCapture = document.getElementById('btn-capture');
    if (btnCapture) {
      btnCapture.disabled  = !canAfford || bankFull;
      btnCapture.textContent = `🔴 Capturer — ${price} 💰`;
    }

    // Panneau stats + capacité
    const info = document.getElementById('wild-info');
    if (!info) return;

    const s     = pokemon.stats;
    const meta  = window.SaveManager?.loadMeta() ?? null;
    const level = meta?.pokemonLevels?.[pokemon.id] ?? 1;
    const lMult = getLevelBonus(level);

    // Stats avec bonus de niveau appliqué
    const boosted = (val) => level > 1 ? Math.round(val * lMult) : val;
    const dominantOffense = (boosted(s.spa ?? 0)) >= (boosted(s.atk ?? 0)) ? 'spa' : 'atk';

    const STATS = [
      { emoji:'❤️', key:'hp',      base: s.hp,              value: boosted(s.hp)              },
      { emoji:'⚔️', key:'atk',     base: s.atk,             value: boosted(s.atk)             },
      { emoji:'🛡️', key:'def',     base: s.def,             value: boosted(s.def)             },
      { emoji:'🔮', key:'spa',     base: s.spa  ?? 0,       value: boosted(s.spa  ?? 0)       },
      { emoji:'💎', key:'spd_def', base: s.spd_def ?? s.def, value: boosted(s.spd_def ?? s.def) },
      { emoji:'👟', key:'spd',     base: s.spd,             value: boosted(s.spd)             },
    ];

    const statsHtml = STATS.map(({ emoji, key, base, value }) => {
      const isMain    = key === dominantOffense;
      const isBoosted = level > 1 && value > base;
      return `<div class="stat-item${isMain ? ' stat-item--main' : ''}">
        <span class="stat-icon">${emoji}</span>
        <span class="stat-value" style="${isBoosted ? 'color:#55efc4' : ''}">${value}${isBoosted ? `<span style="font-size:8px;color:#55efc4"> +${value-base}</span>` : ''}</span>
        <span class="stat-label">${STAT_EMOJIS_W[key] ? key.toUpperCase().replace('_DEF','D').replace('SPA','S.ATK') : key}</span>
      </div>`;
    }).join('');

    const move = getMove(pokemon.id);
    let moveHtml = '';
    if (move) {
      const catLabel = move.cat === 'physical' ? '⚔️' : move.cat === 'special' ? '🔮' : '✨';
      const effects  = (move.effects ?? []).map(e => {
        if (e.kind === 'status') {
          const icons = {burn:'🔥',poison:'☠️',paralyze:'⚡',freeze:'❄️',sleep:'💤',confuse:'😵',stun:'🔒'};
          return `${icons[e.status]??''}${e.chance<1?` ${Math.round(e.chance*100)}%`:' garanti'}`;
        }
        if (e.kind === 'heal')  return `💚${Math.round(e.rate*100)}%`;
        if (e.kind === 'stat' && e.mult > 1) return `${STAT_EMOJIS_W[e.stat]??e.stat}▲`;
        if (e.kind === 'stat' && e.mult < 1) return `${STAT_EMOJIS_W[e.stat]??e.stat}▼`;
        if (e.kind === 'ko') return `☠${Math.round(e.chance*100)}%`;
        return '';
      }).filter(Boolean).join(' ');

      moveHtml = `
        <div class="wild-move-block" style="border-left-color:${typeColorW(move.type)}">
          <span class="wild-move-name" style="color:${typeColorW(move.type)}">
            ⚡ ${move.name}
          </span>
          <span class="wild-move-meta">
            ${catLabel} ${move.type}${move.bp > 0 ? ` · ${Math.round(move.bp*(move.powerMult??1))} puiss.` : ''}
            ${effects ? ` · ${effects}` : ''}
          </span>
        </div>`;
    }

    info.innerHTML = `
      <div class="wild-stats-panel">
        <div class="wild-stats-grid">${statsHtml}</div>
        ${moveHtml}
        ${bankFull   ? '<p class="wild-warn">⚠ Banque pleine !</p>' : ''}
        ${!canAfford ? `<p class="wild-warn">⚠ Pas assez de pièces (${price} 💰 requis)</p>` : ''}
      </div>`;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _bindButtons()
  // ─────────────────────────────────────────────────────────────────────────
  _bindButtons() {
    // Capture
    const btnCapture = document.getElementById('btn-capture');
    if (btnCapture) {
      const newBtn = btnCapture.cloneNode(true);
      btnCapture.parentNode.replaceChild(newBtn, btnCapture);
      newBtn.addEventListener('click', () => this._capture());
    }

    // Reroll
    const btnReroll = document.getElementById('btn-reroll');
    if (btnReroll) {
      const newBtn = btnReroll.cloneNode(true);
      btnReroll.parentNode.replaceChild(newBtn, btnReroll);
      newBtn.addEventListener('click', () => this._reroll());
    }

    // Passer
    const btnSkip = document.getElementById('btn-wild-skip');
    if (btnSkip) {
      const newBtn = btnSkip.cloneNode(true);
      btnSkip.parentNode.replaceChild(newBtn, btnSkip);
      newBtn.addEventListener('click', () => this._proceed());
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _capture()
  // ─────────────────────────────────────────────────────────────────────────
  _capture() {
    if (!this._selected) return;
    const state    = getRunState(this._registry);
    const bank     = state.playerBank ?? [];
    const tier     = getBSTTier(this._selected);
    const price    = CAPTURE_PRICE[tier] ?? 3;

    if ((state.coins ?? 0) < price) {
      const info = document.getElementById('wild-info');
      if (info) info.textContent = `Pas assez de pièces ! (${price} 💰 requis)`;
      return;
    }
    if (bank.length >= BANK_MAX_SIZE) {
      const info = document.getElementById('wild-info');
      if (info) info.textContent = `Banque pleine ! (${BANK_MAX_SIZE} max)`;
      return;
    }

    removeCoins(this._registry, price);
    const added = addToBank(this._registry, this._selected);
    if (!added) {
      addCoins(this._registry, price);  // rembourse si ajout échoue
      return;
    }

    const capturedName = this._selected.name;
    const info         = document.getElementById('wild-info');

    // Remplace la carte capturée par un slot vide
    if (this._selectedCard) {
      const empty = document.createElement('div');
      empty.className = 'poke-card poke-card-empty';
      empty.innerHTML = '<span class="card-empty-label">Capturé ✓</span>';
      this._selectedCard.replaceWith(empty);
      this._selectedCard = null;
    }

    if (info) {
      info.style.color = 'var(--color-green)';
      const afterState = getRunState(this._registry);
      info.textContent = `${capturedName} capturé ! 💰 ${afterState.coins ?? 0} pièces restantes`;
    }

    this._selected = null;

    // Réinitialise le bouton capture
    const btnCapture = document.getElementById('btn-capture');
    if (btnCapture) {
      btnCapture.disabled    = true;
      btnCapture.textContent = '🔴 Capturer';
    }

    // Si banque pleine → proceed automatiquement après 1.2s
    if ((state.playerBank ?? []).length >= BANK_MAX_SIZE) {
      setTimeout(() => this._proceed(), 1200);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _reroll()
  // ─────────────────────────────────────────────────────────────────────────
  _reroll() {
    const state = getRunState(this._registry);
    if ((state.coins ?? 0) < 1) {
      const info = document.getElementById('wild-info');
      if (info) info.textContent = 'Pas assez de 💰 !';
      return;
    }

    removeCoins(this._registry, 1);
    this._selected     = null;
    this._selectedCard = null;
    this._rollOffered();
    this._render();
    this._bindButtons();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _proceed() — détermine la prochaine scène selon nodeType
  // ─────────────────────────────────────────────────────────────────────────
  _proceed() {
    const nodeType = this._data?.nodeType ?? 'combat';
    let nextScreen = 'combat';

    switch (nodeType) {
      case 'shop':   nextScreen = 'shop';   break;
      case 'item':   nextScreen = 'item';   break;
      case 'boss':   nextScreen = 'combat'; break;
      case 'random': {
        const r = Math.random();
        nextScreen = r < 0.4 ? 'combat' : r < 0.7 ? 'shop' : 'item';
        break;
      }
      default: nextScreen = 'combat';
    }

    // ✅ Lit playerUnits depuis le registre au moment du clic
    // (peut avoir changé depuis que MapScene a passé les données)
    const freshPlayerUnits = this._registry.get('playerUnits') ?? [];

    if (this._onDone) this._onDone({
      nextScreen,
      ...this._data,
      playerUnits: freshPlayerUnits,  // ← toujours à jour
    });
  },
};