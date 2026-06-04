# PokeChess

Un **autochess roguelite** inspiré de l'univers Pokémon et du genre auto-battler (façon Teamfight Tactics / Super Auto Pets). Compose une équipe, exploite les synergies de types, traverse une carte à embranchements et bats les Champions de chaque arène jusqu'à la Ligue.

Le jeu tourne entièrement dans le navigateur en HTML/CSS/JavaScript pur (modules ES, sans framework ni bundler) et se joue aussi bien sur ordinateur que sur mobile.

---

## Sommaire

- [Aperçu du gameplay](#aperçu-du-gameplay)
- [Lancer le jeu](#lancer-le-jeu)
- [Boucle de jeu](#boucle-de-jeu)
- [Systèmes principaux](#systèmes-principaux)
- [Difficultés](#difficultés)
- [Reliques](#reliques)
- [Succès](#succès)
- [Architecture du code](#architecture-du-code)
- [Sauvegarde et mode dev](#sauvegarde-et-mode-dev)

---

## Aperçu du gameplay

Chaque partie (appelée **épopée**) commence par le choix d'un starter et, selon le mode, d'une **relique** qui modifie profondément les règles. On progresse ensuite de carte en carte : chaque carte est un graphe de nœuds (combats sauvages, boutiques, objets, dresseurs) menant à un **boss d'arène**. Vaincre le boss débloque la carte suivante. La huitième arène est la **Ligue**, point culminant de l'épopée, suivie d'un mode sans fin.

Les combats sont automatiques : on prépare son équipe et son placement, puis on lance le combat et on observe la résolution tour par tour via un système ATB (barres de vitesse), avec mana, capacités ultimes, passifs et synergies de types.

---

## Lancer le jeu

Le projet est constitué de fichiers statiques, aucune compilation n'est nécessaire.

En local, il suffit de servir le dossier avec n'importe quel serveur statique, par exemple l'extension **Live Server** de VS Code, ou en ligne de commande :

```bash
# Python
python3 -m http.server 8000

# ou Node
npx serve
```

Puis ouvrir `http://localhost:8000` dans le navigateur. Le jeu est également déployé via GitHub Pages.

> Note : comme le jeu utilise les modules ES (`import`/`export`), il doit être servi par un serveur HTTP. L'ouverture directe du fichier `index.html` (protocole `file://`) ne fonctionnera pas.

---

## Boucle de jeu

1. **Choix du starter** — un Pokémon de départ parmi plusieurs proposés.
2. **Relique** (selon le mode) — un modificateur de règles pour toute l'épopée.
3. **Navigation sur la carte** — on choisit son chemin parmi les nœuds disponibles.
4. **Nœuds rencontrés** :
   - *Rencontre sauvage* : capturer un Pokémon contre des pièces.
   - *Boutique* : acheter des objets à équiper.
   - *Objet* : récupérer un objet.
   - *Dresseur / Boss* : combat contre une équipe adverse.
5. **Préparation au combat** — placement des Pokémons sur le plateau, équipement d'objets, gestion des synergies.
6. **Combat automatique** — résolution ATB observable.
7. **Victoire d'arène** — badge obtenu, point de talent, carte suivante débloquée.
8. **Ligue puis mode sans fin** — difficulté croissante via des courbes exponentielles.

---

## Systèmes principaux

### Synergies de types

Aligner plusieurs Pokémons d'un même type active des bonus d'équipe (statistiques, effets de combat comme brûlure, régénération, paralysie…). Plus le nombre de Pokémons d'un type est élevé, plus le palier de synergie est fort. Les Pokémons légendaires (tier 5) comptent double dans le calcul des synergies.

### Combat ATB

Chaque Pokémon remplit une barre d'action proportionnelle à sa vitesse. Quand elle est pleine, il agit : attaque normale (du type du Pokémon) ou capacité ultime quand la barre de mana est pleine. Les bitypes alternent leur type d'attaque à chaque coup. Le journal de combat affiche chaque attaque dans la couleur de son type.

### Passifs

Chaque Pokémon dispose de passifs qui se débloquent selon son niveau, déclenchés par des *hooks* de combat (à la mort, en recevant des dégâts, à l'attaque, en préparation…).

### Objets

Des objets équipables modifient les statistiques ou ajoutent des effets. Ils s'achètent en boutique et se vendent depuis l'écran de préparation.

### Talents

Vaincre une arène octroie un point de talent à dépenser dans un arbre de progression persistant entre les parties.

---

## Difficultés

Quatre modes, débloqués progressivement, avec des courbes de budget ennemi de plus en plus agressives :

| Mode | Déblocage |
|------|-----------|
| **Facile** | Disponible d'entrée |
| **Normal** | Finir la Ligue en Facile |
| **Difficile** | Finir la Ligue en Normal |
| **Expert** | Finir la Ligue en Difficile avec une relique |

Le budget d'unités ennemies par carte suit une courbe exponentielle dont l'exposant et les bornes augmentent avec la difficulté.

---

## Reliques

Les reliques sont des modificateurs de règles choisis en début d'épopée (dans les modes qui les proposent). Il en existe **20**, réparties en catégories : économie, combat, synergies, information, progression et challenge.

Quelques exemples :

- **Loupe** — un emplacement de boutique supplémentaire.
- **Bourse Dorée** — pièces bonus à chaque victoire.
- **Pacte de Sang** — toutes les unités gagnent en attaque mais perdent des PV.
- **Bénédiction** — toutes les unités gagnent des PV mais perdent en attaque.
- **Sablier** — combat limité en nombre d'actions par camp.
- **Miroir** — toutes les synergies sont amplifiées.
- **Couronne** — le Pokémon au meilleur total de stats reçoit des synergies doublées.
- **Cristal Pur** — les Pokémons monotypes comptent double dans les synergies.
- **Anomalie** — tous les types des Pokémons sont réattribués aléatoirement selon la seed.
- **Doppelgänger** — chaque capture donne deux Pokémons mais coûte le double.

Chaque relique est définie de façon déclarative via un système de **hooks** (voir `relics.js` et `RelicEngine.js`), ce qui rend l'ajout de nouvelles reliques simple et centralisé.

---

## Succès

Le jeu propose de nombreux succès répartis par catégories (Ligue, Progression, Collection, Niveaux, Combat, Roguelite, Reliques), dont une série dédiée : finir la Ligue en Difficile ou plus avec chacune des reliques. Les succès sont consultables depuis le menu principal et depuis le Pokédex.

---

## Architecture du code

Le projet n'utilise aucun framework : tout repose sur des modules ES vanilla. L'interface est gérée écran par écran par un `UIManager` central.

```
index.html              Point d'entrée et structure DOM
src/
├── game.js             Bootstrap : crée le registre d'état et lance UIManager
├── SaveManager.js      Sauvegarde/chargement (localStorage), méta, stats, succès
│
├── data/
│   ├── pokemons.js     Les 151 Pokémons et leurs stats de base
│   ├── moves.js        Capacités ultimes
│   ├── typeChart.js    Table d'efficacité des types
│   ├── synergies.js    Calcul des synergies et des stats finales
│   ├── evolutionData.js Évolutions
│   ├── items.js        Objets équipables
│   ├── relics.js       Définition déclarative des 20 reliques (hooks)
│   ├── arenas.js       Champions d'arène
│   ├── trainers.js     Dresseurs et archétypes
│   ├── passiveHooks.js Passifs des Pokémons (système de hooks)
│   ├── levelSystem.js  Difficultés et définitions des succès
│   ├── runState.js     État de la run (registre, seed, progression carte)
│   └── board.js        Dimensions du plateau
│
├── combat/
│   ├── CombatEngine.js Moteur ATB : mana, ultimes, dégâts, types
│   ├── PassiveEngine.js Dispatch des hooks de passifs
│   └── RelicEngine.js  Dispatch des hooks de reliques
│
├── map/
│   └── MapGenerator.js Génération déterministe des cartes (seed + index)
│
└── ui/
    ├── UIManager.js        Routeur d'écrans et header
    ├── StarterUI.js        Choix du starter
    ├── RelicUI.js          Choix de la relique
    ├── MapUI.js            Carte à embranchements
    ├── WildUI.js           Rencontres sauvages
    ├── ShopUI.js / ItemUI.js  Boutique et objets
    ├── PrepUI.js           Préparation au combat (placement, synergies)
    ├── CombatUI.js         Affichage du combat
    ├── ArenaVictoryUI.js   Écran de victoire d'arène
    ├── PokedexUI.js        Pokédex (types, synergies, capacités, reliques, succès)
    ├── AchievementsUI.js   Succès
    ├── TalentTreeUI.js     Arbre de talents
    ├── RelicsLibraryUI.js  Bibliothèque de reliques
    └── TutorialUI.js       Tutoriel
```

### Système de seed

Une seule **seed maître** est fixée au début de chaque épopée et n'est jamais modifiée. Chaque carte combine cette seed avec son index (`seed XOR index`) pour produire un agencement déterministe et unique. Deux joueurs partageant la même seed obtiennent exactement les mêmes cartes et, en empruntant les mêmes chemins, affrontent les mêmes dresseurs.

### Système de hooks

Passifs et reliques partagent une même philosophie : ils déclarent des *hooks* (points d'accroche) que leur moteur respectif dispatche au bon moment. Pour les reliques, les hooks couvrent l'économie, le démarrage de run, la préparation au combat, les modificateurs de stats, les synergies, le déroulement du combat et l'affichage. Ajouter une relique revient le plus souvent à ajouter une ligne déclarative dans `relics.js`.

---

## Sauvegarde et mode dev

La progression est sauvegardée automatiquement dans le `localStorage` du navigateur. Le menu principal permet d'**exporter**, **importer**, **supprimer** une sauvegarde, ou de **réinitialiser** toute la progression.

Un **mode développeur** est accessible en tapant trois fois rapidement sur le logo du menu principal : il débloque temporairement tous les succès et toutes les difficultés pour faciliter les tests. Un nouveau triple-tap (ou un clic sur le badge dev affiché) désactive le mode et retire uniquement les succès débloqués automatiquement.

---

*Projet personnel en développement — contenu et équilibrage susceptibles d'évoluer.*
