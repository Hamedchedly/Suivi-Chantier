# Audit final et stabilisation — 2026-09-21

Ce rapport répond à la mission « AUDIT FINAL ET STABILISATION » (même
journée, après le sprint de fiabilisation `docs/SPRINT_FIABILISATION_2026-09-21.md`
et l'audit initial `docs/AUDIT_ACACIAS_E2E_2026-09-21.md`, non dupliqués ici).
Aucune nouvelle fonctionnalité n'a été ajoutée. Gambetta n'a pas été
modifiée. Aucune donnée n'a été supprimée.

---

# DIAGNOSTIC

## 1. Cause(s) réelle(s) trouvée(s)

### 1.1 — Absence totale d'Error Boundary
- **Symptôme** : une exception React non interceptée dans n'importe quelle
  page (Structure, Planning, Visite, Finances, Rapports…) blanchit toute
  l'application, y compris la navigation — aucun moyen de revenir en
  arrière sans recharger.
- **Cause exacte** : aucun composant Error Boundary n'existait dans le
  dépôt. Recherche exhaustive de `componentDidCatch`,
  `getDerivedStateFromError`, `react-error-boundary` sur tout `src/` :
  zéro résultat, confirmé (pas supposé). `src/main.tsx` ne monte `<App/>`
  que dans `<StrictMode>`, qui n'intercepte rien.
- **Fichier / fonction** : absence — pas un bug dans un fichier existant.
- **Impact** : toute exception runtime imprévue (donnée corrompue, bug
  ponctuel) dans une des 5 pages listées produit un écran blanc total.
- **Niveau** : CRITIQUE — **CORRIGÉ** (voir §4).

### 1.2 — Déploiement Railway : branche `develop`, 78 commits derrière `main`
- **Symptôme** : rien ne garantit que la version réellement accessible aux
  utilisateurs reflète les correctifs des derniers sprints.
- **Cause exacte** : le service Railway `Suivi-Chantier` (projet `Suivi
  Chantier`, environnement `production`,
  `suivi-chantier-production-396f.up.railway.app`) a sa source configurée
  sur `Hamedchedly/Suivi-Chantier`, **branche `develop`**, jamais `main`.
  Son dernier déploiement (`048e09ff…`) date du **2026-09-14**, commit
  `134b124bc52d…`. `git log origin/develop..origin/main` compte **78
  commits** d'écart — `develop` n'a plus été mise à jour depuis son dernier
  merge de `main` (PR #6, commit `64a403f`). Le service est actuellement
  `SLEEPING` (mise en veille automatique Railway sur inactivité).
- **Fichier / fonction** : configuration de déploiement Railway
  (`source.branch`), pas un fichier du dépôt.
- **Impact** : quiconque utilise l'URL Railway voit une version vieille
  d'une semaine — potentiellement avec le bug P0 (`sc-projects-v1` écrasé
  à la création d'un projet) et le bug P1 (états de visite incohérents)
  encore actifs, puisque ces correctifs sont sur `main`, jamais mergés
  dans `develop`.
- **Niveau** : CRITIQUE — **identifié, NON corrigé**. Modifier la
  configuration de déploiement d'un service en production, ou fusionner
  `main` dans `develop`, est une action à fort impact sur un système
  partagé réel ; la mission demandait de *vérifier* ce point (§16), pas
  de le corriger unilatéralement. **Décision demandée à l'utilisateur** :
  soit repointer Railway sur `main`, soit fusionner `main` → `develop`.

### 1.3 — Acacias : `sc-visits-v3` et `sc-gantt-v2` désynchronisés (3 `taskId` inexistants)
- **Symptôme** : 3 des 8 relevés de tâche d'une visite (zones « Abords »
  ×2 et « Logement B-101 ») référencent des `taskId` (`T-L07-01`,
  `T-L08-01`) absents du Gantt Acacias actuel (16 tâches, lots L07/L08
  sans aucune feuille).
- **Cause exacte** : les deux clés ont été régénérées indépendamment
  (vraisemblablement lors du « nettoyage » mentionné dans la mission),
  sans garantie de cohérence référentielle entre elles — un problème de
  **données**, pas de code.
- **Vérification de non-gravité (lecture de code, pas supposition)** :
  `applyVisitToPlanning` (`src/lib/visits.ts:562-573`) fait
  `byId.get(t.id)` sur les tâches du **Gantt** ; un `taskId` de visite qui
  ne matche aucune tâche Gantt est simplement **ignoré** (`if (!c) return
  t`) — aucune exception. `LotControl.tsx` n'effectue aucune résolution
  par id vers le Gantt à l'affichage : chaque relevé porte déjà son
  propre `title`/`lotId` dénormalisés.
- **Impact** : ces 3 relevés s'affichent dans Visite mais ne se
  répercuteront jamais sur Planning — incohérence visible mais non
  bloquante.
- **Niveau** : IMPORTANT — **NON corrigé** : reconstituer un `taskId`
  « correct » pour ces 3 entrées demanderait d'inventer une donnée que
  rien ne permet de déduire avec certitude (les lots L07/L08 n'ont
  aujourd'hui aucune tâche dans le Gantt Acacias). Documenté plutôt que
  corrigé au hasard.

### 1.4 — Acacias : 4 valeurs de `state` hors du vocabulaire `TaskState` (récidive du bug P1)
- **Symptôme** : 4 relevés (sur 8 au total) portaient `reminder` (×2),
  `to_verify`, `done` — des valeurs qui n'existent pas dans
  `TaskState` (`'not_checked'|'ok'|'to_review'|'blocked'|'na'`,
  `src/lib/visits.ts:74`).
- **Cause exacte** : mêmes données de démo Acacias reseedées après le
  « nettoyage » de la base, réutilisant l'ancien vocabulaire erroné déjà
  corrigé une première fois lors du sprint précédent — la correction de
  ce sprint n'a pas persisté au reseed.
- **Fichier** : donnée Supabase uniquement
  (`sc-visits-v3::p-demo-residence-20260920`), aucun fichier de code.
- **Impact** : incohérence d'affichage (badge/couleur) pour ces 4 tâches
  dans Visite — non bloquant (même mécanisme de repli que documenté dans
  `docs/SPRINT_FIABILISATION_2026-09-21.md` §6).
- **Niveau** : IMPORTANT — **CORRIGÉ** (voir §4), par un remappage
  identique en principe à celui déjà validé (`reminder`/`to_verify` →
  `to_review`, `done` → `ok`), ciblé par identité exacte
  (visite + zone + taskId), sans toucher aux 3 entrées de §1.3 ni à
  aucune autre donnée.

### 1.5 — `sc-current-project-v1` pointait sur Acacias au lieu de Gambetta
- **Symptôme** : au chargement, l'application aurait affiché Acacias
  plutôt que l'opération de référence demandée par la mission.
- **Cause exacte** : résidu de la dernière sélection active avant le
  nettoyage de la base — pas un bug de code (`resolveCurrent` fonctionne
  correctement, il retombe sur le premier projet valide connu ; Acacias
  étant un projet valide, aucun filet ne le corrige automatiquement).
- **Niveau** : MINEUR — **CORRIGÉ** (voir §4).

### 1.6 — Information : PWA `registerType: 'autoUpdate'` sans `cleanupOutdatedCaches` explicite
- **Symptôme potentiel (non reproduit)** : au tout premier chargement
  juste après un déploiement, un onglet déjà ouvert pourrait
  momentanément charger un chunk JS obsolète référençant un export
  supprimé, avant que le nouveau service worker ne prenne la main.
- **Niveau** : MINEUR, théorique — **NON corrigé** (rien ne prouve que ça
  se produit réellement ; corriger de manière spéculative sans
  reproduction irait à l'encontre de la consigne de ce sprint).

---

## 2. Ce qui fonctionne

- Le registre `sc-projects-v1` contient **exactement** les 2 opérations
  demandées (Gambetta `p1789341672812846`, Acacias
  `p-demo-residence-20260920`), avec id/nom/référence/adresse conformes
  point par point à la mission. `sc-trash-v1` est vide.
- Le mécanisme de fusion sûre (`reconcileProjectsBeforeFlush`,
  `src/lib/sync.ts`) qui empêche qu'un ajout/édition locale efface
  d'autres opérations : 9 tests dédiés, tous verts (TEST 1-6, E, F +
  reproduction de l'incident réel — `src/lib/sync.test.ts`).
- **Données Gambetta** intégralement vérifiées (lecture seule, rien
  modifié) : 66 tâches Gantt (aplati, y compris sous-tâches imbriquées),
  8 lots, 16 unités, 207 liens tâche-unité, 47 réserves, 8 marchés, 916
  relevés de visite sur 4 visites — **0** doublon d'id, **0** référence
  cassée (`parent_id`, `lot_id`, `taskId`, `unitId`), **0** date invalide
  ou inversée, **0** progression hors bornes, **0** titre manquant,
  **0** état de visite invalide.
- **Données Acacias** : units/task-units sans référence cassée, réserves
  sans état invalide, Gantt (16 tâches) sans doublon/date invalide/
  progression hors bornes ; états de visite désormais 100% valides
  (après correction §4).
- Séparation du modèle d'état confirmée par lecture de code : `TaskState`
  (contrôle de tâche), `FollowUpStatus`/`ReserveStatus` (réserves/
  observations) et le `status` Gantt (dérivé uniquement de `progress` par
  `deriveTaskStatus`, `planningEngine.ts:32-37`) restent trois concepts
  distincts, avec un seul pont volontaire et documenté
  (`state==='blocked'` → statut Gantt `blocked`, `visits.ts:547-551`).
- Détection de cycle de dépendances implémentée et sûre (algorithme de
  Kahn) dans `cpm.ts`, `forecast.ts`, `planningEngine.ts` — pas de boucle
  infinie possible, retour propre (`hasCycle: true`, tâches inchangées).
- Les 5 pages auditées (Structure, Visite, Gantt, Finances, Reports)
  chargent leurs données via `repo.ts` avec des valeurs par défaut sûres
  (`loadState(key, [])`/`null`) ; aucun accès non protégé (`.find()`,
  index `[0]`, déréférencement) trouvé.
- Routing SPA maison + `vercel.json` en rewrite total ; le mode `vite
  preview` utilisé par Railway a son propre fallback SPA par défaut.
- RLS actif sur `app_state` et `profiles` ; compte `admin`/superadmin
  sain (`disabled: false`).
- Fonctionnalité Photos toujours présente dans le code (non supprimée,
  non modifiée ce sprint).
- 493 tests unitaires (36 fichiers) + 6 scripts E2E locaux (Playwright
  headless, sans compte Supabase — voir §3) passent tous. `tsc`, `eslint`,
  `build` propres.

## 3. Ce qui n'a pas pu être testé

**BROWSER E2E NON DISPONIBLE** — vérifié, pas supposé : cet environnement
bloque explicitement l'accès réseau sortant direct vers
`xphuzuvmjnzwqtdwrabv.supabase.co` et vers
`suivi-chantier-production-396f.up.railway.app` (`curl` → `403` au niveau
du proxy de sortie, politique organisationnelle). Le parcours demandé en
§15 (LOGIN → Mes opérations → Gambetta → Structure → Planning → Visite →
Finances → Rapports → Acacias → retour Gambetta → reload) n'a **pas** pu
être exécuté dans un navigateur connecté au compte réel.

Précisions :
- Les 6 scripts `e2e/*.mjs` exécutés (Playwright + Chromium réel, mais en
  **local uniquement**, sans compte Supabase connecté) ont tous réussi —
  ce n'est pas le même test que celui demandé en §15, et ne doit pas être
  présenté comme tel.
- Le comportement de `reconcileProjectsBeforeFlush` sous une **vraie**
  concurrence (deux onglets/appareils réels simultanés) reste couvert
  uniquement par des tests unitaires avec mock Supabase, jamais en
  conditions réelles.
- L'affichage effectif des 2 opérations dans « Mes opérations », la
  persistance de la sélection Gambetta/Acacias à travers un vrai reload,
  et l'ouverture réelle de chaque page n'ont pas été vérifiés
  visuellement — seulement par lecture de code, tests unitaires et
  requêtes SQL directes sur `app_state`.
- Offline réel (coupure réseau pendant l'usage) : couvert uniquement par
  simulation (`ctrl.failSelect`/`ctrl.failWrites` dans le mock Supabase
  des tests), jamais en conditions réseau réelles.
- Upload/persistance réelle de Photos : non testé (nécessite un
  navigateur réel, éventuellement un stockage connecté).
- Le contenu exact actuellement *servi* par l'URL Railway n'a pas pu être
  inspecté en direct (réseau bloqué) — seule la **configuration** de
  déploiement (branche, dernier commit) a été vérifiée via l'API Railway.

## 4. Corrections réalisées

**Code** (commit `46d2b3b`) :
- `src/components/ErrorBoundary.tsx` (nouveau) — Error Boundary minimal,
  intégré dans `src/App.tsx` autour de `.app-body` **uniquement** (jamais
  `SideNav`/`Topbar`/`Navigation`, qui restent utilisables après une
  exception) ; `key={page}` le réinitialise au changement de page ;
  boutons Réessayer / Retour ; détail technique affiché seulement en mode
  dev (`import.meta.env.DEV`), toujours loggé en console.
- `src/components/ErrorBoundary.test.tsx` (nouveau, 5 tests).
- Aucun autre fichier de code modifié.

**Données Supabase** (écritures ciblées sur `app_state`, pas de commit
git — ce sont des lignes de données, pas du code) :
- `sc-current-project-v1` : `p-demo-residence-20260920` →
  `p1789341672812846` (Gambetta), conforme à la mission §1.
- `sc-visits-v3::p-demo-residence-20260920` : 4 valeurs de `state`
  remappées par identité exacte (visite + zone + taskId) —
  `reminder`→`to_review` (×2), `to_verify`→`to_review`, `done`→`ok`.
  Rien d'autre modifié dans cette clé (les 3 `taskId` cassés de §1.3
  restent en l'état, volontairement).

**Rien d'autre n'a été touché** : ni les données Gambetta, ni
`repo.ts`/`projects.ts`/`sync.ts` (déjà corrects — aucune modification
nécessaire), ni la configuration Railway, ni GED/RFI/VISA/vidéo/plans
PDF.

## 5. Tests

| Test | Résultat | Détail |
|---|---|---|
| TypeScript | ✅ OK | `npx tsc -b` → exit 0 |
| ESLint | ✅ OK | 0 erreur, 15 avertissements préexistants inchangés |
| Unit tests | ✅ OK | 493/493 (vitest, 36 fichiers) |
| Build | ✅ OK | `npm run build` → succès |
| Supabase | ✅ Vérifié | RLS actif sur `app_state`/`profiles` ; compte `admin`/superadmin sain ; lecture/écriture confirmées par les corrections appliquées et relues après coup |
| Browser E2E | ❌ **NON DISPONIBLE** | Réseau sortant bloqué vers `*.supabase.co` et l'URL Railway (403 CONNECT, vérifié par `curl`) |
| Offline | ⚠️ Simulé seulement | `sync.test.ts` (mocks `failSelect`/`failWrites`) ; jamais en conditions réseau réelles |
| Gantt | ✅ OK | Gambetta (66 tâches) + Acacias (16 tâches) : 0 doublon/référence cassée/date invalide/progression hors bornes ; détection de cycle confirmée par lecture de `cpm.ts`/`forecast.ts` |
| Visite | ⚠️ Partiel | Données corrigées et vérifiées cohérentes (Gambetta 916 relevés, Acacias 8) ; workflow complet couvert par `e2e/recipe-metier-complete.mjs` (local, sans Supabase réel) ; jamais testé en navigateur connecté |
| Photos | ⚠️ Non testé | Code présent, non modifié ; aucun test d'upload/persistance réel (nécessite navigateur) |

## 6. Données

Confirmé par relecture directe de `app_state` après les corrections :
`sc-projects-v1` contient **exactement** ces deux opérations, aucune
autre :
- `p1789341672812846` — 111 rue Gambetta (ER.T2286, 111 Rue Gambetta,
  51100 Reims)
- `p-demo-residence-20260920` — Résidence des Acacias — Opération Démo
  (DEMO-ACACIAS-2026, 24 avenue des Acacias, 77420 Champs-sur-Marne)

`sc-current-project-v1` = `p1789341672812846` (Gambetta). `sc-trash-v1` =
`[]`. Toutes les autres opérations (Gambetta copie 2, Les Tilleuls ×3,
TEST-planning) restées en base sous leurs clés `sc-*::<id>` propres ne
sont plus référencées dans le registre — conforme à la mission (« doivent
être considérées comme supprimées du jeu de données de test »). Elles
n'ont pas été effacées physiquement (aucune clé `app_state` n'a été
supprimée ce sprint), seulement absentes du registre actif.

## 7. Commit

**SHA (code)** : `46d2b3b` — branche `main`, poussé.
Fichiers modifiés : `src/App.tsx` (intégration), `src/components/ErrorBoundary.tsx`
(nouveau), `src/components/ErrorBoundary.test.tsx` (nouveau, 5 tests).

**Corrections de données** : appliquées directement en base (voir §4),
pas de SHA git associé — ce sont des écritures `app_state`, journalisées
par leur `updated_at` Supabase, pas des commits.

**Point de décision en attente (§1.2)** : le déploiement Railway
(production) reste sur `develop`, 78 commits derrière `main` — aucune
action prise sans validation. Deux options possibles, à trancher par
l'utilisateur :
1. Repointer la source du service Railway sur la branche `main`.
2. Fusionner `main` dans `develop` (`git checkout develop && git merge
   main && git push`) et laisser Railway redéployer automatiquement.

---

*Voir aussi `docs/SPRINT_FIABILISATION_2026-09-21.md` (P0/P1, registre,
restauration) et `docs/AUDIT_ACACIAS_E2E_2026-09-21.md` (audit initial).*
