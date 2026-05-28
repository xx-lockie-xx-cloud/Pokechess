// ─────────────────────────────────────────────────────────────────────────────
// TutorialUI.js — Guide du joueur (7 sections)
// Affiché au premier lancement et accessible depuis le Pokédex
// ─────────────────────────────────────────────────────────────────────────────

const GENGAR_SPRITE   = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png";
const NIDORINO_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/33.png";

const SECTIONS = [
  { id:"intro",     icon:"🎮", label:"Introduction" },
  { id:"map",       icon:"🗺",  label:"La Map" },
  { id:"prep",      icon:"⚔️",  label:"Préparation" },
  { id:"combat",    icon:"💥",  label:"Combat" },
  { id:"synergies", icon:"🔗",  label:"Synergies" },
  { id:"items",     icon:"🎒",  label:"Objets" },
  { id:"roguelite", icon:"🎲",  label:"Roguelite" },
];

export const TutorialUI = {
  _overlay: null,
  _active:  'intro',
  _combatInterval: null,
  _combatState: null,

  // ── Initialisation ────────────────────────────────────────────────────────
  init() {
    this._overlay = document.getElementById('overlay-tutorial');
    if (!this._overlay) return;

    document.getElementById('btn-tutorial-close')
      ?.addEventListener('click', () => this.close());

    this._overlay.addEventListener('click', e => {
      if (e.target === this._overlay) this.close();
    });
  },

  // ── Ouvre le tutoriel ────────────────────────────────────────────────────
  open(section = 'intro') {
    if (!this._overlay) this.init();
    this._active = section;
    this._render();
    this._overlay?.classList.add('active');
    document.body.classList.add('overlay-open');
  },

  // ── Ferme et nettoie ─────────────────────────────────────────────────────
  close() {
    clearInterval(this._combatInterval);
    this._combatInterval = null;
    this._overlay?.classList.remove('active');
    document.body.classList.remove('overlay-open');
  },

  // ── Rendu principal ───────────────────────────────────────────────────────
  _render() {
    const content = document.getElementById('tutorial-content');
    if (!content) return;

    const currentIdx = SECTIONS.findIndex(s => s.id === this._active);
    const prev = SECTIONS[currentIdx - 1];
    const next = SECTIONS[currentIdx + 1];

    content.innerHTML = `
      <div class="tut-tabs">
        ${SECTIONS.map(s => `
          <button class="tut-tab ${this._active === s.id ? 'active' : ''}"
                  data-section="${s.id}">
            ${s.icon} <span class="tut-tab-label">${s.label}</span>
          </button>
        `).join('')}
      </div>

      <div class="tut-body" id="tut-body">
        ${this._renderSection(this._active)}
      </div>

      <div class="tut-nav">
        <button class="tut-nav-btn ${prev ? '' : 'disabled'}"
                data-nav="${prev?.id ?? ''}">
          ${prev ? `← ${prev.icon} ${prev.label}` : ''}
        </button>
        <div class="tut-dots">
          ${SECTIONS.map((s, i) => `
            <div class="tut-dot ${this._active === s.id ? 'active' : ''}"
                 data-section="${s.id}"></div>
          `).join('')}
        </div>
        <button class="tut-nav-btn ${next ? '' : 'disabled'}"
                data-nav="${next?.id ?? ''}">
          ${next ? `${next.icon} ${next.label} →` : ''}
        </button>
      </div>
    `;

    // Listeners onglets
    content.querySelectorAll('.tut-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        clearInterval(this._combatInterval);
        this._active = btn.dataset.section;
        this._render();
        document.getElementById('tut-body')?.scrollTo(0, 0);
      });
    });

    // Listeners nav prev/next
    content.querySelectorAll('.tut-nav-btn').forEach(btn => {
      if (btn.dataset.nav) {
        btn.addEventListener('click', () => {
          clearInterval(this._combatInterval);
          this._active = btn.dataset.nav;
          this._render();
          document.getElementById('tut-body')?.scrollTo(0, 0);
        });
      }
    });

    // Listeners points
    content.querySelectorAll('.tut-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        clearInterval(this._combatInterval);
        this._active = dot.dataset.section;
        this._render();
      });
    });

    // Lance l'animation combat si section combat
    if (this._active === 'combat') {
      this._startCombatDemo();
    }
  },

  // ── Sections ─────────────────────────────────────────────────────────────
  _renderSection(id) {
    switch (id) {
      case 'intro':     return this._sectionIntro();
      case 'map':       return this._sectionMap();
      case 'prep':      return this._sectionPrep();
      case 'combat':    return this._sectionCombat();
      case 'synergies': return this._sectionSynergies();
      case 'items':     return this._sectionItems();
      case 'roguelite': return this._sectionRoguelite();
      default:          return this._sectionIntro();
    }
  },

  _card(content, extra = '') {
    return `<div class="tut-card${extra ? ' '+extra : ''}">${content}</div>`;
  },
  _title(t, color = '#ffd700') {
    return `<h3 class="tut-title" style="color:${color}">${t}</h3>`;
  },
  _tip(t) {
    return `<div class="tut-tip">💡 ${t}</div>`;
  },
  _badge(color, text) {
    return `<span class="tut-badge" style="background:${color}33;border-color:${color};color:${color}">${text}</span>`;
  },

  // ── Section Intro ─────────────────────────────────────────────────────────
  _sectionIntro() {
    return `
      ${this._card(`
        <div style="text-align:center;padding:8px 0">
          <div style="font-size:40px;margin-bottom:6px">🏆</div>
          <h2 class="tut-game-title">PokeChess</h2>
          <p style="color:#718096;font-size:12px;margin:0">
            Un autochess roguelite inspiré de Pokémon.<br>
            Construis une équipe, active des synergies, parcours Kanto.
          </p>
        </div>
      `)}

      <div class="tut-grid-3">
        ${[
          ['🗺','Explore','9 maps vers la Ligue Pokémon'],
          ['🔗','Synergie','Combine des types pour des bonus'],
          ['🎲','Roguelite','Niveaux persistants entre les runs'],
        ].map(([icon, title, desc]) => this._card(`
          <div style="text-align:center">
            <div style="font-size:24px">${icon}</div>
            <div style="color:#ffd700;font-weight:700;font-size:11px;margin:4px 0 2px">${title}</div>
            <div style="color:#718096;font-size:10px">${desc}</div>
          </div>
        `)).join('')}
      </div>

      ${this._card(`
        ${this._title('🎯 Boucle de jeu')}
        ${['Choisis ton Pokémon de départ',
          'Explore la map et combats des dresseurs',
          'Achète et équipe des objets en boutique',
          'Vaincs les 8 champions pour débloquer des emplacements',
          'Bats la Ligue Pokémon pour compléter ta run',
        ].map((txt, i) => `
          <div class="tut-step">
            <span class="tut-step-num">${i+1}</span>
            <span style="font-size:12px;color:#e2e8f0">${txt}</span>
          </div>
        `).join('')}
      `)}
    `;
  },

  // ── Section Map ───────────────────────────────────────────────────────────
  _sectionMap() {
    const nodes = [
      { type:'start',  x:60,  y:120, label:'Départ', visited:true },
      { type:'combat', x:155, y:75,  label:'Combat',  available:true },
      { type:'shop',   x:155, y:120, label:'Boutique',available:true },
      { type:'item',   x:155, y:165, label:'Objet',   available:true },
      { type:'combat', x:255, y:90,  label:'Combat' },
      { type:'wild',   x:255, y:155, label:'Sauvage' },
      { type:'combat', x:355, y:120, label:'Combat' },
      { type:'boss',   x:430, y:120, label:'Arène' },
    ];
    const edges = [
      [60,120,155,75],[60,120,155,120],[60,120,155,165],
      [155,75,255,90],[155,120,255,90],[155,120,255,155],[155,165,255,155],
      [255,90,355,120],[255,155,355,120],
      [355,120,430,120],
    ];
    const NODE_ICONS = { start:'🏠',combat:'⚔️',shop:'🛍',item:'🎁',wild:'🌿',boss:'👑' };
    const NODE_COLORS = { start:'#718096',combat:'#fc5c65',shop:'#ffd700',
      item:'#55efc4',wild:'#4fc3f7',boss:'#a29bfe' };

    const nodeHtml = nodes.map(n => {
      const c = NODE_COLORS[n.type] ?? '#444';
      return `
        <div class="tut-node ${n.available?'available':''} ${n.visited?'visited':''}"
             style="left:${n.x}px;top:${n.y}px;--nc:${c}">
          <span class="tut-node-icon">${NODE_ICONS[n.type]}</span>
          <span class="tut-node-label">${n.label}</span>
        </div>`;
    }).join('');

    const edgesSvg = `<svg class="tut-edges" viewBox="0 0 490 230">
      ${edges.map(([x1,y1,x2,y2]) =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>`
      ).join('')}
    </svg>`;

    return `
      ${this._card(`
        ${this._title('🗺 Layout d\'une Map')}
        <p style="color:#718096;font-size:11px;margin:0 0 10px">
          Générée par une seed déterministe. Choisis ton chemin de gauche à droite.
          Les noeuds colorés sont disponibles, les gris sont verrouillés.
        </p>
        <div class="tut-map-container">
          ${edgesSvg}
          ${nodeHtml}
        </div>
        <div class="tut-legend">
          ${Object.entries(NODE_ICONS).filter(([k]) => k !== 'start').map(([type, icon]) => `
            <div class="tut-legend-item">
              <span class="tut-legend-icon" style="border-color:${NODE_COLORS[type]};background:${NODE_COLORS[type]}22">${icon}</span>
              <span style="font-size:10px;color:#718096">${
                {combat:'Combat',shop:'Boutique',item:'Objet',wild:'Sauvage',boss:'Arène'}[type]
              }</span>
            </div>
          `).join('')}
        </div>
        ${this._tip('La seed est sauvegardée — en quittant et revenant, tu retrouves le même layout.')}
      `)}

      ${this._card(`
        ${this._title('📍 Les 9 Maps')}
        <div class="tut-progress-maps">
          ${['Argenta','Azuria','Carmin','Céladopole','Parmanie',
            'Safrania','Cramois\'île','Jadielle','Ligue'].map((city, i) => `
            <div class="tut-map-step">
              <div class="tut-map-bubble ${i===8?'league':''}">
                ${i===8?'🏆':i+1}
              </div>
              <div class="tut-map-city">${city}</div>
            </div>
          `).join('')}
        </div>
      `)}
    `;
  },

  // ── Section Préparation ───────────────────────────────────────────────────
  _sectionPrep() {
    const slots = [
      { name:'Bulbizarre', c1:'#2ecc71', c2:'#8e44ad', level:7, item:'🌿' },
      { name:'Carabaffe',  c1:'#3498db', c2:'#3498db', level:5 },
      { name:'Reptincel',  c1:'#e74c3c', c2:'#e74c3c', level:3 },
      null,
      { name:'Raichu',     c1:'#f1c40f', c2:'#f1c40f', level:12, item:'🔭' },
      null,
    ];

    return `
      ${this._card(`
        ${this._title('⚔️ Phase de préparation')}
        <div class="tut-field">
          <div class="tut-field-label">TERRAIN (3/6 emplacements)</div>
          <div class="tut-slots-grid">
            ${slots.map((s, i) => s ? `
              <div class="tut-slot occupied" style="border-color:${s.c1}">
                <div class="tut-slot-tl" style="border-color:${s.c1} transparent transparent transparent"></div>
                <div class="tut-slot-tr" style="border-color:transparent transparent transparent ${s.c2}"></div>
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${[1,8,5,0,26,0][i]}.png"
                     style="width:36px;height:36px;image-rendering:pixelated">
                <span class="tut-slot-name">${s.name}</span>
                ${s.level > 1 ? `<span class="tut-slot-level">Nv.${s.level}</span>` : ''}
                ${s.item ? `<span class="tut-slot-item">${s.item}</span>` : ''}
              </div>
            ` : `
              <div class="tut-slot empty">＋</div>
            `).join('')}
          </div>
        </div>
        ${this._tip('Glisse-dépose les Pokémon depuis la banque vers le terrain. Placement libre !')}
      `)}

      ${this._card(`
        ${this._title('🔓 Slots débloqués')}
        <div class="tut-unlock-grid">
          ${[[3,'Départ','#718096'],[4,'2e badge','#4fc3f7'],[5,'4e badge','#55efc4'],[6,'6e badge','#ffd700']].map(
            ([n, label, c]) => `
            <div class="tut-unlock-item">
              <div class="tut-unlock-dots">
                ${Array.from({length:n}).map(() => `<div class="tut-dot-sq" style="background:${c}44;border-color:${c}"></div>`).join('')}
              </div>
              ${this._badge(c, `${n} slots`)}
              <div style="font-size:9px;color:#718096;margin-top:2px">${label}</div>
            </div>
          `).join('')}
        </div>
      `)}
    `;
  },

  // ── Section Combat ────────────────────────────────────────────────────────
  _sectionCombat() {
    this._combatState = {
      ectoAtb: 42, nidoAtb: 33,
      ectoMana: 20, nidoMana: 0,
      ectoHp: 60, ectoMaxHp: 60,
      nidoHp: 61, nidoMaxHp: 61,
      log: ['— Le combat commence ! —'],
      phase: 'idle',
    };
    return `
      ${this._card(`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:18px">👻</span>
          <div>
            <div style="color:#a29bfe;font-size:12px;font-weight:700">Ectoplasma vs Nidorino</div>
            <div style="color:#718096;font-size:10px">Clin d'œil à l'intro de Pokémon Rouge & Bleu</div>
          </div>
        </div>
        <div id="tut-combat-demo" class="tut-combat-arena">
          ${this._combatDemoHtml()}
        </div>
      `)}

      ${this._card(`
        ${this._title('⚡ Système ATB')}
        <p style="color:#718096;font-size:11px;margin:0 0 8px">
          Vitesse effective = <b style="color:#ffd700">100 + SPD</b>. La barre dorée = prochain à jouer.
        </p>
        <div class="tut-grid-2">
          ${[['Ectoplasma','SPD 110','vitesse 210','#6c3483'],
            ['Nidorino','SPD 65','vitesse 165','#8e44ad']].map(
            ([name, spd, v, c]) => this._card(`
              <div style="color:${c};font-weight:800;font-size:12px">${name}</div>
              <div style="color:#718096;font-size:10px">${spd}</div>
              <div style="color:#e2e8f0;font-size:11px;font-weight:700">${v}</div>
            `)
          ).join('')}
        </div>
        ${this._tip('Ectoplasma agit ~1.27× plus souvent que Nidorino sur la durée du combat.')}
      `)}

      ${this._card(`
        ${this._title('💀 Érosion des PV max')}
        <p style="color:#718096;font-size:11px;margin:0">
          Chaque coup reçu réduit le <span style="color:#fc5c65">maximum de PV</span>
          de 10% des dégâts (min. 1). Visible dans la démo — les PV max de Nidorino diminuent.
        </p>
      `)}
    `;
  },

  _combatDemoHtml() {
    const s = this._combatState;
    if (!s) return '';
    const ectoIsNext = s.ectoAtb >= s.nidoAtb;
    const pctBar = (v, max) => Math.max(0, Math.min(100, v / max * 100));

    const pokemonCard = (name, sprite, hp, maxHp, atb, mana, typeColor, isPlayer, isNext) => `
      <div class="tut-fighter" style="border-color:${typeColor}">
        <div class="tut-fighter-label ${isPlayer ? 'player' : 'enemy'}">${isPlayer ? 'JOUEUR' : 'ENNEMI'}</div>
        <div class="tut-fighter-card" style="border-color:${typeColor}">
          <div class="tut-fighter-mana" style="height:${mana}%;background:linear-gradient(to top,${typeColor}cc,${typeColor}44)"></div>
          <img src="${sprite}" class="tut-fighter-sprite" alt="${name}">
        </div>
        <div class="tut-fighter-name">${name}</div>
        <div class="tut-stat-row">
          <span style="font-size:8px;color:#fc5c65">❤️</span>
          <div class="tut-bar-track"><div class="tut-bar-fill" style="width:${pctBar(hp,maxHp)}%;background:${isPlayer?'#55efc4':'#fc5c65'}"></div></div>
          <span style="font-size:8px;color:#718096;min-width:32px">${hp}/${maxHp}</span>
        </div>
        <div class="tut-stat-row">
          <span style="font-size:8px;color:${isNext?'#ffd700':'#a29bfe'}">⚡</span>
          <div class="tut-bar-track"><div class="tut-bar-fill" style="width:${atb}%;background:${isNext?'linear-gradient(90deg,#f39c12,#ffd700)':'linear-gradient(90deg,#6c5ce7,#a29bfe)'}"></div></div>
        </div>
      </div>
    `;

    return `
      <div class="tut-fighters">
        ${pokemonCard('Nidorino', NIDORINO_SPRITE, s.nidoHp, s.nidoMaxHp, s.nidoAtb, s.nidoMana, '#8e44ad', false, !ectoIsNext)}
        <div style="font-size:14px;color:#718096;font-weight:900;padding-bottom:20px">VS</div>
        ${pokemonCard('Ectoplasma', GENGAR_SPRITE, s.ectoHp, s.ectoMaxHp, s.ectoAtb, s.ectoMana, '#6c3483', true, ectoIsNext)}
      </div>
      <div class="tut-combat-log">
        ${s.log.slice(0,3).map((l, i) => `<div style="opacity:${1-i*0.3};font-size:10px;color:${i===0?'#e2e8f0':'#718096'}">${l}</div>`).join('')}
      </div>
    `;
  },

  _startCombatDemo() {
    clearInterval(this._combatInterval);
    this._combatInterval = setInterval(() => {
      const s = this._combatState;
      if (!s) return;

      if (s.phase === 'idle') {
        s.ectoAtb = Math.min(100, s.ectoAtb + 210 / 20);
        s.nidoAtb = Math.min(100, s.nidoAtb + 165 / 20);
        if (s.ectoAtb >= 100) {
          s.phase = s.ectoMana >= 100 ? 'ecto_ult' : 'ecto_act';
          s.ectoAtb = 0;
        } else if (s.nidoAtb >= 100) {
          s.phase = 'nido_act';
          s.nidoAtb = 0;
        }
      } else if (s.phase === 'ecto_ult') {
        const dmg = Math.round(18 + Math.random() * 8);
        s.nidoHp = Math.max(0, s.nidoHp - dmg);
        s.nidoMaxHp = Math.max(1, s.nidoMaxHp - Math.max(1, Math.floor(dmg * 0.1)));
        s.ectoMana = 0;
        s.log = [`⚡ Ectoplasma : Ténèbres ! -${dmg} PV`, ...s.log.slice(0,3)];
        s.phase = 'idle';
      } else if (s.phase === 'ecto_act') {
        const dmg = Math.round(10 + Math.random() * 5);
        s.nidoHp = Math.max(0, s.nidoHp - dmg);
        s.nidoMaxHp = Math.max(1, s.nidoMaxHp - Math.max(1, Math.floor(dmg * 0.1)));
        s.ectoMana = Math.min(100, s.ectoMana + 20);
        s.nidoMana = Math.min(100, s.nidoMana + Math.round(dmg / s.nidoMaxHp * 100));
        s.log = [`👻 Ectoplasma attaque ! -${dmg} PV`, ...s.log.slice(0,3)];
        s.phase = 'idle';
      } else if (s.phase === 'nido_act') {
        const dmg = Math.round(7 + Math.random() * 4);
        s.ectoHp = Math.max(0, s.ectoHp - dmg);
        s.ectoMaxHp = Math.max(1, s.ectoMaxHp - Math.max(1, Math.floor(dmg * 0.1)));
        s.nidoMana = Math.min(100, s.nidoMana + 20);
        s.ectoMana = Math.min(100, s.ectoMana + Math.round(dmg / s.ectoMaxHp * 100));
        s.log = [`🤜 Nidorino attaque ! -${dmg} PV`, ...s.log.slice(0,3)];
        s.phase = 'idle';
      }

      if (s.ectoHp <= 0 || s.nidoHp <= 0) {
        s.log = [`💀 ${s.ectoHp <= 0 ? 'Ectoplasma' : 'Nidorino'} est K.O. !`, ...s.log.slice(0,2)];
        setTimeout(() => {
          if (this._combatState) {
            Object.assign(this._combatState, {
              ectoAtb:42, nidoAtb:33, ectoMana:20, nidoMana:0,
              ectoHp:60, ectoMaxHp:60, nidoHp:61, nidoMaxHp:61,
              log:['— Nouveau combat —'], phase:'idle',
            });
          }
        }, 1800);
      }

      // Mise à jour du DOM
      const demo = document.getElementById('tut-combat-demo');
      if (demo) demo.innerHTML = this._combatDemoHtml();
    }, 120);
  },

  // ── Section Synergies ─────────────────────────────────────────────────────
  _sectionSynergies() {
    const syns = [
      { t:'Feu',    icon:'🔥', c:'#e74c3c',
        t1:'2 Pokémon : +20% ATK, Brûlure 3 tours sur les ennemis',
        t2:'4 Pokémon : +35% ATK + SP.ATK, Brûlure renforcée' },
      { t:'Eau',    icon:'💧', c:'#3498db',
        t1:'2 Pokémon : +20% DEF + SP.DEF',
        t2:'4 Pokémon : +30% DEF/SP.DEF + Régén. 4%/8 actions sur tous les alliés' },
      { t:'Plante', icon:'🌿', c:'#2ecc71',
        t1:'2 Pokémon : +20% HP',
        t2:'4 Pokémon : +35% HP + Poison 3 tours sur les ennemis' },
      { t:'Dragon', icon:'🐉', c:'#1a5276',
        t1:'2 Pokémon : +20% ATK + SP.ATK + VIT',
        t2:'4 Pokémon : +35% tout + Rage (+10% dégâts par allié Dragon KO)' },
    ];
    return `
      ${this._card(`
        ${this._title('🔗 Principe')}
        <p style="color:#718096;font-size:11px;margin:0 0 8px">
          Aligner des Pokémon du même type active des bonus pour <b style="color:#e2e8f0">toute la composition</b>.
        </p>
        <div class="tut-grid-2" style="margin-bottom:8px">
          ${[['★★ 2 Pokémon','Seuil 1','#4fc3f7'],['★★★ 4 Pokémon','Seuil 2','#ffd700']].map(
            ([label, sub, c]) => this._card(`
              <div style="color:${c};font-size:16px;font-weight:900">${label.split(' ')[0]}</div>
              <div style="color:#e2e8f0;font-size:11px;font-weight:600">${label.split(' ').slice(1).join(' ')}</div>
              <div style="color:#718096;font-size:10px">${sub}</div>
            `)
          ).join('')}
        </div>
        ${this._tip('Les légendaires (T5) comptent pour 2 dans les synergies !')}
      `)}
      ${syns.map(({ t, icon, c, t1, t2 }) => this._card(`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:18px">${icon}</span>
          ${this._badge(c, t)}
        </div>
        <div style="font-size:11px;margin-bottom:3px">
          <span style="color:#4fc3f7;font-weight:700">★★ </span>
          <span style="color:#e2e8f0">${t1}</span>
        </div>
        <div style="font-size:11px">
          <span style="color:#ffd700;font-weight:700">★★★ </span>
          <span style="color:#e2e8f0">${t2}</span>
        </div>
      `, `tut-syn-card`)).join('')}
    `;
  },

  // ── Section Items ─────────────────────────────────────────────────────────
  _sectionItems() {
    const items = [
      { e:'🥊', n:'Ceinture Choix', d:'+30% ATK, +15% VIT',  p:5, c:'#e17055' },
      { e:'🔭', n:'Lunettes Choix', d:'+30% SP.ATK, +15% VIT',p:5, c:'#a29bfe' },
      { e:'🛡️', n:'Bouclier Acier', d:'+30% DEF',             p:4, c:'#b8b8d0' },
      { e:'🔥', n:'Charbon',        d:'+30% ATK (Feu)',        p:4, c:'#e74c3c' },
      { e:'💧', n:'Eau Mystique',   d:'+30% SP.ATK (Eau)',     p:4, c:'#3498db' },
      { e:'🍃', n:'Encens Fleur',   d:'+30% ATK+SP.ATK (Plante)',p:4,c:'#2ecc71'},
      { e:'🍖', n:'Reste',          d:'Régén. 10% HP/8 actions',p:6,c:'#fdcb6e' },
      { e:'⚙️', n:'Métal Lourd',    d:'+30% DEF + SP.DEF',    p:5, c:'#7f8c8d' },
    ];
    return `
      ${this._card(`
        ${this._title('🎒 Objets')}
        <p style="color:#718096;font-size:11px;margin:0 0 10px">
          1 objet par Pokémon. Achetés en boutique ou trouvés sur des noeuds Objet.
        </p>
        <div class="tut-items-grid">
          ${items.map(({ e, n, d, p, c }) => `
            <div class="tut-item">
              <span class="tut-item-icon" style="background:${c}22;border-color:${c}">${e}</span>
              <div class="tut-item-info">
                <div style="font-size:10px;font-weight:700;color:#e2e8f0">${n}</div>
                <div style="font-size:9px;color:#718096">${d}</div>
              </div>
              <span style="color:#ffd700;font-size:10px;font-weight:700;flex-shrink:0">${p}💰</span>
            </div>
          `).join('')}
        </div>
        ${this._tip('Vendre un objet depuis la prép. rend la moitié du prix d\'achat.')}
      `)}
    `;
  },

  // ── Section Roguelite ─────────────────────────────────────────────────────
  _sectionRoguelite() {
    return `
      ${this._card(`
        ${this._title('⬆ Niveaux persistants')}
        <p style="color:#718096;font-size:11px;margin:0 0 8px">
          +1 niveau après chaque combat gagné (survivants). Persist entre les runs. Max : Nv.100.
        </p>
        ${[['Nv.1',1,'#a0aec0'],['Nv.25',25,'#55efc4'],
          ['Nv.50',50,'#74b9ff'],['Nv.75',75,'#a29bfe'],['Nv.100',100,'#ffd700']].map(
          ([label, lvl, c]) => `
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:5px">
            <span style="font-size:10px;font-weight:700;color:${c};min-width:48px">${label}</span>
            <div style="flex:1;height:5px;background:#1a1a2e;border-radius:3px;overflow:hidden">
              <div style="width:${lvl}%;height:100%;background:${c};border-radius:3px"></div>
            </div>
            <span style="font-size:9px;color:#718096;min-width:52px">+${Math.round((lvl-1)*0.5)}% stats</span>
          </div>
        `).join('')}
        ${this._tip('Un Reptincel Nv.100 (+49.5% stats) peut valoir un Dracaufeu !')}
      `)}

      ${this._card(`
        ${this._title('🎲 Difficultés')}
        ${[['🌿 Facile','×0.8','Ennemis affaiblis','#55efc4'],
          ['⚔️ Normal','×1.0','Expérience de base','#4fc3f7'],
          ['🔥 Difficile','×1.3','Après 1 run complète','#e17055'],
          ['💀 Expert','×1.7','Requiert 3 succès Ligue','#fc5c65']].map(
          ([d, m, desc, c]) => `
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
            ${this._badge(c, m)}
            <div>
              <div style="font-size:11px;font-weight:700;color:${c}">${d}</div>
              <div style="font-size:10px;color:#718096">${desc}</div>
            </div>
          </div>
        `).join('')}
      `)}

      ${this._card(`
        ${this._title('🏅 Succès notables')}
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${['🏆 Champion Feu','💧 Champion Eau','⬆ Maître Nv.100',
            '⚡ Ultime !','💀 Exterminateur','🔗 Synergiste',
            '♾️ Mode Infini'].map(a => this._badge('#ffd700', a)).join('')}
        </div>
        ${this._tip('Les succès "Champion par type" débloquent le mode Expert !')}
      `)}
    `;
  },
};