// ─────────────────────────────────────────────────────────────────────────────
// passiveHooks.js — Système de hooks pour les passifs de niveau
//
// Chaque passif déclare dans quel(s) hook(s) il s'exécute.
// Le moteur appelle _runHook() au bon moment — aucun switch géant.
//
// HOOKS :
//   ON_SETUP     — début de combat (effets permanents, intimidate, AOE status)
//   ON_ACTION    — quand le pokémon prend son tour (regen, fury, stacks)
//   ON_ATTACK    — après avoir infligé des dégâts (drain, proc, ramp)
//   ON_RECEIVE   — après avoir reçu des dégâts (counter, rage, drain_receive)
//   ON_PERIODIC  — toutes les 8 actions globales (regen zone, dot)
//   ON_DEATH     — à la mort (explosion, revive, aoe)
//
// TYPES D'ACTIONS (~30 au total) :
//   ON_SETUP    : stat_boost | intimidate | aoe_status | shield | revive_mark |
//                 evasion | type_immunity | status_immunity | first_hit_boost |
//                 aoe_damage_setup | copy_strongest
//   ON_ACTION   : heal_self | conditional_stat | stack_per_ally | emergency_heal |
//                 periodic_heal_allies | rage_check
//   ON_ATTACK   : drain | proc_status | debuff_target | ramp_stat | crit_boost
//   ON_RECEIVE  : drain_receive | counter | rage | proc_status_attacker
//   ON_PERIODIC : heal_all | dot_enemies
//   ON_DEATH    : aoe_damage | revive | target_damage | buff_allies
// ─────────────────────────────────────────────────────────────────────────────

export const POKEMON_PASSIVES = {

  // ── Starters Plante ──────────────────────────────────────────────────────
  1: {
    35: { id:'seve', name:'Sève', desc:'Soigne 5% HP à chaque action',
      hooks:{ ON_ACTION: [{ type:'heal_self', rate:0.05 }] } },
    70: { id:'chlorophylle', name:'Chlorophylle', desc:'+20% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.20 }] } },
  },
  2: {
    35: { id:'poudre_toxik', name:'Poudre Toxik', desc:'20% poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.20 }] } },
    70: { id:'symbiose', name:'Symbiose', desc:'Soigne 10% HP à l\'allié le plus blessé / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_weakest_ally', rate:0.10 }] } },
  },
  3: {
    35: { id:'enracinement', name:'Enracinement', desc:'Absorbe 8% des dégâts reçus en soins',
      hooks:{ ON_RECEIVE: [{ type:'drain_receive', rate:0.08 }] } },
    70: { id:'mega_drain_p', name:'Méga-Sangsue', desc:'Drain 15% des dégâts infligés',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.15 }] } },
  },

  // ── Starters Feu ─────────────────────────────────────────────────────────
  4: {
    35: { id:'brasier', name:'Brasier', desc:'Si PV<50% → +25% ATK et SP.ATK',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stats:['atk','spa'], mult:1.25, condition:'hp_below', threshold:0.50 }] } },
    70: { id:'torche', name:'Torche', desc:'Immunisé Brûlure + absorbe dégâts Feu',
      hooks:{ ON_SETUP: [{ type:'type_immunity', damageType:'Feu' },
                         { type:'status_immunity', statuses:['burn'] }] } },
  },
  5: {
    35: { id:'brasier_plus', name:'Brasier+', desc:'Si PV<50% → +35% ATK et SP.ATK',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stats:['atk','spa'], mult:1.35, condition:'hp_below', threshold:0.50 }] } },
    70: { id:'combustion', name:'Combustion', desc:'Chaque attaque brûle la cible',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'burn', chance:1.0, turns:1 }] } },
  },
  6: {
    35: { id:'feu_sacre', name:'Feu Sacré', desc:'30% brûlure en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'burn', chance:0.30, turns:3 }] } },
    70: { id:'pression_feu', name:'Pression', desc:'-20% ATK et SP.DEF ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk','spd_def'], mult:0.80 }] } },
  },

  // ── Starters Eau ─────────────────────────────────────────────────────────
  7: {
    35: { id:'carapace', name:'Carapace', desc:'-20% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
    70: { id:'turbo_cara', name:'Turbo-Carapace', desc:'Premier coup absorbé',
      hooks:{ ON_SETUP: [{ type:'shield' }] } },
  },
  8: {
    35: { id:'carapace_plus', name:'Carapace+', desc:'-25% dégâts + riposte 30%',
      hooks:{ ON_SETUP:   [{ type:'stat_boost', stat:'_dmgReduction', mult:0.75 }],
              ON_RECEIVE: [{ type:'counter', rate:0.30 }] } },
    70: { id:'mur_eau', name:'Mur d\'Eau', desc:'-15% dégâts reçus par alliés adjacents',
      hooks:{ ON_SETUP: [{ type:'aura_dmg_reduction', mult:0.85 }] } },
  },
  9: {
    35: { id:'canon_eau', name:'Canon Eau', desc:'+20% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
    70: { id:'forteresse', name:'Forteresse', desc:'Immunisé recul + absorbe 1er coup',
      hooks:{ ON_SETUP: [{ type:'shield' }, { type:'status_immunity', statuses:['push_back'] }] } },
  },

  // ── Chenilles ─────────────────────────────────────────────────────────────
  10: {
    35: { id:'ficelle', name:'Ficelle', desc:'-10% VIT cible en attaque',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'spd', mult:0.90 }] } },
    70: { id:'cocon', name:'Cocon', desc:'-30% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.70 }] } },
  },
  11: {
    35: { id:'armure_chry', name:'Armure', desc:'Absorbe 1 coup',
      hooks:{ ON_SETUP: [{ type:'shield' }] } },
    70: { id:'transf_chry', name:'Chrysalide', desc:'-50% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.50 }] } },
  },
  12: {
    35: { id:'ecailles', name:'Écailles', desc:'20% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', chance:0.20 }] } },
    70: { id:'danse_papillon', name:'Danse Papillon', desc:'+20% SP.ATK et SP.DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stats:['spa','spd_def'], mult:1.20 }] } },
  },
  13: {
    35: { id:'dard_asp', name:'Dard Venin', desc:'30% poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.30 }] } },
    70: { id:'essaim_asp', name:'Essaim', desc:'+8% ATK par allié Insecte',
      hooks:{ ON_ACTION: [{ type:'stack_per_ally', stat:'atk', rate:0.08, allyType:'Insecte' }] } },
  },
  14: {
    35: { id:'carapace_coco', name:'Carapace', desc:'Absorbe 1 coup',
      hooks:{ ON_SETUP: [{ type:'shield' }] } },
    70: { id:'mue', name:'Mue', desc:'Soigne 30% HP toutes les 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_self_periodic', rate:0.30 }] } },
  },
  15: {
    35: { id:'vol_venimeux', name:'Vol Venimeux', desc:'25% poison en attaque (rangée avant)',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.25 }] } },
    70: { id:'noeud_poison', name:'Nœud Poison', desc:'Chaque attaque empoisonne',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:1.0, stacks:1 }] } },
  },

  // ── Roucool ligne ─────────────────────────────────────────────────────────
  16: {
    35: { id:'esquive_r', name:'Esquive', desc:'20% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', chance:0.20 }] } },
    70: { id:'vent_r', name:'Vent', desc:'-10% VIT ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['spd'], mult:0.90 }] } },
  },
  17: {
    35: { id:'tornade_r', name:'Tornade', desc:'+15% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.15 }] } },
    70: { id:'rafale', name:'Rafale', desc:'+20% VIT si aucun allié K.O.',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'spd', mult:1.20, condition:'no_ally_ko' }] } },
  },
  18: {
    35: { id:'acrobatie', name:'Acrobatie', desc:'+30% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.30 }] } },
    70: { id:'oeil_faucon', name:'Œil de Faucon', desc:'Ignore l\'esquive ennemie',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreEvasion' }] } },
  },

  // ── Rattata ligne ─────────────────────────────────────────────────────────
  19: {
    35: { id:'mordant', name:'Mordant', desc:'20% stun 1 action',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'stun', chance:0.20, turns:1 }] } },
    70: { id:'agilite_r', name:'Agilité', desc:'+20% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.20 }] } },
  },
  20: {
    35: { id:'hyperdent', name:'Hyperdent', desc:'3 frappes (40% puissance)',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'multiHit', hits:3, mult:0.40 }] } },
    70: { id:'furie_r', name:'Furie', desc:'+30% ATK si PV<30%',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'atk', mult:1.30, condition:'hp_below', threshold:0.30 }] } },
  },

  // ── Piafabec ligne ────────────────────────────────────────────────────────
  21: {
    35: { id:'bec', name:'Bec', desc:'2 frappes par attaque',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'multiHit', hits:2, mult:0.60 }] } },
    70: { id:'becquetage', name:'Becquetage', desc:'-5% ATK ennemi/frappe',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'atk', mult:0.95 }] } },
  },
  22: {
    35: { id:'serres', name:'Serres', desc:'20% stun 1 action',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'stun', chance:0.20, turns:1 }] } },
    70: { id:'predateur', name:'Prédateur', desc:'+20% dégâts sur cibles avec statut',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'bonusVsStatus', mult:1.20 }] } },
  },

  // ── Abo/Arbok ─────────────────────────────────────────────────────────────
  23: {
    35: { id:'acide_abo', name:'Acide', desc:'30% poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.30 }] } },
    70: { id:'venin_mortel', name:'Venin Mortel', desc:'Poison ×2 sur cibles déjà empoisonnées',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'doublePoison' }] } },
  },
  24: {
    35: { id:'effroi', name:'Effroi', desc:'-20% ATK ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk'], mult:0.80 }] } },
    70: { id:'etranglement', name:'Étranglement', desc:'Cibles empoisonnées -20% VIT',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'poisonSlow', mult:0.80 }] } },
  },

  // ── Pikachu/Raichu ────────────────────────────────────────────────────────
  25: {
    35: { id:'statik', name:'Statik', desc:'30% paralysie en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'paralyze', chance:0.30 }] } },
    70: { id:'surfeur', name:'Surfeur', desc:'+15% VIT si allié Eau présent',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'spd', mult:1.15, condition:'ally_type', allyType:'Eau' }] } },
  },
  26: {
    35: { id:'coup_foudre', name:'Coup de Foudre', desc:'Toutes les 5 actions : paralysie AoE',
      hooks:{ ON_ATTACK: [{ type:'periodic_aoe_status', status:'paralyze', period:5 }] } },
    70: { id:'surchauffe_r', name:'Surchauffe', desc:'+40% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.40 }] } },
  },

  // ── Sabelette/Sablaireau ──────────────────────────────────────────────────
  27: {
    35: { id:'sable', name:'Sable', desc:'-10% précision ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['spd'], mult:0.92 }] } },
    70: { id:'tempete_s', name:'Tempête', desc:'-15% VIT ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['spd'], mult:0.85 }] } },
  },
  28: {
    35: { id:'griffe_s', name:'Griffe', desc:'2 frappes par attaque',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'multiHit', hits:2, mult:0.60 }] } },
    70: { id:'tranchant_s', name:'Tranchant', desc:'+30% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.30 }] } },
  },

  // ── Nidoran lignes ────────────────────────────────────────────────────────
  29: {
    35: { id:'dard_nido_f', name:'Dard Venin', desc:'25% poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.25 }] } },
    70: { id:'morsure_tox', name:'Morsure Toxique', desc:'2 stacks poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:1.0, stacks:2 }] } },
  },
  30: {
    35: { id:'venin_corr', name:'Venin Corrosif', desc:'Poison inflige +50% dégâts',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'poisonDmgBoost', mult:1.50 }] } },
    70: { id:'mur_acide', name:'Mur Acide', desc:'-15% DEF ennemis/action',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'def', mult:0.93 }] } },
  },
  31: {
    35: { id:'reine', name:'Reine', desc:'+10% stats alliés Poison',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', allyType:'Poison', mult:1.10 }] } },
    70: { id:'domination_n', name:'Domination', desc:'K.O. ennemi → -15% ATK AoE',
      hooks:{ ON_DEATH: [{ type:'debuff_enemies_on_ko', stat:'atk', mult:0.85 }] } },
  },
  32: {
    35: { id:'corne_tox', name:'Corne Toxique', desc:'30% poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.30 }] } },
    70: { id:'antidote', name:'Antidote', desc:'Immunisé tous statuts',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['burn','poison','paralyze','freeze','sleep','confuse','stun'] }] } },
  },
  33: {
    35: { id:'corne_venin', name:'Corne Venin', desc:'2 stacks poison direct',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:1.0, stacks:2 }] } },
    70: { id:'percee', name:'Percée', desc:'Ignore 25% DEF cible',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.25 }] } },
  },
  34: {
    35: { id:'roi_nido', name:'Roi', desc:'+15% ATK et SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stats:['atk','spa'], mult:1.15 }] } },
    70: { id:'fureur_roy', name:'Fureur Royale', desc:'+10% ATK par ennemi empoisonné',
      hooks:{ ON_ACTION: [{ type:'stack_per_enemy_status', stat:'atk', status:'poison', rate:0.10 }] } },
  },

  // ── Fées ─────────────────────────────────────────────────────────────────
  35: {
    35: { id:'charme_mel', name:'Charme', desc:'-20% ATK ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk'], mult:0.80 }] } },
    70: { id:'enchantement', name:'Enchantement', desc:'Immunisé dégâts Dragon',
      hooks:{ ON_SETUP: [{ type:'type_immunity', damageType:'Dragon' }] } },
  },
  36: {
    35: { id:'charme_plus', name:'Charme+', desc:'-25% ATK + 20% confusion',
      hooks:{ ON_SETUP:  [{ type:'intimidate', stats:['atk'], mult:0.75 }],
              ON_ATTACK: [{ type:'proc_status', status:'confuse', chance:0.20, turns:2 }] } },
    70: { id:'fee_doree', name:'Fée Dorée', desc:'+20% stats alliés Fée',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', allyType:'Fée', mult:1.20 }] } },
  },

  // ── Goupix/Feunard ────────────────────────────────────────────────────────
  37: {
    35: { id:'malefice', name:'Maléfice', desc:'Cibles avec statut prennent ×1.5 dégâts',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'bonusVsStatus', mult:1.50 }] } },
    70: { id:'feu_follet', name:'Feu Follet', desc:'30% brûlure en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'burn', chance:0.30, turns:3 }] } },
  },
  38: {
    35: { id:'tromperie', name:'Tromperie', desc:'+20% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
    70: { id:'illusion_ard', name:'Illusion Ardente', desc:'40% confusion en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'confuse', chance:0.40, turns:3 }] } },
  },

  // ── Rondoudou/Grodoudou ───────────────────────────────────────────────────
  39: {
    35: { id:'berceuse', name:'Berceuse', desc:'30% sommeil en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'sleep', chance:0.30, turns:2 }] } },
    70: { id:'voix_mag', name:'Voix Magique', desc:'Endort rangée avant au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'sleep', turns:2, row:'front', chance:0.70 }] } },
  },
  40: {
    35: { id:'berceuse_plus', name:'Berceuse+', desc:'40% sommeil + drain 10%',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'sleep', chance:0.40, turns:2 },
                          { type:'drain', rate:0.10 }] } },
    70: { id:'chant_fatal', name:'Chant Fatal', desc:'Sommeil AoE au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'sleep', turns:3, row:'all', chance:0.50 }] } },
  },

  // ── Nosferapti/Nosferalto ─────────────────────────────────────────────────
  41: {
    35: { id:'vampirisme_n', name:'Vampirisme', desc:'Drain 15% des dégâts',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.15 }] } },
    70: { id:'ultrason', name:'Ultrason', desc:'25% confusion en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'confuse', chance:0.25, turns:2 }] } },
  },
  42: {
    35: { id:'mega_drain_n', name:'Méga-Drain', desc:'Drain 25% des dégâts',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.25 }] } },
    70: { id:'cri_effroi', name:'Cri d\'Effroi', desc:'Confusion AoE rangée avant',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'confuse', turns:2, row:'front', chance:0.60 }] } },
  },

  // ── Mystherbe ligne ───────────────────────────────────────────────────────
  43: {
    35: { id:'spore_myst', name:'Spore', desc:'15% confusion en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'confuse', chance:0.15, turns:2 }] } },
    70: { id:'para_spore', name:'Para-Spore', desc:'15% paralysie en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'paralyze', chance:0.15 }] } },
  },
  44: {
    35: { id:'poudre_dodo', name:'Poudre Dodo', desc:'20% sommeil en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'sleep', chance:0.20, turns:2 }] } },
    70: { id:'pollen', name:'Pollen', desc:'-15% VIT ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['spd'], mult:0.85 }] } },
  },
  45: {
    35: { id:'fetide', name:'Fétide', desc:'-15% ATK ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk'], mult:0.85 }] } },
    70: { id:'arome', name:'Arôme', desc:'Alliés Plante immunisés statuts',
      hooks:{ ON_SETUP: [{ type:'aura_type_immunity', allyType:'Plante', statuses:['poison','burn','paralyze'] }] } },
  },

  // ── Paras/Parasect ────────────────────────────────────────────────────────
  46: {
    35: { id:'spore_par', name:'Spore', desc:'30% sommeil en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'sleep', chance:0.30, turns:2 }] } },
    70: { id:'parasite', name:'Parasite', desc:'Drain 10% HP ennemi/action',
      hooks:{ ON_PERIODIC: [{ type:'dot_enemies', rate:0.10 }] } },
  },
  47: {
    35: { id:'mycelium', name:'Mycélium', desc:'Sommeil AoE au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'sleep', turns:2, row:'all', chance:0.35 }] } },
    70: { id:'zombie', name:'Zombie', desc:'Ressuscite 1 fois avec 20% HP',
      hooks:{ ON_SETUP: [{ type:'revive_mark', rate:0.20 }] } },
  },
  48: {
    35: { id:'poudre_conf', name:'Poudre', desc:'20% confusion AoE au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'confuse', turns:2, row:'all', chance:0.20 }] } },
    70: { id:'danse_mim', name:'Danse', desc:'+5% ATK cumulatif par frappe',
      hooks:{ ON_ATTACK: [{ type:'ramp_stat', stat:'atk', rate:0.05, max:0.30 }] } },
  },
  49: {
    35: { id:'vole_ecaille', name:'Vole-Écaille', desc:'-15% DEF ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['def'], mult:0.85 }] } },
    70: { id:'cyclone', name:'Cyclone', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
  },

  // ── Taupiqueur/Triopikeur ─────────────────────────────────────────────────
  50: {
    35: { id:'tunnel', name:'Tunnel', desc:'Intouchable 1 action / 5',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'periodicUntargetable', period:5 }] } },
    70: { id:'seisme_t', name:'Séisme', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
  },
  51: {
    35: { id:'tunnel_3', name:'Tunnel×3', desc:'3 frappes (30% puissance)',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'multiHit', hits:3, mult:0.30 }] } },
    70: { id:'tremblement_t', name:'Tremblement', desc:'-15% VIT tous ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['spd'], mult:0.85 }] } },
  },

  // ── Miaouss/Persian ───────────────────────────────────────────────────────
  52: {
    35: { id:'jackpot', name:'Jackpot', desc:'+1 pièce par K.O.',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'coinsOnKo', amount:1 }] } },
    70: { id:'malin', name:'Malin', desc:'+20% à la stat la plus élevée',
      hooks:{ ON_SETUP: [{ type:'boost_highest_stat', mult:1.20 }] } },
  },
  53: {
    35: { id:'griffe_per', name:'Griffe', desc:'2 frappes + -10% DEF',
      hooks:{ ON_SETUP:  [{ type:'flag', flag:'multiHit', hits:2, mult:0.60 }],
              ON_ATTACK: [{ type:'debuff_target', stat:'def', mult:0.90 }] } },
    70: { id:'elegance', name:'Élégance', desc:'+30% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.30 }] } },
  },

  // ── Psykokwak/Akwakwak ────────────────────────────────────────────────────
  54: {
    35: { id:'migraine', name:'Migraine', desc:'25% confusion sur coup reçu',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'confuse', chance:0.25, turns:2 }] } },
    70: { id:'zen', name:'Zen', desc:'+20% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
  },
  55: {
    35: { id:'hydrochoc', name:'Hydrochoc', desc:'-15% SP.DEF cible/frappe',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'spd_def', mult:0.92 }] } },
    70: { id:'deluge', name:'Déluge', desc:'+25% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.25 }] } },
  },

  // ── Férosinge/Colossinge ──────────────────────────────────────────────────
  56: {
    35: { id:'rage_fer', name:'Rage', desc:'+5% ATK par coup reçu (max +40%)',
      hooks:{ ON_RECEIVE: [{ type:'rage', stat:'atk', rate:0.05, max:0.40 }] } },
    70: { id:'fureur_fer', name:'Fureur', desc:'+30% ATK si PV<50%',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'atk', mult:1.30, condition:'hp_below', threshold:0.50 }] } },
  },
  57: {
    35: { id:'mach_punch', name:'Mach Punch', desc:'30% stun en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'stun', chance:0.30, turns:1 }] } },
    70: { id:'uppercut', name:'Uppercut', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
  },

  // ── Caninos/Arcanin ───────────────────────────────────────────────────────
  58: {
    35: { id:'intimidation_c', name:'Intimidation', desc:'-15% ATK ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk'], mult:0.85 }] } },
    70: { id:'crocs_feu_p', name:'Crocs de Feu+', desc:'35% brûlure en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'burn', chance:0.35, turns:3 }] } },
  },
  59: {
    35: { id:'vitesse_ext', name:'Vitesse Extrême', desc:'+30% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.30 }] } },
    70: { id:'agilite_c', name:'Agilité', desc:'+30% VIT supplémentaire',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.30 }] } },
  },

  // ── Ptitard ligne ─────────────────────────────────────────────────────────
  60: {
    35: { id:'hypnose_pt', name:'Hypnose', desc:'20% sommeil en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'sleep', chance:0.20, turns:2 }] } },
    70: { id:'onde_son', name:'Onde Sonique', desc:'Paralyse rangée avant au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'paralyze', row:'front', chance:0.80 }] } },
  },
  61: {
    35: { id:'vague', name:'Vague', desc:'+5% SP.ATK par allié Eau',
      hooks:{ ON_ACTION: [{ type:'stack_per_ally', stat:'spa', rate:0.05, allyType:'Eau' }] } },
    70: { id:'mur_liquide', name:'Mur Liquide', desc:'-20% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
  },
  62: {
    35: { id:'poing_kara', name:'Poing Karaté', desc:'Ignore 25% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.25 }] } },
    70: { id:'barriere_t', name:'Barrière', desc:'-25% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.75 }] } },
  },

  // ── Abra ligne ────────────────────────────────────────────────────────────
  63: {
    35: { id:'teleport_a', name:'Téléport', desc:'Esquive 1 attaque/combat',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'dodgeOnce' }] } },
    70: { id:'prescience', name:'Prescience', desc:'+20% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
  },
  64: {
    35: { id:'synchronie', name:'Synchronie', desc:'Renvoie 50% des statuts subis',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'reflect', chance:0.50 }] } },
    70: { id:'clairvoyance', name:'Clairvoyance', desc:'+20% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
  },
  65: {
    35: { id:'magie_rebond', name:'Magie Rebond', desc:'+25% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.25 }] } },
    70: { id:'telepathie', name:'Télépathie', desc:'+30% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.30 }] } },
  },

  // ── Machoc ligne ──────────────────────────────────────────────────────────
  66: {
    35: { id:'sismopoing', name:'Sismopoing', desc:'Ignore 20% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.20 }] } },
    70: { id:'halt', name:'Haltères', desc:'+10% ATK par allié Combat',
      hooks:{ ON_ACTION: [{ type:'stack_per_ally', stat:'atk', rate:0.10, allyType:'Combat' }] } },
  },
  67: {
    35: { id:'force_m', name:'Force', desc:'+25% ATK si PV>75%',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'atk', mult:1.25, condition:'hp_above', threshold:0.75 }] } },
    70: { id:'crc', name:'Combat Rapproché', desc:'-15% DEF cible/frappe',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'def', mult:0.90 }] } },
  },
  68: {
    35: { id:'force_col', name:'Force Colossale', desc:'Ignore 35% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.35 }] } },
    70: { id:'dynamique', name:'Dynamique', desc:'+10% ATK cumulatif par frappe',
      hooks:{ ON_ATTACK: [{ type:'ramp_stat', stat:'atk', rate:0.10, max:0.50 }] } },
  },

  // ── Chétiflor ligne ───────────────────────────────────────────────────────
  69: {
    35: { id:'acide_chet', name:'Acide', desc:'25% brûlure en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'burn', chance:0.25, turns:3 }] } },
    70: { id:'englout', name:'Engloutissement', desc:'Drain 15% des dégâts',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.15 }] } },
  },
  70: {
    35: { id:'acide_bous', name:'Acide+', desc:'30% poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.30 }] } },
    70: { id:'digestion', name:'Digestion', desc:'Soigne 20% HP toutes les 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_self_periodic', rate:0.20 }] } },
  },
  71: {
    35: { id:'capture_emp', name:'Capture', desc:'25% stun en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'stun', chance:0.25, turns:1 }] } },
    70: { id:'vrille', name:'Vrille', desc:'+20% dégâts sur cibles stun',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'bonusVsStun', mult:1.20 }] } },
  },

  // ── Tentacool/Tentacruel ──────────────────────────────────────────────────
  72: {
    35: { id:'venin_tent', name:'Venin', desc:'25% poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.25 }] } },
    70: { id:'para_tent', name:'Paralysie Tentaculaire', desc:'25% paralysie en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'paralyze', chance:0.25 }] } },
  },
  73: {
    35: { id:'tentacules', name:'Tentacules', desc:'30% poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.30 }] } },
    70: { id:'liquidation', name:'Liquidation', desc:'-20% DEF cible/frappe',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'def', mult:0.87 }] } },
  },

  // ── Racaillou ligne ───────────────────────────────────────────────────────
  74: {
    35: { id:'robustesse', name:'Robustesse', desc:'Survit 1 coup fatal avec 1HP',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'sturdy' }] } },
    70: { id:'roc', name:'Roc', desc:'-20% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
  },
  75: {
    35: { id:'eboulement', name:'Éboulement', desc:'20% stun AoE en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'stun', chance:0.20, turns:1 }] } },
    70: { id:'armure_roche', name:'Armure Roche', desc:'-25% dégâts physiques',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'dmgReducPhysical', mult:0.75 }] } },
  },
  76: {
    35: { id:'explosion_g', name:'Explosion', desc:'À la mort : AoE 20% HP',
      hooks:{ ON_DEATH: [{ type:'aoe_damage', rate:0.20 }] } },
    70: { id:'geant', name:'Géant', desc:'Immunisé stun + -20% dégâts',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['stun'] },
                         { type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
  },

  // ── Ponyta/Galopa ─────────────────────────────────────────────────────────
  77: {
    35: { id:'flamme_sacree', name:'Flamme Sacrée', desc:'Immunisé paralysie',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['paralyze'] }] } },
    70: { id:'galop_feu', name:'Galop de Feu', desc:'+20% VIT à chaque K.O. allié',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'spdOnAllyKo', boost:0.20 }] } },
  },
  78: {
    35: { id:'course_folle', name:'Course Folle', desc:'+5% VIT cumulatif/action',
      hooks:{ ON_ACTION: [{ type:'ramp_stat', stat:'spd', rate:0.05, max:0.30 }] } },
    70: { id:'pietinement', name:'Piétinement', desc:'+25% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.25 }] } },
  },

  // ── Ramoloss/Flagadoss ────────────────────────────────────────────────────
  79: {
    35: { id:'amnesie', name:'Amnésie', desc:'+40% SP.DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd_def', mult:1.40 }] } },
    70: { id:'regression', name:'Régression', desc:'Soigne 5% HP à chaque action',
      hooks:{ ON_ACTION: [{ type:'heal_self', rate:0.05 }] } },
  },
  80: {
    35: { id:'mega_drain_f', name:'Méga-Drain', desc:'Drain 30% des dégâts',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.30 }] } },
    70: { id:'assimilation', name:'Assimilation', desc:'+20% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
  },

  // ── Magnéti/Magnéton ──────────────────────────────────────────────────────
  81: {
    35: { id:'magnetisme', name:'Magnétisme', desc:'-10% VIT ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['spd'], mult:0.90 }] } },
    70: { id:'champ_mag', name:'Champ Magnétique', desc:'Immunisé dégâts Vol',
      hooks:{ ON_SETUP: [{ type:'type_immunity', damageType:'Vol' }] } },
  },
  82: {
    35: { id:'tri_attaque', name:'Tri-Attaque', desc:'33% brûlure/gel/paralysie',
      hooks:{ ON_ATTACK: [{ type:'proc_status_random', statuses:['burn','freeze','paralyze'], chance:0.33 }] } },
    70: { id:'levitation', name:'Lévitation', desc:'Immunisé dégâts Sol',
      hooks:{ ON_SETUP: [{ type:'type_immunity', damageType:'Sol' }] } },
  },

  // ── Canarticho ───────────────────────────────────────────────────────────
  83: {
    35: { id:'poireau', name:'Poireau', desc:'+20% chance critique',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'critBoost', chance:0.20 }] } },
    70: { id:'sabre', name:'Sabre', desc:'+25% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.25 }] } },
  },

  // ── Doduo/Dodrio ─────────────────────────────────────────────────────────
  84: {
    35: { id:'bi_attaque', name:'Bi-Attaque', desc:'2 frappes par attaque',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'multiHit', hits:2, mult:0.60 }] } },
    70: { id:'tetes_doubles', name:'Têtes Doubles', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
  },
  85: {
    35: { id:'tri_attaque_d', name:'Tri-Attaque', desc:'3 frappes (50% puissance)',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'multiHit', hits:3, mult:0.50 }] } },
    70: { id:'mach_speed', name:'Mach Speed', desc:'+30% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.30 }] } },
  },

  // ── Otaria/Lamantine ─────────────────────────────────────────────────────
  86: {
    35: { id:'rugissement', name:'Rugissement', desc:'-10% ATK cible/frappe',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'atk', mult:0.93 }] } },
    70: { id:'chant_sed', name:'Chant Séducteur', desc:'30% confusion en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'confuse', chance:0.30, turns:2 }] } },
  },
  87: {
    35: { id:'blizzard_l', name:'Blizzard', desc:'20% gel en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'freeze', chance:0.20, turns:2 }] } },
    70: { id:'armure_glace', name:'Armure de Glace', desc:'+30% DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'def', mult:1.30 }] } },
  },

  // ── Tadmorv/Grotadmorv ────────────────────────────────────────────────────
  88: {
    35: { id:'miasmes', name:'Miasmes', desc:'Poison AoE toutes les 4 actions',
      hooks:{ ON_ATTACK: [{ type:'periodic_aoe_status', status:'poison', period:4 }] } },
    70: { id:'pestilence_t', name:'Pestilence', desc:'Poison AoE au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'poison', row:'all', chance:1.0 }] } },
  },
  89: {
    35: { id:'acide_sulf', name:'Acide Sulfurique', desc:'Poison inflige 6% HP',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'poisonDmgFlat', rate:0.06 }] } },
    70: { id:'dissolution', name:'Dissolution', desc:'-30% DEF cibles empoisonnées',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'debuffOnPoison', stat:'def', mult:0.70 }] } },
  },

  // ── Kokiyas/Crustabri ─────────────────────────────────────────────────────
  90: {
    35: { id:'armure_kok', name:'Armure', desc:'Absorbe 1 coup',
      hooks:{ ON_SETUP: [{ type:'shield' }] } },
    70: { id:'claquement', name:'Claquement', desc:'Riposte 50% dégâts reçus',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.50 }] } },
  },
  91: {
    35: { id:'gel_crus', name:'Gel', desc:'25% gel en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'freeze', chance:0.25, turns:2 }] } },
    70: { id:'carapace_gl', name:'Carapace de Glace', desc:'Immunisé brûlure + -20% dégâts',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['burn'] },
                         { type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
  },

  // ── Fantominus/Spectrum/Ectoplasma ────────────────────────────────────────
  92: {
    35: { id:'incorporel', name:'Incorporel', desc:'25% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', chance:0.25 }] } },
    70: { id:'malediction_f', name:'Malédiction', desc:'À la mort → 30% HP dégâts à 1 ennemi',
      hooks:{ ON_DEATH: [{ type:'target_damage', rate:0.30 }] } },
  },
  93: {
    35: { id:'ombre', name:'Ombre', desc:'30% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', chance:0.30 }] } },
    70: { id:'possession', name:'Possession', desc:'+20% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
  },
  94: {
    35: { id:'tenebres', name:'Ténèbres', desc:'Ignore 25% DEF/SP.DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.25 }] } },
    70: { id:'cauchemar_et', name:'Cauchemar Éternel', desc:'À la mort → tous ennemis -20% HP',
      hooks:{ ON_DEATH: [{ type:'aoe_damage', rate:0.20 }] } },
  },

  // ── Onix ────────────────────────────────────────────────────────────────
  95: {
    35: { id:'mur_pierre', name:'Mur de Pierre', desc:'-30% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.70 }] } },
    70: { id:'force_tit', name:'Force Titanesque', desc:'+10% ATK par ennemi K.O.',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'atkOnEnemyKo', boost:0.10 }] } },
  },

  // ── Soporifik/Hypnomade ───────────────────────────────────────────────────
  96: {
    35: { id:'hypnose_so', name:'Hypnose', desc:'30% sommeil en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'sleep', chance:0.30, turns:2 }] } },
    70: { id:'reve_abs', name:'Rêve Absorbant', desc:'Drain 100% dégâts sur cibles endormies',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'drainVsSleep', rate:1.0 }] } },
  },
  97: {
    35: { id:'hypnose_plus', name:'Hypnose+', desc:'35% sommeil + drain 15%',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'sleep', chance:0.35, turns:2 },
                          { type:'drain', rate:0.15 }] } },
    70: { id:'cauchemar_h', name:'Cauchemar', desc:'Cibles endormies perdent 10% HP/action',
      hooks:{ ON_PERIODIC: [{ type:'dot_sleeping_enemies', rate:0.10 }] } },
  },

  // ── Krabby/Krabboss ───────────────────────────────────────────────────────
  98: {
    35: { id:'tenailles', name:'Tenailles', desc:'20% stun en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'stun', chance:0.20, turns:1 }] } },
    70: { id:'etreinte_k', name:'Étreinte', desc:'+20% dégâts sur cibles stun',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'bonusVsStun', mult:1.20 }] } },
  },
  99: {
    35: { id:'hyper_ten', name:'Hyper Tenailles', desc:'30% stun + -20% ATK cible',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'stun', chance:0.30, turns:1 },
                          { type:'debuff_target', stat:'atk', mult:0.80 }] } },
    70: { id:'crabe_geant', name:'Crabe Géant', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
  },

  // ── Voltorbe/Électrode ───────────────────────────────────────────────────
  100: {
    35: { id:'explosion_im', name:'Explosion Imminente', desc:'Si PV<30% → +50% ATK',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'atk', mult:1.50, condition:'hp_below', threshold:0.30 }] } },
    70: { id:'autodestruct', name:'Autodestruction', desc:'À la mort → AoE 50% HP',
      hooks:{ ON_DEATH: [{ type:'aoe_damage', rate:0.50 }] } },
  },
  101: {
    35: { id:'ultrarapide', name:'Ultrarapide', desc:'+25% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.25 }] } },
    70: { id:'bang', name:'Bang', desc:'À la mort → 20% KO instante sur 1 ennemi',
      hooks:{ ON_DEATH: [{ type:'target_ko_chance', chance:0.20 }] } },
  },

  // ── Nœunœuf/Noadkoko ─────────────────────────────────────────────────────
  102: {
    35: { id:'telepathie_n', name:'Télépathie', desc:'+5% SP.ATK par allié vivant',
      hooks:{ ON_ACTION: [{ type:'stack_per_ally', stat:'spa', rate:0.05, allyType:'all' }] } },
    70: { id:'spore_sol', name:'Spore Solaire', desc:'30% sommeil AoE au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'sleep', turns:2, row:'all', chance:0.30 }] } },
  },
  103: {
    35: { id:'melodie_n', name:'Mélodie', desc:'Soigne 10% HP alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.10 }] } },
    70: { id:'hypnose_fl', name:'Hypnose Florale', desc:'Endort 1 ennemi aléatoire au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'sleep', turns:2, row:'random1', chance:1.0 }] } },
  },

  // ── Osselait/Ossatueur ───────────────────────────────────────────────────
  104: {
    35: { id:'os', name:'Os', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
    70: { id:'malediction_o', name:'Malédiction', desc:'Cible frappée perd 8% HP/action',
      hooks:{ ON_ATTACK: [{ type:'flag_target', flag:'dotTarget', rate:0.08 }] } },
  },
  105: {
    35: { id:'danse_os', name:'Danse des Os', desc:'+10% ATK cumulatif/frappe',
      hooks:{ ON_ATTACK: [{ type:'ramp_stat', stat:'atk', rate:0.10, max:0.50 }] } },
    70: { id:'squelette_m', name:'Squelette Maudit', desc:'Riposte 30% dégâts physiques',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.30 }] } },
  },

  // ── Kicklee/Tygnon ────────────────────────────────────────────────────────
  106: {
    35: { id:'coud_pied', name:'Coud\'Pied', desc:'25% : frappe bonus à 50% puissance',
      hooks:{ ON_ATTACK: [{ type:'bonus_hit', mult:0.50, chance:0.25 }] } },
    70: { id:'contre', name:'Contre', desc:'Riposte 60% dégâts physiques',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.60 }] } },
  },
  107: {
    35: { id:'crochet', name:'Crochet', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
    70: { id:'tir_prec', name:'Tir de Précision', desc:'Ignore 25% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.25 }] } },
  },

  // ── Excelangue ────────────────────────────────────────────────────────────
  108: {
    35: { id:'lechouille', name:'Léchouille', desc:'Drain 20% des dégâts',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.20 }] } },
    70: { id:'langue_coll', name:'Langue Collante', desc:'20% stun 2 actions',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'stun', chance:0.20, turns:2 }] } },
  },

  // ── Smogo/Smogogo ─────────────────────────────────────────────────────────
  109: {
    35: { id:'nuage_tox', name:'Nuage Toxique', desc:'Poison AoE au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'poison', row:'all', chance:1.0 }] } },
    70: { id:'corrosion', name:'Corrosion', desc:'Poison inflige +50% dégâts',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'poisonDmgBoost', mult:1.50 }] } },
  },
  110: {
    35: { id:'double_gaz', name:'Double Gaz', desc:'2 stacks poison/attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:1.0, stacks:2 }] } },
    70: { id:'toxines', name:'Toxines', desc:'Poison réduit aussi VIT -20%',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'poisonSlow', mult:0.80 }] } },
  },

  // ── Rhinocorne/Rhinoféros ─────────────────────────────────────────────────
  111: {
    35: { id:'corne_r', name:'Corne', desc:'Ignore 20% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.20 }] } },
    70: { id:'charge_r', name:'Charge', desc:'Premier coup ×2',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'firstHitBoost', mult:2.0 }] } },
  },
  112: {
    35: { id:'furie_r2', name:'Furie', desc:'+2% ATK par coup reçu',
      hooks:{ ON_RECEIVE: [{ type:'rage', stat:'atk', rate:0.02, max:0.50 }] } },
    70: { id:'foulee_lourde', name:'Foulée Lourde', desc:'+25% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.25 }] } },
  },

  // ── Leveinard ─────────────────────────────────────────────────────────────
  113: {
    35: { id:'soin_lev', name:'Soin', desc:'Soigne 10% HP alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.10 }] } },
    70: { id:'devouement', name:'Dévouement', desc:'+30% HP',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'hp', mult:1.30 }] } },
  },

  // ── Saquedeneu ────────────────────────────────────────────────────────────
  114: {
    35: { id:'lianes_sq', name:'Lianes', desc:'+5% ATK par allié vivant',
      hooks:{ ON_ACTION: [{ type:'stack_per_ally', stat:'atk', rate:0.05, allyType:'all' }] } },
    70: { id:'regeneration', name:'Régénération', desc:'Soigne 5% HP à chaque action',
      hooks:{ ON_ACTION: [{ type:'heal_self', rate:0.05 }] } },
  },

  // ── Kangourex ─────────────────────────────────────────────────────────────
  115: {
    35: { id:'joey', name:'Joey', desc:'+20% HP',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'hp', mult:1.20 }] } },
    70: { id:'maman', name:'Maman', desc:'+30% HP',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'hp', mult:1.30 }] } },
  },

  // ── Hypotrempe/Hypocéan ───────────────────────────────────────────────────
  116: {
    35: { id:'rapide_h', name:'Rapide', desc:'+20% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.20 }] } },
    70: { id:'danse_lames_h', name:'Danse-Lames', desc:'+10% ATK cumulatif/frappe',
      hooks:{ ON_ATTACK: [{ type:'ramp_stat', stat:'atk', rate:0.10, max:0.60 }] } },
  },
  117: {
    35: { id:'jet_eau', name:'Jet d\'Eau', desc:'+15% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.15 }] } },
    70: { id:'dragon_marin', name:'Dragon Marin', desc:'-30% dégâts Dragon reçus',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'typeResist', damageType:'Dragon', mult:0.70 }] } },
  },

  // ── Poissirène/Poissoroy ──────────────────────────────────────────────────
  118: {
    35: { id:'nage_rapide', name:'Nage Rapide', desc:'+15% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.15 }] } },
    70: { id:'plongeon', name:'Plongeon', desc:'Esquive 1 attaque/combat',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'dodgeOnce' }] } },
  },
  119: {
    35: { id:'reflet_p', name:'Reflet', desc:'+20% à la stat la plus élevée',
      hooks:{ ON_SETUP: [{ type:'boost_highest_stat', mult:1.20 }] } },
    70: { id:'royal', name:'Royal', desc:'+10% stats à tous les alliés',
      hooks:{ ON_SETUP: [{ type:'aura_all_boost', mult:1.10 }] } },
  },

  // ── Stari/Staross ────────────────────────────────────────────────────────
  120: {
    35: { id:'etoile', name:'Étoile', desc:'Soigne 5% HP alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.05 }] } },
    70: { id:'recuperation', name:'Récupération', desc:'Soigne 20% HP si PV<25%',
      hooks:{ ON_ACTION: [{ type:'emergency_heal', rate:0.20, threshold:0.25 }] } },
  },
  121: {
    35: { id:'rayonnement', name:'Rayonnement', desc:'Soigne 8% HP alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.08 }] } },
    70: { id:'teleportation', name:'Téléportation', desc:'Esquive 1 attaque/combat',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'dodgeOnce' }] } },
  },

  // ── M. Mime ───────────────────────────────────────────────────────────────
  122: {
    35: { id:'barriere_m', name:'Barrière', desc:'Absorbe 1 coup',
      hooks:{ ON_SETUP: [{ type:'shield' }] } },
    70: { id:'mime', name:'Mime', desc:'+20% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
  },

  // ── Insécateur ────────────────────────────────────────────────────────────
  123: {
    35: { id:'lames_ins', name:'Lames', desc:'2 frappes par attaque',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'multiHit', hits:2, mult:0.60 }] } },
    70: { id:'danse_lames_i', name:'Danse-Lames', desc:'+10% ATK cumulatif/frappe',
      hooks:{ ON_ATTACK: [{ type:'ramp_stat', stat:'atk', rate:0.10, max:0.60 }] } },
  },

  // ── Lippoutou ─────────────────────────────────────────────────────────────
  124: {
    35: { id:'baiser_glace', name:'Baiser Glacé', desc:'30% gel en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'freeze', chance:0.30, turns:2 }] } },
    70: { id:'charme_l', name:'Charme', desc:'-20% ATK ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk'], mult:0.80 }] } },
  },

  // ── Élektek ───────────────────────────────────────────────────────────────
  125: {
    35: { id:'dynamopoing', name:'Dynamopoing', desc:'Ignore 30% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.30 }] } },
    70: { id:'moteur', name:'Moteur', desc:'+5% VIT par coup reçu',
      hooks:{ ON_RECEIVE: [{ type:'rage', stat:'spd', rate:0.05, max:0.30 }] } },
  },

  // ── Magmar ────────────────────────────────────────────────────────────────
  126: {
    35: { id:'smog_mag', name:'Smog Toxique', desc:'30% poison en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.30 }] } },
    70: { id:'fusion_mag', name:'Fusion', desc:'+25% SP.ATK si allié Feu',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'spa', mult:1.25, condition:'ally_type', allyType:'Feu' }] } },
  },

  // ── Scarabrute ────────────────────────────────────────────────────────────
  127: {
    35: { id:'armure_sca', name:'Armure', desc:'-25% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.75 }] } },
    70: { id:'emprise', name:'Emprise', desc:'+50% dégâts sur cibles stun',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'bonusVsStun', mult:1.50 }] } },
  },

  // ── Tauros ────────────────────────────────────────────────────────────────
  128: {
    35: { id:'charge_t', name:'Charge', desc:'Premier coup ×2',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'firstHitBoost', mult:2.0 }] } },
    70: { id:'troupeau', name:'Troupeau', desc:'+10% ATK par allié Normal',
      hooks:{ ON_ACTION: [{ type:'stack_per_ally', stat:'atk', rate:0.10, allyType:'Normal' }] } },
  },

  // ── Magicarpe/Léviator ────────────────────────────────────────────────────
  129: {
    35: { id:'tenace_m', name:'Tenace', desc:'Survit 1 coup fatal avec 1HP',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'sturdy' }] } },
    70: { id:'evo_imm', name:'Évolution Imminente', desc:'Si PV<20% → +50% ATK',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'atk', mult:1.50, condition:'hp_below', threshold:0.20 }] } },
  },
  130: {
    35: { id:'intimidation_l', name:'Intimidation', desc:'-20% ATK ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk'], mult:0.80 }] } },
    70: { id:'colere_l', name:'Colère', desc:'+10% ATK par allié K.O.',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'atkOnAllyKo', boost:0.10 }] } },
  },

  // ── Lokhlass ─────────────────────────────────────────────────────────────
  131: {
    35: { id:'ecran_brume', name:'Écran de Brume', desc:'-20% dégâts spéciaux reçus',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'dmgReducSpecial', mult:0.80 }] } },
    70: { id:'chant_opera', name:'Chant d\'Opéra', desc:'2 ennemis aléatoires endormis au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'sleep', turns:2, row:'random2', chance:1.0 }] } },
  },

  // ── Métamorph ─────────────────────────────────────────────────────────────
  132: {
    35: { id:'copie_m', name:'Copie', desc:'Gagne 1/3 des stats du + fort',
      hooks:{ ON_SETUP: [{ type:'copy_strongest', ratio:1/3 }] } },
    70: { id:'metamorphe', name:'Métamorphe', desc:'Gagne 1/2 des stats du + fort',
      hooks:{ ON_SETUP: [{ type:'copy_strongest', ratio:1/2 }] } },
  },

  // ── Évoli ─────────────────────────────────────────────────────────────────
  133: {
    35: { id:'adaptabilite', name:'Adaptabilité', desc:'+20% stat la plus haute',
      hooks:{ ON_SETUP: [{ type:'boost_highest_stat', mult:1.20 }] } },
    70: { id:'potentiel', name:'Potentiel', desc:'Immunisé statuts + +10% stats',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['burn','poison','paralyze','freeze','sleep','confuse','stun'] },
                         { type:'stat_boost', stats:['atk','spa','def','spd_def','spd'], mult:1.10 }] } },
  },

  // ── Aquali/Voltali/Pyroli ─────────────────────────────────────────────────
  134: {
    35: { id:'absorb_eau', name:'Absorption Eau', desc:'Immunisé dégâts Eau, soigné à la place',
      hooks:{ ON_SETUP: [{ type:'type_absorb', damageType:'Eau' }] } },
    70: { id:'hydrojet', name:'Hydrojet', desc:'+30% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.30 }] } },
  },
  135: {
    35: { id:'plasma', name:'Plasma', desc:'40% paralysie en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'paralyze', chance:0.40 }] } },
    70: { id:'ionisation', name:'Ionisation', desc:'-15% VIT tous ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['spd'], mult:0.85 }] } },
  },
  136: {
    35: { id:'chaleur_p', name:'Chaleur', desc:'Si PV>75% → +25% SP.ATK',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'spa', mult:1.25, condition:'hp_above', threshold:0.75 }] } },
    70: { id:'feu_sacre_p', name:'Feu Sacré', desc:'+25% SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.25 }] } },
  },

  // ── Porygon ───────────────────────────────────────────────────────────────
  137: {
    35: { id:'analyse', name:'Analyse', desc:'+5% dégâts par coup reçu',
      hooks:{ ON_RECEIVE: [{ type:'rage', stat:'spa', rate:0.05, max:0.40 }] } },
    70: { id:'code_viral', name:'Code Viral', desc:'20% statut aléatoire en attaque',
      hooks:{ ON_ATTACK: [{ type:'proc_status_random', statuses:['burn','poison','paralyze','freeze','confuse'], chance:0.20 }] } },
  },

  // ── Fossiles ──────────────────────────────────────────────────────────────
  138: {
    35: { id:'carapace_am', name:'Carapace', desc:'-20% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
    70: { id:'resurgence', name:'Résurgence', desc:'Ressuscite avec 25% HP',
      hooks:{ ON_SETUP: [{ type:'revive_mark', rate:0.25 }] } },
  },
  139: {
    35: { id:'armure_fos', name:'Armure Fossile', desc:'Absorbe 1 coup + -20% dégâts',
      hooks:{ ON_SETUP: [{ type:'shield' }, { type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
    70: { id:'frappe_fos', name:'Frappe Fossile', desc:'Ignore 30% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.30 }] } },
  },
  140: {
    35: { id:'dur', name:'Dur', desc:'-25% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.75 }] } },
    70: { id:'jet_rochers', name:'Jet de Rochers', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
  },
  141: {
    35: { id:'tranchant_k', name:'Tranchant', desc:'+30% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.30 }] } },
    70: { id:'faucille', name:'Faucille', desc:'Drain 30% des dégâts',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.30 }] } },
  },

  // ── Ptéra ─────────────────────────────────────────────────────────────────
  142: {
    35: { id:'agilite_pt', name:'Agilité', desc:'+5% VIT cumulatif/action',
      hooks:{ ON_ACTION: [{ type:'ramp_stat', stat:'spd', rate:0.05, max:0.40 }] } },
    70: { id:'ere_ancienne', name:'Ère Ancienne', desc:'+20% ATK et DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stats:['atk','def'], mult:1.20 }] } },
  },

  // ── Ronflex ───────────────────────────────────────────────────────────────
  143: {
    35: { id:'estomac', name:'Estomac', desc:'+10% HP',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'hp', mult:1.10 }] } },
    70: { id:'corps_lourd', name:'Corps Lourd', desc:'Immunisé stun + riposte 20%',
      hooks:{ ON_SETUP:   [{ type:'status_immunity', statuses:['stun'] }],
              ON_RECEIVE: [{ type:'counter', rate:0.20 }] } },
  },

  // ── Légendaires ───────────────────────────────────────────────────────────
  144: {
    35: { id:'vent_glace', name:'Vent Glacé', desc:'-15% VIT tous ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['spd'], mult:0.85 }] } },
    70: { id:'blizzard_div', name:'Blizzard Divin', desc:'Gel AoE 40% au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'freeze', turns:2, row:'all', chance:0.40 }] } },
  },
  145: {
    35: { id:'tonnerre_div', name:'Tonnerre Divin', desc:'Paralysie AoE 30% au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status', status:'paralyze', row:'all', chance:0.30 }] } },
    70: { id:'tempete_elec', name:'Tempête Électrique', desc:'Paralysie AoE / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'aoe_status_periodic', status:'paralyze', chance:0.30 }] } },
  },
  146: {
    35: { id:'chaleur_ecr', name:'Chaleur Écrasante', desc:'Brûlure stack AoE 35% au début',
      hooks:{ ON_SETUP: [{ type:'aoe_status_stack', status:'burn', turns:3, row:'all', chance:0.35 }] } },
    70: { id:'phenix_ardent', name:'Phénix Ardent', desc:'Ressuscite à 50% HP',
      hooks:{ ON_SETUP: [{ type:'revive_mark', rate:0.50 }] } },
  },
  147: {
    35: { id:'draco_min', name:'Draco', desc:'+10% ATK par allié Dragon',
      hooks:{ ON_ACTION: [{ type:'stack_per_ally', stat:'atk', rate:0.10, allyType:'Dragon' }] } },
    70: { id:'vague_dragon', name:'Vague Dragon', desc:'-15% ATK/SP.ATK/VIT ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk','spa','spd'], mult:0.88 }] } },
  },
  148: {
    35: { id:'colere_drag', name:'Colère Dragon', desc:'+25% ATK et SP.ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stats:['atk','spa'], mult:1.25 }] } },
    70: { id:'danse_draco', name:'Danse Draco', desc:'+8% ATK+VIT cumulatif/frappe',
      hooks:{ ON_ATTACK: [{ type:'ramp_stat', stats:['atk','spd'], rate:0.08, max:0.40 }] } },
  },
  149: {
    35: { id:'vitesse_drag', name:'Vitesse du Dragon', desc:'+30% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.30 }] } },
    70: { id:'domination_dr', name:'Domination', desc:'-15% toutes stats ennemis',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk','spa','def','spd_def','spd'], mult:0.88 }] } },
  },
  150: {
    35: { id:'pression_mew', name:'Pression', desc:'-50% gains mana ennemis',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'reduceEnemyMana', mult:0.50 }] } },
    70: { id:'domination_m', name:'Domination Psychique', desc:'+20% à toutes les stats',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stats:['hp','atk','spa','def','spd_def','spd'], mult:1.20 }] } },
  },
  151: {
    35: { id:'transformation_mew', name:'Transformation', desc:'Gagne 1/3 des stats du + fort en combat',
      hooks:{ ON_SETUP: [{ type:'copy_strongest', ratio:1/3 }] } },
    70: { id:'metronome', name:'Métronome', desc:'Passif aléatoire parmi tous les existants',
      hooks:{ ON_SETUP: [{ type:'random_passive' }] } },
  },

  // ── Génération 2 (#152 à #251) ─────────────────────────────────────────
  152: {
    35: { id:'photosynthese_152', name:'Photosynthèse', desc:'Soigne 8% PV/tour',
      hooks:{ ON_PERIODIC: [{ type:'heal_self', rate:0.08 }] } },
    70: { id:'croissance_152', name:'Croissance', desc:'+6% ATK par action (max 30%)',
      hooks:{ ON_ACTION: [{ type:'ramp_stat', stat:'atk', rate:0.06, max:0.30 }] } },
  },
  153: {
    35: { id:'parfum_apaisant_153', name:'Parfum Apaisant', desc:'+15% DEF aux alliés Plante',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', pkType:'Plante', stat:'def', mult:1.15 }] } },
    70: { id:'synthese_153', name:'Synthèse', desc:'Soigne 10% PV / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_self_periodic', rate:0.10 }] } },
  },
  154: {
    35: { id:'herbe_douce_154', name:'Herbe Douce', desc:'Soigne 4% PV alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.04 }] } },
    70: { id:'aura_florale_154', name:'Aura Florale', desc:'+12% toutes stats aux alliés',
      hooks:{ ON_SETUP: [{ type:'aura_all_boost', mult:1.12 }] } },
  },
  155: {
    35: { id:'brasier_155', name:'Brasier', desc:'+30% ATK et SPA si PV<33%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.33, stats:['atk','spa'], mult:1.30 }] } },
    70: { id:'fumee_epaisse_155', name:'Fumée Épaisse', desc:'+15% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', rate:0.15 }] } },
  },
  156: {
    35: { id:'corps_ardent_156', name:'Corps Ardent', desc:'25% de brûler l\'attaquant',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'burn', chance:0.25 }] } },
    70: { id:'brasier_vif_156', name:'Brasier Vif', desc:'+35% SPA si PV<50%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.50, stat:'spa', mult:1.35 }] } },
  },
  157: {
    35: { id:'eruption_157', name:'Éruption', desc:'+30% SPA si PV>66%',
      hooks:{ ON_ACTION: [{ type:'hp_above', threshold:0.66, stat:'spa', mult:1.30 }] } },
    70: { id:'fournaise_157', name:'Fournaise', desc:'Brûle 4% PV/tour à tous les ennemis',
      hooks:{ ON_PERIODIC: [{ type:'dot_enemies', rate:0.04 }] } },
  },
  158: {
    35: { id:'machoire_158', name:'Mâchoire', desc:'Ignore 20% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.20 }] } },
    70: { id:'torrent_158', name:'Torrent', desc:'+30% ATK si PV<33%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.33, stat:'atk', mult:1.30 }] } },
  },
  159: {
    35: { id:'intimidation_159', name:'Intimidation', desc:'-15% ATK ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'atk', mult:0.85 }] } },
    70: { id:'peau_dure_159', name:'Peau Dure', desc:'-15% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.85 }] } },
  },
  160: {
    35: { id:'torrent_160', name:'Torrent', desc:'+40% ATK si PV<33%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.33, stat:'atk', mult:1.40 }] } },
    70: { id:'predateur_160', name:'Prédateur', desc:'Vole 25% des dégâts en PV',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.25 }] } },
  },
  161: {
    35: { id:'echauffement_161', name:'Échauffement', desc:'+8% VIT par action (max 40%)',
      hooks:{ ON_ACTION: [{ type:'ramp_stat', stat:'spd', rate:0.08, max:0.40 }] } },
    70: { id:'vigilance_161', name:'Vigilance', desc:'Immunisé au sommeil',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['sleep'] }] } },
  },
  162: {
    35: { id:'coup_rapide_162', name:'Coup Rapide', desc:'+25% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.25 }] } },
    70: { id:'tenacite_162', name:'Ténacité', desc:'+40% VIT si PV<50%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.50, stat:'spd', mult:1.40 }] } },
  },
  163: {
    35: { id:'insomnie_163', name:'Insomnie', desc:'Immunisé au sommeil',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['sleep'] }] } },
    70: { id:'regard_percant_163', name:'Regard Perçant', desc:'Ignore 20% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.20 }] } },
  },
  164: {
    35: { id:'yeux_de_nuit_164', name:'Yeux de Nuit', desc:'+20% SPA',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
    70: { id:'vol_silencieux_164', name:'Vol Silencieux', desc:'+20% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', rate:0.20 }] } },
  },
  165: {
    35: { id:'essaim_165', name:'Essaim', desc:'+8% toutes stats par allié Insecte',
      hooks:{ ON_SETUP: [{ type:'stack_per_ally', pkType:'Insecte', mult:0.08 }] } },
    70: { id:'ecaille_vive_165', name:'Écaille Vive', desc:'+12% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', rate:0.12 }] } },
  },
  166: {
    35: { id:'aura_lumineuse_166', name:'Aura Lumineuse', desc:'+20% SPA aux alliés Insecte',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', pkType:'Insecte', stat:'spa', mult:1.20 }] } },
    70: { id:'reflet_166', name:'Reflet', desc:'-15% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.85 }] } },
  },
  167: {
    35: { id:'toile_167', name:'Toile', desc:'-20% VIT sur la cible',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'spd', mult:0.80 }] } },
    70: { id:'insomnie_167', name:'Insomnie', desc:'Immunisé au sommeil',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['sleep'] }] } },
  },
  168: {
    35: { id:'piege_de_soie_168', name:'Piège de Soie', desc:'-25% VIT sur la cible',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'spd', mult:0.75 }] } },
    70: { id:'venin_puissant_168', name:'Venin Puissant', desc:'30% d\'empoisonner en attaquant',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.30 }] } },
  },
  169: {
    35: { id:'suceur_de_sang_169', name:'Suceur de Sang', desc:'Vole 20% des dégâts en PV',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.20 }] } },
    70: { id:'radar_sonar_169', name:'Radar Sonar', desc:'Ignore 25% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.25 }] } },
  },
  170: {
    35: { id:'illumination_170', name:'Illumination', desc:'+15% SPA aux alliés Eau',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', pkType:'Eau', stat:'spa', mult:1.15 }] } },
    70: { id:'absorbe_volt_170', name:'Absorbe Volt', desc:'Immunisé Électrik',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Électrik' }] } },
  },
  171: {
    35: { id:'absorbe_volt_171', name:'Absorbe Volt', desc:'Immunisé Électrik',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Électrik' }] } },
    70: { id:'phare_des_abysses_171', name:'Phare des Abysses', desc:'+15% toutes stats aux alliés Eau',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', pkType:'Eau', stats:['atk','spa','def','spd_def'], mult:1.15 }] } },
  },
  172: {
    35: { id:'statik_172', name:'Statik', desc:'25% de paralyser l\'attaquant',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'paralyze', chance:0.25 }] } },
    70: { id:'joue_chargee_172', name:'Joue Chargée', desc:'+8% SPA par action (max 40%)',
      hooks:{ ON_ACTION: [{ type:'ramp_stat', stat:'spa', rate:0.08, max:0.40 }] } },
  },
  173: {
    35: { id:'charme_173', name:'Charme', desc:'-20% ATK ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'atk', mult:0.80 }] } },
    70: { id:'vu_doux_173', name:'Vœu Doux', desc:'Soigne 4% PV alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.04 }] } },
  },
  174: {
    35: { id:'doux_reve_174', name:'Doux Rêve', desc:'Blesse les ennemis endormis',
      hooks:{ ON_PERIODIC: [{ type:'dot_sleeping_enemies', rate:0.06 }] } },
    70: { id:'ballon_174', name:'Ballon', desc:'Bouclier 20% PV au départ',
      hooks:{ ON_SETUP: [{ type:'shield', rate:0.20 }] } },
  },
  175: {
    35: { id:'chance_innee_175', name:'Chance Innée', desc:'Passif aléatoire',
      hooks:{ ON_SETUP: [{ type:'random_passive' }] } },
    70: { id:'benediction_175', name:'Bénédiction', desc:'Soigne 8% PV à l\'allié le + faible',
      hooks:{ ON_PERIODIC: [{ type:'heal_weakest_ally', rate:0.08 }] } },
  },
  176: {
    35: { id:'joie_contagieuse_176', name:'Joie Contagieuse', desc:'+10% toutes stats aux alliés',
      hooks:{ ON_SETUP: [{ type:'buff_allies', mult:1.10 }] } },
    70: { id:'gardien_176', name:'Gardien', desc:'Empêche 1 K.O. allié par combat',
      hooks:{ ON_SETUP: [{ type:'no_ally_ko' }] } },
  },
  177: {
    35: { id:'synchro_177', name:'Synchro', desc:'Renvoie 30% des dégâts',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.30 }] } },
    70: { id:'premonition_177', name:'Prémonition', desc:'+18% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', rate:0.18 }] } },
  },
  178: {
    35: { id:'levitation_178', name:'Lévitation', desc:'Immunisé Sol',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Sol' }] } },
    70: { id:'regard_futur_178', name:'Regard Futur', desc:'+20% SPA',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
  },
  179: {
    35: { id:'statik_179', name:'Statik', desc:'25% de paralyser l\'attaquant',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'paralyze', chance:0.25 }] } },
    70: { id:'laine_isolante_179', name:'Laine Isolante', desc:'-12% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.88 }] } },
  },
  180: {
    35: { id:'charge_statique_180', name:'Charge Statique', desc:'+7% SPA par action (max 35%)',
      hooks:{ ON_ACTION: [{ type:'ramp_stat', stat:'spa', rate:0.07, max:0.35 }] } },
    70: { id:'toison_180', name:'Toison', desc:'Bouclier 15% PV',
      hooks:{ ON_SETUP: [{ type:'shield', rate:0.15 }] } },
  },
  181: {
    35: { id:'phare_181', name:'Phare', desc:'+25% SPA aux alliés Électrik',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', pkType:'Électrik', stat:'spa', mult:1.25 }] } },
    70: { id:'surtension_181', name:'Surtension', desc:'+40% SPA si PV<50%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.50, stat:'spa', mult:1.40 }] } },
  },
  182: {
    35: { id:'pollen_182', name:'Pollen', desc:'20% d\'empoisonner en attaquant',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.20 }] } },
    70: { id:'chlorophylle_182', name:'Chlorophylle', desc:'+25% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.25 }] } },
  },
  183: {
    35: { id:'ventre_a_terre_183', name:'Ventre à Terre', desc:'+50% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.50 }] } },
    70: { id:'peau_epaisse_183', name:'Peau Épaisse', desc:'-15% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.85 }] } },
  },
  184: {
    35: { id:'ventre_a_terre_184', name:'Ventre à Terre', desc:'+50% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.50 }] } },
    70: { id:'voile_aqua_184', name:'Voile Aqua', desc:'Immunisé brûlure et confusion',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['burn','confuse'] }] } },
  },
  185: {
    35: { id:'mimetisme_185', name:'Mimétisme', desc:'Gagne 1/4 des stats du + fort allié',
      hooks:{ ON_SETUP: [{ type:'copy_strongest', ratio:0.25 }] } },
    70: { id:'statue_185', name:'Statue', desc:'Immunisé Plante et +25% DEF',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Plante' }] } },
  },
  186: {
    35: { id:'moiteur_186', name:'Moiteur', desc:'-15% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.85 }] } },
    70: { id:'danse_pluie_186', name:'Danse Pluie', desc:'+20% SPA aux alliés Eau',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', pkType:'Eau', stat:'spa', mult:1.20 }] } },
  },
  187: {
    35: { id:'infiltration_187', name:'Infiltration', desc:'Ignore 15% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.15 }] } },
    70: { id:'portee_par_le_vent_187', name:'Portée par le Vent', desc:'+15% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', rate:0.15 }] } },
  },
  188: {
    35: { id:'spores_188', name:'Spores', desc:'25% d\'empoisonner en attaquant',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'poison', chance:0.25 }] } },
    70: { id:'leger_comme_l_air_188', name:'Léger comme l\'Air', desc:'Immunisé Sol',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Sol' }] } },
  },
  189: {
    35: { id:'coton_defensif_189', name:'Coton Défensif', desc:'+20% DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'def', mult:1.20 }] } },
    70: { id:'spore_paralysante_189', name:'Spore Paralysante', desc:'30% de paralyser en attaquant',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'paralyze', chance:0.30 }] } },
  },
  190: {
    35: { id:'agilite_190', name:'Agilité', desc:'+25% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.25 }] } },
    70: { id:'relais_190', name:'Relais', desc:'+12% toutes stats aux alliés',
      hooks:{ ON_SETUP: [{ type:'buff_allies', mult:1.12 }] } },
  },
  191: {
    35: { id:'chlorophylle_191', name:'Chlorophylle', desc:'+25% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.25 }] } },
    70: { id:'racines_191', name:'Racines', desc:'Soigne 10% PV / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_self_periodic', rate:0.10 }] } },
  },
  192: {
    35: { id:'capteur_solaire_192', name:'Capteur Solaire', desc:'+25% SPA',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.25 }] } },
    70: { id:'eclat_solaire_192', name:'Éclat Solaire', desc:'À la mort : AoE 20% PV',
      hooks:{ ON_DEATH: [{ type:'aoe_damage', rate:0.20 }] } },
  },
  193: {
    35: { id:'il_compose_193', name:'Œil Composé', desc:'Ignore 20% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.20 }] } },
    70: { id:'turbo_ailes_193', name:'Turbo Ailes', desc:'+25% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.25 }] } },
  },
  194: {
    35: { id:'absorbe_volt_194', name:'Absorbe Volt', desc:'Immunisé Électrik',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Électrik' }] } },
    70: { id:'peau_humide_194', name:'Peau Humide', desc:'Soigne 8% PV / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_self_periodic', rate:0.08 }] } },
  },
  195: {
    35: { id:'absorbe_volt_195', name:'Absorbe Volt', desc:'Immunisé Électrik',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Électrik' }] } },
    70: { id:'marecage_195', name:'Marécage', desc:'-20% VIT ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'spd', mult:0.80 }] } },
  },
  196: {
    35: { id:'synchro_196', name:'Synchro', desc:'Renvoie 30% des dégâts',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.30 }] } },
    70: { id:'prescience_196', name:'Prescience', desc:'+25% SPA',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.25 }] } },
  },
  197: {
    35: { id:'synchro_197', name:'Synchro', desc:'Renvoie 35% des dégâts',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.35 }] } },
    70: { id:'garde_nocturne_197', name:'Garde Nocturne', desc:'+20% ATK à la mort d\'un allié',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'atkOnAllyKo', boost:0.20 }] } },
  },
  198: {
    35: { id:'larcin_198', name:'Larcin', desc:'+1 pièce par K.O.',
      hooks:{ ON_ATTACK: [{ type:'flag', flag:'coinOnKo', amount:1 }] } },
    70: { id:'malchance_198', name:'Malchance', desc:'-12% ATK sur la cible',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'atk', mult:0.88 }] } },
  },
  199: {
    35: { id:'royaute_199', name:'Royauté', desc:'+12% toutes stats aux alliés',
      hooks:{ ON_SETUP: [{ type:'aura_all_boost', mult:1.12 }] } },
    70: { id:'regeneration_199', name:'Régénération', desc:'Soigne 12% PV / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_self_periodic', rate:0.12 }] } },
  },
  200: {
    35: { id:'levitation_200', name:'Lévitation', desc:'Immunisé Sol',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Sol' }] } },
    70: { id:'malediction_200', name:'Malédiction', desc:'Blesse les ennemis 5% PV/tour',
      hooks:{ ON_PERIODIC: [{ type:'dot_enemies', rate:0.05 }] } },
  },
  201: {
    35: { id:'forme_mystere_201', name:'Forme Mystère', desc:'+15% toutes stats',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stats:['atk','spa','def','spd_def','spd'], mult:1.15 }] } },
    70: { id:'alphabet_201', name:'Alphabet', desc:'Passif aléatoire',
      hooks:{ ON_SETUP: [{ type:'random_passive' }] } },
  },
  202: {
    35: { id:'riposte_202', name:'Riposte', desc:'Renvoie 60% des dégâts',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.60 }] } },
    70: { id:'miroir_magique_202', name:'Miroir Magique', desc:'Bouclier 25% PV',
      hooks:{ ON_SETUP: [{ type:'shield', rate:0.25 }] } },
  },
  203: {
    35: { id:'tete_arriere_203', name:'Tête Arrière', desc:'Renvoie 40% des dégâts',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.40 }] } },
    70: { id:'concentration_203', name:'Concentration', desc:'Immunisé confusion',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['confuse'] }] } },
  },
  204: {
    35: { id:'carapace_204', name:'Carapace', desc:'+25% DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'def', mult:1.25 }] } },
    70: { id:'epines_204', name:'Épines', desc:'Renvoie 30% des dégâts',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.30 }] } },
  },
  205: {
    35: { id:'blindage_205', name:'Blindage', desc:'-20% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
    70: { id:'champ_de_picots_205', name:'Champ de Picots', desc:'À la mort : AoE 20% PV',
      hooks:{ ON_DEATH: [{ type:'aoe_damage', rate:0.20 }] } },
  },
  206: {
    35: { id:'ecran_fumee_206', name:'Écran Fumée', desc:'+15% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', rate:0.15 }] } },
    70: { id:'garde_mystik_206', name:'Garde Mystik', desc:'Immunisé à tous les statuts',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['burn','poison','paralyze','freeze','confuse','sleep'] }] } },
  },
  207: {
    35: { id:'hyper_cutter_207', name:'Hyper Cutter', desc:'Ignore 25% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.25 }] } },
    70: { id:'sable_volant_207', name:'Sable Volant', desc:'+15% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', rate:0.15 }] } },
  },
  208: {
    35: { id:'corps_sain_208', name:'Corps Sain', desc:'Immunisé à tous les statuts',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['burn','poison','paralyze','freeze','confuse','sleep'] }] } },
    70: { id:'carapace_d_acier_208', name:'Carapace d\'Acier', desc:'-20% dégâts aux alliés Acier',
      hooks:{ ON_SETUP: [{ type:'aura_dmg_reduction', pkType:'Acier', mult:0.80 }] } },
  },
  209: {
    35: { id:'intimidation_209', name:'Intimidation', desc:'-18% ATK ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'atk', mult:0.82 }] } },
    70: { id:'charme_brutal_209', name:'Charme Brutal', desc:'-25% ATK sur la cible',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'atk', mult:0.75 }] } },
  },
  210: {
    35: { id:'intimidation_210', name:'Intimidation', desc:'-20% ATK ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'atk', mult:0.80 }] } },
    70: { id:'rage_feerique_210', name:'Rage Féerique', desc:'+4% ATK par coup reçu (max 40%)',
      hooks:{ ON_RECEIVE: [{ type:'rage', stat:'atk', rate:0.04, max:0.40 }] } },
  },
  211: {
    35: { id:'point_poison_211', name:'Point Poison', desc:'30% d\'empoisonner l\'attaquant',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'poison', chance:0.30 }] } },
    70: { id:'gonflement_211', name:'Gonflement', desc:'Bouclier 20% PV',
      hooks:{ ON_SETUP: [{ type:'shield', rate:0.20 }] } },
  },
  212: {
    35: { id:'technicien_212', name:'Technicien', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
    70: { id:'lame_ailee_212', name:'Lame Ailée', desc:'25% : frappe bonus à 50% puissance',
      hooks:{ ON_ATTACK: [{ type:'bonus_hit', mult:0.50, chance:0.25 }] } },
  },
  213: {
    35: { id:'robustesse_213', name:'Robustesse', desc:'Survit à 1 PV une fois',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'sturdy' }] } },
    70: { id:'coque_solide_213', name:'Coque Solide', desc:'-35% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.65 }] } },
  },
  214: {
    35: { id:'essaim_214', name:'Essaim', desc:'+40% ATK si PV<33%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.33, stat:'atk', mult:1.40 }] } },
    70: { id:'charge_furieuse_214', name:'Charge Furieuse', desc:'+8% ATK par action (max 40%)',
      hooks:{ ON_ACTION: [{ type:'ramp_stat', stat:'atk', rate:0.08, max:0.40 }] } },
  },
  215: {
    35: { id:'coup_fourre_215', name:'Coup Fourré', desc:'+25% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.25 }] } },
    70: { id:'larcin_215', name:'Larcin', desc:'Ignore 25% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.25 }] } },
  },
  216: {
    35: { id:'ramassage_216', name:'Ramassage', desc:'+1 pièce par K.O.',
      hooks:{ ON_ATTACK: [{ type:'flag', flag:'coinOnKo', amount:1 }] } },
    70: { id:'gourmandise_216', name:'Gourmandise', desc:'Vole 25% des dégâts en PV',
      hooks:{ ON_ATTACK: [{ type:'drain', rate:0.25 }] } },
  },
  217: {
    35: { id:'colere_217', name:'Colère', desc:'+5% ATK par coup reçu (max 40%)',
      hooks:{ ON_RECEIVE: [{ type:'rage', stat:'atk', rate:0.05, max:0.40 }] } },
    70: { id:'fureur_de_l_ours_217', name:'Fureur de l\'Ours', desc:'+20% ATK à la mort d\'un allié',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'atkOnAllyKo', boost:0.20 }] } },
  },
  218: {
    35: { id:'corps_ardent_218', name:'Corps Ardent', desc:'30% de brûler l\'attaquant',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'burn', chance:0.30 }] } },
    70: { id:'magma_218', name:'Magma', desc:'Brûle 4% PV/tour aux ennemis',
      hooks:{ ON_PERIODIC: [{ type:'dot_enemies', rate:0.04 }] } },
  },
  219: {
    35: { id:'corps_ardent_219', name:'Corps Ardent', desc:'35% de brûler l\'attaquant',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'burn', chance:0.35 }] } },
    70: { id:'roche_fondue_219', name:'Roche Fondue', desc:'+25% SPA',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.25 }] } },
  },
  220: {
    35: { id:'fourrure_220', name:'Fourrure', desc:'+25% DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'def', mult:1.25 }] } },
    70: { id:'peau_gelee_220', name:'Peau Gelée', desc:'20% de geler l\'attaquant',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'freeze', chance:0.20 }] } },
  },
  221: {
    35: { id:'grele_221', name:'Grêle', desc:'-15% VIT ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'spd', mult:0.85 }] } },
    70: { id:'charge_lourde_221', name:'Charge Lourde', desc:'+8% ATK par action (max 40%)',
      hooks:{ ON_ACTION: [{ type:'ramp_stat', stat:'atk', rate:0.08, max:0.40 }] } },
  },
  222: {
    35: { id:'regeneration_222', name:'Régénération', desc:'Soigne 10% PV / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_self_periodic', rate:0.10 }] } },
    70: { id:'recif_222', name:'Récif', desc:'+25% DEF aux alliés Eau',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', pkType:'Eau', stat:'def', mult:1.25 }] } },
  },
  223: {
    35: { id:'visee_laser_223', name:'Visée Laser', desc:'Ignore 20% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.20 }] } },
    70: { id:'tir_precis_223', name:'Tir Précis', desc:'+20% SPA',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
  },
  224: {
    35: { id:'ventouses_224', name:'Ventouses', desc:'Ignore 25% DEF',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'ignoreDef', pct:0.25 }] } },
    70: { id:'encre_224', name:'Encre', desc:'-15% ATK ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'atk', mult:0.85 }] } },
  },
  225: {
    35: { id:'bourrasque_225', name:'Bourrasque', desc:'+25% VIT',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spd', mult:1.25 }] } },
    70: { id:'cadeau_surprise_225', name:'Cadeau Surprise', desc:'Soigne 8% PV à l\'allié le + faible',
      hooks:{ ON_PERIODIC: [{ type:'heal_weakest_ally', rate:0.08 }] } },
  },
  226: {
    35: { id:'absorbe_eau_226', name:'Absorbe Eau', desc:'Immunisé Eau',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Eau' }] } },
    70: { id:'planeur_226', name:'Planeur', desc:'+20% esquive',
      hooks:{ ON_SETUP: [{ type:'evasion', rate:0.20 }] } },
  },
  227: {
    35: { id:'armure_vivante_227', name:'Armure Vivante', desc:'-20% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
    70: { id:'piege_de_roc_227', name:'Piège de Roc', desc:'Blesse les ennemis 4% PV/tour',
      hooks:{ ON_PERIODIC: [{ type:'dot_enemies', rate:0.04 }] } },
  },
  228: {
    35: { id:'flamme_228', name:'Flamme', desc:'+30% SPA si PV<33%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.33, stat:'spa', mult:1.30 }] } },
    70: { id:'meute_228', name:'Meute', desc:'+15% ATK à la mort d\'un allié',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'atkOnAllyKo', boost:0.15 }] } },
  },
  229: {
    35: { id:'intimidation_229', name:'Intimidation', desc:'-20% ATK ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'atk', mult:0.80 }] } },
    70: { id:'alpha_229', name:'Alpha', desc:'+25% SPA aux alliés Ténèbres',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', pkType:'Ténèbres', stat:'spa', mult:1.25 }] } },
  },
  230: {
    35: { id:'crachin_230', name:'Crachin', desc:'+20% SPA aux alliés Eau',
      hooks:{ ON_SETUP: [{ type:'aura_type_boost', pkType:'Eau', stat:'spa', mult:1.20 }] } },
    70: { id:'ecailles_royales_230', name:'Écailles Royales', desc:'+15% toutes stats aux alliés',
      hooks:{ ON_SETUP: [{ type:'aura_all_boost', mult:1.15 }] } },
  },
  231: {
    35: { id:'ramassage_231', name:'Ramassage', desc:'+1 pièce par K.O.',
      hooks:{ ON_ATTACK: [{ type:'flag', flag:'coinOnKo', amount:1 }] } },
    70: { id:'robustesse_231', name:'Robustesse', desc:'Survit à 1 PV une fois',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'sturdy' }] } },
  },
  232: {
    35: { id:'robustesse_232', name:'Robustesse', desc:'Survit à 1 PV une fois',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'sturdy' }] } },
    70: { id:'charge_blindee_232', name:'Charge Blindée', desc:'+25% DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'def', mult:1.25 }] } },
  },
  233: {
    35: { id:'telecharge_233', name:'Télécharge', desc:'+20% SPA',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.20 }] } },
    70: { id:'trace_233', name:'Trace', desc:'Gagne 1/4 des stats du + fort ennemi',
      hooks:{ ON_SETUP: [{ type:'copy_strongest', ratio:0.25 }] } },
  },
  234: {
    35: { id:'intimidation_234', name:'Intimidation', desc:'-15% ATK ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'atk', mult:0.85 }] } },
    70: { id:'bois_majestueux_234', name:'Bois Majestueux', desc:'+12% toutes stats aux alliés',
      hooks:{ ON_SETUP: [{ type:'buff_allies', mult:1.12 }] } },
  },
  235: {
    35: { id:'imitation_235', name:'Imitation', desc:'Gagne 1/4 des stats du + fort allié',
      hooks:{ ON_SETUP: [{ type:'copy_strongest', ratio:0.25 }] } },
    70: { id:'chef_d_uvre_235', name:'Chef-d\'œuvre', desc:'Passif aléatoire',
      hooks:{ ON_SETUP: [{ type:'random_passive' }] } },
  },
  236: {
    35: { id:'endurance_236', name:'Endurance', desc:'+30% DEF si PV<50%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.50, stat:'def', mult:1.30 }] } },
    70: { id:'perseverance_236', name:'Persévérance', desc:'+7% ATK par action (max 35%)',
      hooks:{ ON_ACTION: [{ type:'ramp_stat', stat:'atk', rate:0.07, max:0.35 }] } },
  },
  237: {
    35: { id:'intimidation_237', name:'Intimidation', desc:'-18% ATK ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'atk', mult:0.82 }] } },
    70: { id:'toupie_237', name:'Toupie', desc:'Renvoie 50% des dégâts',
      hooks:{ ON_RECEIVE: [{ type:'counter', rate:0.50 }] } },
  },
  238: {
    35: { id:'charme_238', name:'Charme', desc:'-25% ATK sur la cible',
      hooks:{ ON_ATTACK: [{ type:'debuff_target', stat:'atk', mult:0.75 }] } },
    70: { id:'danse_folle_238', name:'Danse Folle', desc:'25% de confusion en attaquant',
      hooks:{ ON_ATTACK: [{ type:'proc_status', status:'confuse', chance:0.25 }] } },
  },
  239: {
    35: { id:'statik_239', name:'Statik', desc:'30% de paralyser l\'attaquant',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'paralyze', chance:0.30 }] } },
    70: { id:'motorise_239', name:'Motorisé', desc:'Immunisé Électrik',
      hooks:{ ON_SETUP: [{ type:'type_immunity', pkType:'Électrik' }] } },
  },
  240: {
    35: { id:'corps_ardent_240', name:'Corps Ardent', desc:'30% de brûler l\'attaquant',
      hooks:{ ON_RECEIVE: [{ type:'proc_status_attacker', status:'burn', chance:0.30 }] } },
    70: { id:'flamme_vive_240', name:'Flamme Vive', desc:'+35% ATK si PV<40%',
      hooks:{ ON_ACTION: [{ type:'hp_below', threshold:0.40, stat:'atk', mult:1.35 }] } },
  },
  241: {
    35: { id:'lait_nourrissant_241', name:'Lait Nourrissant', desc:'Soigne 4% PV alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.04 }] } },
    70: { id:'robuste_241', name:'Robuste', desc:'-20% dégâts reçus',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'_dmgReduction', mult:0.80 }] } },
  },
  242: {
    35: { id:'doux_parfum_242', name:'Doux Parfum', desc:'Soigne 5% PV alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.05 }] } },
    70: { id:'ange_gardien_242', name:'Ange Gardien', desc:'Empêche 1 K.O. allié par combat',
      hooks:{ ON_SETUP: [{ type:'no_ally_ko' }] } },
  },
  243: {
    35: { id:'pression_243', name:'Pression', desc:'-15% VIT ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'spd', mult:0.85 }] } },
    70: { id:'eclair_legendaire_243', name:'Éclair Légendaire', desc:'+25% SPA',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'spa', mult:1.25 }] } },
  },
  244: {
    35: { id:'pression_244', name:'Pression', desc:'-15% ATK ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'atk', mult:0.85 }] } },
    70: { id:'volcan_244', name:'Volcan', desc:'+20% ATK',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'atk', mult:1.20 }] } },
  },
  245: {
    35: { id:'pression_245', name:'Pression', desc:'-15% SPA ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'spa', mult:0.85 }] } },
    70: { id:'vent_purificateur_245', name:'Vent Purificateur', desc:'Immunisé à tous les statuts',
      hooks:{ ON_SETUP: [{ type:'status_immunity', statuses:['burn','poison','paralyze','freeze','confuse','sleep'] }] } },
  },
  246: {
    35: { id:'mue_246', name:'Mue', desc:'Soigne 8% PV / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_self_periodic', rate:0.08 }] } },
    70: { id:'carapace_246', name:'Carapace', desc:'+25% DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'def', mult:1.25 }] } },
  },
  247: {
    35: { id:'mue_247', name:'Mue', desc:'+20% DEF',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stat:'def', mult:1.20 }] } },
    70: { id:'chrysalide_247', name:'Chrysalide', desc:'Bouclier 25% PV',
      hooks:{ ON_SETUP: [{ type:'shield', rate:0.25 }] } },
  },
  248: {
    35: { id:'sable_volant_248', name:'Sable Volant', desc:'-15% VIT ennemie',
      hooks:{ ON_SETUP: [{ type:'intimidate', stat:'spd', mult:0.85 }] } },
    70: { id:'tyran_248', name:'Tyran', desc:'+20% ATK à la mort d\'un allié',
      hooks:{ ON_SETUP: [{ type:'flag', flag:'atkOnAllyKo', boost:0.20 }] } },
  },
  249: {
    35: { id:'pression_249', name:'Pression', desc:'-10% ATK et SPA ennemies',
      hooks:{ ON_SETUP: [{ type:'intimidate', stats:['atk','spa'], mult:0.90 }] } },
    70: { id:'gardien_des_mers_249', name:'Gardien des Mers', desc:'-15% dégâts aux alliés',
      hooks:{ ON_SETUP: [{ type:'aura_dmg_reduction', mult:0.85 }] } },
  },
  250: {
    35: { id:'regeneration_250', name:'Régénération', desc:'Revit à 50% PV une fois',
      hooks:{ ON_SETUP: [{ type:'revive_mark', rate:0.50 }] } },
    70: { id:'flamme_eternelle_250', name:'Flamme Éternelle', desc:'Soigne 4% PV alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.04 }] } },
  },
  251: {
    35: { id:'voyage_temporel_251', name:'Voyage Temporel', desc:'+15% toutes stats',
      hooks:{ ON_SETUP: [{ type:'stat_boost', stats:['atk','spa','def','spd_def','spd'], mult:1.15 }] } },
    70: { id:'gardien_de_la_foret_251', name:'Gardien de la Forêt', desc:'Soigne 4% PV alliés / 8 actions',
      hooks:{ ON_PERIODIC: [{ type:'heal_all', rate:0.04 }] } },
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
export function getUnitPassives(pokemonId, level) {
  const all = POKEMON_PASSIVES[pokemonId];
  if (!all) return [];
  const result = [];
  if (level >= 35 && all[35]) result.push(all[35]);
  if (level >= 70 && all[70]) result.push(all[70]);
  return result;
}

export function getPokemonPassive(pokemonId, level) {
  const passives = getUnitPassives(pokemonId, level);
  return passives[passives.length - 1] ?? null;
}