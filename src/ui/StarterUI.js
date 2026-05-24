// ─────────────────────────────────────────────────────────────────────────────
// StarterUI.js
// Gère l'écran HTML de sélection du starter.
// Remplace StarterScene.js (Phaser).
//
// Fonctionnement :
//   StarterUI.init(data, registry, onConfirm)
//   → Affiche 5 cartes pokémon cliquables
//   → Au clic sur une carte : affiche ses stats
//   → Au clic sur "Choisir" : appelle onConfirm(pokemon)
// ─────────────────────────────────────────────────────────────────────────────

import { POKEMONS }                    from '../data/pokemons.js';
import { getBSTTier }                  from '../data/runState.js';
import { getLevelBadgeHTML, getLevelBonus } from '../data/levelSystem.js';
import { getMove }                     from '../data/moves.js';
import { initRun }                     from '../data/runState.js';
import { TYPE_COLORS as TC }           from '../data/pokemons.js';

// IDs des starters proposés
const STARTER_IDS = [1, 4, 7, 25, 133];

// Couleurs hex → CSS rgba (conversion depuis les couleurs Phaser 0xRRGGBB)
function hexToCSS(hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >>  8) & 0xff;
  const b =  hex        & 0xff;
  return `rgb(${r},${g},${b})`;
}

// ── Cadres géométriques (partagé avec WildUI) ────────────────────────────────
function buildCardFrame(tier) {
  if (tier === 1) return '';
  const W = 120, H = 170;
  const palette = {
    2: { stroke: '#b87333', bg: 'rgba(184,115,51,0.04)' },
    3: { stroke: '#8fafc2', bg: 'rgba(143,175,194,0.05)' },
    4: { stroke: '#d4af37', bg: 'rgba(212,175,55,0.07)'  },
    5: { stroke: '#9f7aea', bg: 'rgba(159,122,234,0.10)' },
  }[tier];
  const s = palette.stroke, t = 0.8, t2 = 1.6;
  const cTL = (l,i,w) => `<line x1="${i}" y1="${i+l}" x2="${i}" y2="${i}" stroke="${s}" stroke-width="${w}"/><line x1="${i}" y1="${i}" x2="${i+l}" y2="${i}" stroke="${s}" stroke-width="${w}"/>`;
  const cTR = (l,i,w) => `<line x1="${W-i-l}" y1="${i}" x2="${W-i}" y2="${i}" stroke="${s}" stroke-width="${w}"/><line x1="${W-i}" y1="${i}" x2="${W-i}" y2="${i+l}" stroke="${s}" stroke-width="${w}"/>`;
  const cBL = (l,i,w) => `<line x1="${i}" y1="${H-i-l}" x2="${i}" y2="${H-i}" stroke="${s}" stroke-width="${w}"/><line x1="${i}" y1="${H-i}" x2="${i+l}" y2="${H-i}" stroke="${s}" stroke-width="${w}"/>`;
  const cBR = (l,i,w) => `<line x1="${W-i-l}" y1="${H-i}" x2="${W-i}" y2="${H-i}" stroke="${s}" stroke-width="${w}"/><line x1="${W-i}" y1="${H-i-l}" x2="${W-i}" y2="${H-i}" stroke="${s}" stroke-width="${w}"/>`;
  let c = '';
  if (tier===2) c = cTL(18,5,t2)+cTR(18,5,t2)+cBL(18,5,t2)+cBR(18,5,t2);
  if (tier===3) c = cTL(22,4,t2)+cTR(22,4,t2)+cBL(22,4,t2)+cBR(22,4,t2)+cTL(14,9,t)+cBR(14,9,t);
  if (tier===4) {
    const d = `<line x1="4" y1="26" x2="26" y2="4" stroke="${s}" stroke-width="${t}" opacity="0.5"/><line x1="${W-4}" y1="${H-26}" x2="${W-26}" y2="${H-4}" stroke="${s}" stroke-width="${t}" opacity="0.5"/><line x1="${W/2-6}" y1="3" x2="${W/2+6}" y2="3" stroke="${s}" stroke-width="${t2}" opacity="0.8"/><line x1="${W/2-6}" y1="${H-3}" x2="${W/2+6}" y2="${H-3}" stroke="${s}" stroke-width="${t2}" opacity="0.8"/>`;
    c = cTL(26,4,t2)+cTR(26,4,t2)+cBL(26,4,t2)+cBR(26,4,t2)+cTL(16,10,t)+cTR(16,10,t)+cBL(16,10,t)+cBR(16,10,t)+d;
  }
  if (tier===5) {
    const s2='#d4af37';
    const d = `<line x1="4" y1="32" x2="32" y2="4" stroke="${s}" stroke-width="${t}" opacity="0.4"/><line x1="${W-4}" y1="${H-32}" x2="${W-32}" y2="${H-4}" stroke="${s}" stroke-width="${t}" opacity="0.4"/><line x1="${W-4}" y1="32" x2="${W-32}" y2="4" stroke="${s2}" stroke-width="${t}" opacity="0.35"/><line x1="4" y1="${H-32}" x2="32" y2="${H-4}" stroke="${s2}" stroke-width="${t}" opacity="0.35"/><line x1="${W/2-10}" y1="3" x2="${W/2}" y2="8" stroke="${s2}" stroke-width="1.5"/><line x1="${W/2}" y1="8" x2="${W/2+10}" y2="3" stroke="${s2}" stroke-width="1.5"/><line x1="${W/2-10}" y1="${H-3}" x2="${W/2}" y2="${H-8}" stroke="${s2}" stroke-width="1.5"/><line x1="${W/2}" y1="${H-8}" x2="${W/2+10}" y2="${H-3}" stroke="${s2}" stroke-width="1.5"/>`;
    const f = `<rect x="8" y="8" width="${W-16}" height="${H-16}" fill="none" stroke="${s}" stroke-width="0.6" opacity="0.3" rx="2"/>`;
    c = cTL(30,3,t2)+cTR(30,3,t2)+cBL(30,3,t2)+cBR(30,3,t2)+cTL(18,10,t)+cTR(18,10,t)+cBL(18,10,t)+cBR(18,10,t)+cTL(10,14,0.5)+cTR(10,14,0.5)+cBL(10,14,0.5)+cBR(10,14,0.5)+d+f;
  }
  return `<svg class="card-frame-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:visible"><rect width="${W}" height="${H}" fill="${palette.bg}" rx="6"/>${c}</svg>`;
}

function typeColor(type) {
  const colors = {
    Feu:'#f08030', Eau:'#6890f0', Plante:'#78c850', Électrik:'#f8d030',
    Psy:'#f85888', Glace:'#98d8d8', Combat:'#c03028', Poison:'#a040a0',
    Sol:'#e0c068', Vol:'#a890f0', Insecte:'#a8b820', Roche:'#b8a038',
    Spectre:'#705898', Dragon:'#7038f8', Ténèbres:'#705848', Acier:'#b8b8d0',
    Fée:'#ee99ac', Normal:'#a8a878',
  };
  return colors[type] ?? '#a0aec0';
}

const STAT_EMOJIS = { hp:'❤️', atk:'⚔️', def:'🛡️', spa:'🔮', spd_def:'💎', spd:'👟' };

export const StarterUI = {
  _selected:   null,
  _onConfirm:  null,
  _registry:   null,

  // ─────────────────────────────────────────────────────────────────────────
  // init() — construit et affiche l'écran starter
  // ─────────────────────────────────────────────────────────────────────────
  init(data, registry, onConfirm) {
    this._selected  = null;
    this._onConfirm = onConfirm;
    this._registry  = registry;

    this._buildCards();
    this._bindConfirmButton();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _buildCards() — génère les cartes HTML des 5 starters
  // ─────────────────────────────────────────────────────────────────────────
  _buildCards() {
    const container = document.getElementById('starter-cards');
    if (!container) return;
    container.innerHTML = '';

    const starters = STARTER_IDS.map(id => POKEMONS.find(p => p.id === id)).filter(Boolean);

    starters.forEach(pokemon => {
      const card = this._createCard(pokemon);
      container.appendChild(card);
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _createCard() — crée une carte HTML pour un pokémon
  // ─────────────────────────────────────────────────────────────────────────
  _createCard(pokemon) {
    const card = document.createElement('div');
    const tier = getBSTTier(pokemon);
    card.className = `poke-card card-tier-${tier}`;
    card.dataset.id = pokemon.id;

    const c1 = hexToCSS(TC[pokemon.types[0]] ?? 0x888888);
    const c2 = hexToCSS(TC[pokemon.types[1]] ?? TC[pokemon.types[0]] ?? 0x888888);

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
    `;

    card.addEventListener('click', () => this._selectCard(pokemon, card));
    return card;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _selectCard() — sélectionne un starter et affiche ses stats
  // ─────────────────────────────────────────────────────────────────────────
  _selectCard(pokemon, cardEl) {
    this._selected = pokemon;

    // Reset toutes les cartes
    document.querySelectorAll('#starter-cards .poke-card')
      .forEach(c => c.classList.remove('selected'));

    // Surligne la carte sélectionnée
    cardEl.classList.add('selected');

    // Affiche les stats
    this._showStats(pokemon);

    // Active le bouton confirmer
    const btn = document.getElementById('btn-confirm-starter');
    if (btn) btn.disabled = false;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _showStats() — affiche la toile de stats du pokémon sélectionné
  // ─────────────────────────────────────────────────────────────────────────
  _showStats(pokemon) {
    const panel = document.getElementById('starter-stats');
    if (!panel) return;

    const s     = pokemon.stats;
    const meta  = window.SaveManager?.loadMeta() ?? null;
    const level = meta?.pokemonLevels?.[pokemon.id] ?? 1;
    const lMult = getLevelBonus(level);
    const boost = v => level > 1 ? Math.round(v * lMult) : v;

    const dominantOffense = boost(s.spa ?? 0) >= boost(s.atk ?? 0) ? 'SP.ATK' : 'ATK';

    const STATS = [
      { emoji: '❤️',  label: 'HP',     base: s.hp,               value: boost(s.hp)                },
      { emoji: '⚔️',  label: 'ATK',    base: s.atk,              value: boost(s.atk)               },
      { emoji: '🛡️',  label: 'DEF',    base: s.def,              value: boost(s.def)               },
      { emoji: '🔮',  label: 'SP.ATK', base: s.spa  ?? 0,        value: boost(s.spa  ?? 0)         },
      { emoji: '💎',  label: 'SP.DEF', base: s.spd_def ?? s.def, value: boost(s.spd_def ?? s.def)  },
      { emoji: '👟',  label: 'VIT',    base: s.spd,              value: boost(s.spd)               },
    ];

    const statsHtml = STATS.map(({ emoji, label, base, value }) => {
      const isMain    = label === dominantOffense;
      const isBoosted = level > 1 && value > base;
      return `
        <div class="stat-item${isMain ? ' stat-item--main' : ''}">
          <span class="stat-icon">${emoji}</span>
          <span class="stat-value" style="${isBoosted ? 'color:#55efc4' : ''}">${value}${isBoosted ? `<span style="font-size:8px;color:#55efc4"> +${value-base}</span>` : ''}</span>
          <span class="stat-label">${label}</span>
        </div>
      `;
    }).join('');

    // Capacité ultime
    const move = getMove(pokemon.id);
    let moveHtml = '';
    if (move) {
      const catLabel = move.cat === 'physical' ? '⚔️ Physique'
                     : move.cat === 'special'  ? '🔮 Spécial'
                     : '✨ Statut';
      const effects = (move.effects ?? []).map(e => {
        if (e.kind === 'status') {
          const icons = {burn:'🔥',poison:'☠️',paralyze:'⚡',freeze:'❄️',
                         sleep:'💤',confuse:'😵',stun:'🔒'};
          return `${icons[e.status] ?? ''}${e.chance < 1 ? ` ${Math.round(e.chance*100)}%` : ' garanti'}`;
        }
        if (e.kind === 'heal')   return `💚 Soin ${Math.round(e.rate*100)}%`;
        if (e.kind === 'drain')  return `🩸 Drain ${Math.round(move.drain*100)}%`;
        if (e.kind === 'stat' && e.mult > 1)  return `${e.who==='self'?'Soi':'Cible'} ${STAT_EMOJIS[e.stat]??e.stat}▲${Math.round((e.mult-1)*100)}%`;
        if (e.kind === 'stat' && e.mult < 1)  return `${e.who==='self'?'Soi':'Cible'} ${STAT_EMOJIS[e.stat]??e.stat}▼${Math.round((1-e.mult)*100)}%`;
        if (e.kind === 'ko')     return `☠ KO ${Math.round(e.chance*100)}%`;
        if (e.kind === 'sacrifice') return '💥 Sacrifice';
        return '';
      }).filter(Boolean).join(' · ');

      const targetLabels = {
        single:'1 cible', all_enemies:'Tous les ennemis', row_front:'Rangée avant',
        row_back:'Rangée arrière', all_allies:'Tous les alliés', self:'Soi-même',
        bounce_2:'Rebond ×2', back_row_prio:'Rangée arrière prioritaire',
        random_2:'2 cibles aléatoires', column:'Colonne', primary_adj:'Cible + adjacents',
      };

      moveHtml = `
        <div class="starter-move-block" style="border-color:${typeColor(move.type)}">
          <div class="starter-move-header">
            <span class="starter-move-name" style="color:${typeColor(move.type)}">⚡ ${move.name}</span>
            <span class="starter-move-meta">${move.type} · ${catLabel}</span>
          </div>
          <div class="starter-move-details">
            ${move.bp > 0 ? `<span class="starter-move-tag">💥 Puiss. ${Math.round(move.bp*(move.powerMult??1))}</span>` : ''}
            <span class="starter-move-tag">🎯 ${targetLabels[move.target] ?? move.target}</span>
            ${move.hits > 1 ? `<span class="starter-move-tag">×${move.hits}</span>` : ''}
            ${move.drain ? `<span class="starter-move-tag">🩸 Drain ${Math.round(move.drain*100)}%</span>` : ''}
            ${move.recoil ? `<span class="starter-move-tag">💥 Recul ${Math.round(move.recoil*100)}%</span>` : ''}
          </div>
          ${effects ? `<div class="starter-move-effects">${effects}</div>` : ''}
        </div>
      `;
    }

    panel.innerHTML = `
      <p><strong>${pokemon.name}</strong> — ${pokemon.types.join(' / ')}</p>
      <div class="stats-grid">${statsHtml}</div>
      ${moveHtml}
    `;

    panel.classList.remove('hidden');
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _bindConfirmButton() — branche le bouton de confirmation
  // ─────────────────────────────────────────────────────────────────────────
  _bindConfirmButton() {
    const btn = document.getElementById('btn-confirm-starter');
    if (!btn) return;

    // Clone pour retirer les anciens listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.disabled = true;

    newBtn.addEventListener('click', () => {
      if (!this._selected) return;
      console.log('Starter confirmé :', this._selected.name);
      initRun(this._registry, this._selected);
      console.log('playerUnits après initRun :', this._registry.get('playerUnits'));
      if (this._onConfirm) this._onConfirm(this._selected);
    });
  },
};
