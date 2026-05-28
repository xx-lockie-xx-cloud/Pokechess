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
    35: { id:'brasier', name:'Brasier', desc:'Si PV<50% → +20% ATK',
      hooks:{ ON_ACTION: [{ type:'conditional_stat', stat:'atk', mult:1.20, condition:'hp_below', threshold:0.50 }] } },
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
    35: { id:'explosion_g', name:'Explosion', desc:'À la mort → AoE 80% HP',
      hooks:{ ON_DEATH: [{ type:'aoe_damage', rate:0.80 }] } },
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
    70: { id:'autodestruct', name:'Autodestruction', desc:'À la mort → AoE 80% HP',
      hooks:{ ON_DEATH: [{ type:'aoe_damage', rate:0.80 }] } },
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
    35: { id:'coud_pied', name:'Coud\'Pied', desc:'Frappe bonus à 50% puissance',
      hooks:{ ON_ATTACK: [{ type:'bonus_hit', mult:0.50 }] } },
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
    35: { id:'furie_r2', name:'Furie', desc:'+5% ATK par coup reçu',
      hooks:{ ON_RECEIVE: [{ type:'rage', stat:'atk', rate:0.05, max:0.50 }] } },
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