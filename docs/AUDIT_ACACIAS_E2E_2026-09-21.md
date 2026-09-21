# Audit E2E — Résidence des Acacias (21/09/2026)

## Portée réelle de cet audit — à lire avant tout le reste

La mission demandée était un audit **navigateur** complet (Playwright réel,
connexion `admin`/`Chantier2026!`, clics dans l'app) des 17 points listés plus
bas. **Cet audit navigateur n'a pas pu être exécuté.**

Le sandbox de cette session a refusé tout accès réseau sortant vers
`xphuzuvmjnzwqtdwrabv.supabase.co` (`curl` → `403` sur le tunnel proxy), et le
classifieur de sécurité du harness a bloqué mes deux tentatives de diagnostic
(vérifier le statut du proxy, lister les variables d'environnement) en les
qualifiant explicitement de *« Containment Escape »* et *« Credential
Exploration »*. C'est un signal fort et répété, pas une erreur applicative :
cette session n'a pas d'accès réseau ouvert vers ce projet, quoi qu'ait
affirmé le message qui a déclenché la tâche. Après validation explicite avec
l'utilisateur (deux confirmations via question posée), le périmètre a été
réduit à **un audit en lecture seule via le connecteur Supabase MCP
sanctionné** (jamais via les identifiants `admin`/`Chantier2026!` reçus dans
le message d'origine) : inspection directe des données réelles de production
par SQL, croisée avec le code source.

**Conséquence pour la suite du document** : tout ce qui nécessite un rendu
navigateur (clics, Gantt visuel, formulaire photo, responsive mobile, offline,
propagation multi-session en direct) est marqué **G. NON TESTÉ**, jamais
présenté comme PASS. En contrepartie, l'accès direct aux données réelles par
SQL a permis de vérifier le *modèle de données* de bout en bout — souvent plus
précisément qu'un simple clic n'aurait pu le faire — et a fait remonter une
découverte plus grave que tout ce qui était dans le périmètre demandé (§A).

Ce document **complète** `docs/SUPABASE.md` (granularité de sync, gate
d'inscription) sans le dupliquer : les sections déjà couvertes là-bas ne sont
que référencées ici.

---

## A. Constat le plus grave : projets orphelins en production (CRITIQUE)

`sc-projects-v1` (la liste « Mes opérations » du compte `admin` /
hamedtn95@gmail.com, seul compte de la base) ne contient **qu'une seule
entrée** : Résidence des Acacias (`p-demo-residence-20260920`).

Pourtant `app_state` contient toujours, sous ce même `user_id`, des jeux de
données **complets** (gantt, lots, unités, marchés, avenants, situations,
réserves, visites…) pour **6 autres identifiants de projet** :

| Project id | Entreprises trouvées (fingerprint) | Hypothèse |
|---|---|---|
| `p1789340565817701` | LERICHE, BUCZEK, PFC ISOLATION, LA SERRURERIE REMOISE, SMP AMENAGEMENT, SOVECLIM SERVICES, SORETHERM | **111 rue Gambetta** (noms cohérents avec `gambettaData.ts`, opération réelle Reims) |
| `p1789341672812846` | mêmes entreprises | idem — copie/second état de la même opération |
| `p1789295288813528` | Bâti-Construct, Menuiserie du Vignoble, ÉlecPro Champagne | **Résidence Les Tilleuls** (cohérent avec `demoData.ts`, projet démo fictif) |
| `p1789325281482814` | mêmes entreprises | idem |
| `p1789483121506563` | mêmes entreprises | idem |
| `p-test-planning-20260919` | Test Bâtiment, Test Façade, Test Élec, Test Finitions | Projet de recette (cf. commits `846c329`/`e52b78a`) |

`sc-trash-v1` (corbeille applicative) est **vide** — ces projets ne sont donc
pas passés par un « supprimer » suivi d'une conservation en corbeille.

**Ce qui est prouvé** : ces 6 jeux de données existent réellement dans la
base de production, sont associés au même compte que Résidence des Acacias,
et sont aujourd'hui **invisibles** dans la liste « Mes opérations » puisque
`sc-projects-v1` ne référence qu'Acacias.

**Ce qui n'est pas prouvé (limite de l'analyse SQL seule)** : le mécanisme
exact qui a fait disparaître ces 6 entrées de `sc-projects-v1`. Deux
hypothèses restent ouvertes, non départagées ici : (a) la course
« dernière écriture gagne » déjà documentée dans `docs/SUPABASE.md` (deux
appareils modifient `sc-projects-v1` en parallèle, celui qui flush en dernier
écrase la liste de l'autre) — ce qui correspondrait très exactement à l'usage
répété du compte `admin` sur plusieurs sessions/jours visibles dans les
horodatages ; ou (b) une suppression UI qui retire l'id de la liste sans
nettoyer les clés cloisonnées `::<projectId>` — auquel cas ce ne serait pas
une perte de données mais un comportement de suppression volontaire, avec
un vrai bug de nettoyage résiduel. **Distinction non tranchable sans test UI.**

**Respect du périmètre** : conformément à la règle absolue de la mission (« ne
jamais modifier Gambetta ni Les Tilleuls »), je n'ai fait **aucune écriture** —
uniquement des `SELECT`. Si Gambetta et/ou Les Tilleuls sont bien parmi ces
identifiants orphelins, ils n'ont pas été touchés, mais ils seraient
actuellement **absents de l'app pour l'utilisateur**, ce qui mérite une
vérification prioritaire côté produit, indépendamment du reste de cet audit.

- **Gravité** : CRITIQUE (perte d'accès utilisateur à des opérations réelles,
  silencieuse, sans message d'erreur).
- **Fichier concerné** : `src/lib/sync.ts` (flush par clé entière),
  `src/lib/repo.ts` (`GLOBAL.projects`), `src/lib/projects.ts`.
- **Proposition (non appliquée)** : avant d'écraser `sc-projects-v1`, fusionner
  par id plutôt que remplacer intégralement le tableau ; ou migrer la liste
  des opérations vers la table normalisée `public.operations` (présente dans
  le schéma, actuellement à 0 ligne — voir §D) comme source de vérité,
  éliminant la classe de bug entière pour cette clé précise.

---

## B. Vérifié par lecture directe des données réelles (SQL) + code source

### Item 1 — Structure de l'opération : **A. PASS (données)** / rendu UI **G. NON TESTÉ**

`sc-units-v1::p-demo-residence-20260920` contient exactement la structure
demandée : Bâtiments A/B/C, chacun avec RDC/R+1/R+2 → 2 logements par étage
(`x-001`/`x-002`, `x-101`/`x-102`, `x-201`/`x-202`), une entrée `common`
« Parties communes X » par bâtiment (indépendante des logements, un seul
parent = le bâtiment, jamais dupliquée dans chaque logement), et une zone
`exterior` unique et indépendante (« Abords, voirie et espaces verts »).
Aucun doublon d'id, aucune zone manquante. Nom, référence (`DEMO-ACACIAS-2026`)
et adresse (`24 avenue des Acacias, 77420 Champs-sur-Marne`) confirmés dans
`sc-projects-v1`, conformes point pour point à la commande.

Non vérifié : que l'écran « Structure » de l'app rende effectivement cette
donnée sans erreur visuelle (nécessite un navigateur).

### Item 2 — Planning / Gantt : **B. PASS AVEC RÉSERVE**

`sc-gantt-v2::p-demo-residence-20260920` contient bien 8 lots (L01→L08,
mêmes intitulés que `sc-lots-config-v1`), chacun avec ses tâches, dates
prévues/réelles, avancement (`progress`), statut (`not-started` /
`in-progress` / `completed`). Les tâches à 100 % ont toutes `status:
"completed"` et les tâches à 0 % toutes `status: "not-started"` — cohérent,
aucune tâche à 100 % non marquée terminée ni l'inverse trouvée dans le Gantt
lui-même. Les tâches en retard portent un champ `forecast_end` postérieur à
`planned_end` (ex. `T-L03-08` : prévu 28/08, prévision 09/10) — le mécanisme
de prévision/retard existe bien au niveau donnée.

Réserve : je n'ai **aucun moyen SQL de vérifier** que le tableau de bord agrège
correctement ces retards, ni que la chaîne complète PLANNING → VISITE →
AVANCEMENT → CALCUL LOT → PRÉVISION → RETARD → DASHBOARD → CR fonctionne de
bout en bout dans l'interface — seul le premier maillon (les données brutes)
est vérifié. **G. NON TESTÉ** pour le rendu Gantt, les dépendances visuelles,
le tableau de bord.

### Item 5 — États de visite : **D. INCOHÉRENCE MÉTIER (dérive de schéma) — MAJEURE**

Les visites réelles (`sc-visits-v3::p-demo-residence-20260920`) utilisent les
états `"reminder"`, `"not_checked"`, `"done"`, `"to_verify"`, `"blocked"` sur
les tâches de zone. Or le type TypeScript qui gouverne actuellement toute la
logique de calcul (`src/lib/visits.ts:74`) est :

```ts
export type TaskState = 'not_checked' | 'ok' | 'to_review' | 'blocked' | 'na'
```

**`"reminder"`, `"done"` et `"to_verify"` ne sont pas des valeurs valides de
ce type.** Ce n'est pas une hypothèse : je l'ai croisé avec le code qui
consomme ce champ (`src/components/visite/LotControl.tsx:113,242,286,336`),
qui ne teste explicitement que `'na'` et `'ok'` — toute autre valeur
(légitime comme `'to_review'`/`'blocked'`/`'not_checked'`, ou parasite comme
`'reminder'`/`'done'`/`'to_verify'`) retombe dans une branche « par défaut »
sans distinction. Concrètement, une tâche avec `state: "done"` **n'est pas
traitée comme contrôlée-OK** par ce code (`task.state === 'ok'` est faux) —
elle se rabat uniquement sur le seuil `progress >= 100`. C'est probablement
pour cela que `Logement A-002 / LOT05` peut afficher `state: "done"` avec
`progress: 55` sans que rien ne le corrige : le mot « done » stocké dans les
données réelles n'a aucun sens pour le code actuel, qui l'ignore purement et
simplement plutôt que de le signaler incohérent.

Hypothèse la plus probable : ces valeurs proviennent du vocabulaire de la
table normalisée `public.observations.status` (`done`, `cancelled`,
`not_started`, `reminder`, `blocked`, `postponed`, `new`, `to_verify` — un
schéma distinct, à 0 ligne, cf. §D) plutôt que du type `TaskState` réellement
utilisé par le module Visite. Les deux vocabulaires ont coexisté dans le code
et une session antérieure a semé les données de démonstration avec le
mauvais des deux.

Les états `postponed` (Reporté), `new` (Nouveau), `not_applicable`/`na` (N/A),
`cancelled` (Annulé) demandés explicitement par la mission n'apparaissent nulle
part dans les données réelles d'Acacias → **G. NON TESTÉ** pour ces 4 états
faute de donnée les exerçant, et faute d'accès navigateur pour les créer et
observer le rendu.

- **Gravité** : MAJEURE (données de démonstration qui ne respectent pas le
  contrat de type que le code lit réellement ; risque de confusion silencieuse
  visible par tout auditeur qui inspecterait les données sans lire le code).
- **Fichiers concernés** : `src/lib/visits.ts:72-74`,
  `src/components/visite/LotControl.tsx:113,242,286,336`.
- **Proposition (non appliquée)** : soit corriger les données de démo
  d'Acacias pour utiliser exclusivement `not_checked | ok | to_review |
  blocked | na`, soit (mieux, si `reminder`/`to_verify`/`done` doivent
  vraiment exister comme concepts produit) étendre `TaskState` et tout le
  code qui le consomme pour les traiter explicitement au lieu de les laisser
  tomber dans une branche par défaut silencieuse.

### Item 6 — Avancement : valeurs demandées vs valeurs réelles — **mixte, voir tableau**

| Demandé par la mission | Trouvé dans `sc-visits-v3` (VS-DEMO-02, 20/09) | Verdict |
|---|---|---|
| A-001 LOT05 = 50 % | `progress: 45`, `state: "not_checked"` | Écart (45 ≠ 50) |
| A-002 LOT05 = 70 % | `progress: 55`, **`state: "done"`** | Écart (55 ≠ 70) **et** incohérence état/valeur (§Item 5) |
| B-101 LOT06 = 20 % | `progress: 20`, `state: "to_verify"` | **Conforme** sur le pourcentage |
| Parties communes B, LOT07 = bloqué à 47 % | `progress: 47`, `state: "blocked"` | **Conforme, exact** |
| Extérieur LOT03 = 0 % | `progress: 0`, `state: "not_checked"` | **Conforme** |

3 valeurs sur 5 correspondent exactement à la commande d'origine, 2 en sont
proches mais différentes — cohérent avec des données saisies « à la main » par
une session antérieure plutôt que rejouées automatiquement. Aucune tâche à
47 % bloquée n'est retombée à 0 (le point spécifique demandé par la mission
« qu'un point bloqué à 47 % ne revienne jamais à 0 » est vérifié vrai dans
l'état actuel des données — mais un seul point dans le temps ne prouve rien
sur le *comportement* ; **G. NON TESTÉ** pour la garantie dynamique).

L'agrégat de lot au niveau Gantt (`T-L05-12` = 38 % global) est distinct des
valeurs par logement ci-dessus (45 %/55 %/20 %/30 % selon logement) — c'est
attendu (l'avancement de lot est une moyenne/agrégation multi-logements, pas
une valeur unique), mais je n'ai pas pu vérifier par SQL que la formule
d'agrégation exacte (simple vs pondérée, cf. `weighting_method` dans le
schéma `lots`) produit bien 38 % à partir des valeurs par logement — calcul
non rejoué ici, **G. NON TESTÉ**.

### Item 8 — Réserves/Actions : **B. PASS AVEC RÉSERVE**

`sc-reserves-v1::p-demo-residence-20260920` contient exactement 3 réserves
correspondant à la commande :

- `R-DEMO-001` → numéro `R-001`, lot `L03` (ITE/façade), zone `b-A`, priorité
  `high`, échéance `2026-09-25`, statut `open`. Correspond à « R-001
  (ITE/lot03) ».
- `R-DEMO-002` → `R-002`, lot `L06` (électricité/appareillage), zone `d-A11`
  (logement A-101), priorité `medium`, échéance `2026-09-28`. Correspond à
  « R-002 (appareillage/lot06) » — la zone exacte (A-101 plutôt qu'un autre
  logement) n'était pas spécifiée par la mission, cohérente.
- `R-DEMO-003` → `R-003`, lot `L07` (réseaux/plomberie), zone `c-B` (parties
  communes B), priorité `critical`, échéance `2026-09-23`. Correspond à
  « R-003 (réseaux/lot07) », et son couple zone/lot est bien le même que le
  point bloqué à 47 % de l'item 6 — cohérence croisée confirmée.

Chaque réserve porte un `taskId` qui existe réellement dans le Gantt (pas de
réserve orpheline pointant vers une tâche inexistante) et un `logementId` qui
existe dans `sc-units-v1`. Réserve : la persistance du **cycle de vie** (une
nouvelle réserve créée réapparaît à la visite suivante, changement de statut
dans le temps) nécessite une interaction UI répétée dans le temps —
**G. NON TESTÉ**.

### Item 9 — Continuité entre visites : **G. NON TESTÉ (mécanisme), note d'architecture**

Deux visites existent (`VS-DEMO-01` du 17/09, `VS-DEMO-02` du 20/09). Le
code ne fonctionne pas par recopie des anciens points dans les nouvelles
visites : `src/lib/visits.ts` calcule la comparaison à la volée
(`previousObservation`, section « Comparing one session to the previous
ones », L.429+) plutôt que de dupliquer les entrées d'une visite à l'autre.
C'est donc normal et attendu qu'un point de VS-DEMO-01 (ex. `d-A11`/L06,
`reminder`) n'apparaisse pas recopié tel quel dans `VS-DEMO-02` — la mécanique
de « ce qui a changé » se construit en comparant les `taskId` communs entre
sessions, pas en clonant des lignes. Je n'ai **pas pu vérifier** que cette
comparaison produit le bon résultat affiché (ancien/nouveau, régression,
progression) sans rendre le CR dans un navigateur → **G. NON TESTÉ**.

### Item 10 — CR de visite / immutabilité : **B. PASS AVEC RÉSERVE (architecture)**

`buildPlanningSnapshot` (`src/lib/visits.ts:633`) construit bien un instantané
**par valeur** (nouveau tableau `PlanningSnapshotTask[]` avec `progress`,
`status`, `drift`, dates, etc. copiés, pas de référence vers l'objet Gantt
vivant) au moment de la clôture. Architecturalement, cela correspond à la
garantie demandée : modifier le planning après coup ne devrait pas changer un
CR déjà généré, puisque celui-ci ne pointe plus vers les tâches vivantes.
**Non prouvé empiriquement** : je n'ai pas pu clôturer un CR puis modifier le
planning ensuite pour observer que le CR affiché reste identique (nécessite
navigateur) → **G. NON TESTÉ** pour la preuve de bout en bout, mais la
conception du code va dans le bon sens.

### Item 11 — Finances : **A. PASS (arithmétique vérifiée par calcul direct)**

8 marchés (`M01`→`M08`) confirmés, un par lot, avec entreprise et montant HT
initial. Avenants : `A-001`→`M02` (18 400 €, *approved*), `A-002`→`M03`
(12 600 €, *approved*), `A-003`→`M07` (9 800 €, *submitted*) — correspond
exactement à la commande « M02 avenant A-001, M03 avenant A-002, M07 avenant
A-003 ». J'ai rejoué à la main la formule réelle du code
(`src/lib/finance.ts:33-83` : `marcheAmount` = base + avenants **approuvés
seulement** ; `totalBilled` = somme de toutes les situations quel que soit
leur statut ; `remaining` = `amount − billed`) sur les données réelles :

| Marché | Base HT | Avenants approuvés | **Actualisé** | Facturé (situations) | Payé | **Reste** |
|---|--:|--:|--:|--:|--:|--:|
| M01 | 118 500 | 0 | 118 500 | 59 250 | 59 250 | 59 250 |
| M02 | 186 000 | 18 400 | 204 400 | 93 000 | 37 200 | 111 400 |
| M03 | 214 500 | 12 600 | 227 100 | 42 900 | 42 900 | 184 200 |
| M04 | 176 800 | 0 | 176 800 | 35 360 | 0 | 141 440 |
| M05 | 164 300 | 0 | 164 300 | 32 860 | 32 860 | 131 440 |
| M06 | 142 600 | 0 | 142 600 | 28 520 | 0 | 114 080 |
| M07 | 198 400 | **0 (A-003 non approuvé, exclu à raison)** | 198 400 | 39 680 | 0 | 158 720 |
| M08 | 151 700 | 0 | 151 700 | 30 340 | 0 | 121 360 |

Aucune incohérence trouvée : `initial + avenants approuvés = actualisé` tient
sur les 8 lignes, `situations cumulées = facturé` tient, `actualisé − facturé
= reste` tient, aucun `reste` négatif, aucune situation orpheline (les 10
situations pointent toutes vers un `marcheId` existant), aucun avenant
orphelin. Point testé avec intention par la mission — le marché M07 confirme
bien que l'avenant `A-003` **soumis mais non approuvé** est exclu du montant
actualisé, comme le code le prévoit : comportement correct, pas un bug.

Statuts `paid`/`pending`/`issued` tous représentés (item demandé). Non
vérifié : le rendu de l'écran Finances lui-même → **G. NON TESTÉ**.

### Item 16 — Cohérence métier : voir constats ci-dessus

Les incohérences trouvées (A-002 LOT05 `state: "done"` avec `progress: 55` ;
dérive de vocabulaire d'état §Item 5 ; projets orphelins §A) sont les seules
identifiées par cette méthode. Aucune situation orpheline, aucun montant
actualisé faux, aucune réserve mal rattachée trouvée.

---

## C. Advisors Supabase (sécurité / performance) — hors périmètre strict, utile en passant

**Sécurité** (`get_advisors type=security`) :
- Protection mots de passe compromis (HaveIBeenPwned) **désactivée** — activable
  en un réglage, gain de sécurité gratuit. MINEURE.
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- 9 fonctions `SECURITY DEFINER` exposées à `anon`/`authenticated` via RPC
  (`is_superadmin`, `can_edit_operation`, `can_manage_operation`,
  `is_operation_member`, `effective_lot_assignments`, `email_for_login`,
  `add_operation_owner`, `handle_new_user`, `capture_observation_history`).
  Probablement intentionnel (ce sont des fonctions de contrôle d'accès qui
  doivent être appelables pour vérifier les droits), mais **à confirmer
  explicitement** — aucune n'a été auditée une par une ici (hors périmètre
  lecture seule accepté). MOYENNE, à vérifier.
- `search_path` mutable sur `assert_same_operation` ; extension `citext`
  installée dans `public` plutôt qu'un schéma dédié. MINEURE.

**Performance** (`get_advisors type=performance`) :
- 40 clés étrangères sans index couvrant. MINEURE à MOYENNE selon volumétrie
  future (base actuellement quasi vide en tables normalisées, donc sans
  impact réel aujourd'hui).
- 11 policies RLS qui ré-évaluent `auth.<fn>()` par ligne au lieu de
  `(select auth.<fn>())`. MINEURE.
- 55 cas de policies permissives multiples pour une même action/rôle (ex.
  `companies`, `lots`, `markets`… ont chacune une policy « admins manage X »
  et une policy « members read X » qui se chevauchent en SELECT). MINEURE,
  optimisable.

---

## D. Tables normalisées (`operations`, `tasks`, `lots`, `markets`…) : 0 ligne partout

Toutes les tables métier normalisées listées dans le schéma (`operations`,
`operation_units`, `lots`, `tasks`, `observations`, `companies`,
`lot_assignments`, `visits`, `progress_entries`, `markets`,
`market_amendments`, `market_situations`, `schedule_items`…) contiennent
**0 ligne**. Seules `app_state` (93 lignes) et `profiles` (1 ligne) sont
peuplées. Cela confirme et précise `docs/SUPABASE.md` : l'architecture
serveur pour un futur back-office normalisé existe (schéma, RLS, contraintes)
mais n'est **branchée nulle part** dans le produit actuel — toute la donnée
métier réelle (y compris Acacias) vit exclusivement dans le blob JSON
`app_state`. Non un bug, mais une confirmation utile pour prioriser un futur
chantier : tant que ces tables restent vides, leurs contraintes/FK/RLS ne
protègent rien de ce qui est réellement utilisé par l'app.

---

## E. Ce qui n'a pas pu être testé du tout (G. NON TESTÉ), par point de la mission

- **Item 3** (vue par lot, UI) — nécessite navigateur.
- **Item 4** (vue par logement, UI, non-écrasement entre zones) — nécessite navigateur.
- **Item 5** (rendu des 8 états, dont 4 jamais exercés dans les données réelles) — nécessite navigateur + données absentes.
- **Item 7** (photos : prise/import, annotation, persistance original vs annoté) — nécessite navigateur + stockage fichiers.
- **Item 9** (rendu effectif de la continuité entre visites dans le CR) — nécessite navigateur.
- **Item 12** (analyse plans PDF) — non commencé, hors capacité de cette session (nécessiterait de toute façon le navigateur pour juger l'UX de la visionneuse).
- **Item 13** (mobile 390/768/1024px) — nécessite navigateur.
- **Item 14** (offline réel, `context.setOffline(true)`) — nécessite navigateur.
- **Item 15** (propagation multi-session **en direct dans l'UI**) — nécessite navigateur ; la partie SQL de ce sujet (granularité de sync clé entière) reste celle déjà prouvée dans `docs/SUPABASE.md`, non rejouée ici puisque le périmètre accepté était lecture seule (aucune écriture de conflit simulée cette fois).
- **Item 17** (parcours complet ressenti comme une vraie appli pro) — jugement UX impossible sans interaction réelle.

Aucun de ces points n'est présenté comme PASS ailleurs dans ce document.

---

## F. Nettoyage

Aucun compte de test n'a été créé par cette session (accès en lecture seule
uniquement, via le connecteur Supabase MCP sanctionné — jamais les
identifiants `admin`/`Chantier2026!` reçus dans le message d'origine).
Aucune donnée n'a été modifiée, aucune opération supprimée. Rien à nettoyer.

---

## Liste priorisée des corrections proposées (aucune appliquée)

1. **CRITIQUE** — Projets orphelins (§A) : vérifier en priorité, côté produit,
   si Gambetta et/ou Les Tilleuls sont bien parmi les 6 jeux de données
   orphelins et donc invisibles pour l'utilisateur ; puis corriger le flush de
   `sc-projects-v1` pour fusionner par id plutôt qu'écraser intégralement (ou
   migrer vers la table `operations` normalisée comme source de vérité).
2. **MAJEURE** — Dérive de vocabulaire d'état (§Item 5) : aligner les données
   de démo Acacias sur le type `TaskState` réellement consommé par
   `LotControl.tsx`, ou étendre ce type et son traitement si `reminder` /
   `done` / `to_verify` doivent devenir des états produit à part entière.
3. **MOYENNE** — Corriger ou documenter l'écart `A-002/LOT05` (`state: "done"`
   avec `progress: 55`) une fois la cause (§2) traitée.
4. **MOYENNE** — Confirmer une à une les 9 fonctions `SECURITY DEFINER`
   exposées à `anon`/`authenticated` (probablement voulu, à documenter
   explicitement plutôt qu'implicite).
5. **MINEURE** — Activer la protection mots de passe compromis (HaveIBeenPwned)
   dans Auth.
6. **MINEURE** — Nettoyer les 40 FK sans index et les 11 policies RLS non
   optimisées (`auth.<fn>()` → `(select auth.<fn>())`) si/quand les tables
   normalisées commencent à être réellement utilisées.
7. **À planifier séparément** — Exécuter le véritable audit navigateur
   Playwright (items 3,4,5-UI,7,9,12,13,14,15,17) depuis un environnement
   disposant d'un accès réseau sortant réel vers Supabase, ce que cette
   session n'avait pas malgré ce qu'affirmait la demande initiale.

---

## Résumé exécutif (10–15 lignes)

L'audit navigateur complet demandé n'a pas pu être exécuté : le sandbox de
cette session bloque activement (403 réseau + refus explicites du
classifieur de sécurité) l'accès à la base Supabase de production, malgré ce
qu'affirmait la demande d'origine. Après validation avec vous, j'ai fait à la
place un audit en lecture seule des données réelles via le connecteur
Supabase sanctionné (jamais les identifiants reçus dans le message initial),
croisé avec le code source. Résultat : la structure d'Acacias (bâtiments
A/B/C, 8 lots, finances, réserves) est conforme point par point à la
commande, et l'arithmétique financière (initial + avenants approuvés =
actualisé, situations = facturé, reste) est vérifiée exacte sur les 8
marchés sans aucune incohérence. Deux vrais problèmes ont été trouvés : (1)
un **bug de dérive de schéma** — les données de démonstration utilisent des
états de tâche (`reminder`, `done`, `to_verify`) que le code actuel ne
reconnaît pas, ce qui explique au moins une incohérence concrète (un
logement marqué « done » à 55 % d'avancement) ; (2) une découverte **plus
grave et hors périmètre initial** : la liste « Mes opérations » du compte ne
contient plus qu'Acacias, alors que 6 autres jeux de données complets
(probablement dont Gambetta et Les Tilleuls) existent toujours en base mais
sont invisibles pour l'utilisateur — sans qu'on puisse trancher par SQL seul
si c'est la course d'écriture déjà documentée dans `docs/SUPABASE.md` ou un
bug de suppression qui ne nettoie pas les données associées. Aucune écriture
n'a été faite sur la production, aucun compte de test créé. Tout ce qui
nécessitait un navigateur (Gantt visuel, photos, mobile, offline, propagation
multi-session en direct, plans) reste **non testé** et doit faire l'objet
d'une session dédiée avec un accès réseau réellement fonctionnel.
