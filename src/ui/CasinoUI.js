// ─────────────────────────────────────────────────────────────────────────────
// CasinoUI.js — Nœud Casino 🎰
//
// Mise de 3 pièces, relance libre. Quatre issues :
//   6%  → Pokémon T5 aléatoire   36% → objet
//   20% → remboursement          38% → perte
//
// Réglage mesuré sur 300 000 tirages : retour 90.5%, et surtout 63% des
// tirages rapportent QUELQUE CHOSE. Les objets fréquents portent la sensation
// de gain, le T5 (un tous les ~48 pièces) porte l'excitation.
//
// PITIÉ : au bout de PITY_THRESHOLD pertes SÈCHES consécutives, le tirage
// suivant est gagnant. Un remboursement ne compte pas comme perte, mais il
// remet le compteur à zéro. Plafond mesuré : jamais plus de 3 pertes d'affilée.
//
// Si un T5 est décroché alors que la banque est pleine, on ouvre l'écran de
// préparation pour libérer une place, puis on valide l'obtention.
// ─────────────────────────────────────────────────────────────────────────────

import { POKEMONS }                     from '../data/pokemons.js';
import { ITEMS, pickEquippableItems }   from '../data/items.js';
import { getRunState, setRunState, addToBank, addCoins, removeCoins,
         addToInventory, getBSTTier, getRunRegion }        from '../data/runState.js';
import { isPokemonAllowed }             from '../data/regions.js';

export const CASINO_COST      = 3;
export const PITY_THRESHOLD   = 3;

// Bornes cumulées du tirage
const ODDS = [
  { id: 'jackpot', upTo: 0.06, label: 'Pokémon T5', emoji: '⭐' },
  { id: 'item',    upTo: 0.42, label: 'Objet',      emoji: '🎁' },
  { id: 'refund',  upTo: 0.62, label: 'Remboursé',  emoji: '🪙' },
  { id: 'loss',    upTo: 1.00, label: 'Perdu',      emoji: '💨' },
];

const REELS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];

export const CasinoUI = {
  _registry: null,
  _onDone:   null,
  _spinning: false,
  // Position des rouleaux CONSERVÉE entre deux tirages : le résultat obtenu
  // devient la position de départ du suivant, comme sur une vraie machine.
  _reels:    ['🍒', '🍋', '🔔'],

  init(data, registry, onDone) {
    this._registry = registry;
    this._onDone   = onDone;
    this._spinning = false;
    this._reels    = getRunState(registry)?.casinoReels ?? ['🍒', '🍋', '🔔'];
    this._startCoinWatch();
    this._render();
  },

  // ── Tirage ────────────────────────────────────────────────────────────────
  _draw() {
    const state = getRunState(this._registry) ?? {};
    const fails = state.casinoFails ?? 0;

    // Pitié : le tirage suivant ne peut pas être une perte sèche
    if (fails >= PITY_THRESHOLD) {
      setRunState(this._registry, { casinoFails: 0 });
      return Math.random() < 0.15 ? 'jackpot' : 'item';
    }

    const r = Math.random();
    const outcome = ODDS.find(o => r < o.upTo)?.id ?? 'loss';
    // Seules les pertes SÈCHES alimentent la pitié : un remboursement n'est pas
    // une perte. Compter les remboursements portait le retour à 97%, au-dessus
    // de la cible de 90%.
    setRunState(this._registry, {
      casinoFails: outcome === 'loss' ? fails + 1 : 0,
    });
    return outcome;
  },

  // Pokémon T5 tiré parmi les générations autorisées
  _pickT5() {
    const meta   = window.SaveManager?.loadMeta?.() ?? {};
    const region = getRunRegion(this._registry);
    const pool   = POKEMONS.filter(p =>
      isPokemonAllowed(p.id, region, meta) && getBSTTier(p) === 5);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  _pickItem() {
    const bank = getRunState(this._registry)?.playerBank ?? [];
    return pickEquippableItems(1, bank)[0] ?? ITEMS.restes;
  },

  // ── Rendu ─────────────────────────────────────────────────────────────────
  _render() {
    const root = document.getElementById('casino-root');
    if (!root) return;
    const coins = getRunState(this._registry)?.coins ?? 0;
    const canPlay = coins >= CASINO_COST;

    root.innerHTML = `
      <div class="casino-wrap">
        <h2 class="casino-title">🎰 Casino</h2>
        <p class="casino-sub">Mise de ${CASINO_COST} pièces par tirage</p>

        <div class="casino-reels" id="casino-reels">
          ${this._reels.map(r => `<span class="reel">${r}</span>`).join('')}
        </div>

        <div class="casino-result" id="casino-result"></div>

        <div class="casino-odds">
          ${ODDS.map((o, i) => {
            const pct = Math.round((o.upTo - (ODDS[i - 1]?.upTo ?? 0)) * 100);
            return `<span>${o.emoji} ${o.label} <b>${pct}%</b></span>`;
          }).join('')}
        </div>

        <div class="casino-actions">
          <button id="casino-spin" class="btn-primary" ${canPlay ? '' : 'disabled'}>
            🎰 Miser ${CASINO_COST} pièces
          </button>
          <button id="casino-leave" class="btn-secondary">Quitter</button>
        </div>
        <div class="casino-coins">💰 ${coins} pièces</div>
      </div>`;

    document.getElementById('casino-spin')?.addEventListener('click', () => this._spin());
    document.getElementById('casino-leave')?.addEventListener('click', () => { this._stopCoinWatch(); this._onDone?.(); });
  },

  async _spin() {
    if (this._spinning) return;
    const state = getRunState(this._registry) ?? {};
    if ((state.coins ?? 0) < CASINO_COST) return;

    this._spinning = true;
    removeCoins(this._registry, CASINO_COST);

    const outcome = this._draw();
    await this._animateReels(outcome);
    await this._applyOutcome(outcome);

    this._spinning = false;
    this._render();
  },

  // Animation : le résultat est déjà décidé, les rouleaux ne font que l'illustrer
  _animateReels(outcome) {
    return new Promise(resolve => {
      const reels = document.querySelectorAll('#casino-reels .reel');
      const FINAL = {
        jackpot: ['7️⃣', '7️⃣', '7️⃣'],
        item:    ['💎', '💎', '🍋'],
        refund:  ['🔔', '🍒', '🔔'],
        loss:    ['🍒', '🍋', '⭐'],
      }[outcome];

      let ticks = 0;
      const timer = setInterval(() => {
        ticks++;
        reels.forEach((r, i) => {
          if (ticks > 10 + i * 5) { r.textContent = FINAL[i]; r.classList.add('locked'); }
          else r.textContent = REELS[Math.floor(Math.random() * REELS.length)];
        });
        if (ticks > 25) {
          clearInterval(timer);
          // Le résultat devient la position de départ du prochain tirage
          this._reels = [...FINAL];
          setRunState(this._registry, { casinoReels: [...FINAL] });
          resolve();
        }
      }, 60);
    });
  },

  async _applyOutcome(outcome) {
    const box = document.getElementById('casino-result');
    const say = (html, cls = '') => { if (box) box.innerHTML = `<div class="casino-msg ${cls}">${html}</div>`; };

    switch (outcome) {
      case 'refund':
        addCoins(this._registry, CASINO_COST);
        say(`🪙 Mise remboursée`, 'neutral');
        break;

      case 'item': {
        const item = this._pickItem();
        addToInventory(this._registry, item.id);
        say(`🎁 <b>${item.emoji} ${item.name}</b> obtenu !`, 'win');
        await this._celebrate({
          title:  'Félicitations, vous avez obtenu l\'objet :',
          visual: `<span class="cw-emoji">${item.emoji}</span>`,
          name:   item.name,
          tier:   'item',
        });
        break;
      }

      case 'jackpot': {
        const p = this._pickT5();
        if (!p) { addCoins(this._registry, CASINO_COST); say('🪙 Mise remboursée', 'neutral'); break; }
        const added = addToBank(this._registry, p);
        if (added) {
          say(`⭐ <b>${p.name}</b> rejoint votre équipe !`, 'jackpot');
          await this._celebrate({
            title:  'Félicitations, vous avez obtenu :',
            visual: `<img src="${p.spriteUrl}" alt="${p.name}" class="cw-sprite"
                          onerror="this.src='assets/placeholder.png'" />`,
            name:   p.name,
            tier:   'jackpot',
          });
        } else {
          // Banque pleine : on laisse le joueur libérer une place, puis on valide
          say(`⭐ <b>${p.name}</b> ! Votre banque est pleine, libérez une place.`, 'jackpot');
          const ok = await window.UIManager?.openBankForRoom?.(p);
          if (ok && addToBank(this._registry, p)) {
            say(`⭐ <b>${p.name}</b> rejoint votre équipe !`, 'jackpot');
            await this._celebrate({
              title:  'Félicitations, vous avez obtenu :',
              visual: `<img src="${p.spriteUrl}" alt="${p.name}" class="cw-sprite"
                            onerror="this.src='assets/placeholder.png'" />`,
              name:   p.name,
              tier:   'jackpot',
            });
          } else {
            // Place non libérée : la mise est rendue plutôt que perdue
            addCoins(this._registry, CASINO_COST);
            say(`🪙 Place non libérée, mise remboursée.`, 'neutral');
          }
        }
        break;
      }

      default:
        say(`💨 Perdu... ${this._pityHint()}`, 'lose');
    }
  },

  // ── Fenêtre de gain ───────────────────────────────────────────────────────
  // Bloquante : le joueur valide avant de relancer. L'intensité des effets
  // distingue l'objet (courant) du jackpot (rare).
  _celebrate({ title, visual, name, tier }) {
    return new Promise(resolve => {
      const isJackpot = tier === 'jackpot';
      const ov = document.createElement('div');
      ov.className = `casino-win-overlay ${isJackpot ? 'jackpot' : ''}`;
      ov.innerHTML = `
        <div class="casino-win-box">
          ${isJackpot ? '<div class="cw-rays"></div>' : ''}
          <p class="cw-title">${title}</p>
          <div class="cw-visual">${visual}</div>
          <p class="cw-name">${name}</p>
          <button class="btn-primary cw-ok">Super !</button>
        </div>`;
      document.body.appendChild(ov);

      this._spawnConfetti(isJackpot ? 140 : 45);
      if (isJackpot) {
        this._firework(0.3, 0.35);
        setTimeout(() => this._firework(0.7, 0.28), 450);
        setTimeout(() => this._firework(0.5, 0.45), 900);
      }

      const close = () => { ov.remove(); resolve(); };
      ov.querySelector('.cw-ok')?.addEventListener('click', close);
      ov.addEventListener('click', e => { if (e.target === ov) close(); });
    });
  },

  _spawnConfetti(count = 50) {
    const colors = ['#ffd700','#ff6b6b','#74b9ff','#55efc4','#ffeaa7','#fd79a8','#a29bfe','#fdcb6e'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'lv-confetti';
      const size   = 6 + Math.random() * 8;
      const isRect = Math.random() > 0.5;
      p.style.cssText = `
        left: ${Math.random() * 100}%; top: -24px;
        width: ${size}px; height: ${isRect ? size * 0.5 : size}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${isRect ? '1px' : '50%'};
        animation-duration: ${2 + Math.random() * 2.5}s;
        animation-delay: ${Math.random() * 1.2}s;
        transform: rotate(${Math.random() * 360}deg);`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 5000);
    }
  },

  // Explosion : particules projetées en cercle depuis un point de l'écran
  _firework(xRatio = 0.5, yRatio = 0.35) {
    const colors = ['#ffd700','#ff6b6b','#74b9ff','#55efc4','#fd79a8','#ffeaa7'];
    const N = 34;
    for (let i = 0; i < N; i++) {
      const a  = (Math.PI * 2 * i) / N + Math.random() * 0.2;
      const d  = 90 + Math.random() * 120;
      const p  = document.createElement('div');
      p.className = 'cw-spark';
      p.style.cssText = `
        left: ${xRatio * 100}%; top: ${yRatio * 100}%;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        --dx: ${Math.cos(a) * d}px; --dy: ${Math.sin(a) * d}px;
        animation-delay: ${Math.random() * 0.08}s;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }
  },

  _pityHint() {
    const fails = getRunState(this._registry)?.casinoFails ?? 0;
    const left  = PITY_THRESHOLD - fails;
    return left > 0 && left <= 2
      ? `<span class="casino-pity">(gain garanti dans ${left})</span>` : '';
  },

  // Les pièces peuvent changer pendant que l'écran est ouvert (vente depuis
  // l'écran de préparation). On resynchronise plutôt que de figer le montant
  // lu à l'arrivée sur le nœud.
  _startCoinWatch() {
    this._stopCoinWatch();
    this._lastCoins = this._coins?.() ?? getRunState(this._registry)?.coins ?? 0;
    this._coinTimer = setInterval(() => {
      const now = getRunState(this._registry)?.coins ?? 0;
      if (now !== this._lastCoins) { this._lastCoins = now; this._render(); }
    }, 400);
  },

  _stopCoinWatch() {
    if (this._coinTimer) { clearInterval(this._coinTimer); this._coinTimer = null; }
  },
};