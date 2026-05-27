// ─────────────────────────────────────────────────────────────────────────────
// moves.js — Capacités ultimes (1 par pokémon, déclenchées à 100 mana)
//
// Targets:
//   single         — 1 ennemi (rangée avant prioritaire)
//   row_front      — tous ennemis rangée avant
//   row_back       — tous ennemis rangée arrière
//   row_primary    — même rangée que la cible principale
//   all_enemies    — tous les ennemis
//   column         — même colonne que la cible
//   all_allies     — tous les alliés
//   self           — le lanceur
//   bounce_2       — rebondit sur 2 cibles distinctes
//   back_row_prio  — cible directement la rangée arrière
//   random_2       — 2 ennemis aléatoires
//   nearest_2      — 2 ennemis les plus proches
//   primary_adj    — cible principale + adjacents
//
// Effect kinds:
//   status         — applique statut { status, chance, who:'primary'|'all' }
//   stat           — modifie stat { who, stat, mult, turns?, permanent? }
//   drain          — soigne attaquant { rate }
//   recoil         — blesse attaquant { rate }
//   heal           — soigne { who:'self'|'all_allies'|'allies_water'|'random_ally', rate }
//   ko             — KO instantané { chance }
//   sacrifice      — attaquant meurt après
//   coins          — donne pièces { amount }
//   skip_next      — skip prochain tour self
//   shield         — bouclier absorbant { who }
//   clear_buffs    — supprime buffs ennemis
//   push_back      — envoie cible en rangée arrière
//   untargetable   — intouchable { turns }
//   delayed_sleep  — sommeil au tour suivant
//   copy_enemy     — copie le pokémon ennemi le plus fort (Métamorph)
//   trigger_ally   — déclenche la capacité d'un allié { count }
//   rage_stack     — boost cumulatif { stat, mult, maxStacks }
//   fixed_hp_pct   — dégâts fixes % HP max { rate }
//   ignore_type    — ignore résistances de type
//   guaranteed_crit — critique garanti
//   random_stat_boost — boost aléatoire d'une stat { mult }
//   aoe_secondary  — second hit AoE { basePower, type, target }
// ─────────────────────────────────────────────────────────────────────────────

export const MOVES = {

  // ── Plante ────────────────────────────────────────────────────────────────
  fouet_lianes:         { name:"Fouet Lianes",     type:"Plante",   cat:"physical", bp:45,  target:"single",       drain:0.30 },
  tranch_herbe:         { name:"Tranch'Herbe",     type:"Plante",   cat:"physical", bp:55,  target:"row_front",    critBoost:true },
  lance_soleil:         { name:"Lance-Soleil",     type:"Plante",   cat:"special",  bp:120, target:"single" },
  lance_soleil_debuff:  { name:"Lance-Soleil",     type:"Plante",   cat:"special",  bp:120, target:"single",
    effects:[{kind:"stat",who:"target",stat:"def",mult:0.80,turns:2}] },
  lance_soleil_confus:  { name:"Lance-Soleil",     type:"Plante",   cat:"special",  bp:120, target:"row_front",
    effects:[{kind:"status",status:"confuse",chance:0.30,who:"all"}] },
  vampigoutte:          { name:"Vampigoutte",      type:"Plante",   cat:"special",  bp:40,  target:"single",       drain:0.30 },
  vampirisme:           { name:"Vampirisme",       type:"Plante",   cat:"special",  bp:75,  target:"single",       drain:0.50 },
  acide:                { name:"Acide",            type:"Poison",   cat:"special",  bp:40,  target:"single",
    effects:[{kind:"stat",who:"target",stat:"spd_def",mult:0.80,turns:2}] },
  acide_row:            { name:"Acide",            type:"Poison",   cat:"special",  bp:40,  target:"row_front",
    effects:[{kind:"stat",who:"all_targets",stat:"def",mult:0.85,turns:2}] },
  poudre_dodo:          { name:"Poudre Dodo",      type:"Plante",   cat:"status",   bp:0,   target:"random_2",
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"all"}] },
  poudre_dodo_row:      { name:"Poudre Dodo",      type:"Plante",   cat:"status",   bp:0,   target:"row_front",
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"all"}] },

  // ── Feu ───────────────────────────────────────────────────────────────────
  flam_meche:           { name:"Flammèche",        type:"Feu",      cat:"special",  bp:40,  target:"single",
    effects:[{kind:"status",status:"burn",chance:0.10,who:"primary"}] },
  flam_meche_sure:      { name:"Flammèche",        type:"Feu",      cat:"special",  bp:40,  target:"single",
    effects:[{kind:"status",status:"burn",chance:1.0,who:"primary"}] },
  crocs_de_feu:         { name:"Crocs de Feu",     type:"Feu",      cat:"physical", bp:65,  target:"single",
    effects:[{kind:"status",status:"burn",chance:0.10,who:"primary"}] },
  deflagration:         { name:"Déflagration",     type:"Feu",      cat:"special",  bp:110, target:"single" },
  deflagration_aoe:     { name:"Déflagration",     type:"Feu",      cat:"special",  bp:110, target:"row_front",
    effects:[{kind:"status",status:"burn",chance:0.10,who:"all"}] },
  deflagration_burn:    { name:"Déflagration",     type:"Feu",      cat:"special",  bp:110, target:"single",  powerMult:2.0,
    effects:[{kind:"status",status:"burn",chance:1.0,who:"primary"}] },
  deflagration_all:     { name:"Déflagration",     type:"Feu",      cat:"special",  bp:110, target:"all_enemies",
    effects:[{kind:"status",status:"burn",chance:1.0,who:"all"}] },
  lance_flammes:        { name:"Lance-Flammes",    type:"Feu",      cat:"special",  bp:90,  target:"single",
    effects:[{kind:"status",status:"burn",chance:0.30,who:"primary"}] },
  lance_flammes_row:    { name:"Lance-Flammes",    type:"Feu",      cat:"special",  bp:90,  target:"row_front",
    effects:[{kind:"status",status:"burn",chance:0.30,who:"all"}] },
  lance_flammes_x2:     { name:"Lance-Flammes",    type:"Feu",      cat:"special",  bp:90,  target:"bounce_2",
    effects:[{kind:"status",status:"burn",chance:1.0,who:"all"}] },
  boutefeu:             { name:"Boutefeu",         type:"Feu",      cat:"physical", bp:120, target:"row_front", recoil:0.33,
    effects:[{kind:"status",status:"burn",chance:0.50,who:"all"}] },
  nitro_charge:         { name:"Nitro Charge",     type:"Feu",      cat:"physical", bp:50,  target:"single",
    effects:[{kind:"stat",who:"self",stat:"spd",mult:1.20,permanent:true}] },

  // ── Eau ───────────────────────────────────────────────────────────────────
  pistolet_o:           { name:"Pistolet à O",     type:"Eau",      cat:"special",  bp:40,  target:"single",
    effects:[{kind:"stat",who:"target",stat:"spd",mult:0.75,turns:2}] },
  pistolet_o_slow:      { name:"Pistolet à O",     type:"Eau",      cat:"special",  bp:40,  target:"single",
    effects:[{kind:"stat",who:"target",stat:"spd",mult:0.60,turns:2}] },
  pistolet_o_debuff:    { name:"Pistolet à O",     type:"Eau",      cat:"special",  bp:40,  target:"all_enemies",
    effects:[{kind:"stat",who:"all_targets",stat:"atk",mult:0.85,turns:2},{kind:"stat",who:"all_targets",stat:"spd",mult:0.85,turns:2}] },
  aqua_queue:           { name:"Aqua-Queue",       type:"Eau",      cat:"physical", bp:90,  target:"single",    hits:2 },
  cascade:              { name:"Cascade",          type:"Eau",      cat:"physical", bp:80,  target:"single",    powerMult:1.2 },
  cascade_aoe:          { name:"Cascade",          type:"Eau",      cat:"physical", bp:80,  target:"all_enemies", powerMult:2.0,
    effects:[{kind:"untargetable",turns:1}] },
  hydrocanon:           { name:"Hydrocanon",       type:"Eau",      cat:"special",  bp:110, target:"single" },
  hydrocanon_pierce:    { name:"Hydrocanon",       type:"Eau",      cat:"special",  bp:110, target:"single",    ignoreDefPct:0.25 },
  hydrocanon_x2:        { name:"Hydrocanon",       type:"Eau",      cat:"special",  bp:110, target:"single",    powerMult:2.0 },
  hydrocanon_aoe:       { name:"Hydrocanon",       type:"Eau",      cat:"special",  bp:110, target:"all_enemies" },
  hydrocanon_aoe_debuff:{ name:"Hydrocanon",       type:"Eau",      cat:"special",  bp:110, target:"all_enemies",
    effects:[{kind:"stat",who:"all_targets",stat:"spd_def",mult:0.80,permanent:true}] },
  surf:                 { name:"Surf",             type:"Eau",      cat:"special",  bp:90,  target:"all_enemies" },
  surf_heal:            { name:"Surf",             type:"Eau",      cat:"special",  bp:90,  target:"all_enemies",
    effects:[{kind:"heal",who:"allies_water",rate:0.15}] },
  koud_korne:           { name:"Koud'Korne",       type:"Eau",      cat:"physical", bp:65,  target:"single",    powerMult:1.5 },
  bulles_o:             { name:"Bulles d'O",       type:"Eau",      cat:"special",  bp:65,  target:"single",
    effects:[{kind:"heal",who:"random_ally",rate:0.15}] },
  coqui_lame_immo:      { name:"Coqui-Lame",       type:"Eau",      cat:"physical", bp:75,  target:"single",
    effects:[{kind:"status",status:"stun",chance:1.0,who:"primary"}] },
  coqui_lame_drain:     { name:"Coqui-Lame",       type:"Eau",      cat:"physical", bp:75,  target:"single",    hits:2, drain:0.35 },

  // ── Électrik ──────────────────────────────────────────────────────────────
  tonnerre_single:      { name:"Tonnerre",         type:"Électrik", cat:"special",  bp:110, target:"single",
    effects:[{kind:"status",status:"paralyze",chance:0.30,who:"primary"},{kind:"splash_adj",rate:0.20}] },
  tonnerre_row:         { name:"Tonnerre",         type:"Électrik", cat:"special",  bp:110, target:"row_front",
    effects:[{kind:"status",status:"paralyze",chance:1.0,who:"all"}] },
  tonnerre_all_50:      { name:"Tonnerre",         type:"Électrik", cat:"special",  bp:110, target:"all_enemies",
    effects:[{kind:"status",status:"paralyze",chance:0.50,who:"all"}] },
  tonnerre_para_all:    { name:"Tonnerre",         type:"Électrik", cat:"special",  bp:110, target:"all_enemies",
    effects:[{kind:"status",status:"paralyze",chance:1.0,who:"all"}] },
  tonnerre_crit_para:   { name:"Tonnerre",         type:"Électrik", cat:"special",  bp:110, target:"single",
    effects:[{kind:"guaranteed_crit"},{kind:"status",status:"paralyze",chance:1.0,who:"primary"}] },
  cage_eclair_row:      { name:"Cage Éclair",      type:"Électrik", cat:"special",  bp:90,  target:"row_front",
    effects:[{kind:"status",status:"paralyze",chance:1.0,who:"all"}] },
  poing_eclair:         { name:"Poing Éclair",     type:"Électrik", cat:"physical", bp:75,  target:"single",
    effects:[{kind:"status",status:"paralyze",chance:0.50,who:"primary"}] },

  // ── Glace ─────────────────────────────────────────────────────────────────
  laser_glace:          { name:"Laser Glace",      type:"Glace",    cat:"special",  bp:90,  target:"single",
    effects:[{kind:"status",status:"freeze",chance:0.10,who:"primary"}] },
  laser_glace_aoe:      { name:"Laser Glace",      type:"Glace",    cat:"special",  bp:90,  target:"all_enemies",
    effects:[{kind:"status",status:"freeze",chance:0.30,who:"all"}] },
  blizzard_aoe:         { name:"Blizzard",         type:"Glace",    cat:"special",  bp:110, target:"all_enemies",
    effects:[{kind:"status",status:"freeze",chance:0.20,who:"all"}] },
  blizzard_freeze_all:  { name:"Blizzard",         type:"Glace",    cat:"special",  bp:110, target:"all_enemies",
    effects:[{kind:"status",status:"freeze",chance:1.0,who:"all"}] },

  // ── Psy ───────────────────────────────────────────────────────────────────
  psyko:                { name:"Psyko",            type:"Psy",      cat:"special",  bp:90,  target:"single" },
  psyko_debuff:         { name:"Psyko",            type:"Psy",      cat:"special",  bp:90,  target:"single",
    effects:[{kind:"stat",who:"target",stat:"spd_def",mult:0.80,turns:2}] },
  psyko_confus:         { name:"Psyko",            type:"Psy",      cat:"special",  bp:90,  target:"single", powerMult:2.5,
    effects:[{kind:"status",status:"confuse",chance:1.0,who:"primary"}] },
  psyko_all:            { name:"Psyko",            type:"Psy",      cat:"special",  bp:90,  target:"all_enemies", powerMult:3.0,
    effects:[{kind:"status",status:"confuse",chance:0.50,who:"all"}] },
  psyko_surf:           { name:"Psyko + Surf",     type:"Psy",      cat:"special",  bp:90,  target:"single", powerMult:1.5,
    aoeSecondary:{bp:60,type:"Eau",target:"all_enemies"} },
  extrasenseur:         { name:"Extrasenseur",     type:"Psy",      cat:"special",  bp:80,  target:"row_front" },
  telekinesis:          { name:"Télékinésie",      type:"Psy",      cat:"status",   bp:0,   target:"single",
    effects:[{kind:"stat",who:"target",stat:"spd",mult:0.70,turns:2},{kind:"stat",who:"target",stat:"def",mult:0.85,turns:2}] },
  telekinesis_boost:    { name:"Télékinésie",      type:"Psy",      cat:"status",   bp:0,   target:"all_enemies",
    effects:[{kind:"stat",who:"all_targets",stat:"spd",mult:0.70,turns:2},{kind:"stat",who:"self",stat:"spa",mult:1.30,permanent:true}] },
  teleport:             { name:"Téléport",         type:"Psy",      cat:"status",   bp:0,   target:"self",
    effects:[{kind:"untargetable",turns:1}] },
  tranche_psy:          { name:"Tranche Psy",      type:"Psy",      cat:"special",  bp:70,  target:"single", ignoreType:true },
  hypnose:              { name:"Hypnose",          type:"Psy",      cat:"status",   bp:0,   target:"single",
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"primary"}] },
  hypnose_2:            { name:"Hypnose",          type:"Psy",      cat:"status",   bp:0,   target:"random_2",
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"all"}] },
  morphee:              { name:"Morphée",          type:"Psy",      cat:"special",  bp:100, target:"single",  drain:0.30,
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"primary"}] },
  amnesie:              { name:"Amnésie",          type:"Psy",      cat:"status",   bp:0,   target:"self",
    effects:[{kind:"stat",who:"self",stat:"spd_def",mult:1.50,turns:2},{kind:"stat",who:"self",stat:"spa",mult:1.30,turns:2}] },
  mur_lumiere:          { name:"Mur Lumière",      type:"Psy",      cat:"status",   bp:0,   target:"all_allies",
    effects:[{kind:"stat",who:"all_allies",stat:"spd_def",mult:1.40,turns:2}] },

  // ── Spectre ───────────────────────────────────────────────────────────────
  ball_ombre:           { name:"Ball'Ombre",       type:"Spectre",  cat:"special",  bp:80,  target:"single",  ignoreType:true },
  ball_ombre_push:      { name:"Ball'Ombre",       type:"Spectre",  cat:"special",  bp:80,  target:"single",  hits:2, ignoreType:true,
    effects:[{kind:"push_back"}] },

  // ── Poison ────────────────────────────────────────────────────────────────
  dard_venin:           { name:"Dard-Venin",       type:"Poison",   cat:"physical", bp:15,  target:"single",
    effects:[{kind:"status",status:"poison",chance:1.0,who:"primary"}] },
  dard_venin_30:        { name:"Dard-Venin",       type:"Poison",   cat:"physical", bp:65,  target:"single",
    effects:[{kind:"status",status:"poison",chance:0.30,who:"primary"}] },
  dard_venin_50:        { name:"Dard-Venin",       type:"Poison",   cat:"physical", bp:65,  target:"single",
    effects:[{kind:"status",status:"poison",chance:0.50,who:"primary"}] },
  bombe_beurk_row:      { name:"Bombe Beurk",      type:"Poison",   cat:"special",  bp:90,  target:"row_front",
    effects:[{kind:"status",status:"poison",chance:0.30,who:"all"}] },
  bombe_beurk_all:      { name:"Bombe Beurk",      type:"Poison",   cat:"special",  bp:90,  target:"all_enemies",
    effects:[{kind:"status",status:"poison",chance:0.50,who:"all"}] },
  bombe_beurk_brouillard: { name:"Bombe Beurk",   type:"Poison",   cat:"special",  bp:90,  target:"all_enemies",
    effects:[{kind:"status",status:"poison",chance:0.50,who:"all"},{kind:"clear_buffs",who:"all_enemies"}] },
  cradovague:           { name:"Cradovague",       type:"Poison",   cat:"special",  bp:95,  target:"all_enemies",
    effects:[{kind:"status",status:"poison",chance:0.50,who:"all"}] },
  poudre_toxik:         { name:"Poudre Toxik",     type:"Poison",   cat:"status",   bp:0,   target:"single",
    effects:[{kind:"status",status:"poison",chance:1.0,who:"primary"}] },
  poudre_toxik_2:       { name:"Poudre Toxik",     type:"Poison",   cat:"status",   bp:0,   target:"nearest_2",
    effects:[{kind:"status",status:"poison",chance:1.0,who:"all"}] },

  // ── Insecte ───────────────────────────────────────────────────────────────
  dard_nuee:            { name:"Dard-Nuée",        type:"Insecte",  cat:"physical", bp:25,  target:"random_3",  hits:3 },
  spore:                { name:"Spore",            type:"Insecte",  cat:"status",   bp:0,   target:"single",
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"primary"}] },
  spore_plus:           { name:"Spore",            type:"Insecte",  cat:"physical", bp:50,  target:"single",
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"primary"}] },
  secretion:            { name:"Sécrétion",        type:"Normal",   cat:"status",   bp:0,   target:"all_enemies",
    effects:[{kind:"stat",who:"all_targets",stat:"spd",mult:0.80,turns:2}] },
  armure:               { name:"Armure",           type:"Normal",   cat:"status",   bp:0,   target:"self",
    effects:[{kind:"stat",who:"self",stat:"def",mult:1.60,turns:2}] },

  // ── Vol ───────────────────────────────────────────────────────────────────
  tornade:              { name:"Tornade",          type:"Vol",      cat:"special",  bp:40,  target:"single",
    effects:[{kind:"status",status:"confuse",chance:0.30,who:"primary"}] },
  cru_ailes:            { name:"Cru-Ailes",        type:"Vol",      cat:"physical", bp:60,  target:"column" },
  vent_violent:         { name:"Vent Violent",     type:"Vol",      cat:"special",  bp:110, target:"all_enemies",
    effects:[{kind:"status",status:"confuse",chance:0.30,who:"all"}] },
  taillade:             { name:"Taillade",         type:"Vol",      cat:"physical", bp:75,  target:"single",
    effects:[{kind:"guaranteed_crit"},{kind:"ignore_armor"}] },
  taillade_2:           { name:"Taillade",         type:"Vol",      cat:"physical", bp:75,  target:"bounce_2",
    effects:[{kind:"guaranteed_crit"}] },
  taillade_x3:          { name:"Taillade",         type:"Vol",      cat:"physical", bp:60,  target:"single",
    effects:[{kind:"guaranteed_crit"}] },
  aeropique:            { name:"Aéropique",        type:"Vol",      cat:"physical", bp:100, target:"back_row_prio" },
  picpic_2:             { name:"Picpic",           type:"Vol",      cat:"physical", bp:35,  target:"single",   hits:2 },
  picpic_3:             { name:"Picpic",           type:"Vol",      cat:"physical", bp:35,  target:"single",   hits:3 },

  // ── Normal ────────────────────────────────────────────────────────────────
  morsure:              { name:"Morsure",          type:"Normal",   cat:"physical", bp:60,  target:"single",
    effects:[{kind:"stat",who:"target",stat:"def",mult:0.85,turns:2}] },
  croc_de_mort:         { name:"Croc de Mort",     type:"Normal",   cat:"physical", bp:80,  target:"single",
    effects:[{kind:"guaranteed_crit"}] },
  tranche:              { name:"Tranche",          type:"Normal",   cat:"physical", bp:50,  target:"primary_adj" },
  tranche_jackpot:      { name:"Tranche",          type:"Normal",   cat:"physical", bp:50,  target:"single",
    effects:[{kind:"guaranteed_crit"},{kind:"coins",amount:1}] },
  ecrasement:           { name:"Écrasement",       type:"Normal",   cat:"physical", bp:65,  target:"row_front", powerMult:1.3 },
  plaquage:             { name:"Plaquage",         type:"Normal",   cat:"physical", bp:85,  target:"row_front", powerMult:2.0,
    effects:[{kind:"heal",who:"self",rate:0.20}] },
  triplataque:          { name:"Triplataque",      type:"Normal",   cat:"physical", bp:45,  target:"single",   hits:3 },
  pilonnage:            { name:"Pilonnage",        type:"Normal",   cat:"physical", bp:65,  target:"single",   hitsRandom:[2,5] },
  jackpot:              { name:"Jackpot",          type:"Normal",   cat:"physical", bp:40,  target:"single",
    effects:[{kind:"coins",amount:2}] },
  jackpot_def:          { name:"Jackpot",          type:"Normal",   cat:"physical", bp:40,  target:"single",
    effects:[{kind:"stat",who:"self",stat:"def",mult:1.30,permanent:true},{kind:"coins",amount:1}] },
  lechouille:           { name:"Léchouille",       type:"Normal",   cat:"physical", bp:30,  target:"single",   drain:0.50 },
  ligotage:             { name:"Ligotage",         type:"Normal",   cat:"physical", bp:15,  target:"single",   drain:0.30,
    effects:[{kind:"status",status:"stun",chance:1.0,who:"primary",turns:2}] },
  berceuse:             { name:"Berceuse",         type:"Normal",   cat:"status",   bp:0,   target:"single",
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"primary"}] },
  berceuse_all:         { name:"Berceuse",         type:"Normal",   cat:"status",   bp:0,   target:"all_enemies",
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"all"}] },
  berceuse_drain:       { name:"Berceuse",         type:"Normal",   cat:"status",   bp:0,   target:"row_front", drain:0.30,
    effects:[{kind:"status",status:"sleep",chance:1.0,who:"all"}] },
  agilite:              { name:"Agilité",          type:"Psy",      cat:"status",   bp:0,   target:"all_allies",
    effects:[{kind:"stat",who:"all_allies",stat:"spd",mult:1.25,turns:2}] },
  rugissement:          { name:"Rugissement",      type:"Normal",   cat:"status",   bp:0,   target:"all_enemies",
    effects:[{kind:"stat",who:"all_targets",stat:"atk",mult:0.85,permanent:true}] },
  intimidation_move:    { name:"Intimidation",     type:"Normal",   cat:"status",   bp:0,   target:"all_enemies",
    effects:[{kind:"stat",who:"all_targets",stat:"atk",mult:0.75,permanent:true},{kind:"stat",who:"all_targets",stat:"spa",mult:0.75,permanent:true}] },
  soin:                 { name:"Soin",             type:"Normal",   cat:"status",   bp:0,   target:"all_allies",
    effects:[{kind:"heal",who:"all_allies",rate:0.40}] },
  protection:           { name:"Protection",       type:"Normal",   cat:"status",   bp:0,   target:"all_allies",
    effects:[{kind:"shield",who:"all_allies"}] },
  baillement:           { name:"Bâillement",       type:"Normal",   cat:"status",   bp:0,   target:"single",
    effects:[{kind:"delayed_sleep"}] },
  doux_parfum:          { name:"Doux Parfum",      type:"Normal",   cat:"status",   bp:0,   target:"all_enemies",
    effects:[{kind:"stat",who:"all_targets",stat:"spd",mult:0.75,turns:2}] },
  cadeau:               { name:"Cadeau",           type:"Normal",   cat:"status",   bp:0,   target:"self",
    effects:[{kind:"random_stat_boost",mult:1.30}] },

  // ── Combat ────────────────────────────────────────────────────────────────
  poing_dynamique:      { name:"Poing Dynamique",  type:"Combat",   cat:"physical", bp:100, target:"single",
    effects:[{kind:"status",status:"confuse",chance:0.50,who:"primary"}] },
  soumission:           { name:"Soumission",       type:"Combat",   cat:"physical", bp:80,  target:"single",  powerMult:2.0, recoil:0.25 },
  ultimapoing:          { name:"Ultimapoing",      type:"Combat",   cat:"physical", bp:40,  target:"single",  hits:4, priority:1 },
  ultimawashi:          { name:"Ultimawashi",      type:"Combat",   cat:"physical", bp:130, target:"back_row_prio", hits:2 },
  tripoing:             { name:"Tripoing",         type:"Combat",   cat:"physical", bp:30,  target:"single",  hits:3 },
  martopoing:           { name:"Martopoing",       type:"Combat",   cat:"physical", bp:100, target:"single",
    effects:[{kind:"rage_stack",stat:"atk",mult:1.15,maxStacks:3,who:"self"}] },
  coup_bas:             { name:"Coup Bas",         type:"Ténèbres", cat:"physical", bp:70,  target:"single",
    effects:[{kind:"stat",who:"target",stat:"atk",mult:0.70,turns:2}] },

  // ── Sol ───────────────────────────────────────────────────────────────────
  seisme:               { name:"Séisme",           type:"Sol",      cat:"physical", bp:100, target:"all_enemies" },
  seisme_debuff:        { name:"Séisme",           type:"Sol",      cat:"physical", bp:100, target:"all_enemies",
    effects:[{kind:"stat",who:"all_targets",stat:"def",mult:0.80,permanent:true}] },
  seisme_strong:        { name:"Séisme",           type:"Sol",      cat:"physical", bp:100, target:"all_enemies", powerMult:1.8,
    effects:[{kind:"stat",who:"all_targets",stat:"def",mult:0.75,turns:2}] },
  tunnel:               { name:"Tunnel",           type:"Sol",      cat:"physical", bp:80,  target:"single",
    effects:[{kind:"untargetable",turns:1},{kind:"stat",who:"self",stat:"def",mult:1.50,turns:1}] },
  tunnel_aoe:           { name:"Tunnel",           type:"Sol",      cat:"physical", bp:80,  target:"all_enemies",
    effects:[{kind:"untargetable",turns:1}] },

  // ── Nouveaux moves ajoutés pour corriger stat ATK/SPA ──────────────────────
  vol_vie:      { name:"Vol-Vie",       type:"Plante",   cat:"special",  bp:80,  target:"single",
    drain:0.50, effects:[{kind:"heal",who:"self",rate:0.50}] },
  giga_sangsue: { name:"Giga-Sangsue",  type:"Plante",   cat:"special",  bp:75,  target:"all_enemies",
    drain:0.50 },
  canicule:     { name:"Canicule",      type:"Feu",      cat:"special",  bp:100, target:"all_enemies", powerMult:1.0,
    effects:[{kind:"status",who:"all",status:"burn",chance:0.30,turns:3}] },
  balle_elek:   { name:"Balle Élek",    type:"Électrik", cat:"special",  bp:90,  target:"bounce_2" },
  elec_tacle:   { name:"Élek'Tacle",    type:"Électrik", cat:"physical", bp:85,  target:"single",
    effects:[{kind:"status",who:"target",status:"paralyze",chance:0.30}] },
  rapace:       { name:"Rapace",        type:"Vol",      cat:"physical", bp:90,  target:"back_row_prio",
    effects:[{kind:"stat",who:"self",stat:"spd",mult:1.30,turns:2}] },
  crocs_feu:    { name:"Crocs de Feu",  type:"Feu",      cat:"physical", bp:80,  target:"single",
    effects:[{kind:"status",who:"target",status:"burn",chance:0.25,turns:3}] },
  roue_de_feu:  { name:"Roue de Feu",   type:"Feu",      cat:"physical", bp:85,  target:"row_front",
    effects:[{kind:"status",who:"all",status:"burn",chance:0.20,turns:3}] },
  machouille:   { name:"Machouille",    type:"Normal",   cat:"physical", bp:80,  target:"single",
    hits:3, hitsRandom:[2,3] },
  ultralaser_p: { name:"Ultralaser",    type:"Normal",   cat:"physical", bp:130, target:"single",
    effects:[{kind:"skip_next"}] },
  osmerang:             { name:"Osmerang",         type:"Sol",      cat:"physical", bp:50,  target:"bounce_2",  hits:2 },
  ruee_os:              { name:"Osmerang",        type:"Sol",      cat:"physical", bp:25,  target:"single",   hits:3, ignoreDefPct:0.30 },

  // ── Roche ─────────────────────────────────────────────────────────────────
  jet_de_roc:           { name:"Jet de Roc",       type:"Roche",    cat:"physical", bp:50,  target:"single",
    effects:[{kind:"stat",who:"self",stat:"def",mult:1.20,turns:2}] },
  jet_de_roc_slow:      { name:"Jet de Roc",       type:"Roche",    cat:"physical", bp:50,  target:"all_enemies",
    effects:[{kind:"stat",who:"all_targets",stat:"spd",mult:0.60,turns:2}] },
  jet_de_roc_perm:      { name:"Jet de Roc",       type:"Roche",    cat:"physical", bp:50,  target:"single",
    effects:[{kind:"stat",who:"self",stat:"def",mult:1.25,permanent:true}] },
  roulade:              { name:"Roulade",          type:"Roche",    cat:"physical", bp:90,  target:"row_front", powerMult:1.5 },
  roulade_forte:        { name:"Roulade",          type:"Roche",    cat:"physical", bp:90,  target:"row_front", powerMult:2.0, recoil:0.20 },

  // ── Dragon ────────────────────────────────────────────────────────────────
  draco_rage:           { name:"Draco-Rage",       type:"Dragon",   cat:"special",  bp:1,   target:"single",
    effects:[{kind:"fixed_hp_pct",rate:0.40}] },
  draco_meteore:        { name:"Draco-Météore",    type:"Dragon",   cat:"mixed",   bp:130, target:"all_enemies", powerMult:1.25,
    mixedSplit: 0.5 },  // 50% ATK physique + 50% SpATK — sans drop de stat

  // ── Spéciaux ──────────────────────────────────────────────────────────────
  ultralaser:           { name:"Ultralaser",       type:"Normal",   cat:"special",  bp:150, target:"single",  powerMult:3.0,
    effects:[{kind:"skip_next"}] },
  explosion:            { name:"Explosion",        type:"Normal",   cat:"physical", bp:250, target:"all_enemies", powerMult:3.0,
    effects:[{kind:"sacrifice"}] },
  explosion_forte:      { name:"Explosion",        type:"Normal",   cat:"physical", bp:250, target:"all_enemies", powerMult:4.0, priority:2,
    effects:[{kind:"sacrifice"}] },
  guillotine:           { name:"Guillotine",       type:"Normal",   cat:"physical", bp:1,   target:"single",
    effects:[{kind:"ko",chance:0.25}] },
  guillotine_30:        { name:"Guillotine",       type:"Normal",   cat:"physical", bp:1,   target:"single",
    effects:[{kind:"ko",chance:0.30}] },
  pince_masse:          { name:"Pince-Masse",      type:"Eau",      cat:"physical", bp:100, target:"single",   ignoreDefPct:0.50 },
  pince_masse_ko:       { name:"Pince-Masse",      type:"Eau",      cat:"physical", bp:100, target:"single",
    effects:[{kind:"ko",chance:0.30}] },
  trempette:            { name:"Trempette",        type:"Eau",      cat:"special",  bp:1,   target:"single",
    effects:[{kind:"rage_stack",stat:"atk",mult:1.20,maxStacks:5,who:"self"}] },
  belier:               { name:"Bélier",           type:"Normal",   cat:"physical", bp:85,  target:"single",  powerMult:1.5, recoil:0.25 },
  belier_row:           { name:"Bélier",           type:"Normal",   cat:"physical", bp:85,  target:"row_front", recoil:0.10 },
  belier_rage:          { name:"Bélier",           type:"Normal",   cat:"physical", bp:90,  target:"single",  powerMult:1.5, recoil:0.10,
    effects:[{kind:"stat",who:"self",stat:"atk",mult:1.30,permanent:true}] },
  eclat_magique:        { name:"Éclat Magique",    type:"Fée",      cat:"special",  bp:95,  target:"all_enemies",
    effects:[{kind:"status",status:"sleep",chance:0.50,who:"all"}] },
  enroulement:          { name:"Enroulement",      type:"Poison",   cat:"status",   bp:0,   target:"self",
    effects:[{kind:"stat",who:"self",stat:"atk",mult:1.40,turns:2}] },
  transformation:       { name:"Transformation",  type:"Normal",   cat:"status",   bp:0,   target:"self",
    effects:[{kind:"copy_enemy"}] },
  metronome:            { name:"Métronome",        type:"Normal",   cat:"status",   bp:0,   target:"self",
    effects:[{kind:"trigger_ally",count:1}] },
  metronome_x2:         { name:"Métronome",        type:"Normal",   cat:"status",   bp:0,   target:"self",
    effects:[{kind:"trigger_ally",count:2}] },
};

// ─────────────────────────────────────────────────────────────────────────────
// POKEMON_MOVES — mapping pokédex ID → move key
// ─────────────────────────────────────────────────────────────────────────────
export const POKEMON_MOVES = {
   1:"vol_vie",       2:"giga_sangsue",       3:"lance_soleil",
   4:"flam_meche",         5:"canicule",        6:"deflagration_aoe",
   7:"pistolet_o",         8:"aqua_queue",          9:"hydrocanon_pierce",
  10:"secretion",         11:"armure",             12:"poudre_dodo",
  13:"dard_venin",        14:"armure",             15:"dard_nuee",
  16:"tornade",           17:"cru_ailes",          18:"rapace",
  19:"morsure",           20:"croc_de_mort",       21:"picpic_3",
  22:"taillade",          23:"enroulement",        24:"intimidation_move",
  25:"elec_tacle",   26:"elec_tacle",       27:"agilite",
  28:"tranche",           29:"dard_venin",         30:"rugissement",
  31:"seisme",            32:"dard_venin_30",      33:"dard_venin_50",
  34:"seisme_debuff",     35:"berceuse",           36:"metronome",
  37:"flam_meche",        38:"deflagration_burn",  39:"berceuse_all",
  40:"eclat_magique",     41:"vampigoutte",        42:"machouille",
  43:"poudre_toxik_2",    44:"acide",              45:"poudre_dodo_row",
  46:"spore",             47:"spore_plus",         48:"poudre_toxik",
  49:"extrasenseur",      50:"tunnel",             51:"tunnel_aoe",
  52:"jackpot",           53:"tranche_jackpot",    54:"telekinesis",
  55:"telekinesis_boost", 56:"coup_bas",           57:"martopoing",
  58:"crocs_feu",        59:"boutefeu",           60:"pistolet_o_slow",
  61:"hypnose",           62:"belier",             63:"teleport",
  64:"psyko_debuff",      65:"psyko_confus",       66:"poing_dynamique",
  67:"soumission",        68:"ultimapoing",        69:"tranch_herbe",
  70:"doux_parfum",       71:"lance_soleil_debuff",72:"acide_row",
  73:"hydrocanon_aoe_debuff", 74:"jet_de_roc",     75:"roulade",
  76:"roulade_forte",     77:"roue_de_feu",    78:"nitro_charge",
  79:"baillement",        80:"amnesie",            81:"cage_eclair_row",
  82:"tonnerre_all_50",   83:"taillade_x3",        84:"picpic_2",
  85:"triplataque",       86:"blizzard_aoe",       87:"laser_glace",
  88:"bombe_beurk_row",   89:"cradovague",         90:"jackpot_def",
  91:"pince_masse",       92:"ball_ombre",         93:"morphee",
  94:"ball_ombre_push",   95:"jet_de_roc_slow",    96:"hypnose_2",
  97:"berceuse_drain",    98:"coqui_lame_immo",    99:"pince_masse_ko",
 100:"poing_eclair",        101:"balle_elek",   102:"vol_vie",
 103:"lance_soleil_confus", 104:"osmerang",        105:"ruee_os",
 106:"ultimawashi",      107:"tripoing",           108:"ultralaser_p",
 109:"bombe_beurk_row",  110:"bombe_beurk_brouillard", 111:"belier_row",
 112:"seisme_strong",    113:"soin",              114:"ligotage",
 115:"ecrasement",       116:"pistolet_o_slow",   117:"hydrocanon_x2",
 118:"cascade",          119:"koud_korne",         120:"bulles_o",
 121:"psyko_surf",       122:"mur_lumiere",        123:"taillade_2",
 124:"protection",       125:"poing_eclair",       126:"lance_flammes_row",
 127:"guillotine",       128:"belier_rage",        129:"trempette",
 130:"cascade_aoe",      131:"laser_glace_aoe",    132:"transformation",
 133:"cadeau",           134:"surf_heal",          135:"tonnerre_crit_para",
 136:"lance_flammes_x2", 137:"tranche_psy",        138:"pistolet_o_debuff",
 139:"hydrocanon_aoe",   140:"jet_de_roc_perm",    141:"coqui_lame_drain",
 142:"aeropique",        143:"plaquage",           144:"blizzard_freeze_all",
 145:"tonnerre_para_all",146:"deflagration_all",   147:"draco_rage",
 148:"ultralaser",       149:"draco_meteore",      150:"psyko_all",
 151:"metronome_x2",
};

export function getMove(pokemonId) {
  const key = POKEMON_MOVES[pokemonId];
  return key ? { ...MOVES[key], id: key } : null;
}