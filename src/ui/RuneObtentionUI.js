// ─────────────────────────────────────────────────────────────────────────────
// RuneObtentionUI.js — Révélation d'une rune obtenue (overlay autonome).
// Calqué sur UIManager.confirm : réutilise .ui-confirm-overlay / .ui-confirm-box,
// crée son propre DOM, se retire tout seul. Aucun routage à modifier.
// ─────────────────────────────────────────────────────────────────────────────

import { RUNES, scaleRune } from '../data/runes.js';
import { RARITY_META }      from '../data/rarity.js';

const RUNE_ICONS = {
  violent: '⚡', vampire: '🩸', effroi: '😱',
  rempart_vital: '🛡', rempart_offensif: '🛡', rempart_defensif: '🛡',
  panacee: '💊', revanche: '⚔️', epines: '🌵',
  paralysie: '⚡', toxine: '☠️', combustion: '🔥', confusion: '💫',
};

const TRIGGER_LABEL = { onAttack: 'À l\'attaque', onHitReceived: 'Quand touché' };

// Décrit l'effet scalé en clair (magnitude en pourcentage).
function effectLine(rune) {
  const e   = rune.effect;
  const pct = Math.round(e.mag * 100);
  switch (e.kind) {
    case 'replay':            return `${pct}% de rejouer une attaque`;
    case 'lifesteal':         return `Vol de vie : ${pct}% des dégâts infligés`;
    case 'stun':              return `${pct}% d'étourdir la cible`;
    case 'shield': {
      const from = { hp: 'des PV max', atk: "de l'ATK dominante",
                     def: 'de la DEF dominante' }[e.fromStat] ?? 'de la stat';
      return `Bouclier : ${pct}% ${from}`;
    }
    case 'heal_most_wounded': return `Soigne le plus blessé : ${pct}% de ses PV max`;
    case 'counter':           return `${pct}% de contre-attaquer`;
    case 'reflect':           return `Renvoie ${pct}% des dégâts reçus`;
    case 'status': {
      const verb = { poison: 'empoisonner', burn: 'brûler',
                     paralyze: 'paralyser', confuse: 'confondre' }[e.status] ?? e.status;
      const stk  = e.stacks ? ` (${e.stacks} stacks)` : '';
      const el   = /^[aeiou\u00e9\u00e8]/i.test(verb) ? "d'" : 'de ';
      return `${pct}% ${el}${verb} l'attaquant${stk}`;
    }
    default: return '';
  }
}

export const RuneObtentionUI = {
  // rune : { uid, type, rarity }. onDone appelé à la fermeture.
  show(rune, onDone) {
    if (!rune || !RUNES[rune.type]) { onDone?.(); return; }
    const base   = RUNES[rune.type];
    const scaled = scaleRune(rune.type, rune.rarity);
    const meta   = RARITY_META[rune.rarity] ?? RARITY_META.normal;
    const icon   = RUNE_ICONS[rune.type] ?? '🔯';

    const overlay = document.createElement('div');
    overlay.className = 'ui-confirm-overlay rune-reveal-overlay';
    overlay.innerHTML = `
      <div class="ui-confirm-box rune-reveal-box rarity-${rune.rarity}" role="dialog" aria-modal="true">
        <div class="rune-reveal-head">Rune obtenue !</div>
        <div class="rune-reveal-icon rarity-${rune.rarity}">${icon}</div>
        <div class="rune-reveal-name">${base.name}</div>
        <div class="rune-reveal-rarity" style="color:${meta.color}">${meta.label}</div>
        <div class="rune-reveal-trigger">${TRIGGER_LABEL[base.trigger] ?? ''}</div>
        <div class="rune-reveal-effect">${effectLine(scaled)}</div>
        <div class="ui-confirm-actions">
          <button class="ui-confirm-yes rune-reveal-ok">Continuer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const close = () => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener('keydown', onKey);
      onDone?.();
    };
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') close(); };
    overlay.querySelector('.rune-reveal-ok').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
  },
};