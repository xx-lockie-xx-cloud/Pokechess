// ─────────────────────────────────────────────────────────────────────────────
// PokedexUI.js — Encyclopédie in-game (Synergies · Types · Capacités · Succès)
// ─────────────────────────────────────────────────────────────────────────────

import { SYNERGIES }          from '../data/synergies.js';
import { TYPE_CHART }         from '../data/typeChart.js';
import { MOVES, POKEMON_MOVES } from '../data/moves.js';
import { getSeenPokemon }     from '../data/runState.js';
import { POKEMONS }           from '../data/pokemons.js';
import { ACHIEVEMENTS, POKEMON_PASSIVES,
         getLevelBadgeHTML, getLevelBonus, MAX_LEVEL } from '../data/levelSystem.js';

const TYPES = [
  'Normal','Feu','Eau','Électrik','Plante','Glace','Combat','Poison',
  'Sol','Vol','Psy','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée',
];

const TYPE_COLORS = {
  Normal:'#a8a878',   Feu:'#f08030',     Eau:'#6890f0',    Électrik:'#f8d030',
  Plante:'#78c850',   Glace:'#98d8d8',   Combat:'#c03028', Poison:'#a040a0',
  Sol:'#e0c068',      Vol:'#a890f0',     Psy:'#f85888',    Insecte:'#a8b820',
  Roche:'#b8a038',    Spectre:'#705898', Dragon:'#7038f8', Ténèbres:'#705848',
  Acier:'#b8b8d0',    Fée:'#ee99ac',
};

const STAT_EMOJIS = {
  hp:'❤️', atk:'⚔️', def:'🛡️', spa:'🔮', spd_def:'💎', spd:'👟',
};

const EFFECT_DESC = {
  burn:'🔥 Brûlure : -10% ATK + 5% HP/tour sur les ennemis',
  regen:'💧 Régénération : +4% HP/tour pour les unités Eau alliées (5 tours)',
  poison:'☠️ Poison : -8% HP/tour sur les ennemis',
  paralyze:'⚡ Paralysie : 25% de chance de skip/tour',
  confuse:'😵 Confusion : 20% de chance de frapper un allié',
  freeze:'❄️ Gel : 30% de chance de skip, se dissipe sur coup reçu',
  dodge:'🦅 Esquive : 20% d\'esquive pour les unités Vol',
  crit:'🎯 Coup Critique : +30% chances de crit (×1.5 dégâts)',
  swarm:'🦋 Essaim : 15% qu\'un autre Insecte enchaîne (max 2/tour)',
  quake:'🏔 Tremblement : -5% HP max sur tous les ennemis au début',
  curse:'👻 Malédiction : l\'ennemi avec + de HP perd 10% HP/tour',
  intimidate:'🌑 Intimidation : -15% ATK + SP.ATK ennemies au début',
  armor:'🛡 Armure : le premier coup reçu est absorbé',
  charm:'🧚 Charme : les ennemis ciblent toujours le + défensif',
  rage:'🐉 Rage : +10% dégâts par allié Dragon KO',
  iron:'⚙️ Armure Acier : -20% dégâts reçus pour les Acier',
};

const CAT_LABEL = { physical:'⚔️ Physique', special:'🔮 Spécial', status:'✨ Statut' };

const TARGET_LABEL = {
  single:'1 cible',          all_enemies:'Tous les ennemis',
  row_front:'Rangée avant',  row_back:'Rangée arrière',
  all_allies:'Tous les alliés', self:'Soi-même',
  bounce_2:'Rebond ×2',      back_row_prio:'Rangée arrière prio.',
  random_2:'2 aléatoires',   column:'Colonne',
  primary_adj:'+ adjacents', nearest_2:'2 proches',
  random_3:'3 aléatoires',   row_primary:'Rangée cible',
};

// ─────────────────────────────────────────────────────────────────────────────
export const PokedexUI = {
  _registry: null,
  _overlay:  null,
  _tab:      'synergies',

  // ── Initialisation ────────────────────────────────────────────────────────
  init(registry) {
    this._registry = registry;
    this._overlay  = document.getElementById('overlay-pokedex');
    if (!this._overlay) return;
    document.getElementById('btn-pokedex')
      ?.addEventListener('click', () => this.open());
    document.getElementById('btn-pokedex-close')
      ?.addEventListener('click', () => this.close());
    this._overlay.addEventListener('click', e => {
      if (e.target === this._overlay) this.close();
    });
  },

  open(tab = this._tab) {
    this._tab = tab;
    this._render();
    this._overlay?.classList.add('active');
    document.body.classList.add('overlay-open');
  },

  close() {
    this._overlay?.classList.remove('active');
    document.body.classList.remove('overlay-open');
  },

  // ── Rendu principal ───────────────────────────────────────────────────────
  _render() {
    const content = document.getElementById('pokedex-content');
    if (!content) return;
    const tabs = ['synergies', 'types', 'moves', 'achievements', 'tutorial'];
    const tabLabels = {
      synergies:    '🔗 Synergies',
      types:        '⚔️ Types',
      moves:        '⚡ Capacités',
      achievements: '🏅 Succès',
      tutorial:     '📖 Guide',
    };
    content.innerHTML = `
      <div class="pdx-tabs">
        ${tabs.map(t => `
          <button class="pdx-tab${this._tab === t ? ' active' : ''}" data-tab="${t}">
            ${tabLabels[t]}
          </button>
        `).join('')}
      </div>
      <div class="pdx-body" id="pdx-body"></div>
    `;
    content.querySelectorAll('.pdx-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._tab = btn.dataset.tab;
        this._render();
      });
    });
    const body = document.getElementById('pdx-body');
    if (this._tab === 'synergies')    this._renderSynergies(body);
    if (this._tab === 'types')        this._renderTypes(body);
    if (this._tab === 'moves')        this._renderMoves(body);
    if (this._tab === 'achievements') this._renderAchievements(body);
    if (this._tab === 'tutorial') { TutorialUI.open('intro'); this._tab = 'synergies'; this._render(); }
  },

  // ── Onglet Synergies ──────────────────────────────────────────────────────
  _renderSynergies(body) {
    body.innerHTML = Object.entries(SYNERGIES).map(([type, syn]) => {
      const color = TYPE_COLORS[type] ?? '#888';
      const renderTier = (tier, data) => {
        const bonuses = Object.entries(data.statBonus ?? {}).map(([stat, mult]) => {
          const pct = Math.round((mult - 1) * 100);
          return `<span class="pdx-stat-bonus">${STAT_EMOJIS[stat] ?? stat} +${pct}%</span>`;
        }).join('');
        const effect = data.effect
          ? `<div class="pdx-effect">${EFFECT_DESC[data.effect] ?? data.effect}</div>`
          : '';
        return `
          <div class="pdx-syn-tier">
            <div class="pdx-tier-header">
              <span class="pdx-stars">${'★'.repeat(tier)}</span>
              <span class="pdx-tier-bonuses">${bonuses}</span>
            </div>
            ${effect}
          </div>`;
      };
      return `
        <div class="pdx-syn-card" style="border-left-color:${color}">
          <div class="pdx-syn-title">
            <span class="pdx-type-badge" style="background:${color}">${syn.icon} ${type}</span>
          </div>
          ${renderTier(2, syn.seuil2)}
          ${renderTier(3, syn.seuil3)}
        </div>`;
    }).join('');
  },

  // ── Onglet Types ──────────────────────────────────────────────────────────
  _renderTypes(body) {
    const cellStyle = (mult) => {
      if (mult === 2)   return 'background:#27ae60;color:#fff;font-weight:700';
      if (mult === 0.5) return 'background:#e74c3c;color:#fff;font-weight:700';
      if (mult === 0)   return 'background:#2c3e50;color:#95a5a6';
      return 'background:#1a1a2e;color:#4a5568';
    };
    const cellText = (mult) => {
      if (mult === 2)   return '×2';
      if (mult === 0.5) return '½';
      if (mult === 0)   return '0';
      return '';
    };
    body.innerHTML = `
      <div class="pdx-type-legend">
        <span style="background:#27ae60;color:#fff;padding:2px 6px;border-radius:4px">×2 Super efficace</span>
        <span style="background:#e74c3c;color:#fff;padding:2px 6px;border-radius:4px">½ Peu efficace</span>
        <span style="background:#2c3e50;color:#95a5a6;padding:2px 6px;border-radius:4px">0 Immunité</span>
      </div>
      <div class="pdx-type-scroll">
        <table class="pdx-type-table">
          <thead>
            <tr>
              <th class="pdx-type-corner">ATK ↓ DEF →</th>
              ${TYPES.map(t => `
                <th class="pdx-type-th">
                  <span class="pdx-type-mini" style="background:${TYPE_COLORS[t]}">${t.slice(0,3)}</span>
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${TYPES.map(atk => `
              <tr>
                <td class="pdx-type-label">
                  <span class="pdx-type-mini" style="background:${TYPE_COLORS[atk]}">${atk}</span>
                </td>
                ${TYPES.map(def => {
                  const mult = (TYPE_CHART[atk]?.[def]) ?? 1;
                  return `<td class="pdx-type-cell" style="${cellStyle(mult)}">${cellText(mult)}</td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  },

  // ── Onglet Capacités ──────────────────────────────────────────────────────
  _renderMoves(body) {
    const runSeen  = getSeenPokemon(this._registry);
    const meta     = window.SaveManager?.loadMeta() ?? null;
    const metaSeen = new Set(meta?.seenPokemon ?? []);
    const seen     = new Set([...runSeen, ...metaSeen]);

    // Inclut aussi tous les pokémons avec niveau > 1 (déjà utilisés par le joueur)
    const usedIds  = new Set(Object.entries(meta?.pokemonLevels ?? {})
      .filter(([, lvl]) => lvl > 1).map(([id]) => parseInt(id)));

    const entries  = POKEMONS.filter(p => seen.has(p.id) || usedIds.has(p.id))
                             .sort((a, b) => a.id - b.id);

    if (!entries.length) {
      body.innerHTML = `
        <div class="pdx-empty">
          <p>Aucun Pokémon utilisé pour l'instant.</p>
          <p style="font-size:11px;color:var(--text-muted)">Les Pokémon apparaîtront après leur premier combat.</p>
        </div>`;
      return;
    }

    body.innerHTML = entries.map(pokemon => {
      const moveKey = POKEMON_MOVES[pokemon.id];
      if (!moveKey) return '';
      const move = MOVES[moveKey];
      if (!move) return '';
      const color   = TYPE_COLORS[move.type] ?? '#888';
      const pLevel  = meta?.pokemonLevels?.[pokemon.id] ?? 1;
      const pBonus  = Math.round((getLevelBonus(pLevel) - 1) * 100);
      const pct     = Math.round(pLevel / MAX_LEVEL * 100);
      const isCaught = meta?.caughtPokemon?.includes(pokemon.id);

      const effects = (move.effects ?? []).map(e => {
        if (e.kind === 'status') {
          const icons = {burn:'🔥',poison:'☠️',paralyze:'⚡',freeze:'❄️',sleep:'💤',confuse:'😵',stun:'🔒'};
          return `${icons[e.status] ?? '●'}${e.chance < 1 ? ` ${Math.round(e.chance*100)}%` : ' garanti'}`;
        }
        if (e.kind === 'stat') {
          const up  = e.mult > 1;
          const pct = Math.round(Math.abs(e.mult - 1) * 100);
          const who = e.who === 'self' ? 'Soi' : e.who === 'all_targets' ? 'Tous' : 'Cible';
          return `${who} ${STAT_EMOJIS[e.stat] ?? e.stat}${up ? '▲' : '▼'}${pct}%`;
        }
        if (e.kind === 'heal')       return `💚 Soin ${Math.round(e.rate*100)}%`;
        if (e.kind === 'ko')         return `☠ KO ${Math.round(e.chance*100)}%`;
        if (e.kind === 'sacrifice')  return '💥 Sacrifice';
        if (e.kind === 'shield')     return '🛡 Bouclier';
        if (e.kind === 'clear_buffs') return '🌀 Reset buffs';
        return '';
      }).filter(Boolean).join(' · ');

      const bp    = move.bp > 0 ? Math.round(move.bp * (move.powerMult ?? 1)) : null;
      const hits  = move.hits > 1 ? `×${move.hits}` : move.hitsRandom ? `×${move.hitsRandom[0]}-${move.hitsRandom[1]}` : null;
      const tags  = [
        bp   ? `💥 ${bp}`    : null,
        CAT_LABEL[move.cat],
        TARGET_LABEL[move.target] ?? move.target,
        hits,
        move.drain  ? `🩸 ${Math.round(move.drain*100)}%`  : null,
        move.recoil ? `💥 Recul ${Math.round(move.recoil*100)}%` : null,
      ].filter(Boolean);

      return `
        <div class="pdx-move-entry">
          <div class="pdx-move-pokemon">
            <img src="${pokemon.spriteUrl}" alt="${pokemon.name}"
                 onerror="this.src='assets/placeholder.png'"
                 class="pdx-pokemon-sprite ${isCaught ? 'pdx-caught' : ''}" />
            <span class="pdx-pokemon-name">#${pokemon.id} ${pokemon.name}</span>
            ${getLevelBadgeHTML(pLevel)}
            <div class="pdx-level-bar-wrap">
              <div class="pdx-level-bar" style="width:${pct}%"></div>
            </div>
            ${pBonus > 0 ? `<span class="pdx-level-bonus">+${pBonus}% stats</span>` : ''}
          </div>
          <div class="pdx-move-info" style="border-left-color:${color}">
            <div class="pdx-move-header">
              <span class="pdx-move-name-big" style="color:${color}">⚡ ${move.name}</span>
              <span class="pdx-type-badge-sm" style="background:${color}">${move.type}</span>
            </div>
            <div class="pdx-move-tags">${tags.map(t => `<span class="pdx-tag">${t}</span>`).join('')}</div>
            ${effects ? `<div class="pdx-move-fx">${effects}</div>` : ''}
          </div>
          ${(() => {
            const allPassives = POKEMON_PASSIVES[pokemon.id];
            if (!allPassives) return '';
            const lines = [35, 70].map(threshold => {
              const p = allPassives[threshold];
              if (!p) return '';
              const unlocked = pLevel >= threshold;
              return `
                <div class="pdx-passive-row ${unlocked ? 'unlocked' : 'locked'}">
                  <span class="pdx-passive-lvl" style="opacity:${unlocked?1:0.4}">
                    ${unlocked ? '✨' : '🔒'} Nv.${threshold}
                  </span>
                  ${unlocked
                    ? `<div>
                        <span class="pdx-passive-name">${p.name}</span>
                        <span class="pdx-passive-desc">${p.desc}</span>
                       </div>`
                    : `<span class="pdx-passive-hint">Passif masqué — atteindre le niveau ${threshold}</span>`
                  }
                </div>`;
            }).join('');
            return lines ? `<div class="pdx-passives">${lines}</div>` : '';
          })()}
        </div>`;
    }).join('');
  },

  // ── Onglet Achievements ───────────────────────────────────────────────────
  _renderAchievements(body) {
    const meta     = window.SaveManager?.loadMeta() ?? {};
    const unlocked = meta.achievements ?? {};

    const categories = {
      league:      { label: '🏆 Ligue par type', items: [] },
      progression: { label: '🗺 Progression',    items: [] },
      collection:  { label: '📖 Collection',     items: [] },
      level:       { label: '⬆ Niveaux',         items: [] },
      combat:      { label: '⚔️ Combat',         items: [] },
      roguelite:   { label: '🎲 Roguelite',      items: [] },
    };

    Object.values(ACHIEVEMENTS).forEach(a => {
      const cat = categories[a.category];
      if (cat) cat.items.push(a);
    });

    const total = Object.values(ACHIEVEMENTS).length;
    const done  = Object.values(unlocked).filter(v => v?.unlocked).length;
    const pct   = total > 0 ? Math.round(done / total * 100) : 0;

    body.innerHTML = `
      <div class="pdx-ach-header">
        <span class="pdx-ach-count">${done}/${total} succès débloqués</span>
        <div class="pdx-ach-progress-bar">
          <div class="pdx-ach-progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
      ${Object.values(categories).map(cat => {
        if (!cat.items.length) return '';
        return `
          <div class="pdx-ach-category">
            <div class="pdx-ach-cat-title">${cat.label}</div>
            <div class="pdx-ach-list">
              ${cat.items.map(a => {
                const isUnlocked = unlocked[a.id]?.unlocked;
                return `
                  <div class="pdx-ach-item ${isUnlocked ? 'unlocked' : 'locked'}">
                    <span class="pdx-ach-icon">${isUnlocked ? '✅' : '🔒'}</span>
                    <div class="pdx-ach-info">
                      <span class="pdx-ach-label">${a.label}</span>
                      <span class="pdx-ach-desc">${a.desc}</span>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')}
    `;
  },
};