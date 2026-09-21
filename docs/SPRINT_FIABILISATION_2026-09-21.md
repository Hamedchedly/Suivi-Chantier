# Sprint de fiabilisation — 2026-09-21

Ce document complète `docs/AUDIT_ACACIAS_E2E_2026-09-21.md` (l'audit qui a
déclenché ce sprint) : il ne le duplique pas, il documente la correction
apportée aux deux problèmes que cet audit avait qualifiés de P0/P1, les
tests ajoutés, et l'état exact du compte à l'issue du sprint.

Conformément à la mission : **aucune donnée n'a été supprimée**, aucun projet
orphelin n'a été effacé, les données Gambetta et Les Tilleuls n'ont pas été
touchées, GED/RFI/VISA/vidéo restent hors périmètre, et aucune migration
destructrice n'a été effectuée.

---

## 1. Cause racine du problème sc-projects-v1 (P0)

`sync.ts` synchronise chaque clé locale vers `app_state` par un **upsert
qui remplace intégralement la ligne serveur** (`flush()`, débouncé à
800 ms). C'est correct pour les clés cloisonnées par projet
(`sc-visits-v3::<id>`, `sc-gantt-v2::<id>`, …) puisque chaque appareil qui
travaille sur un projet donné en connaît forcément l'état complet.

`sc-projects-v1` est différente : c'est un registre **global**, partagé par
toutes les opérations d'un même compte. Avant ce correctif, elle subissait
exactement le même traitement — écrasement intégral, sans fusion. Le seul
endroit où une fusion existait était `initRemoteSession()`, mais uniquement
côté **lecture** (hydratation au démarrage), jamais côté écriture.

Résultat : un appareil dont le cache local de `sc-projects-v1` est
incomplet — nouveau profil navigateur, hydratation interrompue, ou session
qui n'a connu qu'un sous-ensemble des opérations — écrase silencieusement
la liste serveur complète au premier flush qui touche cette clé (par
exemple : création d'une nouvelle opération). C'est très exactement ce qui
s'est produit avec Acacias : sa création a réduit `sc-projects-v1` à ce
seul projet, alors que 6 jeux de données complets (Gambetta ×2, Les
Tilleuls ×3, une opération de recette « test-planning ») restaient intacts
dans `app_state` sous leurs clés cloisonnées respectives — invisibles dans
« Mes opérations » mais pas perdus.

## 2. Correction apportée

Fichier modifié : `src/lib/sync.ts`.

Ajout de `reconcileProjectsBeforeFlush(uid, localRaw)`, appelée uniquement
pour la clé `sc-projects-v1`, juste avant l'upsert :

1. Lit l'état **actuel** du serveur pour cette clé (`select().eq().eq().maybeSingle()`).
2. Calcule l'union `serveur ∪ local`, indexée par `id` (le local l'emporte
   pour les ids qu'il connaît — ajout ou édition légitimes).
3. Retire de cette union les ids présents dans la corbeille locale
   (`sc-trash-v1`, alimentée par `removeProject` dans `App.tsx`) — c'est la
   **seule** source de suppression explicite reconnue par cette fonction.
4. Renvoie ce résultat fusionné comme valeur réellement envoyée au serveur.

Toute autre clé (`sc-visits-v3::…`, `sc-gantt-v2::…`, etc.) part inchangée,
exactement comme avant — cette correction ne touche **que** le cas
`sc-projects-v1`.

Défensif : si le serveur n'a pas encore de ligne, si la valeur locale ou
serveur n'a pas la forme d'une collection à `id`, ou si Supabase est
injoignable, la fonction renvoie `localRaw` tel quel (comportement
antérieur inchangé) plutôt que d'échouer le flush.

**Limite assumée et documentée** (dans `sync.ts` et ici) : la réconciliation
lit l'état serveur juste avant d'écrire, ce qui réduit très fortement la
fenêtre de course sans l'éliminer : deux flushs réellement simultanés
peuvent chacun se baser sur une lecture serveur légèrement périmée. Une
solution transactionnelle complète (ou une migration vers des lignes
individuelles par projet plutôt qu'un tableau JSON global) réglerait ce
résidu, mais sort du périmètre de ce sprint (P5 — pas de migration
`operations` normalisée à ce stade).

**Ce que cette correction NE fait PAS — point à ne pas occulter (P7)** :
elle est **préventive**. Elle empêche cette classe de bug de se reproduire
lors des **prochains** flushs, mais ne restaure **pas rétroactivement** les
6 opérations déjà absentes de la ligne `sc-projects-v1` actuellement en
base. Voir section 5.

## 3. Tests ajoutés

- `src/lib/sync.test.ts` — nouveau bloc `describe('sync : registre des
  projets (sc-projects-v1) — fusion par id', …)`, 7 tests :
  1. ajout d'un projet C à `[A,B]` connus du serveur → le serveur garde
     `[A,B,C]` (jamais `[A,D]` si le local ne connaissait que `[A,D]`) ;
  2. modification de B dans `[A,B,C]` → `[A,B',C]`, A et C préservés ;
  3. suppression explicite de B via la corbeille locale → `[A,C]` (seul
     chemin testé qui fait réellement disparaître un projet du serveur) ;
  4. un local en retard `[A,B]` ne fait pas perdre C déjà connu du serveur
     `[A,B,C]` ;
  5. des éditions parallèles sur deux projets différents ne s'écrasent pas
     mutuellement ;
  6. les clés cloisonnées d'un projet (`sc-units-v1::x`, `sc-gantt-v2::x`,
     `sc-visits-v3::x`) ne sont jamais réconciliées ni affectées par cette
     logique — seule `sc-projects-v1` l'est ;
  7. « reproduit l'incident réel » — reproduit précisément le scénario
     Gambetta+Tilleuls / nouveau profil / création Acacias, et vérifie que
     le résultat est bien l'union et non l'écrasement.
- `src/lib/projects.ts` — nouvelle fonction pure `findOrphanProjectIds()`.
  `src/lib/projects.test.ts` — 5 tests, dont un qui reproduit l'exact
  constat de l'audit Acacias (liste d'ids orphelins triée).
- `src/lib/repo.ts` — nouvelle fonction `findOrphanProjects()` (lecture
  seule, aucune écriture, aucune restauration) qui applique
  `findOrphanProjectIds()` au vrai `localStorage`.
- `src/lib/visits.test.ts` — 4 tests sur le modèle TaskState/progression
  (détail section 7) : `blocked` + 47 % préservé exactement ; un état
  invalide `'done'` avec `progress: 55` ne devient jamais `'completed'` (le
  planning retombe sur `'in-progress'`, dérivé uniquement de la
  progression) ; idem pour un état invalide `'reminder'` ; une tâche `na`
  n'est jamais touchée dans sa progression/statut par
  `applyVisitToPlanning`.

## 4. Résultats des tests

```
tsc -b                : exit 0 (aucune erreur de type)
vitest                : 35 fichiers, 478/478 tests passés (dont les 16 nouveaux)
eslint                : 0 erreur, 15 avertissements préexistants (non liés à ce sprint)
vite build             : succès
npm run e2e (6 scripts): tous passés —
  planning-visite.mjs, multi-operation-isolation.mjs, permissions.mjs,
  finances-chain.mjs, entreprises-synthesis.mjs, recipe-metier-complete.mjs
```

Aucune régression détectée sur les 462 tests préexistants ni sur les 6
scénarios E2E permanents.

## 5. État des projets orphelins (audit de récupération, P3 — aucune modification)

Six identifiants sont référencés par des clés cloisonnées dans `app_state`
mais absents de `sc-projects-v1` en base à ce jour. Aucun n'a été touché.

| Id orphelin | Correspondance | Base de la correspondance |
|---|---|---|
| `p1789340565817701` | Gambetta (copie 1) | **Certaine** — les entreprises du lot (LERICHE, BUCZEK, PFC ISOLATION, LA SERRURERIE REMOISE, SMP AMENAGEMENT, SOVECLIM SERVICES, SORETHERM) correspondent exactement, champ par champ, au fixture `src/lib/gambettaData.ts` |
| `p1789341672812846` | Gambetta (copie 2) | **Certaine** — même correspondance exacte avec `gambettaData.ts` |
| `p1789295288813528` | Les Tilleuls (copie) | **Certaine** — entreprises (Bâti-Construct/m.petit@…, Menuiserie du Vignoble/j.renard@…, ÉlecPro Champagne/k.baz@…) correspondant exactement à `src/lib/demoData.ts` |
| `p1789325281482814` | Les Tilleuls (copie) | **Certaine** — même correspondance exacte avec `demoData.ts` |
| `p1789483121506563` | Les Tilleuls (copie) | **Certaine** — même correspondance exacte avec `demoData.ts` |
| `p-test-planning-20260919` | Opération de recette « TEST » | **Correspondance probable, non prouvée par fixture** — l'identifiant et son contenu (planning) sont cohérents avec l'opération TEST permanente utilisée par la recette E2E, mais je n'ai pas de correspondance champ-par-champ certaine comme pour les deux autres cas |

**Aucune de ces 6 opérations n'a été restaurée dans `sc-projects-v1`.**
Elles restent, à l'instant où ce rapport est écrit, invisibles dans « Mes
opérations » sur le compte réel — c'est un fait distinct de la correction
préventive de la section 2, et c'est la raison pour laquelle la plainte
initiale de l'utilisateur (« j'arrive plus à accéder à plusieurs pages »)
**n'est pas encore résolue** tant qu'une décision explicite de restauration
n'est pas prise.

### Proposition de restauration (non appliquée — décision volontairement laissée à l'utilisateur)

Une fonction de restauration sûre est possible mais n'a **pas** été
implémentée ce sprint, conformément à l'instruction « propose-la
séparément » :

- Pour les 5 ids à correspondance certaine, les métadonnées d'origine sont
  connues avec précision (ex. `DEMO_PROJECT` dans `demoData.ts` :
  `name: 'Résidence Les Tilleuls'`, `reference: 'RT-2026'`,
  `address: '8 Allée des Tilleuls, 51200 Épernay'`) et pourraient servir à
  reconstruire une entrée `Project` correcte pour chaque id.
- Le mécanisme le plus sûr serait une fonction explicite, déclenchée
  manuellement (jamais automatique au chargement), du type
  `restoreOrphanProject(id, metadata)` qui ajoute l'entrée à
  `sc-projects-v1` sans toucher à aucune autre clé — strictement
  l'inverse, ciblé par id, de la suppression.
- Cette fonction n'a pas été écrite ce sprint : elle touche directement des
  données de production réelles et la mission demandait explicitement de
  ne rien restaurer sans validation préalable. Elle est proposée ici pour
  décision, pas exécutée.

## 6. Cause de la dérive TaskState (P1)

`src/components/visite/LotControl.tsx` a un contrat déjà correct et
n'a **pas eu besoin d'être modifié** : il ne teste explicitement que
`=== 'na'` et `=== 'ok'` (lignes ~113, 242, 286, 336) ; toute autre valeur
tombe silencieusement dans un affichage générique piloté par la
progression seule — sans planter, mais sans refléter l'état réel non plus.

Le vrai problème était dans les **données** : le jeu de démo Acacias
utilisait un vocabulaire d'état (`done`, `cancelled`, `reminder`,
`to_verify`, `postponed`, `new`…) qui n'est **pas** le `TaskState` réellement
consommé par `visits.ts`/`LotControl.tsx`
(`'not_checked' | 'ok' | 'to_review' | 'blocked' | 'na'`). Ce vocabulaire
erroné vient du schéma normalisé `public.observations.status` — une table à
0 ligne, jamais câblée dans l'application — dont les données de démo
avaient été construites par erreur, au lieu du vrai modèle `TaskState` /
`ReserveStatus`/`FollowUpStatus` (`src/lib/reserves.ts`) réellement utilisé.

## 7. Modèle retenu (définitif, aucune valeur ajoutée arbitrairement)

Trois notions **indépendantes**, jamais mélangées :

1. **État de contrôle de la tâche pendant une visite** (`TaskState`,
   `src/lib/visits.ts:74`) : `not_checked` / `ok` / `to_review` / `blocked`
   / `na`. C'est un jugement du contrôleur au moment de la visite.
2. **Statut de l'action/observation qui en découle éventuellement**
   (`FollowUpStatus`, `src/lib/reserves.ts`) : `not_done` (nouveau) /
   `in_progress` (rappel/relance) / `rescheduled` (reporté) / `obsolete`
   (annulé) / `done` (clôturé) — plus `comment`, et le champ booléen
   indépendant `reminder?`. C'est le suivi d'une réserve/action, pas l'état
   de contrôle d'une tâche.
3. **Avancement physique** (`progress: number`, 0–100 %) : indépendant des
   deux précédents. `progress: 55` + `state: 'blocked'` est **cohérent** (le
   lot est à moitié fait mais bloqué) ; `progress: 55` + un état de type
   « terminé » n'a de sens que si l'avancement est aussi remis à 100 — ce
   sprint ne force pas cette cohérence côté code (hors périmètre : ce
   serait une règle métier nouvelle, non demandée), mais le confirme par
   test (section 3 : un état invalide n'écrase jamais la progression
   réelle, le planning dérive son statut de la seule progression quand
   l'état de tâche ne correspond à aucun des deux cas explicitement gérés).

Rappel du précédent déjà établi dans cet historique : « Contrôlé ≠ Terminé »
(le label `ZONE_META.done` a été renommé « Contrôlé » précisément pour
que `TaskState: 'ok'` + `progress < 100` reste un état affichable et
cohérent, pas une anomalie).

## 8. Données Acacias corrigées

Seules les données de démo Acacias ont été modifiées (aucune donnée
Gambetta ni Les Tilleuls) — 7 remplacements ciblés par identité exacte
(id de visite + référence de zone + id de tâche), appliqués via SQL direct
sur `app_state` (clé `sc-visits-v3::p-demo-residence-20260920`) :

| Visite | Zone | Tâche | Avant | Après |
|---|---|---|---|---|
| VS-DEMO-01 | c-A | T-L06-14 | `reminder` | `na` |
| VS-DEMO-01 | d-A11 | T-L06-15 | `reminder` | `to_review` |
| VS-DEMO-02 | c-A | T-L07-17 | `reminder` | `to_review` |
| VS-DEMO-02 | d-A01 | T-L06-15 | `reminder` | `to_review` |
| VS-DEMO-02 | d-A02 | T-L05-12 | `done` | `ok` |
| VS-DEMO-02 | d-B11 | T-L06-15 | `to_verify` | `to_review` |
| VS-DEMO-02 | c-C | T-L06-14 | `reminder` | `to_review` |

Chaque remplacement a été vérifié par égalité stricte de l'état trouvé
avant écriture (le script échoue s'il ne trouve pas exactement la valeur
attendue), et une vérification finale confirme qu'il ne reste plus aucune
valeur hors du vrai `TaskState`. Répartition finale (17 tâches au total,
sur les zones A-001 LOT05, A-002 LOT05, B-101 LOT06, Parties communes B
LOT07, Extérieur LOT03) : les 5 valeurs valides sont toutes représentées
(`blocked`, `na`, `not_checked`, `ok`, `to_review`). Rien côté
action/observation (`FollowUpStatus`) n'a été modifié par cette correction
— seul le champ `state` (contrôle de tâche) des tâches listées ci-dessus a
changé.

## 9. Régressions

Aucune régression détectée : 478/478 tests unitaires, 6/6 scénarios E2E
permanents, `tsc`/`eslint`/`build` tous propres (mêmes 15 avertissements
ESLint préexistants qu'avant ce sprint, non liés aux fichiers modifiés).

## 10. Ce qui reste NON TESTÉ (nécessite un navigateur réel — P7)

Ce sprint a utilisé : lecture/écriture SQL directe sur le Supabase réel
(MCP), tests unitaires (Vitest/jsdom), et la suite E2E Playwright headless
existante (`npm run e2e`, contre le vrai navigateur Chromium mais sans
compte Supabase connecté — ces scripts opèrent en local-only). **Aucune
session de navigateur connectée au compte réel `admin` n'a été utilisée
dans ce sprint.** En particulier, restent NON TESTÉS :

- Le comportement réel de `reconcileProjectsBeforeFlush` en conditions de
  concurrence véritables (deux onglets/appareils réels flushant
  `sc-projects-v1` presque simultanément) — seul le comportement
  séquentiel est couvert par les tests unitaires avec mock Supabase.
- L'affichage effectif de « Mes opérations » et des pages Planning/Visite
  dans un navigateur connecté au compte `admin` réel, avant et après ce
  correctif — je n'ai pas rouvert l'application dans un navigateur réel
  pour confirmer visuellement que les pages redeviennent accessibles pour
  Acacias (le correctif SQL des états de visite a été vérifié par relecture
  SQL de la valeur écrite, pas par un rendu UI réel).
- La visibilité des 6 projets orphelins reste, à ce jour, non restaurée et
  donc non testable dans « Mes opérations » — voir section 5.
- Le comportement de synchronisation sur un vrai second appareil/profil
  navigateur (le scénario exact de l'incident) n'a pas été rejoué en
  conditions réelles ; il est couvert uniquement par le test unitaire
  « reproduit l'incident réel » (mock).

---

*Rapport rédigé à l'issue du sprint. Voir aussi `docs/AUDIT_ACACIAS_E2E_2026-09-21.md`
(audit initial) et `docs/SUPABASE.md` (architecture de synchronisation).*
